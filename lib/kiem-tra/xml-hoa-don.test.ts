import { describe, expect, it } from 'vitest'
import { docHoaDonXml } from './xml-hoa-don'

const xmlGtgt = `<?xml version="1.0" encoding="UTF-8"?>
<HDon xmlns="urn:invoice:test">
  <DLHDon>
    <TTChung>
      <TCHDon>Hóa đơn giá trị gia tăng</TCHDon>
      <KHHDon>1C26TAA</KHHDon>
      <SHDon>0000123</SHDon>
      <NLap>2026-09-28</NLap>
    </TTChung>
    <NDHDon>
      <NBan><Ten>Công ty bán hàng</Ten><MST>0101234567</MST><DChi>Số 1 Hà Nội</DChi></NBan>
      <NMua><Ten>Đơn vị mua hàng</Ten><MST>0401234567</MST><DChi>Số 2 Đà Nẵng</DChi></NMua>
      <DSHHDVu>
        <HHDVu><THHDVu>Bia Tiger</THHDVu><SLuong>1</SLuong><DGia>280000</DGia><ThTien>280000</ThTien><TSuat>10%</TSuat><TThue>28000</TThue></HHDVu>
        <HHDVu><THHDVu>Cơm rang</THHDVu><SLuong>1</SLuong><DGia>120000</DGia><ThTien>120000</ThTien><TSuat>8%</TSuat><TThue>9600</TThue></HHDVu>
      </DSHHDVu>
    </NDHDon>
    <TToan><TgTThue>37600</TgTThue><TgTTTBSo>439600</TgTTTBSo></TToan>
  </DLHDon>
</HDon>`

describe('đọc XML hóa đơn', () => {
  it('đọc được namespace, người mua, tổng tiền và dòng bia trước thuế', () => {
    const doc = docHoaDonXml(xmlGtgt)

    expect(doc).toMatchObject({
      kyHieuHd: '1C26TAA', soHd: '0000123', ngay: '2026-09-28',
      mstBanHang: '0101234567', mstMuaHang: '0401234567',
      tenMuaHang: 'Đơn vị mua hàng', diaChiMuaHang: 'Số 2 Đà Nẵng',
      tongTien: 439600, tienThue: 37600, loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
      tienRuouBia: 308000,
    })
    expect(doc.dongHang).toHaveLength(2)
    expect(doc.dongHang?.[0]).toMatchObject({ ten: 'Bia Tiger', thanhTien: 280000, tienThue: 28000, laRuouBia: true })
  })

  it('trả về 0 khi có dòng hàng nhưng không có bia/rượu', () => {
    const doc = docHoaDonXml(xmlGtgt.replace('Bia Tiger', 'Nước suối'))
    expect(doc.dongHang).toHaveLength(2)
    expect(doc.tienRuouBia).toBe(0)
    expect(doc.dongHang?.every(d => d.laRuouBia === false)).toBe(true)
  })

  it('từ chối DOCTYPE và ENTITY để không mở XML bên ngoài', () => {
    expect(() => docHoaDonXml('<!DOCTYPE HDon [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><HDon>&xxe;</HDon>'))
      .toThrow('không được chứa khai báo ngoài')
  })
})
