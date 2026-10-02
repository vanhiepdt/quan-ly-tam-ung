const NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function ngayUtc(ngay: string): Date | null {
  const khop = NGAY_ISO.exec(ngay)
  if (!khop) return null
  const nam = Number(khop[1])
  const thang = Number(khop[2])
  const ngayTrongThang = Number(khop[3])
  const date = new Date(Date.UTC(nam, thang - 1, ngayTrongThang))
  if (date.getUTCFullYear() !== nam || date.getUTCMonth() !== thang - 1 || date.getUTCDate() !== ngayTrongThang) return null
  return date
}

function chuoiNgayUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

// Giấy đề nghị tiếp khách không lập vào cuối tuần. Nếu ngày hóa đơn rơi vào
// thứ bảy hoặc chủ nhật, mặc định lùi về thứ sáu gần nhất.
export function ngayDeNghiMacDinh(ngay: string): string {
  const date = ngayUtc(ngay)
  if (!date) return ngay
  const thu = date.getUTCDay()
  if (thu === 6) date.setUTCDate(date.getUTCDate() - 1)
  else if (thu === 0) date.setUTCDate(date.getUTCDate() - 2)
  return chuoiNgayUtc(date)
}
