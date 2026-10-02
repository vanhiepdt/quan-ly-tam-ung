# Sao lưu Google Drive
#
# File `backup-google-drive.sh` chạy trên host VPS, tạo một gói gồm:
# - PostgreSQL dump ở định dạng custom;
# - toàn bộ thư mục tệp giao dịch;
# - manifest thời gian và máy tạo bản sao.
#
# Script dùng Google Drive API với Service Account. Khóa JSON không nằm trong repo.
# Tạo thư mục `/etc/quan-ly-tam-ung`, chép JSON Service Account vào đó, chia sẻ thư mục
# Google Drive cho `client_email` trong JSON với quyền Content manager/Editor, rồi tạo:
#
# ```bash
# install -d -m 700 /etc/quan-ly-tam-ung
# install -m 600 google-drive-service-account.json /etc/quan-ly-tam-ung/
# install -m 600 ops/backup.env.example /etc/quan-ly-tam-ung/backup.env
# # sửa GOOGLE_DRIVE_FOLDER_ID trong backup.env
# ```
#
# Cài cron theo múi giờ Bangkok/Ho Chi Minh lúc 17:00 hằng ngày:
#
# ```cron
# CRON_TZ=Asia/Bangkok
# 0 17 * * * BACKUP_CONFIG_FILE=/etc/quan-ly-tam-ung/backup.env /opt/quan-ly-tam-ung/ops/backup-google-drive.sh >> /var/log/quan-ly-tam-ung-backup.log 2>&1
# ```
#
# Chạy thử ngay:
#
# ```bash
# BACKUP_CONFIG_FILE=/etc/quan-ly-tam-ung/backup.env /opt/quan-ly-tam-ung/ops/backup-google-drive.sh
# ```
#
# Cron chỉ được cài sau khi kiểm tra lệnh chạy thử thành công.