import ExcelJS from 'exceljs'
import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { cotXuatNhatKy, DINH_DANG_NGAY_EXCEL, DINH_DANG_TIEN_VND_EXCEL, giaTriXuatNhatKy, type TepXuatNhatKy } from './xuat-nhat-ky-excel'

const HEADER_FILL = 'FF1F4E78'
const ALT_FILL = 'FFF8FAFC'
const BORDER = { color: { argb: 'FFD9E2EC' }, style: 'thin' as const }

function attachmentsOf(teps: ReadonlyMap<string, readonly TepXuatNhatKy[]>, id: string) {
  return teps.get(id) ?? []
}

function fileText(files: readonly TepXuatNhatKy[]) {
  if (!files.length) return 'Chưa có tệp'
  return files.map(file => file.tenGoc + (file.tonTai ? '' : ' (không tìm thấy trên máy chủ)')).join('\n')
}

function headerStyle(row: ExcelJS.Row) {
  row.height = 32
  row.eachCell(cell => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { color: { argb: 'FFFFFFFF' }, style: 'thin' } }
  })
}

function bodyStyle(row: ExcelJS.Row, alternate: boolean) {
  row.height = 30
  row.eachCell(cell => {
    cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF0F172A' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: BORDER }
    if (alternate) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_FILL } }
  })
}

function setLink(cell: ExcelJS.Cell, text: string, target: string, tooltip: string) {
  cell.value = { text, hyperlink: target, tooltip }
  cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF4338CA' }, underline: true }
}

export async function taoWorkbookNhatKyServer(
  rows: readonly GiaoDichTinh[],
  teps: ReadonlyMap<string, readonly TepXuatNhatKy[]>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Quản lý tạm ứng'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.properties.date1904 = false

  const sheet = workbook.addWorksheet('Nhật ký giao dịch', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] })
  sheet.columns = cotXuatNhatKy.map(column => ({
    key: column.id,
    width: Math.max(12, Math.min(42, Math.round(column.rong / 7))),
  }))
  sheet.addRow(cotXuatNhatKy.map(column => column.ten))
  headerStyle(sheet.getRow(1))

  rows.forEach((row, index) => {
    const files = attachmentsOf(teps, row.id)
    const values = cotXuatNhatKy.map(column => column.id === 'tep' ? fileText(files) : giaTriXuatNhatKy(row, column.id))
    const excelRow = sheet.addRow(values)
    bodyStyle(excelRow, index % 2 === 1)
    cotXuatNhatKy.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1)
      if (column.id === 'ngay') cell.numFmt = DINH_DANG_NGAY_EXCEL
      if (column.kieu === 'so') {
        cell.numFmt = DINH_DANG_TIEN_VND_EXCEL
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true }
      }
    })
    const first = files.find(file => file.tonTai)
    if (first) {
      const columnIndex = cotXuatNhatKy.findIndex(column => column.id === 'tep')
      setLink(excelRow.getCell(columnIndex + 1), fileText(files), first.zipPath, 'Mở thư mục tệp đính kèm sau khi giải nén')
    }
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: cotXuatNhatKy.length } }
  sheet.pageSetup.orientation = 'landscape'
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
  sheet.headerFooter.oddFooter = 'Trang &P / &N'

  const attachmentSheet = workbook.addWorksheet('Tệp đính kèm', { views: [{ state: 'frozen', ySplit: 1 }] })
  const attachmentColumns = [
    { key: 'giaoDich', header: 'Giao dịch', width: 24 },
    { key: 'ngay', header: 'Ngày', width: 14 },
    { key: 'noiDung', header: 'Nội dung', width: 42 },
    { key: 'loai', header: 'Loại tệp', width: 18 },
    { key: 'ten', header: 'Tên tệp', width: 42 },
    { key: 'mo', header: 'Mở tệp', width: 18 },
  ]
  attachmentSheet.columns = attachmentColumns.map(({ key, width }) => ({ key, width }))
  attachmentSheet.addRow(attachmentColumns.map(column => column.header))
  headerStyle(attachmentSheet.getRow(1))
  let attachmentRow = 1
  for (const row of rows) {
    for (const file of attachmentsOf(teps, row.id)) {
      attachmentRow += 1
      const excelRow = attachmentSheet.addRow([row.id, new Date(row.ngay + 'T00:00:00Z'), row.noiDung, file.loai, file.tenGoc, ''])
      bodyStyle(excelRow, attachmentRow % 2 === 1)
      excelRow.getCell(2).numFmt = DINH_DANG_NGAY_EXCEL
      if (file.tonTai) setLink(excelRow.getCell(6), 'Mở tệp', file.zipPath, 'Mở ' + file.tenGoc)
      else excelRow.getCell(6).value = 'Không tìm thấy'
    }
  }
  if (attachmentRow === 1) {
    const empty = attachmentSheet.addRow(['', '', '', '', 'Chưa có tệp đính kèm', ''])
    bodyStyle(empty, false)
  }
  attachmentSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, attachmentRow), column: attachmentColumns.length } }
  attachmentSheet.pageSetup.orientation = 'landscape'

  const data = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(data) ? data : Buffer.from(data)
}
