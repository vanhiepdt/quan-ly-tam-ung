import { describe, expect, it } from 'vitest'
import { doanCotTienHang, doanLoaiHoaDon, doanLoaiTuChu, doanLoaiTuKyHieu, tienDongSauThue } from './loai-hoa-don'
import { congTienRuouBia } from './ruou-bia'

const CHU_GTGT = `
HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ký hiệu : 1C26MLD
STT Tên hàng hóa Thành tiền
Tổng hợp Thành tiền trước thuế GTGT Tiền thuế GTGT Cộng tiền thanh toán
`.trim()

const CHU_BAN_HANG = `
HÓA ĐƠN BÁN HÀNG
Ký hiệu : 2C26MTT
Thành tiền
`.trim()

const CHU_SAU_THUE = `
HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Thành tiền sau thuế GTGT
`.trim()

describe('nhận loại hóa đơn', () => {
  it('tiêu đề GTGT thắng ký hiệu', () => {
    expect(doanLoaiTuChu(CHU_GTGT)).toBe('gtgt')
    expect(doanLoaiTuChu(CHU_BAN_HANG)).toBe('ban_hang')
    expect(doanLoaiTuKyHieu('1C26MLD')).toBe('gtgt')
    expect(doanLoaiTuKyHieu('2C26MTT')).toBe('ban_hang')
    expect(doanLoaiHoaDon({ kyHieuHd: '1C26MLD' })).toBe('gtgt')
  })

  it('cột thành tiền trước thuế vs đã gồm thuế', () => {
    expect(doanCotTienHang({ chu: CHU_GTGT, loaiHd: 'gtgt' })).toBe('truoc_thue')
    expect(doanCotTienHang({ chu: CHU_SAU_THUE, loaiHd: 'gtgt' })).toBe('sau_thue')
    expect(doanCotTienHang({
      loaiHd: 'gtgt',
      dongHang: [{ ten: 'Bia', thanhTien: 100_000, tienThue: 10_000 }],
    })).toBe('truoc_thue')
  })
})

describe('tiền rượu bia theo loại hóa đơn', () => {
  const tiger = { ten: 'Bia Tiger', thanhTien: 280_000, thueSuat: 10, tienThue: 28_000, laRuouBia: true as const }
  const com = { ten: 'Cơm rang', thanhTien: 120_000, thueSuat: 8, tienThue: 9_600 }

  it('hóa đơn bán hàng lấy thành tiền, không cộng thuế', () => {
    expect(tienDongSauThue(tiger, 'ban_hang', 'truoc_thue')).toBe(280_000)
    expect(congTienRuouBia([tiger, com], 'ban_hang').tien).toBe(280_000)
  })

  it('hóa đơn GTGT cột trước thuế: thành tiền + tiền thuế GTGT', () => {
    expect(tienDongSauThue(tiger, 'gtgt', 'truoc_thue')).toBe(308_000)
    expect(congTienRuouBia([tiger, com], 'gtgt', 'truoc_thue').tien).toBe(308_000)
  })

  it('hóa đơn GTGT cột sau thuế: lấy thành tiền, không cộng thêm', () => {
    const sau = { ten: 'Bia Tiger', thanhTien: 308_000, laRuouBia: true as const }
    expect(tienDongSauThue(sau, 'gtgt', 'sau_thue')).toBe(308_000)
    expect(congTienRuouBia([sau], 'gtgt', 'sau_thue').tien).toBe(308_000)
  })

  it('hóa đơn GTGT thiếu cột tiền thuế thì nhân thuế suất', () => {
    expect(tienDongSauThue({ ten: 'Bia', thanhTien: 100_000, thueSuat: 10 }, 'gtgt', 'truoc_thue')).toBe(110_000)
  })
})
