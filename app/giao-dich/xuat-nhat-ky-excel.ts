import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { canDonVi } from '@/lib/tai-chinh/hinh-thuc'
import { cotNhatKy, type Cot, type CotId } from './cot-nhat-ky'

type CotXuatId = Exclude<CotId, 'thaoTac'>
type CotXuat = Omit<Cot, 'id'> & { id: CotXuatId }
type GiaTriExcel = string | number | Date
type ThuVienXlsx = typeof import('xlsx')

export const DINH_DANG_NGAY_EXCEL = 'dd/mm/yyyy'
export const DINH_DANG_TIEN_VND_EXCEL = '#,##0 "VND"'

// Thao tác là các nút UI, không phải dữ liệu nhật ký. Mọi cột dữ liệu còn lại
// luôn được lấy từ cấu hình đầy đủ, không phụ thuộc ẩn/hiện hay thứ tự người dùng.
export const cotXuatNhatKy = cotNhatKy.filter(c => c.id !== 'thaoTac') as readonly CotXuat[]

function ngayExcel(value: string): Date {
  const [nam, thang, ngay] = value.split('-').map(Number)
  return new Date(Date.UTC(nam, thang - 1, ngay))
}

// Một ô bắt đầu bằng =, +, - hoặc @ có thể bị Excel hiểu là công thức. Nhật ký
// có nội dung người dùng nhập nên luôn ghi những giá trị này dưới dạng văn bản.
function vanBanExcel(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function chungTu(row: GiaoDichTinh): string {
  const phan = [
    row.kyHieuHd ? `Ký hiệu: ${row.kyHieuHd}` : '',
    row.soHd ? `Số HĐ: ${row.soHd}` : '',
  ].filter(Boolean)
  return phan.join('\n') || '—'
}

export function giaTriXuatNhatKy(row: GiaoDichTinh, id: CotXuatId): GiaTriExcel {
  switch (id) {
    case 'ngay': return ngayExcel(row.ngay)
    case 'noiDung': return vanBanExcel(row.ghiChu ? `${row.noiDung}\nGhi chú: ${row.ghiChu}` : row.noiDung)
    case 'donVi': return vanBanExcel(row.donViTen ?? '—')
    case 'nguoiDeNghi': return vanBanExcel(row.nguoiDeNghiTen ?? '—')
    case 'nguoiLayHd': return vanBanExcel(row.nguoiLayHdTen ?? '—')
    case 'chungTu': return vanBanExcel(chungTu(row))
    case 'trangThaiHd': return vanBanExcel(canDonVi(row.hinhThuc)
      ? `${row.trangThaiHd}\n${row.chiThucTe ? 'Chi thực tế' : 'Không chi thực tế'}`
      : row.trangThaiHd)
    case 'trangThaiTtPhi': return vanBanExcel(row.trangThaiTtPhi)
    case 'hinhThuc': return vanBanExcel(row.hinhThuc)
    case 'tongTien': return row.tongTien
    case 'tienRuouBia': return row.tienRuouBia
    case 'hoanTamUng': return row.hoanTamUng
    case 'cqTraThang': return row.cqTraThang
    case 'duaTienCqTraThangChoChiThuy': return row.duaTienCqTraThangChoChiThuy
    case 'duTienCqTraThang': return row.duTienCqTraThang
    case 'phiLayHd': return row.phiLayHd
    case 'tamUngTuCq': return row.tamUngTuCq
    case 'giaoTienChiThuy': return row.giaoTienChiThuy
    case 'tongTienDuaChiThuy': return row.tongTienDuaChiThuy
    case 'hoanUngTienMat': return row.hoanUngTienMat
    case 'duLyThuyet': return row.duLyThuyet
    case 'duThucTe': return row.duThucTe
    case 'duDangCam': return row.duDangCam
    case 'duHiepDangCam': return row.duHiepDangCam
    case 'tep': return vanBanExcel(`Hóa đơn: ${row.coHoaDon ? 'Có' : 'Chưa có'}; Chuyển khoản: ${row.coChuyenKhoan ? 'Có' : 'Chưa có'}`)
  }
}

export function duLieuXuatNhatKy(rows: readonly GiaoDichTinh[]): GiaTriExcel[][] {
  return [
    cotXuatNhatKy.map(c => c.ten),
    ...rows.map(row => cotXuatNhatKy.map(c => giaTriXuatNhatKy(row, c.id))),
  ]
}

export function taoWorkbookNhatKy(XLSX: ThuVienXlsx, rows: readonly GiaoDichTinh[]) {
  const sheet = XLSX.utils.aoa_to_sheet(duLieuXuatNhatKy(rows), {
    cellDates: true,
    dateNF: DINH_DANG_NGAY_EXCEL,
  })
  for (let hang = 1; hang <= rows.length; hang += 1) {
    for (let cot = 0; cot < cotXuatNhatKy.length; cot += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: hang, c: cot })]
      if (!cell) continue
      if (cotXuatNhatKy[cot].id === 'ngay') cell.z = DINH_DANG_NGAY_EXCEL
      if (cotXuatNhatKy[cot].kieu === 'so') cell.z = DINH_DANG_TIEN_VND_EXCEL
    }
  }
  sheet['!cols'] = cotXuatNhatKy.map(c => ({ wch: Math.max(12, Math.min(45, Math.round(c.rong / 8))) }))
  sheet['!autofilter'] = {
    ref: `A1:${XLSX.utils.encode_cell({ r: Math.max(0, rows.length), c: cotXuatNhatKy.length - 1 })}`,
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Nhật ký giao dịch')
  return workbook
}

export function tenTepNhatKy(now = new Date()): string {
  const ngay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `nhat-ky-giao-dich-${ngay}.xlsx`
}

export async function xuatNhatKyExcel(rows: readonly GiaoDichTinh[]): Promise<void> {
  const XLSX = await import('xlsx')
  XLSX.writeFile(taoWorkbookNhatKy(XLSX, rows), tenTepNhatKy(), {
    bookType: 'xlsx',
    compression: true,
  })
}
