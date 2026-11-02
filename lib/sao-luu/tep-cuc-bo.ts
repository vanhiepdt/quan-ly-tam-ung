import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

// Gói sao lưu nằm sẵn trên VPS (kể cả khi tải lên Drive thất bại). Chỉ nhận đúng dạng
// tên do worker tạo, nên không thể dùng route tải về để đọc tệp khác.
export const TEN_GOI_SAO_LUU = /^tam-ung-\d{8}-\d{6}\.tar\.gz$/

export type TepSaoLuuCucBo = { ten: string; kichThuoc: number; suaLuc: string }

export function thuMucSaoLuu(): string {
  return process.env.BACKUP_DIR?.trim() || '/var/lib/tam-ung/backup'
}

export async function dsTepSaoLuuCucBo(gioiHan = 30): Promise<TepSaoLuuCucBo[]> {
  const dir = thuMucSaoLuu()
  let ten: string[]
  try { ten = await readdir(dir) } catch { return [] }
  const ds: TepSaoLuuCucBo[] = []
  for (const name of ten.filter(n => TEN_GOI_SAO_LUU.test(n))) {
    const info = await stat(path.join(dir, name)).catch(() => null)
    if (info?.isFile()) ds.push({ ten: name, kichThuoc: info.size, suaLuc: info.mtime.toISOString() })
  }
  return ds.sort((a, b) => b.ten.localeCompare(a.ten)).slice(0, gioiHan)
}

// Trả đường dẫn tuyệt đối khi tên hợp lệ và tệp có thật; ngược lại null.
export async function duongDanTepSaoLuu(ten: string): Promise<{ duongDan: string; kichThuoc: number } | null> {
  if (!TEN_GOI_SAO_LUU.test(ten)) return null
  const duongDan = path.join(thuMucSaoLuu(), ten)
  const info = await stat(duongDan).catch(() => null)
  return info?.isFile() ? { duongDan, kichThuoc: info.size } : null
}
