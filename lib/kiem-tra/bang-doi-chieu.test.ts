import { describe, expect, it } from 'vitest'
import { bangDoiChieuNguoiMua, catDiaChi, nhanRuouBia } from './bang-doi-chieu'
import type { KetQuaDocHoaDon } from './giao-dien'

const don = {
  mstMuaHang: '0100695387066',
  tenMuaHang: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội',
  diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
}

function kq(phan: Partial<KetQuaDocHoaDon> = {}): KetQuaDocHoaDon {
  return {
    trangThai: 'hop_le',
    deXuat: {
      ...don,
      kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12',
      tongTien: 1_000_000, tienRuouBia: 110_000, loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
    },
    qr: { kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
    ocr: {
      ...don,
      kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12',
      tongTien: 1_000_000, tienRuouBia: 110_000,
    },
    ai: {
      ...don,
      kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12',
      tongTien: 1_000_000, tienRuouBia: 110_000,
    },
    phatHien: [],
    ...phan,
  }
}

describe('bảng đối chiếu người mua', () => {
  it('cắt địa chỉ bằng ba chấm', () => {
    expect(catDiaChi(don.diaChiMuaHang)).toBe('Tầng 2, Khu nhà 3 tầng...')
    expect(catDiaChi('Ngắn')).toBe('Ngắn')
  })

  it('OCR và AI khớp người mua, QR không có thì X và ghi rõ', () => {
    const hang = bangDoiChieuNguoiMua(kq())
    expect(hang.map(h => h.nhan)).toEqual([
      'MST người mua', 'Tên đơn vị mua', 'Địa chỉ đơn vị mua',
      'Ký hiệu / số', 'Ngày', 'Tổng tiền', 'Rượu bia (đã cộng thuế GTGT)',
    ])
    expect(hang[0].hienThi).toBe('0100695387-066')
    expect(hang[2].hienThi).toMatch(/\.\.\.$/)
    expect(hang[2].dayDu).toBe(don.diaChiMuaHang)
    for (const h of hang.slice(0, 3)) {
      expect(h.cot.find(c => c.nguon === 'ocr')?.khop).toBe(true)
      expect(h.cot.find(c => c.nguon === 'ai')?.khop).toBe(true)
      const qr = h.cot.find(c => c.nguon === 'qr')
      expect(qr?.khop).toBe(false)
      expect(qr?.goiY).toMatch(/QR không có/)
    }
  })

  it('thêm ký hiệu/số, ngày, tổng tiền, rượu bia vào cùng bảng OCR QR AI', () => {
    const hang = bangDoiChieuNguoiMua(kq())
    const ky = hang.find(h => h.khoa === 'kyHieuSo')
    const ngay = hang.find(h => h.khoa === 'ngay')
    const tien = hang.find(h => h.khoa === 'tongTien')
    const ruou = hang.find(h => h.khoa === 'tienRuouBia')
    expect(ky?.hienThi).toBe('1C26MLD · 00001656')
    expect(ngay?.hienThi).toBe('2026-03-12')
    expect(tien?.hienThi).toBe('1.000.000đ')
    expect(ruou?.hienThi).toBe('110.000đ')
    for (const h of [ky, ngay, tien]) {
      expect(h?.cot.find(c => c.nguon === 'ocr')?.khop).toBe(true)
      expect(h?.cot.find(c => c.nguon === 'qr')?.khop).toBe(true)
      expect(h?.cot.find(c => c.nguon === 'ai')?.khop).toBe(true)
    }
    expect(ruou?.cot.find(c => c.nguon === 'ocr')?.khop).toBe(true)
    expect(ruou?.cot.find(c => c.nguon === 'ai')?.khop).toBe(true)
    expect(ruou?.cot.find(c => c.nguon === 'qr')?.khop).toBe(false)
    expect(ruou?.cot.find(c => c.nguon === 'qr')?.goiY).toMatch(/QR không có/)
  })

  it('không bịa số rượu bia khi cả ba lớp đều trống', () => {
    const hang = bangDoiChieuNguoiMua(kq({
      deXuat: { ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
      qr: { kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
      ocr: { ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
      ai: { ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
    }))
    const ruou = hang.find(h => h.khoa === 'tienRuouBia')
    expect(ruou?.hienThi).toBe('không đọc được')
    expect(ruou?.cot.every(c => !c.khop && !c.giaTri)).toBe(true)
  })

  it('AI không ghi tienRuouBia thì cột AI lấy tổng dòng rượu bia AI đã gắn', () => {
    const hang = bangDoiChieuNguoiMua(kq({
      deXuat: {
        ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12',
        tongTien: 1_000_000, tienRuouBia: 622_600, loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
      },
      qr: { kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000 },
      ocr: {
        ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000,
        loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
        dongHang: [
          { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, laRuouBia: true },
          { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, laRuouBia: true },
        ],
      },
      ai: {
        ...don, kyHieuHd: '1C26MLD', soHd: '00001656', ngay: '2026-03-12', tongTien: 1_000_000,
        dongHang: [
          { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, laRuouBia: true },
          { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, laRuouBia: true },
        ],
      },
    }))
    const ruou = hang.find(h => h.khoa === 'tienRuouBia')
    expect(ruou?.hienThi).toBe('622.600đ')
    expect(ruou?.cot.find(c => c.nguon === 'ai')?.khop).toBe(true)
    expect(ruou?.cot.find(c => c.nguon === 'ai')?.giaTri).toBe('622.600đ')
    expect(ruou?.cot.find(c => c.nguon === 'ocr')?.khop).toBe(true)
    expect(ruou?.cot.find(c => c.nguon === 'qr')?.khop).toBe(false)
  })

  it('nhãn rượu bia đổi theo loại hóa đơn', () => {
    expect(nhanRuouBia({ loaiHd: 'gtgt', cotTienHang: 'truoc_thue' })).toBe('Rượu bia (đã cộng thuế GTGT)')
    expect(nhanRuouBia({ loaiHd: 'gtgt', cotTienHang: 'sau_thue' })).toBe('Rượu bia (đã gồm thuế GTGT)')
    expect(nhanRuouBia({ loaiHd: 'ban_hang' })).toBe('Rượu bia')
  })

  it('ô không khớp hiện đúng giá trị lớp đó khi rê chuột', () => {
    const hang = bangDoiChieuNguoiMua(kq({
      ai: { ...don, mstMuaHang: '1111111111', tenMuaHang: 'Công ty khác', diaChiMuaHang: '1 Đống Đa' },
    }))
    const mstAi = hang[0].cot.find(c => c.nguon === 'ai')
    expect(mstAi?.khop).toBe(false)
    expect(mstAi?.goiY).toBe('AI đọc: 1111111111')
    expect(hang[1].cot.find(c => c.nguon === 'ai')?.goiY).toBe('AI đọc: Công ty khác')
    expect(hang[2].cot.find(c => c.nguon === 'ai')?.goiY).toBe('AI đọc: 1 Đống Đa')
    expect(hang[0].cot.find(c => c.nguon === 'ocr')?.khop).toBe(true)
  })
})
