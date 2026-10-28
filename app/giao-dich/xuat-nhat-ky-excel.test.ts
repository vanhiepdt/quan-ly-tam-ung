import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { catTrangNhatKy, cotNhatKy, tuyChonSchema } from './cot-nhat-ky'
import { locDong } from './loc-nhat-ky'
import { sapXepDong } from './sap-xep-nhat-ky'
import { cotXuatNhatKy, DINH_DANG_NGAY_EXCEL, DINH_DANG_TIEN_VND_EXCEL, duLieuXuatNhatKy, taoWorkbookNhatKy } from './xuat-nhat-ky-excel'

const dong = (phan: Partial<GiaoDichTinh> = {}): GiaoDichTinh => ({
  id: 'g', ngay: '2026-09-16', soThuTu: 1, taoLuc: '2026-09-16T00:00:00.000Z', noiDung: 'Nội dung',
  kyHieuHd: null, soHd: null, loaiHd: null, trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  tongTien: 0, tienRuouBia: 0, tamUngTuCq: 0, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0,
  nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: null,
  hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duTienCqTraThang: 0, tongTienDuaChiThuy: 0,
  duLyThuyet: 0, duThucTe: 0, duDangCam: 0, duHiepDangCam: 0, duChiTiepKhachThucTe: 0,
  ...phan,
})

const sheetCua = (rows: readonly GiaoDichTinh[]) => taoWorkbookNhatKy(XLSX, rows).Sheets['Nhật ký giao dịch']!

describe('xuất Excel nhật ký giao dịch', () => {
  it('ghi cả trạng thái Chi thực tế vào cột trạng thái hóa đơn như trên màn hình', () => {
    const rows = [
      dong({ chiThucTe: true }),
      dong({ chiThucTe: false, hinhThuc: HINH_THUC.CQ_TRA_THANG }),
      dong({ hinhThuc: HINH_THUC.TAM_UNG_THEM, trangThaiHd: 'Không có' }),
    ]
    const sheet = sheetCua(rows)
    const col = cotXuatNhatKy.findIndex(c => c.id === 'trangThaiHd')
    expect(rows.map((_, i) => sheet[XLSX.utils.encode_cell({ r: i + 1, c: col })]?.v))
      .toEqual(['Hợp lệ\nChi thực tế', 'Hợp lệ\nKhông chi thực tế', 'Không có'])
  })

  it('luôn xuất toàn bộ cột dữ liệu, kể cả cột đang ẩn hoặc không nằm trong thứ tự hiển thị', () => {
    const an = ['duaTienCqTraThangChoChiThuy', 'duTienCqTraThang', 'tongTienDuaChiThuy', 'duHiepDangCam', 'tep'] as const
    const tuyChonAn = tuyChonSchema.parse({ an: [...an], rong: {}, thuTu: ['ngay', 'noiDung', 'thaoTac'] })
    expect(tuyChonAn.an).toEqual([...an])

    const cotDuLieu = cotNhatKy.filter(c => c.id !== 'thaoTac')
    expect(cotXuatNhatKy.map(c => c.id)).toEqual(cotDuLieu.map(c => c.id))
    expect(duLieuXuatNhatKy([dong()])[0]).toEqual(cotDuLieu.map(c => c.ten))
  })

  it('ghi tiền dưới dạng số, áp dụng định dạng VND và ngày tháng dễ đọc', () => {
    const row = dong({
      ngay: '2026-09-16', noiDung: '=SUM(A1:A2)', tongTien: 1_234_567,
      duaTienCqTraThangChoChiThuy: 500_000, duTienCqTraThang: 734_567,
      tongTienDuaChiThuy: 1_000_000, duHiepDangCam: 2_000_000,
    })
    const sheet = sheetCua([row])
    const cotNgay = cotXuatNhatKy.findIndex(c => c.id === 'ngay')
    const cotNoiDung = cotXuatNhatKy.findIndex(c => c.id === 'noiDung')
    const cotTien = cotXuatNhatKy.findIndex(c => c.id === 'tongTien')
    const cellNgay = sheet[XLSX.utils.encode_cell({ r: 1, c: cotNgay })]!
    const cellNoiDung = sheet[XLSX.utils.encode_cell({ r: 1, c: cotNoiDung })]!
    const cellTien = sheet[XLSX.utils.encode_cell({ r: 1, c: cotTien })]!

    expect(cellNgay.z).toBe(DINH_DANG_NGAY_EXCEL)
    expect(cellTien.v).toBe(1_234_567)
    expect(typeof cellTien.v).toBe('number')
    expect(cellTien.z).toBe(DINH_DANG_TIEN_VND_EXCEL)
    expect(cellNoiDung.v).toBe("'=SUM(A1:A2)")
  })

  it('xuất mọi dòng đã lọc và sắp xếp, không giới hạn ở trang hiện tại', () => {
    const rows = Array.from({ length: 30 }, (_, index) => dong({
      id: `g-${index + 1}`,
      ngay: `2026-09-${String((index % 20) + 1).padStart(2, '0')}`,
      noiDung: `Giao dịch ${index + 1}`,
      hinhThuc: index % 2 === 0 ? HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY : HINH_THUC.GIAO_CHI_THUY,
      tongTien: index + 1,
      duaTienCqTraThangChoChiThuy: index % 2 === 0 ? index + 1 : 0,
    }))
    const daLocVaSap = sapXepDong(locDong(rows, {
      hinhThuc: [HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY],
    }), [{ id: 'tongTien', giam: true }])
    const trangDau = catTrangNhatKy(daLocVaSap, 10, 1)

    expect(daLocVaSap).toHaveLength(15)
    expect(trangDau.dong).toHaveLength(10)

    const sheet = sheetCua(daLocVaSap)
    const cotNoiDung = cotXuatNhatKy.findIndex(c => c.id === 'noiDung')
    const noiDungDaXuat = Array.from({ length: daLocVaSap.length }, (_, index) =>
      sheet[XLSX.utils.encode_cell({ r: index + 1, c: cotNoiDung })]?.v,
    )
    expect(noiDungDaXuat).toEqual(daLocVaSap.map(row => row.noiDung))
    expect(sheet['!ref']).toBe(XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: daLocVaSap.length, c: cotXuatNhatKy.length - 1 } }))
  })

  it('đặt autofilter đúng trên dòng tiêu đề khi không có kết quả lọc', () => {
    const sheet = sheetCua([])
    expect(sheet['!autofilter']).toEqual({
      ref: `A1:${XLSX.utils.encode_cell({ r: 0, c: cotXuatNhatKy.length - 1 })}`,
    })
  })
})
