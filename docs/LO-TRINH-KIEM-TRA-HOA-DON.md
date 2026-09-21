# Lộ trình tự động nhập liệu và kiểm tra hóa đơn

Nút **Đọc từ hóa đơn** trên form Thêm giao dịch đã chạy kiểm soát 2 lớp (QR khóa số liệu, AI đối chiếu và điền phần QR không có). Kết quả chỉ là đề xuất — không ghi thẳng vào database. Các bước còn lại (đọc XML, tra cứu GDT, kiểm tra trùng số HĐ sau khi lưu) vẫn chưa làm.

Đọc [KE-HOACH.md](KE-HOACH.md) và [THIET-KE-DU-LIEU.md](THIET-KE-DU-LIEU.md) trước.

---

## 1. Ba chỗ đã để sẵn

### Cột trong `giao_dich`

```sql
trang_thai_kiem_tra text  not null default 'chua_kiem_tra',
ket_qua_kiem_tra    jsonb,
```

`trang_thai_kiem_tra` nhận một trong: `chua_kiem_tra`, `dang_kiem_tra`, `hop_le`, `co_canh_bao`, `khong_hop_le`, `loi_ky_thuat`.

`ket_qua_kiem_tra` để `JSONB` chứ không tách thành nhiều cột là cố ý: lúc này chưa biết chương trình kiểm tra sẽ trả về những gì. Thêm trường mới vào JSON không cần migration; sau này khi hình dạng dữ liệu đã ổn định thì mới tách cột và đánh index.

### Interface

```ts
// lib/kiem-tra/giao-dien.ts
export type TrangThaiKiemTra =
  | 'chua_kiem_tra' | 'dang_kiem_tra' | 'hop_le'
  | 'co_canh_bao' | 'khong_hop_le' | 'loi_ky_thuat'

export interface DuLieuDocTuHoaDon {
  kyHieuHd?: string
  soHd?: string
  ngay?: string          // ISO yyyy-mm-dd
  mstBanHang?: string
  tenBanHang?: string
  mstMuaHang?: string
  tongTien?: number      // đồng, số nguyên
  tienThue?: number
  tongCong?: number
}

export interface PhatHien {
  muc: 'loi' | 'canh_bao' | 'thong_tin'
  ma: string             // ví dụ 'mst_khong_khop', 'so_tien_lech'
  thongDiep: string      // tiếng Việt, hiển thị trực tiếp cho người dùng
  truong?: string        // tên trường liên quan, để giao diện tô sáng
}

export interface KetQuaKiemTra {
  trangThai: TrangThaiKiemTra
  docDuoc: DuLieuDocTuHoaDon
  phatHien: PhatHien[]
  kiemLuc: string        // ISO datetime
  phienBanBoKiemTra: string
}

export interface KiemTraHoaDon {
  /** Đọc dữ liệu từ file hóa đơn (PDF, XML, ảnh) */
  doc(tep: { duongDan: string; mime: string }): Promise<DuLieuDocTuHoaDon>

  /** So dữ liệu đọc được với dữ liệu người dùng đã gõ */
  doiChieu(
    docDuoc: DuLieuDocTuHoaDon,
    daGo: { kyHieuHd?: string; soHd?: string; ngay: string; tongTien: number },
  ): PhatHien[]

  /** Gọi API tra cứu bên ngoài nếu có */
  traCuu?(docDuoc: DuLieuDocTuHoaDon): Promise<PhatHien[]>
}
```

Bản rỗng dùng cho lần này:

```ts
// lib/kiem-tra/khong-lam-gi.ts
import type { KiemTraHoaDon } from './giao-dien'

export const boKiemTraRong: KiemTraHoaDon = {
  async doc() { return {} },
  doiChieu() { return [] },
}
```

Nhờ có bản rỗng, giao diện viết luôn được như thể chức năng đã có, và khi thay bằng bản thật thì không phải sửa component nào.

### Nút trên giao diện

Trang chi tiết giao dịch có nút "Kiểm tra hóa đơn", để mờ, kèm chú thích "sắp có". Khu vực hiển thị kết quả cũng dựng sẵn: một hàng trạng thái có màu, và danh sách phát hiện bên dưới. Lúc này danh sách luôn rỗng.

## 2. Làm theo bốn bước

Thứ tự này chọn theo nguyên tắc dễ trước, chắc trước.

### Bước 1 — Đọc hóa đơn XML

Đây là bước đáng làm đầu tiên vì hóa đơn điện tử Việt Nam theo Nghị định 123/2020 có bản XML, và đọc XML thì chính xác 100% — không như OCR. Nếu người dùng chịu tải XML lên thì cả phần OCR có thể không cần tới.

XML hóa đơn có cấu trúc `<HDon><DLHDon><TTChung>` chứa ký hiệu, số hóa đơn, ngày; `<NDHDon><NBan>` bên bán; `<NMua>` bên mua; `<TToan>` tổng tiền. Tên thẻ có khác nhau chút giữa các nhà cung cấp dịch vụ hóa đơn, nên viết bộ đọc theo hướng dò nhiều đường dẫn khả năng thay vì cố định một đường.

**Bảo mật:** parser XML phải tắt external entity, nếu không bị XXE — một file XML gửi lên có thể đọc file trong server hoặc gọi mạng nội bộ. Dùng `fast-xml-parser` (không xử lý entity ngoài theo mặc định) và không bao giờ dùng `libxmljs` với `noent: true`.

### Bước 2 — Đối chiếu với dữ liệu đã gõ

Không cần AI, chỉ là so sánh. Những chỗ đáng so:

| Kiểm tra | Mức khi lệch |
|---|---|
| Số hóa đơn khớp | lỗi |
| Ký hiệu hóa đơn khớp | lỗi |
| Ngày khớp | cảnh báo (người gõ có thể lấy ngày thanh toán) |
| Tổng tiền khớp từng đồng | lỗi |
| MST bên mua đúng MST cơ quan | lỗi |
| Trùng số hóa đơn với giao dịch khác đã có | lỗi |
| Tổng tiền lớn hơn hạn mức trong `cau_hinh` | cảnh báo |

Kiểm tra trùng số hóa đơn là cái đáng giá nhất trong bảng này, vì nó bắt được lỗi thật hay gặp: cùng một hóa đơn bị nhập hai lần rồi hoàn ứng hai lần.

### Bước 3 — Tra cứu bên ngoài

Tổng cục Thuế có cổng tra cứu hóa đơn tại `hoadondientu.gdt.gov.vn`. Trước khi làm bước này cần kiểm tra hai điều mà tôi chưa xác minh được: có API công khai dùng được hay không, và điều khoản sử dụng có cho phép truy vấn tự động hay không. Nếu chỉ có giao diện web thì việc tự động lấy dữ liệu vừa dễ vỡ khi họ đổi trang, vừa có thể vi phạm điều khoản. Đừng bỏ qua bước xác minh này.

Nếu bước này khả thi thì `traCuu()` là chỗ để gọi, và kết quả gộp vào `phatHien`.

### Bước 4 — OCR cho hóa đơn ảnh và PDF scan

Để cuối vì đây là phần khó nhất và kém chắc chắn nhất. Ba hướng:

| Hướng | Chi phí | Độ chính xác | Ghi chú |
|---|---|---|---|
| Model đa phương thức (Claude, GPT) | trả theo lượt | cao | Đơn giản nhất, đưa ảnh và mô tả trường cần lấy |
| Google Document AI | trả theo trang | cao | Có model riêng cho hóa đơn |
| Tesseract tự chạy | 0đ | thấp với hóa đơn tiếng Việt | Chỉ nên dùng nếu bắt buộc không gửi dữ liệu ra ngoài |

Điểm cần cân trước khi chọn: dùng dịch vụ bên ngoài nghĩa là **hóa đơn của cơ quan đi ra ngoài hệ thống**, kèm tên nhà cung cấp, số tiền, MST. Đây là quyết định của bạn, không phải quyết định kỹ thuật. Nếu không muốn thì chỉ làm bước 1 và 2, và yêu cầu người dùng tải XML.

Dù chọn hướng nào, kết quả OCR luôn là **đề xuất**, không phải giá trị cuối. Giao diện điền vào form và người dùng bấm xác nhận. Đừng để OCR ghi thẳng vào database.

## 3. Cắm vào chỗ nào

Ba điểm nối, không chỗ nào cần sửa bộ tính:

**Khi tải file hóa đơn lên** — chạy kiểm tra ngầm, không bắt người dùng chờ. Đặt `trang_thai_kiem_tra = 'dang_kiem_tra'` rồi trả về ngay; tiến trình nền ghi kết quả sau.

**Nút "Kiểm tra hóa đơn"** trên trang chi tiết — chạy lại theo yêu cầu, cho trường hợp kiểm tra hỏng lần trước hoặc vừa sửa dữ liệu.

**Nút "Đọc từ hóa đơn"** trên form nhập (đã làm) — tải PDF/ảnh, quét QR rồi nhờ AI đối chiếu, điền sẵn vào các ô. Người dùng soát rồi lưu. Không ghi thẳng kết quả đọc vào database.

Hai lớp trên form:
1. Quét QR hóa đơn điện tử. Hai khuôn: ống đứng `MST|ký hiệu|số|ngày|tổng tiền|mã CQT`, và TLV kiểu EMV (`000201` + mẫu 80–99: MST, loại, ký hiệu, số, ngày, tổng tiền — MISA meinvoice / QĐ TCT). QR thắng khi lệch với AI. Không nhận VietQR thanh toán.
2. AI vision đọc người mua, người bán, dòng hàng; tiền rượu bia cộng từ dòng hàng (từ điển, không tin số AI nếu lệch). MST người mua so với `giay_mst_don_vi` trong Cài đặt.

Nhà cung cấp AI chọn trong **Cài đặt → Cài đặt AI đọc hóa đơn** (OpenAI, Claude, Gemini, DeepSeek, Groq, Mistral, Grok, OpenRouter, Together, Fireworks, hoặc API ngoài tương thích OpenAI). Khóa lưu trong `cau_hinh.ai_hoa_don`; nếu trống thì dùng biến môi trường tương ứng. **Test API** và **Tìm model hiện có** gọi `GET /models` (Anthropic `/v1/models`, Gemini `/models`) trên bản nháp form, không lưu. Không có khóa hoặc tắt lớp AI thì vẫn điền được phần QR.

PDF hóa đơn được dựng bằng pdfjs legacy trên luồng chính (fake worker), không tải `file://` worker trong Next. Nếu dựng trang thất bại, cảnh báo kèm nguyên nhân đã lọc đường dẫn/khóa.

Tự thử trên máy (không cần Docker / OnlyOffice):

1. `TEST-HOA-DON.bat` — luôn khởi động lại web (`chay-dev.bat moi`) rồi mở http://localhost:3000. Đăng nhập admin → **Cài đặt → Cài đặt AI**: Test API, Tìm model hiện có. **Giao dịch → Thêm giao dịch** (Hoàn tạm ứng hoặc Cơ quan trả thẳng) → Đọc từ hóa đơn, chọn PDF.
2. `chay-test.bat nhanh` — TypeScript, vitest (dựng PDF/QR, Test API), kiểm tra giao diện Edge, build. Không mở web.
3. `CHAY-KIEM-TRA-DU-AN.bat` — chạy bộ test rồi mở `TEST-HOA-DON.bat`.
4. Test Word: `MO-WEB-TEST.bat` (cần Docker).

Khóa AI gõ trên form hoặc điền vào `.env.local` (xem `.env.example`). Không có khóa vẫn thử được lớp QR. Kết quả đọc chỉ là đề xuất — không ghi sổ cho đến khi bấm Lưu. Server cũ giữ lỗi “Không dựng được ảnh trang hóa đơn”: phải `moi` sau khi đổi `next.config.ts`.

Kiểm tra sau khi lưu (trùng số HĐ, tra cứu GDT, đọc XML) vẫn chạy nền như dự kiến dưới đây, chưa làm.

Chạy OCR ở tiến trình nền trên chính VPS, không chạy trực tiếp trong request vì có thể vượt thời gian chờ. Server Action chỉ tạo bản ghi trong bảng hàng đợi `viec_can_lam`; worker Node riêng do systemd quản lý nhặt việc mỗi phút, khóa việc bằng transaction PostgreSQL rồi ghi kết quả. Bảng hàng đợi đơn giản hơn và dễ gỡ lỗi hơn.

## 4. Cột đáng thêm khi làm

Chưa thêm bây giờ vì chưa dùng tới, nhưng đây là những cột sẽ cần:

```sql
alter table giao_dich
  add column mst_ban_hang    text,
  add column ten_ban_hang    text,
  add column kiem_tra_luc    timestamptz,
  add column phien_ban_kiem_tra text;

-- Bắt trùng hóa đơn ngay ở tầng database
create unique index gd_khong_trung_hd
  on giao_dich (ky_hieu_hd, so_hd)
  where not da_xoa and ky_hieu_hd is not null and so_hd is not null;
```

Index unique đó nên thêm **ngay từ lần này** nếu bạn muốn, không cần chờ tới phần kiểm tra hóa đơn — nó chặn nhập trùng hóa đơn từ đầu, và đó là lỗi tốn tiền thật. Chỗ cần lưu ý: những dòng không có hóa đơn (nhận tạm ứng, giao tiền chị Thúy, nộp hoàn) để trống hai cột này nên không bị index chạm tới, đúng như mong muốn.

Bảng hàng đợi khi làm chạy nền:

```sql
create table viec_can_lam (
  id           bigserial primary key,
  loai         text not null,          -- 'kiem_tra_hoa_don'
  tham_so      jsonb not null,
  trang_thai   text not null default 'cho',   -- cho / dang_chay / xong / loi
  so_lan_thu   int  not null default 0,
  loi_cuoi     text,
  tao_luc      timestamptz not null default now(),
  chay_luc     timestamptz
);

create index vcl_cho on viec_can_lam (trang_thai, tao_luc) where trang_thai = 'cho';
```

## 5. Những chỗ tôi chưa biết

Ghi ra để lần sau không phải đoán lại:

- Cổng tra cứu của Tổng cục Thuế có API dùng được hay không, và điều khoản có cho tự động truy vấn hay không. **Phải xác minh trước khi làm bước 3.**
- Cấu trúc XML thực tế của các nhà cung cấp hóa đơn mà đối tác của bạn dùng. Cần vài file XML thật để viết bộ đọc cho đúng — khi làm tới bước 1, gửi tôi 3–5 file mẫu từ các nhà cung cấp khác nhau.
- Ảnh đã nén ở [BAO-MAT-VA-PHAN-QUYEN.md](BAO-MAT-VA-PHAN-QUYEN.md#5-tải-file-lên) có còn đủ nét cho OCR không. Nếu không thì phải giữ bản gốc, đồng nghĩa cần dự trù thêm dung lượng ổ đĩa và backup.
- Có bao nhiêu phần trăm hóa đơn của bạn có bản XML. Con số này quyết định phần OCR là thiết yếu hay chỉ là phần thêm cho đẹp — và nó là câu hỏi đáng trả lời trước tiên, vì nếu hầu hết có XML thì bước 4 có thể bỏ hẳn.
