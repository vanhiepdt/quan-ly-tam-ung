import { describe, expect, it } from 'vitest'
import { phanBoPhuLuc } from './phan-bo-phu-luc'

describe('phân bổ phụ lục theo dòng hóa đơn', () => {
  it('chọn tổ hợp món có giá trị lớn nhất trong phần định mức buffet còn dư', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
      dongHang: [
        { ten: 'Suất Buffet 350', soLuong: 2, donGia: 350_000, thanhTien: 700_000 },
        { ten: 'Coca', soLuong: 1, donGia: 70_000, thanhTien: 70_000 },
        { ten: 'Nước suối', soLuong: 1, donGia: 30_000, thanhTien: 30_000 },
      ],
    })

    expect(kq.loi).toBeUndefined()
    expect(kq.tongDeNghi).toBe(770_000)
    expect(kq.tongKhongDeNghi).toBe(30_000)
    expect(kq.cacDongTheoHoaDon.map(d => [d.ten, d.thanhTienHoaDon, d.deNghiThanhToan])).toEqual([
      ['Suất Buffet 350', 700_000, 700_000], ['Coca', 70_000, 70_000], ['Nước suối', 30_000, 0],
    ])
    expect(kq.cacKhoanDeNghi.map(d => d.ten)).toEqual(['Suất Buffet 350', 'Coca'])
  })

  it('lập đúng phụ lục hóa đơn mẫu: buffet vượt, buffet dưới định mức và chọn Coca cùng Khăn Lạnh', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'gtgt', cotTienHang: 'truoc_thue', tongTien: 6_933_260,
      dongHang: [
        { ten: 'Suất Buffet 565', soLuong: 10, donGia: 565_000, thanhTien: 5_650_000, tienThue: 452_000 },
        { ten: 'Suất Buffet 279', soLuong: 2, donGia: 279_000, thanhTien: 558_000, tienThue: 44_640 },
        { ten: 'Coca', soLuong: 5, donGia: 29_000, thanhTien: 145_000, tienThue: 14_500 },
        { ten: 'Nước Khoáng Alba', soLuong: 2, donGia: 29_000, thanhTien: 58_000, tienThue: 4_640 },
        { ten: 'Khăn Lạnh', soLuong: 2, donGia: 3_000, thanhTien: 6_000, tienThue: 480 },
      ],
    })

    expect(kq.loi).toBeUndefined()
    expect(kq.tongHoaDon).toBe(6_933_260)
    expect(kq.tongDeNghi).toBe(4_668_620)
    expect(kq.tongKhongDeNghi).toBe(2_264_640)
    expect(kq.cacDongTheoHoaDon.map(d => [d.ten, d.thanhTienHoaDon, d.deNghiThanhToan])).toEqual([
      ['Suất Buffet 565', 6_102_000, 3_900_000], ['Suất Buffet 279', 602_640, 602_640],
      ['Coca', 159_500, 159_500], ['Nước Khoáng Alba', 62_640, 0], ['Khăn Lạnh', 6_480, 6_480],
    ])
    expect(kq.cacKhoanDeNghi.map(d => [d.ten, d.soLuong, d.thanhTien])).toEqual([
      ['Suất Buffet 565', 10, 3_900_000],
      ['Suất Buffet 279', 2, 602_640],
      ['Coca', 5, 159_500],
      ['Khăn Lạnh', 2, 6_480],
    ])
    expect(kq.cacKhoanKhongDeNghi.map(d => [d.ten, d.soLuong, d.donGia, d.tienThue, d.thanhTien])).toEqual([
      ['Suất Buffet 565', 10, 175_000, null, 2_202_000],
      ['Nước Khoáng Alba', 2, 29_000, 4_640, 62_640],
    ])
    expect(kq.cacKhoanDeNghi[0]).toMatchObject({ donGia: 390_000, tienThue: null })
    expect(kq.cacKhoanDeNghi[1]).toMatchObject({ donGia: 279_000, tienThue: 44_640 })
  })

  it('để trống thuế cho hóa đơn bán hàng và tách phần buffet sau thuế', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
      dongHang: [{ ten: 'Suất buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 }],
    })

    expect(kq.tongDeNghi).toBe(390_000)
    expect(kq.tongKhongDeNghi).toBe(60_000)
    expect(kq.cacKhoanDeNghi[0]).toMatchObject({ donGia: 390_000, tienThue: null, thanhTien: 390_000 })
    expect(kq.cacKhoanKhongDeNghi[0]).toMatchObject({ donGia: 60_000, tienThue: null, thanhTien: 60_000 })
  })

  it('không áp định mức khi không có buffet, chỉ loại bia rượu', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang',
      dongHang: [
        { ten: 'Cơm đoàn', soLuong: 1, donGia: 900_000, thanhTien: 900_000 },
        { ten: 'Bia Tiger', soLuong: 2, donGia: 80_000, thanhTien: 160_000 },
      ],
    })

    expect(kq.tongDeNghi).toBe(900_000)
    expect(kq.tongKhongDeNghi).toBe(160_000)
    expect(kq.cacKhoanKhongDeNghi[0].ghiChu).toBe('')
    expect(kq.cacDongTheoHoaDon[1].ghiChu).toBe('')
  })

  it('không thanh toán bia rượu trong hóa đơn có buffet', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang',
      dongHang: [
        { ten: 'Suất Buffet 350', soLuong: 1, donGia: 350_000, thanhTien: 350_000 },
        { ten: 'Bia Tiger', soLuong: 1, donGia: 80_000, thanhTien: 80_000 },
        { ten: 'Món thêm', soLuong: 1, donGia: 50_000, thanhTien: 50_000 },
      ],
    })

    expect(kq.tongDeNghi).toBe(350_000)
    expect(kq.tongKhongDeNghi).toBe(130_000)
  })


  it('lưu số tiền đề nghị và ghi chú đã chỉnh, đồng thời dùng phần định mức buffet còn lại', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
      dongHang: [
        { ten: 'Suất Buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000, deNghiThanhToan: 350_000, ghiChu: 'Theo định mức đã duyệt' },
        { ten: 'Coca', soLuong: 1, donGia: 30_000, thanhTien: 30_000, deNghiThanhToan: 30_000 },
      ],
    })

    expect(kq.loi).toBeUndefined()
    expect(kq.tongDeNghi).toBe(380_000)
    expect(kq.tongKhongDeNghi).toBe(100_000)
    expect(kq.cacDongTheoHoaDon.map(d => [d.deNghiThanhToan, d.ghiChu])).toEqual([
      [350_000, 'Theo định mức đã duyệt'], [30_000, ''],
    ])
  })

  it('chỉ từ chối số đề nghị vượt giá trị hóa đơn, còn lại cho người dùng quyết định', () => {
    const nen = {
      loaiHd: 'ban_hang' as const, cotTienHang: 'sau_thue' as const,
      dongHang: [
        { ten: 'Suất Buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 },
        { ten: 'Coca', soLuong: 1, donGia: 30_000, thanhTien: 30_000 },
      ],
    }
    expect(phanBoPhuLuc({ ...nen, dongHang: [{ ...nen.dongHang[0], deNghiThanhToan: 450_001 }, nen.dongHang[1]] }).loi).toContain('không được vượt thành tiền')
    const vuotDinhMuc = phanBoPhuLuc({ ...nen, dongHang: [{ ...nen.dongHang[0], deNghiThanhToan: 450_000 }, { ...nen.dongHang[1], deNghiThanhToan: 30_000 }] })
    expect(vuotDinhMuc.loi).toBeUndefined()
    expect(vuotDinhMuc.tongDeNghi).toBe(480_000)
    expect(vuotDinhMuc.tongKhongDeNghi).toBe(0)
  })

  it('cho đề nghị lại món tự động bị loại như bia rượu, tổng cộng đổi theo', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang',
      dongHang: [
        { ten: 'Lẩu', thanhTien: 200_000 },
        { ten: 'Bia Tiger', thanhTien: 80_000, deNghiThanhToan: 50_000 },
      ],
    })
    expect(kq.loi).toBeUndefined()
    expect(kq.tongDeNghi).toBe(250_000)
    expect(kq.tongKhongDeNghi).toBe(30_000)
    expect(kq.cacDongTheoHoaDon.map(d => d.deNghiThanhToan)).toEqual([200_000, 50_000])
  })

  it('báo lỗi thay vì đoán số suất khi dòng buffet thiếu số lượng', () => {
    const kq = phanBoPhuLuc({
      loaiHd: 'ban_hang',
      dongHang: [{ ten: 'Buffet nhà hàng', donGia: 450_000, thanhTien: 910_000 }],
    })

    expect(kq.loi).toContain('số lượng')
  })
})
