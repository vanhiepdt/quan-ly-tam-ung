'use server'

import { db } from '@/lib/db/pool'
import { layPhien } from '@/lib/xac-thuc/phien'
import { cotMacDinh, tuyChonSchema, type TuyChonCot } from './cot-nhat-ky'

type KetQuaDoc = { tuyChon: TuyChonCot; loi?: string }

export async function docTuyChonCot(): Promise<KetQuaDoc> {
  try {
    const phien = await layPhien()
    if (!phien) return { tuyChon: cotMacDinh(), loi: 'Phiên không hợp lệ.' }
    const { rows } = await db.query<{ tuy_chon: unknown }>(
      'select tuy_chon from tuy_chon_cot_nhat_ky where nguoi_dung_id=$1', [phien.id],
    )
    if (!rows.length) return { tuyChon: cotMacDinh() }
    const ketQua = tuyChonSchema.safeParse(rows[0].tuy_chon)
    return ketQua.success ? { tuyChon: ketQua.data } : { tuyChon: cotMacDinh(), loi: 'Tùy chọn cũ không hợp lệ. Đang dùng cột mặc định.' }
  } catch {
    return { tuyChon: cotMacDinh(), loi: 'Không tải được tùy chọn cột. Kiểm tra kết nối và migration 005.' }
  }
}

export async function luuTuyChonCot(value: unknown): Promise<{ ok: boolean; thongBao: string }> {
  try {
    const phien = await layPhien()
    if (!phien) return { ok: false, thongBao: 'Phiên không hợp lệ. Vui lòng đăng nhập lại.' }
    const ketQua = tuyChonSchema.safeParse(value)
    if (!ketQua.success) return { ok: false, thongBao: 'Tùy chọn không hợp lệ: chiều rộng phải là số nguyên từ 90–600 px, số dòng mỗi trang là 10/20/50/100, và giữ ít nhất một cột dữ liệu.' }
    await db.query(`insert into tuy_chon_cot_nhat_ky (nguoi_dung_id, tuy_chon)
      values ($1, $2::jsonb) on conflict (nguoi_dung_id)
      do update set tuy_chon=excluded.tuy_chon, sua_luc=now()`, [phien.id, JSON.stringify(ketQua.data)])
    return { ok: true, thongBao: 'Đã lưu tùy chọn cột cho tài khoản này.' }
  } catch {
    return { ok: false, thongBao: 'Không lưu được tùy chọn cột. Thay đổi hiện chỉ áp dụng trên trang; vui lòng thử lại.' }
  }
}
