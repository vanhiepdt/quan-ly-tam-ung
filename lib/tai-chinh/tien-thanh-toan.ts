// Số tiền được hoàn/thanh toán là giá trị nghiệp vụ dùng chung cho nhật ký,
// giấy đề nghị tiếp khách và giấy đề nghị thanh toán. Khi chưa có giá trị ghi
// đè (dữ liệu cũ), máy suy ra từ tổng hóa đơn trừ phần rượu bia.
export type DuLieuTienThanhToan = {
  tongTien: number
  tienRuouBia: number
  tienDuocThanhToan?: number | null
  tienDuocThanhToanGoc?: number | null
  lamTronXuongHangNghin?: boolean
}

function soTienHopLe(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Số tiền phải là số nguyên không âm an toàn.')
  return value
}

export function lamTronXuongHangNghin(value: number): number {
  return Math.floor(soTienHopLe(value) / 1_000) * 1_000
}

export function tienTheoHoaDon({ tongTien, tienRuouBia }: Pick<DuLieuTienThanhToan, 'tongTien' | 'tienRuouBia'>): number {
  return Math.max(0, soTienHopLe(tongTien) - soTienHopLe(tienRuouBia))
}

export function tienNguonThanhToan(data: DuLieuTienThanhToan): number {
  if (data.tienDuocThanhToanGoc != null) return soTienHopLe(data.tienDuocThanhToanGoc)
  return data.tienDuocThanhToan == null
    ? tienTheoHoaDon(data)
    : soTienHopLe(data.tienDuocThanhToan)
}

export function soTienThanhToan(data: DuLieuTienThanhToan): number {
  const tien = tienNguonThanhToan(data)
  return data.lamTronXuongHangNghin ? lamTronXuongHangNghin(tien) : tien
}
