import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import type { CotId } from './cot-nhat-ky'

// Nhãn hiển thị cho giá trị rỗng, dùng chung cho ô lọc và chip tóm tắt.
export const TRONG = '—'

export type Facet = {
  id: string
  ten: string
  giaTri: (r: GiaoDichTinh) => string
}

// Mỗi cột lọc theo một hay nhiều nhóm giá trị. Cột ghép nhiều trường (chứng từ,
// trạng thái, tệp) tách thành nhiều nhóm để lọc riêng từng phần, ví dụ chỉ tick
// "Hợp lệ" ở nhóm trạng thái hóa đơn mà không đụng tới trạng thái thanh toán phí.
// Cột tiền không có nhóm lọc: danh sách số tiền rời rạc không dùng để tick được,
// việc tổng hợp đã do hàng tổng đảm nhiệm.
export const FACET_COT: Partial<Record<CotId, readonly Facet[]>> = {
  ngay: [{ id: 'ngay', ten: 'Ngày', giaTri: r => r.ngay }],
  noiDung: [
    { id: 'noiDung', ten: 'Nội dung', giaTri: r => r.noiDung },
    { id: 'ghiChu', ten: 'Ghi chú', giaTri: r => r.ghiChu ?? '' },
  ],
  donVi: [{ id: 'donVi', ten: 'Đơn vị', giaTri: r => r.donViTen ?? '' }],
  chungTu: [
    { id: 'kyHieuHd', ten: 'Ký hiệu HĐ', giaTri: r => r.kyHieuHd ?? '' },
    { id: 'soHd', ten: 'Số HĐ', giaTri: r => r.soHd ?? '' },
    { id: 'loaiHd', ten: 'Loại chứng từ', giaTri: r => r.loaiHd ?? '' },
  ],
  trangThai: [
    { id: 'trangThaiHd', ten: 'Trạng thái hóa đơn', giaTri: r => r.trangThaiHd },
    { id: 'trangThaiTtPhi', ten: 'Thanh toán phí', giaTri: r => r.trangThaiTtPhi },
  ],
  hinhThuc: [{ id: 'hinhThuc', ten: 'Hình thức', giaTri: r => r.hinhThuc }],
  tep: [
    { id: 'coHoaDon', ten: 'Hóa đơn', giaTri: r => (r.coHoaDon ? 'Có hóa đơn' : 'Chưa có hóa đơn') },
    { id: 'coChuyenKhoan', ten: 'Chuyển khoản', giaTri: r => (r.coChuyenKhoan ? 'Có chuyển khoản' : 'Chưa chuyển khoản') },
  ],
}

export const FACET_THEO_ID: ReadonlyMap<string, Facet> = new Map(
  Object.values(FACET_COT).flat().map(f => [f.id, f])
)

export function facetCuaCot(id: CotId): readonly Facet[] {
  return FACET_COT[id] ?? []
}

export function nhanFacet(facetId: string): string {
  return FACET_THEO_ID.get(facetId)?.ten ?? facetId
}

// Bộ lọc đang áp dụng: mã nhóm -> các giá trị được tick. Nhóm không có trong
// đối tượng (hoặc mảng rỗng) nghĩa là không hạn chế gì.
export type BoLoc = Record<string, string[]>

export function demDangLoc(boLoc: BoLoc): number {
  return Object.values(boLoc).reduce((tong, giaTri) => tong + giaTri.length, 0)
}

export function dangLocFacet(boLoc: BoLoc, facetId: string): string[] {
  return boLoc[facetId] ?? []
}

// Nhiều nhóm khác nhau thì lấy giao (AND); trong cùng một nhóm thì lấy hợp (OR).
export function locDong(rows: GiaoDichTinh[], boLoc: BoLoc): GiaoDichTinh[] {
  const dangLoc = Object.entries(boLoc).filter(([, giaTri]) => giaTri.length > 0)
  if (!dangLoc.length) return rows
  return rows.filter(r => dangLoc.every(([id, giaTri]) => {
    const facet = FACET_THEO_ID.get(id)
    return !facet || giaTri.includes(facet.giaTri(r).trim())
  }))
}

// Danh sách giá trị để tick, kèm số dòng. Luôn tính trên toàn bộ dữ liệu chứ
// không phải phần đã lọc, để giá trị đang bị ẩn vẫn tick lại được.
export function tuyChonFacet(rows: readonly GiaoDichTinh[], facet: Facet): Array<{ giaTri: string; soLuong: number }> {
  const dem = new Map<string, number>()
  for (const r of rows) {
    const giaTri = facet.giaTri(r).trim()
    dem.set(giaTri, (dem.get(giaTri) ?? 0) + 1)
  }
  return [...dem].map(([giaTri, soLuong]) => ({ giaTri, soLuong }))
    .sort((a, b) => a.giaTri === '' ? 1 : b.giaTri === '' ? -1 : a.giaTri.localeCompare(b.giaTri, 'vi'))
}

export function batTatGiaTri(boLoc: BoLoc, facetId: string, giaTri: string): BoLoc {
  const hienTai = boLoc[facetId] ?? []
  const moi = hienTai.includes(giaTri) ? hienTai.filter(v => v !== giaTri) : [...hienTai, giaTri]
  const ket = { ...boLoc }
  if (moi.length) ket[facetId] = moi
  else delete ket[facetId]
  return ket
}

// Bỏ lọc của một cột: xóa mọi nhóm thuộc cột đó, giữ nguyên các cột khác.
export function boLocCot(boLoc: BoLoc, facetIds: readonly string[]): BoLoc {
  const ket = { ...boLoc }
  for (const id of facetIds) delete ket[id]
  return ket
}
