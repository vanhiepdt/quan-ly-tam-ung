# Kế hoạch triển khai giao diện theo dõi giao dịch

## Tài liệu bàn giao cho Opus

> Mục tiêu của tài liệu này là hướng dẫn triển khai theo từng bước, có điểm dừng kiểm tra sau mỗi giai đoạn. Không thay thế bảng nhật ký hiện tại và không thay đổi logic nghiệp vụ tài chính.

---

## 0. Mục tiêu và giới hạn bắt buộc

### 0.1. Mục tiêu

Giữ nguyên bảng nhật ký giao dịch hiện tại, đồng thời bổ sung một giao diện mới giúp người dùng theo dõi từng giao dịch dễ hiểu hơn:

- Giao dịch này thuộc loại nào?
- Số tiền chính của giao dịch là gì?
- Hóa đơn, phí và hồ sơ đang ở trạng thái nào?
- Giao dịch làm thay đổi số dư nào?
- Số dư trước và sau giao dịch là bao nhiêu?
- Các thao tác Sửa, Giấy, Tệp, Lịch sử, Thanh toán và Xóa nằm ở đâu?

### 0.2. Hai chế độ xem

Giữ nguyên route hiện tại:

```text
/giao-dich
```

Đây vẫn là bảng nhật ký đầy đủ, phục vụ:

- Đối chiếu chi tiết.
- Lọc từng cột.
- Sắp xếp nhiều khóa.
- Phân trang.
- Xuất Excel.
- Kéo đổi thứ tự cột.
- Đổi chiều rộng cột.

Tạo route mới:

```text
/giao-dich/theo-doi
```

Đây là giao diện theo dõi dễ đọc, phục vụ:

- Xem danh sách rút gọn.
- Chọn một giao dịch.
- Xem chi tiết và tác động số dư.
- Lọc theo ngôn ngữ dễ hiểu.
- Mở các thao tác hiện có.

### 0.3. Các điều tuyệt đối không làm

- Không thay bảng hiện tại bằng danh sách thẻ.
- Không xóa hoặc đổi mặc định các cột của bảng.
- Không sửa công thức trong `lib/tai-chinh/tinh-toan.ts`.
- Không viết lại công thức tài chính trong component React.
- Không gọi `tinhToan()` trên danh sách đã lọc.
- Không thêm migration.
- Không thêm bảng database.
- Không thêm một trạng thái tài chính mới như “Đã hoàn tất”.
- Không tự động xác nhận thanh toán dựa trên tệp chuyển khoản.
- Không tự suy luận “tiền hiện đang có” từ số dư lũy kế.
- Không thay đổi phí, làm tròn, nguồn bù hoặc điều kiện hóa đơn hợp lệ.
- Không xây lại hệ thống giấy, tệp hoặc lịch sử.
- Không thêm thư viện quản lý state hoặc thư viện biểu đồ nếu chưa có lý do rõ ràng.

---

# 1. Đọc code và chuẩn bị trước khi sửa

## Bước 1.1 — Đọc hướng dẫn dự án

Đọc các file sau trước khi viết code:

- `AGENTS.md`
- `CLAUDE.md`
- Hướng dẫn Next.js phù hợp trong `node_modules/next/dist/docs/`

Đặc biệt tuân thủ quy định của dự án về phiên bản Next.js hiện tại. Không áp dụng API hoặc convention cũ theo trí nhớ.

## Bước 1.2 — Đọc các file giao diện hiện có

Đọc toàn bộ các file:

- `app/giao-dich/page.tsx`
- `app/giao-dich/bang-nhat-ky.tsx`
- `app/giao-dich/form.tsx`
- `app/giao-dich/cot-nhat-ky.ts`
- `app/giao-dich/loc-nhat-ky.ts`
- `app/giao-dich/sap-xep-nhat-ky.ts`
- `app/giao-dich/sua-giao-dich.tsx`
- `app/giao-dich/thanh-toan.tsx`
- `app/giao-dich/lich-su.tsx`
- `app/giao-dich/xoa-nut.tsx`
- `app/giao-dich/toggle-sidebar.tsx`
- `app/styles.css`

Mục đích:

- Hiểu layout hiện tại.
- Tái sử dụng navigation và thao tác.
- Không làm ảnh hưởng state bảng.
- Không tạo component trùng với component hiện có nếu chưa cần.

## Bước 1.3 — Đọc logic dữ liệu và tính toán

Đọc toàn bộ:

- `lib/tai-chinh/kieu.ts`
- `lib/tai-chinh/tinh-toan.ts`
- `lib/tai-chinh/tinh-toan.test.ts`
- `lib/tai-chinh/du-lieu.ts`
- `lib/tai-chinh/hinh-thuc.ts`
- `lib/tai-chinh/tien-thanh-toan.ts`
- `lib/tai-chinh/chi-so.ts`
- `lib/tai-chinh/danh-muc.ts`
- `lib/tai-chinh/giay.ts`
- `lib/tai-chinh/tai-khoan.ts`

Mục đích:

- Dùng đúng tên field.
- Không nhầm giữa số tiền phát sinh và số dư lũy kế.
- Không nhầm giữa tiền được hoàn/thanh toán và tổng hóa đơn.
- Không nhầm giữa tệp hóa đơn và trạng thái hóa đơn.

## Bước 1.4 — Đọc luồng tạo, sửa và thanh toán

Đọc toàn bộ:

- `lib/tai-chinh/tao-giao-dich.ts`
- `lib/tai-chinh/sua-giao-dich.ts`
- `app/giao-dich/actions.ts`
- `app/giao-dich/thanh-toan-actions.ts`
- `lib/validation/giao-dich.ts`
- `lib/tai-chinh/xac-nhan-hoan-ung.ts`

Mục đích:

- Hiểu action nào đã tồn tại.
- Biết thao tác nào cần quyền admin.
- Biết giao dịch có thể lưu thành công nhưng lập giấy hoặc gắn file thất bại.
- Không tạo lại action chỉ để phục vụ giao diện mới.

## Bước 1.5 — Chạy baseline trước khi sửa

Chạy:

```text
npm test
npm run typecheck
npm run test:ui
npm run test:e2e
```

Nếu một lệnh không chạy được do thiếu môi trường, ghi rõ:

- Lệnh nào.
- Lỗi gì.
- Có phải lỗi môi trường hay lỗi code.

Không bỏ qua baseline chỉ vì tính năng mới chưa bắt đầu.

## Bước 1.6 — Kiểm tra git

Chạy:

```text
git status --short
```

Không ghi đè thay đổi có sẵn của người dùng. Nếu working tree đã có thay đổi liên quan, phải ghi nhận và tránh sửa nhầm file.

---

# 2. Chốt mô hình dữ liệu trình bày

## Bước 2.1 — Không tạo bộ tính thứ hai

Nguồn tài chính duy nhất vẫn là:

```text
layDuLieuTaiChinh() → tinhToan()
```

Giao diện mới chỉ chuyển đổi `GiaoDichTinh` sang dữ liệu dễ hiển thị.

Tạo file:

```text
lib/tai-chinh/theo-doi-giao-dich.ts
```

File này không được:

- Tính lại `hoanTamUng`.
- Tính lại `cqTraThang`.
- Tính lại `phiLayHd`.
- Tính lại `duLyThuyet`.
- Tính lại `duThucTe`.
- Tính lại `duDangCam`.
- Tính lại `duTienCqTraThang`.

Các giá trị trên phải lấy trực tiếp từ `GiaoDichTinh`.

## Bước 2.2 — Tạo kiểu dữ liệu trình bày

Có thể thiết kế kiểu tương tự:

```ts
export type BienDongSoDu = {
  id: string
  ten: string
  truoc: number
  thayDoi: number
  sau: number
  lienQuan: boolean
}

export type TrangThaiHoSo = {
  coHoaDon: boolean
  coChuyenKhoan: boolean
  coGiay: boolean
}

export type GiaoDichTheoDoi = {
  id: string
  ngay: string
  noiDung: string
  hinhThuc: string
  donViTen: string | null
  soTienChinh: number
  nhanSoTienChinh: string
  tienChinhCoTheAm: boolean
  tongTien: number
  tienKhongDuocThanhToan: number
  tienDuocThanhToan: number | null
  phiLayHd: number
  trangThaiHd: string
  trangThaiTtPhi: string
  chiThucTe: boolean
  nguonBuChiThucTe: string
  bienDongSoDu: BienDongSoDu[]
  hoSo: TrangThaiHoSo
  dongCanhBao: string[]
}
```

Tên field có thể điều chỉnh theo convention repo, nhưng phải giữ rõ ràng và không làm mất dữ liệu gốc.

## Bước 2.3 — Tính số dư trước/sau đúng thứ tự

Trong `theo-doi-giao-dich.ts`:

1. Nhận toàn bộ `GiaoDichTinh[]` đã được `tinhToan()`.
2. Duyệt theo đúng thứ tự của mảng đầu vào từ `tinhToan()`.
3. Với mỗi dòng:
   - Số dư trước lấy từ dòng liền trước.
   - Số dư sau lấy từ chính dòng hiện tại.
   - Thay đổi bằng số dư sau trừ số dư trước.
4. Dòng đầu tiên dùng số dư trước bằng 0.
5. Tạo bản đồ theo `id` để UI tìm nhanh.

Không được tính trước/sau sau khi đã lọc.

Có thể tạo helper thuần:

```ts
export function taoDuLieuTheoDoi(rows: readonly GiaoDichTinh[]): GiaoDichTheoDoi[]
```

## Bước 2.4 — Quy định các số dư cần theo dõi

Các số dư hiện có trong `GiaoDichTinh`:

- `duLyThuyet`
- `duThucTe`
- `duDangCam`
- `duHiepDangCam`
- `duTienCqTraThang`
- `duChiTiepKhachThucTe`
- `tongLayQuyChiThuy`

Không phải giao dịch nào cũng cần hiển thị tất cả. Mỗi dòng nên có:

- Các số dư có biến động.
- Các số dư liên quan trực tiếp tới loại giao dịch.
- Nút hoặc phần mở rộng “Xem thêm số dư” để xem các số dư còn lại.

Không xóa dữ liệu số dư khỏi bản trình bày nếu người dùng cần đối chiếu nâng cao.

---

# 3. Chốt cách diễn giải sáu loại giao dịch

## Bước 3.1 — Tạm ứng thêm

### Số tiền chính

```text
Tạm ứng từ cơ quan
```

Lấy từ:

```ts
row.tamUngTuCq
```

### Tác động

```text
Dư TƯ lý thuyết  +A
Dư TƯ thực tế    +A
Dư TƯ đang cầm   +A
Dư Hiệp đang cầm +A
```

### Chứng từ

```text
Phiếu chi CQ
```

## Bước 3.2 — Giao tiền chị Thúy

### Số tiền chính

```text
Tiền giao cho Chị Thúy
```

Lấy từ:

```ts
row.giaoTienChiThuy
```

### Tác động

```text
Dư TƯ lý thuyết  Không đổi
Dư TƯ thực tế    −G
Dư TƯ đang cầm   −G
Dư Hiệp đang cầm −G
```

Không gọi số tiền này là “tiền Chị Thúy đang giữ”. Chỉ gọi là “Tiền giao cho Chị Thúy trong giao dịch này”.

## Bước 3.3 — Đưa tiền CQ trả thẳng cho Chị Thúy

### Số tiền chính

```text
Tiền đưa cho Chị Thúy
```

Lấy từ:

```ts
row.duaTienCqTraThangChoChiThuy
```

### Tác động

```text
Dư CQ trả thẳng  −D
Dư TƯ            Không đổi
```

Phải ghi rõ đây là luồng tiền CQ trả thẳng, không phải tiền tạm ứng.

## Bước 3.4 — Nộp hoàn CQ

### Số tiền chính

```text
Tiền nộp hoàn
```

Lấy từ:

```ts
row.hoanUngTienMat
```

### Tác động

```text
Dư TƯ lý thuyết  −N
Dư TƯ thực tế    −N
Dư TƯ đang cầm   −N
Dư Hiệp đang cầm −N
```

## Bước 3.5 — Hoàn tạm ứng

### Số tiền chính

```text
Tiền ghi nhận hoàn ứng
```

Lấy từ:

```ts
row.hoanTamUng
```

Hiển thị riêng:

- Tổng hóa đơn: `row.tongTien`.
- Khoản không được thanh toán: `row.tienRuouBia`.
- Tiền ghi nhận hoàn ứng: `row.hoanTamUng`.
- Phí: `row.phiLayHd`.
- Trạng thái hóa đơn.
- Chi thực tế.
- Nguồn bù.

Không tự suy ra tiền hoàn bằng `tongTien - tienRuouBia`.

## Bước 3.6 — Cơ quan trả thẳng

### Số tiền chính

```text
Tiền ghi nhận CQ trả thẳng
```

Lấy từ:

```ts
row.cqTraThang
```

Hiển thị riêng:

- Tổng hóa đơn.
- Khoản không được thanh toán.
- Tiền ghi nhận CQ trả thẳng.
- Phí.
- Trạng thái hóa đơn.
- Chi thực tế.
- Nguồn bù.
- `duChiTiepKhachThucTe` nếu có liên quan.

---

# 4. Tạo lớp dữ liệu trình bày

## Bước 4.1 — Tạo file

Tạo:

```text
lib/tai-chinh/theo-doi-giao-dich.ts
```

## Bước 4.2 — Tạo helper nhãn hình thức

Tạo helper trả về:

```ts
{
  nhanNgan: string
  moTa: string
  nhanSoTienChinh: string
}
```

Ví dụ:

```text
Tạm ứng thêm
→ Cơ quan cấp thêm tiền tạm ứng
→ Tạm ứng từ cơ quan

Hoàn tạm ứng
→ Tiếp khách bằng tiền tạm ứng
→ Tiền ghi nhận hoàn ứng
```

Không dùng emoji làm tín hiệu nghiệp vụ. Có thể dùng icon chữ hoặc biểu tượng đơn giản nếu phù hợp với style hiện tại.

## Bước 4.3 — Tạo helper trạng thái

Trạng thái phải giữ độc lập:

```ts
{
  hoaDon: row.trangThaiHd,
  phi: row.trangThaiTtPhi,
  hoSo: {
    hoaDon: row.coHoaDon,
    chuyenKhoan: row.coChuyenKhoan,
  },
  chiThucTe: row.chiThucTe,
}
```

Không tạo một trạng thái duy nhất kiểu:

```text
Đã hoàn tất
```

Có thể tạo cảnh báo hướng dẫn, nhưng cảnh báo không được thay thế trạng thái gốc.

## Bước 4.4 — Tạo helper cảnh báo

Các cảnh báo có thể hiển thị:

- Hóa đơn đang chờ.
- Hóa đơn không hợp lệ.
- Phí chưa thanh toán.
- Chưa có tệp hóa đơn.
- Chưa có tệp chuyển khoản.
- Giao dịch có số dư âm sau khi ghi sổ.
- Chi thực tế đang dùng nguồn bù đặc biệt.

Cảnh báo phải được sinh từ dữ liệu hiện có. Không thêm quy tắc cảnh báo mới nếu không có yêu cầu nghiệp vụ.

---

# 5. Tạo route server mới

## Bước 5.1 — Tạo page

Tạo:

```text
app/giao-dich/theo-doi/page.tsx
```

Cấu trúc dự kiến:

```tsx
import { redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { taoDuLieuTheoDoi } from '@/lib/tai-chinh/theo-doi-giao-dich'
import { TheoDoiGiaoDich } from './theo-doi-giao-dich'

export default async function TheoDoiPage() {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')

  const { giaoDich, thamSo } = await layDuLieuTaiChinh()
  const rows = tinhToan(giaoDich, thamSo)
  const data = taoDuLieuTheoDoi(rows)

  return <TheoDoiGiaoDich rows={data} ... />
}
```

Không lấy dữ liệu tài chính trước khi kiểm tra phiên.

## Bước 5.2 — Xử lý lỗi dữ liệu

Nếu `layDuLieuTaiChinh()` lỗi:

- Không render danh sách rỗng như thể không có giao dịch.
- Truyền trạng thái lỗi rõ ràng xuống client.
- Hiển thị thông báo lỗi kết nối.

Cần phân biệt:

```text
Không có giao dịch nào
```

và:

```text
Không tải được dữ liệu giao dịch
```

## Bước 5.3 — Tái sử dụng layout

Có thể tái sử dụng:

- Header hiện tại.
- Sidebar hiện tại.
- `ToggleSidebar`.
- Nút thêm giao dịch `FormGiaoDich`.

Không copy một phiên bản layout khác nhau quá nhiều nếu có thể tạo component dùng chung mà không ảnh hưởng bảng cũ.

---

# 6. Tạo component điều phối client

## Bước 6.1 — Tạo component

Tạo:

```text
app/giao-dich/theo-doi/theo-doi-giao-dich.tsx
```

Props tối thiểu:

```ts
type Props = {
  rows: GiaoDichTheoDoi[]
  coTheSua: boolean
  vaiTro: string
  loiTaiDuLieu?: string
}
```

## Bước 6.2 — State cần có

```ts
const [tuKhoa, setTuKhoa] = useState('')
const [boLoc, setBoLoc] = useState<BoLocTheoDoi>({})
const [trang, setTrang] = useState(1)
const [idDangChon, setIdDangChon] = useState<string | null>(null)
```

Không lưu bản sao các số dư đã tính trong state nếu không cần. Khi rows thay đổi, id đang chọn phải được kiểm tra lại.

## Bước 6.3 — Lọc

Lọc trên `GiaoDichTheoDoi[]`, sau khi đã tạo dữ liệu trình bày từ toàn bộ ledger.

Tìm kiếm theo:

- `noiDung`.
- `hinhThuc`.
- `donViTen`.
- `kyHieuHd`.
- `soHd`.

Lọc theo:

- Khoảng ngày.
- Hình thức.
- Trạng thái hóa đơn.
- Trạng thái phí.
- Có tệp hóa đơn.
- Có tệp chuyển khoản.

Sau khi thay đổi bộ lọc:

```text
setTrang(1)
```

Nếu giao dịch đang chọn không còn nằm trong kết quả lọc, có thể giữ chi tiết đang mở hoặc đóng lại; chọn một hành vi nhất quán và viết test cho hành vi đó.

## Bước 6.4 — Phân trang

Có thể tái sử dụng logic phân trang trong `cot-nhat-ky.ts` hoặc tạo helper riêng tương tự.

Phân trang chỉ ảnh hưởng danh sách hiển thị, không ảnh hưởng dữ liệu tính số dư.

---

# 7. Tạo bộ lọc dễ hiểu

## Bước 7.1 — Tạo file

Tạo:

```text
app/giao-dich/theo-doi/bo-loc-theo-doi.tsx
```

## Bước 7.2 — Nội dung bộ lọc

```text
Tìm giao dịch
[ Nội dung, đơn vị, số hóa đơn ]

Khoảng ngày
[ Từ ngày ] [ Đến ngày ]

Hình thức
[ Tất cả ]
[ Tạm ứng thêm ]
[ Giao tiền chị Thúy ]
[ Đưa tiền CQ trả thẳng cho Chị Thúy ]
[ Hoàn tạm ứng ]
[ Cơ quan trả thẳng ]
[ Nộp hoàn CQ ]

Tình trạng hóa đơn
[ Tất cả ] [ Hợp lệ ] [ Chờ HĐ ] [ Không hợp lệ ]

Phí lấy hóa đơn
[ Tất cả ] [ Không phát sinh ] [ Chưa thanh toán ]
[ Đã thanh toán ] [ Đã hoàn trả ]

Hồ sơ
[ Tất cả ] [ Có tệp hóa đơn ] [ Có tệp chuyển khoản ]
```

## Bước 7.3 — Bộ lọc phải có trạng thái rõ ràng

Hiển thị:

```text
Đang hiển thị X giao dịch
```

Có nút:

```text
Xóa bộ lọc
```

Nếu không có kết quả:

```text
Không có giao dịch phù hợp.
Thử xóa hoặc thay đổi bộ lọc.
```

Không dùng popup lọc từng cột của bảng cũ cho màn hình mới.

---

# 8. Tạo thẻ giao dịch

## Bước 8.1 — Tạo file

Tạo:

```text
app/giao-dich/theo-doi/the-giao-dich.tsx
```

## Bước 8.2 — Layout thẻ

Ví dụ:

```text
[Hợp lệ] [Chưa thanh toán phí]

12/11/2026
Tiếp Công ty ABC
Hoàn tạm ứng

Tiền ghi nhận hoàn ứng
2.300.000 ₫

Hóa đơn: Hợp lệ · 1C26MTT · Số 66
Tệp: Hóa đơn ✓ · Chuyển khoản —
```

Thẻ phải:

- Có trạng thái được đọc bằng chữ.
- Có vùng click rõ ràng.
- Mở được bằng bàn phím.
- Không để nút con kích hoạt nhầm chọn thẻ cha.
- Hiển thị rõ thẻ nào đang được chọn.

## Bước 8.3 — Nhãn số tiền theo hình thức

| Hình thức | Nhãn |
|---|---|
| Tạm ứng thêm | Tạm ứng từ cơ quan |
| Giao tiền chị Thúy | Tiền giao cho Chị Thúy |
| Đưa tiền CQ trả thẳng cho Chị Thúy | Tiền đưa cho Chị Thúy |
| Hoàn tạm ứng | Tiền ghi nhận hoàn ứng |
| Cơ quan trả thẳng | Tiền ghi nhận CQ trả thẳng |
| Nộp hoàn CQ | Tiền nộp hoàn |

Không dùng nhãn chung “Số tiền” cho cả sáu loại.

---

# 9. Tạo panel chi tiết giao dịch

## Bước 9.1 — Tạo file

Tạo:

```text
app/giao-dich/theo-doi/chi-tiet-giao-dich.tsx
```

## Bước 9.2 — Phần thông tin chung

Hiển thị:

```text
Tiếp Công ty ABC
12/11/2026
Hoàn tạm ứng
Đơn vị: Công ty ABC
```

Với giao dịch nội bộ:

```text
Tạm ứng thêm
12/11/2026
Không gắn đơn vị tiếp khách
```

## Bước 9.3 — Phần các khoản tiền

Ví dụ:

```text
Tổng hóa đơn                         2.500.000 ₫
Khoản không được thanh toán            200.000 ₫
Tiền ghi nhận hoàn ứng               2.300.000 ₫
Phí lấy hóa đơn                        375.000 ₫
```

Phải lấy giá trị từ row đã tính, không viết lại công thức.

## Bước 9.4 — Phần tác động số dư

Hiển thị:

```text
Số dư                  Trước       Thay đổi       Sau
Dư TƯ lý thuyết         ...         −2.300.000     ...
Dư TƯ thực tế           ...         −2.500.000     ...
Dư TƯ đang cầm          ...         −2.500.000     ...
```

Nếu không có biến động, có thể đưa vào vùng “Xem thêm số dư”, nhưng không được bỏ mất trong chế độ chi tiết nâng cao.

## Bước 9.5 — Phần hóa đơn

Hiển thị:

- Trạng thái hóa đơn.
- Ký hiệu.
- Số hóa đơn.
- Loại chứng từ.
- Người lấy hóa đơn.
- Tệp hóa đơn.

Khi `Chờ HĐ`:

```text
Chưa ghi nhận tiền hoàn/thanh toán từ hóa đơn này.
```

Khi `Không hợp lệ`:

```text
Hóa đơn chưa được tính vào khoản hoàn/thanh toán.
```

Không nói toàn bộ giao dịch không ảnh hưởng số dư, vì phí có thể vẫn được tính.

## Bước 9.6 — Phần phí

Hiển thị:

```text
Tính phí lấy hóa đơn: Có
Cơ sở tính phí: Tổng tiền
Phí được tính: 375.000 ₫
Trạng thái: Chưa thanh toán
```

Không diễn giải `Đã hoàn trả` thành giao dịch đảo tiền vì bộ tính hiện tại chưa có nhánh đảo riêng cho trạng thái đó.

## Bước 9.7 — Phần Chi thực tế

Chỉ hiện với Hoàn tạm ứng và Cơ quan trả thẳng.

Hiển thị:

```text
Chi thực tế: Có
Khoản không được thanh toán: 200.000 ₫
Nguồn bù: Quỹ Chị Thúy
Khoản lấy quỹ Chị Thúy: 200.000 ₫
```

Các nguồn:

```text
Số dư
Quỹ Chị Thúy
Tự chịu
```

Nếu là `Tự chịu`, dùng mô tả:

```text
Khoản không được thanh toán không trừ vào số dư
và không ghi nhận là khoản lấy quỹ Chị Thúy.
```

## Bước 9.8 — Phần hồ sơ

Hiển thị:

```text
Tệp hóa đơn: Có / Chưa có
Tệp chuyển khoản: Có / Chưa có
Giấy đề nghị: Có / Chưa có
```

Nhớ rằng:

- Có tệp hóa đơn không đồng nghĩa hóa đơn hợp lệ.
- Có tệp chuyển khoản không đồng nghĩa phí đã thanh toán.

---

# 10. Tái sử dụng thao tác hiện có

## Bước 10.1 — Sửa

Dùng lại:

```text
app/giao-dich/sua-giao-dich.tsx
```

Không tạo modal sửa mới trong màn hình theo dõi nếu component hiện tại đáp ứng được.

## Bước 10.2 — Thanh toán phí

Dùng lại:

```text
app/giao-dich/thanh-toan.tsx
```

Chỉ hiển thị khi giao dịch có thể thanh toán phí theo logic hiện có.

## Bước 10.3 — Lịch sử

Dùng lại:

```text
app/giao-dich/lich-su.tsx
```

## Bước 10.4 — Xóa

Dùng lại:

```text
app/giao-dich/xoa-nut.tsx
```

## Bước 10.5 — Giấy và Tệp

Dùng route hiện tại:

```text
/giay/{id}
/tep/{id}
```

Không dựng Word hoặc tải toàn bộ hồ sơ khi chỉ mở danh sách.

---

# 11. Phân quyền và cập nhật sau thao tác

## Bước 11.1 — Giữ nguyên phân quyền

Người chỉ đọc:

- Xem danh sách.
- Xem chi tiết.
- Mở giấy.
- Mở tệp.
- Xem lịch sử.

Người nhập liệu:

- Thực hiện các action đang được phép.

Admin:

- Có thêm quyền xác nhận thanh toán theo action hiện tại.

Không coi việc ẩn nút client là bảo vệ phân quyền. Server action vẫn phải quyết định quyền.

## Bước 11.2 — Refresh dữ liệu

Sau các thao tác:

- Sửa.
- Thanh toán phí.
- Xóa giao dịch.

Phải:

1. Dùng action hiện có.
2. Revalidate hoặc refresh theo cơ chế hiện tại.
3. Đọc lại dữ liệu tài chính.
4. Gọi lại `tinhToan()` trên toàn bộ ledger.
5. Cập nhật danh sách và chi tiết.

Không cập nhật lạc quan số dư bằng phép tính trong client.

## Bước 11.3 — Giao dịch bị xóa hoặc thay đổi

Nếu giao dịch đang mở chi tiết bị xóa:

```text
Giao dịch không còn trong dữ liệu hiện tại.
```

Sau đó đóng chi tiết hoặc yêu cầu chọn giao dịch khác.

---

# 12. Responsive và accessibility

## Bước 12.1 — Desktop

- Danh sách bên trái.
- Chi tiết bên phải.
- Panel chi tiết không che header.
- Các số tiền căn phải.
- Dùng `tabular-nums` cho số.

## Bước 12.2 — Tablet

- Hai cột khi đủ rộng.
- Chuyển thành một cột khi không đủ không gian.
- Bộ lọc được phép xuống dòng.
- Không tạo thanh cuộn ngang cho toàn trang.

## Bước 12.3 — Mobile

- Danh sách một cột.
- Chi tiết mở dialog gần toàn màn hình.
- Số dư xếp dọc.
- Nút đủ lớn.
- Nội dung dài tự xuống dòng.
- Không dùng bảng rộng thu nhỏ.

## Bước 12.4 — Accessibility

- Thẻ giao dịch phải mở được bằng bàn phím.
- Có `aria-selected` cho mục đang chọn.
- Dialog có tên rõ ràng.
- Escape đóng dialog.
- Focus quay lại mục đã mở dialog.
- Không dùng màu làm tín hiệu duy nhất.
- Các trạng thái có chữ.
- Các nút con không kích hoạt chọn dòng cha.
- Focus-visible phải nhìn thấy rõ.

---

# 13. Kiểm thử lớp trình bày

## Bước 13.1 — Tạo unit test

Tạo:

```text
lib/tai-chinh/theo-doi-giao-dich.test.ts
```

## Bước 13.2 — Test sáu hình thức

Bắt buộc test:

- Tạm ứng thêm.
- Giao tiền chị Thúy.
- Đưa tiền CQ trả thẳng cho Chị Thúy.
- Hoàn tạm ứng.
- Cơ quan trả thẳng.
- Nộp hoàn CQ.

Mỗi test phải kiểm:

- Nhãn hình thức.
- Nhãn số tiền chính.
- Giá trị số tiền chính.
- Số dư liên quan.

## Bước 13.3 — Test số dư trước/sau

Kiểm tra:

- Dòng đầu tiên.
- Hai giao dịch cùng ngày.
- Nhiều giao dịch khác loại.
- Giao dịch được hiển thị mới nhất trước.
- Lọc chỉ còn một nhóm giao dịch.
- Phân trang.

Kết quả số dư phải giữ nguyên dù danh sách hiển thị bị lọc hoặc đảo thứ tự.

## Bước 13.4 — Test hóa đơn

Kiểm tra:

- `Hợp lệ`.
- `Chờ HĐ`.
- `Không hợp lệ`.

Đặc biệt kiểm tra rằng giao dịch hóa đơn chưa hợp lệ không hiển thị tiền hoàn/thanh toán như đã ghi nhận, nhưng không tự xóa thông tin phí nếu phí vẫn có trong dữ liệu.

## Bước 13.5 — Test Chi thực tế

Kiểm tra:

- Không Chi thực tế.
- Chi thực tế, nguồn `so_du`.
- Chi thực tế, nguồn `quy_chi_thuy`.
- Chi thực tế, nguồn `tu_chiu`.

## Bước 13.6 — Test phí và làm tròn

Kiểm tra:

- Không tính phí.
- Tính theo tổng tiền.
- Tính theo tiền được thanh toán.
- Phí ghi đè.
- Phí ghi đè bằng 0.
- Chưa thanh toán.
- Đã thanh toán.
- Đã hoàn trả.
- Làm tròn.
- Không làm tròn.
- Tiền thanh toán sửa tay.

---

# 14. Kiểm thử UI/E2E

Bổ sung test cho các luồng:

1. Người dùng đăng nhập mở `/giao-dich/theo-doi`.
2. Người dùng chuyển sang `/giao-dich`.
3. Người dùng tìm kiếm theo nội dung.
4. Người dùng tìm kiếm theo số hóa đơn.
5. Người dùng lọc theo hình thức.
6. Người dùng lọc theo trạng thái hóa đơn.
7. Người dùng lọc theo trạng thái phí.
8. Người dùng lọc theo hồ sơ tệp.
9. Người dùng xóa bộ lọc.
10. Người dùng chọn một giao dịch.
11. Người dùng mở chi tiết bằng chuột.
12. Người dùng mở chi tiết bằng bàn phím.
13. Người dùng đóng chi tiết bằng Escape.
14. Người dùng mở Giấy đúng ID.
15. Người dùng mở Tệp đúng ID.
16. Người dùng mở Lịch sử đúng ID.
17. Người dùng sửa giao dịch và thấy dữ liệu cập nhật.
18. Admin xác nhận thanh toán phí và thấy trạng thái cập nhật.
19. Người dùng xóa giao dịch và thấy dòng bị loại khỏi danh sách.
20. Người chưa đăng nhập bị chuyển về `/dang-nhap`.
21. Lỗi database không hiển thị thành danh sách rỗng.
22. Màn hình hiển thị đúng ở desktop và mobile khoảng 375px.

---

# 15. Kiểm thử hồi quy bảng hiện tại

Sau khi hoàn thành giao diện mới, phải xác nhận các chức năng cũ vẫn hoạt động:

- Bảng vẫn hiển thị.
- Bộ lọc cột vẫn hoạt động.
- Sắp xếp vẫn hoạt động.
- Sắp xếp nhiều khóa vẫn hoạt động.
- Phân trang vẫn hoạt động.
- Sticky header vẫn đúng vị trí.
- Kéo đổi cột vẫn hoạt động.
- Đổi chiều rộng cột vẫn hoạt động.
- Chọn dòng không bị ảnh hưởng bởi nút thao tác.
- Xuất Excel vẫn xuất đúng dữ liệu.
- Sửa, Giấy, Tệp, Lịch sử, Thanh toán và Xóa vẫn hoạt động.

Không được chấp nhận việc giao diện mới chạy được nhưng làm thay đổi hành vi bảng cũ.

---

# 16. Thứ tự triển khai đề xuất

## Chặng 1 — Baseline và hợp đồng dữ liệu

Thực hiện:

1. Đọc toàn bộ file bắt buộc.
2. Chạy test baseline.
3. Xác nhận working tree.
4. Tạo kiểu dữ liệu trình bày.
5. Viết test cho `taoDuLieuTheoDoi()`.

Điểm kiểm tra:

- Chưa sửa bảng hiện tại.
- Không sửa `tinhToan()`.
- Test lớp trình bày chạy được.

## Chặng 2 — Lớp trình bày

Thực hiện:

1. Tạo `lib/tai-chinh/theo-doi-giao-dich.ts`.
2. Tạo nhãn sáu loại giao dịch.
3. Tạo số dư trước/sau.
4. Tạo trạng thái độc lập.
5. Tạo cảnh báo trình bày.
6. Hoàn thiện unit test.

Điểm kiểm tra:

- Kết quả đối chiếu được với `GiaoDichTinh`.
- Không có công thức tài chính mới.

## Chặng 3 — Route và danh sách

Thực hiện:

1. Tạo `/giao-dich/theo-doi`.
2. Thêm kiểm tra phiên.
3. Đọc dữ liệu toàn bộ ledger.
4. Tạo bộ lọc.
5. Tạo danh sách.
6. Tạo phân trang.
7. Tạo empty/error/loading state.

Điểm kiểm tra:

- Có thể xem toàn bộ giao dịch.
- Lọc không làm thay đổi số dư.

## Chặng 4 — Chi tiết

Thực hiện:

1. Tạo panel desktop.
2. Tạo dialog mobile.
3. Hiển thị thông tin chung.
4. Hiển thị các khoản tiền.
5. Hiển thị số dư trước/thay đổi/sau.
6. Hiển thị hóa đơn, phí, tệp và Chi thực tế.

Điểm kiểm tra:

- Từng loại giao dịch có cách diễn giải đúng.
- Không gộp nhầm trạng thái.

## Chặng 5 — Tích hợp thao tác

Thực hiện:

1. Tái sử dụng Sửa.
2. Tái sử dụng Giấy.
3. Tái sử dụng Tệp.
4. Tái sử dụng Lịch sử.
5. Tái sử dụng Thanh toán.
6. Tái sử dụng Xóa.
7. Xử lý refresh sau action.

Điểm kiểm tra:

- Server vẫn kiểm quyền.
- Số dư được tính lại sau thay đổi.

## Chặng 6 — Điều hướng và hoàn thiện style

Thực hiện:

1. Thêm liên kết từ bảng sang giao diện mới.
2. Thêm liên kết quay lại bảng.
3. Bổ sung style riêng trong `app/styles.css` nếu cần.
4. Kiểm tra mobile.
5. Kiểm tra keyboard và focus.

## Chặng 7 — Hồi quy và nghiệm thu

Chạy:

```text
npm test
npm run typecheck
npm run test:ui
npm run test:e2e
```

Sau đó kiểm tra trực tiếp bảng cũ và so sánh cùng một bộ dữ liệu trên hai màn hình.

---

# 17. Tiêu chí nghiệm thu cuối cùng

Tính năng chỉ được xem là hoàn thành khi tất cả điều kiện sau đạt:

1. Bảng `/giao-dich` không đổi hành vi.
2. Route `/giao-dich/theo-doi` hoạt động.
3. Có chuyển qua lại giữa hai màn hình.
4. Hiển thị đủ sáu loại giao dịch.
5. Mỗi loại có nhãn số tiền riêng.
6. Số tiền lấy từ dữ liệu đã tính.
7. Không tính lại tiền bằng công thức đơn giản trong UI.
8. Số dư trước/sau khớp `tinhToan()`.
9. Lọc không làm sai số dư.
10. Phân trang không làm sai số dư.
11. Trạng thái hóa đơn, phí và tệp độc lập.
12. Chi thực tế và nguồn bù được hiển thị đúng.
13. Mở đúng giấy, tệp và lịch sử.
14. Phân quyền giữ nguyên.
15. Không phát sinh side effect khi chỉ xem chi tiết.
16. Có loading, empty, filter-empty và error state.
17. Chạy được trên desktop và mobile.
18. Dùng được bằng bàn phím.
19. Không thêm migration.
20. Không sửa công thức nghiệp vụ.
21. Không đổi mặc định nghiệp vụ.
22. Unit test mới đạt.
23. Test hồi quy bảng cũ đạt.
24. Có báo cáo file đã sửa và lệnh test đã chạy.

---

# 18. Báo cáo bắt buộc sau khi Opus hoàn thành

Opus phải báo cáo theo mẫu:

```text
## Đã triển khai

- [file] — thay đổi gì
- [file] — thay đổi gì

## Không thay đổi

- Logic tinhToan
- Schema/database
- Bảng nhật ký hiện tại
- Phân quyền nghiệp vụ

## Kiểm thử

- npm test: PASS/FAIL
- npm run typecheck: PASS/FAIL
- npm run test:ui: PASS/FAIL
- npm run test:e2e: PASS/FAIL

## Kiểm tra hồi quy

- Bảng cũ: PASS/FAIL
- Sticky header: PASS/FAIL
- Kéo cột: PASS/FAIL
- Lọc/sắp xếp: PASS/FAIL
- Xuất Excel: PASS/FAIL
- Thao tác Sửa/Giấy/Tệp/Lịch sử/Xóa: PASS/FAIL

## Giới hạn còn lại

- ...
```

Nếu test thất bại, phải ghi rõ lỗi và không báo hoàn thành như thể tất cả đã đạt.
