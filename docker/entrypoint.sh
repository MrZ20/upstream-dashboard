#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/project-data}"
SYNC_INTERVAL_SECONDS="${SYNC_INTERVAL_SECONDS:-86400}"
export DATA_DIR SYNC_INTERVAL_SECONDS

mkdir -p "$DATA_DIR"
rm -f "$DATA_DIR/.sync.lock"


node /app/scripts/sync-server.mjs &

if node /app/scripts/sync-data.mjs; then
  node /app/scripts/sync-data.mjs --loop --delay-first &
else
  echo "Initial data sync failed; starting with current or empty runtime data." >&2
  node /app/scripts/sync-data.mjs --loop &
fi

exec nginx -g "daemon off;"
