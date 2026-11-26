'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db, trongTransaction } from '@/lib/db/pool'
import { khoaSoTaiChinh } from '@/lib/tai-chinh/xac-nhan-hoan-ung'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'

const uuid = z.string().uuid()
const loai = z.enum(['Hoàn tạm ứng', 'Cơ quan trả thẳng'])
const nguon = z.enum(['quy_chi_thuy', 'so_du'])

export type KetQuaHoiNghi = { ok?: boolean; loi?: string; id?: string; soGiaoDich?: number }

export async function taoHoiNghi(_: unknown, formData: FormData): Promise<KetQuaHoiNghi> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const parsed = z.object({ ten: z.string().trim().min(1).max(1000), ngay: z.string().date(), ghiChu: z.string().trim().min(1).max(5000), loaiGiaoDich: loai, nguonPhi: nguon }).safeParse({
    ten: formData.get('ten'), ngay: formData.get('ngay'), ghiChu: String(formData.get('ghi_chu') ?? ''), loaiGiaoDich: formData.get('loai_giao_dich'), nguonPhi: formData.get('nguon_phi'),
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Thông tin Hội nghị không hợp lệ.' }
  const result = await db.query<{ id: string }>(`insert into hoi_nghi(ten,ngay,ghi_chu,loai_giao_dich,nguon_phi,nguoi_tao,nguoi_sua) values($1,$2,$3,$4,$5,$6,$6) returning id`, [parsed.data.ten, parsed.data.ngay, parsed.data.ghiChu || null, parsed.data.loaiGiaoDich, parsed.data.nguonPhi, phien.id])
  revalidatePath('/giao-dich/theo-doi')
  return { ok: true, id: result.rows[0].id }
}

export async function layHoiNghi(id: unknown) {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu', 'chi_doc')
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return null
  const result = await db.query(`select h.*, count(g.id)::int as so_giao_dich, coalesce(sum(g.tong_tien),0)::bigint as tong_tien, coalesce(sum(g.tien_duoc_thanh_toan),0)::bigint as tien_duoc_thanh_toan from hoi_nghi h left join giao_dich g on g.hoi_nghi_id=h.id and not g.da_xoa where h.id=$1 and not h.da_xoa group by h.id`, [parsed.data])
  return result.rows[0] ?? null
}

export async function capNhatHoiNghi(_: unknown, formData: FormData): Promise<KetQuaHoiNghi> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const parsed = z.object({ id: uuid, ten: z.string().trim().min(1).max(1000), ngay: z.string().date(), ghiChu: z.string().trim().min(1).max(5000), nguonPhi: nguon }).safeParse({ id: formData.get('id'), ten: formData.get('ten'), ngay: formData.get('ngay'), ghiChu: String(formData.get('ghi_chu') ?? ''), nguonPhi: formData.get('nguon_phi') })
  if (!parsed.success) return { loi: 'Thông tin Hội nghị không hợp lệ.' }
  await db.query('update hoi_nghi set ten=$1, ngay=$2, ghi_chu=$3, nguon_phi=$4, sua_luc=now(), nguoi_sua=$5 where id=$6 and not da_xoa', [parsed.data.ten, parsed.data.ngay, parsed.data.ghiChu || null, parsed.data.nguonPhi, phien.id, parsed.data.id])
  revalidatePath('/giao-dich/theo-doi')
  return { ok: true }
}

// Xóa mềm Hội nghị cùng mọi giao dịch con trong một transaction, khóa sổ như khi xóa
// một giao dịch lẻ để số dư không bị tính giữa chừng. Tệp chứng từ của Hội nghị giữ nguyên.
export async function xoaMemHoiNghi(id: unknown): Promise<KetQuaHoiNghi> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return { loi: 'Mã Hội nghị không hợp lệ.' }
  const soGiaoDich = await trongTransaction(phien.id, async (client) => {
    await khoaSoTaiChinh(client)
    const hoiNghi = await client.query('select 1 from hoi_nghi where id=$1 and not da_xoa for update', [parsed.data])
    if (!hoiNghi.rowCount) return null
    const giaoDich = await client.query(`update giao_dich set da_xoa=true, xoa_luc=now(), nguoi_xoa=$1,
      sua_luc=now(), nguoi_sua=$1 where hoi_nghi_id=$2 and not da_xoa`, [phien.id, parsed.data])
    await client.query('update hoi_nghi set da_xoa=true, sua_luc=now(), nguoi_sua=$1 where id=$2', [phien.id, parsed.data])
    return giaoDich.rowCount ?? 0
  })
  if (soGiaoDich === null) return { loi: 'Hội nghị không còn hoặc đã bị xóa.' }
  revalidatePath('/giao-dich')
  revalidatePath('/giao-dich/theo-doi')
  revalidatePath('/dashboard')
  return { ok: true, soGiaoDich }
}
