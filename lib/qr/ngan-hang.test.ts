import { describe, expect, it } from 'vitest'
import { NGAN_HANG, nganHangTheoBin, taoQrThu } from './ngan-hang'
import { crc16 } from './vietqr'
import { schemaNguoiLayHd } from '../validation/nguoi-lay-hd'

describe('danh mục ngân hàng và QR thử cục bộ', () => {
  it('snapshot có BIN duy nhất, đúng định dạng và ngân hàng thông dụng', () => {
    expect(NGAN_HANG.length).toBe(65)
    expect(new Set(NGAN_HANG.map(b => b.bin)).size).toBe(NGAN_HANG.length)
    for (const b of NGAN_HANG) { expect(b.bin).toMatch(/^\d{6}$/); expect(b.name).not.toBe('') }
    expect(nganHangTheoBin('970436')?.shortName).toBe('Vietcombank')
    expect(nganHangTheoBin('970415')?.shortName).toBe('VietinBank')
    expect(nganHangTheoBin('999888')?.shortName).toBe('VBSP')
  })
  it('QR thử giữ số 0 đầu tài khoản, không có số tiền/nội dung, checksum đúng', () => {
    const payload = taoQrThu({ bin: '970415', soTaiKhoan: ' 000000000001 ' })
    const fields: Record<string, string> = {}
    for (let i = 0; i < payload.length;) {
      const len = Number(payload.slice(i + 2, i + 4))
      fields[payload.slice(i, i + 2)] = payload.slice(i + 4, i + 4 + len); i += 4 + len
    }
    expect(fields['38']).toContain('00069704150112000000000001')
    expect(fields['54']).toBeUndefined()
    expect(fields['62']).toBeUndefined()
    expect(fields['63']).toBe(crc16(payload.slice(0, -4)))
  })
  it('không tạo QR hoặc lưu mã ngân hàng không thuộc danh sách', () => {
    expect(() => taoQrThu({ bin: '000000', soTaiKhoan: '123' })).toThrow('chọn ngân hàng')
    expect(() => taoQrThu({ bin: '970415', soTaiKhoan: 'abc' })).toThrow('không hợp lệ')
    expect(schemaNguoiLayHd.safeParse({ ten: 'A', ngan_hang_bin: '000000' }).success).toBe(false)
    expect(schemaNguoiLayHd.parse({ ten: 'A', ngan_hang_bin: '970415', chi_nhanh: ' Hà Nội ' }).chi_nhanh).toBe('Hà Nội')
  })
})
