#!/usr/bin/env bash
# Stores the password of the sending mailbox (info@serveros.cz) (Váš-hosting, mcg07) everywhere that sends
# mail: the panel (SMTP_URL), Alertmanager and Grafana. Run ON THE SERVER as root; the password is
# read from the terminal without echo and never written to the shell history or the repository.
#   ssh -t root@2.31.25.249 /opt/servero-ops/set-mail-password.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

USER_ADDR=${MAIL_USER:-info@serveros.cz}
HOST=${MAIL_HOST:-mcg07.vas-server.cz:587}
PANEL_ENV=/etc/servero-panel/env
AM_SECRET=/etc/alertmanager/secrets/smtp_password
GRAFANA_ENV=/etc/servero-monitoring/grafana.env

read -r -s -p "Heslo schránky $USER_ADDR: " PW; echo
[[ -n "$PW" ]] || { echo "prázdné heslo, nic neměním" >&2; exit 1; }

# Verify the login before touching any config (STARTTLS on 587). mcg07 rejects pipelined
# commands, so use a real SMTP client instead of piping into openssl.
if ! printf '%s' "$PW" | python3 -c '
import smtplib, sys
host, port = sys.argv[1].rsplit(":", 1)
s = smtplib.SMTP(host, int(port), timeout=20); s.starttls(); s.ehlo()
s.login(sys.argv[2], sys.stdin.read()); s.quit()' "$HOST" "$USER_ADDR"; then
    echo "Přihlášení k $HOST selhalo, nic neměním." >&2
    exit 1
fi
echo "Přihlášení OK."

enc="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$PW")"
user_enc="${USER_ADDR/@/%40}"
cp -a "$PANEL_ENV" "$PANEL_ENV.bak-$(date +%s)"
# smtp:// with STARTTLS on 587; nodemailer upgrades the connection when the server offers it.
python3 - "$PANEL_ENV" "smtp://$user_enc:$enc@$HOST" <<'PY'
import sys
path, url = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines()
lines = [l for l in lines if not l.startswith('SMTP_URL=')] + ['SMTP_URL=' + url]
open(path, 'w').write('\n'.join(lines) + '\n')
PY
install -m 0640 -o root -g "$(stat -c %G "$AM_SECRET")" /dev/null "$AM_SECRET.new"
printf '%s' "$PW" > "$AM_SECRET.new" && mv "$AM_SECRET.new" "$AM_SECRET"
if grep -q '^GF_SMTP_PASSWORD=' "$GRAFANA_ENV"; then
    python3 - "$GRAFANA_ENV" "$PW" <<'PY'
import sys
path, pw = sys.argv[1], sys.argv[2]
lines = [('GF_SMTP_PASSWORD=' + pw) if l.startswith('GF_SMTP_PASSWORD=') else l for l in open(path).read().splitlines()]
open(path, 'w').write('\n'.join(lines) + '\n')
PY
else
    printf 'GF_SMTP_PASSWORD=%s\n' "$PW" >> "$GRAFANA_ENV"
fi
unset PW enc

systemctl restart servero-panel alertmanager grafana-server
echo "Uloženo do panelu, Alertmanageru a Grafany a služby restartovány."
echo "Zkušební e-mail: runuser -u servero-panel -- /usr/local/bin/node --env-file=$PANEL_ENV /opt/servero-panel/scripts/digest.ts --always"
