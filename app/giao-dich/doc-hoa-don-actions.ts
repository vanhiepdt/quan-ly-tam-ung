'use server'

import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { danhGiaTinhTrangHaiAi, type TinhTrangHaiAi } from '@/lib/kiem-tra/ai-hoa-don'
import { docCauHinhAi } from '@/lib/kiem-tra/cau-hinh-ai'
import type { KetQuaDocHoaDon } from '@/lib/kiem-tra/giao-dien'
import { docHoaDonIntake } from '@/lib/intake/doc-hoa-don'

const GIOI_HAN = 10 * 1024 * 1024

export type KetQuaDocHoaDonAction = { loi?: string } & Partial<KetQuaDocHoaDon>
export type { TinhTrangHaiAi }

export async function tinhTrangHaiAiHoaDon(): Promise<TinhTrangHaiAi> {
  await batBuocVaiTro('admin', 'nhap_lieu')
  return danhGiaTinhTrangHaiAi(await docCauHinhAi())
}

// Đề xuất điền form, không ghi database. Hai AI được gọi độc lập để đối chiếu.
export async function docHoaDon(form: FormData): Promise<KetQuaDocHoaDonAction> {
  await batBuocVaiTro('admin', 'nhap_lieu')
  const tep = form.get('tep')
  if (!(tep instanceof File)) return { loi: 'Hãy chọn tệp hóa đơn PDF hoặc XML.' }
  if (tep.size === 0 || tep.size > GIOI_HAN) return { loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' }
  try {
    return await docHoaDonIntake(tep)
  } catch (error) {
    if (error instanceof Error && /Chỉ nhận|Tệp phải/.test(error.message)) return { loi: error.message }
    return { loi: 'Không đọc được hóa đơn. Hãy kiểm tra tệp PDF/XML hoặc nhập tay.' }
  }
}
