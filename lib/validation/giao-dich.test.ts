import { describe, it, expect } from 'vitest'
import { schemaGiaoDich } from './giao-dich'

// Đơn vị tiếp khách là bắt buộc với Hoàn tạm ứng và Cơ quan trả thẳng.
const DON_VI = '22222222-2222-4222-8222-222222222222'

describe('schemaGiaoDich validation', () => {
  describe('Tạm ứng thêm transactions', () => {
    it('accepts valid advance transaction', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Tạm ứng thêm tháng 1',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 5000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
        tong_tien: 0,
        tien_ruou_bia: 0,
        giao_tien_chi_thuy: 0,
        hoan_ung_tien_mat: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects negative advance amount', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: -1000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Hoàn tạm ứng transactions', () => {
    it('accepts valid reimbursement with invoice', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Tiếp khách đối tác',
        don_vi_id: DON_VI,
        hinh_thuc: 'Hoàn tạm ứng',
        tong_tien: 5647000,
        tien_ruou_bia: 500000,
        ky_hieu_hd: '1C26MTT',
        so_hd: '00123456',
        loai_hd: 'Hóa đơn Giá trị gia tăng',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Đã thanh toán',
        tam_ung_tu_cq: 0,
        giao_tien_chi_thuy: 0,
        hoan_ung_tien_mat: 0,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tong_tien).toBe(5647000)
        expect(result.data.tien_ruou_bia).toBe(500000)
      }
    })

    it('rejects when alcohol exceeds total', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test',
        hinh_thuc: 'Hoàn tạm ứng',
        tong_tien: 1000000,
        tien_ruou_bia: 1500000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Tiền rượu bia không được vượt tổng tiền')
      }
    })

    it('accepts transaction with collector', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test với người lấy HĐ',
        don_vi_id: DON_VI,
        hinh_thuc: 'Hoàn tạm ứng',
        tong_tien: 2000000,
        tien_ruou_bia: 0,
        nguoi_lay_hd_id: '123e4567-e89b-12d3-a456-426614174000',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Chưa thanh toán',
      })
      expect(result.success).toBe(true)
    })

    it('accepts transaction with manual fee override', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test với phí ghi đè',
        don_vi_id: DON_VI,
        hinh_thuc: 'Hoàn tạm ứng',
        tong_tien: 5000000,
        tien_ruou_bia: 0,
        phi_lay_hd_ghi_de: 700000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Đã thanh toán',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Đơn vị tiếp khách', () => {
    const coBan = {
      ngay: '2026-01-15', noi_dung: 'Tiếp khách đối tác', tong_tien: 1000000, tien_ruou_bia: 0,
      trang_thai_hd: 'Hợp lệ', trang_thai_tt_phi: 'Không phát sinh',
    }

    it.each(['Hoàn tạm ứng', 'Cơ quan trả thẳng'])('bắt buộc chọn đơn vị với %s', hinh_thuc => {
      const thieu = schemaGiaoDich.safeParse({ ...coBan, hinh_thuc })
      expect(thieu.success).toBe(false)
      if (!thieu.success) expect(thieu.error.issues[0].message).toContain('phải chọn đơn vị tiếp khách')
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc, don_vi_id: DON_VI }).success).toBe(true)
    })

    it('cho phép nội dung rỗng vì máy chủ tự sinh từ tên đơn vị', () => {
      const result = schemaGiaoDich.safeParse({ ...coBan, hinh_thuc: 'Hoàn tạm ứng', don_vi_id: DON_VI, noi_dung: '' })
      expect(result.success).toBe(true)
    })

    it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Nộp hoàn CQ'])('từ chối đơn vị gắn vào %s', hinh_thuc => {
      const result = schemaGiaoDich.safeParse({ ...coBan, hinh_thuc, don_vi_id: DON_VI })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toContain('không gắn với đơn vị tiếp khách')
      // Bỏ đơn vị đi thì dòng tiền nội bộ hợp lệ.
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc }).success).toBe(true)
    })

    it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Nộp hoàn CQ'])('cho phép nội dung rỗng vì máy chủ điền tên hình thức %s', hinh_thuc => {
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc, noi_dung: '' }).success).toBe(true)
    })
  })

  describe('Giao tiền chị Thúy transactions', () => {
    it('accepts valid hand-over transaction', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Giao tiền cho chị Thúy',
        hinh_thuc: 'Giao tiền chị Thúy',
        giao_tien_chi_thuy: 15000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
        tong_tien: 0,
        tien_ruou_bia: 0,
        tam_ung_tu_cq: 0,
        hoan_ung_tien_mat: 0,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Nộp hoàn CQ transactions', () => {
    it('accepts valid cash return transaction', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Nộp lại tiền mặt',
        hinh_thuc: 'Nộp hoàn CQ',
        hoan_ung_tien_mat: 3000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
        tong_tien: 0,
        tien_ruou_bia: 0,
        tam_ung_tu_cq: 0,
        giao_tien_chi_thuy: 0,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Empty string to null transformation', () => {
    it('transforms empty strings to null for optional fields', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 1000000,
        ky_hieu_hd: '',
        so_hd: '',
        loai_hd: '',
        ghi_chu: '',
        nguoi_lay_hd_id: '',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ky_hieu_hd).toBeNull()
        expect(result.data.so_hd).toBeNull()
        expect(result.data.loai_hd).toBeNull()
        expect(result.data.ghi_chu).toBeNull()
      }
    })
  })

  describe('Required fields validation', () => {
    it('rejects missing date', () => {
      const result = schemaGiaoDich.safeParse({
        noi_dung: 'Test',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 1000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(false)
    })

    it('chấp nhận nội dung thiếu hoặc rỗng với Tạm ứng thêm vì máy chủ điền tên hình thức', () => {
      const thieu = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 1000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      const rong = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: '   ',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 1000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      const tuNull = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: null,
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: 1000000,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(thieu.success).toBe(true)
      expect(rong.success).toBe(true)
      expect(tuNull.success).toBe(true)
    })

    it('từ chối nội dung rỗng khi hình thức không tự điền', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: '',
        hinh_thuc: 'Không tồn tại',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Data type coercion', () => {
    it('coerces string numbers to integers', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test',
        hinh_thuc: 'Tạm ứng thêm',
        tam_ung_tu_cq: '5000000',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tam_ung_tu_cq).toBe(5000000)
        expect(typeof result.data.tam_ung_tu_cq).toBe('number')
      }
    })

    it('defaults missing money fields to 0', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Test',
        hinh_thuc: 'Tạm ứng thêm',
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tong_tien).toBe(0)
        expect(result.data.tien_ruou_bia).toBe(0)
        expect(result.data.tam_ung_tu_cq).toBe(0)
      }
    })
  })
})
