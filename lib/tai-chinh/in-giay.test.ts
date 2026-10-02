import { expect, it } from 'vitest'
import { giayCuaGiaoDich } from './in-giay'
import { CAU_HINH_GIAY_MAC_DINH, type BoiCanhGiay, type CanBo } from './giay'
import { HINH_THUC, type GiaoDichTinh } from './kieu'

const cb = (id: string, hoTen: string, chucDanh = 'Chuyên viên', phong: string | null = 'Phòng Kế hoạch'): CanBo => ({
  id, hoTen, chucDanh, phong, gioiTinh: null, laLanhDao: phong === null, dangHoatDong: true,
})
const nguoiDeNghiMacDinh = cb('default-proposer', 'Người đề nghị mặc định')
const nguoiDeNghiDaLuu = cb('saved-proposer', 'Người đề nghị đã lưu', 'Chuyên viên', 'Phòng Tổ chức')
const lanhDaoTkMacDinh = cb('default-tk', 'Lãnh đạo tiếp khách mặc định', 'Giám đốc', null)
const lanhDaoTtMacDinh = cb('default-tt', 'Lãnh đạo thanh toán mặc định', 'Phó Giám đốc', null)
const truongPhongMacDinh = cb('default-manager', 'Trưởng phòng mặc định', 'Trưởng phòng')
const keToanMacDinh = cb('default-accountant', 'Kế toán mặc định', 'Kế toán')
const lanhDaoTkDaLuu = cb('saved-tk', 'Lãnh đạo tiếp khách đã lưu', 'Giám đốc', null)
const lanhDaoTtDaLuu = cb('saved-tt', 'Lãnh đạo thanh toán đã lưu', 'Phó Giám đốc', null)
const truongPhongDaLuu = cb('saved-manager', 'Trưởng phòng đã lưu', 'Trưởng phòng', 'Phòng Tổ chức')
const keToanDaLuu = cb('saved-accountant', 'Kế toán đã lưu', 'Kế toán')

const context: BoiCanhGiay = {
  nguoiDeNghi: nguoiDeNghiMacDinh,
  canBo: [
    nguoiDeNghiMacDinh, nguoiDeNghiDaLuu, lanhDaoTkMacDinh, lanhDaoTtMacDinh, truongPhongMacDinh, keToanMacDinh,
    lanhDaoTkDaLuu, lanhDaoTtDaLuu, truongPhongDaLuu, keToanDaLuu,
  ],
  cauHinh: {
    ...CAU_HINH_GIAY_MAC_DINH,
    nguoiDeNghiId: nguoiDeNghiMacDinh.id,
    lanhDaoTiepKhachId: lanhDaoTkMacDinh.id,
    lanhDaoThanhToanId: lanhDaoTtMacDinh.id,
    truongPhongId: truongPhongMacDinh.id,
    keToanKiemSoatId: keToanMacDinh.id,
  },
  taiKhoanTheoNguoiLayHd: {},
}

const giaoDich = (ghiDe: Partial<GiaoDichTinh> = {}): GiaoDichTinh => ({
  id: '11111111-1111-4111-8111-111111111111', ngay: '2026-09-22', soThuTu: 1, taoLuc: '2026-09-22T00:00:00.000Z',
  noiDung: 'Tiếp khách', kyHieuHd: '1C26MTT', soHd: '000001', loaiHd: 'Hóa đơn Giá trị gia tăng', trangThaiHd: 'Hợp lệ',
  hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 2_000_000, tienRuouBia: 0, tienDuocThanhToan: 2_000_000,
  lamTronXuongHangNghin: false, tamUngTuCq: 0, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0,
  nguoiDeNghiId: nguoiDeNghiDaLuu.id, nguoiDeNghiTen: nguoiDeNghiDaLuu.hoTen,
  nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null, coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null,
  donViId: null, donViTen: 'Đơn vị thử', hinhThucThanhToan: 'hoan_tam_ung', taiKhoanNhan: null,
  coHoaDon: true, coChuyenKhoan: false, hoanTamUng: 2_000_000, cqTraThang: 0, phiLayHd: 0, duTienCqTraThang: 0, tongTienDuaChiThuy: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0, duHiepDangCam: 0,
  ...ghiDe,
})

it('ưu tiên đủ snapshot người ký của giao dịch hơn cấu hình chung', () => {
  const [tiepKhach, thanhToan] = giayCuaGiaoDich(giaoDich({
    thongTinGiayDaChot: true,
    nguoiDeNghiId: nguoiDeNghiDaLuu.id,
    lanhDaoTiepKhachId: lanhDaoTkDaLuu.id,
    lanhDaoThanhToanId: lanhDaoTtDaLuu.id,
    truongPhongId: truongPhongDaLuu.id,
    keToanKiemSoatId: keToanDaLuu.id,
  }), context)

  expect(tiepKhach.kinhGui).toContain(lanhDaoTkDaLuu.hoTen)
  expect(tiepKhach.chuKy[1][0].hoTen).toBe(nguoiDeNghiDaLuu.hoTen)
  expect(thanhToan.kinhGui).toContain(lanhDaoTtDaLuu.hoTen)
  expect(thanhToan.chuKy[1][0].hoTen).toBe(keToanDaLuu.hoTen)
  expect(thanhToan.chuKy[2][0].hoTen).toBe(nguoiDeNghiDaLuu.hoTen)
})

it('giữ người đề nghị cũ đã lưu nhưng fallback bốn vai trò chưa có snapshot', () => {
  const [tiepKhach, thanhToan] = giayCuaGiaoDich(giaoDich({
    thongTinGiayDaChot: false,
    nguoiDeNghiId: nguoiDeNghiDaLuu.id,
    lanhDaoTiepKhachId: null, lanhDaoThanhToanId: null, truongPhongId: null, keToanKiemSoatId: null,
  }), context)

  expect(tiepKhach.kinhGui).toContain(lanhDaoTkMacDinh.hoTen)
  expect(thanhToan.kinhGui).toContain(lanhDaoTtMacDinh.hoTen)
  expect(thanhToan.chuKy[1][0].hoTen).toBe(keToanMacDinh.hoTen)
  expect(thanhToan.chuKy[2][0].hoTen).toBe(nguoiDeNghiDaLuu.hoTen)
})
