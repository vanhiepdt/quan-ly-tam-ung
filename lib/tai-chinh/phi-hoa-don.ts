// Phí hóa đơn nhập được bằng phần trăm tổng tiền hoặc bằng số tiền cụ thể. Chỉ một
// trong hai là nguồn; ô còn lại suy ra từ đây nên hai số không bao giờ lệch nhau.

// Phần trăm giữ hai chữ số thập phân — đủ cho các mức phí thực tế (15%, 12.5%)
// mà không sinh đuôi lẻ do chia số nguyên.
export function phanTramTuTien(soTienPhi: number, tongTien: number): number | null {
  if (!Number.isFinite(soTienPhi) || !Number.isFinite(tongTien) || tongTien <= 0) return null
  return Math.round(soTienPhi / tongTien * 10000) / 100
}

// Tiền phí luôn là số nguyên đồng: hệ thống không lưu số lẻ hơn một đồng.
export function tienTuPhanTram(phanTram: number, tongTien: number): number | null {
  if (!Number.isFinite(phanTram) || !Number.isFinite(tongTien) || phanTram <= 0) return null
  return Math.round(tongTien * phanTram / 100)
}
