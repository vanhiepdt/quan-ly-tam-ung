import { describe, expect, it } from 'vitest'
import { thongBaoTrungKyHieu } from './trung-ky-hieu'

describe('cảnh báo trùng ký hiệu hóa đơn', () => {
  it('không cảnh báo khi chưa gõ hoặc chưa có giao dịch nào', () => {
    expect(thongBaoTrungKyHieu('', [{ ngay: '01/01/2026', soHd: '1' }])).toBeUndefined()
    expect(thongBaoTrungKyHieu('1C26MTT', [])).toBeUndefined()
  })

  it('một giao dịch thì nêu ngày và số hóa đơn', () => {
    expect(thongBaoTrungKyHieu(' 1C26MTT ', [{ ngay: '17/09/2026', soHd: '00001656' }]))
      .toBe('Ký hiệu HĐ 1C26MTT đã có trên giao dịch ngày 17/09/2026, số 00001656.')
    expect(thongBaoTrungKyHieu('1C26MTT', [{ ngay: '17/09/2026', soHd: null }]))
      .toBe('Ký hiệu HĐ 1C26MTT đã có trên giao dịch ngày 17/09/2026.')
  })

  it('nhiều giao dịch thì nêu số lượng và bản gần nhất', () => {
    expect(thongBaoTrungKyHieu('1C26MTT', [
      { ngay: '17/09/2026', soHd: '2' },
      { ngay: '01/01/2026', soHd: '1' },
    ])).toBe('Ký hiệu HĐ 1C26MTT đã có trên 2 giao dịch, gần nhất ngày 17/09/2026, số 2.')
  })
})
