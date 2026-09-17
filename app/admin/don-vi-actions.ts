'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaDonVi } from '@/lib/validation/don-vi'

type KetQua = { loi?: string; thanhCong?: string }

const schemaId = z.string().uuid()

function loiLuuDonVi(error: unknown): KetQua {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return { loi: 'Tên đơn vị đã tồn tại.' }
  }
  return { loi: 'Không thể lưu đơn vị.' }
}

export async function themDonVi(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const parsed = schemaDonVi.safeParse({
    ten: formData.get('ten'),
    ghi_chu: formData.get('ghi_chu'),
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }

  const d = parsed.data
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'insert into don_vi (ten, ghi_chu, nguoi_tao, nguoi_sua) values ($1, $2, $3, $3)',
        [d.ten, d.ghi_chu, phien.id]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không thể lưu đơn vị.' }
  } catch (error: unknown) {
    return loiLuuDonVi(error)
  }
  revalidatePath('/admin')
  revalidatePath('/giao-dich')
  return { thanhCong: 'Đã thêm đơn vị.' }
}

export async function suaDonVi(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã đơn vị không hợp lệ.' }
  const parsed = schemaDonVi.safeParse({
    ten: formData.get('ten'),
    ghi_chu: formData.get('ghi_chu'),
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }

  const d = parsed.data
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'update don_vi set ten=$1, ghi_chu=$2, sua_luc=now(), nguoi_sua=$3 where id=$4',
        [d.ten, d.ghi_chu, phien.id, id.data]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy đơn vị.' }
  } catch (error: unknown) {
    return loiLuuDonVi(error)
  }
  revalidatePath('/admin')
  revalidatePath('/giao-dich')
  return { thanhCong: 'Đã cập nhật đơn vị.' }
}

export async function voHieuHoaDonVi(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã đơn vị không hợp lệ.' }
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'update don_vi set dang_hoat_dong=false, sua_luc=now(), nguoi_sua=$1 where id=$2',
        [phien.id, id.data]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy đơn vị.' }
  } catch {
    return { loi: 'Không thể lưu đơn vị.' }
  }
  revalidatePath('/admin')
  revalidatePath('/giao-dich')
  return { thanhCong: 'Đã vô hiệu hóa đơn vị.' }
}

export async function kichHoatDonVi(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã đơn vị không hợp lệ.' }
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'update don_vi set dang_hoat_dong=true, sua_luc=now(), nguoi_sua=$1 where id=$2',
        [phien.id, id.data]
      )
    )
    if (result.rowCount !== 1) return { loi: 'Không tìm thấy đơn vị.' }
  } catch {
    return { loi: 'Không thể lưu đơn vị.' }
  }
  revalidatePath('/admin')
  revalidatePath('/giao-dich')
  return { thanhCong: 'Đã kích hoạt đơn vị.' }
}
