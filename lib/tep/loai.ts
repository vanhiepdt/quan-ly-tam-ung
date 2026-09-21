export const LOAI_TEP = ['hoa_don', 'chuyen_khoan', 'to_trinh_da_ky', 'giay_de_nghi_da_ky'] as const
export type LoaiTep = typeof LOAI_TEP[number]

export const NHAN_LOAI_TEP: Record<LoaiTep, string> = {
  hoa_don: 'Hóa đơn',
  chuyen_khoan: 'Ảnh chuyển khoản',
  to_trinh_da_ky: 'Tờ trình đã ký',
  giay_de_nghi_da_ky: 'Giấy đề nghị thanh toán đã ký',
}

export const LOAI_TEP_CHI_PDF: ReadonlySet<LoaiTep> = new Set(['to_trinh_da_ky', 'giay_de_nghi_da_ky'])

export function laLoaiTep(value: string): value is LoaiTep {
  return (LOAI_TEP as readonly string[]).includes(value)
}
