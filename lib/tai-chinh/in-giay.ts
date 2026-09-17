import { layDuLieuTaiChinh } from './du-lieu'
import { tinhToan } from './tinh-toan'
import { dungGiay, giayChoHinhThuc, type BoiCanhGiay, type GiayDeNghi, type LoaiGiay } from './giay'
import type { GiaoDichTinh } from './kieu'

// Giấy in ra phải khớp đúng số liệu đang thấy trên nhật ký, nên đọc qua cùng một đường
// tính toán thay vì tự truy vấn riêng một giao dịch.
export async function timGiaoDichTinh(id: string, client?: Pick<import('pg').PoolClient, 'query'>): Promise<GiaoDichTinh | null> {
  const { giaoDich, thamSo } = await layDuLieuTaiChinh(client)
  return tinhToan(giaoDich, thamSo).find(r => r.id === id) ?? null
}

// Giấy nào được lập cho hình thức này: tạm ứng thêm thì một giấy, hoàn tạm ứng và cơ
// quan trả thẳng thì hai giấy tiếp khách + thanh toán.
export function giayCuaGiaoDich(gd: GiaoDichTinh, ctx: BoiCanhGiay): GiayDeNghi[] {
  return giayChoHinhThuc(gd.hinhThuc).map(loai => dungGiay(loai, gd, ctx))
}

// Một giấy cụ thể, hoặc null khi hình thức của giao dịch không lập giấy đó. Chặn ở đây
// để địa chỉ tải tệp không sinh ra được giấy mà giao dịch không có.
export function giayTheoLoai(gd: GiaoDichTinh, ctx: BoiCanhGiay, loai: unknown): GiayDeNghi | null {
  const ds = giayChoHinhThuc(gd.hinhThuc)
  if (typeof loai !== 'string' || !ds.includes(loai as LoaiGiay)) return null
  return dungGiay(loai as LoaiGiay, gd, ctx)
}

// Tệp mẫu Word cho từng loại giấy. Hai giấy tiếp khách và thanh toán nằm chung một tệp.
export const MAU_WORD: Record<LoaiGiay, string> = {
  tam_ung: 'Tam ung tien.docx',
  tiep_khach: 'tiep khach va thanh toan.docx',
  thanh_toan: 'tiep khach va thanh toan.docx',
}
