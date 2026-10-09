#!/usr/bin/env bash
# One-time preparation of vytvorit-web for SERVEROS. Run ON THE SERVER as root.
#
#   bootstrap-server.sh            dry run (default): prints what it would do
#   bootstrap-server.sh --apply    creates users, directories, the panel database
#                                  and /etc/servero-panel/env, placeholder TLS
#                                  certificates, installs certbot and enables ufw
#
# Idempotent: existing users, databases, env files and certificates are kept.
# The MySQL admin password is read from `clpctl db:show:master-credentials` and
# only ever passed through the environment of the mysql client, never printed.
set -euo pipefail

MODE=dry-run
[[ "${1:-}" == --apply ]] && MODE=apply
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

DOMAINS=(serveros.cz panel.serveros.cz monitor.serveros.cz)
WEB_ROOT=/home/servero/htdocs/serveros.cz
ENV_FILE=/etc/servero-panel/env
CERT_DIR=/etc/nginx/ssl-certificates
DB_NAME=servero_panel
DB_USER=servero_panel

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
run() {
    if [[ "$MODE" == apply ]]; then "$@"; else printf '    would run: %s\n' "$*"; fi
}

mysql_admin() {
    local pw
    pw="$(clpctl db:show:master-credentials | awk -F'|' '/ Password /{gsub(/ /, "", $3); print $3}')"
    [[ -n "$pw" ]] || { echo "could not read MySQL master credentials" >&2; exit 1; }
    MYSQL_PWD="$pw" mysql -h 127.0.0.1 -u root "$@"
}

say "Mode: $MODE"

say "Users and directories"
id servero >/dev/null 2>&1 || run useradd --system --create-home --home-dir /home/servero --shell /usr/sbin/nologin servero
id servero-panel >/dev/null 2>&1 || run useradd --system --no-create-home --home-dir /opt/servero-panel --shell /usr/sbin/nologin --groups vw-dashboard servero-panel
run install -d -m 0755 -o servero -g servero /home/servero /home/servero/htdocs "$WEB_ROOT"
run install -d -m 0755 /var/www/acme
run install -d -m 0750 -o root -g servero-panel /etc/servero-panel
run install -d -m 0755 -o servero-panel -g servero-panel /var/lib/servero-panel

say "Panel database ($DB_NAME)"
if mysql_admin -N -e "SELECT 1 FROM mysql.user WHERE user='$DB_USER'" | grep -q 1; then
    echo "    database user exists, keeping it"
    DB_PASS=''
else
    DB_PASS="$(openssl rand -hex 24)"
    if [[ "$MODE" == apply ]]; then
        mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
SQL
    else
        echo "    would create database $DB_NAME and user $DB_USER@127.0.0.1 with a random password"
    fi
fi

say "Panel environment ($ENV_FILE)"
if [[ -f "$ENV_FILE" ]]; then
    echo "    exists, keeping it"
elif [[ -z "$DB_PASS" ]]; then
    echo "    database user exists but $ENV_FILE is missing: reset the password by hand" >&2
    exit 1
elif [[ "$MODE" == apply ]]; then
    umask 077
    cat >"$ENV_FILE" <<ENV
# SERVEROS panel production settings. Documented in apps/panel/.env.example.
DATABASE_URL=mysql://$DB_USER:$DB_PASS@127.0.0.1:3306/$DB_NAME
ORIGIN=https://panel.serveros.cz
PUBLIC_WEB_ORIGIN=https://serveros.cz
BROKER_SOCKET=/run/vw-dashboard/broker.sock
PROMETHEUS_URL=http://127.0.0.1:9090
PROBES_FILE=/var/lib/servero-panel/probes.json
GRAFANA_URL=https://monitor.serveros.cz
CLOUDPANEL_URL=https://2.31.25.249:8443
# Empty until an SMTP relay on port 587 is set up (Hetzner blocks outbound 25); mail is logged meanwhile.
SMTP_URL=
MAIL_FROM=SERVEROS <info@serveros.cz>
ORDER_NOTIFY_EMAIL=info@serveros.cz
TURNSTILE_SECRET=
SUPPLIER_NAME=SERVEROS
SUPPLIER_ICO=
SUPPLIER_DIC=
SUPPLIER_ADDRESS=Plzeň
PAYMENT_ACCOUNT=
PAYMENT_IBAN=
VAT_RATE=0
PAYMENT_DUE_DAYS=14
ADDRESS_HEADER=X-Forwarded-For
PROTOCOL_HEADER=x-forwarded-proto
XFF_DEPTH=1
PORT=3000
HOST=127.0.0.1
ENV
    chown root:servero-panel "$ENV_FILE"
    chmod 0640 "$ENV_FILE"
    echo "    written"
else
    echo "    would write $ENV_FILE (0640 root:servero-panel) with the new database password"
fi

say "TLS keys of existing sites: tighten to 0600"
for key in "$CERT_DIR"/*.key; do
    [[ -e "$key" ]] || continue
    [[ "$(stat -c %a "$key")" == 600 ]] || run chmod 0600 "$key"
done

say "Placeholder certificates (replaced by issue-certs.sh once DNS points here)"
for d in "${DOMAINS[@]}"; do
    if [[ -f "$CERT_DIR/$d.crt" && -f "$CERT_DIR/$d.key" ]]; then
        echo "    $d: certificate present"
    else
        run openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=$d" \
            -keyout "$CERT_DIR/$d.key" -out "$CERT_DIR/$d.crt"
        run chmod 0600 "$CERT_DIR/$d.key"
    fi
done

say "certbot"
if command -v certbot >/dev/null; then
    echo "    installed"
else
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y -q certbot
fi

say "Firewall (ufw): only SSH, HTTP, HTTPS/QUIC and the CloudPanel admin port"
# Loopback is always allowed, so Varnish -> nginx :8080 and the local services keep working.
if ufw status | grep -q "Status: active"; then
    echo "    active, keeping rules"
else
    run ufw default deny incoming
    run ufw default allow outgoing
    for rule in 22/tcp 80/tcp 443/tcp 443/udp 8443/tcp; do run ufw allow "$rule"; done
    run ufw --force enable
fi

say "Done ($MODE)"
