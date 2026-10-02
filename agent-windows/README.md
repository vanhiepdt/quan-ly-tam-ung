# Agent scan Windows Service

Agent này chạy trên máy Windows của cơ quan, chỉ theo dõi thư mục scan và gọi HTTPS tới VPS. Agent không giữ khóa AI và không mở cổng inbound.

## Cài đặt

1. Cài Node.js LTS 20 trở lên.
2. Chép `config.example.json` thành `config.json` trong thư mục `agent-windows`.
3. Trong Cài đặt của web, bấm **Tạo/rotate token agent**, dán token một lần vào `config.json`. Không đưa file này vào Git.
4. Sửa `scanDir`, `sentDir`, `errorDir` và URL nếu cần.
5. Mở PowerShell bằng quyền Administrator tại thư mục này và chạy:

```powershell
npm install
npm run install-service
```

Service tên `QuanLyTamUngInvoiceAgent` sẽ được đăng ký và tự chạy. Có thể quản lý bằng `services.msc`.

## Luồng file

- File PDF/XML mới phải đứng yên theo `stableSeconds` trước khi gửi.
- VPS trả HTTP 2xx thì file chuyển vào `DaGui\\yyyy-mm-dd` để đối chiếu, không xóa ngay.
- Lỗi HTTP hoặc lỗi đọc file thì chuyển vào `Loi\\yyyy-mm-dd`.
- Log của agent không in token. Không gửi lại file đã chuyển khỏi thư mục scan.

## Gỡ cài đặt

```powershell
npm run uninstall-service
```

Sau khi đổi token, sửa `config.json` rồi khởi động lại service trong `services.msc`.
