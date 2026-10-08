#!/usr/bin/env bash
# Idempotent installer of the SERVERO monitoring stack on vytvorit-web.
#
#   Grafana OSS + Grafana Alloy   apt.grafana.com (signed-by keyring, pinned versions)
#   Prometheus, Alertmanager, Loki official GitHub release archives, pinned, sha256 verified
#
# Run ON THE SERVER as root from a copy of the ops/ directory
# (ops/deploy.sh --apply syncs it to /opt/servero-ops):
#
#   /opt/servero-ops/install-monitoring.sh            # = --dry-run, changes nothing
#   /opt/servero-ops/install-monitoring.sh --apply
#
# Dry run only reads system state and prints every action and config diff.
# Apply never overwrites existing secrets; it creates placeholders once.
set -euo pipefail

# ---------------------------------------------------------------- pinned versions
PROMETHEUS_VERSION=3.15.0
PROMETHEUS_SHA256=2a542df32eac02ee17b9d844fb2aa1de00dafa5476579ba8a3ba862e9d572ea0
ALERTMANAGER_VERSION=0.34.1
ALERTMANAGER_SHA256=265b9d1e55ef0d5306a436018af6d2b686c2ce051f03d968f7464ecb1372a7e8
LOKI_VERSION=3.7.8
LOKI_SHA256=62aea42c9cba52cd1642b3666ab37019a0ce4c24ab50b07e85dccc8d812f7d61
GRAFANA_VERSION=13.2.3
ALLOY_VERSION=1.20.1-1
GRAFANA_APT_KEY_FPR=B53AE77BADB630A683046005963FA27710458545

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MON="$OPS_DIR/monitoring"
SYSD="$OPS_DIR/systemd"
CACHE=/var/cache/servero-monitoring
MODE=dry-run

usage() {
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit "${1:-0}"
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) MODE=dry-run ;;
        --apply) MODE=apply ;;
        -h | --help) usage 0 ;;
        *) echo "Unknown argument: $arg" >&2; usage 2 ;;
    esac
done

# ---------------------------------------------------------------- helpers
declare -A CHANGED=()
WARNINGS=()

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
warn() { printf '\033[33mWARN\033[0m %s\n' "$*" >&2; WARNINGS+=("$*"); }
die() { printf '\033[31mERROR\033[0m %s\n' "$*" >&2; exit 1; }
dry() { [[ "$MODE" == dry-run ]]; }

# run CMD...: execute in apply mode, print in dry-run mode.
run() {
    if dry; then
        printf '    [dry-run] %s\n' "$*"
    else
        printf '    + %s\n' "$*"
        "$@"
    fi
}

# install_file SRC DST MODE OWNER GROUP [UNIT]: copy when content or
# metadata differs and flag UNIT as changed. Dry run prints a unified diff.
install_file() {
    local src=$1 dst=$2 mode=$3 owner=$4 group=$5 unit=${6:-}
    [[ -f "$src" ]] || die "missing source file $src"
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
        local cur
        cur="$(stat -c '%a %U %G' "$dst" 2>/dev/null || true)"
        if [[ "$cur" == "${mode#0} $owner $group" ]]; then
            return 0
        fi
        note "metadata of $dst: '$cur' -> '${mode#0} $owner $group'"
    elif [[ -f "$dst" ]]; then
        note "update $dst"
        diff -u "$dst" "$src" | sed 's/^/      /' || true
    else
        note "new file $dst"
    fi
    run install -D -m "$mode" -o "$owner" -g "$group" "$src" "$dst"
    if [[ -n "$unit" ]]; then CHANGED[$unit]=1; fi
}

ensure_dir() {
    local dir=$1 mode=$2 owner=$3 group=$4
    if [[ -d "$dir" ]]; then
        local cur
        cur="$(stat -c '%a %U %G' "$dir")"
        [[ "$cur" == "${mode#0} $owner $group" ]] && return 0
        note "fix $dir: '$cur' -> '${mode#0} $owner $group'"
    fi
    run install -d -m "$mode" -o "$owner" -g "$group" "$dir"
}

ensure_system_user() {
    local name=$1 home=$2
    if id -u "$name" >/dev/null 2>&1; then
        return 0
    fi
    run useradd --system --user-group --no-create-home --home-dir "$home" \
        --shell /usr/sbin/nologin "$name"
}

# write_secret_once DST MODE OWNER GROUP CONTENT: create only when missing.
write_secret_once() {
    local dst=$1 mode=$2 owner=$3 group=$4 content=$5
    if [[ -e "$dst" ]]; then
        note "keep existing secret $dst"
        return 0
    fi
    if dry; then
        note "[dry-run] create placeholder secret $dst ($mode $owner:$group)"
        return 0
    fi
    install -d -m 0750 -o root -g "$group" "$(dirname "$dst")"
    (umask 077 && printf '%s\n' "$content" > "$dst")
    chown "$owner:$group" "$dst"
    chmod "$mode" "$dst"
    note "created $dst"
}

random_secret() { openssl rand -hex 24; }

# fetch_release NAME VERSION URL SHA256 ARCHIVE_TYPE
fetch_release() {
    local name=$1 version=$2 url=$3 sha=$4 kind=$5
    local target="/opt/$name/$version"
    local file="$CACHE/${url##*/}"
    if [[ -x "$target/$name" ]]; then
        note "$name $version already installed in $target"
    else
        note "download $url"
        note "verify sha256 $sha"
        if ! dry; then
            install -d -m 0755 "$CACHE" "$target"
            curl -fsSL --retry 3 -o "$file.part" "$url"
            echo "$sha  $file.part" | sha256sum -c --quiet - || die "sha256 mismatch for $url"
            mv "$file.part" "$file"
            case "$kind" in
                tar) tar -xzf "$file" -C "$target" --strip-components=1 --no-same-owner ;;
                zip)
                    unzip -o -q "$file" -d "$target"
                    mv "$target/loki-linux-amd64" "$target/loki"
                    ;;
            esac
            chown -R root:root "$target"
            chmod 0755 "$target/$name"
        else
            note "[dry-run] extract to $target"
        fi
        CHANGED[$name]=1
    fi
    local link="/opt/$name/current"
    if [[ "$(readlink "$link" 2>/dev/null || true)" != "$target" ]]; then
        run ln -sfn "$target" "$link"
        CHANGED[$name]=1
    fi
}

# ---------------------------------------------------------------- preflight
say "Mode: $MODE (ops dir $OPS_DIR)"
if ! dry && [[ $EUID -ne 0 ]]; then
    die "--apply must run as root"
fi
[[ -d "$MON" && -d "$SYSD" ]] || die "run from the ops/ directory (missing monitoring/ or systemd/)"

ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
if [[ "$ARCH" != amd64 && "$ARCH" != x86_64 ]]; then
    if dry; then warn "architecture $ARCH is not amd64; archives are pinned for linux-amd64"; else die "architecture $ARCH is not amd64"; fi
fi
for tool in curl gpg sha256sum unzip tar openssl systemctl; do
    command -v "$tool" >/dev/null 2>&1 || warn "missing tool: $tool"
done
if [[ -r /proc/meminfo ]]; then
    avail_mb=$(( $(awk '/MemAvailable/ {print $2}' /proc/meminfo) / 1024 ))
    note "MemAvailable: ${avail_mb} MiB (stack budget: MemoryMax sum 1000 MiB, typical use ~550 MiB)"
    if (( avail_mb < 900 )); then
        warn "less than 900 MiB available; free memory first (see README, RAM budget)"
    fi
fi

# ---------------------------------------------------------------- apt: Grafana + Alloy
say "Grafana apt repository (signed-by /etc/apt/keyrings/grafana.gpg)"
KEYRING=/etc/apt/keyrings/grafana.gpg
if [[ -s "$KEYRING" ]] && gpg --show-keys --with-colons "$KEYRING" 2>/dev/null | grep -q "^fpr:::::::::$GRAFANA_APT_KEY_FPR:"; then
    note "keyring present with fingerprint $GRAFANA_APT_KEY_FPR"
else
    note "fetch https://apt.grafana.com/gpg.key, expect fingerprint $GRAFANA_APT_KEY_FPR"
    if ! dry; then
        tmpkey="$(mktemp)"
        curl -fsSL https://apt.grafana.com/gpg.key -o "$tmpkey"
        gpg --show-keys --with-colons "$tmpkey" | grep -q "^fpr:::::::::$GRAFANA_APT_KEY_FPR:" \
            || { rm -f "$tmpkey"; die "Grafana apt key fingerprint mismatch"; }
        install -d -m 0755 /etc/apt/keyrings
        gpg --dearmor --yes -o "$KEYRING" "$tmpkey"
        chmod 0644 "$KEYRING"
        rm -f "$tmpkey"
    fi
fi

APT_TMP="$(mktemp -d)"
trap 'rm -rf "$APT_TMP"' EXIT
cat > "$APT_TMP/grafana.sources" <<EOF
Types: deb
URIs: https://apt.grafana.com
Suites: stable
Components: main
Architectures: amd64
Signed-By: $KEYRING
EOF
cat > "$APT_TMP/servero-monitoring.pref" <<EOF
# Managed by ops/install-monitoring.sh: keep Grafana and Alloy on tested versions.
Package: grafana
Pin: version $GRAFANA_VERSION
Pin-Priority: 1001

Package: alloy
Pin: version $ALLOY_VERSION
Pin-Priority: 1001
EOF
install_file "$APT_TMP/grafana.sources" /etc/apt/sources.list.d/grafana.sources 0644 root root apt
install_file "$APT_TMP/servero-monitoring.pref" /etc/apt/preferences.d/servero-monitoring.pref 0644 root root apt

have_pkg() { [[ "$(dpkg-query -W -f='${Version}' "$1" 2>/dev/null || true)" == "$2" ]]; }
if have_pkg grafana "$GRAFANA_VERSION" && have_pkg alloy "$ALLOY_VERSION"; then
    note "grafana $GRAFANA_VERSION and alloy $ALLOY_VERSION already installed"
else
    if [[ -n "${CHANGED[apt]:-}" ]] || dry; then run apt-get update; fi
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        "grafana=$GRAFANA_VERSION" "alloy=$ALLOY_VERSION"
    CHANGED[grafana-server]=1
    CHANGED[alloy]=1
fi

# ---------------------------------------------------------------- release archives
say "Prometheus, Alertmanager, Loki (GitHub releases, sha256 verified)"
fetch_release prometheus "$PROMETHEUS_VERSION" \
    "https://github.com/prometheus/prometheus/releases/download/v$PROMETHEUS_VERSION/prometheus-$PROMETHEUS_VERSION.linux-amd64.tar.gz" \
    "$PROMETHEUS_SHA256" tar
fetch_release alertmanager "$ALERTMANAGER_VERSION" \
    "https://github.com/prometheus/alertmanager/releases/download/v$ALERTMANAGER_VERSION/alertmanager-$ALERTMANAGER_VERSION.linux-amd64.tar.gz" \
    "$ALERTMANAGER_SHA256" tar
fetch_release loki "$LOKI_VERSION" \
    "https://github.com/grafana/loki/releases/download/v$LOKI_VERSION/loki-linux-amd64.zip" \
    "$LOKI_SHA256" zip

# ---------------------------------------------------------------- users and directories
say "System users and directories"
ensure_system_user prometheus /var/lib/prometheus
ensure_system_user alertmanager /var/lib/alertmanager
ensure_system_user loki /var/lib/loki

# Groups of users created by apt or not yet existing in dry-run fall back to root.
grp() { getent group "$1" >/dev/null 2>&1 && echo "$1" || echo root; }

ensure_dir /etc/prometheus 0755 root root
ensure_dir /etc/prometheus/rules 0755 root root
ensure_dir /var/lib/prometheus 0750 "$(id -un prometheus 2>/dev/null || echo root)" "$(grp prometheus)"
ensure_dir /etc/alertmanager 0755 root root
ensure_dir /var/lib/alertmanager 0750 "$(id -un alertmanager 2>/dev/null || echo root)" "$(grp alertmanager)"
ensure_dir /etc/loki 0755 root root
ensure_dir /var/lib/loki 0750 "$(id -un loki 2>/dev/null || echo root)" "$(grp loki)"
ensure_dir /var/lib/node_exporter 0755 root root
ensure_dir /var/lib/node_exporter/textfile 0755 root root
ensure_dir /etc/servero-monitoring 0750 root "$(grp grafana)"
ensure_dir /var/lib/grafana/dashboards 0755 root root
ensure_dir /var/lib/grafana/dashboards/servero 0755 root root
ensure_dir /var/www/acme 0755 root root

# ---------------------------------------------------------------- configs
say "Configuration files"
install_file "$MON/prometheus/prometheus.yml" /etc/prometheus/prometheus.yml 0644 root root prometheus
for rule in "$MON"/prometheus/rules/*.yml; do
    install_file "$rule" "/etc/prometheus/rules/${rule##*/}" 0644 root root prometheus
done
install_file "$MON/alertmanager/alertmanager.yml" /etc/alertmanager/alertmanager.yml 0640 root "$(grp alertmanager)" alertmanager
install_file "$MON/loki/loki.yml" /etc/loki/loki.yml 0644 root root loki
install_file "$MON/alloy/config.alloy" /etc/alloy/config.alloy 0644 root root alloy
install_file "$MON/grafana/grafana.ini" /etc/grafana/grafana.ini 0640 root "$(grp grafana)" grafana-server
install_file "$MON/grafana/provisioning/datasources/servero.yml" \
    /etc/grafana/provisioning/datasources/servero.yml 0640 root "$(grp grafana)" grafana-server
install_file "$MON/grafana/provisioning/dashboards/servero.yml" \
    /etc/grafana/provisioning/dashboards/servero.yml 0640 root "$(grp grafana)" grafana-server
# Dashboards are re-read by Grafana every 60 s; no restart needed.
for board in "$MON"/grafana/dashboards/*.json; do
    install_file "$board" "/var/lib/grafana/dashboards/servero/${board##*/}" 0644 root root
done
install_file "$MON/backup-metrics.py" /usr/local/sbin/servero-backup-metrics 0755 root root

# ---------------------------------------------------------------- secrets (created once)
say "Secrets (placeholders are created once and never overwritten)"
write_secret_once /etc/alertmanager/secrets/smtp_password 0640 root "$(grp alertmanager)" "CHANGE_ME"
write_secret_once /etc/alertmanager/secrets/telegram_bot_token 0640 root "$(grp alertmanager)" "CHANGE_ME"

if [[ -e /etc/servero-monitoring/mysql-users.sql ]]; then
    note "keep existing /etc/servero-monitoring/mysql-users.sql"
elif [[ -e /etc/alloy/secrets/mysql_dsn || -e /etc/servero-monitoring/grafana.env ]]; then
    # Passwords in the SQL file must match the DSN and grafana.env, so never regenerate one alone.
    warn "mysql-users.sql is missing but mysql_dsn or grafana.env exists; remove all three to regenerate"
elif dry; then
    note "[dry-run] generate passwords for MySQL users exporter and grafana_ro"
    note "[dry-run] write /etc/alloy/secrets/mysql_dsn, /etc/servero-monitoring/grafana.env,"
    note "[dry-run]       /etc/servero-monitoring/mysql-users.sql (to be run by an admin)"
else
    exporter_pw="$(random_secret)"
    grafana_ro_pw="$(random_secret)"
    write_secret_once /etc/alloy/secrets/mysql_dsn 0640 root "$(grp alloy)" \
        "exporter:${exporter_pw}@(127.0.0.1:3306)/"
    write_secret_once /etc/servero-monitoring/grafana.env 0640 root "$(grp grafana)" "$(cat <<EOF
# Grafana secrets for grafana-server.service (EnvironmentFile drop-in).
# Admin password: initial login as "admin" at https://monitor.servero.cz
GF_SECURITY_ADMIN_PASSWORD=$(random_secret)
# Signs cookies and encrypts datasource secrets; never change after first start.
GF_SECURITY_SECRET_KEY=$(random_secret)
# SMTP relay password (account in grafana.ini [smtp] user); empty = mail fails.
GF_SMTP_PASSWORD=
# Password of MySQL user grafana_ro (see mysql-users.sql).
GRAFANA_MYSQL_RO_PASSWORD=${grafana_ro_pw}
EOF
)"
    (umask 077 && cat > /etc/servero-monitoring/mysql-users.sql <<EOF
-- Read-only MySQL users for monitoring. Run once as a MySQL admin, e.g.:
--   clpctl db:show:master-credentials
--   mysql -h 127.0.0.1 -u root -p < /etc/servero-monitoring/mysql-users.sql
-- grafana_ro needs the panel tables to exist (run panel migrations first).
CREATE USER IF NOT EXISTS 'exporter'@'localhost' IDENTIFIED BY '${exporter_pw}' WITH MAX_USER_CONNECTIONS 3;
CREATE USER IF NOT EXISTS 'exporter'@'127.0.0.1' IDENTIFIED BY '${exporter_pw}' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'exporter'@'localhost', 'exporter'@'127.0.0.1';
GRANT SELECT ON performance_schema.* TO 'exporter'@'localhost', 'exporter'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'grafana_ro'@'localhost' IDENTIFIED BY '${grafana_ro_pw}' WITH MAX_USER_CONNECTIONS 5;
CREATE USER IF NOT EXISTS 'grafana_ro'@'127.0.0.1' IDENTIFIED BY '${grafana_ro_pw}' WITH MAX_USER_CONNECTIONS 5;
GRANT SELECT ON servero_panel.orders TO 'grafana_ro'@'localhost', 'grafana_ro'@'127.0.0.1';
GRANT SELECT ON servero_panel.services TO 'grafana_ro'@'localhost', 'grafana_ro'@'127.0.0.1';
EOF
    )
    chmod 0600 /etc/servero-monitoring/mysql-users.sql
    note "created /etc/servero-monitoring/mysql-users.sql (run it as MySQL admin, see README)"
    unset exporter_pw grafana_ro_pw
fi

# ---------------------------------------------------------------- log access for Alloy
say "Alloy log access (CloudPanel site groups)"
if id -u alloy >/dev/null 2>&1 || dry; then
    for logs in /home/*/logs; do
        [[ -d "$logs" ]] || continue
        site_group="$(stat -c '%G' "$logs")"
        if id -nG alloy 2>/dev/null | tr ' ' '\n' | grep -qx "$site_group"; then
            continue
        fi
        run usermod -aG "$site_group" alloy
        CHANGED[alloy]=1
    done
fi

# ---------------------------------------------------------------- systemd units
say "systemd units"
for unit in prometheus.service alertmanager.service loki.service \
    servero-backup-metrics.service servero-backup-metrics.timer; do
    install_file "$SYSD/$unit" "/etc/systemd/system/$unit" 0644 root root "${unit%.service}"
done
install_file "$SYSD/alloy.service.d/override.conf" /etc/systemd/system/alloy.service.d/override.conf 0644 root root alloy
install_file "$SYSD/grafana-server.service.d/override.conf" \
    /etc/systemd/system/grafana-server.service.d/override.conf 0644 root root grafana-server
run systemctl daemon-reload

# ---------------------------------------------------------------- validate before (re)start
say "Validate configs with the installed binaries"
if dry; then
    note "[dry-run] promtool check config /etc/prometheus/prometheus.yml"
    note "[dry-run] amtool check-config /etc/alertmanager/alertmanager.yml"
    note "[dry-run] loki -config.file=/etc/loki/loki.yml -verify-config"
    note "[dry-run] alloy validate /etc/alloy/config.alloy"
else
    /opt/prometheus/current/promtool check config /etc/prometheus/prometheus.yml
    /opt/alertmanager/current/amtool check-config /etc/alertmanager/alertmanager.yml
    /opt/loki/current/loki -config.file=/etc/loki/loki.yml -verify-config
    /usr/bin/alloy validate /etc/alloy/config.alloy
fi

# ---------------------------------------------------------------- enable and (re)start
say "Enable and start services"
# Start order: storage first, then the agent, then Grafana.
for svc in prometheus alertmanager loki alloy grafana-server; do
    if dry; then
        state="$(systemctl is-active "$svc" 2>/dev/null || true)"
        note "[dry-run] systemctl enable $svc (now: ${state:-unknown})${CHANGED[$svc]:+, restart because config changed}"
        continue
    fi
    systemctl enable --quiet "$svc"
    if [[ -n "${CHANGED[$svc]:-}" ]] || ! systemctl is-active --quiet "$svc"; then
        note "restart $svc"
        systemctl restart "$svc"
    fi
done
run systemctl enable --now servero-backup-metrics.timer
if ! dry; then systemctl start servero-backup-metrics.service; fi

# ---------------------------------------------------------------- health
say "Health checks"
if dry; then
    note "[dry-run] curl 127.0.0.1:9090/-/ready, 9093/-/ready, 3100/ready, 3001/api/health, 12345/-/ready"
else
    sleep 5
    for url in http://127.0.0.1:9090/-/ready http://127.0.0.1:9093/-/ready \
        http://127.0.0.1:3100/ready http://127.0.0.1:3001/api/health http://127.0.0.1:12345/-/ready; do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
        if [[ "$code" == 200 ]]; then note "OK   $url"; else warn "$code $url (Loki and Grafana can need ~30 s after start; re-check)"; fi
    done
    systemctl --no-pager --lines=0 status prometheus alertmanager loki alloy grafana-server | grep -E '^\S|Memory:' || true
fi

say "Next steps"
note "1. Run /etc/servero-monitoring/mysql-users.sql as MySQL admin, then: systemctl restart alloy grafana-server"
note "2. Fill SMTP and Telegram secrets in /etc/alertmanager/secrets/ and GF_SMTP_PASSWORD, then restart"
note "3. Deploy ops/nginx/monitor.servero.cz.conf with ops/deploy.sh (cert required)"
if ((${#WARNINGS[@]})); then
    say "Warnings"
    for w in "${WARNINGS[@]}"; do note "- $w"; done
fi
if dry; then say "Dry run finished; nothing was changed. Re-run with --apply."; fi
