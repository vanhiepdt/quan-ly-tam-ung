import ExcelJS from 'exceljs'
import type { DongNhatKy, GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { cotXuatNhatKy, DINH_DANG_NGAY_EXCEL, DINH_DANG_TIEN_VND_EXCEL, giaTriXuatNhatKy, type TepXuatNhatKy } from './xuat-nhat-ky-excel'

export const TEN_SHEET_NHAT_KY = 'Nhật ký giao dịch'
const HEADER_FILL = 'FF1F4E78'
const ALT_FILL = 'FFF8FAFC'
const TOTAL_FILL = 'FFF1F5F9'
const BORDER = { color: { argb: 'FFD9E2EC' }, style: 'thin' as const }
const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

type CotXuat = typeof cotXuatNhatKy[number]
// Sheet Hội nghị đã ghi tên Hội nghị ở tiêu đề nên bỏ cột Hội nghị.
const COT_HOI_NGHI = cotXuatNhatKy.filter(column => column.id !== 'hoiNghi')

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

// Excel giới hạn tên sheet 31 ký tự và cấm các ký tự []:*?/\. Bỏ cả dấu nháy đơn để
// link nội bộ không phải thoát ký tự. Số thứ tự đứng đầu giữ cho tên luôn duy nhất.
export function tenSheetHoiNghi(stt: number, ten: string): string {
  const sach = ten.normalize('NFC').replace(/[[\]:*?\/\\']/g, ' ').replace(/\s+/g, ' ').trim()
  return ('HN' + stt + ' ' + sach).slice(0, 31).trim()
}

function lienKetSheet(ten: string, o = 'A1') {
  return "#'" + ten + "'!" + o
}

function ghiDongGiaoDich(sheet: ExcelJS.Worksheet, cols: readonly CotXuat[], row: GiaoDichTinh, files: readonly TepXuatNhatKy[], alternate: boolean) {
  const values = cols.map(column => column.id === 'tep' ? fileText(files) : giaTriXuatNhatKy(row, column.id))
  const excelRow = sheet.addRow(values)
  bodyStyle(excelRow, alternate)
  cols.forEach((column, columnIndex) => {
    const cell = excelRow.getCell(columnIndex + 1)
    if (column.id === 'ngay') cell.numFmt = DINH_DANG_NGAY_EXCEL
    if (column.kieu === 'so') {
      cell.numFmt = DINH_DANG_TIEN_VND_EXCEL
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true }
    }
  })
  const first = files.find(file => file.tonTai)
  if (first) {
    const columnIndex = cols.findIndex(column => column.id === 'tep')
    setLink(excelRow.getCell(columnIndex + 1), fileText(files), first.zipPath, 'Mở thư mục tệp đính kèm sau khi giải nén')
  }
  return excelRow
}

function themSheetHoiNghi(
  workbook: ExcelJS.Workbook, ten: string, row: DongNhatKy, con: readonly GiaoDichTinh[],
  teps: ReadonlyMap<string, readonly TepXuatNhatKy[]>, dongNhatKy: number,
) {
  const sheet = workbook.addWorksheet(ten, { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] })
  sheet.columns = COT_HOI_NGHI.map(column => ({
    key: column.id,
    width: Math.max(12, Math.min(42, Math.round(column.rong / 7))),
  }))
  const tieuDe = sheet.getCell('A1')
  tieuDe.value = 'Hội nghị: ' + row.noiDung
  tieuDe.font = { name: 'Aptos', size: 14, bold: true, color: { argb: HEADER_FILL } }
  sheet.getRow(1).height = 24
  const ngay = sheet.getCell('A2')
  ngay.value = new Date(row.ngay + 'T00:00:00Z')
  ngay.numFmt = DINH_DANG_NGAY_EXCEL
  ngay.font = { name: 'Aptos', size: 10, bold: true }
  ngay.alignment = { horizontal: 'left' }
  const tongTien = con.reduce((tong, r) => tong + r.tongTien, 0)
  sheet.getCell('B2').value = con.length + ' giao dịch con · Tổng tiền ' + vnd.format(tongTien) + ' VND'
  sheet.getCell('B2').font = { name: 'Aptos', size: 10 }
  setLink(sheet.getCell('A3'), '← Quay lại Nhật ký giao dịch', lienKetSheet(TEN_SHEET_NHAT_KY, 'A' + dongNhatKy), 'Về dòng Hội nghị trong Nhật ký giao dịch')

  sheet.getRow(4).values = COT_HOI_NGHI.map(column => column.ten)
  headerStyle(sheet.getRow(4))
  con.forEach((r, index) => ghiDongGiaoDich(sheet, COT_HOI_NGHI, r, attachmentsOf(teps, r.id), index % 2 === 1))
  if (con.length) {
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + con.length, column: COT_HOI_NGHI.length } }
    // Hàng tổng chỉ cộng các cột tiền phát sinh; cột số dư luỹ kế cộng lại không có nghĩa.
    const tong = sheet.addRow(COT_HOI_NGHI.map((column, index) => index === 0
      ? 'Tổng ' + con.length + ' giao dịch'
      : column.kieu === 'so' && column.congDon ? con.reduce((t, r) => t + Number(giaTriXuatNhatKy(r, column.id)), 0) : ''))
    tong.height = 26
    COT_HOI_NGHI.forEach((column, index) => {
      const cell = tong.getCell(index + 1)
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF0F172A' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
      cell.border = { top: { color: { argb: 'FF94A3B8' }, style: 'medium' } }
      cell.alignment = { vertical: 'middle', horizontal: column.kieu === 'so' ? 'right' : 'left' }
      if (column.kieu === 'so') cell.numFmt = DINH_DANG_TIEN_VND_EXCEL
    })
  }

  const tepHoiNghi = attachmentsOf(teps, row.id)
  sheet.addRow([])
  const tieuDeTep = sheet.addRow(['Chứng từ Hội nghị'])
  tieuDeTep.getCell(1).font = { name: 'Aptos', size: 12, bold: true, color: { argb: HEADER_FILL } }
  headerStyle(sheet.addRow(['Loại', 'Tên tệp', 'Mở tệp']))
  if (!tepHoiNghi.length) bodyStyle(sheet.addRow(['', 'Chưa có chứng từ', '']), false)
  tepHoiNghi.forEach((file, index) => {
    const excelRow = sheet.addRow([file.loai, file.tenGoc, ''])
    bodyStyle(excelRow, index % 2 === 1)
    if (file.tonTai) setLink(excelRow.getCell(3), 'Mở tệp', file.zipPath, 'Mở ' + file.tenGoc)
    else excelRow.getCell(3).value = 'Không tìm thấy'
  })
  sheet.pageSetup.orientation = 'landscape'
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
  sheet.headerFooter.oddFooter = 'Trang &P / &N'
}

// Dòng gộp Hội nghị ra một dòng trên sheet nhật ký; giao dịch con và chứng từ của
// Hội nghị nằm ở sheet riêng, hai bên link qua lại với nhau.
export async function taoWorkbookNhatKyServer(
  rows: readonly DongNhatKy[],
  teps: ReadonlyMap<string, readonly TepXuatNhatKy[]>,
  conHoiNghi: ReadonlyMap<string, readonly GiaoDichTinh[]> = new Map(),
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Quản lý tạm ứng'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.properties.date1904 = false

  const tenSheet = new Map<string, string>()
  for (const row of rows) {
    const hoiNghiId = row.gopHoiNghi?.hoiNghiId
    if (hoiNghiId && !tenSheet.has(hoiNghiId)) tenSheet.set(hoiNghiId, tenSheetHoiNghi(tenSheet.size + 1, row.noiDung))
  }

  const sheet = workbook.addWorksheet(TEN_SHEET_NHAT_KY, { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] })
  sheet.columns = cotXuatNhatKy.map(column => ({
    key: column.id,
    width: Math.max(12, Math.min(42, Math.round(column.rong / 7))),
  }))
  sheet.addRow(cotXuatNhatKy.map(column => column.ten))
  headerStyle(sheet.getRow(1))

  const dongChinh = new Map<string, number>()
  rows.forEach((row, index) => {
    const excelRow = ghiDongGiaoDich(sheet, cotXuatNhatKy, row, attachmentsOf(teps, row.id), index % 2 === 1)
    const hoiNghiId = row.gopHoiNghi?.hoiNghiId
    if (!hoiNghiId) return
    dongChinh.set(hoiNghiId, excelRow.number)
    for (const id of ['hoiNghi', 'noiDung'] as const) {
      const cell = excelRow.getCell(cotXuatNhatKy.findIndex(column => column.id === id) + 1)
      setLink(cell, String(cell.value ?? ''), lienKetSheet(tenSheet.get(hoiNghiId)!), 'Mở sheet chi tiết Hội nghị')
    }
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: cotXuatNhatKy.length } }
  sheet.pageSetup.orientation = 'landscape'
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
  sheet.headerFooter.oddFooter = 'Trang &P / &N'

  for (const row of rows) {
    const hoiNghiId = row.gopHoiNghi?.hoiNghiId
    if (hoiNghiId) themSheetHoiNghi(workbook, tenSheet.get(hoiNghiId)!, row, conHoiNghi.get(hoiNghiId) ?? [], teps, dongChinh.get(hoiNghiId)!)
  }

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
  // Tệp của giao dịch con và chứng từ chung của Hội nghị cũng được liệt kê ở đây.
  const dongCoTep: GiaoDichTinh[] = rows.flatMap(row => row.gopHoiNghi
    ? [row, ...(conHoiNghi.get(row.gopHoiNghi.hoiNghiId) ?? [])]
    : [row])
  let attachmentRow = 1
  for (const row of dongCoTep) {
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
