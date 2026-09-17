'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { trongTransaction } from '@/lib/db/pool'
import { layPhien } from '@/lib/xac-thuc/phien'
import { bamMatKhau } from '@/lib/xac-thuc/mat-khau'
import { taiKhoanSchema, matKhauSchema, kiemTraVoHieuHoa } from '@/lib/xac-thuc/tai-khoan'
import { schemaNguoiLayHd } from '@/lib/validation/nguoi-lay-hd'

export type KetQua = { loi?: string; thanh_cong?: string }
class LoiTaiKhoan extends Error {}

export async function quanLyTaiKhoan(_: KetQua, data: FormData): Promise<KetQua> {
  try {
    const actor = await layPhien()
    if (!actor || actor.vai_tro !== 'admin') return { loi: 'Bạn không có quyền quản lý tài khoản.' }
    const operation = String(data.get('thao_tac') ?? '')
    if (!['tao', 'dat_lai', 'vo_hieu', 'kich_hoat'].includes(operation)) return { loi: 'Thao tác không hợp lệ.' }
    const input = operation === 'tao' ? taiKhoanSchema.parse({
      ten_dang_nhap: data.get('ten_dang_nhap'), ho_ten: data.get('ho_ten'),
      mat_khau: data.get('mat_khau'), vai_tro: data.get('vai_tro'),
    }) : null
    const id = operation === 'tao' ? null : z.string().uuid('Tài khoản không hợp lệ.').parse(data.get('id'))
    const password = input?.mat_khau ?? (operation === 'dat_lai' ? matKhauSchema.parse(data.get('mat_khau')) : null)
    const hash = password === null ? null : await bamMatKhau(password)
    await trongTransaction(actor.id, async client => {
      // Serialize admin account mutations; count + update are one transaction.
      await client.query('select pg_advisory_xact_lock(41004)')
      const current = await layPhien(client)
      if (!current || current.id !== actor.id || current.vai_tro !== 'admin') throw new LoiTaiKhoan('Phiên quản trị đã hết hiệu lực. Vui lòng đăng nhập lại.')
      const valid = await client.query("select id from nguoi_dung where id=$1 and dang_hoat_dong and vai_tro='admin' for update", [actor.id])
      if (!valid.rowCount) throw new LoiTaiKhoan('Tài khoản quản trị không còn hiệu lực.')
      if (input) {
        await client.query('insert into nguoi_dung (ten_dang_nhap,ho_ten,mat_khau_hash,vai_tro,doi_mat_khau) values ($1,$2,$3,$4,false)', [input.ten_dang_nhap, input.ho_ten, hash, input.vai_tro])
        return
      }
      const { rows } = await client.query<{ id: string; vai_tro: string; dang_hoat_dong: boolean }>('select id,vai_tro,dang_hoat_dong from nguoi_dung where id=$1 for update', [id])
      const target = rows[0]
      if (!target) throw new LoiTaiKhoan('Không tìm thấy tài khoản.')
      if (operation === 'vo_hieu') {
        const admins = await client.query("select count(*)::int as total from nguoi_dung where vai_tro='admin' and dang_hoat_dong")
        try { kiemTraVoHieuHoa(actor.id, target, admins.rows[0].total) } catch (error) { throw new LoiTaiKhoan((error as Error).message) }
        await client.query('update nguoi_dung set dang_hoat_dong=false where id=$1', [id])
      } else if (operation === 'kich_hoat') {
        await client.query('update nguoi_dung set dang_hoat_dong=true where id=$1', [id])
      } else {
        await client.query('update nguoi_dung set mat_khau_hash=$2,doi_mat_khau=false where id=$1', [id, hash])
      }
      // Never delete nguoi_dung: transaction authors and audit references survive.
      await client.query('delete from phien where nguoi_dung_id=$1', [id])
    })
    revalidatePath('/admin')
    return { thanh_cong: operation === 'tao' ? 'Đã tạo tài khoản. Có thể đăng nhập ngay bằng mật khẩu vừa cấp.' : operation === 'dat_lai' ? 'Đã đặt lại mật khẩu và đăng xuất tất cả phiên của tài khoản.' : operation === 'vo_hieu' ? 'Đã vô hiệu hóa tài khoản và thu hồi tất cả phiên đăng nhập.' : 'Đã kích hoạt lại tài khoản.' }
  } catch (error) {
    if (error instanceof z.ZodError) return { loi: error.issues[0].message }
    if (error instanceof LoiTaiKhoan) return { loi: error.message }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return { loi: 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.' }
    return { loi: 'Không thể cập nhật tài khoản. Vui lòng thử lại.' }
  }
}

async function batBuocAdmin() {
  const phien = await layPhien()
  if (!phien || phien.vai_tro !== 'admin') throw new Error('Bạn không có quyền thực hiện thao tác này.')
  return phien
}

// Mã cán bộ gắn vào người lấy hóa đơn bị khoá ngoại từ chối khi cán bộ không còn tồn tại.
function laLoiCanBo(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503'
}

export async function themNguoiLayHd(_: KetQua, data: FormData): Promise<KetQua> {
  try {
    const phien = await batBuocAdmin()
    const input = schemaNguoiLayHd.parse({
      ten: data.get('ten'),
      ty_le_phi: data.get('ty_le_phi') ? Number(data.get('ty_le_phi')) / 100 : null,
      ngan_hang_bin: data.get('ngan_hang_bin') || null,
      so_tai_khoan: data.get('so_tai_khoan') || null,
      ten_ngan_hang: data.get('ten_ngan_hang') || null,
      ten_chu_tk: data.get('ten_chu_tk') || null,
      can_bo_id: data.get('can_bo_id') || null,
      ghi_chu: data.get('ghi_chu') || null,
    })
    await trongTransaction(phien.id, async client => {
      await client.query(
        'insert into nguoi_lay_hd (ten, ty_le_phi, ngan_hang_bin, so_tai_khoan, ten_ngan_hang, ten_chu_tk, can_bo_id, ghi_chu) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [input.ten, input.ty_le_phi, input.ngan_hang_bin, input.so_tai_khoan, input.ten_ngan_hang, input.ten_chu_tk, input.can_bo_id, input.ghi_chu]
      )
    })
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    return { thanh_cong: 'Đã thêm người lấy hóa đơn.' }
  } catch (error) {
    if (error instanceof z.ZodError) return { loi: error.issues[0].message }
    if (laLoiCanBo(error)) return { loi: 'Cán bộ đã chọn không tồn tại. Vui lòng chọn lại.' }
    return { loi: 'Không thể thêm người lấy hóa đơn. Vui lòng thử lại.' }
  }
}

export async function suaNguoiLayHd(_: KetQua, data: FormData): Promise<KetQua> {
  try {
    const phien = await batBuocAdmin()
    const id = z.string().uuid().parse(data.get('id'))
    const input = schemaNguoiLayHd.parse({
      ten: data.get('ten'),
      ty_le_phi: data.get('ty_le_phi') ? Number(data.get('ty_le_phi')) / 100 : null,
      ngan_hang_bin: data.get('ngan_hang_bin') || null,
      so_tai_khoan: data.get('so_tai_khoan') || null,
      ten_ngan_hang: data.get('ten_ngan_hang') || null,
      ten_chu_tk: data.get('ten_chu_tk') || null,
      can_bo_id: data.get('can_bo_id') || null,
      ghi_chu: data.get('ghi_chu') || null,
    })
    await trongTransaction(phien.id, async client => {
      const result = await client.query(
        'update nguoi_lay_hd set ten=$2, ty_le_phi=$3, ngan_hang_bin=$4, so_tai_khoan=$5, ten_ngan_hang=$6, ten_chu_tk=$7, can_bo_id=$8, ghi_chu=$9 where id=$1',
        [id, input.ten, input.ty_le_phi, input.ngan_hang_bin, input.so_tai_khoan, input.ten_ngan_hang, input.ten_chu_tk, input.can_bo_id, input.ghi_chu]
      )
      if (!result.rowCount) throw new Error('Không tìm thấy người lấy hóa đơn.')
    })
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    return { thanh_cong: 'Đã cập nhật thông tin người lấy hóa đơn.' }
  } catch (error) {
    if (error instanceof z.ZodError) return { loi: error.issues[0].message }
    if (laLoiCanBo(error)) return { loi: 'Cán bộ đã chọn không tồn tại. Vui lòng chọn lại.' }
    return { loi: 'Không thể cập nhật người lấy hóa đơn. Vui lòng thử lại.' }
  }
}

export async function voHieuHoaNguoiLayHd(_: KetQua, data: FormData): Promise<KetQua> {
  try {
    const phien = await batBuocAdmin()
    const id = z.string().uuid().parse(data.get('id'))
    await trongTransaction(phien.id, async client => {
      const result = await client.query('update nguoi_lay_hd set dang_hoat_dong=false where id=$1', [id])
      if (!result.rowCount) throw new Error('Không tìm thấy người lấy hóa đơn.')
    })
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    return { thanh_cong: 'Đã vô hiệu hóa người lấy hóa đơn.' }
  } catch (error) {
    return { loi: 'Không thể vô hiệu hóa người lấy hóa đơn. Vui lòng thử lại.' }
  }
}

export async function kichHoatNguoiLayHd(_: KetQua, data: FormData): Promise<KetQua> {
  try {
    const phien = await batBuocAdmin()
    const id = z.string().uuid().parse(data.get('id'))
    await trongTransaction(phien.id, async client => {
      const result = await client.query('update nguoi_lay_hd set dang_hoat_dong=true where id=$1', [id])
      if (!result.rowCount) throw new Error('Không tìm thấy người lấy hóa đơn.')
    })
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    return { thanh_cong: 'Đã kích hoạt lại người lấy hóa đơn.' }
  } catch (error) {
    return { loi: 'Không thể kích hoạt người lấy hóa đơn. Vui lòng thử lại.' }
  }
}
