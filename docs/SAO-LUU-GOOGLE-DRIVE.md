# Sao lưu Google Drive trên VPS

Bản chạy production có script [`ops/backup-google-drive.sh`](../ops/backup-google-drive.sh). Script chạy ngoài container trên VPS, lấy `pg_dump` trực tiếp từ container PostgreSQL, nén toàn bộ tệp giao dịch trong volume và tải một gói `.tar.gz` lên thư mục Google Drive đã chia sẻ cho Service Account.

Tạo Service Account trong Google Cloud, bật Google Drive API, tải JSON khóa xuống VPS và chia sẻ thư mục Drive đích cho địa chỉ `client_email` trong JSON. Không commit JSON hoặc ID có tính bí mật vào GitHub.

Trên VPS:

```bash
install -d -m 700 /etc/quan-ly-tam-ung
install -m 600 /path/to/google-drive-service-account.json /etc/quan-ly-tam-ung/google-drive-service-account.json
install -m 600 /opt/quan-ly-tam-ung/ops/backup.env.example /etc/quan-ly-tam-ung/backup.env
# sửa GOOGLE_DRIVE_FOLDER_ID trong /etc/quan-ly-tam-ung/backup.env
BACKUP_CONFIG_FILE=/etc/quan-ly-tam-ung/backup.env /opt/quan-ly-tam-ung/ops/backup-google-drive.sh
```

Sau khi chạy thử thành công, cài lịch 17:00 mỗi ngày theo múi giờ Asia/Bangkok:

```bash
( crontab -l 2>/dev/null | grep -v 'ops/backup-google-drive.sh' || true
  printf '%s\n' 'CRON_TZ=Asia/Bangkok' '0 17 * * * BACKUP_CONFIG_FILE=/etc/quan-ly-tam-ung/backup.env /opt/quan-ly-tam-ung/ops/backup-google-drive.sh >> /var/log/quan-ly-tam-ung-backup.log 2>&1'
) | crontab -
```

Giữ lại các bản `.tar.gz` cục bộ trong 14 ngày. Bản backup chứa database dump, tệp giao dịch và manifest. Mỗi tháng nên thử khôi phục một bản vào database tạm.