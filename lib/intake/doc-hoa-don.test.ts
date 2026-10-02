import { describe, expect, it } from 'vitest'
import { deXuatGiaoDich } from './doc-hoa-don'

describe('đề xuất giao dịch từ hóa đơn', () => {
  it('không đưa NaN hoặc Infinity vào intake', () => {
    const result = deXuatGiaoDich({
      trangThai: 'hop_le',
      deXuat: {
        ngay: '2026-09-22',
        tongTien: Number.NaN,
        tienRuouBia: Number.POSITIVE_INFINITY,
      },
    })
    expect(result.tongTien).toBe(0)
    expect(result.tienRuouBia).toBe(0)
  })
})
