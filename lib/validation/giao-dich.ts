import { z } from 'zod'
import { canDonVi, hopLeHinhThucThanhToan } from '@/lib/tai-chinh/hinh-thuc'

const tien = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt giới hạn an toàn.')

// Accept null, undefined, or string. Transform empty string to null.
const stringOrNull = z.union([
  z.null(),
  z.undefined(),
  z.string().trim().transform(val => val === '' ? null : val)
]).transform(val => val === undefined ? null : val)

const uuidOrNull = z.union([
  z.null(),
  z.undefined(),
  z.literal(''),
  z.string().uuid('Mã đơn vị không hợp lệ.'),
]).transform(val => (val === undefined || val === '' ? null : val))

export const schemaGiaoDich = z.object({
  ngay: z.string().date(),
  // Khi hình thức gắn đơn vị, nội dung do máy chủ sinh từ tên đơn vị nên có thể rỗng ở đây.
  noi_dung: z.string().trim().max(1000),
  don_vi_id: uuidOrNull,
  ky_hieu_hd: stringOrNull,
  so_hd: stringOrNull,
  loai_hd: stringOrNull,
  trang_thai_hd: stringOrNull,
  hinh_thuc: z.string().min(1),
  tong_tien: tien.default(0),
  tien_ruou_bia: tien.default(0),
  tam_ung_tu_cq: tien.default(0),
  giao_tien_chi_thuy: tien.default(0),
  hoan_ung_tien_mat: tien.default(0),
  nguoi_lay_hd_id: uuidOrNull,
  phi_lay_hd_ghi_de: z.union([z.null(), z.undefined(), tien]).transform(val => val === undefined ? null : val),
  trang_thai_tt_phi: stringOrNull,
  ghi_chu: stringOrNull,
  // Tiền mặt / chuyển khoản / hoàn tạm ứng. Hình thức giao dịch quyết định giá trị nào
  // hợp lệ, nên chỉ kiểm tra được kiểu ở đây; ràng buộc theo hình thức nằm ở refine dưới.
  hinh_thuc_thanh_toan: z.union([z.null(), z.undefined(), z.string()])
    .transform(val => (val === undefined || val === '' ? null : val)),
}).refine((d) => d.tien_ruou_bia <= d.tong_tien, {
  message: 'Tiền rượu bia không được vượt tổng tiền',
  path: ['tien_ruou_bia']
}).refine((d) => canDonVi(d.hinh_thuc) || d.noi_dung.length > 0, {
  message: 'Nội dung không được để trống.',
  path: ['noi_dung']
}).refine((d) => !canDonVi(d.hinh_thuc) || d.don_vi_id !== null, {
  // Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới gắn đơn vị, nhưng khi đã gắn thì bắt buộc.
  message: 'Hình thức này phải chọn đơn vị tiếp khách.',
  path: ['don_vi_id']
}).refine((d) => canDonVi(d.hinh_thuc) || d.don_vi_id === null, {
  // Chiều ngược lại: dòng tiền nội bộ không được mang đơn vị, kể cả khi client cố gửi lên.
  message: 'Hình thức này không gắn với đơn vị tiếp khách.',
  path: ['don_vi_id']
}).refine((d) => hopLeHinhThucThanhToan(d.hinh_thuc, d.hinh_thuc_thanh_toan), {
  // Mỗi hình thức giao dịch chỉ lập một số giấy nhất định, và mỗi giấy chỉ in được một
  // số hình thức thanh toán. Client cố gửi giá trị lạ thì bị từ chối thay vì lưu rác.
  message: 'Hình thức thanh toán không hợp với hình thức giao dịch.',
  path: ['hinh_thuc_thanh_toan']
})

export type DauVaoGiaoDich = z.infer<typeof schemaGiaoDich>
