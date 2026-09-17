import { describe, expect, it } from 'vitest'
import { tinhChiSo } from './chi-so'
import { HINH_THUC, TRANG_THAI, type GiaoDichTho } from './kieu'
import { tinhToan } from './tinh-toan'

const dong = (phan: Partial<GiaoDichTho>): GiaoDichTho => ({
  id: phan.id ?? crypto.randomUUID(), ngay: phan.ngay ?? '2026-01-01', soThuTu: phan.soThuTu ?? 1,
  taoLuc: phan.taoLuc ?? '2026-01-01T00:00:00.000Z', noiDung: phan.noiDung ?? '', kyHieuHd: null, soHd: null, loaiHd: null,
  trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 0, tienRuouBia: 0,
  tamUngTuCq: 0, giaoTienChiThuy: 0, hoanUngTienMat: 0, nguoiLayHdId: null, nguoiLayHdTen: null,
  phiLayHdGhiDe: null, trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: null, hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  ...phan,
})

describe('tinhToan', () => {
  it('tính hoàn ứng và phí với ưu tiên phí ghi đè', () => {
    const [row] = tinhToan([dong({ tongTien: 5_647_000, phiLayHdGhiDe: 700_000 })])
    expect(row.hoanTamUng).toBe(5_647_000)
    expect(row.phiLayHd).toBe(700_000)
  })

  it('loại tiền rượu bia và không tính hóa đơn chờ hoặc không hợp lệ', () => {
    const rows = tinhToan([
      dong({ id: 'valid', tongTien: 1_000_000, tienRuouBia: 100_000 }),
      dong({ id: 'pending', soThuTu: 2, tongTien: 2_000_000, trangThaiHd: TRANG_THAI.CHO_HD }),
      dong({ id: 'invalid', soThuTu: 3, tongTien: 3_000_000, trangThaiHd: 'Không hợp lệ' }),
    ])
    expect(rows.map((r) => r.hoanTamUng)).toEqual([900_000, 0, 0])
  })

  it('sắp xếp quyết định và cộng dồn số dư độc lập thứ tự đầu vào', () => {
    const rows = tinhToan([
      dong({ id: 'hand', ngay: '2026-01-02', hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 15_000_000 }),
      dong({ id: 'advance', ngay: '2026-01-01', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 20_000_000 }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['advance', 'hand'])
    expect(rows[1].duLyThuyet).toBe(20_000_000)
    expect(rows[1].duDangCam).toBe(5_000_000)
  })

  it('áp dụng tỷ lệ phí theo người lấy hóa đơn trước tỷ lệ chung', () => {
    const [row] = tinhToan([dong({ tongTien: 1_000_000, nguoiLayHdId: 'hiep' })], {
      tyLePhiChung: 0.15, tyLeTheoNguoi: { hiep: 0.1 },
    })
    expect(row.phiLayHd).toBe(100_000)
  })

  it('tính 20 chỉ số và đối soát quỹ', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 20_000_000 }),
      dong({ id: 'hand', soThuTu: 2, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 15_000_000 }),
      dong({ id: 'bill', soThuTu: 3, tongTien: 5_647_000, trangThaiTtPhi: TRANG_THAI.PHI_DA_TRA }),
      dong({ id: 'direct', soThuTu: 4, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 3_599_000 }),
      dong({ id: 'pending', soThuTu: 5, trangThaiHd: TRANG_THAI.CHO_HD, tongTien: 1_472_000 }),
    ])
    const kpi = tinhChiSo(rows)
    expect(kpi.tongTamUng).toBe(20_000_000)
    expect(kpi.thuyGoc).toBe(15_000_000)
    expect(kpi.tongBill).toBe(10_718_000)
    expect(kpi.choHd).toBe(1_472_000)
    expect(kpi.canDoi).toBe(true)
  })
})
