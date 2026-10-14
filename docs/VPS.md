# Triển khai VPS — hc.ttdt.site

Ứng dụng chạy Docker trên cùng máy với `ttdt.site` / `kiemtra.ttdt.site` / `office.ttdt.site`.

- nginx trên host, chứng chỉ Let's Encrypt (`certbot --nginx`).
- App bind **127.0.0.1:3002** (3000 = qlcv-app, 3001 = exam-checker).
- PostgreSQL riêng trong compose, **không** publish port.
- File hóa đơn: volume Docker `/var/lib/tam-ung/tep`.

## OnlyOffice — dùng sẵn, không dựng thêm

Document Server đã chạy: container `qlcv-onlyoffice`, nginx `office.ttdt.site`.

App này **không** `docker compose` OnlyOffice, **không** restart container đó, **không** đổi `ONLYOFFICE_JWT_SECRET` / JWT header / nginx của office.

Cách nối:

| Ai | URL |
|---|---|
| Trình duyệt (script editor) | `https://office.ttdt.site` |
| App tải bản sửa từ DS | `http://onlyoffice` (alias Docker trên mạng `quanlycongviec_default`) |
| DS gọi callback / tải file | `http://quan-ly-tam-ung-app:3000` (cùng mạng, không hairpin ra Internet) |

App chỉ **join** mạng Docker sẵn có. Không recreate / restart `qlcv-onlyoffice`.

Khóa phiên giấy có tiền tố `hc-` để không trùng khóa tài liệu của ứng dụng kia trên cùng Document Server. Callback JWT đọc cả `Authorization: Bearer` (cách DS trên VPS gửi) lẫn token trong body (dev).

Nếu OnlyOffice đang mở giấy của ttdt.site thì vẫn mở bình thường: app này chỉ gửi document key / callback URL của mình.

## Cài lần đầu (trên VPS)

```bash
# mã nguồn tại /opt/quan-ly-tam-ung
cd /opt/quan-ly-tam-ung/deploy
cp .env.example .env
# Điền POSTGRES_PASSWORD, ADMIN_*, ONLYOFFICE_JWT_SECRET
# JWT: copy giá trị từ /opt/qlcv/deploy/.env — không sửa file kia, không restart OnlyOffice.
chmod 600 .env
docker compose up -d --build
docker compose run --rm app node scripts/chay-migration.mjs
docker compose run --rm app node scripts/tao-admin.mjs

# nginx + HTTPS (chứng chỉ riêng, không đụng cert ttdt/kiemtra/office)
cp /opt/quan-ly-tam-ung/deploy/nginx/hc.ttdt.site.conf /etc/nginx/sites-available/hc.ttdt.site
ln -s /etc/nginx/sites-available/hc.ttdt.site /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d hc.ttdt.site --non-interactive --agree-tos --redirect
```

Đăng nhập: `https://hc.ttdt.site/dang-nhap`.

Không commit `.env`. Không in khóa JWT / mật khẩu.


## Backup Google Drive

Xem [SAO-LUU-GOOGLE-DRIVE.md](SAO-LUU-GOOGLE-DRIVE.md) để cấu hình OAuth Google Drive cá nhân và đặt lịch backup trong **Cài đặt → Sao lưu dữ liệu**. Không lưu khóa JSON trong repo.

## Chuyển hoặc khôi phục sang VPS khác

Xem **[hướng dẫn khôi phục sang VPS mới](KHOI-PHUC-SANG-VPS-MOI.md)**. Không chạy các bước cài mới/tạo admin ở trên lên DB đã nhập từ bản sao lưu.

## Phụ lục thanh toán trong OnlyOffice

- Chạy migration `026_loai_tai_lieu_phu_luc.sql` trước khi thay app. Migration chỉ thêm loại tài liệu `phu_luc`, không cập nhật số tiền hay dữ liệu giao dịch cũ.
- Phụ lục mở ngay trong **Thông tin giấy đề nghị** (bản xem trước khi chưa lưu; bản có thể sửa khi đã lưu) và trong trang **Giấy**.
- Phụ lục lưu riêng với giấy thanh toán, dùng lại callback/lịch sử phiên bản hiện có. Tải Word trả đúng bản đã lưu trong OnlyOffice.
- Lưu lại thông tin giấy hoặc sửa trường liên quan của giao dịch làm mới phụ lục đang có. Nếu phụ lục đang mở, phải đóng editor trước khi lưu thay đổi.
- Các biến ngày, mã/số hóa đơn, người đề nghị và số tiền dùng đúng dữ liệu của giấy thanh toán. `[[benban]]` lấy từ snapshot tên bên bán trên hóa đơn; thiếu thì để trống.
- Không thay luồng đọc hai AI, phân bổ buffet hay cách làm tròn; không tự áp dụng cho giao dịch cũ thiếu snapshot.
