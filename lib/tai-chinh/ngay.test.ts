import { describe, expect, it } from 'vitest'
import { ngayDeNghiMacDinh } from './ngay'

describe('ngày đề nghị tiếp khách theo hóa đơn', () => {
  it('giữ ngày hóa đơn trong ngày thường', () => {
    expect(ngayDeNghiMacDinh('2026-10-12')).toBe('2026-10-12')
  })

  it('lùi hóa đơn thứ Bảy hoặc Chủ nhật về thứ Sáu gần nhất', () => {
    expect(ngayDeNghiMacDinh('2026-10-10')).toBe('2026-10-09')
    expect(ngayDeNghiMacDinh('2026-10-11')).toBe('2026-10-09')
  })
})
