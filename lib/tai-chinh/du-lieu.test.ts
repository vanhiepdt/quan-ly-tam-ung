import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db/pool', () => ({ db: { query: vi.fn() } }))
import { chuyenDongGiaoDich } from './du-lieu'

const row = {
  id: 'test', so_thu_tu: 1, tao_luc: '2026-09-16T01:00:00Z', noi_dung: 'Test',
  ky_hieu_hd: null, so_hd: null, loai_hd: null, trang_thai_hd: 'Hợp lệ', hinh_thuc: 'Tạm ứng thêm',
  tong_tien: 0, tien_ruou_bia: 0, tam_ung_tu_cq: 100, giao_tien_chi_thuy: 0, hoan_ung_tien_mat: 0,
  nguoi_lay_hd_id: null, phi_lay_hd_ghi_de: null, trang_thai_tt_phi: 'Không phát sinh', ghi_chu: null,
}

describe('PostgreSQL calendar date normalization', () => {
  it.each([[2026, 8, 16, '2026-09-16'], [2026, 0, 1, '2026-01-01'], [2024, 1, 29, '2024-02-29']] as const)(
    'preserves local DATE calendar components %s/%s/%s', (year, month, day, expected) => {
      expect(chuyenDongGiaoDich({ ...row, ngay: new Date(year, month, day) }).ngay).toBe(expected)
    },
  )
  it('keeps serialized SQL dates unchanged', () => {
    expect(chuyenDongGiaoDich({ ...row, ngay: '2026-09-16' }).ngay).toBe('2026-09-16')
  })
  it('still normalizes creation timestamps as instants', () => {
    expect(chuyenDongGiaoDich({ ...row, ngay: '2026-09-16', tao_luc: '2026-09-16T08:00:00+07:00' }).taoLuc).toBe('2026-09-16T01:00:00.000Z')
  })
  it('maps proposer and invoice collector display names', () => {
    expect(chuyenDongGiaoDich({
      ...row, nguoi_de_nghi_id: 'proposer-a', nguoi_de_nghi_ten: 'Nguyễn Văn A', nguoi_lay_hd_id: 'collector-a', nguoi_lay_hd_ten: 'Trần Thị B',
    })).toMatchObject({ nguoiDeNghiId: 'proposer-a', nguoiDeNghiTen: 'Nguyễn Văn A', nguoiLayHdId: 'collector-a', nguoiLayHdTen: 'Trần Thị B' })
  })
  it('maps the complete paper-signer snapshot and its legacy marker', () => {
    expect(chuyenDongGiaoDich({
      ...row,
      nguoi_de_nghi_id: 'proposer-a', lanh_dao_tiep_khach_id: 'leader-tk', lanh_dao_thanh_toan_id: 'leader-tt',
      truong_phong_id: 'manager-a', ke_toan_kiem_soat_id: 'accountant-a', thong_tin_giay_da_chot: true,
    })).toMatchObject({
      nguoiDeNghiId: 'proposer-a', lanhDaoTiepKhachId: 'leader-tk', lanhDaoThanhToanId: 'leader-tt',
      truongPhongId: 'manager-a', keToanKiemSoatId: 'accountant-a', thongTinGiayDaChot: true,
    })
  })
  it('maps the explicit invoice-fee choice', () => {
    expect(chuyenDongGiaoDich({ ...row, hinh_thuc: 'Cơ quan trả thẳng', co_tinh_phi_lay_hd: true })).toMatchObject({ coTinhPhi: true })
    expect(chuyenDongGiaoDich({ ...row, hinh_thuc: 'Cơ quan trả thẳng', co_tinh_phi_lay_hd: false })).toMatchObject({ coTinhPhi: false })
  })
  it('maps the saved payment amount and thousand-rounding choice', () => {
    expect(chuyenDongGiaoDich({
      ...row, hinh_thuc: 'Cơ quan trả thẳng', tien_duoc_thanh_toan: '1234000', lam_tron_xuong_hang_nghin: true,
    })).toMatchObject({ tienDuocThanhToan: 1_234_000, lamTronXuongHangNghin: true })
  })
  it('maps the CQ direct-payment handover amount and treats pre-migration rows as zero', () => {
    expect(chuyenDongGiaoDich({ ...row, dua_tien_cq_tra_thang_cho_chi_thuy: '2500000' }))
      .toMatchObject({ duaTienCqTraThangChoChiThuy: 2_500_000 })
    expect(chuyenDongGiaoDich({ ...row })).toMatchObject({ duaTienCqTraThangChoChiThuy: 0 })
  })
  it('maps the transaction-specific transfer account snapshot', () => {
    expect(chuyenDongGiaoDich({
      ...row,
      tai_khoan_nhan_so: '000123', tai_khoan_nhan_ngan_hang: 'Ngân hàng khác',
      tai_khoan_nhan_chi_nhanh: 'Chi nhánh B', tai_khoan_nhan_ten_chu_tk: 'Người nhận khác',
    }).taiKhoanNhanGhiDe).toEqual({
      soTaiKhoan: '000123', nganHang: 'Ngân hàng khác', chiNhanh: 'Chi nhánh B', tenChuTk: 'Người nhận khác',
    })
  })
})


it('đọc cờ Chi thực tế và mặc định tắt đối với dữ liệu cũ', () => {
  for (const chi_thuc_te of [true, 'true']) expect(chuyenDongGiaoDich({ ...row, chi_thuc_te }).chiThucTe).toBe(true)
  for (const chi_thuc_te of [undefined, null, false, 'false']) expect(chuyenDongGiaoDich({ ...row, chi_thuc_te }).chiThucTe).toBe(false)
  expect(chuyenDongGiaoDich({ ...row, hinh_thuc: 'Hoàn tạm ứng', chi_thuc_te: true }).coTinhPhi).toBe(false)
  expect(chuyenDongGiaoDich({ ...row, hinh_thuc: 'Hoàn tạm ứng', chi_thuc_te: true, co_tinh_phi_lay_hd: true }).coTinhPhi).toBe(true)
})
