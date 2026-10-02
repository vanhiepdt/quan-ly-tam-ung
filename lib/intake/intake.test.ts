import { describe, expect, it } from 'vitest'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { HINH_THUC_THANH_TOAN } from '@/lib/tai-chinh/hinh-thuc'
import { giaoDichTuIntake } from './intake'

const snapshot = {
  hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  donViId: '11111111-1111-4111-8111-111111111111',
  donViTen: 'Đơn vị mặc định',
  nguoiLayHdId: null,
  trangThaiTtPhi: 'Chưa thanh toán',
  hinhThucThanhToan: HINH_THUC_THANH_TOAN.HOAN_TAM_UNG,
  nguoiDungId: '22222222-2222-4222-8222-222222222222',
  nguoiDungTen: 'User hệ thống',
  timeoutGiay: 180,
}

const row = {
  id: '33333333-3333-4333-8333-333333333333',
  nguon: 'telegram' as const,
  trang_thai: 'cho_phan_hoi' as const,
  chat_telegram_id: '7', user_telegram_id: '8', message_id: '9', idempotency_key: 'key',
  nguoi_dung_id: snapshot.nguoiDungId, tep_tam_duong_dan: 'intake/x/a.pdf', tep_tam_ten_goc: 'a.pdf',
  tep_tam_kich_thuoc: 4, tep_tam_mime: 'application/pdf',
  de_xuat: { ngay: '2026-09-21', kyHieuHd: '1C26', soHd: '0001', tongTien: 120000, tienRuouBia: 0, loaiHd: 'gtgt', trangThaiHd: 'Hợp lệ', thayDoi: {
    hinhThuc: HINH_THUC.CQ_TRA_THANG, donViId: '44444444-4444-4444-8444-444444444444',
    hinhThucThanhToan: HINH_THUC_THANH_TOAN.CHUYEN_KHOAN,
  } },
  mac_dinh_snapshot: snapshot, het_han: '2026-09-21T00:03:00Z', giao_dich_id: null, loi: null,
  tao_luc: '2026-09-21T00:00:00Z', sua_luc: '2026-09-21T00:00:00Z',
}

describe('giaoDichTuIntake', () => {
  it('đổi đơn vị, hình thức và thanh toán theo đề xuất mà không lấy nội dung từ client', () => {
    const result = giaoDichTuIntake(row, false)
    expect(result.data).toMatchObject({
      hinh_thuc: HINH_THUC.CQ_TRA_THANG,
      don_vi_id: '44444444-4444-4444-8444-444444444444',
      hinh_thuc_thanh_toan: HINH_THUC_THANH_TOAN.CHUYEN_KHOAN,
      noi_dung: '',
    })
  })

  it('nút dùng mặc định bỏ qua thay đổi trong cuộc trò chuyện', () => {
    const result = giaoDichTuIntake(row, true)
    expect(result.data).toMatchObject({
      hinh_thuc: HINH_THUC.HOAN_TAM_UNG,
      don_vi_id: snapshot.donViId,
      hinh_thuc_thanh_toan: HINH_THUC_THANH_TOAN.HOAN_TAM_UNG,
    })
  })
})

