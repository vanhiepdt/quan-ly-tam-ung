import type { CotTienHang, DongHang, LoaiHoaDon } from './giao-dien'
import { tienDongSauThue } from './loai-hoa-don'
import { laSoTienHopLe } from './tien'

// Từ điển đồ uống có cồn trên hóa đơn nhà hàng. Không gồm nước ngọt, nước suối, bia không cồn.
const TU_DAI = [
  'heineken', 'tiger', 'carlsberg', 'budweiser', 'corona', 'asahi', 'sapporo',
  'saigon special', 'sài gòn special', 'larue', 'huda', 'halida', 'strongbow',
  'hennessy', 'johnnie walker', 'chivas', 'jack daniel', 'jameson', 'martell',
  'moet', 'moët', 'veuve', 'smirnoff', 'absolut', 'grey goose', 'bacardi',
  'ruou vang', 'rượu vang', 'ruou manh', 'rượu mạnh',
  'whisky', 'whiskey', 'cognac', 'brandy', 'tequila', 'champagne', 'cocktail',
  'liquor', 'liqueur', 'absinthe', 'lager', 'stout',
]
const TU_NGAN = ['bia', 'beer', 'rượu', 'ruou', 'wine', 'vodka', 'rum', 'gin', 'soju', 'sake', 'cồn', '333']
const LOAI_TRU = ['không cồn', 'khong con', 'non-alcoholic', '0%']

function boDau(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function chuaTu(haystack: string, needle: string): boolean {
  const mau = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${mau}(?:$|[^a-z0-9])`).test(haystack)
}

export function laDongRuouBia(ten: string): boolean {
  const goc = ten.trim().toLowerCase()
  if (!goc) return false
  if (LOAI_TRU.some(k => goc.includes(k))) return false
  const ascii = boDau(goc)
  if (TU_DAI.some(k => goc.includes(k) || ascii.includes(boDau(k.toLowerCase())))) return true
  return TU_NGAN.some(k => chuaTu(goc, k) || chuaTu(ascii, boDau(k.toLowerCase())))
}

export function congTienRuouBia(
  dongHang: readonly DongHang[],
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
): { tien: number; dong: DongHang[] } {
  const dong = dongHang.map(d => ({ ...d, laRuouBia: d.laRuouBia ?? laDongRuouBia(d.ten) }))
  const tien = dong.reduce((tong, d) => tong + (d.laRuouBia ? tienDongSauThue(d, loaiHd, cotTienHang) : 0), 0)
  return { tien, dong }
}

function chuanTen(ten: string): string {
  return boDau(ten).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// AI có thể gắn cờ rượu bia cho từng dòng; dòng không cờ vẫn được đối chiếu với từ điển.
export function ganCoRuouBiaTuAi(dong: readonly DongHang[], aiDong: readonly DongHang[]): DongHang[] {
  return dong.map(d => {
    const ten = chuanTen(d.ten)
    if (!ten) return { ...d }
    const khop = aiDong.find(a => {
      const t = chuanTen(a.ten)
      return Boolean(t) && (t === ten || t.includes(ten) || ten.includes(t))
    })
    if (khop?.laRuouBia === undefined) return { ...d }
    return { ...d, laRuouBia: khop.laRuouBia }
  })
}

// Khi đã có bảng dòng hàng, tổng bia/rượu luôn được tính lại từ từng dòng sau thuế.
// Tổng riêng do nguồn đọc trả về chỉ dùng khi nguồn không có dòng hàng.
export function tienRuouBiaCuaLop(
  doc: { tienRuouBia?: number; dongHang?: readonly DongHang[] } | null | undefined,
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
): number | undefined {
  if (!doc) return
  if (doc.dongHang?.length) {
    const { tien } = congTienRuouBia(doc.dongHang, loaiHd, cotTienHang)
    return laSoTienHopLe(tien) ? tien : undefined
  }
  return doc.tienRuouBia !== undefined && laSoTienHopLe(doc.tienRuouBia) ? doc.tienRuouBia : undefined
}
