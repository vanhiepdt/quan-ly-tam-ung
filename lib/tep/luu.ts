import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { loaiTepThat, phanMoRong } from './kiem-tra'
import { laLoaiTep, LOAI_TEP_CHI_PDF, type LoaiTep } from './loai'

export const GOC_TEP = process.env.UPLOAD_DIR ?? '/var/lib/tam-ung/tep'
const GIOI_HAN = 10 * 1024 * 1024

export type KetQuaLuuTep =
  | { ok: true; loai: LoaiTep; tuongDoi: string; tenGoc: string; kichThuoc: number; mime: string }
  | { ok: false; loi: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function kiemTraVaLuuTep(tep: File, loaiChu: string, giaoDichId: string): Promise<KetQuaLuuTep> {
  if (!laLoaiTep(loaiChu) || !UUID.test(giaoDichId)) return { ok: false, loi: 'Dữ liệu tải lên không hợp lệ.' }
  if (tep.size === 0 || tep.size > GIOI_HAN) return { ok: false, loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' }
  const mime = await loaiTepThat(tep)
  const ext = mime && phanMoRong(mime)
  if (!mime || !ext) return { ok: false, loi: 'Loại tệp không được chấp nhận.' }
  if (LOAI_TEP_CHI_PDF.has(loaiChu) && mime !== 'application/pdf') {
    return { ok: false, loi: 'Tờ trình và giấy đề nghị đã ký chỉ nhận PDF.' }
  }
  const ten = `${randomUUID()}.${ext}`
  const tuongDoi = `${giaoDichId}/${ten}`
  const goc = path.resolve(GOC_TEP) + path.sep
  const dich = path.resolve(GOC_TEP, ...tuongDoi.split('/'))
  if (!dich.startsWith(goc)) return { ok: false, loi: 'Đường dẫn không hợp lệ.' }
  await mkdir(path.dirname(dich), { recursive: true })
  await writeFile(dich, Buffer.from(await tep.arrayBuffer()), { flag: 'wx' })
  return { ok: true, loai: loaiChu, tuongDoi, tenGoc: tep.name.slice(0, 255), kichThuoc: tep.size, mime }
}

export async function xoaTepVatLy(tuongDoi: string) {
  const goc = path.resolve(GOC_TEP) + path.sep
  const duongDan = path.resolve(GOC_TEP, ...tuongDoi.split('/').filter(Boolean))
  if (!duongDan.startsWith(goc)) return
  try { await unlink(duongDan) } catch { /* tệp có thể chưa tồn tại */ }
}
