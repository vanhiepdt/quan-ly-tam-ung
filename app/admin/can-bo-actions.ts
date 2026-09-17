'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaCanBo } from '@/lib/validation/can-bo'

type KetQua = { loi?: string; thanhCong?: string }

const schemaId = z.string().uuid()

// Cán bộ xuất hiện trên giấy đề nghị nên phải làm mới cả trang nhật ký và trang cài đặt,
// nơi chọn người ký mặc định.
function lamMoi() {
  revalidatePath('/admin')
  revalidatePath('/cai-dat')
  revalidatePath('/giao-dich')
}

function loiLuu(error: unknown): KetQua {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return { loi: 'Tài khoản đăng nhập này đã gắn với một cán bộ khác.' }
    if (error.code === '23503') return { loi: 'Tài khoản đăng nhập không tồn tại.' }
  }
  return { loi: 'Không thể lưu cán bộ.' }
}

function docForm(formData: FormData) {
  return schemaCanBo.safeParse({
    ho_ten: formData.get('ho_ten'),
    gioi_tinh: formData.get('gioi_tinh') || null,
    chuc_danh: formData.get('chuc_danh'),
    phong: formData.get('phong'),
    la_lanh_dao: formData.get('la_lanh_dao') === 'on',
    nguoi_dung_id: formData.get('nguoi_dung_id') || null,
  })
}

export async function themCanBo(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const parsed = docForm(formData)
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }

  const d = parsed.data
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'insert into can_bo (ho_ten, gioi_tinh, chuc_danh, phong, la_lanh_dao, nguoi_dung_id, nguoi_tao, nguoi_sua) values ($1,$2,$3,$4,$5,$6,$7,$7)',
        [d.ho_ten, d.gioi_tinh, d.chuc_danh, d.phong, d.la_lanh_dao, d.nguoi_dung_id, phien.id]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không thể lưu cán bộ.' }
  } catch (error: unknown) {
    return loiLuu(error)
  }
  lamMoi()
  return { thanhCong: 'Đã thêm cán bộ.' }
}

export async function suaCanBo(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã cán bộ không hợp lệ.' }
  const parsed = docForm(formData)
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }

  const d = parsed.data
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'update can_bo set ho_ten=$1, gioi_tinh=$2, chuc_danh=$3, phong=$4, la_lanh_dao=$5, nguoi_dung_id=$6, sua_luc=now(), nguoi_sua=$7 where id=$8',
        [d.ho_ten, d.gioi_tinh, d.chuc_danh, d.phong, d.la_lanh_dao, d.nguoi_dung_id, phien.id, id.data]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy cán bộ.' }
  } catch (error: unknown) {
    return loiLuu(error)
  }
  lamMoi()
  return { thanhCong: 'Đã cập nhật cán bộ.' }
}

export async function voHieuHoaCanBo(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã cán bộ không hợp lệ.' }
  try {
    // Không xóa cán bộ: giao dịch đã in giấy vẫn cần tra ra người ký.
    const result = await trongTransaction(phien.id, (client) =>
      client.query('update can_bo set dang_hoat_dong=false, sua_luc=now(), nguoi_sua=$1 where id=$2', [phien.id, id.data])
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy cán bộ.' }
  } catch {
    return { loi: 'Không thể lưu cán bộ.' }
  }
  lamMoi()
  return { thanhCong: 'Đã vô hiệu hóa cán bộ.' }
}

export async function kichHoatCanBo(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã cán bộ không hợp lệ.' }
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query('update can_bo set dang_hoat_dong=true, sua_luc=now(), nguoi_sua=$1 where id=$2', [phien.id, id.data])
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy cán bộ.' }
  } catch {
    return { loi: 'Không thể lưu cán bộ.' }
  }
  lamMoi()
  return { thanhCong: 'Đã kích hoạt cán bộ.' }
}
