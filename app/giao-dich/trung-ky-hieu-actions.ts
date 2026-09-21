'use server'

import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { db } from '@/lib/db/pool'
import { thongBaoTrungKyHieu } from '@/lib/tai-chinh/trung-ky-hieu'

export type KetQuaTrungKyHieu = { canhBao?: string }

// Chỉ cảnh báo, không chặn lưu, không tạo chỉ mục duy nhất.
export async function kiemTraTrungKyHieu(kyHieuTho: string): Promise<KetQuaTrungKyHieu> {
  await batBuocVaiTro('admin', 'nhap_lieu')
  const ky = kyHieuTho.trim()
  if (!ky || ky.length > 50) return {}
  try {
    const { rows } = await db.query<{ ngay: string; so_hd: string | null }>(
      `select to_char(ngay, 'DD/MM/YYYY') as ngay, so_hd
       from giao_dich
       where not da_xoa
         and ky_hieu_hd is not null and btrim(ky_hieu_hd) <> ''
         and lower(btrim(ky_hieu_hd)) = lower($1)
       order by ngay desc, tao_luc desc
       limit 5`,
      [ky],
    )
    const canhBao = thongBaoTrungKyHieu(ky, rows.map(r => ({ ngay: r.ngay, soHd: r.so_hd })))
    return canhBao ? { canhBao } : {}
  } catch {
    return {}
  }
}
