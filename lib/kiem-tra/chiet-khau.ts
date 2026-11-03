import type { CotTienHang, DongHang, LoaiHoaDon } from './giao-dien'
import { tienDongSauThue } from './loai-hoa-don'

function ascii(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
}

// Dòng ghi khoản giảm trừ trên hóa đơn (chiết khấu thương mại, giảm giá), không phải món hàng.
export function laTenChietKhau(ten: string): boolean {
  const a = ascii(ten)
  return /^(\d+[.)]?\s*)?(chiet khau|giam gia|giam tru)\b/.test(a) || /\bchiet khau thuong mai\b/.test(a)
}

// Tiền có dấu của một dòng: dòng chiết khấu là số âm, dòng hàng là số dương.
export function tienDongCoDau(d: DongHang, loaiHd?: LoaiHoaDon, cotTienHang?: CotTienHang): number {
  const tien = tienDongSauThue(d, loaiHd, cotTienHang)
  return d.laChietKhau ? -tien : tien
}

export function tongChietKhau(dongHang: readonly DongHang[], loaiHd?: LoaiHoaDon, cotTienHang?: CotTienHang): number {
  return dongHang.reduce((tong, d) => tong + (d.laChietKhau ? tienDongSauThue(d, loaiHd, cotTienHang) : 0), 0)
}

// Chiết khấu giữ thành một dòng riêng trên bảng kê (số âm), không chia vào từng món.
// Dòng chiết khấu nhận theo cờ hoặc theo tên. Chiết khấu chỉ ghi ở phần tổng hóa đơn
// được thêm thành một dòng "Chiết khấu thương mại" khi tổng các dòng lớn hơn tổng thanh
// toán và phần chênh nằm trong mức chiết khấu khai báo (kể cả thuế); chênh vì lý do
// khác vẫn để bước kiểm tra báo lỗi.
export function truChietKhauHoaDon(
  dongHang: readonly DongHang[],
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
  khaiBao?: number,
  tongThanhToan?: number,
): { dong: DongHang[]; daTru: number } {
  const dong = dongHang.map(d => d.laChietKhau || !laTenChietKhau(d.ten) ? { ...d } : { ...d, laChietKhau: true })
  if (khaiBao && khaiBao > 0 && tongThanhToan !== undefined) {
    const tong = dong.reduce((s, d) => s + tienDongCoDau(d, loaiHd, cotTienHang), 0)
    const lech = tong - tongThanhToan
    if (lech > 0 && lech <= Math.round(khaiBao * 1.12) + 1000) {
      dong.push({ ten: 'Chiết khấu thương mại', thanhTien: lech, thanhTienSauThue: lech, laChietKhau: true, laRuouBia: false })
    }
  }
  return { dong, daTru: tongChietKhau(dong, loaiHd, cotTienHang) }
}
