'use server'

import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { layPhien } from '@/lib/xac-thuc/phien'
import { boCanhRong, dungMucLichSu, gomMaThamChieu, type BoCanh, type MucLichSu } from '@/lib/tai-chinh/lich-su'

// Đủ để thấy mọi thay đổi của một giao dịch mà không kéo về cả cuốn lịch sử.
const GIOI_HAN = 100
const schemaId = z.string().uuid()

type DongLichSu = {
  id: string | number; hanh_dong: string; tao_luc: Date
  ho_ten: string | null; ten_dang_nhap: string | null
  gia_tri_cu: unknown; gia_tri_moi: unknown
}

export type KetQuaLichSu = { muc: MucLichSu[]; loi?: string }

// Lịch sử là dữ liệu chỉ đọc nhưng vẫn là dữ liệu tài chính: phải có phiên hợp lệ,
// và mã bản ghi phải là UUID trước khi chạm vào cột uuid của bảng lich_su.
export async function layLichSuGiaoDich(id: unknown): Promise<KetQuaLichSu> {
  try {
    const phien = await layPhien()
    if (!phien) return { muc: [], loi: 'Phiên không hợp lệ. Vui lòng đăng nhập lại.' }
    const ma = schemaId.safeParse(id)
    if (!ma.success) return { muc: [], loi: 'Mã giao dịch không hợp lệ.' }

    const { rows } = await db.query<DongLichSu>(
      `select ls.id, ls.hanh_dong, ls.tao_luc, nd.ho_ten, nd.ten_dang_nhap, ls.gia_tri_cu, ls.gia_tri_moi
       from lich_su ls
       left join nguoi_dung nd on nd.id = ls.nguoi_thuc_hien
       where ls.bang = 'giao_dich' and ls.ban_ghi_id = $1
       order by ls.id desc
       limit $2`, [ma.data, GIOI_HAN])
    if (!rows.length) return { muc: [] }

    const boCanh = await traTen(rows)
    return { muc: rows.map(dong => dungMucLichSu(dong, boCanh)) }
  } catch {
    return { muc: [], loi: 'Không tải được lịch sử sửa. Kiểm tra kết nối và migration 002.' }
  }
}

// Lịch sử chỉ lưu mã, không lưu tên. Tra một lượt cho cả trang thay vì mỗi dòng một
// truy vấn, và chỉ tra những bảng thật sự xuất hiện trong dữ liệu. Tên bảng và tên cột
// ở đây là hằng viết trong mã, không bao giờ lấy từ client.
async function traTen(rows: ReadonlyArray<DongLichSu>): Promise<BoCanh> {
  const ma = gomMaThamChieu(rows)
  const boCanh = boCanhRong()
  const tra = async (bang: string, cotTen: string, ids: string[], dich: Record<string, string>) => {
    if (!ids.length) return
    const { rows: ketQua } = await db.query<Record<string, string>>(
      `select id, ${cotTen} as ten from ${bang} where id = any($1::uuid[])`, [ids])
    for (const dong of ketQua) dich[dong.id] = dong.ten
  }
  await Promise.all([
    tra('don_vi', 'ten', ma.donVi, boCanh.donVi),
    tra('nguoi_lay_hd', 'ten', ma.nguoiLayHd, boCanh.nguoiLayHd),
    tra('nguoi_dung', 'ho_ten', ma.nguoiDung, boCanh.nguoiDung),
  ])
  return boCanh
}
