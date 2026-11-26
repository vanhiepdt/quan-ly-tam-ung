import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { gomHoiNghi } from '@/lib/tai-chinh/gom-hoi-nghi'
import { taoWorkbookNhatKyServer, tenSheetHoiNghi } from './xuat-nhat-ky-excel-server'

const dong = (phan: Partial<GiaoDichTinh> = {}): GiaoDichTinh => ({
  id: 'g-1', ngay: '2026-09-05', soThuTu: 1, taoLuc: '2026-09-05T00:00:00.000Z', noiDung: 'Tiếp khách',
  kyHieuHd: '1C26MTT', soHd: '0001', loaiHd: 'Hóa đơn Giá trị gia tăng', trangThaiHd: TRANG_THAI.HOP_LE,
  hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_234_567, tienRuouBia: 100_000,
  tamUngTuCq: 1_234_567, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0,
  nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: 'Phòng A',
  hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: true, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 1_234_567, phiLayHd: 0, duTienCqTraThang: 0, tongTienDuaChiThuy: 0,
  duLyThuyet: 0, duThucTe: 0, duDangCam: 0, duHiepDangCam: 0, duChiTiepKhachThucTe: 0, layQuyChiThuy: 0, tongLayQuyChiThuy: 0,
  ...phan,
})

describe('Hội nghị trong workbook xuất nhật ký', () => {
  it('dòng Hội nghị ra một dòng và link tới sheet riêng chứa giao dịch con', async () => {
    const con = [
      dong({ id: 'c-1', hoiNghiId: 'h-1', hoiNghiTen: 'Hội nghị tổng kết', tongTien: 1_000_000 }),
      dong({ id: 'c-2', hoiNghiId: 'h-1', hoiNghiTen: 'Hội nghị tổng kết', tongTien: 2_000_000 }),
    ]
    const [gop] = gomHoiNghi(con)
    const tepHn = new Map([['hoi-nghi:h-1', [{
      id: 'f-hn', giaoDichId: 'hoi-nghi:h-1', loai: 'Tờ trình tổ chức hội nghị', tenGoc: 'to-trinh.pdf', mime: 'application/pdf',
      duongDan: '', zipPath: 'tep-dinh-kem/hoi-nghi-h-1/01-to-trinh.pdf', tonTai: true,
    }]]])
    const buffer = await taoWorkbookNhatKyServer([dong(), gop], tepHn, new Map([['h-1', con]]))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    expect(workbook.worksheets.map(s => s.name)).toEqual(['Nhật ký giao dịch', 'HN1 Hội nghị tổng kết', 'Tệp đính kèm'])

    const main = workbook.getWorksheet('Nhật ký giao dịch')!
    expect(main.rowCount).toBe(3)
    const headers = main.getRow(1).values as unknown[]
    expect(main.getRow(3).getCell(headers.indexOf('Hội nghị')).value).toMatchObject({ hyperlink: "#'HN1 Hội nghị tổng kết'!A1" })
    expect(main.getRow(3).getCell(headers.indexOf('Nội dung')).value).toMatchObject({ hyperlink: "#'HN1 Hội nghị tổng kết'!A1" })
    expect(main.getRow(3).getCell(headers.indexOf('Tổng tiền')).value).toBe(3_000_000)

    const detail = workbook.getWorksheet('HN1 Hội nghị tổng kết')!
    expect(detail.getCell('A1').value).toBe('Hội nghị: Hội nghị tổng kết')
    expect(detail.getCell('A3').value).toMatchObject({ hyperlink: "#'Nhật ký giao dịch'!A3" })
    const dh = detail.getRow(4).values as unknown[]
    expect(dh).not.toContain('Hội nghị')
    expect(detail.getRow(5).getCell(dh.indexOf('Tổng tiền')).value).toBe(1_000_000)
    expect(detail.getRow(6).getCell(dh.indexOf('Tổng tiền')).value).toBe(2_000_000)
    expect(detail.getRow(7).getCell(1).value).toBe('Tổng 2 giao dịch')
    expect(detail.getRow(7).getCell(dh.indexOf('Tổng tiền')).value).toBe(3_000_000)
    expect(detail.getRow(11).getCell(2).value).toBe('to-trinh.pdf')
    expect(detail.getRow(11).getCell(3).value).toMatchObject({ hyperlink: 'tep-dinh-kem/hoi-nghi-h-1/01-to-trinh.pdf' })

    const tepSheet = workbook.getWorksheet('Tệp đính kèm')!
    expect(tepSheet.getRow(2).getCell(5).value).toBe('to-trinh.pdf')
  })

  it('đặt tên sheet Hội nghị hợp lệ với Excel', () => {
    const ten = tenSheetHoiNghi(12, "Hội nghị: [tổng kết] / năm 2026 * của 'phòng' rất dài")
    expect(ten.length).toBeLessThanOrEqual(31)
    expect(ten).toMatch(/^HN12 /)
    expect(ten).not.toMatch(/[[\]:*?\/\\']/)
  })
})
