import { describe, expect, it } from 'vitest'
import { CAU_HINH_GIAY_MAC_DINH } from './giay'
import { docCauHinhGiayTu, KHOA_CAU_HINH_GIAY, VAI_TRO_KY } from './cau-hinh-giay'

const rows = (bang: Record<string, unknown>) =>
  Object.entries(bang).map(([khoa, gia_tri]) => ({ khoa, gia_tri }))

describe('đọc cấu hình giấy từ bảng cau_hinh', () => {
  it('bảng rỗng thì dùng hết giá trị mặc định', () => {
    expect(docCauHinhGiayTu([])).toEqual(CAU_HINH_GIAY_MAC_DINH)
  })

  it('đọc chuỗi đã cấu hình và cắt khoảng trắng thừa', () => {
    const cauHinh = docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.tenDonVi]: '  Trung tâm Tin học ',
      [KHOA_CAU_HINH_GIAY.diaDanh]: 'Đà Nẵng',
      [KHOA_CAU_HINH_GIAY.lyDoTamUng]: 'Công tác phí',
      [KHOA_CAU_HINH_GIAY.thoiHanThanhToan]: 'Trong 30 ngày',
    }))
    expect(cauHinh.tenDonVi).toBe('Trung tâm Tin học')
    expect(cauHinh.tenMuaHangDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.tenMuaHangDonVi)
    expect(cauHinh.diaDanh).toBe('Đà Nẵng')
    expect(cauHinh.mstDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.mstDonVi)
    expect(cauHinh.diaChiDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.diaChiDonVi)
    expect(cauHinh.lyDoTamUng).toBe('Công tác phí')
    expect(cauHinh.thoiHanThanhToan).toBe('Trong 30 ngày')
  })

  it('chuỗi rỗng hoặc sai kiểu thì rơi về mặc định thay vì làm hỏng trang in', () => {
    const cauHinh = docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.tenDonVi]: '   ',
      [KHOA_CAU_HINH_GIAY.diaDanh]: 123,
      [KHOA_CAU_HINH_GIAY.lyDoTamUng]: null,
      [KHOA_CAU_HINH_GIAY.thoiHanThanhToan]: { khong: 'phai chuoi' },
    }))
    expect(cauHinh.tenDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.tenDonVi)
    expect(cauHinh.diaDanh).toBe(CAU_HINH_GIAY_MAC_DINH.diaDanh)
    expect(cauHinh.lyDoTamUng).toBe(CAU_HINH_GIAY_MAC_DINH.lyDoTamUng)
    expect(cauHinh.thoiHanThanhToan).toBe(CAU_HINH_GIAY_MAC_DINH.thoiHanThanhToan)
  })

  it('đọc mã cán bộ của từng vai trò ký trong một khoá jsonb', () => {
    const cauHinh = docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.nguoiKyMacDinh]: {
        nguoiDeNghiId: 'cb-nd', lanhDaoTiepKhachId: 'cb-tk', lanhDaoThanhToanId: 'cb-tt',
        truongPhongId: 'cb-tp', keToanKiemSoatId: 'cb-kt',
      },
    }))
    expect(cauHinh.nguoiDeNghiId).toBe('cb-nd')
    expect(cauHinh.lanhDaoTiepKhachId).toBe('cb-tk')
    expect(cauHinh.lanhDaoThanhToanId).toBe('cb-tt')
    expect(cauHinh.truongPhongId).toBe('cb-tp')
    expect(cauHinh.keToanKiemSoatId).toBe('cb-kt')
  })

  it('khoá người ký hỏng thì mọi vai trò để trống', () => {
    // Giá trị không phải object (mảng, chuỗi, số) không được làm hỏng cả trang in.
    for (const giaTri of [[], 'cb-nd', 5, null, true]) {
      const cauHinh = docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.nguoiKyMacDinh]: giaTri }))
      for (const vaiTro of VAI_TRO_KY) expect(cauHinh[vaiTro.id]).toBeNull()
    }
  })

  it('mã cán bộ rỗng hoặc sai kiểu thì coi như chưa cấu hình', () => {
    const cauHinh = docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.nguoiKyMacDinh]: { nguoiDeNghiId: '', truongPhongId: 7, keToanKiemSoatId: null },
    }))
    expect(cauHinh.nguoiDeNghiId).toBeNull()
    expect(cauHinh.truongPhongId).toBeNull()
    expect(cauHinh.keToanKiemSoatId).toBeNull()
  })

  it('đọc MST đơn vị, bỏ dấu chấm gạch, chuỗi rỗng thì để trống', () => {
    expect(docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.mstDonVi]: '010-010-0100' })).mstDonVi).toBe('0100100100')
    expect(docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.mstDonVi]: '0100695387-066' })).mstDonVi).toBe('0100695387066')
    expect(docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.mstDonVi]: '   ' })).mstDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.mstDonVi)
    expect(docCauHinhGiayTu([]).mstDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.mstDonVi)
  })

  it('đọc địa chỉ đơn vị để đối chiếu người mua trên hóa đơn', () => {
    expect(docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.diaChiDonVi]: '  Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường ',
    })).diaChiDonVi).toBe('Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường')
    expect(docCauHinhGiayTu([]).diaChiDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.diaChiDonVi)
  })

  it('tên người mua trên hóa đơn tách khỏi tên in giấy', () => {
    const cauHinh = docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.tenDonVi]: 'Trung tâm Đào tạo',
      [KHOA_CAU_HINH_GIAY.tenMuaHangDonVi]: ' Trung tâm Đào tạo Ngân hàng Chính sách xã hội ',
    }))
    expect(cauHinh.tenDonVi).toBe('Trung tâm Đào tạo')
    expect(cauHinh.tenMuaHangDonVi).toBe('Trung tâm Đào tạo Ngân hàng Chính sách xã hội')
    expect(docCauHinhGiayTu([]).tenMuaHangDonVi).toBe(CAU_HINH_GIAY_MAC_DINH.tenMuaHangDonVi)
  })

  it('đọc người lấy hóa đơn mặc định để lấy tài khoản nhận tiền', () => {
    expect(docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId]: 'nl-a' })).nguoiLayHdMacDinhId).toBe('nl-a')
    expect(docCauHinhGiayTu(rows({ [KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId]: '' })).nguoiLayHdMacDinhId).toBeNull()
    expect(docCauHinhGiayTu([]).nguoiLayHdMacDinhId).toBeNull()
  })

  it('đọc trạng thái thanh toán phí mặc định, sai giá trị thì rơi về Không phát sinh', () => {
    expect(docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.trangThaiTtPhiMacDinh]: 'Chưa thanh toán',
    })).trangThaiTtPhiMacDinh).toBe('Chưa thanh toán')
    expect(docCauHinhGiayTu(rows({
      [KHOA_CAU_HINH_GIAY.trangThaiTtPhiMacDinh]: 'không phải trạng thái',
    })).trangThaiTtPhiMacDinh).toBe('Không phát sinh')
    expect(docCauHinhGiayTu([]).trangThaiTtPhiMacDinh).toBe('Không phát sinh')
  })

  it('mỗi vai trò ký có mã riêng và không trùng nhau', () => {
    expect(new Set(VAI_TRO_KY.map(v => v.id)).size).toBe(VAI_TRO_KY.length)
    expect(VAI_TRO_KY.map(v => v.id)).toEqual([
      'nguoiDeNghiId', 'lanhDaoTiepKhachId', 'lanhDaoThanhToanId', 'truongPhongId', 'keToanKiemSoatId',
    ])
  })
})
