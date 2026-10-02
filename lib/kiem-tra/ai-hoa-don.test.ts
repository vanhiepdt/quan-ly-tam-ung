import { describe, expect, it } from 'vitest'
import { docJsonAi, HUONG_DAN } from './ai-hoa-don'

describe('chuẩn hóa kết quả AI hóa đơn', () => {
  it('tính lại tổng bia/rượu sau thuế từ các dòng, không tin tổng riêng của AI', () => {
    const doc = docJsonAi(JSON.stringify({
      loaiHd: 'gtgt', cotTienHang: 'truoc_thue', tienRuouBia: 1,
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true },
        { ten: 'Cơm rang', thanhTien: 120000, tienThue: 9600, laRuouBia: false },
      ],
    }))
    expect(doc.tienRuouBia).toBe(308000)
    expect(doc.dongHang?.[0].laRuouBia).toBe(true)
  })

  it('trả 0 khi AI đọc được bảng dòng nhưng không có dòng bia/rượu', () => {
    const doc = docJsonAi(JSON.stringify({
      tienRuouBia: 999999,
      dongHang: [{ ten: 'Nước suối', thanhTien: 120000, laRuouBia: false }],
    }))
    expect(doc.tienRuouBia).toBe(0)
  })

  it('prompt mới không còn yêu cầu OCR hoặc QR hóa đơn', () => {
    expect(HUONG_DAN).not.toMatch(/OCR|QR/i)
    expect(HUONG_DAN).toContain('PDF hoặc XML')
    expect(HUONG_DAN).toContain('tienRuouBia')
  })
})
