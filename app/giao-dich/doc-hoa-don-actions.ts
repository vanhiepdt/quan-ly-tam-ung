'use server'

import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { loaiTepThat } from '@/lib/tep/kiem-tra'
import { docCauHinhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { danhGiaTinhTrangAi, type TinhTrangAi } from '@/lib/kiem-tra/ai-hoa-don'
import { docCauHinhAi } from '@/lib/kiem-tra/cau-hinh-ai'
import { docHoaDonHaiLop } from '@/lib/kiem-tra/doc-hoa-don'
import type { KetQuaDocHoaDon } from '@/lib/kiem-tra/giao-dien'

const GIOI_HAN = 10 * 1024 * 1024
const MIME_ANH = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export type KetQuaDocHoaDonAction = { loi?: string } & Partial<KetQuaDocHoaDon>
export type { TinhTrangAi }

export async function tinhTrangAiHoaDon(): Promise<TinhTrangAi> {
  await batBuocVaiTro('admin', 'nhap_lieu')
  return danhGiaTinhTrangAi(await docCauHinhAi())
}

// Đề xuất điền form, không ghi database. QR thắng trên số liệu in sẵn; AI điền phần còn lại.
export async function docHoaDon(form: FormData): Promise<KetQuaDocHoaDonAction> {
  await batBuocVaiTro('admin', 'nhap_lieu')
  const tep = form.get('tep')
  if (!(tep instanceof File)) return { loi: 'Hãy chọn tệp hóa đơn PDF hoặc ảnh.' }
  if (tep.size === 0 || tep.size > GIOI_HAN) return { loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' }
  const mime = await loaiTepThat(tep)
  if (!mime || !MIME_ANH.has(mime)) return { loi: 'Chỉ nhận PDF hoặc ảnh JPEG/PNG/WEBP.' }
  const cauHinh = await docCauHinhGiay()
  try {
    return await docHoaDonHaiLop(new Uint8Array(await tep.arrayBuffer()), mime, {
      mst: cauHinh.mstDonVi,
      ten: cauHinh.tenMuaHangDonVi || cauHinh.tenDonVi,
      diaChi: cauHinh.diaChiDonVi,
    })
  } catch {
    return { loi: 'Không đọc được hóa đơn. Hãy thử ảnh rõ hơn hoặc nhập tay.' }
  }
}
