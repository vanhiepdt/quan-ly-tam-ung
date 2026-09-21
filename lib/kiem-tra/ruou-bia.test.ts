import { describe, expect, it } from 'vitest'
import { congTienRuouBia, ganCoRuouBiaTuAi, laDongRuouBia, tienRuouBiaCuaLop } from './ruou-bia'

describe('nhận diện dòng rượu bia', () => {
  it.each([
    'Bia Heineken chai 330ml', 'Rượu vang đỏ', 'Tiger beer', 'Whisky Johnnie Walker',
    'Saigon Special', 'BIA 333', 'Cognac Hennessy',
  ])('nhận %s', ten => { expect(laDongRuouBia(ten)).toBe(true) })

  it.each(['Nước ngọt Coca', 'Nước suối', 'Cơm rang', 'Bia không cồn', 'Heineken 0%', 'Công ty TNHH ABC'])(
    'loại %s', ten => { expect(laDongRuouBia(ten)).toBe(false) })

  it('cộng tiền các dòng có cồn, tôn trọng cờ đã gắn', () => {
    const { tien, dong } = congTienRuouBia([
      { ten: 'Bia Tiger', thanhTien: 80_000 },
      { ten: 'Cơm rang', thanhTien: 120_000 },
      { ten: 'Nước lọc', thanhTien: 15_000, laRuouBia: true },
    ])
    expect(tien).toBe(95_000)
    expect(dong.map(d => d.laRuouBia)).toEqual([true, false, true])
  })

  it('hóa đơn GTGT cộng thuế dòng rượu bia', () => {
    expect(congTienRuouBia([
      { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000 },
      { ten: 'Cơm rang', thanhTien: 120_000, tienThue: 9_600 },
    ], 'gtgt', 'truoc_thue').tien).toBe(308_000)
  })

  it('gắn cờ rượu bia từ dòng AI cùng tên', () => {
    const dong = ganCoRuouBiaTuAi(
      [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000 },
        { ten: 'Dê cuốn mỡ chài', thanhTien: 351_491 },
      ],
      [
        { ten: 'Bia Tiger chai', thanhTien: 280_000, laRuouBia: true },
        { ten: 'Dê cuốn mỡ chài', thanhTien: 351_491, laRuouBia: false },
      ],
    )
    expect(dong.map(d => d.laRuouBia)).toEqual([true, false])
  })

  it('số rượu bia của lớp: khóa JSON thắng, không thì cộng dòng rượu bia', () => {
    expect(tienRuouBiaCuaLop({ tienRuouBia: 80_000, dongHang: [{ ten: 'Bia Tiger', thanhTien: 50_000 }] })).toBe(80_000)
    expect(tienRuouBiaCuaLop({
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, laRuouBia: true },
        { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, laRuouBia: true },
      ],
    }, 'gtgt', 'truoc_thue')).toBe(622_600)
    expect(tienRuouBiaCuaLop({ dongHang: [{ ten: 'Cơm rang', thanhTien: 120_000, laRuouBia: false }] })).toBeUndefined()
    expect(tienRuouBiaCuaLop({ tienRuouBia: 0 })).toBe(0)
    expect(tienRuouBiaCuaLop(null)).toBeUndefined()
  })
})
