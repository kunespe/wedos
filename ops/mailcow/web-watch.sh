#!/usr/bin/env bash
# The watch from outside: runs on the MAIL server and asks the WEB server's applications
# whether they are up. Everything else that alerts (Prometheus, Alertmanager, Grafana) runs
# on the web server itself, so when that machine, its network or its nginx is gone, nothing
# there can say so. This can, because it is another machine and sends through Mailcow here.
#
#   /usr/local/sbin/serveros-web-watch              one round; cron runs it every 5 minutes
#   /usr/local/sbin/serveros-web-watch --test-mail  send one test message and exit
#
# A target is "down" after three failed rounds in a row (15 minutes), which is one mail;
# a second mail says when it answers again. Nothing is sent while things simply work.
# Installed with web-watch.cron as /etc/cron.d/serveros-web-watch (ops/mailcow/README.md).
set -Eeuo pipefail

TARGETS="${WEB_WATCH_TARGETS:-https://app.zubzi.cz/up https://mavacom.cz/up https://monitor.serveros.cz/api/health https://panel.serveros.cz/zdravi}"
MAIL_TO="${WEB_WATCH_TO:-info@vytvorit-web.cz podpora@zubzi.cz}"
MAIL_FROM="${WEB_WATCH_FROM:-noreply@zubzi.cz}"
STATE_DIR="${WEB_WATCH_STATE:-/var/lib/serveros-web-watch}"
THRESHOLD=3
MAILCOW_DIR=/opt/mailcow-dockerized

send_mail() { # subject body
	local subject="$1" body="$2" postfix to
	postfix="$(cd "$MAILCOW_DIR" && docker compose ps -q postfix-mailcow)"
	[[ -n "$postfix" ]] || { echo "postfix-mailcow is not running, cannot send: $subject" >&2; return 1; }
	for to in $MAIL_TO; do
		printf 'From: SERVEROS watch <%s>\nTo: %s\nSubject: %s\nContent-Type: text/plain; charset=utf-8\n\n%s\n' \
			"$MAIL_FROM" "$to" "$subject" "$body" |
			docker exec -i "$postfix" sendmail -f "$MAIL_FROM" "$to"
	done
}

if [[ "${1:-}" == --test-mail ]]; then
	send_mail "SERVEROS watch: zkouska" "Zkusebni zprava z postovniho serveru. Hlidane adresy: $TARGETS"
	echo "test mail sent to: $MAIL_TO"
	exit 0
fi

mkdir -p "$STATE_DIR"
for url in $TARGETS; do
	key="$(printf '%s' "$url" | tr -c 'A-Za-z0-9.' '_')"
	count_file="$STATE_DIR/$key.failures"
	down_file="$STATE_DIR/$key.down"
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 --retry 1 "$url" || true)"
	if [[ "$code" == 200 ]]; then
		if [[ -f "$down_file" ]]; then
			send_mail "OK: $url zase odpovida" "$url odpovida 200. Vypadek zacal $(cat "$down_file") UTC." || true
			rm -f "$down_file"
		fi
		rm -f "$count_file"
		continue
	fi
	failures=$(($(cat "$count_file" 2>/dev/null || echo 0) + 1))
	printf '%s\n' "$failures" >"$count_file"
	if ((failures >= THRESHOLD)) && [[ ! -f "$down_file" ]]; then
		date -u +%Y-%m-%dT%H:%M:%SZ >"$down_file"
		send_mail "VYPADEK: $url neodpovida" "$url odpovedel $code (000 znamena zadna odpoved) pri $failures kontrolach po sobe, tedy asi $((failures * 5)) minut. Kontrola bezi z postovniho serveru, mimo webovy server. Zacnete na: ssh serveros-web, systemctl status nginx php8.4-fpm postgresql@17-main." ||
			rm -f "$down_file"
	fi
done
