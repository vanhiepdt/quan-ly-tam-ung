# Sao lưu Google Drive trên VPS

Bản chạy hiện tại tự sao lưu bên trong container ứng dụng. Worker kiểm tra hàng đợi mỗi 30 giây; giờ chạy được đặt trong **Cài đặt → Sao lưu dữ liệu**, theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, cùng giờ với Bangkok). Không cài thêm cron cho bản sao lưu này vì sẽ tạo các bản trùng với worker của ứng dụng.

Bản sao lưu gồm PostgreSQL và toàn bộ tệp giao dịch, được đóng gói thành `.tar.gz`, lưu tạm trên volume backup của VPS rồi tải lên thư mục Google Drive. Ứng dụng giữ bản cục bộ theo `BACKUP_KEEP_DAYS` (mặc định 14 ngày).

## Cấu hình lần đầu

Tạo Service Account trong Google Cloud, bật Google Drive API, tải JSON khóa xuống VPS và chia sẻ thư mục Drive đích cho địa chỉ `client_email` trong JSON. Không commit JSON hoặc ID thư mục vào GitHub.

Trên VPS:

```bash
install -d -m 700 /etc/quan-ly-tam-ung
install -m 600 /path/to/google-drive-service-account.json /etc/quan-ly-tam-ung/google-drive-service-account.json

cd /opt/quan-ly-tam-ung/deploy
# trong .env đặt:
# GOOGLE_DRIVE_FOLDER_ID=...
# BACKUP_CONFIG_DIR=/etc/quan-ly-tam-ung
chmod 600 .env
docker compose up -d --build
docker compose run --rm app node scripts/chay-migration.mjs
```

`BACKUP_CONFIG_DIR` là thư mục trên máy chủ được mount vào `/etc/quan-ly-tam-ung` trong container. Compose tự trỏ ứng dụng tới `/etc/quan-ly-tam-ung/google-drive-service-account.json`; không cần đưa nội dung khóa vào biến môi trường.

## Đặt lịch hoặc chạy thủ công

Đăng nhập bằng tài khoản quản trị, mở **Cài đặt → Sao lưu dữ liệu**:

- bật hoặc tắt sao lưu tự động;
- chọn giờ theo giờ Việt Nam, mặc định là `17:00`;
- bấm **Lưu lịch**;
- bấm **Backup ngay** để tạo một yêu cầu thủ công.

Sau khi gửi yêu cầu, worker sẽ cập nhật trạng thái chờ xử lý, đang sao lưu, thành công hoặc thất bại ngay trên màn hình Cài đặt. Hãy chạy thử **Backup ngay** sau khi cấu hình Service Account để kiểm tra quyền ghi vào thư mục Drive.

## Khôi phục

Ứng dụng chưa có nút khôi phục trực tiếp. Khi cần khôi phục, tải một gói `.tar.gz` từ Google Drive, giải nén, khôi phục `database.dump` bằng `pg_restore` và chép thư mục `tep/` vào volume tệp sau khi dừng ứng dụng hoặc theo quy trình bảo trì. Nên thử khôi phục một bản vào database tạm mỗi tháng.

## Script cũ trên host

Tệp `ops/backup-google-drive.sh` vẫn được giữ làm phương án dự phòng khi cần chạy ngoài container. Không cài cron của script này cùng worker trong ứng dụng; nếu dùng phương án dự phòng, hãy tắt lịch tự động trong Cài đặt trước.
