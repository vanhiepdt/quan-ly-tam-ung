'use server'

import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { db } from '@/lib/db/pool'
import { schemaGiaoDich } from '@/lib/validation/giao-dich'
import { canDonVi, hinhThucThanhToanMacDinh } from '@/lib/tai-chinh/hinh-thuc'
import { dungGiay, giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { MAU_WORD } from '@/lib/tai-chinh/in-giay'
import { docMau } from '@/lib/onlyoffice/tai-lieu'
import { dienMauDocx } from '@/lib/van-ban/docx'
import { taoBanXem } from '@/lib/onlyoffice/xem-truoc'

import { apDungNguoiKy, luaChonNguoiKy } from '@/lib/tai-chinh/chon-nguoi-ky'

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
  const d = parsed.data
  const giayLoai = giayChoHinhThuc(d.hinh_thuc).find(g => g === loai)
  if (!giayLoai) return { loi: 'Loại giấy không phù hợp với giao dịch.' }
  try {
    let donViTen: string | null = null
    if (canDonVi(d.hinh_thuc)) {
      const { rows } = await db.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [d.don_vi_id])
      if (!rows.length) return { loi: 'Đơn vị tiếp khách không tồn tại hoặc đã bị vô hiệu hóa.' }
      donViTen = rows[0].ten
    }
    const giay = dungGiay(giayLoai, {
      ngay: d.ngay, hinhThuc: d.hinh_thuc,
      hinhThucThanhToan: d.hinh_thuc_thanh_toan ?? hinhThucThanhToanMacDinh(d.hinh_thuc),
      tamUngTuCq: d.tam_ung_tu_cq, tongTien: d.tong_tien, tienRuouBia: d.tien_ruou_bia,
      donViTen, nguoiLayHdId: d.nguoi_lay_hd_id, kyHieuHd: d.ky_hieu_hd, soHd: d.so_hd,
    }, apDungNguoiKy(await boiCanhGiay(phien), form))
    const docx = dienMauDocx(await docMau(MAU_WORD[giayLoai]), giay.thayThe, giay.thayCoDinh).duLieu
    return { viewer: await taoBanXem(docx, `${giay.tieuDe}.docx`) }
  } catch {
    return { loi: 'Không mở được bản Word. Kiểm tra kết nối OnlyOffice rồi bấm Xem để thử lại. Giao dịch chưa được lưu.' }
  }
}
