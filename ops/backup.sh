#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${UPLOAD_DIR:?UPLOAD_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
DATE=$(date +%F)
mkdir -p "$BACKUP_DIR/$DATE"
pg_dump --format=custom --file="$BACKUP_DIR/$DATE/database.dump" "$DATABASE_URL"
rsync -a --delete "$UPLOAD_DIR/" "$BACKUP_DIR/$DATE/tep/"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
