'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { docCauHinhGiay, KHOA_CAU_HINH_GIAY, VAI_TRO_KY, type VaiTroKyId } from '@/lib/tai-chinh/cau-hinh-giay'

export type KetQuaGiay = { loi?: string; thanhCong?: string }

export type DuLieuCauHinhGiay = {
  tenDonVi: string
  diaDanh: string
  lyDoTamUng: string
  thoiHanThanhToan: string
  nguoiKy: Record<VaiTroKyId, string | null>
  nguoiLayHdMacDinhId: string | null
}

const maUuidHoacRong = z.string().uuid('Người được chọn không hợp lệ.').nullable()

const schema = z.object({
  tenDonVi: z.string().trim().min(1, 'Tên đơn vị không được để trống').max(200),
  diaDanh: z.string().trim().min(1, 'Địa danh không được để trống').max(100),
  lyDoTamUng: z.string().trim().min(1, 'Lý do tạm ứng không được để trống').max(500),
  thoiHanThanhToan: z.string().trim().min(1, 'Thời hạn thanh toán không được để trống').max(500),
  nguoiKy: z.record(z.enum(VAI_TRO_KY.map(v => v.id) as [VaiTroKyId, ...VaiTroKyId[]]), maUuidHoacRong),
  nguoiLayHdMacDinhId: maUuidHoacRong,
})

// Ghi từng khoá cấu hình trong một lượt: nếu một khoá lỗi thì cả lượt không đổi gì, để
// giấy in không rơi vào trạng thái nửa cũ nửa mới.
export async function luuCauHinhGiay(_: KetQuaGiay, formData: FormData): Promise<KetQuaGiay> {
  // Kiểm tra quyền nằm ngoài try: lệnh chuyển hướng của hàng rào vai trò phải đi thẳng ra
  // ngoài, không bị nuốt thành một câu báo lỗi chung.
  await batBuocVaiTro('admin')
  try {
    const nguoiKy: Record<string, string | null> = {}
    for (const vaiTro of VAI_TRO_KY) {
      const giaTri = formData.get(`ky_${vaiTro.id}`)
      nguoiKy[vaiTro.id] = typeof giaTri === 'string' && giaTri ? giaTri : null
    }
    const nguoiLayHd = formData.get('nguoi_lay_hd_mac_dinh')
    const parsed = schema.safeParse({
      tenDonVi: formData.get('ten_don_vi'),
      diaDanh: formData.get('dia_danh'),
      lyDoTamUng: formData.get('ly_do_tam_ung'),
      thoiHanThanhToan: formData.get('thoi_han_thanh_toan'),
      nguoiKy,
      nguoiLayHdMacDinhId: typeof nguoiLayHd === 'string' && nguoiLayHd ? nguoiLayHd : null,
    })
    if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }

    const d = parsed.data
    const giaTriTheoKhoa: Array<[string, string]> = [
      [KHOA_CAU_HINH_GIAY.tenDonVi, JSON.stringify(d.tenDonVi)],
      [KHOA_CAU_HINH_GIAY.diaDanh, JSON.stringify(d.diaDanh)],
      [KHOA_CAU_HINH_GIAY.lyDoTamUng, JSON.stringify(d.lyDoTamUng)],
      [KHOA_CAU_HINH_GIAY.thoiHanThanhToan, JSON.stringify(d.thoiHanThanhToan)],
      [KHOA_CAU_HINH_GIAY.nguoiKyMacDinh, JSON.stringify(d.nguoiKy)],
      [KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId, JSON.stringify(d.nguoiLayHdMacDinhId ?? '')],
    ]
    await db.query(
      `insert into cau_hinh (khoa, gia_tri)
       select * from unnest($1::text[], $2::jsonb[])
       on conflict (khoa) do update set gia_tri=excluded.gia_tri, sua_luc=now()`,
      [giaTriTheoKhoa.map(([k]) => k), giaTriTheoKhoa.map(([, v]) => v)]
    )
    revalidatePath('/cai-dat')
    revalidatePath('/giao-dich')
    return { thanhCong: 'Đã lưu thông tin giấy đề nghị.' }
  } catch (error) {
    if (error instanceof z.ZodError) return { loi: error.issues[0].message }
    return { loi: 'Không lưu được thông tin giấy đề nghị. Vui lòng thử lại.' }
  }
}

// Đọc lại cấu hình đã chuẩn hóa để trang cài đặt hiện đúng thứ máy chủ sẽ dùng khi in.
export async function docDuLieuCauHinhGiay(): Promise<DuLieuCauHinhGiay> {
  const cauHinh = await docCauHinhGiay()
  return {
    tenDonVi: cauHinh.tenDonVi, diaDanh: cauHinh.diaDanh,
    lyDoTamUng: cauHinh.lyDoTamUng, thoiHanThanhToan: cauHinh.thoiHanThanhToan,
    nguoiKy: {
      nguoiDeNghiId: cauHinh.nguoiDeNghiId,
      lanhDaoTiepKhachId: cauHinh.lanhDaoTiepKhachId,
      lanhDaoThanhToanId: cauHinh.lanhDaoThanhToanId,
      truongPhongId: cauHinh.truongPhongId,
      keToanKiemSoatId: cauHinh.keToanKiemSoatId,
    },
    nguoiLayHdMacDinhId: cauHinh.nguoiLayHdMacDinhId,
  }
}
