import { z } from 'zod'

export const chuanHoaTenDangNhap = (value: string) => value.trim().toLowerCase()
export const tenDangNhapSchema = z.string().transform(chuanHoaTenDangNhap).pipe(
  z.string().regex(/^[a-z0-9][a-z0-9._-]{2,49}$/, 'Tên đăng nhập gồm 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.'))
export const matKhauSchema = z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự.').max(256, 'Mật khẩu không quá 256 ký tự.')
export const taiKhoanSchema = z.object({
  ten_dang_nhap: tenDangNhapSchema,
  ho_ten: z.string().trim().min(1, 'Vui lòng nhập tên hiển thị.').max(120, 'Tên hiển thị không quá 120 ký tự.'),
  mat_khau: matKhauSchema,
  vai_tro: z.enum(['admin', 'nhap_lieu', 'chi_doc'], { message: 'Vai trò không hợp lệ.' }),
})

export function kiemTraVoHieuHoa(actorId: string, target: { id: string; vai_tro: string; dang_hoat_dong: boolean }, activeAdmins: number) {
  if (target.id === actorId) throw new Error('Bạn không thể vô hiệu hóa tài khoản đang sử dụng.')
  if (target.dang_hoat_dong && target.vai_tro === 'admin' && activeAdmins <= 1) throw new Error('Phải giữ lại ít nhất một quản trị viên đang hoạt động.')
}
