# Sao lưu Google Drive cá nhân trên VPS

Ứng dụng dùng **OAuth tài khoản Google của chủ Drive**, không dùng Service Account hay Shared Drive. Worker kiểm tra hàng đợi mỗi 30 giây. Lịch đặt tại **Cài đặt → Sao lưu dữ liệu**, theo `Asia/Ho_Chi_Minh`, mặc định 17:00. Không cài thêm cron để tránh sao lưu trùng.

Gói `.tar.gz` gồm `database.dump`, `manifest.txt`, thư mục `tep/`; lưu tạm ở volume backup của VPS rồi tải lên một thư mục **Sao lưu Quản lý tạm ứng** do ứng dụng tạo trong *Drive của tôi*. Bản cục bộ được giữ theo `BACKUP_KEEP_DAYS` (mặc định 14 ngày). Lịch sử 30 lần hoàn tất hiển thị thành công/thất bại và lý do; chỉ trạng thái thành công sau khi Drive trả mã tệp mới xác nhận đã tải lên.

## Cấu hình tài khoản Google

1. Trong Google Cloud project, bật Google Drive API. Google Auth Platform → Branding/Audience: dùng External cho Gmail cá nhân; cấu hình Test users khi còn Testing. Với backup lâu dài không để Testing vì refresh token có thể hết hạn sau 7 ngày.
2. Data Access: cấp `openid`, `email`, `https://www.googleapis.com/auth/drive.file`. Ứng dụng chỉ quản lý thư mục và bản sao lưu do chính nó tạo, không cần cấp quyền toàn bộ Drive.
3. Clients → tạo OAuth client loại **Web application**. Authorized redirect URI phải khớp chính xác `https://hc.ttdt.site/api/sao-luu/google-drive/callback`. Tải JSON `client_secret_*.json`, tuyệt đối không đưa vào Git.
4. Chép JSON vào `/etc/quan-ly-tam-ung/google-oauth-client.json` trên VPS. Thư mục và file phải cho uid `node` trong container đọc được; mount read-only qua `BACKUP_CONFIG_DIR`. Không dùng file Service Account cũ.
5. Tạo `GOOGLE_DRIVE_TOKEN_KEY` bằng 32 byte base64url, đặt riêng trong `deploy/.env` (chmod 600). Giữ nguyên khóa sau khi kết nối vì refresh token trong PostgreSQL được mã hóa bằng khóa này. Nếu mất khóa phải kết nối Google lại. Không ghi giá trị vào log, tài liệu hay GitHub.
6. Triển khai app và migration `023_google_drive_oauth.sql`; đăng nhập admin vào **Cài đặt → Sao lưu dữ liệu → Kết nối Google Drive**, chọn chính tài khoản sở hữu Drive, cấp quyền. Bấm **Kiểm tra kết nối** để làm mới token và xác minh thư mục có quyền ghi; sau đó bấm **Backup ngay**, chờ trạng thái thành công và mở tệp trên Drive từ lịch sử.

OAuth dùng `state` ngẫu nhiên, PKCE, cookie HTTP-only trong 10 phút, chỉ admin của cùng phiên được nhận callback. Refresh token được mã hóa AES-256-GCM trong PostgreSQL, khóa chỉ trên VPS. Có thể **Ngắt kết nối** trong Cài đặt; khi đó lịch không tải được lên Drive cho đến khi kết nối lại. Trong Google Account cũng có thể thu hồi quyền ứng dụng.

## Khôi phục

Ứng dụng chưa có nút khôi phục trực tiếp. Tải `.tar.gz` từ Google Drive, giải nén, khôi phục `database.dump` bằng `pg_restore` cùng major PostgreSQL và chép `tep/` vào volume dữ liệu khi bảo trì. Nên thử khôi phục định kỳ trên DB tạm.

## Script Service Account cũ

`ops/backup-google-drive.sh` chỉ là phương án riêng cho Shared Drive; không dùng cho Drive cá nhân và không đặt cron song song với worker.
