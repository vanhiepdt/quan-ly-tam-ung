import { describe, expect, it } from 'vitest'
import { dongTaiKhoan, taiKhoanTu } from './tai-khoan'

describe('tài khoản nhận tiền của người lấy hóa đơn', () => {
  it('không có số tài khoản thì coi như chưa cấu hình', () => {
    // Số tài khoản là phần bắt buộc; thiếu nó thì giấy chỉ in chữ "Chuyển khoản".
    expect(taiKhoanTu({ so_tai_khoan: null, ten_chu_tk: 'Nguyễn Văn A' })).toBeNull()
    expect(taiKhoanTu({ so_tai_khoan: '   ' })).toBeNull()
    expect(taiKhoanTu({})).toBeNull()
    expect(taiKhoanTu(null)).toBeNull()
    expect(taiKhoanTu(undefined)).toBeNull()
  })

  it('cắt khoảng trắng thừa của mọi trường', () => {
    expect(taiKhoanTu({ so_tai_khoan: ' 123456789 ', ten_chu_tk: ' Nguyễn Văn A ' })).toEqual({
      soTaiKhoan: '123456789', nganHang: null, tenChuTk: 'Nguyễn Văn A',
    })
  })

  it('ưu tiên tên ngân hàng gõ tay, thiếu thì lấy mã BIN', () => {
    // Tên ngân hàng là thứ in ra giấy, mã BIN chỉ là phương án dự phòng khi chưa đặt tên.
    expect(taiKhoanTu({ so_tai_khoan: '1', ten_ngan_hang: 'Ngân hàng Chính sách xã hội', ngan_hang_bin: '9999' }))
      .toEqual({ soTaiKhoan: '1', nganHang: 'Ngân hàng Chính sách xã hội', tenChuTk: null })
    expect(taiKhoanTu({ so_tai_khoan: '1', ngan_hang_bin: '9999' }))
      .toEqual({ soTaiKhoan: '1', nganHang: '9999', tenChuTk: null })
    expect(taiKhoanTu({ so_tai_khoan: '1', ten_ngan_hang: '  ', ngan_hang_bin: '9999' }))
      .toEqual({ soTaiKhoan: '1', nganHang: '9999', tenChuTk: null })
    expect(taiKhoanTu({ so_tai_khoan: '1' })).toEqual({ soTaiKhoan: '1', nganHang: null, tenChuTk: null })
  })
})

describe('dòng tài khoản in trên giấy', () => {
  it('ghép những phần đã có, bỏ phần trống', () => {
    expect(dongTaiKhoan({ soTaiKhoan: '123456789', nganHang: 'NHCSXH', tenChuTk: 'Nguyễn Văn A' }))
      .toBe('Số tài khoản: 123456789 – Ngân hàng: NHCSXH – Chủ tài khoản: Nguyễn Văn A')
    expect(dongTaiKhoan({ soTaiKhoan: '123456789', nganHang: null, tenChuTk: null }))
      .toBe('Số tài khoản: 123456789')
    expect(dongTaiKhoan({ soTaiKhoan: '123456789', nganHang: 'NHCSXH', tenChuTk: null }))
      .toBe('Số tài khoản: 123456789 – Ngân hàng: NHCSXH')
  })
})
