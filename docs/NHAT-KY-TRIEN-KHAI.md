# Nhật ký triển khai VPS — hc.ttdt.site

Mỗi lần thay ứng dụng trên VPS ghi một mục ở đây, kèm đủ thứ cần để quay về bản cũ.

Trên VPS **không có** bản sao Git: `/opt/quan-ly-tam-ung` là mã nguồn được chép sang.
Quy trình đang dùng: clone đúng tag từ GitHub vào `/root/deploy-src`, rồi `rsync -a --delete`
sang `/opt/quan-ly-tam-ung` (giữ lại `deploy/.env` và `releases/`), build image, chạy
migration, rồi `docker compose up -d app`.

## 2026-11-26 (lần 3) — Sửa xuất Excel khi có Hội nghị

| | |
|---|---|
| Tag | `v2026.11.26-excel-hoi-nghi` |
| Commit mới | `0d41751` |
| **Commit cũ (đích rollback)** | **`9612b8e`** (tag `v2026.11.26-xoa-hoi-nghi`; commit `de54cb4` sau đó chỉ sửa tài liệu) |
| Image mới | `quan-ly-tam-ung:latest` (`b328e0381e1a`) |
| **Image cũ (đích rollback)** | **`quan-ly-tam-ung:rollback-20261126T165524Z`** (`50101e6a862b`) |
| Mã nguồn cũ | `/root/rollback-src-20261126T165524Z.tar.gz` |
| Sao lưu CSDL trước khi đổi | `/root/rollback-db-20261126T165524Z.sql.gz` (179K; 90 dòng giao dịch gồm 67 chưa xóa; 1 Hội nghị) |
| Migration | Không có migration mới |

Lỗi: nút Xuất Excel báo "Không thể xuất Excel" mỗi khi nhật ký có dòng Hội nghị. Dòng gộp
Hội nghị có mã `hoi-nghi:<uuid>` nhưng API `/api/giao-dich/xuat-excel` chỉ nhận UUID nên trả 400
cho cả lần xuất. Bản sửa nhận cả hai loại mã. Mỗi Hội nghị ra một dòng trên sheet nhật ký,
link sang sheet riêng chứa giao dịch con, hàng tổng và chứng từ Hội nghị. Sheet Hội nghị có
link quay lại dòng gốc.

Kiểm tra sau khi lên: `/dang-nhap` trả 200 (cả nội bộ lẫn `https://hc.ttdt.site`), `/giao-dich`
trả 307, API xuất Excel trả 401 khi chưa đăng nhập, log không có lỗi. Đĩa 22G/50G (48%).

### Quay về bản cũ

Không đổi cấu trúc CSDL, nên chỉ cần đổi lại image:

```bash
cd /opt/quan-ly-tam-ung
docker tag quan-ly-tam-ung:rollback-20261126T165524Z quan-ly-tam-ung:latest
docker compose -f deploy/docker-compose.yml up -d app
```

## 2026-11-26 (lần 2) — Hội nghị: thêm chức năng xóa

| | |
|---|---|
| Tag | `v2026.11.26-xoa-hoi-nghi` |
| Commit mới | `9612b8e` |
| **Commit cũ (đích rollback)** | **`0017a53`** (tag `v2026.11.26-hoi-nghi-loai-con`; commit `208328c` sau đó chỉ sửa tài liệu) |
| Image mới | `quan-ly-tam-ung:latest` (`50101e6a862b`) |
| **Image cũ (đích rollback)** | **`quan-ly-tam-ung:rollback-20261126T154241Z`** (`46ad73c3d8a5`) |
| Mã nguồn cũ | `/root/rollback-src-20261126T154241Z.tar.gz` |
| Sao lưu CSDL trước khi đổi | `/root/rollback-db-20261126T154241Z.sql.gz` (177K; 84 dòng giao dịch gồm 62 chưa xóa và 22 đã xóa mềm; 1 Hội nghị) |
| Migration | Không có migration mới |

Kiểm tra sau khi lên: `/dang-nhap` trả 200 (cả nội bộ lẫn `https://hc.ttdt.site`),
`/giao-dich` và `/giao-dich/theo-doi` trả 307 (chuyển hướng đăng nhập), log không có lỗi,
vẫn 84 dòng giao dịch (62 chưa xóa) và 1 Hội nghị chưa xóa. Đã chạy `docker builder prune -af`
(thu lại 2.5G); đĩa 22G/50G (47%).

Ghi chú: số "84 giao dịch" ở mục trước là tổng số dòng, gồm cả dòng đã xóa mềm.

### Quay về bản cũ

Lần này không đổi cấu trúc cơ sở dữ liệu, nên **chỉ cần đổi lại image**:

```bash
cd /opt/quan-ly-tam-ung
docker tag quan-ly-tam-ung:rollback-20261126T154241Z quan-ly-tam-ung:latest
docker compose -f deploy/docker-compose.yml up -d app
docker compose -f deploy/docker-compose.yml ps
```

Mã nguồn cũ trên đĩa: `cd /opt && tar -xzf /root/rollback-src-20261126T154241Z.tar.gz`.

Hội nghị nào đã xóa bằng bản mới thì sau khi quay về vẫn ở trạng thái đã xóa (bản cũ cũng
ẩn Hội nghị và giao dịch có `da_xoa`). Muốn lấy lại phải sửa thẳng trong CSDL hoặc phục hồi
từ bản sao lưu.

## 2026-11-26 — Hội nghị: chọn loại cho từng giao dịch con

| | |
|---|---|
| Tag | `v2026.11.26-hoi-nghi-loai-con` |
| Commit mới | `0017a53` |
| **Commit cũ (đích rollback)** | **`4e66318`** (tag `v2026.11.15-hoi-nghi`; hai commit sau đó chỉ sửa tài liệu) |
| Image mới | `quan-ly-tam-ung:latest` (`46ad73c3d8a5`) |
| **Image cũ (đích rollback)** | **`quan-ly-tam-ung:rollback-20261126T142529Z`** (`24607283d36e`) |
| Mã nguồn cũ | `/root/rollback-src-20261126T142529Z.tar.gz` |
| Sao lưu CSDL trước khi đổi | `/root/rollback-db-20261126T142529Z.sql.gz` (177K, 84 giao dịch, 1 Hội nghị) |
| Migration | Không có migration mới (029 đã chạy từ lần trước) |

Kiểm tra sau khi lên: `/dang-nhap` trả 200 (cả nội bộ lẫn `https://hc.ttdt.site`),
`/giao-dich` và `/giao-dich/theo-doi` trả 307 (chuyển hướng đăng nhập), log không có lỗi,
số giao dịch vẫn 84 và số Hội nghị vẫn 1. Đã chạy `docker builder prune -af` (thu lại
2.7G); đĩa 22G/50G (46%).

### Quay về bản cũ

Lần này không đổi cơ sở dữ liệu, nên **chỉ cần đổi lại image**:

```bash
cd /opt/quan-ly-tam-ung
docker tag quan-ly-tam-ung:rollback-20261126T142529Z quan-ly-tam-ung:latest
docker compose -f deploy/docker-compose.yml up -d app
docker compose -f deploy/docker-compose.yml ps
```

Mã nguồn cũ trên đĩa: `cd /opt && tar -xzf /root/rollback-src-20261126T142529Z.tar.gz`.

Sau khi quay về, các giao dịch con đã lưu với loại khác loại mặc định của Hội nghị vẫn
nằm nguyên trong CSDL. Bản cũ vẫn cộng đúng tiền từng cột, chỉ hiện hình thức của giao
dịch con cuối cùng trên dòng gộp, và không cho thêm giao dịch con khác loại mặc định.

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
