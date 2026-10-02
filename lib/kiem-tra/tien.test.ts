import { describe, expect, it } from 'vitest'
import { chuoiTienHopLe, laSoTienHopLe } from './tien'

describe('giá trị tiền an toàn', () => {
  it.each([0, 1, Number.MAX_SAFE_INTEGER])('chấp nhận số nguyên không âm an toàn: %s', value => {
    expect(laSoTienHopLe(value)).toBe(true)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, '1000', null, undefined])('từ chối giá trị tiền không hợp lệ: %s', value => {
    expect(laSoTienHopLe(value)).toBe(false)
  })

  it('giữ số hiện có khi đề xuất là NaN', () => {
    expect(chuoiTienHopLe(Number.NaN, '120000')).toBe('120000')
    expect(chuoiTienHopLe(250000, '120000')).toBe('250000')
  })
})
