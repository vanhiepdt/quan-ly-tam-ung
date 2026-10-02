import * as XLSX from 'xlsx'
import { schemaDonVi } from '@/lib/validation/don-vi'

export const GIOI_HAN_TEP_DON_VI = 5 * 1024 * 1024
export const GIOI_HAN_DONG_DON_VI = 5000

export type DonViExcelItem = {
  ten: string
  ghi_chu: string | null
  khoaTen: string
}

type TepCoTheDoc = {
  name: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function vanBan(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).normalize('NFC').replace(/\s+/g, ' ').trim()
}

export function khoaTenDonVi(value: string): string {
  return vanBan(value).toLocaleLowerCase('vi')
}

function khoaTieuDe(value: unknown): string {
  return vanBan(value).toLocaleLowerCase('vi').replace(/\s+/g, ' ')
}

function loiDong(dong: number, loi: string): Error {
  return new Error(`Dòng ${dong}: ${loi}`)
}

function timCot(tieuDe: unknown[], cacTen: string[]): number {
  const choPhep = new Set(cacTen)
  return tieuDe.findIndex(item => choPhep.has(khoaTieuDe(item)))
}

export async function phanTichDonViExcel(file: TepCoTheDoc): Promise<DonViExcelItem[]> {
  const tenTep = vanBan(file.name)
  if (!/\.(?:xlsx|xls)$/i.test(tenTep)) {
    throw new Error('Chỉ nhận tệp Excel có đuôi .xlsx hoặc .xls.')
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > GIOI_HAN_TEP_DON_VI) {
    throw new Error('Tệp Excel phải lớn hơn 0 và không quá 5 MB.')
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: false })
  } catch {
    throw new Error('Không đọc được tệp Excel. Hãy kiểm tra tệp có bị hỏng không.')
  }
  const tenSheet = workbook.SheetNames[0]
  if (!tenSheet) throw new Error('Tệp Excel chưa có trang tính.')
  const sheet = workbook.Sheets[tenSheet]
  const dong = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false })
  if (!dong.length) throw new Error('Tệp Excel chưa có dữ liệu.')
  if (dong.length - 1 > GIOI_HAN_DONG_DON_VI) {
    throw new Error(`Tệp Excel chỉ được tối đa ${GIOI_HAN_DONG_DON_VI.toLocaleString('vi-VN')} dòng dữ liệu.`)
  }

  const tieuDe = dong[0] ?? []
  const cotTen = timCot(tieuDe, ['tên đơn vị', 'ten don vi', 'ten', 'ten_don_vi'])
  const cotGhiChu = timCot(tieuDe, ['ghi chú', 'ghi chu', 'ghi_chu', 'note'])
  if (cotTen < 0) throw new Error('Tệp Excel phải có cột “Tên đơn vị” (hoặc “ten”, “ten_don_vi”).')

  const ketQua: DonViExcelItem[] = []
  const daCo = new Map<string, number>()
  for (let index = 1; index < dong.length; index += 1) {
    const hang = dong[index] ?? []
    if (hang.every(value => !vanBan(value))) continue
    const ten = vanBan(hang[cotTen])
    const ghiChu = cotGhiChu >= 0 ? vanBan(hang[cotGhiChu]) : ''
    const parsed = schemaDonVi.safeParse({ ten, ghi_chu: ghiChu })
    if (!parsed.success) throw loiDong(index + 1, parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.')

    const khoaTen = khoaTenDonVi(parsed.data.ten)
    const dongTruoc = daCo.get(khoaTen)
    if (dongTruoc) throw loiDong(index + 1, `Tên đơn vị trùng với dòng ${dongTruoc}.`)
    daCo.set(khoaTen, index + 1)
    ketQua.push({ ten: parsed.data.ten, ghi_chu: parsed.data.ghi_chu ?? null, khoaTen })
  }
  if (!ketQua.length) throw new Error('Tệp Excel không có dòng đơn vị hợp lệ.')
  return ketQua
}
