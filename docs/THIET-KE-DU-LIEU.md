# Thiết kế dữ liệu và bộ tính

Quay lại [KE-HOACH.md](KE-HOACH.md).

---

## 1. Nguyên tắc chia đôi

Chia mọi cột thành hai loại và không bao giờ trộn lẫn:

**Dữ liệu thô** — người dùng gõ vào, lưu trong database:
ngày, nội dung, ký hiệu HĐ, số HĐ, loại HĐ, trạng thái HĐ đỏ, hình thức thanh toán,
tổng tiền, tiền rượu bia, người lấy HĐ, trạng thái thanh toán phí,
tạm ứng từ cơ quan, giao tiền chị Thúy, hoàn ứng tiền mặt thừa, ghi chú.

**Giá trị suy ra** — tính lại mỗi lần đọc, **không có cột nào trong database**:
hoàn tạm ứng, cơ quan trả thẳng, phí lấy HĐ, dư tạm ứng lý thuyết,
dư tạm ứng thực tế, dư nợ đang cầm, và cả 20 chỉ số của bảng điều khiển.

Ngoại lệ duy nhất: `phi_lay_hd_ghi_de`. Đây là **dữ liệu thô** vì người dùng gõ tay khi một dòng có phí khác mức chung. Bộ tính ưu tiên nó nếu có.

## 2. Bảng dữ liệu

### `vai_tro` và `nguoi_dung`

```sql
create type vai_tro as enum ('admin', 'nhap_lieu', 'chi_doc');

create table nguoi_dung (
  id              uuid primary key default gen_random_uuid(),
  mat_khau_hash   text not null,               -- Argon2id, không lưu mật khẩu thô,
  ho_ten          text not null,
  email           text not null unique,
  vai_tro         vai_tro not null default 'chi_doc',
  dang_hoat_dong  boolean not null default true,
  tao_luc         timestamptz not null default now()
);
```

Bảng này tự quản lý tài khoản vì PostgreSQL chạy trực tiếp trên VPS. `mat_khau_hash` luôn là Argon2id; session không nằm trong bảng này mà nằm ở bảng `phien` riêng. Chỉ admin được tạo tài khoản, không có tự đăng ký.

### `nguoi_lay_hd`

```sql
create table nguoi_lay_hd (
  id              uuid primary key default gen_random_uuid(),
  ten             text not null,
  ty_le_phi       numeric(5,4),           -- null = dùng tỷ lệ chung
  ngan_hang_bin   text,                   -- mã BIN 6 số, ví dụ 970436 = Vietcombank
  so_tai_khoan    text,
  ten_chu_tk      text,
  ghi_chu         text,
  dang_hoat_dong  boolean not null default true,
  tao_luc         timestamptz not null default now()
);
```

`ty_le_phi` để `null` nghĩa là theo tỷ lệ chung trong `cau_hinh`. Điền `0.2000` nghĩa là người này lấy 20%.

Ba cột ngân hàng dùng để sinh QR. Thiếu thì nút QR để mờ kèm chú thích "chưa có số tài khoản".

### `danh_muc`

```sql
create type loai_danh_muc as enum
  ('trang_thai_hd', 'hinh_thuc', 'tt_phi', 'loai_hd');

create table danh_muc (
  id              uuid primary key default gen_random_uuid(),
  loai            loai_danh_muc not null,
  gia_tri         text not null,
  thu_tu          int not null default 0,
  dang_hoat_dong  boolean not null default true,
  unique (loai, gia_tri)
);
```

Dropdown đọc từ bảng này, nên admin thêm một loại chứng từ mới là dropdown có ngay, không cần deploy lại. Đây là điểm khác so với bản Google Sheets: ở đó sửa danh mục phải sửa mảng trong Apps Script.

Ba giá trị `hinh_thuc` có ý nghĩa với bộ tính (`Hoàn tạm ứng`, `Cơ quan trả thẳng`, `Tạm ứng thêm`) và một giá trị `tt_phi` (`Đã thanh toán`). Chúng khai báo thành hằng trong `lib/tai-chinh/kieu.ts`, và migration có ràng buộc không cho xóa. Sửa chữ trong bảng danh mục mà không sửa hằng thì bộ tính ngừng nhận ra giá trị đó — đây là cái bẫy duy nhất của thiết kế danh mục động, ghi ở đây để người sau biết.

### `cau_hinh`

```sql
create table cau_hinh (
  khoa      text primary key,
  gia_tri   jsonb not null,
  mo_ta     text,
  sua_luc   timestamptz not null default now()
);

insert into cau_hinh (khoa, gia_tri, mo_ta) values
  ('ty_le_phi_chung', '0.15',
   'Tỷ lệ phí lấy hóa đơn áp dụng chung, tính trên số tiền hoàn tạm ứng'),
  ('noi_dung_ck_mau', '"Phi lay HD {so_hd}"',
   'Mẫu nội dung chuyển khoản trên QR. {so_hd} và {ky_hieu_hd} được thay thế'),
  ('gioi_han_tep_mb', '10', 'Dung lượng tối đa mỗi file tải lên, tính bằng MB');
```

### `giao_dich`

```sql
create table giao_dich (
  id                  uuid primary key default gen_random_uuid(),

  -- thứ tự
  ngay                date not null,
  so_thu_tu           int  not null default 0,

  -- chứng từ
  noi_dung            text not null,
  ky_hieu_hd          text,
  so_hd               text,
  loai_hd             text,

  -- phân loại
  trang_thai_hd       text not null,
  hinh_thuc           text not null,

  -- số tiền, đơn vị đồng
  tong_tien           bigint not null default 0,
  tien_ruou_bia       bigint not null default 0,
  tam_ung_tu_cq       bigint not null default 0,
  giao_tien_chi_thuy  bigint not null default 0,
  hoan_ung_tien_mat   bigint not null default 0,

  -- phí lấy hóa đơn
  nguoi_lay_hd_id     uuid references nguoi_lay_hd(id) on delete set null,
  phi_lay_hd_ghi_de   bigint,               -- null = để bộ tính tự tính
  trang_thai_tt_phi   text not null default 'Không phát sinh',

  ghi_chu             text,

  -- chỗ chờ cho phần kiểm tra hóa đơn
  trang_thai_kiem_tra text not null default 'chua_kiem_tra',
  ket_qua_kiem_tra    jsonb,

  -- xóa mềm + lưu vết
  da_xoa              boolean not null default false,
  xoa_luc             timestamptz,
  nguoi_xoa           uuid references nguoi_dung(id),
  tao_luc             timestamptz not null default now(),
  nguoi_tao           uuid references nguoi_dung(id),
  sua_luc             timestamptz not null default now(),
  nguoi_sua           uuid references nguoi_dung(id),

  constraint tien_khong_am check (
    tong_tien >= 0 and tien_ruou_bia >= 0 and tam_ung_tu_cq >= 0
    and giao_tien_chi_thuy >= 0 and hoan_ung_tien_mat >= 0
    and (phi_lay_hd_ghi_de is null or phi_lay_hd_ghi_de >= 0)
  ),
  constraint ruou_bia_khong_vuot_tong check (tien_ruou_bia <= tong_tien)
);

create index gd_thu_tu    on giao_dich (ngay, so_thu_tu, tao_luc) where not da_xoa;
create index gd_nguoi_lay on giao_dich (nguoi_lay_hd_id)          where not da_xoa;
create index gd_trang_thai on giao_dich (trang_thai_hd, hinh_thuc) where not da_xoa;
```

Hai `check` ở cuối là ràng buộc ở tầng database, không phải chỉ ở form. Nghĩa là dù ai gọi API bằng cách nào, dữ liệu vô lý cũng không vào được.

Không có cột nào cho `hoan_tam_ung`, `cq_tra_thang`, `phi_lay_hd`, `du_ly_thuyet`, `du_thuc_te`, `du_dang_cam`. Cố tình như vậy.

### `tep_dinh_kem`

```sql
create type loai_tep as enum ('hoa_don', 'chuyen_khoan');

create table tep_dinh_kem (
  id              uuid primary key default gen_random_uuid(),
  giao_dich_id    uuid not null references giao_dich(id) on delete cascade,
  loai            loai_tep not null,
  duong_dan       text not null,          -- đường dẫn tương đối dưới thư mục file ngoài web root
  ten_goc         text not null,
  kich_thuoc      bigint not null,
  mime            text not null,
  nguoi_tai_len   uuid references nguoi_dung(id),
  tao_luc         timestamptz not null default now()
);

create index tep_theo_gd on tep_dinh_kem (giao_dich_id, loai);
```

Hai ô tích xanh trên bảng danh sách chính là hai câu đếm trên bảng này: có ít nhất một `hoa_don` thì tích ô thứ nhất, có ít nhất một `chuyen_khoan` thì tích ô thứ hai.

### `lich_su`

```sql
create table lich_su (
  id              bigserial primary key,
  bang            text not null,
  ban_ghi_id      uuid not null,
  hanh_dong       text not null,           -- INSERT / UPDATE / DELETE
  nguoi_thuc_hien uuid,
  gia_tri_cu      jsonb,
  gia_tri_moi     jsonb,
  tao_luc         timestamptz not null default now()
);

create index ls_theo_ban_ghi on lich_su (bang, ban_ghi_id, tao_luc desc);
create index ls_theo_nguoi    on lich_su (nguoi_thuc_hien, tao_luc desc);
```

Trigger ghi tự động:

```sql
create or replace function ghi_lich_su()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lich_su (bang, ban_ghi_id, hanh_dong, nguoi_thuc_hien,
                       gia_tri_cu, gia_tri_moi)
  values (tg_table_name,
          coalesce(new.id, old.id),
          tg_op,
          nullif(current_setting('app.user_id', true), '')::uuid,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger ls_giao_dich   after insert or update or delete on giao_dich
  for each row execute function ghi_lich_su();
create trigger ls_nguoi_lay   after insert or update or delete on nguoi_lay_hd
  for each row execute function ghi_lich_su();
create trigger ls_nguoi_dung  after insert or update or delete on nguoi_dung
  for each row execute function ghi_lich_su();
create trigger ls_cau_hinh    after insert or update or delete on cau_hinh
  for each row execute function ghi_lich_su();
```

Ghi ở tầng database chứ không ở tầng app là có lý do: code app có thể quên gọi, trigger thì không thể bị bỏ qua. Mỗi transaction của ứng dụng phải chạy `set local app.user_id = '<uuid>'` trước khi ghi; role ứng dụng không được là superuser để không thể bỏ qua trigger. Nếu có thao tác bảo trì trực tiếp, phải đặt user id hệ thống và ghi rõ trong quy trình.

Bảng `lich_su` chỉ cho `insert` từ trigger và `select` cho admin. Không ai được `update` hay `delete` — xem [BAO-MAT-VA-PHAN-QUYEN.md](BAO-MAT-VA-PHAN-QUYEN.md#4-policy-rls).

## 3. Bộ tính

File `lib/tai-chinh/tinh-toan.ts`. Đây là trái tim của dự án. Hàm thuần: cùng đầu vào luôn cho cùng đầu ra, không đọc database, không gọi mạng, không đọc thời gian hệ thống. Nhờ vậy test được dễ và không bao giờ có kết quả bất ngờ.

```ts
export const HT_HOAN_TAM_UNG = 'Hoàn tạm ứng'
export const HT_CQ_TRA_THANG = 'Cơ quan trả thẳng'
export const HT_TAM_UNG_THEM = 'Tạm ứng thêm'
export const HT_GIAO_CHI_THUY = 'Giao tiền chị Thúy'
export const HD_HOP_LE = 'Hợp lệ'
export const HD_CHO = 'Chờ HĐ'
export const PHI_DA_THANH_TOAN = 'Đã thanh toán'

/** Dữ liệu thô của một giao dịch, đúng những gì có trong database */
export type GiaoDichTho = {
  id: string
  ngay: string
  soThuTu: number
  taoLuc: string
  trangThaiHD: string
  hinhThuc: string
  tongTien: number
  tienRuouBia: number
  tamUngTuCQ: number
  giaoTienChiThuy: number
  hoanUngTienMat: number
  nguoiLayHDId: string | null
  phiLayHDGhiDe: number | null
  trangThaiTTPhi: string
}

/** Thêm 6 giá trị suy ra vào một giao dịch */
export type GiaoDichDayDu = GiaoDichTho & {
  hoanTamUng: number
  cqTraThang: number
  phiLayHD: number
  duLyThuyet: number
  duThucTe: number
  duDangCam: number
}

export type ThamSoTinh = {
  tyLePhiChung: number
  /** id người lấy HĐ -> tỷ lệ riêng, chỉ chứa người có tỷ lệ khác mức chung */
  tyLeTheoNguoi: Record<string, number>
}

/**
 * Tính toàn bộ giá trị suy ra cho một danh sách giao dịch.
 * Trả về danh sách MỚI đã sắp theo thứ tự thời gian, không sửa mảng đầu vào.
 */
export function tinhToan(
  ds: readonly GiaoDichTho[],
  thamSo: ThamSoTinh,
): GiaoDichDayDu[] {
  const daSap = [...ds].sort(soSanhThuTu)

  let luyKeLyThuyet = 0
  let luyKeThucTe = 0
  let luyKeDangCam = 0

  return daSap.map((gd) => {
    const tienChiHoan = gd.tongTien - gd.tienRuouBia
    const hopLe = gd.trangThaiHD === HD_HOP_LE

    const hoanTamUng =
      hopLe && gd.hinhThuc === HT_HOAN_TAM_UNG ? tienChiHoan : 0
    const cqTraThang =
      hopLe && gd.hinhThuc === HT_CQ_TRA_THANG ? tienChiHoan : 0

    const phiLayHD = tinhPhi(gd, hoanTamUng, thamSo)
    const phiDaTra = gd.trangThaiTTPhi === PHI_DA_THANH_TOAN ? phiLayHD : 0

    luyKeLyThuyet += gd.tamUngTuCQ - hoanTamUng - gd.hoanUngTienMat
    luyKeThucTe   += gd.tamUngTuCQ - gd.giaoTienChiThuy - phiLayHD - gd.hoanUngTienMat
    luyKeDangCam  += gd.tamUngTuCQ - gd.giaoTienChiThuy - phiDaTra - gd.hoanUngTienMat

    return {
      ...gd,
      hoanTamUng,
      cqTraThang,
      phiLayHD,
      duLyThuyet: luyKeLyThuyet,
      duThucTe: luyKeThucTe,
      duDangCam: luyKeDangCam,
    }
  })
}

/** Thứ tự ưu tiên: ghi đè tay -> tỷ lệ riêng của người lấy -> tỷ lệ chung */
function tinhPhi(
  gd: GiaoDichTho,
  hoanTamUng: number,
  thamSo: ThamSoTinh,
): number {
  if (gd.phiLayHDGhiDe !== null) return gd.phiLayHDGhiDe

  const tyLe =
    (gd.nguoiLayHDId && thamSo.tyLeTheoNguoi[gd.nguoiLayHDId]) ??
    thamSo.tyLePhiChung

  return Math.round(hoanTamUng * tyLe)
}

function soSanhThuTu(a: GiaoDichTho, b: GiaoDichTho): number {
  if (a.ngay !== b.ngay) return a.ngay < b.ngay ? -1 : 1
  if (a.soThuTu !== b.soThuTu) return a.soThuTu - b.soThuTu
  if (a.taoLuc !== b.taoLuc) return a.taoLuc < b.taoLuc ? -1 : 1
  return a.id < b.id ? -1 : 1     // chốt hạ, để thứ tự luôn xác định
}
```

Ba điểm cần chú ý khi bảo trì:

**Vòng lặp cộng dồn thay cho công thức trỏ ô.** Đây chính là chỗ chữa được bệnh của bảng Excel. Không có ô nào trỏ tới ô nào, chỉ có ba biến cộng dồn qua danh sách đã sắp. Chèn hay xóa giao dịch nào cũng chỉ là danh sách đầu vào khác đi, và số dư tự đúng.

**`soSanhThuTu` có nhánh chốt hạ bằng `id`.** Nếu hai giao dịch trùng ngày, trùng số thứ tự, trùng cả `taoLuc`, thì vẫn phải có một thứ tự xác định — không thì cùng một dữ liệu có thể cho hai kết quả khác nhau giữa hai lần chạy. Đừng bỏ nhánh này.

**`Math.round` khớp với `ROUND(...,0)` của Excel ở mọi số dương.** Cả hai làm tròn `.5` lên. Phí luôn không âm nên không phải lo phần âm, chỗ hai hàm này khác nhau.

## 4. Thứ tự giao dịch

Số dư lũy kế phụ thuộc thứ tự, nên phải chốt thứ tự một cách rõ ràng: theo `ngay`, rồi `so_thu_tu`, rồi `tao_luc`, cuối cùng `id`.

`so_thu_tu` cho phép sắp tay khi nhiều giao dịch cùng ngày mà thứ tự có ý nghĩa. Ví dụ cùng ngày 04/09: nhận tạm ứng 20 triệu rồi mới giao chị Thúy 15 triệu. Nếu để ngược, số dư giữa hai dòng sẽ âm — vẫn ra kết quả cuối đúng, nhưng nhìn bảng thấy vô lý.

Mặc định `so_thu_tu = 0` và mọi thứ chạy theo `tao_luc`, đúng như thói quen nhập tuần tự. Trang danh sách có nút kéo lên/kéo xuống để sửa khi cần.

## 5. Hai mươi chỉ số

File `lib/tai-chinh/chi-so.ts`, nhận đầu ra của `tinhToan()`:

```ts
export function tinhChiSo(ds: readonly GiaoDichDayDu[]) {
  const cuoi = ds.at(-1)
  const tong = (chon: (g: GiaoDichDayDu) => number) =>
    ds.reduce((s, g) => s + chon(g), 0)

  // nhóm 1 — tạm ứng từ cơ quan
  const tongTamUng = tong((g) => g.tamUngTuCQ)
  const tamUngThem = tong((g) => (g.hinhThuc === HT_TAM_UNG_THEM ? g.tamUngTuCQ : 0))

  // nhóm 2 — quỹ phí hóa đơn (của tôi)
  const quyToiNhan = tongTamUng - tong((g) => g.giaoTienChiThuy)
  const quyToiDaChi = tong((g) =>
    g.trangThaiTTPhi === PHI_DA_THANH_TOAN ? g.phiLayHD : 0)
  const quyToiNopTra = tong((g) => g.hoanUngTienMat)
  const quyToiDu = quyToiNhan - quyToiDaChi - quyToiNopTra

  // nhóm 3 — quỹ chị Thúy
  const thuyGoc =
    ds.find((g) => g.hinhThuc === HT_GIAO_CHI_THUY)?.giaoTienChiThuy ?? 0
  const thuyThem = tong((g) => g.giaoTienChiThuy) - thuyGoc
  const thuyDaHoan = tong((g) => g.hoanTamUng)
  const thuyDu = thuyGoc + thuyThem - thuyDaHoan

  // nhóm 4 — chi tiếp khách
  const tongBill = tong((g) => g.tongTien)
  const tongRuouBia = tong((g) => g.tienRuouBia)
  const cqTraThang = tong((g) => g.cqTraThang)
  const tongChiThucTe = quyToiDaChi + thuyDaHoan

  // nhóm 5 — chờ xử lý
  const cho = (hinhThuc: string) =>
    tong((g) =>
      g.trangThaiHD === HD_CHO && g.hinhThuc === hinhThuc
        ? g.tongTien - g.tienRuouBia
        : 0)

  const tonQuyCoQuan = quyToiDu + thuyDu

  return {
    tongTamUng, tamUngThem, tonQuyCoQuan, duNoLyThuyet: cuoi?.duLyThuyet ?? 0,
    quyToiNhan, quyToiDaChi, quyToiNopTra, quyToiDu,
    thuyGoc, thuyThem, thuyDaHoan, thuyDu,
    tongBill, tongRuouBia, cqTraThang, tongChiThucTe,
    choHD: cho(HT_HOAN_TAM_UNG), choCQTraThang: cho(HT_CQ_TRA_THANG),
    duThucTe: cuoi?.duThucTe ?? 0, duDangCam: cuoi?.duDangCam ?? 0,

    /** Banner đối soát: tồn quỹ + đã chi + đã nộp trả phải bằng tổng tạm ứng */
    canDoi: tonQuyCoQuan + tongChiThucTe + quyToiNopTra === tongTamUng,
  }
}
```

Phép so sánh `canDoi` dùng `===` chứ không cần `Math.abs(...) < 1` như bản Excel, vì tất cả đều là số nguyên đồng. Đây là lợi ích cụ thể của việc chọn `BIGINT`.

## 6. Test đối chiếu

`lib/tai-chinh/tinh-toan.test.ts` dùng đúng 7 giao dịch mẫu của bảng Excel làm chuẩn. Kỳ vọng dưới đây tôi đã tính tay và đối chiếu với công thức trong file xlsx:

| Chỉ số | Kỳ vọng |
|---|---|
| Tổng tạm ứng từ cơ quan | 20.000.000 |
| Giao chị Thúy (gốc) | 15.000.000 |
| Chị Thúy đã hoàn ứng | 9.246.000 |
| Chị Thúy dư còn lại | 5.754.000 |
| Quỹ tôi nhận | 5.000.000 |
| Quỹ tôi đã chi trả phí | 0 |
| Quỹ tôi dư còn lại | 5.000.000 |
| Tổng tồn quỹ cơ quan | 10.754.000 |
| Tổng chi thực tế 2 quỹ | 9.246.000 |
| Đối soát | 10.754.000 + 9.246.000 + 0 = 20.000.000 ✓ |

Hai hóa đơn hoàn tạm ứng đều ở trạng thái "Chưa thanh toán" phí, nên "Quỹ tôi đã chi trả phí" bằng 0 dù phí lý thuyết là 847.050 + 539.850 = 1.386.900. Đây là điểm khác so với bản Excel cũ: ô `M15` ở đó cộng cả phí chưa trả. Con số 0 mới là đúng nghĩa "đã chi".

Ngoài fixture trên, viết thêm các test:

- Chèn một giao dịch vào giữa danh sách thì số dư các dòng sau đổi đúng, dòng trước không đổi.
- Xóa một giao dịch thì tương tự.
- Đảo thứ tự mảng đầu vào cho kết quả y hệt (vì `tinhToan` tự sắp).
- Danh sách rỗng không làm hàm nổ, trả về `[]` và mọi chỉ số bằng 0.
- Ghi đè phí tay được ưu tiên trước tỷ lệ riêng của người lấy, và tỷ lệ riêng được ưu tiên trước tỷ lệ chung.
- Giao dịch trạng thái "Không hợp lệ" hoặc "Chờ HĐ" không sinh hoàn tạm ứng, nên phí bằng 0.

## 7. Đọc dữ liệu ra sao

Server Component đọc một lần rồi tính:

```ts
// app/(app)/giao-dich/page.tsx
const supabase = await taoClientServer()

const [{ data: dsTho }, { data: dsNguoiLay }, { data: dsCauHinh }] =
  await Promise.all([
    supabase.from('giao_dich').select('*').eq('da_xoa', false),
    supabase.from('nguoi_lay_hd').select('id, ty_le_phi'),
    supabase.from('cau_hinh').select('khoa, gia_tri'),
  ])

const ds = tinhToan(chuanHoa(dsTho ?? []), dungThamSo(dsNguoiLay, dsCauHinh))
```

**Luôn tính trên toàn bộ giao dịch, kể cả khi giao diện đang lọc.** Số dư lũy kế mang nghĩa "tính từ đầu tới dòng này", nên chỉ tính trên phần đã lọc là ra số sai. Lọc chỉ áp dụng ở bước hiển thị, sau khi đã tính xong.

Với dưới 1.200 dòng một năm thì đọc hết và tính lại mỗi lần là chuyện vài milliseconds, không cần tối ưu gì. Nếu sau này lên hàng chục nghìn dòng, cách xử lý là chốt số dư đầu kỳ theo năm rồi chỉ tính trong năm — nhưng đừng làm sớm.
