export type GiaoDichTrungKyHieu = {
  ngay: string
  soHd: string | null
}

// Cảnh báo khi ký hiệu hóa đơn đã có trên giao dịch chưa xóa. Không chặn lưu.
export function thongBaoTrungKyHieu(kyHieu: string, ds: readonly GiaoDichTrungKyHieu[]): string | undefined {
  const ky = kyHieu.trim()
  if (!ky || ds.length === 0) return
  const mau = ds[0]
  const so = mau.soHd ? `, số ${mau.soHd}` : ''
  if (ds.length === 1) {
    return `Ký hiệu HĐ ${ky} đã có trên giao dịch ngày ${mau.ngay}${so}.`
  }
  return `Ký hiệu HĐ ${ky} đã có trên ${ds.length} giao dịch, gần nhất ngày ${mau.ngay}${so}.`
}
