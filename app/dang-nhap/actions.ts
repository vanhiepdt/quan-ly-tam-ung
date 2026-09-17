'use server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db/pool'
import { kiemTraMatKhau } from '@/lib/xac-thuc/mat-khau'
import { taoPhien, huyPhien } from '@/lib/xac-thuc/phien'
import { tenDangNhapSchema } from '@/lib/xac-thuc/tai-khoan'

export async function dangNhap(_: { loi?: string }, data: FormData) {
  const ten = tenDangNhapSchema.safeParse(String(data.get('ten_dang_nhap') ?? ''))
  const matKhau = String(data.get('password') ?? '')
  const sai = { loi: 'Tên đăng nhập hoặc mật khẩu không đúng.' }
  if (!ten.success || !matKhau || matKhau.length > 256) return sai
  try {
    const { rows } = await db.query<{ id: string; mat_khau_hash: string }>('select id,mat_khau_hash from nguoi_dung where ten_dang_nhap=$1 and dang_hoat_dong', [ten.data])
    const user = rows[0]
    if (!user || !(await kiemTraMatKhau(matKhau, user.mat_khau_hash))) return sai
    // Recheck under the same user row lock used by account administration so
    // reset/deactivation cannot race with creation of a fresh session.
    if (!(await taoPhien(user.id, user.mat_khau_hash))) return sai
  } catch {
    return { loi: 'Không thể đăng nhập lúc này. Vui lòng thử lại hoặc liên hệ quản trị viên.' }
  }
  redirect('/dashboard')
}

export async function dangXuat() {
  await huyPhien()
  redirect('/dang-nhap')
}
