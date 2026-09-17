import { describe, expect, it } from 'vitest'
import {
  canDonVi, canTaiKhoanNhan, DS_HINH_THUC_THANH_TOAN, dsHinhThucThanhToan, HINH_THUC_CAN_DON_VI,
  HINH_THUC_THANH_TOAN, hinhThucThanhToanMacDinh, hopLeHinhThucThanhToan, laHinhThucThanhToan,
  NHAN_HINH_THUC_THANH_TOAN, noiDungTheoDonVi, oVuongTamUng,
} from './hinh-thuc'
import { HINH_THUC } from './kieu'

describe('hình thức gắn đơn vị tiếp khách', () => {
  it('chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới cần đơn vị', () => {
    expect(HINH_THUC_CAN_DON_VI).toEqual([HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG])
    expect(canDonVi(HINH_THUC.HOAN_TAM_UNG)).toBe(true)
    expect(canDonVi(HINH_THUC.CQ_TRA_THANG)).toBe(true)
  })

  it.each([HINH_THUC.TAM_UNG_THEM, HINH_THUC.GIAO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ, '', 'Không tồn tại'])(
    'dòng tiền nội bộ "%s" không cần đơn vị', hinhThuc => {
      expect(canDonVi(hinhThuc)).toBe(false)
    },
  )
})

describe('nội dung sinh từ tên đơn vị', () => {
  it('ghép tiền tố "Tiếp" với tên đơn vị', () => {
    expect(noiDungTheoDonVi('Phòng Kế hoạch')).toBe('Tiếp Phòng Kế hoạch')
  })

  it('cắt bớt tên đơn vị dài để không vượt giới hạn cột nội dung', () => {
    const noiDung = noiDungTheoDonVi('A'.repeat(2000))
    expect(noiDung).toHaveLength(1000)
    expect(noiDung.startsWith('Tiếp ')).toBe(true)
  })
})

describe('ba hình thức thanh toán in trên giấy', () => {
  it('gồm đúng tiền mặt, chuyển khoản và hoàn tạm ứng', () => {
    expect(DS_HINH_THUC_THANH_TOAN).toEqual(['tien_mat', 'chuyen_khoan', 'hoan_tam_ung'])
    expect(NHAN_HINH_THUC_THANH_TOAN).toEqual({
      tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', hoan_tam_ung: 'Hoàn tạm ứng',
    })
    for (const giaTri of DS_HINH_THUC_THANH_TOAN) expect(laHinhThucThanhToan(giaTri)).toBe(true)
    for (const giaTri of ['', null, undefined, 'Tien mat', 'khac']) expect(laHinhThucThanhToan(giaTri)).toBe(false)
  })

  it('mỗi hình thức giao dịch chỉ dùng một phần giá trị', () => {
    // Hoàn tạm ứng in đúng chữ "Hoàn tạm ứng", người dùng không chọn gì.
    expect(dsHinhThucThanhToan(HINH_THUC.HOAN_TAM_UNG)).toEqual([HINH_THUC_THANH_TOAN.HOAN_TAM_UNG])
    // Cơ quan trả thẳng chọn tiền mặt hoặc chuyển khoản.
    expect(dsHinhThucThanhToan(HINH_THUC.CQ_TRA_THANG)).toEqual([HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN])
    // Giấy đề nghị tạm ứng cũng có hai ô vuông Chuyển khoản / Tiền mặt.
    expect(dsHinhThucThanhToan(HINH_THUC.TAM_UNG_THEM)).toEqual([HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN])
    // Dòng tiền nội bộ không lập giấy nên không có hình thức thanh toán.
    for (const hinhThuc of [HINH_THUC.GIAO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ, '', 'Không tồn tại']) {
      expect(dsHinhThucThanhToan(hinhThuc)).toEqual([])
      expect(hinhThucThanhToanMacDinh(hinhThuc)).toBeNull()
    }
  })

  it('máy tự điền mặc định là lựa chọn đầu tiên của hình thức', () => {
    expect(hinhThucThanhToanMacDinh(HINH_THUC.HOAN_TAM_UNG)).toBe(HINH_THUC_THANH_TOAN.HOAN_TAM_UNG)
    expect(hinhThucThanhToanMacDinh(HINH_THUC.CQ_TRA_THANG)).toBe(HINH_THUC_THANH_TOAN.TIEN_MAT)
    expect(hinhThucThanhToanMacDinh(HINH_THUC.TAM_UNG_THEM)).toBe(HINH_THUC_THANH_TOAN.TIEN_MAT)
  })

  it('bỏ trống luôn hợp lệ vì máy điền mặc định, giá trị lạ thì không', () => {
    for (const hinhThuc of [HINH_THUC.TAM_UNG_THEM, HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG]) {
      expect(hopLeHinhThucThanhToan(hinhThuc, null)).toBe(true)
      expect(hopLeHinhThucThanhToan(hinhThuc, undefined)).toBe(true)
      expect(hopLeHinhThucThanhToan(hinhThuc, '')).toBe(true)
    }
    // Hoàn tạm ứng không nhận tiền mặt hay chuyển khoản do người dùng gửi lên.
    expect(hopLeHinhThucThanhToan(HINH_THUC.HOAN_TAM_UNG, 'tien_mat')).toBe(false)
    expect(hopLeHinhThucThanhToan(HINH_THUC.HOAN_TAM_UNG, 'hoan_tam_ung')).toBe(true)
    expect(hopLeHinhThucThanhToan(HINH_THUC.CQ_TRA_THANG, 'chuyen_khoan')).toBe(true)
    expect(hopLeHinhThucThanhToan(HINH_THUC.CQ_TRA_THANG, 'hoan_tam_ung')).toBe(false)
    // Dòng tiền nội bộ không nhận bất kỳ giá trị nào.
    expect(hopLeHinhThucThanhToan(HINH_THUC.GIAO_CHI_THUY, 'tien_mat')).toBe(false)
    expect(hopLeHinhThucThanhToan(HINH_THUC.GIAO_CHI_THUY, null)).toBe(true)
  })

  it('chỉ chuyển khoản mới cần in số tài khoản nhận tiền', () => {
    expect(canTaiKhoanNhan(HINH_THUC_THANH_TOAN.CHUYEN_KHOAN)).toBe(true)
    expect(canTaiKhoanNhan(HINH_THUC_THANH_TOAN.TIEN_MAT)).toBe(false)
    expect(canTaiKhoanNhan(HINH_THUC_THANH_TOAN.HOAN_TAM_UNG)).toBe(false)
    expect(canTaiKhoanNhan(null)).toBe(false)
  })

  it('hai ô vuông của giấy tạm ứng mang theo cả nhãn vì mẫu Word không có nhãn', () => {
    // Mẫu chỉ có [[CK]] [[TM]] đứng sát nhau, nên nhãn phải nằm trong giá trị thay vào.
    expect(oVuongTamUng(HINH_THUC_THANH_TOAN.CHUYEN_KHOAN)).toEqual({
      CK: '☒ Chuyển khoản', TM: '☐ Tiền mặt',
    })
    expect(oVuongTamUng(HINH_THUC_THANH_TOAN.TIEN_MAT)).toEqual({
      CK: '☐ Chuyển khoản', TM: '☒ Tiền mặt',
    })
    // Hoàn tạm ứng và để trống đều in ô Tiền mặt, vì giấy tạm ứng chỉ có hai ô.
    for (const giaTri of [HINH_THUC_THANH_TOAN.HOAN_TAM_UNG, null, '']) {
      expect(oVuongTamUng(giaTri)).toEqual({ CK: '☐ Chuyển khoản', TM: '☒ Tiền mặt' })
    }
  })
})
