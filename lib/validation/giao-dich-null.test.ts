import { describe, it, expect } from 'vitest'
import { schemaGiaoDich } from './giao-dich'

describe('schemaGiaoDich với null values', () => {
  it('chấp nhận null cho các trường optional', () => {
    const input = {
      ngay: '2026-01-15',
      noi_dung: 'Test giao dịch',
      ky_hieu_hd: null,
      so_hd: null,
      loai_hd: null,
      trang_thai_hd: 'Hợp lệ',
      don_vi_id: '22222222-2222-4222-8222-222222222222',
      hinh_thuc: 'Hoàn tạm ứng',
      tong_tien: 1000000,
      tien_ruou_bia: 0,
      tam_ung_tu_cq: 0,
      giao_tien_chi_thuy: 0,
      hoan_ung_tien_mat: 0,
      nguoi_lay_hd_id: null,
      phi_lay_hd_ghi_de: null,
      trang_thai_tt_phi: 'Không phát sinh',
      ghi_chu: null,
    }

    const result = schemaGiaoDich.safeParse(input)

    if (!result.success) {
      console.error('Validation errors:', JSON.stringify(result.error.issues, null, 2))
    }

    expect(result.success).toBe(true)
  })

  it('chấp nhận empty string cho các trường optional', () => {
    const input = {
      ngay: '2026-01-15',
      noi_dung: 'Test giao dịch',
      ky_hieu_hd: '',
      so_hd: '',
      loai_hd: '',
      trang_thai_hd: 'Hợp lệ',
      don_vi_id: '22222222-2222-4222-8222-222222222222',
      hinh_thuc: 'Hoàn tạm ứng',
      tong_tien: 1000000,
      tien_ruou_bia: 0,
      tam_ung_tu_cq: 0,
      giao_tien_chi_thuy: 0,
      hoan_ung_tien_mat: 0,
      nguoi_lay_hd_id: '',
      phi_lay_hd_ghi_de: null,
      trang_thai_tt_phi: 'Không phát sinh',
      ghi_chu: '',
    }

    const result = schemaGiaoDich.safeParse(input)

    if (!result.success) {
      console.error('Validation errors:', JSON.stringify(result.error.issues, null, 2))
    }

    expect(result.success).toBe(true)
  })

  it('chấp nhận undefined cho các trường optional', () => {
    const input = {
      ngay: '2026-01-15',
      noi_dung: 'Test giao dịch',
      ky_hieu_hd: undefined,
      so_hd: undefined,
      loai_hd: undefined,
      trang_thai_hd: 'Hợp lệ',
      don_vi_id: '22222222-2222-4222-8222-222222222222',
      hinh_thuc: 'Hoàn tạm ứng',
      tong_tien: 1000000,
      tien_ruou_bia: 0,
      tam_ung_tu_cq: 0,
      giao_tien_chi_thuy: 0,
      hoan_ung_tien_mat: 0,
      nguoi_lay_hd_id: undefined,
      phi_lay_hd_ghi_de: undefined,
      trang_thai_tt_phi: 'Không phát sinh',
      ghi_chu: undefined,
    }

    const result = schemaGiaoDich.safeParse(input)

    if (!result.success) {
      console.error('Validation errors:', JSON.stringify(result.error.issues, null, 2))
    }

    expect(result.success).toBe(true)
  })
})
