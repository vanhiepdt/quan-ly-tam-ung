import type { CotTienHang, DongHang, LoaiHoaDon } from './giao-dien'

function boDau(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function ascii(value: string): string {
  return boDau(value).toLowerCase()
}

function dongChu(chu?: string | readonly string[]): string[] {
  if (!chu) return []
  if (typeof chu === 'string') return chu.split(/\r?\n/).map(d => d.trim()).filter(Boolean)
  return chu.map(d => d.trim()).filter(Boolean)
}

export function doanLoaiTuKyHieu(kyHieuHd?: string): LoaiHoaDon | undefined {
  const c = kyHieuHd?.trim().charAt(0)
  if (c === '1') return 'gtgt'
  if (c === '2') return 'ban_hang'
}

export function doanLoaiTuChu(chu?: string | readonly string[]): LoaiHoaDon | undefined {
  let loai: LoaiHoaDon | undefined
  for (const dong of dongChu(chu)) {
    const a = ascii(dong)
    if (/hoa don gia tri gia tang|\bhoa don gtgt\b/.test(a)) return 'gtgt'
    if (/hoa don ban hang/.test(a) && !loai) loai = 'ban_hang'
  }
  return loai
}

export function doanLoaiHoaDon(nguon: {
  loaiHd?: LoaiHoaDon
  loaiHdPhu?: LoaiHoaDon
  kyHieuHd?: string
  chu?: string | readonly string[]
}): LoaiHoaDon | undefined {
  if (nguon.loaiHd === 'gtgt' || nguon.loaiHd === 'ban_hang') return nguon.loaiHd
  if (nguon.loaiHdPhu === 'gtgt' || nguon.loaiHdPhu === 'ban_hang') return nguon.loaiHdPhu
  return doanLoaiTuChu(nguon.chu) ?? doanLoaiTuKyHieu(nguon.kyHieuHd)
}

export function doanCotTuChu(chu?: string | readonly string[]): CotTienHang | undefined {
  let cot: CotTienHang | undefined
  for (const dong of dongChu(chu)) {
    const a = ascii(dong)
    if (/thanh tien sau thue|thanh tien da co thue|da bao gom thue|gom ca thue/.test(a)) return 'sau_thue'
    if (/thanh tien truoc thue|tien thue gtgt/.test(a)) cot = 'truoc_thue'
  }
  return cot
}

export function doanCotTienHang(nguon: {
  cotTienHang?: CotTienHang
  cotTienHangPhu?: CotTienHang
  dongHang?: readonly DongHang[]
  loaiHd?: LoaiHoaDon
  chu?: string | readonly string[]
}): CotTienHang | undefined {
  if (nguon.cotTienHang === 'truoc_thue' || nguon.cotTienHang === 'sau_thue') return nguon.cotTienHang
  if (nguon.cotTienHangPhu === 'truoc_thue' || nguon.cotTienHangPhu === 'sau_thue') return nguon.cotTienHangPhu
  const tuChu = doanCotTuChu(nguon.chu)
  if (tuChu) return tuChu
  if (nguon.loaiHd !== 'gtgt') return
  const dong = nguon.dongHang ?? []
  if (dong.some(d => d.tienThue !== undefined || d.thueSuat !== undefined)) return 'truoc_thue'
  if (dong.some(d => d.thanhTienSauThue !== undefined)) return 'sau_thue'
}

// Hóa đơn bán hàng: lấy cột Thành tiền. Hóa đơn GTGT: cộng thuế nếu cột chưa gồm thuế.
export function tienDongSauThue(
  d: DongHang,
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
): number {
  if (loaiHd !== 'gtgt') return d.thanhTien
  if (cotTienHang === 'sau_thue') return d.thanhTien
  if (d.thanhTienSauThue !== undefined) return d.thanhTienSauThue
  if (d.tienThue !== undefined) return d.thanhTien + d.tienThue
  if (d.thueSuat !== undefined) return Math.round(d.thanhTien * (1 + d.thueSuat / 100))
  return d.thanhTien
}

export function nhanLoaiHoaDon(loai?: LoaiHoaDon): string | undefined {
  if (loai === 'gtgt') return 'Hóa đơn giá trị gia tăng'
  if (loai === 'ban_hang') return 'Hóa đơn bán hàng'
}

