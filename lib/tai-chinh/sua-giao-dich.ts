import { LOAI_HD, TRANG_THAI_HD, TRANG_THAI_PHI } from './danh-muc'
import { DS_HINH_THUC_THANH_TOAN, dsHinhThucThanhToan } from './hinh-thuc'
import { HINH_THUC, type GiaoDichTinh } from './kieu'

// Sửa giao dịch chỉ cho đổi MỘT trường mỗi lần lưu. Lý do: mỗi nhóm trường dưới đây
// đều đổ vào cùng một chuỗi tính toán (phí -> dư thực tế -> đang cầm). Đổi nhiều
// trường trong cùng một nhóm thì không truy vết được trường nào làm lệch số dư.
// Tên cột nằm trong danh sách trắng này, không bao giờ lấy từ client.
export const NHOM_SUA = [
  { id: 'ngayPhatSinh', ten: 'Ngày phát sinh', moTa: 'Ngày quyết định vị trí của giao dịch trong chuỗi số dư, nên đổi ngày sẽ tính lại số dư của các dòng liên quan.' },
  { id: 'chungTu', ten: 'Chứng từ', moTa: 'Trạng thái hóa đơn quyết định khoản tiền có được tính hay không.' },
  { id: 'tienHd', ten: 'Tiền hóa đơn & phí', moTa: 'Phí mặc định bằng tổng tiền nhân tỷ lệ của người lấy HĐ, nên các trường này phụ thuộc nhau.' },
  { id: 'dongTien', ten: 'Dòng tiền', moTa: 'Mỗi khoản chỉ thuộc một hình thức; cả ba cùng cộng vào một số dư.' },
  { id: 'giay', ten: 'Giấy đề nghị', moTa: 'Chữ in thêm trên giấy đề nghị; không ảnh hưởng tới số dư.' },
  { id: 'donVi', ten: 'Đơn vị tiếp khách', moTa: 'Nội dung được sinh tự động từ tên đơn vị.' },
  { id: 'ghiChu', ten: 'Ghi chú', moTa: 'Không ảnh hưởng tới số dư.' },
] as const

export type NhomSuaId = typeof NHOM_SUA[number]['id']
export type KieuTruong = 'chuoi' | 'tien' | 'lua-chon' | 'ngay'

const HD_CO_DON_VI = [HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VAI_TRO_SUA = ['admin', 'nhap_lieu'] as const
// Ngày phải là ngày dương lịch có thật: 2026-02-30 đúng định dạng nhưng không tồn tại,
// và PostgreSQL sẽ từ chối bằng một lỗi khó hiểu nếu ta để nó đi tới câu lệnh SQL.
const NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const NAM_NHO_NHAT = 1900
const NAM_LON_NHAT = 2999

export type TruongSua = {
  id: string
  ten: string
  nhom: NhomSuaId
  vaiTro: 'nhap_lieu' | 'admin'
  kieu: KieuTruong
  // Chỉ những hình thức này mới có trường đó. Ví dụ tạm ứng từ cơ quan chỉ có ở
  // hình thức "Tạm ứng thêm"; nhật ký không được phép sửa trường không tồn tại.
  hinhThuc?: readonly string[]
  luaChon?: readonly string[]
  max?: number
  choPhepRong?: boolean
  goiY?: string
  // Trường khóa ngoại: kiểm tra dạng UUID ngay tại đây để giá trị giả không đi tới
  // câu lệnh SQL (PostgreSQL sẽ báo lỗi khó hiểu nếu so sánh uuid với chuỗi lạ).
  dinhDang?: 'uuid'
}

export const TRUONG_SUA: readonly TruongSua[] = [
  // Ngày nằm cùng nhóm với người nhập dữ liệu vì form thêm giao dịch cũng do vai trò
  // này chọn ngày; sửa lại ngày gõ nhầm là việc sửa sai sót, không phải đổi số tiền.
  { id: 'ngay', ten: 'Ngày phát sinh', nhom: 'ngayPhatSinh', vaiTro: 'nhap_lieu', kieu: 'ngay', goiY: 'Giao dịch được xếp vào cuối ngày mới, nên số dư của các dòng liên quan được tính lại.' },

  { id: 'ky_hieu_hd', ten: 'Ký hiệu hóa đơn', nhom: 'chungTu', vaiTro: 'nhap_lieu', kieu: 'chuoi', max: 50, choPhepRong: true },
  { id: 'so_hd', ten: 'Số hóa đơn', nhom: 'chungTu', vaiTro: 'nhap_lieu', kieu: 'chuoi', max: 50, choPhepRong: true },
  { id: 'loai_hd', ten: 'Loại chứng từ', nhom: 'chungTu', vaiTro: 'nhap_lieu', kieu: 'lua-chon', luaChon: LOAI_HD, choPhepRong: true },
  { id: 'trang_thai_hd', ten: 'Trạng thái hóa đơn', nhom: 'chungTu', vaiTro: 'nhap_lieu', kieu: 'lua-chon', luaChon: TRANG_THAI_HD },

  { id: 'tong_tien', ten: 'Tổng tiền', nhom: 'tienHd', vaiTro: 'admin', kieu: 'tien', hinhThuc: HD_CO_DON_VI },
  { id: 'tien_ruou_bia', ten: 'Tiền rượu bia loại trừ', nhom: 'tienHd', vaiTro: 'admin', kieu: 'tien', hinhThuc: HD_CO_DON_VI },
  { id: 'nguoi_lay_hd_id', ten: 'Người lấy hóa đơn', nhom: 'tienHd', vaiTro: 'admin', kieu: 'lua-chon', choPhepRong: true, hinhThuc: HD_CO_DON_VI, dinhDang: 'uuid' },
  { id: 'phi_lay_hd_ghi_de', ten: 'Phí ghi đè', nhom: 'tienHd', vaiTro: 'admin', kieu: 'tien', choPhepRong: true, hinhThuc: HD_CO_DON_VI, goiY: 'Để trống nghĩa là dùng tỷ lệ phí của người lấy HĐ.' },
  { id: 'trang_thai_tt_phi', ten: 'Trạng thái thanh toán phí', nhom: 'tienHd', vaiTro: 'admin', kieu: 'lua-chon', luaChon: TRANG_THAI_PHI, hinhThuc: HD_CO_DON_VI },

  { id: 'tam_ung_tu_cq', ten: 'Tạm ứng từ cơ quan', nhom: 'dongTien', vaiTro: 'admin', kieu: 'tien', hinhThuc: [HINH_THUC.TAM_UNG_THEM] },
  { id: 'giao_tien_chi_thuy', ten: 'Giao tiền chị Thúy', nhom: 'dongTien', vaiTro: 'admin', kieu: 'tien', hinhThuc: [HINH_THUC.GIAO_CHI_THUY] },
  { id: 'hoan_ung_tien_mat', ten: 'Nộp lại tiền mặt', nhom: 'dongTien', vaiTro: 'admin', kieu: 'tien', hinhThuc: [HINH_THUC.NOP_HOAN_CQ] },

  { id: 'don_vi_id', ten: 'Đơn vị tiếp khách', nhom: 'donVi', vaiTro: 'nhap_lieu', kieu: 'lua-chon', hinhThuc: HD_CO_DON_VI, dinhDang: 'uuid', goiY: 'Lưu đơn vị sẽ cập nhật luôn Nội dung cho khớp.' },
  { id: 'hinh_thuc_thanh_toan', ten: 'Hình thức thanh toán', nhom: 'giay', vaiTro: 'nhap_lieu', kieu: 'lua-chon', luaChon: DS_HINH_THUC_THANH_TOAN, choPhepRong: true, goiY: 'Tiền mặt, chuyển khoản hoặc hoàn tạm ứng — tùy hình thức giao dịch. Chỉ đổi chữ in trên giấy đề nghị.' },
  { id: 'ghi_chu', ten: 'Ghi chú', nhom: 'ghiChu', vaiTro: 'nhap_lieu', kieu: 'chuoi', max: 2000, choPhepRong: true },
]

export function apDungChoHinhThuc(truong: TruongSua, hinhThuc: string): boolean {
  // Hình thức thanh toán có ở ba hình thức lập giấy, nhưng mỗi hình thức chỉ dùng một
  // phần giá trị, nên phải hỏi miền nghiệp vụ thay vì so với một danh sách tĩnh.
  if (truong.id === 'hinh_thuc_thanh_toan') return dsHinhThucThanhToan(hinhThuc).length > 0
  return !truong.hinhThuc || truong.hinhThuc.includes(hinhThuc)
}

// Danh sách trường mà vai trò này được phép sửa, trên đúng giao dịch đang mở.
// chi_doc không nằm trong danh sách nên không thấy trường nào, dù giao diện có bị sửa.
export function truongSuaCho(vaiTro: string, hinhThuc: string): TruongSua[] {
  if (!VAI_TRO_SUA.includes(vaiTro as typeof VAI_TRO_SUA[number])) return []
  return TRUONG_SUA.filter(t => (t.vaiTro === 'nhap_lieu' || vaiTro === 'admin') && apDungChoHinhThuc(t, hinhThuc))
}

export function timTruongSua(id: unknown): TruongSua | undefined {
  return typeof id === 'string' ? TRUONG_SUA.find(t => t.id === id) : undefined
}

// Giá trị đang có của một trường, dùng để điền sẵn vào ô nhập.
export function giaTriHienTai(row: GiaoDichTinh, id: string): string {
  switch (id) {
    case 'ngay': return row.ngay
    case 'ky_hieu_hd': return row.kyHieuHd ?? ''
    case 'so_hd': return row.soHd ?? ''
    case 'loai_hd': return row.loaiHd ?? ''
    case 'trang_thai_hd': return row.trangThaiHd
    case 'tong_tien': return String(row.tongTien)
    case 'tien_ruou_bia': return String(row.tienRuouBia)
    case 'nguoi_lay_hd_id': return row.nguoiLayHdId ?? ''
    case 'phi_lay_hd_ghi_de': return row.phiLayHdGhiDe === null ? '' : String(row.phiLayHdGhiDe)
    case 'trang_thai_tt_phi': return row.trangThaiTtPhi
    case 'tam_ung_tu_cq': return String(row.tamUngTuCq)
    case 'giao_tien_chi_thuy': return String(row.giaoTienChiThuy)
    case 'hoan_ung_tien_mat': return String(row.hoanUngTienMat)
    case 'don_vi_id': return row.donViId ?? ''
    case 'hinh_thuc_thanh_toan': return row.hinhThucThanhToan ?? ''
    case 'ghi_chu': return row.ghiChu ?? ''
    default: return ''
  }
}

export type KetQuaChuanHoa = { ok: true; giaTri: string | number | null } | { ok: false; loi: string }

// Chuẩn hóa giá trị người dùng nhập cho đúng một trường. Hàm thuần để test được
// mà không cần database.
export function chuanHoaGiaTri(truong: TruongSua, raw: unknown): KetQuaChuanHoa {
  const chuoi = typeof raw === 'string' ? raw : raw === null || raw === undefined ? '' : String(raw)
  if (truong.kieu === 'tien') {
    const gon = chuoi.replace(/[\s.,]/g, '')
    if (!gon) return truong.choPhepRong ? { ok: true, giaTri: null } : { ok: true, giaTri: 0 }
    if (!/^\d+$/.test(gon)) return { ok: false, loi: `${truong.ten} phải là số tiền không âm.` }
    const so = Number(gon)
    if (!Number.isSafeInteger(so)) return { ok: false, loi: `${truong.ten} vượt giới hạn an toàn.` }
    return { ok: true, giaTri: so }
  }
  const giaTri = chuoi.trim()
  if (!giaTri) {
    return truong.choPhepRong ? { ok: true, giaTri: null } : { ok: false, loi: `${truong.ten} không được để trống.` }
  }
  if (truong.kieu === 'ngay') {
    const khop = NGAY_ISO.exec(giaTri)
    if (!khop) return { ok: false, loi: `${truong.ten} phải theo dạng Năm-Tháng-Ngày.` }
    const [, nam, thang, ngay] = khop
    const soNam = Number(nam), soThang = Number(thang), soNgay = Number(ngay)
    const kiemTra = new Date(Date.UTC(soNam, soThang - 1, soNgay))
    if (kiemTra.getUTCFullYear() !== soNam || kiemTra.getUTCMonth() !== soThang - 1 || kiemTra.getUTCDate() !== soNgay) {
      return { ok: false, loi: `${truong.ten} không phải là một ngày có thật.` }
    }
    if (soNam < NAM_NHO_NHAT || soNam > NAM_LON_NHAT) {
      return { ok: false, loi: `${truong.ten} phải nằm trong khoảng ${NAM_NHO_NHAT}–${NAM_LON_NHAT}.` }
    }
    return { ok: true, giaTri }
  }
  if (truong.kieu === 'lua-chon' && truong.luaChon && !truong.luaChon.includes(giaTri)) {
    return { ok: false, loi: `${truong.ten} không nằm trong danh sách cho phép.` }
  }
  if (truong.dinhDang === 'uuid' && !UUID.test(giaTri)) return { ok: false, loi: `${truong.ten} không hợp lệ.` }
  if (truong.max && giaTri.length > truong.max) return { ok: false, loi: `${truong.ten} tối đa ${truong.max} ký tự.` }
  return { ok: true, giaTri }
}
