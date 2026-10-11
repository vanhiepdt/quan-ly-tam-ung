// Lịch sử sửa của một giao dịch, dựng lại từ bảng lich_su mà trigger ghi_lich_su()
// ghi trên mỗi lần insert/update/delete. Phần so sánh ở đây là hàm thuần, không
// chạm database, để test được toàn bộ cách hiển thị mà không cần PostgreSQL.

export const TRONG = '—'

// Tên cột trong bảng giao_dich, dùng cho lịch sử. Không dùng chung nhãn với cột
// nhật ký vì hai danh sách phục vụ hai việc khác nhau và có thể lệch nhau.
const NHAN_COT: Record<string, string> = {
  ngay: 'Ngày phát sinh',
  so_thu_tu: 'Số thứ tự trong ngày',
  noi_dung: 'Nội dung',
  don_vi_id: 'Đơn vị tiếp khách',
  ky_hieu_hd: 'Ký hiệu hóa đơn',
  so_hd: 'Số hóa đơn',
  loai_hd: 'Loại chứng từ',
  trang_thai_hd: 'Trạng thái hóa đơn',
  hinh_thuc: 'Hình thức',
  chi_thuc_te: 'Chi thực tế',
  tong_tien: 'Tổng tiền',
  tien_ruou_bia: 'Tiền không được thanh toán',
  tam_ung_tu_cq: 'Tạm ứng từ cơ quan',
  giao_tien_chi_thuy: 'Giao tiền TƯ cho Chị Thúy',
  dua_tien_cq_tra_thang_cho_chi_thuy: 'Đưa tiền CQ trả thẳng cho Chị Thúy',
  hoan_ung_tien_mat: 'Nộp lại tiền mặt',
  nguoi_de_nghi_id: 'Người đề nghị',
  lanh_dao_tiep_khach_id: 'Lãnh đạo duyệt giấy tiếp khách',
  lanh_dao_thanh_toan_id: 'Lãnh đạo duyệt giấy thanh toán',
  truong_phong_id: 'Trưởng phòng',
  ke_toan_kiem_soat_id: 'Kế toán kiểm soát',
  nguoi_lay_hd_id: 'Người lấy hóa đơn',
  phi_lay_hd_ghi_de: 'Phí ghi đè',
  co_so_tinh_phi_lay_hd: 'Cơ sở tính phí hóa đơn',
  trang_thai_tt_phi: 'Trạng thái thanh toán phí',
  hinh_thuc_thanh_toan: 'Hình thức thanh toán',
  ghi_chu: 'Ghi chú',
  da_xoa: 'Đã xóa',
  nguoi_tao: 'Người tạo',
  nguoi_sua: 'Người sửa',
  nguoi_xoa: 'Người xóa',
  xoa_luc: 'Lúc xóa',
}

// Cột tiền: hiển thị theo định dạng tiền Việt Nam thay vì chuỗi số thô.
const COT_TIEN = new Set([
  'tong_tien', 'tien_ruou_bia', 'tam_ung_tu_cq', 'giao_tien_chi_thuy', 'dua_tien_cq_tra_thang_cho_chi_thuy',
  'hoan_ung_tien_mat', 'phi_lay_hd_ghi_de',
])
// Cột mốc thời gian tự đổi mỗi lần ghi nên không phải là nội dung người dùng sửa.
// Người thao tác đã hiển thị riêng ở đầu mỗi mục, không lặp lại trong bảng thay đổi.
const COT_BO_QUA = new Set([
  'id', 'tao_luc', 'sua_luc', 'nguoi_tao', 'nguoi_sua',
  'trang_thai_kiem_tra', 'ket_qua_kiem_tra', 'thong_tin_giay_da_chot',
])
// Lần tạo giao dịch không có giá trị cũ để so, nên chỉ tóm tắt các cột cốt lõi.
const COT_TOM_TAT_TAO = ['ngay', 'noi_dung', 'don_vi_id', 'so_hd', 'hinh_thuc', 'chi_thuc_te', 'trang_thai_hd', 'tong_tien']

export type BoCanh = {
  donVi: Record<string, string>
  nguoiLayHd: Record<string, string>
  canBo?: Record<string, string>
  nguoiDung: Record<string, string>
}

export const boCanhRong = (): BoCanh => ({ donVi: {}, nguoiLayHd: {}, canBo: {}, nguoiDung: {} })

export type ThayDoiCot = { cot: string; nhan: string; cu: string; moi: string }
export type MucLichSu = {
  id: number
  hanhDong: string
  tomTat: string
  nguoi: string
  luc: string
  thayDoi: ThayDoiCot[]
}

export const nhanCot = (cot: string) => NHAN_COT[cot] ?? cot

// Khóa kỹ thuật của jsonb không phải dữ liệu người dùng nhập.
const laCotDuLieu = (cot: string) => !cot.startsWith('__') && !COT_BO_QUA.has(cot)

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const dinhDangThoiDiem = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

const rut = (id: string) => `${id.slice(0, 8)}…`

function hienThiChuoi(giaTri: unknown): string {
  return typeof giaTri === 'string' ? giaTri : JSON.stringify(giaTri) ?? String(giaTri)
}

// Một giá trị trong jsonb lịch sử được đổi sang chuỗi người đọc được. Khóa ngoại
// được tra sang tên; nếu bản ghi đã bị xóa cứng thì lùi về mã rút gọn thay vì
// hiện một uuid trần.
export function hienThiGiaTri(cot: string, giaTri: unknown, boCanh: BoCanh = boCanhRong()): string {
  if (giaTri === null || giaTri === undefined || giaTri === '') return TRONG
  if (COT_TIEN.has(cot)) {
    const so = Number(giaTri)
    return Number.isSafeInteger(so) ? vnd.format(so) : hienThiChuoi(giaTri)
  }
  if (cot === 'da_xoa' || cot === 'chi_thuc_te') return giaTri === true ? 'Có' : 'Không'
  if (cot === 'co_so_tinh_phi_lay_hd') return giaTri === 'tien_duoc_thanh_toan' ? 'Tiền được hoàn/thanh toán' : 'Tổng tiền'
  const khoa = String(giaTri)
  if (cot === 'don_vi_id') return boCanh.donVi[khoa] ?? rut(khoa)
  if (cot === 'nguoi_lay_hd_id') return boCanh.nguoiLayHd[khoa] ?? rut(khoa)
  if (['nguoi_de_nghi_id', 'lanh_dao_tiep_khach_id', 'lanh_dao_thanh_toan_id', 'truong_phong_id', 'ke_toan_kiem_soat_id'].includes(cot)) {
    return boCanh.canBo?.[khoa] ?? rut(khoa)
  }
  if (cot === 'nguoi_tao' || cot === 'nguoi_sua' || cot === 'nguoi_xoa') return boCanh.nguoiDung[khoa] ?? rut(khoa)
  return hienThiChuoi(giaTri)
}

export function dinhDangLuc(iso: string): string {
  const ngay = new Date(iso)
  return Number.isNaN(ngay.getTime()) ? iso : dinhDangThoiDiem.format(ngay)
}

function bangNhau(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

// Danh sách cột thực sự đổi giá trị giữa hai phiên bản của cùng một dòng. So sánh
// bằng jsonb đã chuẩn hóa nên thứ tự khóa không ảnh hưởng kết quả.
export function soSanhThayDoi(
  cu: Record<string, unknown> | null, moi: Record<string, unknown> | null, boCanh: BoCanh = boCanhRong(),
): ThayDoiCot[] {
  if (!moi) return []
  if (!cu) {
    return COT_TOM_TAT_TAO
      .filter(cot => moi[cot] !== null && moi[cot] !== undefined && moi[cot] !== '')
      .map(cot => ({ cot, nhan: nhanCot(cot), cu: TRONG, moi: hienThiGiaTri(cot, moi[cot], boCanh) }))
  }
  return Object.keys(moi)
    .filter(laCotDuLieu)
    .filter(cot => !bangNhau(cu[cot], moi[cot]))
    .sort((a, b) => Object.keys(NHAN_COT).indexOf(a) - Object.keys(NHAN_COT).indexOf(b))
    .map(cot => ({
      cot, nhan: nhanCot(cot),
      cu: hienThiGiaTri(cot, cu[cot], boCanh),
      moi: hienThiGiaTri(cot, moi[cot], boCanh),
    }))
}

// Xóa mềm là một UPDATE đặt da_xoa=true, nên phải đọc ý nghĩa từ chính thay đổi
// đó chứ không chỉ từ tg_op của trigger.
export function tomTatHanhDong(hanhDong: string, cu: Record<string, unknown> | null, moi: Record<string, unknown> | null): string {
  if (hanhDong === 'INSERT') return 'Tạo giao dịch'
  if (hanhDong === 'DELETE') return 'Xóa vĩnh viễn'
  if (cu?.da_xoa !== true && moi?.da_xoa === true) return 'Xóa giao dịch'
  if (cu?.da_xoa === true && moi?.da_xoa === false) return 'Khôi phục giao dịch'
  return 'Sửa giao dịch'
}

// Bản ghi do trigger cũ hoặc thao tác ngoài ứng dụng có thể thiếu người thực hiện.
export const tenNguoiThucHien = (hoTen: string | null, tenDangNhap: string | null) =>
  hoTen?.trim() || tenDangNhap?.trim() || 'Không xác định'

export function dungMucLichSu(
  dong: { id: string | number; hanh_dong: string; tao_luc: unknown; ho_ten: string | null; ten_dang_nhap: string | null; gia_tri_cu: unknown; gia_tri_moi: unknown },
  boCanh: BoCanh,
): MucLichSu {
  const cu = (dong.gia_tri_cu ?? null) as Record<string, unknown> | null
  const moi = (dong.gia_tri_moi ?? null) as Record<string, unknown> | null
  return {
    id: Number(dong.id),
    hanhDong: dong.hanh_dong,
    tomTat: tomTatHanhDong(dong.hanh_dong, cu, moi),
    nguoi: tenNguoiThucHien(dong.ho_ten, dong.ten_dang_nhap),
    luc: new Date(String(dong.tao_luc)).toISOString(),
    thayDoi: soSanhThayDoi(cu, moi, boCanh),
  }
}

// Gom mọi mã tham chiếu xuất hiện trong lịch sử để tra tên một lần duy nhất.
export function gomMaThamChieu(cacDong: ReadonlyArray<{ gia_tri_cu: unknown; gia_tri_moi: unknown }>) {
  const donVi = new Set<string>(), nguoiLayHd = new Set<string>(), canBo = new Set<string>(), nguoiDung = new Set<string>()
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  for (const dong of cacDong) {
    for (const ban of [dong.gia_tri_cu, dong.gia_tri_moi]) {
      if (!ban || typeof ban !== 'object') continue
      const ban2 = ban as Record<string, unknown>
      const lay = (cot: string, dich: Set<string>) => {
        const giaTri = ban2[cot]
        if (typeof giaTri === 'string' && UUID.test(giaTri)) dich.add(giaTri)
      }
      lay('don_vi_id', donVi); lay('nguoi_lay_hd_id', nguoiLayHd)
      lay('nguoi_de_nghi_id', canBo); lay('lanh_dao_tiep_khach_id', canBo)
      lay('lanh_dao_thanh_toan_id', canBo); lay('truong_phong_id', canBo); lay('ke_toan_kiem_soat_id', canBo)
      lay('nguoi_tao', nguoiDung); lay('nguoi_sua', nguoiDung); lay('nguoi_xoa', nguoiDung)
    }
  }
  return { donVi: [...donVi], nguoiLayHd: [...nguoiLayHd], canBo: [...canBo], nguoiDung: [...nguoiDung] }
}
