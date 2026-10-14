import { phanBoPhuLuc } from '@/lib/kiem-tra/phan-bo-phu-luc'
import type { GiaoDichTinh } from './kieu'

export function coPhuLucThanhToan(
  giaoDich: Pick<GiaoDichTinh, 'chiTietHoaDon' | 'tienRuouBia'>,
): boolean {
  if (!giaoDich.chiTietHoaDon || giaoDich.tienRuouBia <= 0) return false
  const phanBo = phanBoPhuLuc(giaoDich.chiTietHoaDon)
  return !phanBo.loi && phanBo.tongKhongDeNghi > 0 && phanBo.tongKhongDeNghi === giaoDich.tienRuouBia
}
