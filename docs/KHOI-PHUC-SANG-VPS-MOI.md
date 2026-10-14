# Khôi phục ứng dụng và dữ liệu sang VPS mới

> Dành cho trường hợp VPS cũ hỏng hoặc cần chuyển máy. Hướng dẫn này dùng cho bản triển khai Docker tại `hc.ttdt.site` trong kho mã này. **Không chạy các bước nhập dữ liệu trên VPS đang hoạt động.** Cần một VPS Linux mới, trống dành cho ứng dụng, quyền `root`/`sudo`, quyền quản lý DNS và quyền truy cập thư mục **Sao lưu Quản lý tạm ứng** trong Google Drive cá nhân.
>
> **Mốc khôi phục:** chỉ lấy được dữ liệu tới **thời điểm bản sao lưu thành công được chọn**, không tự lấy lại các giao dịch phát sinh sau đó. Gói Drive không chứa các khóa và cấu hình bí mật trên VPS. Ưu tiên dùng lại hai tên miền `hc.ttdt.site` và `office.ttdt.site` để tránh phải đổi cấu hình OAuth/ứng dụng.

## 1. Chuẩn bị trước sự cố (làm ngay khi VPS cũ còn hoạt động)

- Trong **Cài đặt → Sao lưu dữ liệu**, xác nhận có ít nhất một lần **Thành công**; mở Drive cá nhân, kiểm tra thấy tệp `tam-ung-YYYYMMDD-HHMMSS.tar.gz` trong thư mục do ứng dụng tạo. Chỉ dựa vào bản **Thành công**, không coi bản **Thất bại** là có thể khôi phục.
- Lưu **riêng, an toàn, ngoài VPS và ngoài GitHub**: `deploy/.env` trên VPS, `/etc/quan-ly-tam-ung/google-oauth-client.json`, thông tin đăng nhập Google/GitHub, mã nguồn phiên bản đang chạy (`git rev-parse HEAD`), và phương thức truy cập DNS. Tệp `client_secret_*.json` để ở máy cá nhân/thư mục dự án **không được Git theo dõi**, nên đừng trông chờ `git clone` lấy lại tệp này. Không gửi các khóa lên chat hoặc chép vào tài liệu này.
- Có thể không giữ được khóa cũ: **dữ liệu tài chính và tệp vẫn khôi phục được**, nhưng phải kết nối lại Google Drive; token bot Telegram lưu trong DB cũng có thể phải nhập lại. Ghi lại số lượng giao dịch/tệp và thử tải vài hóa đơn, giấy Word để đối chiếu sau này.
- Nếu VPS cũ còn chạy trong lúc chuyển máy, **ngừng nhập liệu và dừng ứng dụng cũ trước khi chuyển DNS**; tránh hai VPS cùng ghi dữ liệu. Nếu có người đang sửa Word, để họ lưu và đóng editor rồi tạo bản sao lưu mới.

## 2. Trên VPS mới: chuẩn bị và tải bản sao lưu

1. Cài Docker Engine **và Docker Compose plugin**, Git, Nginx và Certbot (`python3-certbot-nginx`) phù hợp bản Ubuntu/Debian của VPS. Cho phép cổng **80, 443**, giữ cổng PostgreSQL **5432** và app **3002** không công khai. Dành đủ dung lượng cho **tệp nén + dữ liệu giải nén + PostgreSQL + image Docker**. Kiểm tra:

   ```bash
   docker --version
   docker compose version
   df -h /
   ```

2. Trên VPS mới tạo thư mục nhận bản sao lưu trước:

   ```bash
   umask 077
   mkdir -p /root/khoi-phuc
   chmod 700 /root/khoi-phuc
   cd /root/khoi-phuc
   ```

3. Vào Google Drive cá nhân → **Drive của tôi → Sao lưu Quản lý tạm ứng**, tải **bản mới nhất có trạng thái Thành công** (đối chiếu tên/thời gian trong lịch sử Cài đặt nếu VPS cũ còn truy cập được). Dùng SFTP/WinSCP hoặc `scp` trên máy cá nhân chép tệp `.tar.gz` vào `/root/khoi-phuc/` của VPS mới. Có thể chép thêm `.env` và JSON OAuth từ nơi cất riêng; **không** tải khóa từ nguồn không tin cậy. Chọn chính xác một tệp và kiểm tra trước khi giải nén. Thay `YYYYMMDD-HHMMSS` bằng phần tên thực tế:

   ```bash
   ls -lh tam-ung-*.tar.gz
   ARCHIVE=/root/khoi-phuc/tam-ung-YYYYMMDD-HHMMSS.tar.gz
   test -s "$ARCHIVE" || { echo 'Không thấy gói sao lưu'; exit 1; }
   sha256sum "$ARCHIVE"
   tar -tzf "$ARCHIVE" >/dev/null
   tar -tzf "$ARCHIVE" | sed -n '1,30p'
   mkdir -p /root/khoi-phuc/du-lieu
   test -z "$(ls -A /root/khoi-phuc/du-lieu)" || { echo 'Thư mục giải nén không rỗng; dừng để kiểm tra'; exit 1; }
   tar -xzf "$ARCHIVE" --no-same-owner -C /root/khoi-phuc/du-lieu
   RESTORE_DIR=/root/khoi-phuc/du-lieu
   cat "$RESTORE_DIR/manifest.txt"
   test -s "$RESTORE_DIR/database.dump"
   test -d "$RESTORE_DIR/tep"
   docker run --rm --entrypoint pg_restore -v "$RESTORE_DIR:/restore:ro" postgres:16-alpine -l /restore/database.dump >/dev/null
   ```

   Phải thấy `database.dump`, `manifest.txt`, `tep/`; `manifest.txt` có `source=quan-ly-tam-ung`. Nếu `tar`/`pg_restore -l` lỗi, **dừng**, thử tải lại bản thành công khác. `sha256sum` chỉ so sánh được với mã băm đã ghi lại ở máy tải về (nếu có); tự nó không xác thực nguồn tệp. Chỉ giải nén archive tải từ Drive của chính bạn.

## 3. Lấy mã nguồn và cấu hình bí mật

```bash
mkdir -p /opt
# Nếu kho riêng tư, dùng cách xác thực GitHub của bạn; không ghi token vào lệnh.
git clone https://github.com/vanhiepdt/quan-ly-tam-ung.git /opt/quan-ly-tam-ung
cd /opt/quan-ly-tam-ung
git rev-parse HEAD
cd deploy
```

Dùng **đúng phiên bản đã chạy khi tạo backup** hoặc phiên bản mới hơn đã kiểm tra tương thích. Bản mã khi viết hướng dẫn này là `6b24f55`; **không mặc định** backup tương lai cũng dùng phiên bản đó. Nếu chưa rõ phiên bản, đối chiếu bản đã triển khai trước khi chạy migration; không ép phiên bản cũ lên DB mới hơn.

- Nếu có bản `deploy/.env` an toàn từ VPS cũ: đưa vào `/opt/quan-ly-tam-ung/deploy/.env`, giữ nguyên các khóa mã hóa. Nếu không có: `cp .env.example .env`, mở bằng `nano .env` và đặt mật khẩu PostgreSQL mới đủ mạnh, `GOOGLE_DRIVE_TOKEN_KEY`, `INTAKE_TOKEN_ENCRYPTION_KEY`, `ONLYOFFICE_JWT_SECRET`, URL Telegram; các khóa mới **không giải mã được** token cũ. Để `POSTGRES_DB=quan_ly_tam_ung`, `POSTGRES_USER=app_web` theo mẫu nếu không có lý do đổi. Mật khẩu DB dùng chuỗi chữ/số dài (tránh ký tự đặc biệt làm sai URL kết nối trong Compose). **Không cần chạy lệnh tạo admin**: người dùng/mật khẩu đăng nhập hiện có ở trong bản DB.

Tạo `.env` (nếu có bản cũ ở `/root/khoi-phuc/.env` thì giữ nguyên khóa; nếu không, tự điền mẫu bằng trình soạn thảo):

```bash
cd /opt/quan-ly-tam-ung/deploy
if [ -f /root/khoi-phuc/.env ]; then
  install -m 600 /root/khoi-phuc/.env .env
else
  cp .env.example .env
  chmod 600 .env
  nano .env
fi
```

- Đưa JSON OAuth **Web application** từ máy cá nhân/bản cất riêng vào `/root/khoi-phuc/google-oauth-client.json` rồi cài vào vị trí app đọc được. Nếu chưa có JSON, vẫn có thể khôi phục dữ liệu; tạo/copy JSON trước khi kết nối lại Drive. Không dùng file Service Account cũ.

```bash
cd /opt/quan-ly-tam-ung/deploy
chmod 600 .env
install -d -o 1000 -g 1000 -m 750 /etc/quan-ly-tam-ung
if [ -f /root/khoi-phuc/google-oauth-client.json ]; then
  install -o 1000 -g 1000 -m 600 /root/khoi-phuc/google-oauth-client.json /etc/quan-ly-tam-ung/google-oauth-client.json
fi
# Tạo mạng external do compose hiện tại yêu cầu, nếu chưa có:
docker network inspect quanlycongviec_default >/dev/null 2>&1 || docker network create quanlycongviec_default
# Chỉ xem tính hợp lệ, không in cấu hình có chứa mật khẩu:
docker compose config --quiet
```

Ứng dụng chạy với uid `1000` (`node`), nên JSON cần quyền như trên. `deploy/docker-compose.yml` hiện gắn app vào mạng external `quanlycongviec_default`; trên VPS trống **mạng đó không tự có**. Nếu chưa cài OnlyOffice, mạng vẫn có thể tạo trước và ứng dụng tài chính chạy bình thường; **trình soạn thảo Word chưa dùng được** cho đến bước 6.

## 4. Nhập PostgreSQL và toàn bộ tệp — **chỉ trên VPS đích mới**

**Điểm dừng an toàn:** trước các lệnh dưới đây, tự xác nhận đang SSH đúng **VPS mới**, đúng thư mục `/opt/quan-ly-tam-ung/deploy`, bản backup đúng ngày, và PostgreSQL đích **chưa chứa dữ liệu cần giữ**. Lệnh `pg_restore` **ghi dữ liệu vào DB đích**; không chạy lại trên DB có giao dịch. Không dùng `docker compose down -v`/xóa volume để “thử lại”, vì sẽ mất dữ liệu đích.

```bash
cd /opt/quan-ly-tam-ung/deploy
# Tạo container và các volume nhưng chưa chạy app (không cho worker ghi trước khi restore):
docker compose up --no-start --build
# Chỉ chạy DB rỗng:
docker compose up -d db
docker compose ps
# Phải xác nhận DB mới chưa có bảng ứng dụng:
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "\dt"'
```

Kết quả `\dt` phải là **Did not find any relations.** Nếu thấy bảng, **dừng và kiểm tra lại**; tuyệt đối không phục hồi chồng dữ liệu. Khi DB rỗng, nhập dump PostgreSQL 16 (một transaction; lỗi sẽ hủy transaction):

```bash
RESTORE_DIR=/root/khoi-phuc/du-lieu
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error --single-transaction' < "$RESTORE_DIR/database.dump"
```

Chép **nguyên cả** `tep/`, không chỉ PDF hóa đơn: trong đó còn giấy Word, mẫu đã sửa và các tệp khác. Volume cần để trống trước khi chép. Lệnh dưới đây chỉ mở container tạm, **không khởi động app**:

```bash
RESTORE_DIR=/root/khoi-phuc/du-lieu
docker compose run --rm --no-deps --user 0 -v "$RESTORE_DIR/tep:/nguon:ro" --entrypoint sh app -ec 'test -z "$(ls -A /var/lib/tam-ung/tep)" || { echo "Volume tep không rỗng; dừng để kiểm tra" >&2; exit 1; }; cp -a /nguon/. /var/lib/tam-ung/tep/; chown -R node:node /var/lib/tam-ung/tep'
```

Nếu đang chép mà bị ngắt, volume có thể chứa **một phần** tệp. Không cho app chạy, kiểm tra nguyên nhân, rồi chép lại từ archive vào **đúng volume đích đã xác minh**; không xóa dữ liệu bừa bãi. Mẫu `Mau/` gốc ở Git/image, mẫu sửa của người dùng nằm trong DB và `tep/`.

## 5. Kiểm tra DB/tệp, rồi mới chạy app

```bash
cd /opt/quan-ly-tam-ung/deploy
# Xem số bản ghi; đối chiếu số liệu/tệp đã ghi trước sự cố nếu có:
docker compose exec -T db sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "select (select count(*) from giao_dich) as giao_dich, (select count(*) from tep_dinh_kem) as tep_dinh_kem, (select count(*) from tai_lieu) as tai_lieu, (select count(*) from nguoi_dung) as nguoi_dung;"'
# Đếm số file trong archive và volume; hai số phải bằng nhau:
find /root/khoi-phuc/du-lieu/tep -type f | wc -l
docker compose run --rm --no-deps --entrypoint sh app -ec 'find /var/lib/tam-ung/tep -type f | wc -l'
# Migration chỉ chạy sau restore; cùng phiên bản thì migration đã chạy được bỏ qua.
docker compose run --rm --no-deps app node scripts/chay-migration.mjs
# Sau khi kiểm tra số liệu/migration mới mở ứng dụng:
docker compose up -d app
docker compose ps
curl -I http://127.0.0.1:3002/dang-nhap
```

Nếu migration báo khác checksum hoặc bản DB mới hơn mã nguồn: **dừng app**, tìm đúng phiên bản mã nguồn; không sửa migration cũ hay chạy tạo DB mới. **Không chạy `node scripts/tao-admin.mjs` sau khi restore**: script đó đặt lại mật khẩu admin trùng tên và thu hồi phiên. Chỉ dùng có chủ đích khi thật sự cần cấp lại tài khoản.

## 6. Chuyển tên miền, HTTPS và OnlyOffice

### Trường hợp khuyến nghị: giữ nguyên tên miền

1. Nếu VPS cũ còn chạy, dừng app cũ sau bản backup cuối, không để có giao dịch mới sau bản đó. Đổi DNS **A** của `hc.ttdt.site` sang IP mới; nếu chuyển cả Document Server, đổi thêm `office.ttdt.site`. Đợi DNS trỏ đúng mới chạy Certbot. Bản Nginx trong repo chỉ dùng cổng 80 ban đầu; Certbot tự cấp/chèn HTTPS.
2. Trên VPS mới:

   ```bash
   cp /opt/quan-ly-tam-ung/deploy/nginx/hc.ttdt.site.conf /etc/nginx/sites-available/hc.ttdt.site
   ln -s /etc/nginx/sites-available/hc.ttdt.site /etc/nginx/sites-enabled/hc.ttdt.site
   nginx -t && systemctl reload nginx
   certbot --nginx -d hc.ttdt.site --redirect
   ```

3. Truy cập `https://hc.ttdt.site/dang-nhap` và đăng nhập tài khoản **đã có từ bản backup**. Kiểm tra tổng quan, vài giao dịch đầu/cuối, số dư, tệp hóa đơn và giấy đã lưu. Không nhập dữ liệu mới khi kiểm tra chưa đạt. Khi bản backup đã có sẵn lịch chạy, worker có thể chạy lại theo lịch sau khi app mở; kiểm tra lịch sử và Drive sau khi khôi phục kết nối.

### Nếu VPS mới chưa có OnlyOffice

Ứng dụng không tạo Document Server. Nếu chỉ cần tra cứu dữ liệu/tải tệp, có thể **hoãn** phần này. Để dùng nút soạn/sửa Word trên VPS mới, cần một Document Server truy cập được qua `https://office.ttdt.site`, cùng mạng Docker với app, alias `onlyoffice`, dùng **cùng** `ONLYOFFICE_JWT_SECRET` trong `.env`. Nếu VPS mới đã có OnlyOffice phù hợp, chỉ kết nối nó vào `quanlycongviec_default` với alias `onlyoffice`, không dựng thêm hoặc đổi JWT khi có người dùng khác. Nếu Document Server ở **máy khác**, phải sửa `ONLYOFFICE_INTERNAL_URL` trong Compose thành URL mà app mới gọi tới được và đảm bảo server đó gọi callback của app mới được; không được giả định `http://onlyoffice` tự thông sang máy khác.

Với VPS trống, có thể tạo `/opt/quan-ly-tam-ung/deploy/onlyoffice-vps.yml` với nội dung dưới đây (không chép giá trị JWT vào YAML):

```yaml
services:
  onlyoffice:
    image: onlyoffice/documentserver:9.4
    container_name: qlcv-onlyoffice
    restart: unless-stopped
    ports:
      - '127.0.0.1:8081:80'
    environment:
      JWT_ENABLED: 'true'
      JWT_SECRET: ${ONLYOFFICE_JWT_SECRET:?thieu JWT}
      JWT_HEADER: Authorization
      JWT_IN_BODY: 'true'
      ALLOW_PRIVATE_IP_ADDRESS: 'true'
    volumes:
      - onlyoffice_data:/var/www/onlyoffice/Data
      - onlyoffice_logs:/var/log/onlyoffice
      - onlyoffice_lib:/var/lib/onlyoffice
    networks:
      quanlycongviec_default:
        aliases: [onlyoffice]
volumes:
  onlyoffice_data:
  onlyoffice_logs:
  onlyoffice_lib:
networks:
  quanlycongviec_default:
    external: true
```

```bash
cd /opt/quan-ly-tam-ung/deploy
docker compose --env-file .env -f onlyoffice-vps.yml up -d
docker exec qlcv-onlyoffice curl -fsS http://127.0.0.1/healthcheck
```

Tạo site Nginx cho `office.ttdt.site` trỏ về `127.0.0.1:8081` (cần WebSocket). Ví dụ tệp `/etc/nginx/sites-available/office.ttdt.site`:

```nginx
server {
    listen 80;
    server_name office.ttdt.site;
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/office.ttdt.site /etc/nginx/sites-enabled/office.ttdt.site
nginx -t && systemctl reload nginx
certbot --nginx -d office.ttdt.site --redirect
```

Sau đó mở một giấy đã lưu trong ứng dụng, thử **Mở trình soạn thảo → sửa thử (trên bản kiểm thử) → Lưu/đóng → tải lại**. Healthcheck một mình không chứng minh callback/lưu Word hoạt động. Tài liệu Word đã lưu ở DB + `tep/`, không phải ở volume cache OnlyOffice cũ; bản sửa **chưa kịp lưu** khi VPS cũ hỏng có thể không khôi phục được.

### Nếu buộc phải đổi tên miền

Đây không chỉ là sửa DNS. Trước khi kết nối lại dịch vụ: sửa `server_name`/chứng chỉ Nginx, ba URL OnlyOffice trong `deploy/docker-compose.yml` (`ONLYOFFICE_PUBLIC_URL`, `ONLYOFFICE_INTERNAL_URL`, `ONLYOFFICE_APP_URL` phù hợp mạng thực tế), `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` trong Compose, và `TELEGRAM_WEBHOOK_URL`/`INTAKE_PUBLIC_URL` trong `deploy/.env`. Với Google Cloud, thêm **Authorized redirect URI** mới đúng từng ký tự, tải lại JSON OAuth Web client có `redirect_uris` chứa URI mới rồi đặt vào `/etc/quan-ly-tam-ung/google-oauth-client.json`. Khởi động lại app sau khi sửa và đặt lại Telegram webhook trong Cài đặt. Không chỉ sửa `.env`: Compose hiện **ghi đè** các URL Google/OnlyOffice bằng giá trị cố định. Nên nhờ người có kinh nghiệm kiểm tra toàn bộ editor + OAuth nếu thay cả domain.

## 7. Kết nối lại sao lưu và nghiệm thu

- Trên trang **Cài đặt → Sao lưu dữ liệu**, bấm **Kiểm tra kết nối**. Nếu giữ nguyên `GOOGLE_DRIVE_TOKEN_KEY`, JSON OAuth cũ và quyền Google còn hiệu lực, kết nối từ DB có thể dùng lại. Nếu mất khóa/file, token bị thu hồi hoặc đổi OAuth client: **Ngắt kết nối → Kết nối Google Drive**, chọn đúng tài khoản Drive của bạn, **Kiểm tra kết nối** rồi **Backup ngay**. Việc kết nối lại có thể tạo thư mục Drive mới; nhớ lưu cả bản cũ. Chỉ kết luận đã xong khi lịch sử báo **Thành công** và tệp mới thực sự có trong Drive. Lịch/giờ (mặc định `17:00 Asia/Ho_Chi_Minh`) lưu trong DB; không đặt cron sao lưu trùng.
- Nếu bật Telegram/agent quét hóa đơn, kiểm tra token, webhook HTTPS, địa chỉ agent và thử một luồng nhập mẫu. Giữ `INTAKE_TOKEN_ENCRYPTION_KEY` cũ nếu muốn đọc token bot đã mã hóa; mất khóa thì nhập token bot lại. Nếu đổi domain, các agent bên ngoài cũng phải trỏ đến địa chỉ mới.
- Đối chiếu ít nhất: số giao dịch/người dùng, số dư quan trọng, hóa đơn đính kèm, giấy Word, đăng nhập và phân quyền; sau cùng thử một lần sao lưu và một lượt **khôi phục thử trên môi trường cô lập**. Không xóa archive gốc khỏi Drive. Giữ thư mục `/root/khoi-phuc` kín quyền truy cập, dọn bản chép tạm sau khi đã xác nhận đủ và có phương án giữ bản an toàn khác.

## Giới hạn và xử lý lỗi

- Gói `tam-ung-*.tar.gz` gồm **dump PostgreSQL 16 + toàn bộ `tep/`**, không gồm `.env`, JSON OAuth, chứng chỉ TLS, DNS, cache OnlyOffice hay tệp không nằm trong volume ứng dụng. Cổng DB không được mở ra Internet. Không dùng file Excel xuất báo cáo để thay thế dump khi cần khôi phục đầy đủ.
- Nếu `pg_restore` lỗi: giữ nguyên archive, **không chuyển DNS**; kiểm tra đúng PostgreSQL 16, DB rỗng, đúng dump và phiên bản mã nguồn. Nếu tệp thiếu: giữ app dừng, so sánh `tep/` trong archive với volume. Nếu Google lỗi: vẫn có thể xem dữ liệu đã khôi phục, nhưng phải khắc phục kết nối trước khi dựa vào lịch backup mới.
- Quy trình lệnh này được viết theo cấu hình mã nguồn tại thời điểm tạo tài liệu; **chưa được xác nhận bằng một lần khôi phục thực tế từ bản Drive lên VPS mới**. Hãy diễn tập trên VPS/DB riêng trước khi cần xử lý sự cố thật.
