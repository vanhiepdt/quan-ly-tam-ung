import { describe, expect, it } from 'vitest'
import { chuanHoaNoiDung, crc16, taoNoiDungThanhToan, taoPayloadVietQR } from './vietqr'

function decode(value: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (let pos = 0; pos < value.length;) {
    const id = value.slice(pos, pos + 2), size = Number(value.slice(pos + 2, pos + 4))
    expect(size).toBeLessThanOrEqual(99)
    const data = value.slice(pos + 4, pos + 4 + size)
    expect(data.length).toBe(size)
    fields[id] = data; pos += 4 + size
  }
  return fields
}
describe('local VietQR encoding', () => {
  it('matches the subiz/vietqr README reference payload byte for byte', () => {
    expect(taoPayloadVietQR({ bin: '970415', soTaiKhoan: '0011001932418', soTien: 120000, noiDung: 'ủng hộ lũ lụt' }))
      .toBe('00020101021238570010A00000072701270006970415011300110019324180208QRIBFTTA530370454061200005802VN62170813ung ho lu lut6304C15C')
  })
  it('uses the standard CRC16 CCITT-FALSE vector', () => expect(crc16('123456789')).toBe('29B1'))
  it('encodes correct byte lengths, routing, amount, complete memo and CRC', () => {
    const memo = taoNoiDungThanhToan('0000123456', '2026-09-16')
    expect(memo).toBe('TT HD 0000123456 20260916')
    const payload = taoPayloadVietQR({ bin: '970436', soTaiKhoan: '0123456789012345678', soTien: 150000, noiDung: memo })
    const fields = decode(payload), merchant = decode(fields['38']), bank = decode(merchant['01'])
    expect(bank).toEqual({ '00': '970436', '01': '0123456789012345678' })
    expect(merchant['00']).toBe('A000000727'); expect(merchant['02']).toBe('QRIBFTTA')
    expect(fields['54']).toBe('150000'); expect(fields['01']).toBe('12')
    expect(decode(fields['62'])['08']).toBe(memo)
    expect(fields['63']).toBe(crc16(payload.slice(0, -4)))
  })
  it('normalizes accents but never truncates or drops invoice and date', () => {
    expect(chuanHoaNoiDung('Đã trả')).toBe('Da tra')
    expect(chuanHoaNoiDung('a'.repeat(25))).toHaveLength(25)
    expect(() => chuanHoaNoiDung('a'.repeat(26))).toThrow('25')
    expect(() => taoNoiDungThanhToan('a'.repeat(11), '2026-09-16')).toThrow('25')
    expect(() => taoNoiDungThanhToan('', '2026-09-16')).toThrow()
    expect(() => taoNoiDungThanhToan('123', '2026-02-30')).toThrow()
    expect(() => chuanHoaNoiDung('HĐ\n123')).toThrow()
    expect(() => chuanHoaNoiDung('漢字')).toThrow()
  })
  it.each([0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 10000000000000])('rejects invalid amount %s', soTien => {
    expect(() => taoPayloadVietQR({ bin: '970436', soTaiKhoan: '123', soTien })).toThrow()
  })
  it.each([['12345', '123'], ['970436', '123x'], ['970436', '1'.repeat(20)]])('rejects invalid routing %s %s', (bin, soTaiKhoan) => {
    expect(() => taoPayloadVietQR({ bin, soTaiKhoan })).toThrow()
  })
  it('supports account-only static payload without a payment amount', () => {
    const fields = decode(taoPayloadVietQR({ bin: '970436', soTaiKhoan: '123' }))
    expect(fields['01']).toBe('11'); expect(fields['54']).toBeUndefined()
  })
})
