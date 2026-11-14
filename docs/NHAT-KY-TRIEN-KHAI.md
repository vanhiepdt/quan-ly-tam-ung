# Nhật ký triển khai VPS — hc.ttdt.site

Mỗi lần thay ứng dụng trên VPS ghi một mục ở đây, kèm đủ thứ cần để quay về bản cũ.

Trên VPS **không có** bản sao Git: `/opt/quan-ly-tam-ung` là mã nguồn được chép sang.
Quy trình đang dùng: clone đúng tag từ GitHub vào `/root/deploy-src`, rồi `rsync -a --delete`
sang `/opt/quan-ly-tam-ung` (giữ lại `deploy/.env` và `releases/`), build image, chạy
migration, rồi `docker compose up -d app`.

## 2026-11-15 — Hội nghị (gộp giao dịch con, phí theo % hoặc số tiền)

| | |
|---|---|
| Tag | `v2026.11.15-hoi-nghi` |
| Commit mới | `4e66318` |
| **Commit cũ (đích rollback)** | **`728b631`** |
| Image mới | `quan-ly-tam-ung:latest` |
| **Image cũ (đích rollback)** | **`quan-ly-tam-ung:rollback-20261114T180223Z`** |
| Mã nguồn cũ | `/root/rollback-src-20261114T180223Z.tar.gz` và `/opt/quan-ly-tam-ung/releases/pre-728b631-20261114T180223Z/source.tar.gz` |
| Sao lưu CSDL trước khi đổi | `/root/rollback-db-20261114T180223Z.sql.gz` (171K, 19 bảng, 80 giao dịch) |
| Migration | `029_hoi_nghi.sql` |

Kiểm tra sau khi lên: `/dang-nhap` trả 200, `/giao-dich` và `/giao-dich/theo-doi` trả 307
(chuyển hướng đăng nhập, đúng như mong đợi), log không có lỗi, hai bảng `hoi_nghi` và
`tep_hoi_nghi` đã có, số giao dịch vẫn là 80 như trước khi chạy migration.

### Quay về bản cũ

Migration 029 chỉ **thêm** bảng `hoi_nghi`, `tep_hoi_nghi` và cột `giao_dich.hoi_nghi_id`;
nó không sửa và không xóa dữ liệu cũ. Mã nguồn cũ không đọc tới những thứ này, nên
**chỉ cần quay mã nguồn, không phải phục hồi cơ sở dữ liệu.**

Cách nhanh nhất — đổi lại image đã giữ sẵn, không phải build lại:

```bash
cd /opt/quan-ly-tam-ung
docker tag quan-ly-tam-ung:rollback-20261114T180223Z quan-ly-tam-ung:latest
docker compose -f deploy/docker-compose.yml up -d app
docker compose -f deploy/docker-compose.yml ps
```

Nếu cần cả mã nguồn trên đĩa khớp với bản cũ (để build lại về sau):

```bash
cd /opt
tar -xzf /root/rollback-src-20261114T180223Z.tar.gz   # bung đè lên quan-ly-tam-ung/
# deploy/.env không nằm trong gói, giữ nguyên bản đang có trên máy
```

Chỉ phục hồi cơ sở dữ liệu khi dữ liệu thật sự hỏng, vì thao tác này **xóa toàn bộ dữ
liệu phát sinh sau thời điểm sao lưu**. Hỏi người dùng trước khi chạy:

```bash
PGU=$(sed -n 's/^POSTGRES_USER=//p' deploy/.env | head -1)
PGD=$(sed -n 's/^POSTGRES_DB=//p' deploy/.env | head -1)
PGP=$(sed -n 's/^POSTGRES_PASSWORD=//p' deploy/.env | head -1)
zcat /root/rollback-db-20261114T180223Z.sql.gz \
  | docker exec -i -e PGPASSWORD="$PGP" quan-ly-tam-ung-db psql -U "$PGU" -d "$PGD"
```

### Dọn dẹp định kỳ

Máy này gánh bốn ứng dụng (`quan-ly-tam-ung`, `qlcv` + OnlyOffice, `exam-checker`), nên
phần lớn đĩa không phải của ứng dụng này: image OnlyOffice 4.86G và dữ liệu exam-checker
4.1G đều không đụng được. Dữ liệu thật của ứng dụng này rất nhỏ — volume 512M gồm cả
CSDL lẫn tệp hóa đơn.

Image nằm ở `/var/lib/containerd` (Docker dùng containerd snapshotter), **không** phải
`/var/lib/docker`. Xem bằng `docker system df -v`, cột `UNIQUE SIZE` mới là phần thu lại
được khi xóa một image.

Hai thứ phình âm thầm sau mỗi lần triển khai:

- **Build cache** — có lần lên tới 20G và suýt làm hết đĩa. Chạy `docker builder prune -af`
  sau mỗi lần build xong.
- **Image `rollback-*`** — mỗi lần deploy đẻ thêm một bản ~720MB. Giữ lại **ít nhất bản
  rollback của lần triển khai gần nhất**, xóa các bản cũ hơn bằng
  `docker rmi quan-ly-tam-ung:<tag>`.

Ngày 15/11/2026 đã dọn: xóa 12 image rollback từ 22/09 đến 14/10, xóa build cache, và
giới hạn journald bằng `/etc/systemd/journald.conf.d/99-gioi-han.conf`
(`SystemMaxUse=200M`, `SystemKeepFree=2G`) vì log trước đó không có trần và đã đạt 661M.
Kết quả: đĩa từ 28G xuống 21G đã dùng (còn trống 27G, 44%), số image từ 18 còn 6, cả sáu
container vẫn chạy bình thường.
