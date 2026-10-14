import type { ChiTietHoaDon } from '@/lib/kiem-tra/giao-dien'
import { phanBoPhuLuc } from '@/lib/kiem-tra/phan-bo-phu-luc'

// Bản xem trước và lúc lưu phải cùng một kết quả: không âm thầm thay khoản bị
// loại sau khi đã dựng giấy, vì như vậy giấy/số tiền làm tròn sẽ lệch nhau.
export function kiemTraChiTietHoaDon(
  chiTiet: ChiTietHoaDon | null,
  tongTien: number,
): { loi: string | null; tienKhongThanhToan: number | null } {
  if (!chiTiet) return { loi: null, tienKhongThanhToan: null } // giao dịch cũ hoặc hóa đơn không trích được dòng hàng
  const phanBo = phanBoPhuLuc(chiTiet)
  if (phanBo.loi) return { loi: phanBo.loi, tienKhongThanhToan: null }
  if (phanBo.tongKhongDeNghi > 0 && phanBo.tongHoaDon !== tongTien) {
    return { loi: `Tổng các dòng hóa đơn (${phanBo.tongHoaDon.toLocaleString('vi-VN')}đ) không khớp tổng giao dịch (${tongTien.toLocaleString('vi-VN')}đ). Hãy đọc lại hoặc kiểm tra hóa đơn trước khi lưu.`, tienKhongThanhToan: null }
  }
  return { loi: null, tienKhongThanhToan: phanBo.tongKhongDeNghi }
}
