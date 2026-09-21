import { describe, expect, it } from 'vitest'
import { chuanHoaNgayQr, chuanHoaTienQr, docQrHoaDon, hienThiMst } from './qr-hoa-don'

describe('đọc QR hóa đơn điện tử Việt Nam', () => {
  it('tách MST|ký hiệu|số|ngày|tổng tiền', () => {
    expect(docQrHoaDon('0101234567|1C26MTT|00001234|2026-09-17|1250000|M1-26-ABC')).toEqual({
      mstBanHang: '0101234567', kyHieuHd: '1C26MTT', soHd: '00001234',
      ngay: '2026-09-17', tongTien: 1_250_000, tongCong: 1_250_000,
    })
  })

  it('chấp nhận MST 13 số, ngày dd/mm/yyyy và bỏ khoảng trắng', () => {
    expect(docQrHoaDon('  0101234567-001 | C26TAA | 99 | 17/09/2026 | 500000 ')).toMatchObject({
      mstBanHang: '0101234567001', kyHieuHd: 'C26TAA', soHd: '99', ngay: '2026-09-17', tongTien: 500_000,
    })
  })

  it('từ chối chuỗi thiếu trường, MST sai hoặc không phải số nguyên', () => {
    expect(docQrHoaDon('')).toBeNull()
    expect(docQrHoaDon('abc|1C|1|2026-01-01|1')).toBeNull()
    expect(docQrHoaDon('0101234567|1C|1')).toBeNull()
    expect(docQrHoaDon('0101234567|1C|1|2026-01-01|12.5')).toBeNull()
    expect(docQrHoaDon('0101234567|1C|1|2026-01-01|-1')).toBeNull()
  })

  it('chuẩn hóa ngày yyyymmdd và tiền bỏ dấu phẩy', () => {
    expect(chuanHoaNgayQr('20260917')).toBe('2026-09-17')
    expect(chuanHoaNgayQr('7-9-2026')).toBe('2026-09-07')
    expect(chuanHoaTienQr('1,250,000')).toBe(1_250_000)
  })

  it('hiện MST chi nhánh 13 số với gạch nối', () => {
    expect(hienThiMst('0100695387066')).toBe('0100695387-066')
    expect(hienThiMst('0100695387-066')).toBe('0100695387-066')
    expect(hienThiMst('0100100100')).toBe('0100100100')
  })

  it('đọc TLV MISA/TCT dù mẫu 99 ghi sai độ dài', () => {
    const tlv = '00020199990035DH8KPZX3K3HBAV9VFJ71ZHJ0XFPTNR2QGDJ01100108021157020110306C26MLD040416560508202609110607243916063040427'
    expect(docQrHoaDon(tlv)).toEqual({
      mstBanHang: '0108021157', kyHieuHd: '1C26MLD', soHd: '00001656',
      ngay: '2026-09-11', tongTien: 2_439_160, tongCong: 2_439_160,
    })
  })

  it('đọc TLV lồng đúng khuôn (mẫu 80)', () => {
    const inner = '01100101234567020110306C26MTT04080000123405082026091706071250000'
    const tlv = `00020180${String(inner.length).padStart(2, '0')}${inner}6304ABCD`
    expect(docQrHoaDon(tlv)).toEqual({
      mstBanHang: '0101234567', kyHieuHd: '1C26MTT', soHd: '00001234',
      ngay: '2026-09-17', tongTien: 1_250_000, tongCong: 1_250_000,
    })
  })

  it('không nhận VietQR thanh toán làm hóa đơn', () => {
    expect(docQrHoaDon('00020101021238580010A0000007270127000697041501130000000000010208QRIBFTTA53037045802VN6304ABCD')).toBeNull()
  })
})
