import type { TaiKhoanNhan } from './kieu'

// Tài khoản nhận tiền in trên giấy khi thanh toán bằng chuyển khoản. Tài khoản này là
// của người lấy hóa đơn: cùng một tài khoản vừa nhận tiền thanh toán, vừa dùng để trả
// phí lấy hóa đơn, nên chỉ có một nguồn dữ liệu duy nhất là bảng nguoi_lay_hd.

export type DongTaiKhoan = {
  so_tai_khoan?: string | null
  ngan_hang_bin?: string | null
  ten_ngan_hang?: string | null
  ten_chu_tk?: string | null
}

// Người lấy hóa đơn khi đưa vào ô chọn của form: kèm sẵn tài khoản nhận tiền để màn
// hình hiện trước số tài khoản sẽ in ra giấy, đúng bằng thứ máy chủ dùng khi in.
export type NguoiLayHdChon = {
  id: string
  ten: string
  taiKhoan: TaiKhoanNhan | null
}

// Chưa có số tài khoản thì coi như chưa cấu hình, dù các ô còn lại có dữ liệu: số tài
// khoản là phần bắt buộc để chuyển được tiền.
export function taiKhoanTu(dong: DongTaiKhoan | null | undefined): TaiKhoanNhan | null {
  const soTaiKhoan = dong?.so_tai_khoan?.trim()
  if (!dong || !soTaiKhoan) return null
  const nganHang = dong.ten_ngan_hang?.trim() || dong.ngan_hang_bin?.trim() || null
  return {
    soTaiKhoan,
    nganHang: nganHang ? nganHang : null,
    tenChuTk: dong.ten_chu_tk?.trim() || null,
  }
}

// "Số tài khoản: 123 – Ngân hàng: BIDV – Chủ tài khoản: Nguyễn Văn A". Phần nào chưa
// cấu hình thì bỏ đi thay vì in ra một khoảng trống trên giấy.
export function dongTaiKhoan(tk: TaiKhoanNhan): string {
  return [
    `Số tài khoản: ${tk.soTaiKhoan}`,
    tk.nganHang ? `Ngân hàng: ${tk.nganHang}` : null,
    tk.tenChuTk ? `Chủ tài khoản: ${tk.tenChuTk}` : null,
  ].filter(Boolean).join(' – ')
}
