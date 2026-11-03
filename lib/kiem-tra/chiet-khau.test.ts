import { describe, expect, it } from 'vitest'
import { apDungChietKhau, laTenChietKhau, truChietKhauHoaDon } from './chiet-khau'
import { docHoaDonXml } from './xml-hoa-don'
import { phanBoPhuLuc } from './phan-bo-phu-luc'
import { kiemTraChiTietHoaDon } from '../tai-chinh/kiem-tra-chi-tiet-hoa-don'
import type { DongHang } from './giao-dien'

const tong = (dong: DongHang[]) => dong.reduce((s, d) => s + (d.thanhTienSauThue ?? d.thanhTien), 0)

describe('chiết khấu hóa đơn', () => {
  it('nhận tên dòng chiết khấu', () => {
    expect(laTenChietKhau('Chiết khấu thương mại')).toBe(true)
    expect(laTenChietKhau('Giảm giá 10%')).toBe(true)
    expect(laTenChietKhau('2. Chiết khấu')).toBe(true)
    expect(laTenChietKhau('Bia Tiger')).toBe(false)
  })

  it('bỏ dòng chiết khấu, chia vào các dòng hàng và khớp từng đồng', () => {
    const dong = apDungChietKhau([
      { ten: 'Lẩu', thanhTien: 333333 },
      { ten: 'Bia', thanhTien: 666667 },
      { ten: 'Chiết khấu', thanhTien: 100001, laChietKhau: true },
    ], 'ban_hang')
    expect(dong).toHaveLength(2)
    expect(tong(dong)).toBe(1000000 - 100001)
    expect(dong.reduce((s, d) => s + (d.chietKhau ?? 0), 0)).toBe(100001)
    expect(apDungChietKhau(dong, 'ban_hang')).toEqual(dong)
  })

  it('trừ chiết khấu ở phần tổng khi tổng dòng lớn hơn tổng thanh toán', () => {
    const { dong, daTru } = truChietKhauHoaDon(
      [{ ten: 'Lẩu', thanhTien: 5000000 }, { ten: 'Bia', thanhTien: 3774100 }],
      'ban_hang', undefined, 944200, 7829900,
    )
    expect(daTru).toBe(944200)
    expect(tong(dong)).toBe(7829900)
  })

  it('không trừ khi chênh lớn hơn mức chiết khấu khai báo', () => {
    const { dong, daTru } = truChietKhauHoaDon([{ ten: 'Lẩu', thanhTien: 9000000 }], 'ban_hang', undefined, 100000, 7000000)
    expect(daTru).toBe(0)
    expect(tong(dong)).toBe(9000000)
  })

  it('XML có dòng TChat=3 thì tổng dòng bằng tổng thanh toán', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><TCHDon>Hóa đơn bán hàng</TCHDon><KHHDon>2C26TAA</KHHDon><SHDon>5</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><DSHHDVu>
<HHDVu><TChat>1</TChat><THHDVu>Lẩu cá</THHDVu><ThTien>5000000</ThTien></HHDVu>
<HHDVu><TChat>1</TChat><THHDVu>Bia Hà Nội</THHDVu><ThTien>3774100</ThTien></HHDVu>
<HHDVu><TChat>3</TChat><THHDVu>Khuyến mại khách quen</THHDVu><ThTien>944200</ThTien></HHDVu>
</DSHHDVu></NDHDon>
<TToan><TgTTTBSo>7829900</TgTTTBSo></TToan></DLHDon></HDon>`
    const doc = docHoaDonXml(xml)
    expect(doc.dongHang).toHaveLength(2)
    expect(tong(doc.dongHang!)).toBe(7829900)
    expect(doc.tienRuouBia).toBe(doc.dongHang![1].thanhTienSauThue)
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
    expect(tong(doc.dongHang!)).toBe(7829900)
  })

  it('XML chiết khấu từng dòng (ThTien đã trừ) thì không trừ lần hai', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><TCHDon>Hóa đơn bán hàng</TCHDon><KHHDon>2C26TAA</KHHDon><SHDon>7</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><DSHHDVu>
<HHDVu><THHDVu>Cá tầm</THHDVu><SLuong>2.5</SLuong><DGia>550000</DGia><TLCKhau>5</TLCKhau><STCKhau>68750</STCKhau><ThTien>1306250</ThTien></HHDVu>
</DSHHDVu></NDHDon>
<TToan><TTCKTMai>68750</TTCKTMai><TgTTTBSo>1306250</TgTTTBSo></TToan></DLHDon></HDon>`
    const doc = docHoaDonXml(xml)
    expect(tong(doc.dongHang!)).toBe(1306250)
  })

  it('phân bổ và kiểm tra chi tiết không báo lệch khi có dòng chiết khấu', () => {
    const chiTiet = {
      tongTien: 7829900, loaiHd: 'ban_hang' as const,
      dongHang: [
        { ten: 'Lẩu cá', thanhTien: 5000000 },
        { ten: 'Bia Hà Nội', thanhTien: 3774100, laRuouBia: true },
        { ten: 'Chiết khấu', thanhTien: 944200, laChietKhau: true },
      ],
    }
    expect(phanBoPhuLuc(chiTiet).tongHoaDon).toBe(7829900)
    expect(kiemTraChiTietHoaDon(chiTiet, 7829900).loi).toBeNull()
  })
})
