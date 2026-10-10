import ExcelJS from 'exceljs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { DINH_DANG_NGAY_EXCEL, DINH_DANG_TIEN_VND_EXCEL } from './xuat-nhat-ky-excel'
import { taoWorkbookNhatKyServer } from './xuat-nhat-ky-excel-server'
import { taoZipNhatKy } from './xuat-nhat-ky-zip'

const dong = (phan: Partial<GiaoDichTinh> = {}): GiaoDichTinh => ({
  id: 'g-1', ngay: '2026-09-05', soThuTu: 1, taoLuc: '2026-09-05T00:00:00.000Z', noiDung: 'Tiếp khách',
  kyHieuHd: '1C26MTT', soHd: '0001', loaiHd: 'Hóa đơn Giá trị gia tăng', trangThaiHd: TRANG_THAI.HOP_LE,
  hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_234_567, tienRuouBia: 100_000,
  tamUngTuCq: 1_234_567, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0,
  nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: 'Phòng A',
  hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: true, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 1_234_567, phiLayHd: 0, duTienCqTraThang: 0, tongTienDuaChiThuy: 0,
  duLyThuyet: 0, duThucTe: 0, duDangCam: 0, duHiepDangCam: 0,
  ...phan,
})

const teps = new Map([['g-1', [{
  id: 'file-1', giaoDichId: 'g-1', loai: 'hoa_don', tenGoc: 'hoa-don.pdf', mime: 'application/pdf',
  duongDan: '', zipPath: 'tep-dinh-kem/g-1/01-hoa-don.pdf', tonTai: true,
}, {
  id: 'file-2', giaoDichId: 'g-1', loai: 'phu_luc', tenGoc: 'phu-luc.pdf', mime: 'application/pdf',
  duongDan: '', zipPath: 'tep-dinh-kem/g-1/02-phu-luc.pdf', tonTai: false,
}]] as const])

describe('workbook xuất nhật ký phía máy chủ', () => {
  it('tạo sheet đẹp, ngày 05/09/2026, tiền dạng số và link tệp', async () => {
    const buffer = await taoWorkbookNhatKyServer([dong({ chiThucTe: true })], teps)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    const sheet = workbook.getWorksheet('Nhật ký giao dịch')!
    const headers = sheet.getRow(1).values as unknown[]
    const dateIndex = headers.indexOf('Ngày')
    const moneyIndex = headers.indexOf('Tổng tiền')
    const fileIndex = headers.indexOf('Tệp')
    expect(sheet.getRow(2).getCell(dateIndex).value).toBeInstanceOf(Date)
    expect(sheet.getRow(2).getCell(dateIndex).numFmt).toBe(DINH_DANG_NGAY_EXCEL)
    expect(sheet.getRow(2).getCell(moneyIndex).value).toBe(1_234_567)
    expect(sheet.getRow(2).getCell(moneyIndex).numFmt).toBe(DINH_DANG_TIEN_VND_EXCEL)
    expect(sheet.getRow(2).getCell(fileIndex).value).toMatchObject({ hyperlink: 'tep-dinh-kem/g-1/01-hoa-don.pdf' })

    const attachments = workbook.getWorksheet('Tệp đính kèm')!
    expect(attachments.getRow(1).getCell(5).value).toBe('Tên tệp')
    expect(attachments.getRow(2).getCell(5).value).toBe('hoa-don.pdf')
    expect(attachments.getRow(2).getCell(6).value).toMatchObject({ hyperlink: 'tep-dinh-kem/g-1/01-hoa-don.pdf' })
    expect(attachments.getRow(3).getCell(6).value).toBe('Không tìm thấy')
  })

  it('đóng gói workbook và chỉ đưa tệp vật lý tồn tại vào ZIP', async () => {
    const folder = await mkdtemp(path.join(tmpdir(), 'nhat-ky-zip-'))
    try {
      const filePath = path.join(folder, 'hoa-don.pdf')
      await writeFile(filePath, 'noi dung mau')
      const zip = await taoZipNhatKy(Buffer.from('xlsx'), [{
        id: 'file-1', giaoDichId: 'g-1', loai: 'hoa_don', tenGoc: 'hoa-don.pdf', mime: 'application/pdf',
        duongDan: filePath, zipPath: 'tep-dinh-kem/g-1/01-hoa-don.pdf', tonTai: true,
      }, {
        id: 'file-2', giaoDichId: 'g-1', loai: 'phu_luc', tenGoc: 'thieu.pdf', mime: 'application/pdf',
        duongDan: path.join(folder, 'thieu.pdf'), zipPath: 'tep-dinh-kem/g-1/02-thieu.pdf', tonTai: false,
      }])
      expect(zip.subarray(0, 2).toString('ascii')).toBe('PK')
      expect(zip.includes(Buffer.from('nhat-ky-giao-dich.xlsx'))).toBe(true)
      expect(zip.includes(Buffer.from('tep-dinh-kem/g-1/01-hoa-don.pdf'))).toBe(true)
      expect(zip.includes(Buffer.from('tep-dinh-kem/g-1/02-thieu.pdf'))).toBe(false)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  })
})
