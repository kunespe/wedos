#!/usr/bin/env bash
# Deploy SERVERO to vytvorit-web from this repository (run on the admin machine).
#
#   ops/deploy.sh                    dry run (default): rsync -n previews, remote
#                                    diffs of nginx/systemd files, nginx -t on a
#                                    temporary copy of the live config
#   ops/deploy.sh --apply            backup, sync, nginx -t + reload, restart
#                                    changed units, health checks
#
# Options:
#   --only LIST      comma list of web,panel,ops (default: all three)
#   --build          build apps/panel locally even in dry run (apply builds by default)
#   --skip-build     never build, deploy the existing apps/panel/build
#   --migrate        after the panel sync, run DB migrations and load catalog/plans.json
#   HOST=user@host   target (default root@2.31.25.249), SERVER_IP for --resolve,
#   SSH_PORT=22      SSH port of HOST
#   RSYNC=path       rsync binary (default: rsync in PATH)
#
# Components:
#   web    apps/web/            -> /home/servero/htdocs/servero.cz/
#   panel  apps/panel build     -> /opt/servero-panel/ (+ pnpm install --prod on the server)
#   ops    ops/                 -> /opt/servero-ops/ (for install-monitoring.sh),
#          ops/nginx/*          -> /etc/nginx/sites-enabled/ and /etc/nginx/servero/,
#          ops/systemd/servero-panel.service -> /etc/systemd/system/
# A TLS vhost is skipped while /etc/nginx/ssl-certificates/<domain>.crt/.key is missing.
set -euo pipefail

HOST=${HOST:-root@2.31.25.249}
SERVER_IP=${SERVER_IP:-${HOST#*@}}
RSYNC=${RSYNC:-rsync}
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS="$REPO/ops"
WEB_ROOT=/home/servero/htdocs/servero.cz
PANEL_DIR=/opt/servero-panel
OPS_REMOTE=/opt/servero-ops
BACKUP_DIR=/root/servero-deploy-backups

MODE=dry-run
COMPONENTS=web,panel,ops
BUILD=auto
MIGRATE=0

usage() {
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit "${1:-0}"
}

while (($#)); do
    case "$1" in
        --apply) MODE=apply ;;
        --dry-run) MODE=dry-run ;;
        --only) COMPONENTS=${2:?--only needs a list}; shift ;;
        --only=*) COMPONENTS=${1#--only=} ;;
        --build) BUILD=yes ;;
        --skip-build) BUILD=no ;;
        --migrate) MIGRATE=1 ;;
        -h | --help) usage 0 ;;
        *) echo "Unknown argument: $1" >&2; usage 2 ;;
    esac
    shift
done

want() { [[ ",$COMPONENTS," == *",$1,"* ]]; }
dry() { [[ "$MODE" == dry-run ]]; }
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '\033[33mWARN\033[0m %s\n' "$*" >&2; WARNINGS+=("$*"); }
die() { printf '\033[31mERROR\033[0m %s\n' "$*" >&2; exit 1; }
WARNINGS=()

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -p "${SSH_PORT:-22}")
# Arguments are expanded locally on purpose (paths and flags from this script).
# shellcheck disable=SC2029
remote() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }
RSYNC_SSH="ssh ${SSH_OPTS[*]}"
rs() { "$RSYNC" -e "$RSYNC_SSH" "$@"; }

for c in ${COMPONENTS//,/ }; do
    case "$c" in web | panel | ops) ;; *) die "unknown component: $c" ;; esac
done

# vhost file -> certificate name in /etc/nginx/ssl-certificates, and the
# hostnames to health-check. Functions instead of associative arrays keep the
# script working with the stock macOS bash 3.2.
vhost_cert() { echo "${1%.conf}"; }
vhost_hosts() {
    case "$1" in
        servero.cz.conf) echo "servero.cz www.servero.cz" ;;
        *) echo "${1%.conf}" ;;
    esac
}
EXISTING_SITES=(centrumarete.cz jrmontaze.cz)

# ---------------------------------------------------------------- preflight
say "Mode: $MODE, host: $HOST ($SERVER_IP), components: $COMPONENTS"
command -v "$RSYNC" >/dev/null || die "rsync not found"
remote true || die "cannot ssh to $HOST"

# Remote facts as key=value lines (read-only).
FACTS="$(remote bash -s <<'EOF'
set -u
echo "servero_user=$(id -u servero >/dev/null 2>&1 && echo yes || echo no)"
echo "web_root=$([ -d /home/servero/htdocs/servero.cz ] && echo yes || echo no)"
echo "panel_user=$(id -u servero-panel >/dev/null 2>&1 && echo yes || echo no)"
echo "panel_env=$([ -f /etc/servero-panel/env ] && echo yes || echo no)"
echo "panel_modules=$([ -d /opt/servero-panel/node_modules ] && echo yes || echo no)"
echo "corepack=$([ -x /opt/node/bin/corepack ] && echo yes || echo no)"
for d in servero.cz panel.servero.cz monitor.servero.cz; do
    if [ -s "/etc/nginx/ssl-certificates/$d.crt" ] && [ -s "/etc/nginx/ssl-certificates/$d.key" ]; then
        echo "cert_$d=yes"
    else
        echo "cert_$d=no"
    fi
done
EOF
)"
fact() { sed -n "s/^$1=//p" <<<"$FACTS"; }
note "remote facts: $(tr '\n' ' ' <<<"$FACTS")"

# ---------------------------------------------------------------- stage nginx + systemd
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/servero-deploy.XXXXXX")"
REMOTE_TMP=""
cleanup() {
    rm -rf "$STAGE"
    if [[ -n "$REMOTE_TMP" ]]; then remote rm -rf "$REMOTE_TMP" || true; fi
}
trap cleanup EXIT

NEW_HOSTS=()
if want ops; then
    say "Stage nginx and systemd files"
    mkdir -p "$STAGE/nginx/sites" "$STAGE/nginx/servero" "$STAGE/systemd"
    cp "$OPS/nginx/00-servero-common.conf" "$OPS/nginx/servero-acme.conf" "$STAGE/nginx/sites/"
    cp "$OPS"/nginx/servero/*.conf "$STAGE/nginx/servero/"
    for vhost in servero.cz.conf panel.servero.cz.conf monitor.servero.cz.conf; do
        cert="$(vhost_cert "$vhost")"
        if [[ "$(fact "cert_$cert")" == yes ]]; then
            cp "$OPS/nginx/$vhost" "$STAGE/nginx/sites/"
            read -r -a hosts <<<"$(vhost_hosts "$vhost")"
            NEW_HOSTS+=("${hosts[@]}")
            note "stage $vhost"
        else
            warn "skip $vhost: /etc/nginx/ssl-certificates/$cert.crt/.key missing (issue the cert first, see ops/README.md)"
        fi
    done
    cp "$OPS/systemd/servero-panel.service" "$OPS"/systemd/servero-issue-certs.{service,timer} "$STAGE/systemd/"

    REMOTE_TMP="$(remote mktemp -d /tmp/servero-deploy.XXXXXX)"
    rs -a "$STAGE/" "$HOST:$REMOTE_TMP/stage/"

    say "Remote diff: staged files vs live (- live, + repo)"
    remote "STAGE=$REMOTE_TMP/stage bash -s" <<'EOF'
set -u
show() {
    local live=$1 new=$2
    if [ ! -e "$live" ]; then
        echo "    NEW  $live"
    elif cmp -s "$live" "$new"; then
        echo "    same $live"
    else
        echo "    DIFF $live"
        diff -u "$live" "$new" | sed 's/^/      /'
    fi
}
for f in "$STAGE"/nginx/sites/*.conf; do show "/etc/nginx/sites-enabled/${f##*/}" "$f"; done
for f in "$STAGE"/nginx/servero/*.conf; do show "/etc/nginx/servero/${f##*/}" "$f"; done
show /etc/systemd/system/servero-panel.service "$STAGE/systemd/servero-panel.service"
EOF

    say "nginx -t on a temporary copy of the live config plus staged files"
    remote "T=$REMOTE_TMP/nginx-test STAGE=$REMOTE_TMP/stage bash -s" <<'EOF'
set -euo pipefail
mkdir -p "$T/sites-enabled" "$T/servero" "$T/logs"
# Relative includes (fastcgi_params, mime.types, ...) resolve against the test config's directory,
# so mirror the rest of /etc/nginx there as read-only symlinks.
for entry in /etc/nginx/*; do
    case "${entry##*/}" in nginx.conf | sites-enabled | servero) ;; *) ln -s "$entry" "$T/${entry##*/}" ;; esac
done
cp -a /etc/nginx/sites-enabled/. "$T/sites-enabled/"
cp "$STAGE"/nginx/sites/*.conf "$T/sites-enabled/"
cp "$STAGE"/nginx/servero/*.conf "$T/servero/"
# Point staged files at the temp snippets and temp logs, so the test touches nothing live.
for f in "$STAGE"/nginx/sites/*.conf; do
    sed -i -e "s#/etc/nginx/servero/#$T/servero/#g" -e "s#/var/log/nginx/#$T/logs/#g" "$T/sites-enabled/${f##*/}"
done
grep -q 'include /etc/nginx/sites-enabled/\*.conf;' /etc/nginx/nginx.conf \
    || { echo "nginx.conf has no 'include /etc/nginx/sites-enabled/*.conf;' line" >&2; exit 1; }
sed "s#include /etc/nginx/sites-enabled/\*.conf;#include $T/sites-enabled/*.conf;#" /etc/nginx/nginx.conf > "$T/nginx.conf"
nginx -t -q -c "$T/nginx.conf" && echo "    nginx -t (staged): OK"
EOF
fi

# ---------------------------------------------------------------- panel build
if want panel; then
    say "Panel build (apps/panel)"
    if [[ "$BUILD" == yes || ("$BUILD" == auto && "$MODE" == apply) ]]; then
        command -v pnpm >/dev/null || die "pnpm not found (needed to build apps/panel)"
        (cd "$REPO/apps/panel" && pnpm install --frozen-lockfile && pnpm build)
    elif [[ -f "$REPO/apps/panel/build/index.js" ]]; then
        note "using existing apps/panel/build (pass --build to rebuild)"
    else
        note "apps/panel/build missing; --apply would run: pnpm install --frozen-lockfile && pnpm build"
    fi
fi

PANEL_RSYNC_ARGS=(-rlptz --delete --itemize-changes
    --exclude node_modules/ --exclude '.env*' --exclude .DS_Store
    --include /build/*** --include /drizzle/*** --include /scripts/***
    --include /src/ --include /src/lib/ --include /src/lib/server/ --include /src/lib/constants.ts
    --include /src/lib/server/db/*** --include /src/lib/server/auth/***
    --include /package.json --include /pnpm-lock.yaml --include /pnpm-workspace.yaml --include /.npmrc
    --exclude '*')
WEB_RSYNC_ARGS=(-rlptz --delete --itemize-changes --exclude .DS_Store)
OPS_RSYNC_ARGS=(-rlptz --delete --itemize-changes --exclude .DS_Store --exclude __pycache__/)

# ---------------------------------------------------------------- previews
say "rsync previews (-n --itemize-changes)"
if want web; then
    if [[ "$(fact web_root)" == yes ]]; then
        note "web: apps/web/ -> $WEB_ROOT/"
        rs -n "${WEB_RSYNC_ARGS[@]}" "$REPO/apps/web/" "$HOST:$WEB_ROOT/" | sed 's/^/      /'
    else
        warn "web: $WEB_ROOT does not exist; create the CloudPanel static site servero.cz (user servero) first"
    fi
fi
if want panel; then
    if [[ -f "$REPO/apps/panel/build/index.js" ]]; then
        note "panel: apps/panel (build + manifests) -> $PANEL_DIR/"
        rs -n "${PANEL_RSYNC_ARGS[@]}" "$REPO/apps/panel/" "$HOST:$PANEL_DIR/" 2>/dev/null | sed 's/^/      /' \
            || note "      (target $PANEL_DIR does not exist yet; everything is new)"
    fi
    [[ "$(fact panel_env)" == yes ]] || warn "panel: /etc/servero-panel/env missing (copy apps/panel/.env.example, fill it, chmod 0640 root:servero-panel)"
fi
if want ops; then
    note "ops: ops/ -> $OPS_REMOTE/"
    rs -n "${OPS_RSYNC_ARGS[@]}" "$OPS/" "$HOST:$OPS_REMOTE/" 2>/dev/null | sed 's/^/      /' \
        || note "      ($OPS_REMOTE does not exist yet; everything is new)"
fi

# health [all|existing]: new SERVERO hosts are only checked after an apply.
health() {
    say "Health checks (curl --resolve <host>:443:$SERVER_IP)"
    local failed=0 h code hosts=("${EXISTING_SITES[@]}")
    if [[ "${1:-all}" == all ]]; then hosts+=(${NEW_HOSTS[@]+"${NEW_HOSTS[@]}"}); fi
    for h in "${hosts[@]}"; do
        code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
            --resolve "$h:443:$SERVER_IP" "https://$h/" 2>/dev/null || true)"
        if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
            note "OK   $code https://$h/"
        elif [[ "${code:-000}" == 000 ]] && code="$(curl -sSk -o /dev/null -w '%{http_code}' --max-time 15 \
            --resolve "$h:443:$SERVER_IP" "https://$h/" 2>/dev/null)" && [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
            # Answers, but with the placeholder certificate until issue-certs.sh gets a real one.
            note "OK   $code https://$h/ (certificate not trusted yet)"
        else
            note "FAIL ${code:-000} https://$h/"
            failed=1
        fi
    done
    return "$failed"
}

if dry; then
    health existing || warn "some existing sites fail health checks already before deploy"
    say "Dry run finished; nothing on the server was changed (temp files in /tmp removed). Re-run with --apply."
    for w in ${WARNINGS[@]+"${WARNINGS[@]}"}; do note "- $w"; done
    exit 0
fi

# ================================================================= apply
TS="$(date +%Y%m%d-%H%M%S)"
say "Backup /etc/nginx and /etc/systemd/system -> $BACKUP_DIR/etc-$TS.tar.gz"
remote "install -d -m 0700 $BACKUP_DIR && tar -czf $BACKUP_DIR/etc-$TS.tar.gz -C / etc/nginx etc/systemd/system && ls -l $BACKUP_DIR/etc-$TS.tar.gz"

PANEL_CHANGED=0
UNIT_CHANGED=0

if want web && [[ "$(fact web_root)" == yes ]]; then
    say "Deploy web"
    rs "${WEB_RSYNC_ARGS[@]}" "$REPO/apps/web/" "$HOST:$WEB_ROOT/" | sed 's/^/      /'
    remote "chown -R servero:servero $WEB_ROOT && find $WEB_ROOT -type d -exec chmod 0755 {} + && find $WEB_ROOT -type f -exec chmod 0644 {} +"
fi

if want panel; then
    say "Deploy panel"
    [[ -f "$REPO/apps/panel/build/index.js" ]] || die "apps/panel/build/index.js missing"
    remote bash -s <<'EOF'
set -euo pipefail
if ! id -u servero-panel >/dev/null 2>&1; then
    useradd --system --user-group --home-dir /var/lib/servero-panel --shell /usr/sbin/nologin servero-panel
    echo "    created user servero-panel"
fi
install -d -m 0755 -o root -g root /opt/servero-panel
install -d -m 0750 -o root -g servero-panel /etc/servero-panel
EOF
    out="$(rs "${PANEL_RSYNC_ARGS[@]}" "$REPO/apps/panel/" "$HOST:$PANEL_DIR/")"
    # shellcheck disable=SC2001
    sed 's/^/      /' <<<"$out"
    [[ -n "$out" ]] && PANEL_CHANGED=1
    if grep -qE 'package\.json|pnpm-lock\.yaml' <<<"$out" || [[ "$(fact panel_modules)" != yes ]]; then
        note "install production dependencies on the server (native modules are built for linux)"
        remote "cd $PANEL_DIR && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 /opt/node/bin/corepack pnpm install --prod --frozen-lockfile"
        PANEL_CHANGED=1
    fi
    remote "chown -R root:root $PANEL_DIR && chmod -R go-w $PANEL_DIR"
    if ((MIGRATE)); then
        note "run panel migrations"
        remote "cd $PANEL_DIR && runuser -u servero-panel -- /usr/local/bin/node --env-file=/etc/servero-panel/env scripts/migrate.ts"
        note "load the price list (catalog/plans.json)"
        rs -z "$REPO/catalog/plans.json" "$HOST:$PANEL_DIR/plans.json"
        remote "cd $PANEL_DIR && runuser -u servero-panel -- /usr/local/bin/node --env-file=/etc/servero-panel/env scripts/seed.ts $PANEL_DIR/plans.json"
    fi
fi

if want ops; then
    say "Deploy ops (configs, nginx, systemd)"
    rs "${OPS_RSYNC_ARGS[@]}" "$OPS/" "$HOST:$OPS_REMOTE/" | sed 's/^/      /'
    remote "chown -R root:root $OPS_REMOTE && chmod 0755 $OPS_REMOTE/install-monitoring.sh $OPS_REMOTE/deploy.sh"

    set +e
    result="$(remote "STAGE=$REMOTE_TMP/stage ROLLBACK=$REMOTE_TMP/rollback bash -s" <<'EOF'
set -euo pipefail
mkdir -p "$ROLLBACK"
: > "$ROLLBACK/list"
changed=0
put() {  # put SRC DST MODE: install with rollback record
    local src=$1 dst=$2 mode=$3
    if [ -e "$dst" ] && cmp -s "$src" "$dst"; then return 0; fi
    if [ -e "$dst" ]; then
        cp -a "$dst" "$ROLLBACK/$(echo "$dst" | tr / _)"
        echo "restore $dst" >> "$ROLLBACK/list"
    else
        echo "remove $dst" >> "$ROLLBACK/list"
    fi
    install -D -m "$mode" -o root -g root "$src" "$dst"
    changed=1
    echo "    installed $dst"
    case "$dst" in /etc/systemd/*) echo "UNIT_CHANGED" ;; esac
}
rollback() {
    echo "    rolling back nginx/systemd files" >&2
    while read -r action path; do
        case "$action" in
            restore) cp -a "$ROLLBACK/$(echo "$path" | tr / _)" "$path" ;;
            remove) rm -f "$path" ;;
        esac
    done < "$ROLLBACK/list"
}
install -d -m 0755 /var/www/acme /etc/nginx/servero
for f in "$STAGE"/nginx/servero/*.conf; do put "$f" "/etc/nginx/servero/${f##*/}" 0644; done
for f in "$STAGE"/nginx/sites/*.conf; do put "$f" "/etc/nginx/sites-enabled/${f##*/}" 0644; done
put "$STAGE/systemd/servero-panel.service" /etc/systemd/system/servero-panel.service 0644
put "$STAGE/systemd/servero-issue-certs.service" /etc/systemd/system/servero-issue-certs.service 0644
put "$STAGE/systemd/servero-issue-certs.timer" /etc/systemd/system/servero-issue-certs.timer 0644
if ! nginx -t -q; then
    rollback
    nginx -t -q && echo "    rollback OK, nginx config is back to the previous state" >&2
    exit 1
fi
if [ "$changed" = 1 ]; then
    systemctl reload nginx
    echo "    nginx -t OK, reloaded"
    systemctl daemon-reload
else
    echo "    nginx -t OK, no nginx/systemd changes, no reload"
fi
EOF
)"
    rc=$?
    set -e
    printf '%s\n' "$result" | grep -v '^UNIT_CHANGED$' || true
    ((rc == 0)) || die "nginx config test failed after install; changes were rolled back"
    grep -qx UNIT_CHANGED <<<"$result" && UNIT_CHANGED=1
fi

if want panel || want ops; then
    if remote test -f /etc/systemd/system/servero-panel.service; then
        if [[ "$(fact panel_env)" == yes ]] || remote test -f /etc/servero-panel/env; then
            remote "systemctl enable --quiet servero-panel"
            if ((PANEL_CHANGED || UNIT_CHANGED)) || ! remote systemctl is-active --quiet servero-panel; then
                say "Restart servero-panel"
                remote "systemctl restart servero-panel && sleep 3 && systemctl is-active servero-panel && curl -fsS -o /dev/null -w '    local /: %{http_code}\n' http://127.0.0.1:3000/ || { journalctl -u servero-panel -n 40 --no-pager; exit 1; }"
            fi
        else
            warn "servero-panel not started: /etc/servero-panel/env is missing"
        fi
    fi
fi

if want ops && ! dry; then
    # Hourly: issues Let's Encrypt certificates as soon as DNS points here (ops/issue-certs.sh).
    remote "command -v certbot >/dev/null && systemctl enable --now --quiet servero-issue-certs.timer || true"
fi

if health; then
    say "Deploy finished"
else
    warn "health checks failed; backup: $BACKUP_DIR/etc-$TS.tar.gz on the server"
    for w in ${WARNINGS[@]+"${WARNINGS[@]}"}; do note "- $w"; done
    exit 1
fi
for w in ${WARNINGS[@]+"${WARNINGS[@]}"}; do note "- $w"; done
