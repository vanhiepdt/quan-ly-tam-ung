import { describe, expect, it } from 'vitest'
import { phanTramTuTien, tienTuPhanTram } from './phi-hoa-don'

describe('phí hóa đơn theo phần trăm hoặc số tiền', () => {
  it('đổi phần trăm thành tiền nguyên đồng', () => {
    expect(tienTuPhanTram(15, 5_647_000)).toBe(847_050)
    expect(tienTuPhanTram(12.5, 1_000_001)).toBe(125_000)
  })

  it('đổi tiền thành phần trăm giữ hai chữ số thập phân', () => {
    expect(phanTramTuTien(847_050, 5_647_000)).toBe(15)
    expect(phanTramTuTien(125_000, 1_000_000)).toBe(12.5)
    expect(phanTramTuTien(1, 3)).toBe(33.33)
  })

  it('trả null khi không đủ dữ liệu để tính', () => {
    expect(tienTuPhanTram(0, 1_000_000)).toBeNull()
    expect(tienTuPhanTram(-5, 1_000_000)).toBeNull()
    expect(tienTuPhanTram(NaN, 1_000_000)).toBeNull()
    expect(phanTramTuTien(100_000, 0)).toBeNull()
    expect(phanTramTuTien(NaN, 1_000_000)).toBeNull()
  })

  it('đi vòng hai chiều không làm lệch số tiền đáng kể', () => {
    const tong = 5_647_000
    const tien = tienTuPhanTram(15, tong)!
    expect(tienTuPhanTram(phanTramTuTien(tien, tong)!, tong)).toBe(tien)
  })
})
