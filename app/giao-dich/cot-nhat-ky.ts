import { z } from 'zod'

// kieu: 'so' để so sánh theo số khi sắp xếp và cộng vào hàng tổng.
// congDon: chỉ bật cho các cột tiền thật sự cộng được. Ba cột dư là số dư luỹ kế
// nên cộng chúng lại không có ý nghĩa kế toán.
export const cotNhatKy = [
  { id: 'ngay', ten: 'Ngày', rong: 130, kieu: 'chuoi', congDon: false },
  { id: 'noiDung', ten: 'Nội dung', rong: 260, kieu: 'chuoi', congDon: false },
  { id: 'donVi', ten: 'Đơn vị tiếp khách', rong: 200, kieu: 'chuoi', congDon: false },
  { id: 'chungTu', ten: 'Chứng từ', rong: 150, kieu: 'chuoi', congDon: false },
  { id: 'trangThai', ten: 'Trạng thái', rong: 190, kieu: 'chuoi', congDon: false },
  { id: 'hinhThuc', ten: 'Hình thức', rong: 170, kieu: 'chuoi', congDon: false },
  { id: 'tongTien', ten: 'Tổng tiền', rong: 170, kieu: 'so', congDon: true },
  { id: 'tienRuouBia', ten: 'Rượu bia', rong: 170, kieu: 'so', congDon: true },
  { id: 'hoanTamUng', ten: 'Hoàn ứng', rong: 170, kieu: 'so', congDon: true },
  { id: 'cqTraThang', ten: 'CQ trả thẳng', rong: 170, kieu: 'so', congDon: true },
  { id: 'phiLayHd', ten: 'Phí HĐ', rong: 170, kieu: 'so', congDon: true },
  { id: 'tamUngTuCq', ten: 'Tạm ứng', rong: 170, kieu: 'so', congDon: true },
  { id: 'giaoTienChiThuy', ten: 'Giao chị Thúy', rong: 170, kieu: 'so', congDon: true },
  { id: 'hoanUngTienMat', ten: 'Nộp lại', rong: 170, kieu: 'so', congDon: true },
  { id: 'duLyThuyet', ten: 'Dư lý thuyết', rong: 170, kieu: 'so', congDon: false },
  { id: 'duThucTe', ten: 'Dư thực tế', rong: 170, kieu: 'so', congDon: false },
  { id: 'duDangCam', ten: 'Đang cầm', rong: 170, kieu: 'so', congDon: false },
  { id: 'tep', ten: 'Tệp', rong: 120, kieu: 'chuoi', congDon: false },
  // Cột Thao tác chứa tới bốn nút (Sửa, Giấy, Lịch sử, Xóa) nên rộng hơn các cột chữ khác;
  // hẹp quá thì flex-wrap đẩy nút xuống dòng và hàng nhật ký cao lên trông thấy.
  { id: 'thaoTac', ten: 'Thao tác', rong: 320, kieu: 'chuoi', congDon: false },
] as const
export type CotId = typeof cotNhatKy[number]['id']
export type Cot = typeof cotNhatKy[number]
export const rongMin = 90
export const rongMax = 600
export const SO_DONG_TRANG = [10, 20, 50, 100] as const
export type SoDongTrang = typeof SO_DONG_TRANG[number]
export const soDongTrangMacDinh: SoDongTrang = 20
const cotId = z.enum(cotNhatKy.map(c => c.id) as [CotId, ...CotId[]])
const thuTuMacDinh = cotNhatKy.map(c => c.id)
const soDongTrangSchema = z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)])

export const tuyChonSchema = z.object({
  an: z.array(cotId).max(cotNhatKy.length).refine(ids => new Set(ids).size === ids.length),
  rong: z.record(cotId, z.number().int().min(rongMin).max(rongMax)),
  // Thứ tự chỉ cần là các mã cột hợp lệ và không trùng. Cột mới thêm sau này được
  // ghép vào cuối khi đọc, nên tùy chọn đã lưu từ trước vẫn dùng được.
  thuTu: z.array(cotId).optional().refine(ids => ids === undefined || new Set(ids).size === ids.length, 'Thứ tự cột không hợp lệ.'),
  // Số dòng mỗi trang: tùy chọn cũ chưa có khóa này vẫn đọc được.
  soDongTrang: soDongTrangSchema.optional(),
}).strict().refine(value => cotNhatKy.some(c => c.id !== 'thaoTac' && !value.an.includes(c.id)), 'Phải hiển thị ít nhất một cột dữ liệu.')
export type TuyChonCot = z.infer<typeof tuyChonSchema>
export const cotMacDinh = (): TuyChonCot => ({ an: [], rong: {}, thuTu: [...thuTuMacDinh] })

export function soDongTrangHopLe(value?: number): SoDongTrang {
  return (SO_DONG_TRANG as readonly number[]).includes(value ?? 0) ? value as SoDongTrang : soDongTrangMacDinh
}

export function catTrangNhatKy<T>(dong: readonly T[], soDong: number, trang: number): { trang: number; tongTrang: number; dong: T[] } {
  const so = Number.isInteger(soDong) && soDong > 0 ? soDong : soDongTrangMacDinh
  const tongTrang = Math.max(1, Math.ceil(dong.length / so) || 1)
  const trangHopLe = Math.min(Math.max(1, trang), tongTrang)
  const dau = (trangHopLe - 1) * so
  return { trang: trangHopLe, tongTrang, dong: dong.slice(dau, dau + so) as T[] }
}

export function thuTuCot(tuyChon: TuyChonCot): CotId[] {
  if (!tuyChon.thuTu) return [...thuTuMacDinh]
  const hopLe = tuyChon.thuTu.filter(id => cotNhatKy.some(c => c.id === id))
  const daCo = new Set(hopLe)
  return [...hopLe, ...thuTuMacDinh.filter(id => !daCo.has(id))]
}
