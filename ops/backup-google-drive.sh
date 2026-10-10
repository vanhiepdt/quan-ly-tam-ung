#!/usr/bin/env bash
# Sao lưu PostgreSQL va toan bo tep giao dich len Google Drive.
#
# Script nay chay tren host VPS, doc cau hinh tu BACKUP_CONFIG_FILE (mac dinh:
# /etc/quan-ly-tam-ung/backup.env). Khong dat khoa tai khoan dich vu vao Git.
# Phuong an du phong; ban production uu tien worker trong container.
set -euo pipefail

CONFIG_FILE="${BACKUP_CONFIG_FILE:-/etc/quan-ly-tam-ung/backup.env}"
if [ ! -r "$CONFIG_FILE" ]; then
  echo "Khong tim thay file cau hinh backup: $CONFIG_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
. "$CONFIG_FILE"
set +a

: "${APP_DIR:=/opt/quan-ly-tam-ung}"
: "${BACKUP_DIR:=/var/backups/quan-ly-tam-ung}"
: "${DB_CONTAINER:=quan-ly-tam-ung-db}"
: "${APP_CONTAINER:=quan-ly-tam-ung-app}"
: "${BACKUP_TZ:=Asia/Bangkok}"
: "${KEEP_LOCAL_DAYS:=14}"
: "${GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE:?Thieu GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE trong $CONFIG_FILE}"
: "${GOOGLE_DRIVE_FOLDER_ID:?Thieu GOOGLE_DRIVE_FOLDER_ID trong $CONFIG_FILE}"

if [ ! -r "$GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE" ]; then
  echo "Khong doc duoc khoa Service Account: $GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE" >&2
  exit 1
fi
case "$KEEP_LOCAL_DAYS" in
  ''|*[!0-9]*) echo 'KEEP_LOCAL_DAYS phai la so nguyen khong am.' >&2; exit 1 ;;
esac

mkdir -p "$BACKUP_DIR"
RUN_ID="$(TZ="$BACKUP_TZ" date +%Y%m%d-%H%M%S)"
WORK_DIR="$(mktemp -d "$BACKUP_DIR/.run-$RUN_ID.XXXXXX")"
ARCHIVE_NAME="tam-ung-$RUN_ID.tar.gz"
ARCHIVE_PATH="$BACKUP_DIR/$ARCHIVE_NAME"
KEY_PATH="$WORK_DIR/private-key.pem"
TOKEN_RESPONSE="$WORK_DIR/token.json"
UPLOAD_RESPONSE="$WORK_DIR/upload.json"
trap 'rm -rf "$WORK_DIR"' EXIT

log() { printf '[%s] %s\n' "$(TZ="$BACKUP_TZ" date '+%F %T')" "$*"; }

# Lay ten database tu environment ben trong container, khong in mat khau ra log.
POSTGRES_USER="$(docker exec "$DB_CONTAINER" sh -c 'printf "%s" "$POSTGRES_USER"')"
POSTGRES_DB="$(docker exec "$DB_CONTAINER" sh -c 'printf "%s" "$POSTGRES_DB"')"
: "${POSTGRES_USER:?Khong doc duoc POSTGRES_USER tu container database}"
: "${POSTGRES_DB:?Khong doc duoc POSTGRES_DB tu container database}"

log "Bat dau backup $RUN_ID"
docker exec -i "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$WORK_DIR/database.dump"
docker exec -i "$APP_CONTAINER" tar -czf - -C /var/lib/tam-ung/tep . > "$WORK_DIR/tep.tar.gz"

cat > "$WORK_DIR/manifest.txt" <<EOF
backup_id=$RUN_ID
created_at=$(TZ="$BACKUP_TZ" date -Iseconds)
database=$POSTGRES_DB
attachments=tep.tar.gz
source_host=$(hostname)
EOF

tar -czf "$ARCHIVE_PATH" -C "$WORK_DIR" database.dump tep.tar.gz manifest.txt
chmod 600 "$ARCHIVE_PATH"
log "Da tao $ARCHIVE_NAME ($(du -h "$ARCHIVE_PATH" | cut -f1))"

# Tao JWT RS256 cho Service Account bang openssl, khong can cai SDK.
CLIENT_EMAIL="$(jq -er '.client_email' "$GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE")"
TOKEN_URI="$(jq -er '.token_uri // "https://oauth2.googleapis.com/token"' "$GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE")"
jq -er '.private_key' "$GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE" > "$KEY_PATH"
chmod 600 "$KEY_PATH"

b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}
JWT_HEADER="$(printf '%s' '{"alg":"RS256","typ":"JWT"}' | b64url)"
NOW="$(date +%s)"
JWT_CLAIMS="$(jq -cn --arg iss "$CLIENT_EMAIL" --arg scope 'https://www.googleapis.com/auth/drive' --arg aud "$TOKEN_URI" --argjson iat "$NOW" --argjson exp "$((NOW + 3600))" '{iss:$iss,scope:$scope,aud:$aud,iat:$iat,exp:$exp}')"
JWT_CLAIMS_B64="$(printf '%s' "$JWT_CLAIMS" | b64url)"
JWT_UNSIGNED="$JWT_HEADER.$JWT_CLAIMS_B64"
JWT_SIGNATURE="$(printf '%s' "$JWT_UNSIGNED" | openssl dgst -sha256 -sign "$KEY_PATH" | b64url)"
JWT="$JWT_UNSIGNED.$JWT_SIGNATURE"

curl --fail --silent --show-error --max-time 30 \
  -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer' \
  --data-urlencode "assertion=$JWT" \
  "$TOKEN_URI" > "$TOKEN_RESPONSE"
ACCESS_TOKEN="$(jq -er '.access_token' "$TOKEN_RESPONSE")"

METADATA="$(jq -cn --arg name "$ARCHIVE_NAME" --arg parent "$GOOGLE_DRIVE_FOLDER_ID" '{name:$name,parents:[$parent]}')"
BOUNDARY="===============tamung$RUN_ID=="
HTTP_CODE="$({
  printf -- '--%s\r\n' "$BOUNDARY"
  printf -- 'Content-Type: application/json; charset=UTF-8\r\n\r\n%s\r\n' "$METADATA"
  printf -- '--%s\r\n' "$BOUNDARY"
  printf -- 'Content-Type: application/gzip\r\n\r\n'
  cat "$ARCHIVE_PATH"
  printf -- '\r\n--%s--\r\n' "$BOUNDARY"
} | curl --fail --silent --show-error --max-time 300 \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: multipart/related; boundary=$BOUNDARY" \
  -H 'X-Upload-Content-Type: application/gzip' \
  -o "$UPLOAD_RESPONSE" -w '%{http_code}' \
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true')"
[ "$HTTP_CODE" = '200' ] || { echo "Google Drive tra ve HTTP $HTTP_CODE" >&2; cat "$UPLOAD_RESPONSE" >&2; exit 1; }
DRIVE_FILE_ID="$(jq -er '.id' "$UPLOAD_RESPONSE")"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'tam-ung-*.tar.gz' -mtime "+$KEEP_LOCAL_DAYS" -delete
log "Da tai len Google Drive: $ARCHIVE_NAME (file id $DRIVE_FILE_ID)"
log "Hoan tat backup"