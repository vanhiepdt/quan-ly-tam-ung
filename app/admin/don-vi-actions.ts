'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaDonVi } from '@/lib/validation/don-vi'
import { khoaTenDonVi, phanTichDonViExcel } from '@/lib/admin/nhap-don-vi-excel'

export type KetQua = { loi?: string; thanhCong?: string }

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

export async function voHieuHoaNhieuDonVi(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const giaTri = formData.getAll('id')
  const ids = [...new Set(giaTri.map(value => typeof value === 'string' ? value : '').filter(Boolean))]
  if (!ids.length || ids.some(id => !schemaId.safeParse(id).success)) return { loi: 'Danh sách đơn vị được chọn không hợp lệ.' }
  if (ids.length > 5000) return { loi: 'Mỗi lần chỉ được xóa tối đa 5.000 đơn vị.' }
  try {
    const result = await trongTransaction(phien.id, (client) =>
      client.query(
        'update don_vi set dang_hoat_dong=false, sua_luc=now(), nguoi_sua=$1 where id=any($2::uuid[]) and dang_hoat_dong',
        [phien.id, ids]
      )
    )
    const soLuong = result.rowCount ?? 0
    if (!soLuong) return { loi: 'Không có đơn vị đang hoạt động nào được chọn.' }
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    revalidatePath('/cai-dat')
    return { thanhCong: `Đã xóa ${soLuong} đơn vị khỏi danh sách đang sử dụng.` }
  } catch {
    return { loi: 'Không thể xóa các đơn vị đã chọn.' }
  }
}

export async function nhapDonViExcel(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin')
  const value = formData.get('tep_excel')
  if (!value || typeof value !== 'object' || !('arrayBuffer' in value) || typeof value.arrayBuffer !== 'function') {
    return { loi: 'Hãy chọn tệp Excel để nhập.' }
  }

  let items: Awaited<ReturnType<typeof phanTichDonViExcel>>
  try {
    items = await phanTichDonViExcel(value as Parameters<typeof phanTichDonViExcel>[0])
  } catch (error) {
    return { loi: error instanceof Error ? error.message : 'Không đọc được tệp Excel.' }
  }

  try {
    const thongKe = await trongTransaction(phien.id, async client => {
      const { rows } = await client.query<{ id: string; ten: string; ghi_chu: string | null; dang_hoat_dong: boolean }>(
        'select id,ten,ghi_chu,dang_hoat_dong from don_vi order by dang_hoat_dong desc,id'
      )
      const hienCo = new Map<string, { id: string; ghi_chu: string | null; dang_hoat_dong: boolean }>()
      for (const row of rows) {
        const key = khoaTenDonVi(row.ten)
        const current = hienCo.get(key)
        if (!current || (!current.dang_hoat_dong && row.dang_hoat_dong)) {
          hienCo.set(key, { id: row.id, ghi_chu: row.ghi_chu, dang_hoat_dong: row.dang_hoat_dong })
        }
      }

      let them = 0
      let kichHoat = 0
      let capNhatGhiChu = 0
      let boQua = 0
      for (const item of items) {
        const current = hienCo.get(item.khoaTen)
        if (!current) {
          await client.query(
            'insert into don_vi (ten,ghi_chu,nguoi_tao,nguoi_sua) values ($1,$2,$3,$3)',
            [item.ten, item.ghi_chu, phien.id]
          )
          them += 1
          continue
        }

        if (!current.dang_hoat_dong) {
          await client.query(
            'update don_vi set dang_hoat_dong=true, ghi_chu=coalesce($1,ghi_chu), sua_luc=now(), nguoi_sua=$2 where id=$3',
            [item.ghi_chu, phien.id, current.id]
          )
          current.dang_hoat_dong = true
          if (item.ghi_chu) current.ghi_chu = item.ghi_chu
          kichHoat += 1
          continue
        }

        if (item.ghi_chu && item.ghi_chu !== current.ghi_chu) {
          await client.query(
            'update don_vi set ghi_chu=$1, sua_luc=now(), nguoi_sua=$2 where id=$3',
            [item.ghi_chu, phien.id, current.id]
          )
          current.ghi_chu = item.ghi_chu
          capNhatGhiChu += 1
        } else {
          boQua += 1
        }
      }
      return { them, kichHoat, capNhatGhiChu, boQua }
    })
    revalidatePath('/admin')
    revalidatePath('/giao-dich')
    revalidatePath('/cai-dat')
    const chiTiet = [
      thongKe.them ? `thêm ${thongKe.them}` : '',
      thongKe.kichHoat ? `kích hoạt lại ${thongKe.kichHoat}` : '',
      thongKe.capNhatGhiChu ? `cập nhật ghi chú ${thongKe.capNhatGhiChu}` : '',
      thongKe.boQua ? `bỏ qua ${thongKe.boQua}` : '',
    ].filter(Boolean).join(', ')
    return { thanhCong: `Đã nhập danh sách đơn vị${chiTiet ? `: ${chiTiet}` : ''}.` }
  } catch (error: unknown) {
    return loiLuuDonVi(error)
  }
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
