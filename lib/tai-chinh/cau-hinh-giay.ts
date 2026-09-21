import { db } from '@/lib/db/pool'
import type { BoiCanhGiay, CanBo, CauHinhGiay } from './giay'
import { CAU_HINH_GIAY_MAC_DINH } from './giay'
import { TRANG_THAI_PHI } from './danh-muc'
import type { TaiKhoanNhan } from './kieu'
import { taiKhoanTu } from './tai-khoan'

// Cấu hình giấy đề nghị nằm trong bảng cau_hinh dưới dạng jsonb. Giá trị sai kiểu bị
// thay bằng mặc định thay vì làm hỏng cả trang in.
export const KHOA_CAU_HINH_GIAY = {
  tenDonVi: 'giay_ten_don_vi',
  tenMuaHangDonVi: 'giay_ten_mua_hang_don_vi',
  mstDonVi: 'giay_mst_don_vi',
  diaChiDonVi: 'giay_dia_chi_don_vi',
  diaDanh: 'giay_dia_danh',
  lyDoTamUng: 'giay_ly_do_tam_ung',
  thoiHanThanhToan: 'giay_thoi_han_thanh_toan',
  nguoiKyMacDinh: 'giay_nguoi_ky_mac_dinh',
  // Người lấy hóa đơn mặc định: tài khoản nhận tiền của người này được in khi giao dịch
  // chưa gắn người lấy hóa đơn nào.
  nguoiLayHdMacDinhId: 'giay_nguoi_lay_hd_mac_dinh',
  trangThaiTtPhiMacDinh: 'giay_trang_thai_tt_phi_mac_dinh',
} as const

// Năm vai trò ký trên giấy nằm trong vai-tro-ky.ts để biểu mẫu ở trình duyệt dùng chung
// danh sách mà không phải nạp theo mã truy cập cơ sở dữ liệu.
export { VAI_TRO_KY, type VaiTroKyId } from './vai-tro-ky'

const CHUOI_MAC_DINH: Record<string, string> = {
  [KHOA_CAU_HINH_GIAY.tenDonVi]: CAU_HINH_GIAY_MAC_DINH.tenDonVi,
  [KHOA_CAU_HINH_GIAY.tenMuaHangDonVi]: CAU_HINH_GIAY_MAC_DINH.tenMuaHangDonVi,
  [KHOA_CAU_HINH_GIAY.mstDonVi]: CAU_HINH_GIAY_MAC_DINH.mstDonVi,
  [KHOA_CAU_HINH_GIAY.diaChiDonVi]: CAU_HINH_GIAY_MAC_DINH.diaChiDonVi,
  [KHOA_CAU_HINH_GIAY.diaDanh]: CAU_HINH_GIAY_MAC_DINH.diaDanh,
  [KHOA_CAU_HINH_GIAY.lyDoTamUng]: CAU_HINH_GIAY_MAC_DINH.lyDoTamUng,
  [KHOA_CAU_HINH_GIAY.thoiHanThanhToan]: CAU_HINH_GIAY_MAC_DINH.thoiHanThanhToan,
}

function chuoi(giaTri: unknown, macDinh: string): string {
  return typeof giaTri === 'string' && giaTri.trim() ? giaTri.trim() : macDinh
}

// Mã cán bộ, hoặc null khi hàng cấu hình trống hay sai kiểu.
function maHoacNull(giaTri: unknown): string | null {
  return typeof giaTri === 'string' && giaTri ? giaTri : null
}

function trangThaiPhi(giaTri: unknown): string {
  return typeof giaTri === 'string' && (TRANG_THAI_PHI as readonly string[]).includes(giaTri)
    ? giaTri
    : CAU_HINH_GIAY_MAC_DINH.trangThaiTtPhiMacDinh
}

export function docCauHinhGiayTu(rows: readonly { khoa: string; gia_tri: unknown }[]): CauHinhGiay {
  const bang = new Map(rows.map(r => [r.khoa, r.gia_tri]))
  const nguoiKy = bang.get(KHOA_CAU_HINH_GIAY.nguoiKyMacDinh)
  const ky: Record<string, unknown> = typeof nguoiKy === 'object' && nguoiKy !== null && !Array.isArray(nguoiKy)
    ? nguoiKy as Record<string, unknown>
    : {}
  return {
    nguoiDeNghiId: maHoacNull(ky.nguoiDeNghiId),
    lanhDaoTiepKhachId: maHoacNull(ky.lanhDaoTiepKhachId),
    lanhDaoThanhToanId: maHoacNull(ky.lanhDaoThanhToanId),
    truongPhongId: maHoacNull(ky.truongPhongId),
    keToanKiemSoatId: maHoacNull(ky.keToanKiemSoatId),
    tenDonVi: chuoi(bang.get(KHOA_CAU_HINH_GIAY.tenDonVi), CAU_HINH_GIAY_MAC_DINH.tenDonVi),
    tenMuaHangDonVi: chuoi(bang.get(KHOA_CAU_HINH_GIAY.tenMuaHangDonVi), CAU_HINH_GIAY_MAC_DINH.tenMuaHangDonVi),
    mstDonVi: chuoi(bang.get(KHOA_CAU_HINH_GIAY.mstDonVi), CAU_HINH_GIAY_MAC_DINH.mstDonVi).replace(/[\s.\-]/g, ''),
    diaChiDonVi: chuoi(bang.get(KHOA_CAU_HINH_GIAY.diaChiDonVi), CAU_HINH_GIAY_MAC_DINH.diaChiDonVi),
    diaDanh: chuoi(bang.get(KHOA_CAU_HINH_GIAY.diaDanh), CAU_HINH_GIAY_MAC_DINH.diaDanh),
    lyDoTamUng: chuoi(bang.get(KHOA_CAU_HINH_GIAY.lyDoTamUng), CAU_HINH_GIAY_MAC_DINH.lyDoTamUng),
    thoiHanThanhToan: chuoi(bang.get(KHOA_CAU_HINH_GIAY.thoiHanThanhToan), CAU_HINH_GIAY_MAC_DINH.thoiHanThanhToan),
    nguoiLayHdMacDinhId: maHoacNull(bang.get(KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId)),
    trangThaiTtPhiMacDinh: trangThaiPhi(bang.get(KHOA_CAU_HINH_GIAY.trangThaiTtPhiMacDinh)),
  }
}

const DS_KHOA = Object.values(KHOA_CAU_HINH_GIAY)

export async function docCauHinhGiay(): Promise<CauHinhGiay> {
  const { rows } = await db.query<{ khoa: string; gia_tri: unknown }>(
    'select khoa, gia_tri from cau_hinh where khoa = any($1)', [[...DS_KHOA]])
  return docCauHinhGiayTu(rows)
}

// Cán bộ đang hoạt động, kèm tài khoản gắn với họ để suy ra phòng của người đề nghị.
export async function docCanBo(): Promise<CanBo[]> {
  const { rows } = await db.query<{
    id: string; ho_ten: string; gioi_tinh: string | null; chuc_danh: string | null
    phong: string | null; la_lanh_dao: boolean; dang_hoat_dong: boolean
  }>('select id, ho_ten, gioi_tinh, chuc_danh, phong, la_lanh_dao, dang_hoat_dong from can_bo order by ho_ten')
  return rows.map(r => ({
    id: r.id, hoTen: r.ho_ten, gioiTinh: r.gioi_tinh, chucDanh: r.chuc_danh, phong: r.phong,
    laLanhDao: r.la_lanh_dao, dangHoatDong: r.dang_hoat_dong,
  }))
}

// Cán bộ gắn với tài khoản đang đăng nhập. Không có thì trả về null và nơi gọi tự quyết
// định lấy cán bộ mặc định trong cấu hình.
export async function canBoCuaTaiKhoan(nguoiDungId: string): Promise<CanBo | null> {
  const { rows } = await db.query<{
    id: string; ho_ten: string; gioi_tinh: string | null; chuc_danh: string | null
    phong: string | null; la_lanh_dao: boolean; dang_hoat_dong: boolean
  }>('select id, ho_ten, gioi_tinh, chuc_danh, phong, la_lanh_dao, dang_hoat_dong from can_bo where nguoi_dung_id=$1', [nguoiDungId])
  const r = rows[0]
  return r ? {
    id: r.id, hoTen: r.ho_ten, gioiTinh: r.gioi_tinh, chucDanh: r.chuc_danh, phong: r.phong,
    laLanhDao: r.la_lanh_dao, dangHoatDong: r.dang_hoat_dong,
  } : null
}

// Tài khoản nhận tiền của mọi người lấy hóa đơn đang hoạt động. Một tài khoản phục vụ
// cả hai việc — nhận tiền thanh toán và trả phí lấy hóa đơn — nên giấy in và phần tính
// phí cùng đọc từ bảng nguoi_lay_hd, không có nguồn thứ hai để lệch.
export async function docTaiKhoanNhan(): Promise<Record<string, TaiKhoanNhan>> {
  const { rows } = await db.query<{
    id: string; so_tai_khoan: string | null; ngan_hang_bin: string | null
    ten_ngan_hang: string | null; ten_chu_tk: string | null; chi_nhanh: string | null; can_bo_id: string | null
  }>('select id, so_tai_khoan, ngan_hang_bin, ten_ngan_hang, ten_chu_tk, chi_nhanh, can_bo_id from nguoi_lay_hd where dang_hoat_dong')
  const bang: Record<string, TaiKhoanNhan> = {}
  for (const r of rows) {
    const tk = taiKhoanTu(r)
    if (tk) bang[r.id] = tk
  }
  return bang
}

// Bối cảnh in giấy cho tài khoản đang đăng nhập: người đề nghị là cán bộ gắn với tài
// khoản; tài khoản chưa gắn cán bộ thì lấy cán bộ mặc định trong cấu hình, cuối cùng
// mới dùng chính tên tài khoản để giấy không bị trống người đề nghị.
export async function boiCanhGiay(phien: { id: string; ho_ten: string }): Promise<BoiCanhGiay> {
  const [canBo, cauHinh, cuaTaiKhoan, taiKhoanTheoNguoiLayHd] = await Promise.all([
    docCanBo(), docCauHinhGiay(), canBoCuaTaiKhoan(phien.id), docTaiKhoanNhan(),
  ])
  const nguoiDeNghi = cuaTaiKhoan ?? canBo.find(cb => cb.id === cauHinh.nguoiDeNghiId) ?? {
    id: phien.id, hoTen: phien.ho_ten, gioiTinh: null, chucDanh: null, phong: null,
    laLanhDao: false, dangHoatDong: true,
  }
  return { nguoiDeNghi, canBo, cauHinh, taiKhoanTheoNguoiLayHd }
}
