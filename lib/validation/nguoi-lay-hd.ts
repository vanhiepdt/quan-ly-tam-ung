import { z } from 'zod'
import { nganHangTheoBin } from '../qr/ngan-hang'

export const schemaNguoiLayHd = z.object({
  ten: z.string().trim().min(1, 'Tên không được để trống').max(200),
  ty_le_phi: z.coerce.number().min(0).max(1).nullable().optional(),
  ngan_hang_bin: z.string().trim().max(10).nullable().optional().refine(v => !v || !!nganHangTheoBin(v), 'Vui lòng chọn ngân hàng trong danh sách.'),
  chi_nhanh: z.string().trim().max(200).nullable().optional(),
  so_tai_khoan: z.string().trim().max(50).nullable().optional(),
  // Máy chủ suy ra tên ngân hàng từ BIN đã chọn, không tin tên do trình duyệt gửi.
  ten_ngan_hang: z.string().trim().max(200).nullable().optional(),
  ten_chu_tk: z.string().trim().max(200).nullable().optional(),
  // Người lấy hóa đơn cũng là cán bộ trong cơ quan, để biết phòng và chức danh của họ.
  can_bo_id: z.string().uuid().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
})

export type NguoiLayHdInput = z.infer<typeof schemaNguoiLayHd>
