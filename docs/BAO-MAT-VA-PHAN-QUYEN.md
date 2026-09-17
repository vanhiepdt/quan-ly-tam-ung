# Bảo mật và phân quyền

Đọc [KE-HOACH.md](KE-HOACH.md) trước. Hệ thống chạy toàn bộ trên Linux VPS: Next.js, PostgreSQL và file hóa đơn. Không dùng Supabase.

---

## 1. Ba lớp bảo vệ

| Lớp | Chặn ở đâu | Chặn cái gì |
|---|---|---|
| Middleware + layout | Trước khi vào màn hình nội bộ | Người chưa đăng nhập |
| Server Action / Route Handler | Trước khi đọc hoặc ghi | Người không đủ vai trò, dữ liệu gửi từ client |
| PostgreSQL + hệ điều hành | Database và filesystem | Dữ liệu không hợp lệ, sửa không có audit, truy cập trực tiếp từ mạng |

Không lớp nào thay thế lớp khác. Giấu nút trên giao diện không phải phân quyền: người chỉ đọc vẫn có thể gọi Server Action trực tiếp, nên action bắt buộc phải tự kiểm tra vai trò.

PostgreSQL chỉ lắng nghe `localhost` hoặc private network. Không mở cổng 5432 ra Internet. Role `app_web` không được là superuser, không được `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, cũng không được đăng nhập từ máy ngoài VPS.

## 2. Đăng nhập do ứng dụng quản lý

Chỉ admin tạo tài khoản; không có trang tự đăng ký. Mật khẩu tạm được gửi qua kênh riêng và bắt buộc đổi trong lần đăng nhập đầu.

- Băm mật khẩu bằng **Argon2id**; không lưu hay log mật khẩu thô.
- Session là token ngẫu nhiên 32 byte; database chỉ lưu SHA-256 của token.
- Cookie session: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- Session hết hạn sau 7 ngày; logout xóa bản ghi session, nên token bị thu hồi ngay.
- Khi `dang_hoat_dong = false`, mọi session của tài khoản đó không còn hợp lệ ở request kế tiếp.
- Route đăng nhập giới hạn số lần thử sai theo cả IP và email.

### Bảng `phien`

```sql
create table phien (
  id             uuid primary key default gen_random_uuid(),
  nguoi_dung_id  uuid not null references nguoi_dung(id) on delete cascade,
  token_hash     text not null unique,
  het_luc        timestamptz not null,
  tao_luc        timestamptz not null default now(),
  dung_luc       timestamptz not null default now(),
  ip_hash        text
);

create index phien_con_han on phien (nguoi_dung_id, het_luc);
```

### Đọc session ở server

```ts
// lib/xac-thuc/phien.ts
import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db/pool'

const bam = (token: string) => createHash('sha256').update(token).digest('hex')

export async function taoPhien(nguoiDungId: string) {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `insert into phien (nguoi_dung_id, token_hash, het_luc)
     values ($1, $2, now() + interval '7 days')`,
    [nguoiDungId, bam(token)],
  )
  ;(await cookies()).set('phien', token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  })
}

export async function layPhien() {
  const token = (await cookies()).get('phien')?.value
  if (!token) return null
  const { rows } = await db.query(
    `select nd.id, nd.vai_tro, nd.ho_ten
       from phien p join nguoi_dung nd on nd.id = p.nguoi_dung_id
      where p.token_hash = $1 and p.het_luc > now() and nd.dang_hoat_dong`,
    [bam(token)],
  )
  return rows[0] ?? null
}
```

Middleware chỉ chuyển hướng nhanh khi cookie không tồn tại. Kiểm tra session thật phải diễn ra lại trong layout, mỗi Server Action và route file; middleware không được xem là lớp xác thực cuối cùng.

## 3. Ba vai trò

| Việc | admin | nhap_lieu | chi_doc |
|---|---:|---:|---:|
| Xem bảng điều khiển và tất cả số tiền | ✓ | ✓ | ✓ |
| Xem giao dịch, file hóa đơn, ảnh chuyển khoản, QR | ✓ | ✓ | ✓ |
| Xuất Excel | ✓ | ✓ | ✓ |
| Thêm, sửa, xóa mềm giao dịch; tải file | ✓ | ✓ | ✗ |
| Quản lý người lấy HĐ, phí, tài khoản ngân hàng | ✓ | ✗ | ✗ |
| Quản lý danh mục, cấu hình, người dùng | ✓ | ✗ | ✗ |
| Xem lịch sử thay đổi; khôi phục xóa mềm | ✓ | ✗ | ✗ |

Vai trò `chi_doc` được xem số tiền theo quyết định đã chốt; khác biệt duy nhất với `nhap_lieu` là quyền ghi.

## 4. Quyền database và lưu vết

Mọi Server Action gọi `batBuocVaiTro()` trước khi parse dữ liệu hoặc tạo truy vấn SQL. Truy vấn luôn tham số hóa (`$1`, `$2`), tuyệt đối không nối dữ liệu người dùng vào chuỗi SQL.

```ts
// lib/xac-thuc/bao-ve.ts
export async function batBuocVaiTro(...cho: VaiTro[]) {
  const phien = await layPhien()
  if (!phien || !cho.includes(phien.vai_tro)) {
    throw new LoiKhongDuQuyen('Không đủ quyền')
  }
  return phien
}
```

### Đặt người thao tác cho trigger audit

Kết nối được pool tái sử dụng nên **không** dùng `SET app.user_id` thường. Mỗi thao tác ghi mở transaction, dùng `SET LOCAL` (hoặc `set_config(..., true)`) rồi commit/rollback, để ID không rò sang request kế tiếp.

```ts
await client.query('begin')
try {
  await client.query(`select set_config('app.user_id', $1, true)`, [phien.id])
  // insert / update / xóa mềm ở đây
  await client.query('commit')
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  client.release()
}
```

Trigger đọc ID này và tự ghi lịch sử. Role `app_web` không được `ALTER TABLE`, `DISABLE TRIGGER`, `TRUNCATE`, hoặc ghi trực tiếp vào `lich_su`.

```sql
create or replace function ghi_lich_su()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lich_su (bang, ban_ghi_id, hanh_dong, nguoi_thuc_hien, gia_tri_cu, gia_tri_moi)
  values (tg_table_name, coalesce(new.id, old.id), tg_op,
          nullif(current_setting('app.user_id', true), '')::uuid,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
```

`lich_su` chỉ admin xem được qua ứng dụng; không có chức năng sửa hoặc xóa lịch sử. Thao tác bảo trì bằng SQL trực tiếp phải dùng role quản trị riêng, đặt ID tài khoản hệ thống và được ghi trong nhật ký vận hành.

### Optimistic locking

Sửa giao dịch phải so `sua_luc` người dùng đã đọc với giá trị hiện tại:

```sql
update giao_dich
   set noi_dung = $1, sua_luc = now(), nguoi_sua = $2
 where id = $3 and sua_luc = $4 and not da_xoa
returning id;
```

Không trả về dòng nào nghĩa là có người vừa sửa hoặc xóa dòng đó: báo người dùng tải lại, không ghi đè im lặng.

## 5. File hóa đơn và ảnh chuyển khoản

File nằm tại `/var/lib/tam-ung/tep`, **ngoài web root**, thuộc user Linux chạy ứng dụng và không có web server nào phục vụ trực tiếp thư mục đó.

- Chỉ lưu đường dẫn tương đối trong `tep_dinh_kem`, dùng UUID làm tên vật lý.
- Không dùng tên file gốc làm đường dẫn; giữ `ten_goc` chỉ để hiển thị.
- Khi ghép đường dẫn, dùng `path.resolve()` rồi xác nhận đường dẫn kết quả vẫn bắt đầu bằng thư mục gốc; chặn `../` và symlink bất thường.
- Chỉ nhận PDF, XML, JPEG, PNG, WebP; tối đa 10 MB/file.
- Kiểm tra magic bytes ở server; phần mở rộng không phải bằng chứng.
- Tệp chỉ được xem qua `app/api/tep/[id]/route.ts`: route kiểm tra session, quyền xem và stream byte; không trả đường dẫn filesystem.
- Xóa file vật lý và bản ghi database trong cùng quy trình có khả năng phục hồi khi lỗi; trigger vẫn ghi audit cho bản ghi database.

Ảnh có thể nén trước ở trình duyệt (cạnh dài nhất 2000 px, JPEG 0.82) để tiết kiệm ổ đĩa, nhưng phải cân nhắc giữ bản gốc nếu OCR sau này cần độ nét cao. Cả database và `/var/lib/tam-ung/tep` đều nằm trong backup hằng ngày.

XML hóa đơn sau này phải được parse với external entity tắt để tránh XXE; chi tiết ở [LO-TRINH-KIEM-TRA-HOA-DON.md](LO-TRINH-KIEM-TRA-HOA-DON.md).

## 6. QR chuyển tiền

Sinh payload VietQR trong server, dùng số tài khoản đã cấu hình của người lấy HĐ. Không gửi tài khoản, số tiền hoặc nội dung chuyển khoản sang dịch vụ QR bên thứ ba.

- Tiền QR lấy từ phí lấy HĐ đã tính, đơn vị đồng.
- Nội dung chuyển khoản bỏ dấu, tối đa 25 ký tự.
- Hiển thị rõ tên chủ tài khoản, tài khoản và số tiền để người chuyển đối chiếu.
- Bắt buộc quét thử bằng ứng dụng ngân hàng thật với số tiền nhỏ trước khi cho dùng chính thức.

## 7. Cấu hình VPS tối thiểu

- Caddy hoặc nginx đứng trước Node, chỉ mở 80/443 và SSH; HTTPS tự gia hạn.
- Node chạy bằng systemd, không chạy bằng tài khoản root.
- Postgres không public; dùng mật khẩu dài riêng trong file môi trường chỉ user app đọc được (`chmod 600`).
- Bật cập nhật bảo mật tự động của hệ điều hành.
- Backup mỗi đêm: `pg_dump` database + `rsync`/`restic` thư mục file ra máy khác; mã hóa backup nếu nơi lưu không đáng tin.
- Cảnh báo khi ổ đĩa vượt 80%, backup thất bại, service Node/Postgres dừng.
- Mỗi tháng thử khôi phục một backup vào database tạm. Có backup chưa từng khôi phục thì chưa được coi là backup.

## 8. Checklist trước khi dùng thật

### Bảo mật

- [ ] Không có route tự đăng ký; chỉ admin tạo tài khoản.
- [ ] Mật khẩu Argon2id, cookie `HttpOnly; Secure; SameSite=Lax`.
- [ ] Đăng nhập sai bị giới hạn theo IP và email.
- [ ] `nhap_lieu` gọi thẳng action admin hoặc `chi_doc` gọi action lưu giao dịch đều bị chặn.
- [ ] `app_web` không phải superuser; PostgreSQL không mở cổng Internet.
- [ ] Trigger audit ghi đúng người sửa; test hai request pool liên tiếp không lẫn `app.user_id`.
- [ ] Không có secret database hoặc mật khẩu trong bundle client hay Git.
- [ ] URL file không đăng nhập bị 401; traversal `../` và file giả PDF bị chặn.
- [ ] Security headers và HTTPS đang hoạt động.

### Đúng nghiệp vụ

- [ ] Test bộ tính khớp fixture Excel: 20.000.000 = 10.754.000 + 9.246.000 + 0.
- [ ] Thêm/sửa/xóa mềm giao dịch giữa danh sách không làm sai số dư phía sau.
- [ ] QR được quét thử bằng app ngân hàng thật.
- [ ] Xuất Excel khớp số liệu web.
- [ ] Lịch sử cho thấy đúng giá trị cũ/mới và người thao tác.

### Vận hành

- [ ] `pg_dump` và file đính kèm được sao lưu hằng ngày sang máy khác.
- [ ] Đã thử khôi phục backup thành công.
- [ ] Có ít nhất hai tài khoản admin.
- [ ] Ổ đĩa và backup lỗi có cảnh báo.
