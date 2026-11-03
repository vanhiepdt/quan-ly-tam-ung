import { describe, expect, it } from 'vitest'
import { laTenChietKhau, tienDongCoDau, truChietKhauHoaDon } from './chiet-khau'
import { docHoaDonXml } from './xml-hoa-don'
import { phanBoPhuLuc } from './phan-bo-phu-luc'
import { kiemTraChiTietHoaDon } from '../tai-chinh/kiem-tra-chi-tiet-hoa-don'
import { canBangDeNghi } from '../tai-chinh/phu-luc'
import type { DongHang } from './giao-dien'

const tong = (dong: DongHang[]) => dong.reduce((s, d) => s + tienDongCoDau(d, 'ban_hang'), 0)

describe('chiết khấu hóa đơn', () => {
  it('nhận tên dòng chiết khấu', () => {
    expect(laTenChietKhau('Chiết khấu thương mại')).toBe(true)
    expect(laTenChietKhau('Giảm giá 10%')).toBe(true)
    expect(laTenChietKhau('2. Chiết khấu')).toBe(true)
    expect(laTenChietKhau('Bia Tiger')).toBe(false)
  })

  it('giữ dòng chiết khấu riêng, nhận theo tên, không chia vào món', () => {
    const { dong, daTru } = truChietKhauHoaDon([
      { ten: 'Lẩu', thanhTien: 5000000 },
      { ten: 'Chiết khấu 10%', thanhTien: 500000 },
    ], 'ban_hang')
    expect(dong).toHaveLength(2)
    expect(dong[0].thanhTien).toBe(5000000)
    expect(dong[1].laChietKhau).toBe(true)
    expect(daTru).toBe(500000)
  })

  it('thêm một dòng chiết khấu khi chiết khấu chỉ ghi ở phần tổng', () => {
    const { dong, daTru } = truChietKhauHoaDon(
      [{ ten: 'Lẩu', thanhTien: 5000000 }, { ten: 'Bia', thanhTien: 3774100 }],
      'ban_hang', undefined, 944200, 7829900,
    )
    expect(dong).toHaveLength(3)
    expect(dong[2]).toMatchObject({ ten: 'Chiết khấu thương mại', laChietKhau: true, thanhTien: 944200 })
    expect(daTru).toBe(944200)
    expect(tong(dong)).toBe(7829900)
  })

  it('không thêm khi chênh lớn hơn mức chiết khấu khai báo', () => {
    const { dong, daTru } = truChietKhauHoaDon([{ ten: 'Lẩu', thanhTien: 9000000 }], 'ban_hang', undefined, 100000, 7000000)
    expect(daTru).toBe(0)
    expect(dong).toHaveLength(1)
  })

  it('XML có dòng TChat=3 giữ dòng chiết khấu và tổng bằng tổng thanh toán', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><TCHDon>Hóa đơn bán hàng</TCHDon><KHHDon>2C26TAA</KHHDon><SHDon>5</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><DSHHDVu>
<HHDVu><TChat>1</TChat><THHDVu>Lẩu cá</THHDVu><ThTien>5000000</ThTien></HHDVu>
<HHDVu><TChat>1</TChat><THHDVu>Bia Hà Nội</THHDVu><ThTien>3774100</ThTien></HHDVu>
<HHDVu><TChat>3</TChat><THHDVu>Khuyến mại khách quen</THHDVu><ThTien>944200</ThTien></HHDVu>
</DSHHDVu></NDHDon>
<TToan><TgTTTBSo>7829900</TgTTTBSo></TToan></DLHDon></HDon>`
    const doc = docHoaDonXml(xml)
    expect(doc.dongHang).toHaveLength(3)
    expect(doc.dongHang![2]).toMatchObject({ laChietKhau: true, laRuouBia: false })
    expect(tong(doc.dongHang!)).toBe(7829900)
    expect(doc.tienRuouBia).toBe(3774100)
  })

  it('XML khai TTCKTMai ở phần tổng', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><TCHDon>Hóa đơn bán hàng</TCHDon><KHHDon>2C26TAA</KHHDon><SHDon>6</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><DSHHDVu>
<HHDVu><THHDVu>Lẩu cá</THHDVu><ThTien>5000000</ThTien></HHDVu>
<HHDVu><THHDVu>Bia Hà Nội</THHDVu><ThTien>3774100</ThTien></HHDVu>
</DSHHDVu></NDHDon>
<TToan><TTCKTMai>944200</TTCKTMai><TgTTTBSo>7829900</TgTTTBSo></TToan></DLHDon></HDon>`
    const doc = docHoaDonXml(xml)
    expect(doc.chietKhau).toBe(944200)
    expect(doc.dongHang).toHaveLength(3)
    expect(tong(doc.dongHang!)).toBe(7829900)
  })

  it('XML chiết khấu từng dòng (ThTien đã trừ) thì không thêm dòng', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><TCHDon>Hóa đơn bán hàng</TCHDon><KHHDon>2C26TAA</KHHDon><SHDon>7</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><DSHHDVu>
<HHDVu><THHDVu>Cá tầm</THHDVu><SLuong>2.5</SLuong><DGia>550000</DGia><TLCKhau>5</TLCKhau><STCKhau>68750</STCKhau><ThTien>1306250</ThTien></HHDVu>
</DSHHDVu></NDHDon>
<TToan><TTCKTMai>68750</TTCKTMai><TgTTTBSo>1306250</TgTTTBSo></TToan></DLHDon></HDon>`
    const doc = docHoaDonXml(xml)
    expect(doc.dongHang).toHaveLength(1)
    expect(tong(doc.dongHang!)).toBe(1306250)
  })

  it('bảng kê có một dòng chiết khấu âm, trừ vào đề nghị, kiểm tra không báo lệch', () => {
    const chiTiet = {
      tongTien: 7829900, loaiHd: 'ban_hang' as const,
      dongHang: [
        { ten: 'Lẩu cá', thanhTien: 5000000 },
        { ten: 'Bia Hà Nội', thanhTien: 3774100, laRuouBia: true },
        { ten: 'Chiết khấu', thanhTien: 944200, laChietKhau: true },
      ],
    }
    const phanBo = phanBoPhuLuc(chiTiet)
    expect(phanBo.cacDongTheoHoaDon).toHaveLength(3)
    expect(phanBo.cacDongTheoHoaDon[2]).toMatchObject({ thanhTienHoaDon: -944200, deNghiThanhToan: -944200, laChietKhau: true })
    expect(phanBo.tongHoaDon).toBe(7829900)
    expect(phanBo.tongDeNghi).toBe(5000000 - 944200)
    expect(phanBo.tongKhongDeNghi).toBe(3774100)
    expect(kiemTraChiTietHoaDon(chiTiet, 7829900)).toEqual({ loi: null, tienKhongThanhToan: 3774100 })
    // Làm tròn tổng đề nghị không chạm vào dòng chiết khấu.
    const canBang = canBangDeNghi(phanBo.cacDongTheoHoaDon, 4055000)
    expect(canBang[2].deNghiThanhToan).toBe(-944200)
    expect(canBang.reduce((s, r) => s + r.deNghiThanhToan, 0)).toBe(4055000)
  })

  it('chiết khấu lớn hơn phần đề nghị thì phần dư trừ vào phần không đề nghị', () => {
    const phanBo = phanBoPhuLuc({
      loaiHd: 'ban_hang',
      dongHang: [
        { ten: 'Nước', thanhTien: 100000 },
        { ten: 'Bia', thanhTien: 900000, laRuouBia: true },
        { ten: 'Giảm giá', thanhTien: 300000, laChietKhau: true },
      ],
    })
    expect(phanBo.tongDeNghi).toBe(0)
    expect(phanBo.tongKhongDeNghi).toBe(700000)
    expect(phanBo.tongHoaDon).toBe(700000)
  })
})
