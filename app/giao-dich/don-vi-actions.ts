'use server'

import { revalidatePath } from 'next/cache'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaDonVi } from '@/lib/validation/don-vi'

export type KetQuaThemDonViNhanh = {
  loi?: string
  thanhCong?: string
  id?: string
  ten?: string
}

function loiLuu(error: unknown): KetQuaThemDonViNhanh {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return { loi: 'Tên đơn vị đã tồn tại.' }
  }
  return { loi: 'Không thể lưu đơn vị.' }
}

// Người nhập liệu được thêm đơn vị ngay trên form giao dịch, không cần vào Quản trị.
export async function themDonViNhanh(tenTho: string): Promise<KetQuaThemDonViNhanh> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const parsed = schemaDonVi.safeParse({ ten: tenTho })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Tên đơn vị không hợp lệ.' }
  const ten = parsed.data.ten

  try {
    const kq = await trongTransaction(phien.id, async (client) => {
      const { rows } = await client.query<{ id: string; ten: string; dang_hoat_dong: boolean }>(
        'select id, ten, dang_hoat_dong from don_vi where lower(ten) = lower($1) limit 1',
        [ten],
      )
      const san = rows[0]
      if (san) {
        if (!san.dang_hoat_dong) {
          const cap = await client.query(
            'update don_vi set dang_hoat_dong=true, sua_luc=now(), nguoi_sua=$1 where id=$2',
            [phien.id, san.id],
          )
          if (cap.rowCount !== 1) return { loi: 'Không thể lưu đơn vị.' }
        }
        return { id: san.id, ten: san.ten, thanhCong: 'Đã chọn đơn vị có sẵn.' }
      }
      const them = await client.query<{ id: string; ten: string }>(
        'insert into don_vi (ten, nguoi_tao, nguoi_sua) values ($1, $2, $2) returning id, ten',
        [ten, phien.id],
      )
      if (them.rowCount !== 1 || !them.rows[0]) return { loi: 'Không thể lưu đơn vị.' }
      return { id: them.rows[0].id, ten: them.rows[0].ten, thanhCong: 'Đã thêm đơn vị.' }
    })
    if (kq.loi) return kq
    revalidatePath('/giao-dich')
    revalidatePath('/admin')
    return kq
  } catch (error: unknown) {
    return loiLuu(error)
  }
}
