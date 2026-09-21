import { describe, expect, it } from 'vitest'
import { laLoiChungChiTuKy, loiMangNguoiDung, napChungChiHeThong } from './tls-he-thong'

describe('TLS hệ thống', () => {
  it('nhận diện chứng chỉ tự ký, không tắt kiểm tra', () => {
    expect(laLoiChungChiTuKy('TypeError — fetch failed — self-signed certificate in certificate chain — SELF_SIGNED_CERT_IN_CHAIN')).toBe(true)
    expect(laLoiChungChiTuKy('ECONNREFUSED')).toBe(false)
    expect(loiMangNguoiDung('SELF_SIGNED_CERT_IN_CHAIN')).toMatch(/chứng chỉ tự ký/)
    expect(loiMangNguoiDung('SELF_SIGNED_CERT_IN_CHAIN')).toMatch(/antivirus/)
    expect(loiMangNguoiDung('ENOTFOUND')).toBe('ENOTFOUND')
  })

  it('nạp CA không ném, không lộ nội dung chứng chỉ', () => {
    const kq = napChungChiHeThong()
    expect(kq).toEqual(expect.objectContaining({ nap: expect.any(Boolean), them: expect.any(Number) }))
    expect(JSON.stringify(kq)).not.toMatch(/BEGIN CERTIFICATE/)
    expect(napChungChiHeThong()).toEqual(kq)
  })
})
