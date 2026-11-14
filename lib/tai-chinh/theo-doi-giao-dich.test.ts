import { describe, expect, it } from 'vitest'
import { HINH_THUC, NGUON_BU, TRANG_THAI, type GiaoDichTinh } from './kieu'
import { nhanHinhThuc, taoDuLieuTheoDoi } from './theo-doi-giao-dich'

const row = (overrides: Partial<GiaoDichTinh> = {}): GiaoDichTinh => ({
  id: 'id', ngay: '2026-11-12', soThuTu: 1, taoLuc: '2026-11-12T00:00:00.000Z', noiDung: 'Nội dung',
  kyHieuHd: null, soHd: null, loaiHd: null, trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.TAM_UNG_THEM,
  tongTien: 0, tienRuouBia: 0, tamUngTuCq: 0, giaoTienChiThuy: 0, hoanUngTienMat: 0,
  duaTienCqTraThangChoChiThuy: 0, tienDuocThanhToan: null, tienDuocThanhToanGoc: null, lamTronXuongHangNghin: false,
  nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: null,
  hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duTienCqTraThang: 0, duChiTiepKhachThucTe: 0,
  layQuyChiThuy: 0, tongLayQuyChiThuy: 0, tongTienDuaChiThuy: 0, duLyThuyet: 0, duThucTe: 0,
  duDangCam: 0, duHiepDangCam: 0, ...overrides,
})

describe('theo dõi giao dịch', () => {
  it.each([
    [HINH_THUC.TAM_UNG_THEM, 'Tạm ứng từ cơ quan', 100],
    [HINH_THUC.GIAO_CHI_THUY, 'Tiền giao cho Chị Thúy', 200],
    [HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY, 'Tiền đưa cho Chị Thúy', 300],
    [HINH_THUC.HOAN_TAM_UNG, 'Tiền ghi nhận hoàn ứng', 400],
    [HINH_THUC.CQ_TRA_THANG, 'Tiền ghi nhận CQ trả thẳng', 500],
    [HINH_THUC.NOP_HOAN_CQ, 'Tiền nộp hoàn', 600],
  ])('diễn giải %s từ đúng giá trị', (hinhThuc, nhan, tien) => {
    const rowOverrides: Partial<GiaoDichTinh> = { hinhThuc, tamUngTuCq: 100, giaoTienChiThuy: 200, duaTienCqTraThangChoChiThuy: 300, hoanTamUng: 400, cqTraThang: 500, hoanUngTienMat: 600 }
    const result = taoDuLieuTheoDoi([row(rowOverrides)])[0]
    expect(result.nhanSoTienChinh).toBe(nhan)
    expect(result.soTienChinh).toBe(tien)
  })

  it('tạo số dư trước/sau theo thứ tự đầu vào, không phụ thuộc bộ lọc', () => {
    const result = taoDuLieuTheoDoi([
      row({ id: 'a', tamUngTuCq: 1_000_000, duLyThuyet: 1_000_000, duThucTe: 1_000_000 }),
      row({ id: 'b', hinhThuc: HINH_THUC.HOAN_TAM_UNG, hoanTamUng: 200_000, duLyThuyet: 800_000, duThucTe: 800_000 }),
    ])
    expect(result[0].bienDongSoDu.find(s => s.id === 'duLyThuyet')).toMatchObject({ truoc: 0, thayDoi: 1_000_000, sau: 1_000_000 })
    expect(result[1].bienDongSoDu.find(s => s.id === 'duLyThuyet')).toMatchObject({ truoc: 1_000_000, thayDoi: -200_000, sau: 800_000 })
  })

  it('giữ trạng thái hóa đơn, phí, hồ sơ và nguồn bù độc lập', () => {
    const result = taoDuLieuTheoDoi([row({ trangThaiHd: 'Không hợp lệ', trangThaiTtPhi: 'Chưa thanh toán', coHoaDon: true, chiThucTe: true, nguonBuChiThucTe: NGUON_BU.TU_CHIU })])[0]
    expect(result.trangThaiHd).toBe('Không hợp lệ')
    expect(result.trangThaiTtPhi).toBe('Chưa thanh toán')
    expect(result.hoSo.coHoaDon).toBe(true)
    expect(result.nguonBuChiThucTeNhan).toBe('Tự chịu')
    expect(result.dongCanhBao).toContain('Hóa đơn chưa được tính vào khoản hoàn/thanh toán.')
  })

  it('có nhãn mô tả rõ ràng cho hình thức chưa biết', () => {
    expect(nhanHinhThuc('Khác')).toEqual({ nhanNgan: 'Khác', moTa: 'Khác', nhanSoTienChinh: 'Số tiền chính' })
  })
})
