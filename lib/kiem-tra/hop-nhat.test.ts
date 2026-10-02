import { describe, expect, it } from 'vitest'
import { hopNhatHaiAi } from './hop-nhat'

describe('đối chiếu hai AI và XML', () => {
  it('cảnh báo khi hai AI đọc khác nhau và ưu tiên XML khớp một AI', () => {
    const kq = hopNhatHaiAi(
      { soHd: '000123', tongTien: 439600, mstMuaHang: '0401234567' },
      { soHd: '123', tongTien: 430000, mstMuaHang: '0401234567' },
      { soHd: '000123', tongTien: 439600, mstMuaHang: '0401234567' },
    )

    expect(kq.deXuat.soHd).toBe('000123')
    expect(kq.deXuat.tongTien).toBe(439600)
    expect(kq.phatHien.some(p => p.ma === 'ai_lech' && p.truong === 'tongTien')).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'ai_lech' && p.truong === 'soHd')).toBe(false)
  })

  it('tính tổng bia/rượu từ toàn bộ dòng sau thuế', () => {
    const kq = hopNhatHaiAi(
      {
        tongTien: 439600,
        loaiHd: 'gtgt', cotTienHang: 'truoc_thue', tienRuouBia: 1,
        dongHang: [{ ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true }],
      },
      {
        tongTien: 439600,
        loaiHd: 'gtgt', cotTienHang: 'truoc_thue', tienRuouBia: 999,
        dongHang: [{ ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true }],
      },
    )

    expect(kq.deXuat.tienRuouBia).toBe(308000)
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_lech')).toBe(true)
  })

  it('ưu tiên loại hóa đơn và cột thuế được parse từ XML khi AI đọc nhầm', () => {
    const kq = hopNhatHaiAi(
      {
        loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
        dongHang: [{ ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true }],
      },
      { loaiHd: 'ban_hang', cotTienHang: 'sau_thue' },
      {
        loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
        dongHang: [{ ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true }],
      },
    )

    expect(kq.deXuat.loaiHd).toBe('gtgt')
    expect(kq.deXuat.cotTienHang).toBe('truoc_thue')
    expect(kq.deXuat.tienRuouBia).toBe(308000)
  })
})
