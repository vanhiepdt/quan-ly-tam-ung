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
        expect(result.error.issues[0].message).toContain('Tiền không được thanh toán không được vượt tổng tiền')
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

    it('requires a manual account number when default account is disabled', () => {
      const base = {
        ngay: '2026-01-15', noi_dung: 'Tiếp khách đối tác', don_vi_id: DON_VI,
        hinh_thuc: 'Cơ quan trả thẳng', hinh_thuc_thanh_toan: 'chuyen_khoan',
        tong_tien: 2_000_000, tien_ruou_bia: 0, trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh', dung_tai_khoan_mac_dinh: '0',
      }
      const thieu = schemaGiaoDich.safeParse(base)
      expect(thieu.success).toBe(false)
      if (!thieu.success) expect(thieu.error.issues.some(i => i.path.includes('tai_khoan_nhan_so'))).toBe(true)

      expect(schemaGiaoDich.safeParse({ ...base, tai_khoan_nhan_so: '0123456789012345678' }).success).toBe(true)
      expect(schemaGiaoDich.safeParse({ ...base, tai_khoan_nhan_so: '12345678901234567890' }).success).toBe(false)
      expect(schemaGiaoDich.safeParse({ ...base, tai_khoan_nhan_so: '12A45' }).success).toBe(false)
    })

    it('defaults to the saved account when the transfer checkbox is omitted', () => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15', noi_dung: 'Tiếp khách đối tác', don_vi_id: DON_VI,
        hinh_thuc: 'Cơ quan trả thẳng', hinh_thuc_thanh_toan: 'chuyen_khoan',
        tong_tien: 2_000_000, tien_ruou_bia: 0, trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.dung_tai_khoan_mac_dinh).toBe(true)
    })

    it.each(['Hoàn tạm ứng', 'Cơ quan trả thẳng'])('báo lỗi rõ ràng khi số tiền tự điền là NaN (%s)', hinh_thuc => {
      const result = schemaGiaoDich.safeParse({
        ngay: '2026-01-15',
        noi_dung: 'Tiếp khách đối tác',
        don_vi_id: DON_VI,
        hinh_thuc,
        tong_tien: 'NaN',
        tien_ruou_bia: 0,
        trang_thai_hd: 'Hợp lệ',
        trang_thai_tt_phi: 'Không phát sinh',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0]?.message).toBe('Số tiền không hợp lệ.')
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

    it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 'Nộp hoàn CQ'])('từ chối đơn vị gắn vào %s', hinh_thuc => {
      const result = schemaGiaoDich.safeParse({ ...coBan, hinh_thuc, don_vi_id: DON_VI })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0].message).toContain('không gắn với đơn vị tiếp khách')
      // Bỏ đơn vị đi thì dòng tiền nội bộ hợp lệ.
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc }).success).toBe(true)
    })

    it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 'Nộp hoàn CQ'])('cho phép nội dung rỗng vì máy chủ điền tên hình thức %s', hinh_thuc => {
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc, noi_dung: '' }).success).toBe(true)
    })

    it('mặc định tính phí trên tổng tiền, chỉ chấp nhận hai cơ sở cho giao dịch hóa đơn', () => {
      const hoaDon = { ...coBan, hinh_thuc: 'Hoàn tạm ứng', don_vi_id: DON_VI }
      expect(schemaGiaoDich.safeParse(hoaDon).data?.co_so_tinh_phi_lay_hd).toBe('tong_tien')
      expect(schemaGiaoDich.safeParse({ ...hoaDon, co_so_tinh_phi_lay_hd: 'tien_duoc_thanh_toan' }).data?.co_so_tinh_phi_lay_hd).toBe('tien_duoc_thanh_toan')
      expect(schemaGiaoDich.safeParse({ ...hoaDon, co_so_tinh_phi_lay_hd: 'sai' }).success).toBe(false)
      expect(schemaGiaoDich.safeParse({ ...coBan, co_so_tinh_phi_lay_hd: 'tien_duoc_thanh_toan' }).success).toBe(false)
    })

    it('nhận cờ tính phí dạng checkbox từ FormData', () => {
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc: 'Cơ quan trả thẳng', don_vi_id: DON_VI, co_tinh_phi_lay_hd: '1' }).data?.co_tinh_phi_lay_hd).toBe(true)
      expect(schemaGiaoDich.safeParse({ ...coBan, hinh_thuc: 'Cơ quan trả thẳng', don_vi_id: DON_VI, co_tinh_phi_lay_hd: '0' }).data?.co_tinh_phi_lay_hd).toBe(false)
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

  describe('Đưa tiền CQ trả thẳng cho Chị Thúy transactions', () => {
    const coBan = {
      ngay: '2026-01-15', noi_dung: '', hinh_thuc: 'Đưa tiền CQ trả thẳng cho Chị Thúy',
      dua_tien_cq_tra_thang_cho_chi_thuy: 2_500_000, trang_thai_hd: 'Hợp lệ', trang_thai_tt_phi: 'Không phát sinh',
      tong_tien: 0, tien_ruou_bia: 0, tam_ung_tu_cq: 0, giao_tien_chi_thuy: 0, hoan_ung_tien_mat: 0,
    }

    it.each(['tien_mat', 'chuyen_khoan'])('accepts %s as the method of handing over CQ direct-payment money', hinh_thuc_thanh_toan => {
      const result = schemaGiaoDich.safeParse({ ...coBan, hinh_thuc_thanh_toan })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dua_tien_cq_tra_thang_cho_chi_thuy).toBe(2_500_000)
        expect(result.data.hinh_thuc_thanh_toan).toBe(hinh_thuc_thanh_toan)
      }
    })

    it('rejects temporary-advance money or the new money column on another transaction type', () => {
      expect(schemaGiaoDich.safeParse({ ...coBan, tam_ung_tu_cq: 1 }).success).toBe(false)
      expect(schemaGiaoDich.safeParse({
        ...coBan, hinh_thuc: 'Giao tiền chị Thúy', giao_tien_chi_thuy: 1, dua_tien_cq_tra_thang_cho_chi_thuy: 1,
      }).success).toBe(false)
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


describe('lựa chọn Chi thực tế', () => {
  const hoaDon = { ngay: '2026-09-30', hinh_thuc: 'Hoàn tạm ứng', don_vi_id: DON_VI }

  it.each([undefined, null, '', false, '0', 'false', 'off'])('mặc định không tích cho giá trị %s', chi_thuc_te => {
    expect(schemaGiaoDich.parse({ ...hoaDon, chi_thuc_te }).chi_thuc_te).toBe(false)
  })

  it.each(['Hoàn tạm ứng', 'Cơ quan trả thẳng'])('nhận cờ trên giao dịch %s', hinh_thuc => {
    expect(schemaGiaoDich.parse({ ...hoaDon, hinh_thuc, chi_thuc_te: '1' }).chi_thuc_te).toBe(true)
  })

  it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 'Nộp hoàn CQ'])('không nhận cờ cho %s', hinh_thuc => {
    const result = schemaGiaoDich.safeParse({ ngay: '2026-09-30', hinh_thuc, chi_thuc_te: '1' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['chi_thuc_te'] }))
  })

  it('từ chối cờ không phải boolean', () => {
    expect(schemaGiaoDich.safeParse({ ...hoaDon, chi_thuc_te: 'khong_hop_le' }).success).toBe(false)
  })
})
