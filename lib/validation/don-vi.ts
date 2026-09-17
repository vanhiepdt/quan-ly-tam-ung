import { z } from 'zod'

export const schemaDonVi = z.object({
  ten: z.string().trim().min(1, 'Tên đơn vị không được để trống').max(200),
  ghi_chu: z.string().trim().max(1000).nullable().optional().transform(v => v === '' ? null : v),
})

export type DauVaoDonVi = z.infer<typeof schemaDonVi>
