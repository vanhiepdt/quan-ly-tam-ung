# Quản lý tạm ứng

Web quản lý tạm ứng, hoàn ứng và hóa đơn tiếp khách. Số dư được tính lại từ dữ liệu thô mỗi lần đọc — không lưu công thức trong ô như Google Sheets.

Đăng nhập bằng **tên đăng nhập**, không phải email. Kết quả **Đọc từ hóa đơn** chỉ là đề xuất; chưa bấm Lưu thì không ghi số vào database.

## Cần có

- [Node.js LTS](https://nodejs.org/) (npm đi kèm)
- PostgreSQL 16 đang chạy
- Windows: các file `.bat` trong thư mục gốc. Linux/macOS dùng lệnh `npm` tương ứng bên dưới.
- Docker Desktop: chỉ khi cần soạn giấy Word (OnlyOffice)

## Cài lần đầu

```bash
git clone <URL-repo>
cd "<thư mục dự án>"
npm install
```

### Windows (nhanh)

1. Nháy đúp `CAI-DAT-POSTGRESQL.bat`
2. Dán `DATABASE_URL`, nhập tên đăng nhập và mật khẩu admin
3. Script chạy migration và tạo tài khoản admin (không ghi đè `.env.local` nếu đã có)
4. Nháy đúp `chay-dev.bat` — mở http://localhost:3000

### Thủ công

1. Sao chép `.env.example` thành `.env.local` và điền:

```
DATABASE_URL=postgresql://USER:MAT_KHAU@127.0.0.1:5432/quan_ly_tam_ung
UPLOAD_DIR=./uploads
ADMIN_USERNAME=admin
ADMIN_PASSWORD=DOI_MAT_KHAU_NGAY
ADMIN_NAME=Quản trị viên
```

`UPLOAD_DIR` trên Windows có thể là đường dẫn thư mục trong dự án, ví dụ `./uploads`. Không commit `.env.local`.

2. Tạo database trống `quan_ly_tam_ung` trên PostgreSQL.

3. Chạy schema và tài khoản admin:

```bash
npm run db:migrate
npm run db:seed-admin
```

4. Chạy web:

```bash
npm run dev
```

Mở http://localhost:3000, đăng nhập bằng `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Sau khi kéo code mới

Luôn chạy migration (file mới được áp, file cũ bỏ qua):

```bash
npm run db:migrate
```

Bản này cần **`011_loai_tep_giay.sql`** (loại tệp tờ trình / giấy đề nghị đã ký). Nếu thiếu, trang Hồ sơ tệp không lưu được loại giấy đã ký.

## Dùng hàng ngày

| Việc | Windows | Lệnh |
|---|---|---|
| Mở web | `chay-dev.bat` | `npm run dev` |
| Khởi động lại server (vừa sửa `next.config` / thư viện) | `chay-dev.bat moi` | dừng rồi `npm run dev` |
| Test đọc hóa đơn PDF + Cài đặt AI | `TEST-HOA-DON.bat` | `npm run dev` rồi vào Giao dịch / Cài đặt |
| Test Word / OnlyOffice | `MO-WEB-TEST.bat` (cần Docker) | xem [docs/ONLYOFFICE.md](docs/ONLYOFFICE.md) |
| Migration | `chay-migration.bat` | `npm run db:migrate` |
| Test đơn vị | `chay-test.bat nhanh` | `npm test` và `npm run typecheck` |
| Bộ kiểm tra đầy đủ | `CHAY-KIEM-TRA-DU-AN.bat` | `npm test`, `npm run test:ui`, `npm run build`, `npm run test:e2e` |

### Đọc hóa đơn

1. Cài đặt → Cài đặt AI: bật lớp AI, chọn nhà cung cấp, điền khóa (hoặc khóa trong `.env.local`), bấm **Test API**.
2. Giao dịch → Thêm giao dịch → **Đọc từ hóa đơn**: chọn PDF.
3. QR khóa số hóa đơn và tổng tiền. AI điền người mua, dòng hàng, rượu bia. Soát bảng đối chiếu rồi bấm điền form / Lưu.
4. File hóa đơn vừa đọc được giữ trong **Hồ sơ tệp** của giao dịch khi lưu thành công.

Không có khóa AI vẫn đọc được lớp QR.

### Hồ sơ tệp

Mỗi giao dịch một thư mục. Tải lên: hóa đơn, chứng từ chuyển khoản, tờ trình đã ký (PDF), giấy đề nghị thanh toán đã ký (PDF).

### Giấy Word

Cần Docker. Xem [docs/ONLYOFFICE.md](docs/ONLYOFFICE.md). Không chạy OnlyOffice thì phần còn lại (nhật ký, hóa đơn, hồ sơ tệp) vẫn dùng được.

## Biến môi trường

Xem `.env.example`. Khóa AI không được in ra log hay trả về trình duyệt. Ưu tiên khóa lưu trong Cài đặt; nếu trống thì dùng biến `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …

## Tài liệu khác

- [docs/KE-HOACH.md](docs/KE-HOACH.md) — quyết định kiến trúc
- [docs/THIET-KE-DU-LIEU.md](docs/THIET-KE-DU-LIEU.md) — bảng và bộ tính số dư
- [docs/BAO-MAT-VA-PHAN-QUYEN.md](docs/BAO-MAT-VA-PHAN-QUYEN.md) — đăng nhập, vai trò, lưu file
- [docs/ONLYOFFICE.md](docs/ONLYOFFICE.md) — giấy Word
- [docs/VIETQR.md](docs/VIETQR.md) — QR chuyển khoản
