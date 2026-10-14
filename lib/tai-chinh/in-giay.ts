import { layDuLieuTaiChinh } from './du-lieu'
import { tinhToan } from './tinh-toan'
import { dungGiay, giayChoHinhThuc, giayChinhChoHinhThuc, type BoiCanhGiay, type GiayDeNghi, type LoaiGiay } from './giay'
import type { GiaoDichTinh } from './kieu'
import { MAU_TAM_UNG, MAU_TIEP_KHACH_THANH_TOAN } from '@/lib/van-ban/mau-word'

// Giấy in ra phải khớp đúng số liệu đang thấy trên nhật ký, nên đọc qua cùng một đường
// tính toán thay vì tự truy vấn riêng một giao dịch.
export async function timGiaoDichTinh(id: string, client?: Pick<import('pg').PoolClient, 'query'>): Promise<GiaoDichTinh | null> {
  const { giaoDich, thamSo } = await layDuLieuTaiChinh(client)
  return tinhToan(giaoDich, thamSo).find(r => r.id === id) ?? null
}

// Giấy của giao dịch mới giữ nguyên toàn bộ người ký đã chọn lúc tạo hoặc lần sửa
// gần nhất. Giao dịch cũ chưa có snapshot đầy đủ vẫn dùng cấu hình chung cho các
// vai trò chưa được lưu, để migration không làm đổi giấy đã tồn tại.
function boiCanhTheoGiaoDich(gd: GiaoDichTinh, ctx: BoiCanhGiay): BoiCanhGiay {
  const cauHinh = gd.thongTinGiayDaChot
    ? {
        ...ctx.cauHinh,
        nguoiDeNghiId: gd.nguoiDeNghiId ?? null,
        lanhDaoTiepKhachId: gd.lanhDaoTiepKhachId ?? null,
        lanhDaoThanhToanId: gd.lanhDaoThanhToanId ?? null,
        truongPhongId: gd.truongPhongId ?? null,
        keToanKiemSoatId: gd.keToanKiemSoatId ?? null,
      }
    : {
        ...ctx.cauHinh,
        // Migration 013 đã có thể lưu riêng người đề nghị. Tôn trọng giá trị đó
        // trên dữ liệu cũ, còn bốn vai trò kia vẫn theo Cài đặt chung như trước.
        nguoiDeNghiId: gd.nguoiDeNghiId ?? ctx.cauHinh.nguoiDeNghiId,
      }
  const nguoiDeNghi = cauHinh.nguoiDeNghiId
    ? ctx.canBo.find(cb => cb.id === cauHinh.nguoiDeNghiId)
    : undefined
  return { ...ctx, cauHinh, ...(nguoiDeNghi ? { nguoiDeNghi } : {}) }
}

// Giấy nào được lập cho hình thức này: tạm ứng thêm thì một giấy, hoàn tạm ứng và cơ
// quan trả thẳng thì hai giấy tiếp khách + thanh toán.
export function giayCuaGiaoDich(gd: GiaoDichTinh, ctx: BoiCanhGiay): GiayDeNghi[] {
  const context = boiCanhTheoGiaoDich(gd, ctx)
  return giayChoHinhThuc(gd.hinhThuc).map(loai => dungGiay(loai, gd, context))
}

// Một giấy cụ thể, hoặc null khi hình thức của giao dịch không lập giấy đó. Chặn ở đây
// để địa chỉ tải tệp không sinh ra được giấy mà giao dịch không có.
export function giayTheoLoai(gd: GiaoDichTinh, ctx: BoiCanhGiay, loai: unknown): GiayDeNghi | null {
  const chinh = giayChinhChoHinhThuc(gd.hinhThuc)
  if (typeof loai !== 'string' || chinh === null || loai !== chinh) return null
  return dungGiay(chinh, gd, boiCanhTheoGiaoDich(gd, ctx))
}

// Tệp mẫu Word cho từng loại giấy. Hai giấy tiếp khách và thanh toán nằm chung một tệp.
export const MAU_WORD: Record<LoaiGiay, string> = {
  tam_ung: MAU_TAM_UNG,
  tiep_khach: MAU_TIEP_KHACH_THANH_TOAN,
  thanh_toan: MAU_TIEP_KHACH_THANH_TOAN,
}
