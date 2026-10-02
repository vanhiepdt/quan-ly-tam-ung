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

Xem [SAO-LUU-GOOGLE-DRIVE.md](SAO-LUU-GOOGLE-DRIVE.md) để cấu hình Service Account và cron 17:00 theo múi giờ Asia/Bangkok. Không lưu khóa JSON trong repo.
