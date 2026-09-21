# Sinh VietQR cục bộ

## Ngân hàng, chi nhánh và Test QR

- Danh mục 65 ngân hàng lấy từ https://api.vietqr.io/v2/banks ngày 17/09/2026, lưu cục bộ tại `lib/qr/ngan-hang.json`. Đây là nguồn VietQR.io, không phải xác nhận trực tiếp từ từng ngân hàng; không suy ra mọi ngân hàng đều hỗ trợ mọi ứng dụng quét QR.
- Form thêm/sửa người lấy hóa đơn chọn tên ngân hàng từ danh sách; giá trị là BIN, máy chủ tự suy ra tên ngân hàng. Không nhập BIN thủ công. Mã cũ không thuộc danh mục cần được chọn lại, không tự chuyển sang ngân hàng khác.
- Thêm chi nhánh mở tài khoản qua migration `010_chi_nhanh_ngan_hang.sql`. Khi triển khai chạy `npm run db:migrate` trước khi khởi động ứng dụng mới.
- Nút **Test QR** dùng dữ liệu đang nhập, sinh ảnh cục bộ, không số tiền/nội dung, không ghi dữ liệu hoặc xác nhận thanh toán. Đổi ngân hàng/tài khoản sẽ bỏ QR cũ. Cần quét bằng ứng dụng ngân hàng để đối chiếu người nhận thực tế; tên hiển thị không phải kết quả xác minh tài khoản.
- Để in giấy chuyển khoản, liên kết người lấy hóa đơn với đúng **Cán bộ trong cơ quan**. Giấy lấy tài khoản duy nhất đang hoạt động của người đề nghị đã chọn; tên chủ tài khoản trên giấy là tên người đề nghị, kèm ngân hàng và chi nhánh. Thiếu liên kết hoặc có nhiều tài khoản thì cảnh báo trên form và không tự lấy tài khoản người khác. Cấu hình người ký mặc định không thay đổi.
- QR thanh toán phí vẫn dùng tài khoản của người lấy hóa đơn của giao dịch, độc lập với người ký giấy.


Nút **Thanh toán** trên nhật ký sinh QR cho phí lấy hóa đơn chưa thanh toán, từ tài khoản người lấy hóa đơn và số phí đã tính của giao dịch.

- Nguồn thuật toán: https://github.com/subiz/vietqr (Go, MIT).
- `lib/qr/subiz.ts` chuyển thể phần EMV/TLV và CRC16 cho chuyển khoản tài khoản (`QRIBFTTA`), VND, Việt Nam sang TypeScript. Không chạy module Go trực tiếp; không bao gồm API đa tiền tệ, ảnh ghép logo hoặc danh mục ngân hàng của upstream.
- `lib/qr/vietqr.ts` kiểm tra BIN, tài khoản, tiền, nội dung trước khi gọi bộ mã hóa; ảnh QR được dựng bằng `qrcode` đã có trong dự án.
- Kiểm thử đối chiếu payload ví dụ chính thức của subiz, gồm checksum `C15C`.
- Khác upstream: từ chối dữ liệu quá dài hoặc không hợp lệ, không tự cắt số hóa đơn/ngày và không âm thầm loại ký tự không hỗ trợ.
- Không gọi API QR bên ngoài, không tự chuyển tiền hoặc đánh dấu phí đã thanh toán. Luôn đối chiếu người nhận/số tiền trong ứng dụng ngân hàng.

Giấy phép upstream được giữ tại `docs/licenses/subiz-vietqr.txt`.
