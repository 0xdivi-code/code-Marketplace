#!/usr/bin/env bash
#
# Nightly Kiln backup, safe with the embedded database.
#
# PGlite's directory is a live PostgreSQL data directory: copying it while the
# API runs produces an inconsistent snapshot, so server/scripts/backup.ts exits
# on a running instance. This wraps it correctly: stop, back up, start, and let
# systemd put the site back exactly as it was (Restart=always would do it too,
# but an explicit start keeps the exit code honest).
#
# Install:
#   sudo install -m 755 /srv/kiln/deploy/nightly-backup.sh /usr/local/bin/kiln-backup
#   sudo crontab -e
#   15 3 * * * /usr/local/bin/kiln-backup >> /var/log/kiln-backup.log 2>&1
#
# Then copy the directory OFF the machine (rclone, restic, scp). A backup on the
# same disk is not a backup.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/kiln}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kiln}"
SERVICE="${SERVICE:-kiln}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RUN_AS="${RUN_AS:-kiln}"

say() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (it stops and starts the ${SERVICE} service)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chown "$RUN_AS":"$RUN_AS" "$BACKUP_DIR"

was_running=0
if systemctl is-active --quiet "$SERVICE"; then
  was_running=1
  say "stopping ${SERVICE}"
  systemctl stop "$SERVICE"
fi

# Whatever happens between here and the start, bring the shop back.
restore_service() {
  local code=$?
  if [[ $was_running -eq 1 ]]; then
    say "starting ${SERVICE}"
    systemctl start "$SERVICE" || say "WARNING: ${SERVICE} did not start — check journalctl -u ${SERVICE}"
  fi
  exit $code
}
trap restore_service EXIT

say "backing up into ${BACKUP_DIR}"
cd "$APP_DIR"
runuser -u "$RUN_AS" -- env HOME="/home/${RUN_AS}" \
  ./node_modules/.bin/tsx server/scripts/backup.ts "$BACKUP_DIR"

say "pruning backups older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS}" -print -exec rm -rf {} +

say "done — copy ${BACKUP_DIR} off this machine"
