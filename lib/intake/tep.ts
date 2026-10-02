import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { GOC_TEP } from '@/lib/tep/luu'
import { loaiTepThat, phanMoRong } from '@/lib/tep/kiem-tra'

export const GIOI_HAN_INTAKE = 10 * 1024 * 1024
const MIME_INTAKE = new Set(['application/pdf', 'application/xml'])

export type TepIntake = {
  duongDan: string
  tenGoc: string
  kichThuoc: number
  mime: string
}

function gocAnToan(): string {
  return path.resolve(GOC_TEP) + path.sep
}

function duongDanAnToan(tuongDoi: string): string | null {
  const goc = gocAnToan()
  const full = path.resolve(GOC_TEP, ...tuongDoi.split('/').filter(Boolean))
  return full.startsWith(goc) ? full : null
}

export async function kiemTraTepIntake(file: File): Promise<{ mime: string } | { loi: string }> {
  if (file.size === 0 || file.size > GIOI_HAN_INTAKE) return { loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' }
  const mime = await loaiTepThat(file)
  if (!mime || !MIME_INTAKE.has(mime)) return { loi: 'Chỉ nhận hóa đơn PDF hoặc XML.' }
  return { mime }
}

export async function luuTepIntake(file: File, prefix = randomUUID()): Promise<TepIntake> {
  const checked = await kiemTraTepIntake(file)
  if ('loi' in checked) throw new Error(checked.loi)
  const ext = phanMoRong(checked.mime)
  if (!ext) throw new Error('Loại tệp không được chấp nhận.')
  const tuongDoi = `intake/${prefix}/${randomUUID()}.${ext}`
  const full = duongDanAnToan(tuongDoi)
  if (!full) throw new Error('Đường dẫn tệp không hợp lệ.')
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })
  return { duongDan: tuongDoi, tenGoc: file.name.slice(0, 255) || `hoa-don.${ext}`, kichThuoc: file.size, mime: checked.mime }
}

export async function docTepIntake(row: {
  tep_tam_duong_dan: string | null
  tep_tam_ten_goc: string | null
  tep_tam_mime: string | null
}): Promise<File> {
  if (!row.tep_tam_duong_dan || !row.tep_tam_ten_goc || !row.tep_tam_mime) throw new Error('Intake chưa có tệp.')
  const full = duongDanAnToan(row.tep_tam_duong_dan)
  if (!full) throw new Error('Đường dẫn tệp không hợp lệ.')
  const bytes = await readFile(full)
  return new File([bytes], row.tep_tam_ten_goc, { type: row.tep_tam_mime })
}

export async function xoaTepIntake(duongDan: string | null | undefined): Promise<void> {
  if (!duongDan) return
  const full = duongDanAnToan(duongDan)
  if (!full) return
  try { await unlink(full) } catch { /* tệp có thể đã được chuyển hoặc dọn */ }
}
