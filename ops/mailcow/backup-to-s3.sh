#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>/run/lock/mailcow-s3-backup.lock
flock -n 9 || exit 0
set -a
source /etc/mailcow-backup/env
set +a
for required in RESTIC_REPOSITORY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION RESTIC_PASSWORD_FILE; do
    [[ -n "${!required:-}" ]] || { echo "Mailcow S3 backup not configured: $required" >&2; exit 78; }
done
[[ "$RESTIC_REPOSITORY" == s3:https://* ]] || { echo 'Expected an HTTPS S3 repository' >&2; exit 78; }
[[ -s "$RESTIC_PASSWORD_FILE" ]] || { echo 'Restic encryption password is missing' >&2; exit 78; }
[[ "${MAILCOW_S3_VERIFIED:-0}" == 1 || "${1:-}" == --verify-first ]] || { echo 'S3 has not passed the initial backup and restore check' >&2; exit 78; }
restic snapshots --json >/dev/null

base=/var/lib/mailcow-backup
install -d -m700 "$base"
# Keep one staging copy if an upload fails; do not fill the disk with repeated attempts.
if [[ -d "$base/staging" ]]; then
    echo 'A previous staging backup remains. Retry its upload or inspect it before creating another.' >&2
    exit 1
fi
needed=$(du -sm /var/lib/docker/volumes/mailcowdockerized_vmail-vol-1/_data /var/lib/docker/volumes/mailcowdockerized_mysql-vol-1/_data | awk '{s+=$1} END {print s+2048}')
available=$(df -Pm "$base" | awk 'NR==2 {print $4}')
(( available > needed )) || { echo 'Insufficient free disk space for backup staging' >&2; exit 1; }
install -d -m755 "$base/staging"
export MAILCOW_BACKUP_LOCATION="$base/staging" THREADS=1
cd /opt/mailcow-dockerized
./helper-scripts/backup_and_restore.sh backup all
restic backup --tag mailcow --host mail.serveros.cz \
    "$base/staging" /opt/mailcow-dockerized /etc/mailcow-relay \
    /etc/systemd/system/mailcow.service /etc/systemd/system/mailcow-relay-tunnel.service \
    --exclude /opt/mailcow-dockerized/.git
restic check
rm -rf -- "$base/staging"
# Retention applies only to this host/tag, including when a bucket is shared.
restic forget --host mail.serveros.cz --tag mailcow --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune
date --iso-8601=seconds > "$base/last-success"
