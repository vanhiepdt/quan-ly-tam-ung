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
})
