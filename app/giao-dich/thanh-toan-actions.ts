'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db, trongTransaction } from '@/lib/db/pool'
import { batBuocVaiTro, LoiKhongDuQuyen } from '@/lib/xac-thuc/bao-ve'
import { chuyenDongGiaoDich } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { TRANG_THAI } from '@/lib/tai-chinh/kieu'
import { khoaSoTaiChinh } from '@/lib/tai-chinh/xac-nhan-hoan-ung'
import { taoNoiDungThanhToan, taoPayloadVietQR } from '@/lib/qr/vietqr'

export type ThongTinThanhToan = {
  tenChuTk: string; bin: string; soTaiKhoan: string; soTien: number
  soHd: string; ngay: string; noiDung: string; payload: string
}
export type KetQuaThanhToan = { duLieu?: ThongTinThanhToan; loi?: string }

// Read-only: generating a QR is never evidence of a bank transfer.
export async function layQrThanhToan(id: unknown): Promise<KetQuaThanhToan> {
  try {
    await batBuocVaiTro('admin', 'nhap_lieu')
  } catch (error) {
    return { loi: error instanceof LoiKhongDuQuyen ? 'Bạn không có quyền thanh toán.' : 'Không thể xác thực phiên. Vui lòng thử lại.' }
  }
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { loi: 'Mã giao dịch không hợp lệ.' }
  let g: Record<string, unknown> | undefined
  try {
    // One statement gives the transaction, rate and payee a consistent DB snapshot.
    const { rows } = await db.query<Record<string, unknown>>(`select g.*, n.ten as nguoi_lay_hd_ten,
      n.ngan_hang_bin, n.so_tai_khoan, n.ten_chu_tk, n.dang_hoat_dong as nguoi_hoat_dong,
      n.ty_le_phi, (select gia_tri from cau_hinh where khoa='ty_le_phi_chung') as ty_le_chung
      from giao_dich g left join nguoi_lay_hd n on n.id=g.nguoi_lay_hd_id
      where g.id=$1 and not g.da_xoa`, [parsed.data])
    g = rows[0]
  } catch {
    return { loi: 'Không thể đọc thông tin thanh toán. Vui lòng thử lại.' }
  }
  if (!g || g.da_xoa) return { loi: 'Giao dịch không tồn tại hoặc đã bị xóa. Vui lòng tải lại bảng.' }
  if (g.trang_thai_tt_phi !== 'Chưa thanh toán') return { loi: 'Phí không còn ở trạng thái Chưa thanh toán. Vui lòng tải lại bảng.' }
  if (!g.nguoi_hoat_dong || typeof g.ten_chu_tk !== 'string' || !g.ten_chu_tk.trim() || typeof g.ngan_hang_bin !== 'string' || typeof g.so_tai_khoan !== 'string') return { loi: 'Người lấy hóa đơn chưa có đầy đủ tài khoản ngân hàng đang hoạt động.' }
  try {
    const gd = chuyenDongGiaoDich(g)
    const tyLePhiChung = Number(g.ty_le_chung ?? 0.15)
    const tyLeNguoi = g.ty_le_phi == null ? tyLePhiChung : Number(g.ty_le_phi)
    if (![tyLePhiChung, tyLeNguoi].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return { loi: 'Tỷ lệ phí không hợp lệ. Vui lòng kiểm tra cấu hình.' }
    const soTien = tinhToan([gd], { tyLePhiChung, tyLeTheoNguoi: gd.nguoiLayHdId ? { [gd.nguoiLayHdId]: tyLeNguoi } : {} })[0].phiLayHd
    if (!Number.isSafeInteger(soTien) || soTien <= 0) return { loi: 'Phí lấy hóa đơn phải là số nguyên dương trong giới hạn an toàn.' }
    const noiDung = taoNoiDungThanhToan(gd.soHd ?? '', gd.ngay)
    const bin = g.ngan_hang_bin.trim(), soTaiKhoan = g.so_tai_khoan.trim()
    const payload = taoPayloadVietQR({ bin, soTaiKhoan, soTien, noiDung })
    return { duLieu: { tenChuTk: g.ten_chu_tk.trim(), bin, soTaiKhoan, soTien, soHd: gd.soHd!, ngay: gd.ngay, noiDung, payload } }
  } catch {
    return { loi: 'Không thể tạo VietQR. Cần số HĐ tối đa 10 ký tự ASCII (sau bỏ dấu), ngày hợp lệ, BIN 6 số, tài khoản 1–19 số và số tiền tối đa 13 chữ số. Nội dung TT HD {số HĐ} {YYYYMMDD} tối đa 25 ký tự; không tự cắt dữ liệu.' }
  }
}

export type KetQuaXacNhanPhi = { thanhCong?: string; loi?: string }

// Chỉ quản trị viên được đổi Trạng thái thanh toán phí, giống trường sửa tương ứng.
// Người dùng bấm sau khi đã đối chiếu giao dịch ngân hàng; máy không tự suy ra từ QR.
export async function xacNhanDaThanhToanPhi(id: unknown): Promise<KetQuaXacNhanPhi> {
  let phien: Awaited<ReturnType<typeof batBuocVaiTro>>
  try {
    phien = await batBuocVaiTro('admin')
  } catch (error) {
    return { loi: error instanceof LoiKhongDuQuyen ? 'Chỉ quản trị viên được xác nhận đã thanh toán phí.' : 'Không thể xác thực phiên. Vui lòng thử lại.' }
  }
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { loi: 'Mã giao dịch không hợp lệ.' }
  let ketQua: KetQuaXacNhanPhi
  try {
    ketQua = await trongTransaction(phien.id, async client => {
      await khoaSoTaiChinh(client)
      const { rows } = await client.query<{ trang_thai_tt_phi: string; co_tinh_phi_lay_hd: boolean | null }>(
        'select trang_thai_tt_phi, co_tinh_phi_lay_hd from giao_dich where id=$1 and not da_xoa for update', [parsed.data])
      if (!rows.length) return { loi: 'Giao dịch không tồn tại hoặc đã bị xóa. Vui lòng tải lại bảng.' }
      if (rows[0].co_tinh_phi_lay_hd === false) return { loi: 'Giao dịch đang chọn Không tính phí hóa đơn.' }
      if (rows[0].trang_thai_tt_phi !== 'Chưa thanh toán') return { loi: 'Phí không còn ở trạng thái Chưa thanh toán. Vui lòng tải lại bảng.' }
      await client.query(`update giao_dich set trang_thai_tt_phi=$1, sua_luc=now(), nguoi_sua=$2 where id=$3`,
        [TRANG_THAI.PHI_DA_TRA, phien.id, parsed.data])
      return { thanhCong: 'Đã chuyển Thanh toán phí sang Đã thanh toán.' }
    })
  } catch {
    return { loi: 'Không thể cập nhật trạng thái phí. Vui lòng thử lại.' }
  }
  if (ketQua.thanhCong) {
    revalidatePath('/giao-dich')
    revalidatePath('/dashboard')
  }
  return ketQua
}
