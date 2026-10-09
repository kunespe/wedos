#!/usr/bin/env bash
# Issues Let's Encrypt certificates for SERVEROS hosts once their DNS points at this server.
# Run on the server as root; safe to run repeatedly (servero-issue-certs.timer does so hourly).
# Hosts still resolving elsewhere are skipped, so placeholder certificates stay until DNS moves.
# Renewal is certbot's own timer; the deploy hook copies renewed files and reloads nginx.
set -euo pipefail

SERVER_IP=${SERVER_IP:-2.31.25.249}
EMAIL=${CERT_EMAIL:-info@serveros.cz}
CERT_DIR=/etc/nginx/ssl-certificates
# Host and the names that go on its certificate.
declare -A NAMES=(
    [serveros.cz]="serveros.cz www.serveros.cz"
    [panel.serveros.cz]="panel.serveros.cz"
    [monitor.serveros.cz]="monitor.serveros.cz"
    # Old domain, only redirects to serveros.cz (nginx/servero.cz.conf).
    [servero.cz]="servero.cz www.servero.cz panel.servero.cz monitor.servero.cz"
)

command -v certbot >/dev/null || { echo "certbot missing (run bootstrap-server.sh --apply)" >&2; exit 1; }
install -d -m 0755 /var/www/acme

for host in "${!NAMES[@]}"; do
    # Already a Let's Encrypt certificate in place: certbot.timer handles renewal.
    if openssl x509 -in "$CERT_DIR/$host.crt" -noout -issuer 2>/dev/null | grep -q "Let's Encrypt"; then
        continue
    fi
    args=()
    ready=1
    for name in ${NAMES[$host]}; do
        if ! getent ahostsv4 "$name" | awk '{print $1}' | grep -qx "$SERVER_IP"; then
            echo "$name does not resolve to $SERVER_IP yet, skipping $host"
            ready=0
            break
        fi
        args+=(-d "$name")
    done
    ((ready)) || continue
    certbot certonly --non-interactive --agree-tos --email "$EMAIL" --webroot -w /var/www/acme \
        --cert-name "$host" "${args[@]}" \
        --deploy-hook "install -m 0600 \$RENEWED_LINEAGE/privkey.pem $CERT_DIR/$host.key && install -m 0644 \$RENEWED_LINEAGE/fullchain.pem $CERT_DIR/$host.crt && nginx -t -q && systemctl reload nginx"
    echo "issued $host"
done
