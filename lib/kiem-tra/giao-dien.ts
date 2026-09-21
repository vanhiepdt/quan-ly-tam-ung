// Kết quả đọc hóa đơn chỉ là đề xuất để điền form. Không ghi thẳng vào database.

export type TrangThaiKiemTra =
  | 'chua_kiem_tra' | 'dang_kiem_tra' | 'hop_le'
  | 'co_canh_bao' | 'khong_hop_le' | 'loi_ky_thuat'

export type LoaiHoaDon = 'gtgt' | 'ban_hang'
export type CotTienHang = 'truoc_thue' | 'sau_thue'

export type DongHang = {
  ten: string
  soLuong?: number
  donGia?: number
  thanhTien: number
  thueSuat?: number
  tienThue?: number
  thanhTienSauThue?: number
  laRuouBia?: boolean
}

export interface DuLieuDocTuHoaDon {
  kyHieuHd?: string
  soHd?: string
  ngay?: string
  mstBanHang?: string
  tenBanHang?: string
  mstMuaHang?: string
  tenMuaHang?: string
  diaChiMuaHang?: string
  tongTien?: number
  tienThue?: number
  tongCong?: number
  tienRuouBia?: number
  loaiHd?: LoaiHoaDon
  cotTienHang?: CotTienHang
  dongHang?: DongHang[]
}

export interface PhatHien {
  muc: 'loi' | 'canh_bao' | 'thong_tin'
  ma: string
  thongDiep: string
  truong?: string
}

export interface KetQuaDocHoaDon {
  trangThai: TrangThaiKiemTra
  deXuat: DuLieuDocTuHoaDon
  qr: DuLieuDocTuHoaDon | null
  ocr: DuLieuDocTuHoaDon | null
  ai: DuLieuDocTuHoaDon | null
  phatHien: PhatHien[]
  nhatKy?: string[]
}

export const TRUONG_KHOA_QR = ['kyHieuHd', 'soHd', 'ngay', 'mstBanHang', 'tongTien'] as const
export type TruongKhoaQr = typeof TRUONG_KHOA_QR[number]

export type DonViDoiChieu = { mst: string; ten: string; diaChi: string }
