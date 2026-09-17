import { z } from 'zod'

// Cán bộ là người ký trên giấy đề nghị. Giới tính in trước họ tên ("Ông Nguyễn Văn A"),
// chức danh in sau dấu gạch ngang, phòng in ở dòng đơn vị công tác. Lãnh đạo là người ký
// duyệt và không thuộc phòng nào, nên phòng phải để trống.
export const GIOI_TINH = ['Ông', 'Bà'] as const

const chuoiRong = z.string().trim().max(200).nullable().optional().transform(v => (v ? v : null))

export const schemaCanBo = z.object({
  ho_ten: z.string().trim().min(1, 'Họ tên không được để trống').max(200, 'Họ tên tối đa 200 ký tự'),
  gioi_tinh: z.enum(GIOI_TINH, { message: 'Giới tính chỉ có Ông hoặc Bà.' }).nullable().optional().transform(v => v ?? null),
  chuc_danh: chuoiRong,
  phong: chuoiRong,
  la_lanh_dao: z.coerce.boolean().optional().transform(v => v === true),
  nguoi_dung_id: z.string().uuid('Tài khoản đăng nhập không hợp lệ.').nullable().optional().transform(v => (v ? v : null)),
}).refine(d => !d.la_lanh_dao || !d.phong, {
  message: 'Lãnh đạo không thuộc phòng nào, hãy để trống phòng.',
  path: ['phong'],
})

export type DauVaoCanBo = z.infer<typeof schemaCanBo>
