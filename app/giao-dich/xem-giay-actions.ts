'use server'

import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { db } from '@/lib/db/pool'
import { schemaGiaoDich } from '@/lib/validation/giao-dich'
import { canDonVi, HINH_THUC_THANH_TOAN, hinhThucThanhToanMacDinh, lamTronXuongHangNghinMacDinh } from '@/lib/tai-chinh/hinh-thuc'
import { dungGiay, giayChinhChoHinhThuc } from '@/lib/tai-chinh/giay'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { LoiMauPhuLuc } from '@/lib/tai-chinh/phu-luc'
import { taoGiayDocx } from '@/lib/tai-chinh/giay-docx'
import { kiemTraChiTietHoaDon } from '@/lib/tai-chinh/kiem-tra-chi-tiet-hoa-don'
import { MAU_WORD } from '@/lib/tai-chinh/in-giay'
import { docMau } from '@/lib/onlyoffice/tai-lieu'
import { taoBanXem } from '@/lib/onlyoffice/xem-truoc'

import { apDungNguoiKy, luaChonNguoiKy } from '@/lib/tai-chinh/chon-nguoi-ky'
import { taiKhoanTuNhap } from '@/lib/tai-chinh/tai-khoan'
import { ngayHienTaiBangkok } from '@/lib/tai-chinh/ngay'

export async function taiNguoiKyGiay() {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  if (phien.doi_mat_khau) throw new Error('Vui lòng đổi mật khẩu trước khi lập giấy.')
  return luaChonNguoiKy(await boiCanhGiay(phien))
}

export async function xemGiayNhap(form: FormData, loai: string) {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  if (phien.doi_mat_khau) return { loi: 'Vui lòng đổi mật khẩu trước khi xem giấy.' }
  const raw = Object.fromEntries([...form.entries()].map(([key, value]) => [key, value === '' ? null : value]))
  raw.noi_dung ??= ''
  const parsed = schemaGiaoDich.safeParse(raw)
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' }
  let d = parsed.data
  const giayLoai = giayChinhChoHinhThuc(d.hinh_thuc)
  if (!giayLoai || loai !== giayLoai) return { loi: 'Loại giấy không phù hợp với giao dịch.' }
  const ketQuaChiTiet = kiemTraChiTietHoaDon(d.chi_tiet_hoa_don, d.tong_tien)
  if (ketQuaChiTiet.loi) return { loi: `${ketQuaChiTiet.loi} Giao dịch chưa được lưu.` }
  if (ketQuaChiTiet.tienKhongThanhToan !== null) {
    d = { ...d, tien_ruou_bia: ketQuaChiTiet.tienKhongThanhToan }
  }
  try {
    let donViTen: string | null = null
    if (canDonVi(d.hinh_thuc)) {
      const { rows } = await db.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [d.don_vi_id])
      if (!rows.length) return { loi: 'Đơn vị tiếp khách không tồn tại hoặc đã bị vô hiệu hóa.' }
      donViTen = rows[0].ten
    }
    const hinhThucThanhToan = d.hinh_thuc_thanh_toan ?? hinhThucThanhToanMacDinh(d.hinh_thuc)
    const lamTronXuongHangNghin = d.lam_tron_xuong_hang_nghin
      ?? lamTronXuongHangNghinMacDinh(d.hinh_thuc, hinhThucThanhToan)
    const giay = dungGiay(giayLoai, {
      ngay: d.ngay, ngayDeNghi: canDonVi(d.hinh_thuc) ? ngayHienTaiBangkok() : d.ngay_de_nghi, hinhThuc: d.hinh_thuc,
      hinhThucThanhToan,
      tamUngTuCq: d.tam_ung_tu_cq, tongTien: d.tong_tien, tienRuouBia: d.tien_ruou_bia,
      chiTietHoaDon: d.chi_tiet_hoa_don,
      tienDuocThanhToan: d.tien_duoc_thanh_toan, lamTronXuongHangNghin,
      donViTen, nguoiLayHdId: d.nguoi_lay_hd_id, kyHieuHd: d.ky_hieu_hd, soHd: d.so_hd,
      taiKhoanNhanGhiDe: d.hinh_thuc_thanh_toan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN && d.dung_tai_khoan_mac_dinh === false
        ? taiKhoanTuNhap({
            soTaiKhoan: d.tai_khoan_nhan_so,
            nganHang: d.tai_khoan_nhan_ngan_hang,
            chiNhanh: d.tai_khoan_nhan_chi_nhanh,
            tenChuTk: d.tai_khoan_nhan_ten_chu_tk,
          })
        : null,
    }, apDungNguoiKy(await boiCanhGiay(phien), form))
    const docx = taoGiayDocx(await docMau(MAU_WORD[giayLoai]), giay, { chiTietHoaDon: d.chi_tiet_hoa_don, tienRuouBia: d.tien_ruou_bia })
    return { viewer: await taoBanXem(docx, `${giay.tieuDe}.docx`) }
  } catch (error) {
    if (error instanceof LoiMauPhuLuc) return { loi: `${error.message} Bản xem trước chưa được tạo; giao dịch chưa được lưu.` }
    console.error('Không tạo được bản xem trước Word.')
    return { loi: 'Không tạo được bản xem trước Word. Kiểm tra mẫu và kết nối OnlyOffice, rồi bấm Xem lại. Giao dịch chưa được lưu.' }
  }
}
