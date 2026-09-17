import { z } from 'zod'

export const schemaNguoiLayHd = z.object({
  ten: z.string().trim().min(1, 'Tên không được để trống').max(200),
  ty_le_phi: z.coerce.number().min(0).max(1).nullable().optional(),
  ngan_hang_bin: z.string().trim().max(10).nullable().optional(),
  so_tai_khoan: z.string().trim().max(50).nullable().optional(),
  // Tên ngân hàng gõ tay in trên giấy; BIN chỉ dùng khi chưa có tên.
  ten_ngan_hang: z.string().trim().max(200).nullable().optional(),
  ten_chu_tk: z.string().trim().max(200).nullable().optional(),
  // Người lấy hóa đơn cũng là cán bộ trong cơ quan, để biết phòng và chức danh của họ.
  can_bo_id: z.string().uuid().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
})

export type NguoiLayHdInput = z.infer<typeof schemaNguoiLayHd>
