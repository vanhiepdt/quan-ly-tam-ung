import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTho } from './kieu'
import { tinhToan } from './tinh-toan'
import { gomHoiNghi, NHIEU_HINH_THUC } from './gom-hoi-nghi'

const dong = (phan: Partial<GiaoDichTho>): GiaoDichTho => ({
  id: phan.id ?? crypto.randomUUID(), ngay: phan.ngay ?? '2026-01-01', soThuTu: phan.soThuTu ?? 1,
  taoLuc: phan.taoLuc ?? '2026-01-01T00:00:00.000Z', noiDung: phan.noiDung ?? '', kyHieuHd: null, soHd: null, loaiHd: null,
  trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 0, tienRuouBia: 0,
  tamUngTuCq: 0, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0,
  nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null,
  phiLayHdGhiDe: null, coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', ghiChu: null,
  donViId: null, donViTen: null, hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  ...phan,
})

const con = (phan: Partial<GiaoDichTho>): GiaoDichTho => dong({
  hoiNghiId: 'hn-1', hoiNghiTen: 'Hội nghị tổng kết', hoiNghiNgay: '2026-03-10', ...phan,
})

describe('gomHoiNghi', () => {
  it('giữ hình thức chung khi mọi giao dịch con cùng loại', () => {
    const rows = tinhToan([
      con({ id: 'c1', soThuTu: 1, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_000_000 }),
      con({ id: 'c2', soThuTu: 2, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 2_000_000 }),
    ])
    expect(gomHoiNghi(rows)[0].hinhThuc).toBe(HINH_THUC.CQ_TRA_THANG)
  })

  it('báo "Nhiều hình thức" và cộng riêng từng cột khi trộn Hoàn tạm ứng với CQ trả thẳng', () => {
    const rows = tinhToan([
      con({ id: 'c1', soThuTu: 1, hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 1_000_000 }),
      con({ id: 'c2', soThuTu: 2, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 2_000_000 }),
    ])
    const [gop] = gomHoiNghi(rows)
    expect(gop.hinhThuc).toBe(NHIEU_HINH_THUC)
    expect(gop.hoanTamUng).toBe(rows[0].hoanTamUng + rows[1].hoanTamUng)
    expect(gop.cqTraThang).toBe(rows[0].cqTraThang + rows[1].cqTraThang)
    expect(gop.hoanTamUng).toBeGreaterThan(0)
    expect(gop.cqTraThang).toBeGreaterThan(0)
  })

  it('giữ nguyên giao dịch không thuộc Hội nghị nào', () => {
    const rows = tinhToan([dong({ id: 'a', tongTien: 1_000_000 }), dong({ id: 'b', soThuTu: 2, tamUngTuCq: 500_000 })])
    expect(gomHoiNghi(rows)).toEqual(rows)
  })

  it('gộp các giao dịch con thành một dòng và cộng đúng cột tiền', () => {
    const rows = tinhToan([
      con({ id: 'c1', ngay: '2026-03-01', soThuTu: 1, tongTien: 1_000_000, phiLayHdGhiDe: 100_000, coTinhPhi: true, kyHieuHd: 'C26T', soHd: '1' }),
      con({ id: 'c2', ngay: '2026-03-02', soThuTu: 2, tongTien: 2_000_000, phiLayHdGhiDe: 200_000, coTinhPhi: true, kyHieuHd: 'C26T', soHd: '2' }),
    ])
    const gop = gomHoiNghi(rows)
    expect(gop).toHaveLength(1)
    expect(gop[0].gopHoiNghi).toEqual({ hoiNghiId: 'hn-1', soCon: 2, soHoaDon: 2 })
    expect(gop[0].noiDung).toBe('Hội nghị tổng kết')
    expect(gop[0].ghiChu).toBe('2 giao dịch con')
    // Ngày của dòng gộp là ngày Hội nghị, không phải ngày của giao dịch con.
    expect(gop[0].ngay).toBe('2026-03-10')
    expect(gop[0].tongTien).toBe(3_000_000)
    expect(gop[0].hoanTamUng).toBe(3_000_000)
    expect(gop[0].phiLayHd).toBe(300_000)
    // Số dư là giá trị sau giao dịch con cuối cùng, không phải tổng.
    expect(gop[0].duThucTe).toBe(rows[1].duThucTe)
    expect(gop[0].duLyThuyet).toBe(rows[1].duLyThuyet)
  })

  it('đặt dòng gộp đúng chỗ giao dịch con cuối cùng', () => {
    const rows = tinhToan([
      dong({ id: 'truoc', ngay: '2026-03-01', soThuTu: 1, tamUngTuCq: 9_000_000 }),
      con({ id: 'c1', ngay: '2026-03-02', soThuTu: 2, tongTien: 1_000_000 }),
      con({ id: 'c2', ngay: '2026-03-03', soThuTu: 3, tongTien: 2_000_000 }),
      dong({ id: 'sau', ngay: '2026-03-04', soThuTu: 4, hoanUngTienMat: 1_000_000 }),
    ])
    expect(gomHoiNghi(rows).map(r => r.id)).toEqual(['truoc', 'hoi-nghi:hn-1', 'sau'])
  })

  it('không làm đổi tổng của các cột tiền cộng dồn', () => {
    const rows = tinhToan([
      dong({ id: 'le', ngay: '2026-03-01', soThuTu: 1, tongTien: 4_000_000 }),
      con({ id: 'c1', ngay: '2026-03-02', soThuTu: 2, tongTien: 1_000_000, phiLayHdGhiDe: 50_000, coTinhPhi: true }),
      con({ id: 'c2', ngay: '2026-03-03', soThuTu: 3, tongTien: 2_000_000, phiLayHdGhiDe: 70_000, coTinhPhi: true }),
    ])
    const gop = gomHoiNghi(rows)
    for (const cot of ['tongTien', 'hoanTamUng', 'phiLayHd', 'tienRuouBia'] as const) {
      expect(gop.reduce((t, r) => t + r[cot], 0)).toBe(rows.reduce((t, r) => t + r[cot], 0))
    }
  })

  it('báo "Nhiều trạng thái" khi các giao dịch con khác nhau', () => {
    const rows = tinhToan([
      con({ id: 'c1', soThuTu: 1, tongTien: 1_000_000, nguoiLayHdTen: 'Lan' }),
      con({ id: 'c2', soThuTu: 2, tongTien: 2_000_000, trangThaiHd: TRANG_THAI.CHO_HD, nguoiLayHdTen: 'Bình' }),
    ])
    const [gop] = gomHoiNghi(rows)
    expect(gop.trangThaiHd).toBe('Nhiều trạng thái')
    // Cột người lấy hóa đơn liệt kê đủ tên thay vì bỏ trống khi khác nhau.
    expect(gop.nguoiLayHdTen).toBe('Lan, Bình')
    // Hóa đơn chờ không được tính vào tiền hoàn, dòng gộp phải phản ánh đúng.
    expect(gop.hoanTamUng).toBe(1_000_000)
  })

  it('không lặp lại tên người lấy hóa đơn trùng nhau', () => {
    const rows = tinhToan([
      con({ id: 'c1', soThuTu: 1, nguoiLayHdTen: 'Lan' }),
      con({ id: 'c2', soThuTu: 2, nguoiLayHdTen: 'Lan' }),
      con({ id: 'c3', soThuTu: 3, nguoiLayHdTen: null }),
    ])
    expect(gomHoiNghi(rows)[0].nguoiLayHdTen).toBe('Lan')
  })

  it('chỉ báo đủ tệp khi mọi giao dịch con đã có', () => {
    const rows = tinhToan([
      con({ id: 'c1', soThuTu: 1, coHoaDon: true }),
      con({ id: 'c2', soThuTu: 2, coHoaDon: false }),
    ])
    expect(gomHoiNghi(rows)[0].coHoaDon).toBe(false)
    expect(gomHoiNghi(tinhToan([con({ id: 'c3', coHoaDon: true })]))[0].coHoaDon).toBe(true)
  })
})
