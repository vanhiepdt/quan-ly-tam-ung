# OnlyOffice và giấy Word

## Triển khai

1. Sao lưu PostgreSQL và thư mục uploads trước khi triển khai. Bản ứng dụng này cần migration `009_tai_lieu_giay.sql`. Chạy migration bằng quy trình quản trị hiện có sau khi kiểm tra bản sao lưu; tác vụ phát triển không chạy migration trên DB thật.
2. Từ thư mục dự án chạy `chay-onlyoffice.bat len`. Script chỉ bổ sung cấu hình thiếu vào `.env.local`, không in khóa và không thay đổi PostgreSQL. Compose riêng `docker-compose.onlyoffice.yml` dùng project `tai-chinh-onlyoffice`.
3. Kiểm tra bốn biến môi trường rồi khởi động lại ứng dụng:
   - `ONLYOFFICE_JWT_SECRET`: khóa ngẫu nhiên ít nhất 32 ký tự, trùng giữa ứng dụng và DocumentServer.
   - `ONLYOFFICE_PUBLIC_URL`: origin DocumentServer mà trình duyệt truy cập (mặc định http://localhost:8081).
   - `ONLYOFFICE_INTERNAL_URL`: origin DocumentServer mà Next.js tải bản sửa (mặc định http://localhost:8081).
   - `ONLYOFFICE_APP_URL`: origin Next.js mà container truy cập (mặc định http://host.docker.internal:3000). Sửa cổng nếu ứng dụng chạy cổng khác. Ứng dụng phải lắng nghe giao diện container truy cập được.
4. `chay-onlyoffice.bat trang-thai` xem trạng thái; `chay-onlyoffice.bat tat` chỉ dừng editor, không xóa volume hoặc DB tài chính.

Compose mặc định chỉ công bố editor trên loopback. Triển khai LAN/Internet cần reverse proxy HTTPS cho cả ứng dụng và DocumentServer, địa chỉ public thực tế thay localhost, cùng cấu hình Host gốc được giữ nguyên. Không công bố PostgreSQL hay khóa JWT. Cho phép private IP trong DocumentServer là để callback tới máy chủ ứng dụng nội bộ; không dùng máy chủ này làm dịch vụ chuyển đổi công khai.

## Sử dụng

Từ giấy đề nghị của giao dịch, chọn **Mở trình soạn thảo**. Tài liệu lần đầu được chụp từ dữ liệu tài chính và mẫu hiện tại. Các lần mở tiếp theo dùng bản đã lưu, không tự cập nhật theo nhật ký. Nút Lưu trong editor force-save; đóng editor kết thúc phiên và có thể cần vài giây để nhận bản cuối. Liên kết tải DOCX lấy bản đã commit, không phải các phím vừa gõ chưa lưu. Khi editor lỗi, không coi thông báo đóng cửa sổ là xác nhận lưu.

Quản trị viên sửa mẫu tại **Cài đặt → Mẫu giấy đề nghị**. Mẫu gốc trong `Mau` không bị ghi đè. Bản sửa thay thế mẫu về mặt logic, lưu trong `uploads/giay`; lần lập giấy mới đọc lại mẫu hiện tại. Không đổi tên các placeholder `[[ten]]`. Mẫu tiếp khách và thanh toán nằm chung một tệp.

Người chỉ đọc nhận config view; callback lưu bị từ chối theo vai trò hiện tại. Mở tài liệu bằng POST có kiểm tra Origin và phiên đăng nhập; fetch từ DocumentServer dùng URL ký 15 phút; callback dùng capability riêng có hạn 7 ngày và JWT HS256.

## Lưu trữ và sao lưu

- `tai_lieu`: con trỏ bản hiện tại; `tai_lieu_phien_ban`: lịch sử SHA-256 và người lưu; `tai_lieu_phien`: khóa phiên OnlyOffice.
- Mỗi tệp dùng UUID bất biến. Ghi tệp xong mới INSERT và commit con trỏ; lỗi commit không trả thành công. Tệp mồ côi có thể còn lại nếu DB rollback; không tự xóa tệp đang có tham chiếu.
- Sao lưu DB và **toàn bộ** uploads/giay cùng nhau, cộng thư mục Mau gốc. Không chỉ sao lưu volume DocumentServer. Chưa có giao diện khôi phục phiên bản; quản trị viên cần quy trình khôi phục đã kiểm chứng.
- Force-save giữ nguyên key phiên; status 2/4 đóng phiên; mở lại sinh key mới. Callback lặp của phiên đã đóng không tạo thêm bản hoặc ghi đè phiên mới.

## Kiểm thử và giới hạn đã biết

`npm test` kiểm tra token, DOCX và handler. `npm run test:e2e` tạo DB tạm, chạy migration thật, đăng nhập thật, mở giấy, tải URL ký, chặn INSERT bằng khóa DB, xác nhận callback đợi commit, kiểm tra tệp bất biến và mở lại. DocumentServer trong test này là máy chủ tệp giả lập, **không** chứng minh editor thực chạy hay giao thức WebSocket với image Docker.

Chạy `npm run test:e2e -- --real-office` để kiểm thử DocumentServer `onlyoffice/documentserver:9.4` thật (cần Docker và Microsoft Edge). Harness build production bằng webpack trong thư mục tạm, dùng PostgreSQL tạm có kiểm tra danh tính và DocumentServer riêng, khóa JWT ngẫu nhiên; không nạp `.env` hay dùng DB thật. Kết nối không TLS chỉ áp dụng cho PostgreSQL tạm trên loopback; không thay đổi mặc định TLS của ứng dụng. Ứng dụng kiểm thử lắng nghe `0.0.0.0` để container truy cập qua `host.docker.internal`; chỉ chạy trên máy/mạng kiểm thử tin cậy. Tài nguyên tạm được dọn ở cuối lượt chạy.

Đã đạt 26/26 kiểm tra với image 9.4: gõ nội dung → force-save → đóng → nhận callback cuối → tải DOCX khớp từng byte → mở lại; admin lưu mẫu mà không ghi đè tệp gốc; tài khoản chỉ đọc mở/đóng viewer không đổi nội dung hay phiên bản, sau đó admin vẫn mở/đóng được. Phiên chỉ xem có thể không gửi callback status 4, nên key có thể còn sau khi đóng viewer; không coi đó là bằng chứng đã sửa tài liệu hoặc tự xóa key khi có người khác đang mở.

Trước vận hành vẫn cần kiểm tra nhanh với HTTPS/reverse proxy và cấu hình triển khai thực tế. Không dùng số liệu thật để thử khi chưa sao lưu.

Trong **Thêm giao dịch**, chọn **Tự lập giấy khi lưu giao dịch** để xem trước loại giấy, nội dung và số tiền (không phải bố cục Word). Checkbox mặc định tắt, chỉ hiện với hình thức có giấy. Sau khi lưu có liên kết **Mở giấy của giao dịch vừa lưu**; tại trang giấy chọn **Mở trình soạn thảo**.

Các giấy được tạo trong cùng transaction với giao dịch, đọc giao dịch vừa thêm bằng chính client PostgreSQL. SAVEPOINT bao quanh toàn bộ phần lập giấy: nếu giấy thứ hai lỗi thì rollback cả bộ giấy, vẫn lưu giao dịch và báo rõ không thêm lại giao dịch. Tệp đã ghi trước rollback có thể còn mồ côi như quy tắc lưu trữ ở trên. Hai loại tiếp khách/thanh toán dùng chung tệp mẫu nhưng giữ tài liệu riêng theo từng loại như luồng mở giấy hiện có. Cấu hình người ký được đọc lúc lập giấy.

E2E đã bổ sung checkbox, xem trước, kiểm tra DOCX và liên kết sau lưu; trigger lỗi trên DB tạm kiểm chứng rollback cả bộ giấy nhưng giữ đúng một giao dịch. Kiểm thử hồi quy xác nhận cả hai đường dẫn mẫu có tên mã hóa URL mở được và tên mẫu không tồn tại trả 404. Lượt mặc định dùng DocumentServer giả lập; lượt `--real-office` kiểm chứng editor thật như mô tả ở trên.

Không có tự phục hồi phiên khi DocumentServer mất cache; không đổi key thủ công lúc còn người đang sửa. Phiên kéo dài quá hạn capability cần đóng và mở lại. Không tuyên bố hoàn tất kiểm thử DocumentServer thật nếu chỉ chạy E2E giả lập.
