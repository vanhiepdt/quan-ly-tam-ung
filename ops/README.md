# Sao lưu Google Drive — phương án dự phòng trên host

Bản production hiện tại đã có worker sao lưu trong container và giao diện tại **Cài đặt → Sao lưu dữ liệu**. Hãy dùng giao diện đó để đặt lịch hoặc chạy thủ công.

`backup-google-drive.sh` chỉ còn là phương án dự phòng khi cần chạy ngoài container. Không cài cron của script này cùng worker trong ứng dụng vì sẽ tạo các bản sao lưu trùng nhau. Nếu dùng script, hãy tắt lịch tự động trong Cài đặt trước.

Script tạo một gói gồm:

- PostgreSQL dump ở định dạng custom;
- toàn bộ thư mục tệp giao dịch;
- manifest thời gian và máy tạo bản sao.

Script dùng Google Drive API với Service Account. Khóa JSON không nằm trong repo. Tạo thư mục `/etc/quan-ly-tam-ung`, chép JSON Service Account vào đó, chia sẻ thư mục Google Drive cho `client_email` trong JSON, rồi dùng `ops/backup.env.example` nếu thật sự cần chạy phương án dự phòng.
