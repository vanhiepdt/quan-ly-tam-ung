import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI } from './kieu'
import { apDungChoHinhThuc, chuanHoaGiaTri, giaTriHienTai, timTruongSua, truongSuaCho, NHOM_SUA, TRUONG_SUA } from './sua-giao-dich'

const DON_VI = '22222222-2222-4222-8222-222222222222'
const row = {
  id: 'g1', ngay: '2026-01-15', soThuTu: 1, taoLuc: '2026-01-15T00:00:00.000Z',
  noiDung: 'Tiếp Phòng Kế hoạch', kyHieuHd: '1C26MTT', soHd: '00123456', loaiHd: 'Hóa đơn Giá trị gia tăng',
  trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 5_647_000, tienRuouBia: 500_000,
  tamUngTuCq: 0, giaoTienChiThuy: 0, hoanUngTienMat: 0, nguoiLayHdId: null, nguoiLayHdTen: null,
  phiLayHdGhiDe: null, trangThaiTtPhi: 'Chưa thanh toán', ghiChu: null,
  donViId: DON_VI, donViTen: 'Phòng Kế hoạch', hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: true, coChuyenKhoan: false,
  hoanTamUng: 5_147_000, cqTraThang: 0, phiLayHd: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0,
}

describe('danh sách trường được sửa theo vai trò và hình thức', () => {
  it('nhap_lieu chỉ thấy ngày, trường chứng từ, đơn vị, hình thức thanh toán và ghi chú', () => {
    const ids = truongSuaCho('nhap_lieu', HINH_THUC.HOAN_TAM_UNG).map(t => t.id)
    expect(ids).toEqual(['ngay', 'ky_hieu_hd', 'so_hd', 'loai_hd', 'trang_thai_hd', 'don_vi_id', 'hinh_thuc_thanh_toan', 'ghi_chu'])
    expect(ids).not.toContain('tong_tien')
    expect(ids).not.toContain('trang_thai_tt_phi')
  })

  it('ngày phát sinh sửa được ở mọi hình thức, kể cả hình thức không gắn đơn vị', () => {
    // Ngày là thuộc tính của cả giao dịch, không phụ thuộc hình thức, nên không
    // được giới hạn theo hinhThuc như các trường tiền.
    for (const hinhThuc of [HINH_THUC.HOAN_TAM_UNG, HINH_THUC.TAM_UNG_THEM, HINH_THUC.GIAO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ, HINH_THUC.CQ_TRA_THANG]) {
      expect(truongSuaCho('nhap_lieu', hinhThuc).map(t => t.id)).toContain('ngay')
    }
    expect(timTruongSua('ngay')!.kieu).toBe('ngay')
  })

  it('admin thấy thêm các trường tiền và dòng tiền của đúng hình thức', () => {
    const hoanTamUng = truongSuaCho('admin', HINH_THUC.HOAN_TAM_UNG).map(t => t.id)
    expect(hoanTamUng).toContain('tong_tien')
    expect(hoanTamUng).toContain('phi_lay_hd_ghi_de')
    // Hoàn tạm ứng không có khoản tạm ứng hay giao tiền, nên ba trường dòng tiền bị ẩn.
    expect(hoanTamUng).not.toContain('tam_ung_tu_cq')
    expect(hoanTamUng).not.toContain('giao_tien_chi_thuy')
    expect(hoanTamUng).not.toContain('hoan_ung_tien_mat')

    const tamUng = truongSuaCho('admin', HINH_THUC.TAM_UNG_THEM).map(t => t.id)
    expect(tamUng).toEqual(['ngay', 'ky_hieu_hd', 'so_hd', 'loai_hd', 'trang_thai_hd', 'tam_ung_tu_cq', 'hinh_thuc_thanh_toan', 'ghi_chu'])
  })

  it('mỗi hình thức chỉ mở đúng một trường dòng tiền', () => {
    const dongTien = (hinhThuc: string) => truongSuaCho('admin', hinhThuc)
      .filter(t => t.nhom === 'dongTien').map(t => t.id)
    expect(dongTien(HINH_THUC.TAM_UNG_THEM)).toEqual(['tam_ung_tu_cq'])
    expect(dongTien(HINH_THUC.GIAO_CHI_THUY)).toEqual(['giao_tien_chi_thuy'])
    expect(dongTien(HINH_THUC.NOP_HOAN_CQ)).toEqual(['hoan_ung_tien_mat'])
    expect(dongTien(HINH_THUC.CQ_TRA_THANG)).toEqual([])
  })

  it('chi_doc không được sửa trường nào', () => {
    expect(truongSuaCho('chi_doc', HINH_THUC.HOAN_TAM_UNG)).toEqual([])
  })

  it('tra trường theo mã và bỏ qua giá trị lạ', () => {
    expect(timTruongSua('tong_tien')?.ten).toBe('Tổng tiền')
    expect(timTruongSua('khong_ton_tai')).toBeUndefined()
    expect(timTruongSua(null)).toBeUndefined()
    expect(timTruongSua(123)).toBeUndefined()
  })

  it('trường không giới hạn hình thức áp dụng cho mọi giao dịch', () => {
    const ghiChu = timTruongSua('ghi_chu')!
    expect(apDungChoHinhThuc(ghiChu, HINH_THUC.TAM_UNG_THEM)).toBe(true)
    const tamUng = timTruongSua('tam_ung_tu_cq')!
    expect(apDungChoHinhThuc(tamUng, HINH_THUC.TAM_UNG_THEM)).toBe(true)
    expect(apDungChoHinhThuc(tamUng, HINH_THUC.HOAN_TAM_UNG)).toBe(false)
  })
})

describe('chuẩn hóa giá trị khi sửa', () => {
  const truong = (id: string) => timTruongSua(id)!

  it('bỏ dấu phân cách nghìn khi nhập tiền', () => {
    expect(chuanHoaGiaTri(truong('tong_tien'), '5.647.000')).toEqual({ ok: true, giaTri: 5_647_000 })
    expect(chuanHoaGiaTri(truong('tong_tien'), '5 647 000')).toEqual({ ok: true, giaTri: 5_647_000 })
  })

  it('từ chối số tiền âm, số thập phân và số vượt giới hạn an toàn', () => {
    expect(chuanHoaGiaTri(truong('tong_tien'), '-1')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('tong_tien'), '12abc')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('tong_tien'), String(Number.MAX_SAFE_INTEGER + 1))).toMatchObject({ ok: false })
  })

  it('ô tiền bắt buộc trả về 0 còn ô tiền cho phép rỗng trả về null', () => {
    expect(chuanHoaGiaTri(truong('tong_tien'), '')).toEqual({ ok: true, giaTri: 0 })
    expect(chuanHoaGiaTri(truong('phi_lay_hd_ghi_de'), '')).toEqual({ ok: true, giaTri: null })
    expect(chuanHoaGiaTri(truong('phi_lay_hd_ghi_de'), '700000')).toEqual({ ok: true, giaTri: 700_000 })
  })

  it('chỉ nhận giá trị nằm trong danh mục', () => {
    expect(chuanHoaGiaTri(truong('trang_thai_hd'), 'Chờ HĐ')).toEqual({ ok: true, giaTri: 'Chờ HĐ' })
    expect(chuanHoaGiaTri(truong('trang_thai_hd'), 'Sai trạng thái')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('trang_thai_tt_phi'), 'Đã thanh toán')).toEqual({ ok: true, giaTri: 'Đã thanh toán' })
  })

  it('trạng thái hóa đơn không được để trống', () => {
    expect(chuanHoaGiaTri(truong('trang_thai_hd'), '   ')).toMatchObject({ ok: false })
  })

  it('khóa ngoại phải là UUID hợp lệ', () => {
    expect(chuanHoaGiaTri(truong('don_vi_id'), DON_VI)).toEqual({ ok: true, giaTri: DON_VI })
    expect(chuanHoaGiaTri(truong('don_vi_id'), 'khong-phai-uuid')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('don_vi_id'), '1; drop table giao_dich')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('nguoi_lay_hd_id'), '')).toEqual({ ok: true, giaTri: null })
  })

  it('giới hạn độ dài chuỗi và cho phép xóa trắng', () => {
    expect(chuanHoaGiaTri(truong('so_hd'), 'A'.repeat(51))).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('so_hd'), '')).toEqual({ ok: true, giaTri: null })
    expect(chuanHoaGiaTri(truong('ghi_chu'), '  ghi chú  ')).toEqual({ ok: true, giaTri: 'ghi chú' })
  })

  it('ngày phát sinh chỉ nhận ngày dương lịch có thật', () => {
    expect(chuanHoaGiaTri(truong('ngay'), '2026-03-01')).toEqual({ ok: true, giaTri: '2026-03-01' })
    // Ô ngày của trình duyệt luôn trả về dạng này; cắt khoảng trắng để giá trị dán vào vẫn dùng được.
    expect(chuanHoaGiaTri(truong('ngay'), ' 2026-12-31 ')).toEqual({ ok: true, giaTri: '2026-12-31' })
    expect(chuanHoaGiaTri(truong('ngay'), '01/03/2026')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '2026-3-1')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), 'ngay mai')).toMatchObject({ ok: false })
  })

  it('ngày không tồn tại hoặc nằm ngoài khoảng năm bị từ chối ngay tại đây', () => {
    // 2026-02-30 đúng định dạng nhưng không có thật; để nó đi tới SQL sẽ thành lỗi khó hiểu.
    expect(chuanHoaGiaTri(truong('ngay'), '2026-02-30')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '2026-13-01')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '2026-00-10')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '2026-04-31')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '1899-12-31')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '3000-01-01')).toMatchObject({ ok: false })
    // Năm nhuận thật thì phải qua được.
    expect(chuanHoaGiaTri(truong('ngay'), '2024-02-29')).toEqual({ ok: true, giaTri: '2024-02-29' })
    expect(chuanHoaGiaTri(truong('ngay'), '2026-02-29')).toMatchObject({ ok: false })
  })

  it('ngày phát sinh không được để trống', () => {
    expect(chuanHoaGiaTri(truong('ngay'), '')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), '   ')).toMatchObject({ ok: false })
    expect(chuanHoaGiaTri(truong('ngay'), null)).toMatchObject({ ok: false })
  })

  it('đọc giá trị hiện tại để điền sẵn vào ô nhập', () => {
    expect(giaTriHienTai(row, 'ngay')).toBe('2026-01-15')
    expect(giaTriHienTai(row, 'so_hd')).toBe('00123456')
    expect(giaTriHienTai(row, 'phi_lay_hd_ghi_de')).toBe('')
    expect(giaTriHienTai(row, 'tong_tien')).toBe('5647000')
    expect(giaTriHienTai(row, 'don_vi_id')).toBe(DON_VI)
    expect(giaTriHienTai(row, 'ghi_chu')).toBe('')
    expect(giaTriHienTai(row, 'khong_ton_tai')).toBe('')
  })

  it('mọi trường sửa đều có nhóm hợp lệ và mã không trùng', () => {
    expect(new Set(TRUONG_SUA.map(t => t.id)).size).toBe(TRUONG_SUA.length)
    const nhom = new Set(['ngayPhatSinh', 'chungTu', 'tienHd', 'dongTien', 'donVi', 'giay', 'ghiChu'])
    for (const t of TRUONG_SUA) expect(nhom.has(t.nhom)).toBe(true)
  })

  it('mọi nhóm trong NHOM_SUA đều có ít nhất một trường', () => {
    // Hộp thoại sửa dựng optgroup từ NHOM_SUA, nên một nhóm rỗng sẽ hiện ra
    // như một mục trống không chọn được gì.
    for (const n of NHOM_SUA) {
      expect(TRUONG_SUA.filter(t => t.nhom === n.id).length).toBeGreaterThan(0)
    }
  })
})
