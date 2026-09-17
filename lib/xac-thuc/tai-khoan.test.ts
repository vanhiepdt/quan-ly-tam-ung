import { describe, expect, it } from 'vitest'
import { chuanHoaTenDangNhap, tenDangNhapSchema, matKhauSchema, taiKhoanSchema, kiemTraVoHieuHoa } from './tai-khoan'

describe('Tên đăng nhập', () => {
  it('chuẩn hóa chữ thường và khoảng trắng ngoài', () => {
    expect(chuanHoaTenDangNhap('  Ke_Toan.01  ')).toBe('ke_toan.01')
    expect(tenDangNhapSchema.parse('  ADMIN-01 ')).toBe('admin-01')
  })
  it.each(['ab', 'a'.repeat(51), 'quảntrị', 'user name', 'user@email.vn', '_admin', "abc' OR 1=1--", 'a\nb'])('từ chối tên không hợp lệ %s', value => {
    expect(tenDangNhapSchema.safeParse(value).success).toBe(false)
  })
  it('chấp nhận tên backfill từ UUID và giới hạn hợp lệ', () => {
    expect(tenDangNhapSchema.safeParse('user_8f76da8ec58d4aedb57549ccd83b971e').success).toBe(true)
    expect(tenDangNhapSchema.safeParse('a'.repeat(50)).success).toBe(true)
  })
})
describe('Thông tin tài khoản', () => {
  it('chấp nhận đúng 8 ký tự, từ chối ít hơn hoặc quá dài', () => {
    expect(matKhauSchema.safeParse('abcd1234').success).toBe(true)
    expect(matKhauSchema.safeParse('abcd123').success).toBe(false)
    expect(matKhauSchema.safeParse('x'.repeat(257)).success).toBe(false)
    expect(matKhauSchema.parse(' password ')).toBe(' password ')
  })
  it('không yêu cầu email và chỉ chấp nhận vai trò đã định nghĩa', () => {
    const input = { ten_dang_nhap: 'USER', ho_ten: ' Nguyễn Văn A ', mat_khau: 'abcd1234', vai_tro: 'chi_doc' }
    expect(taiKhoanSchema.parse(input)).toMatchObject({ ten_dang_nhap: 'user', ho_ten: 'Nguyễn Văn A' })
    expect(taiKhoanSchema.safeParse({ ...input, vai_tro: 'owner' }).success).toBe(false)
    expect(taiKhoanSchema.safeParse({ ...input, ho_ten: '  ' }).success).toBe(false)
  })
})
describe('Bảo vệ quản trị viên', () => {
  it('luôn chặn tự vô hiệu hóa', () => {
    expect(() => kiemTraVoHieuHoa('a', { id: 'a', vai_tro: 'admin', dang_hoat_dong: true }, 2)).toThrow('đang sử dụng')
  })
  it('chặn vô hiệu hóa quản trị cuối cùng', () => {
    expect(() => kiemTraVoHieuHoa('a', { id: 'b', vai_tro: 'admin', dang_hoat_dong: true }, 1)).toThrow('ít nhất một')
  })
  it('cho phép vô hiệu hóa admin khác nếu còn admin hoạt động', () => {
    expect(() => kiemTraVoHieuHoa('a', { id: 'b', vai_tro: 'admin', dang_hoat_dong: true }, 2)).not.toThrow()
  })
  it('không nhầm người chỉ đọc hoặc admin đã tắt với admin cuối cùng', () => {
    expect(() => kiemTraVoHieuHoa('a', { id: 'b', vai_tro: 'chi_doc', dang_hoat_dong: true }, 1)).not.toThrow()
    expect(() => kiemTraVoHieuHoa('a', { id: 'b', vai_tro: 'admin', dang_hoat_dong: false }, 1)).not.toThrow()
  })
})
