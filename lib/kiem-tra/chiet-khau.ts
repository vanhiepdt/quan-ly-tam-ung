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

export function tongChietKhau(dongHang: readonly DongHang[]): number {
  return dongHang.reduce((tong, d) => tong + (d.chietKhau ?? 0), 0)
}

// Bỏ các dòng chiết khấu và chia tổng chiết khấu (sau thuế, cộng thêm chiết khấu ghi
// ở phần tổng nếu có) vào các dòng hàng theo tỷ lệ thành tiền sau thuế. Phần lẻ chia
// theo phần dư lớn nhất nên tổng các dòng khớp đúng từng đồng với tổng thanh toán.
// Không có chiết khấu thì trả nguyên dòng, gọi lại nhiều lần không trừ hai lần.
export function apDungChietKhau(
  dongHang: readonly DongHang[],
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
  chietKhauThem = 0,
): DongHang[] {
  const dongCk = dongHang.filter(d => d.laChietKhau)
  const tongCk = dongCk.reduce((tong, d) => tong + tienDongSauThue(d, loaiHd, cotTienHang), 0) + Math.max(0, chietKhauThem)
  const hang = dongHang.filter(d => !d.laChietKhau)
  if (tongCk <= 0 || !hang.length) return hang.map(d => ({ ...d }))

  const goc = hang.map(d => tienDongSauThue(d, loaiHd, cotTienHang))
  const tongGoc = goc.reduce((a, b) => a + b, 0)
  if (tongGoc <= 0) return hang.map(d => ({ ...d }))
  const ck = BigInt(Math.min(tongCk, tongGoc))
  const tong = BigInt(tongGoc)
  const phan = goc.map(g => (ck * BigInt(g)) / tong)
  let du = ck - phan.reduce((a, b) => a + b, BigInt(0))
  const thuTu = goc.map((g, i) => ({ i, du: (ck * BigInt(g)) % tong })).sort((a, b) => (a.du === b.du ? a.i - b.i : a.du > b.du ? -1 : 1))
  for (const { i } of thuTu) {
    if (du <= BigInt(0)) break
    if (BigInt(goc[i]) > phan[i]) { phan[i] += BigInt(1); du -= BigInt(1) }
  }

  return hang.map((d, i) => {
    const giam = Number(phan[i])
    if (giam <= 0) return { ...d }
    // Giữ tiền thuế gốc của dòng để phụ lục cũ không suy thuế từ số đã trừ chiết khấu.
    const coThueRieng = d.tienThue === undefined && d.thanhTienSauThue === undefined && goc[i] > d.thanhTien
    return {
      ...d,
      ...(coThueRieng ? { tienThue: goc[i] - d.thanhTien } : {}),
      thanhTienSauThue: goc[i] - giam,
      chietKhau: (d.chietKhau ?? 0) + giam,
    }
  })
}

// Trừ chiết khấu cho bảng dòng hàng đã chọn: dòng chiết khấu (đánh dấu hoặc nhận theo tên)
// trước, sau đó chiết khấu ghi ở phần tổng hóa đơn. Phần tổng chỉ áp dụng khi hóa đơn có
// khai chiết khấu và phần chênh giữa tổng các dòng với tổng thanh toán nằm trong mức
// chiết khấu đó (kể cả thuế); chênh vì lý do khác vẫn để bước kiểm tra báo lỗi.
export function truChietKhauHoaDon(
  dongHang: readonly DongHang[],
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
  khaiBao?: number,
  tongThanhToan?: number,
): { dong: DongHang[]; daTru: number } {
  const danhDau = dongHang.map(d => d.laChietKhau || !laTenChietKhau(d.ten) ? d : { ...d, laChietKhau: true })
  let dong = apDungChietKhau(danhDau, loaiHd, cotTienHang)
  if (khaiBao && khaiBao > 0 && tongThanhToan !== undefined) {
    const tong = dong.reduce((s, d) => s + tienDongSauThue(d, loaiHd, cotTienHang), 0)
    const lech = tong - tongThanhToan
    if (lech > 0 && lech <= Math.round(khaiBao * 1.12) + 1000) dong = apDungChietKhau(dong, loaiHd, cotTienHang, lech)
  }
  return { dong, daTru: tongChietKhau(dong) }
}
