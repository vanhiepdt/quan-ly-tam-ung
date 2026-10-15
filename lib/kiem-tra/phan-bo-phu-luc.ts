import { z } from 'zod'
import type { ChiTietHoaDon, DuLieuDocTuHoaDon, DongHang, LoaiHoaDon, CotTienHang } from './giao-dien'
import { laDongRuouBia } from './ruou-bia'
import { tienDongSauThue } from './loai-hoa-don'

export const DINH_MUC_BUFFET = 390_000

const soTien = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const schemaDongHang = z.object({
  ten: z.string().trim().min(1).max(300),
  soLuong: z.number().finite().nonnegative().max(1_000_000).optional(),
  donGia: soTien.optional(),
  thanhTien: soTien,
  thueSuat: z.number().finite().nonnegative().max(1_000).optional(),
  tienThue: soTien.optional(),
  thanhTienSauThue: soTien.optional(),
  laRuouBia: z.boolean().optional(),
  deNghiThanhToan: soTien.optional(),
  ghiChu: z.string().max(500).optional(),
})

export const schemaChiTietHoaDon = z.object({
  ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kyHieuHd: z.string().trim().max(40).optional(),
  soHd: z.string().trim().max(40).optional(),
  tenBanHang: z.string().trim().max(400).optional(),
  tongTien: soTien.optional(),
  loaiHd: z.enum(['gtgt', 'ban_hang']).optional(),
  cotTienHang: z.enum(['truoc_thue', 'sau_thue']).optional(),
  dongHang: z.array(schemaDongHang).min(1).max(200),
})

export type DongPhuLuc = {
  ten: string
  soLuong: number | null
  donGia: number | null
  tienThue: number | null
  thanhTien: number
  ghiChu: string
}

// Bảng kê gộp một dòng cho mỗi dòng hóa đơn, đúng thứ tự hóa đơn. Phần
// được đề nghị nằm cạnh thành tiền sau thuế, không tách thành hai nhóm như mẫu cũ.
export type DongBangKe = {
  ten: string
  soLuong: number | null
  thanhTienHoaDon: number
  deNghiThanhToan: number
  ghiChu: string
}

export type KetQuaPhanBoPhuLuc = {
  cacKhoanDeNghi: DongPhuLuc[]
  cacKhoanKhongDeNghi: DongPhuLuc[]
  cacDongTheoHoaDon: DongBangKe[]
  tongDeNghi: number
  tongKhongDeNghi: number
  tongHoaDon: number
  coBuffet: boolean
  loi?: string
}

const RONG: Pick<KetQuaPhanBoPhuLuc, 'cacKhoanDeNghi' | 'cacKhoanKhongDeNghi' | 'cacDongTheoHoaDon' | 'tongDeNghi' | 'tongKhongDeNghi' | 'tongHoaDon' | 'coBuffet'> = {
  cacKhoanDeNghi: [], cacKhoanKhongDeNghi: [], cacDongTheoHoaDon: [], tongDeNghi: 0, tongKhongDeNghi: 0, tongHoaDon: 0, coBuffet: false,
}

export function parseChiTietHoaDon(value: unknown): ChiTietHoaDon | null {
  if (value === null || value === undefined || value === '') return null
  const raw = typeof value === 'string' ? JSON.parse(value) : value
  return schemaChiTietHoaDon.parse(raw) as ChiTietHoaDon
}

export function chiTietHoaDonTuDeXuat(deXuat: DuLieuDocTuHoaDon): ChiTietHoaDon | null {
  if (!deXuat.dongHang?.length) return null
  const { ngay, kyHieuHd, soHd, tenBanHang, tongTien, loaiHd, cotTienHang, dongHang } = deXuat
  const ketQua = schemaChiTietHoaDon.safeParse({ ngay, kyHieuHd, soHd, tenBanHang, tongTien, loaiHd, cotTienHang, dongHang })
  return ketQua.success ? ketQua.data as ChiTietHoaDon : null
}

function chuanTen(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

function laBuffet(ten: string): boolean {
  return /\bbuffet?\b/.test(chuanTen(ten))
}

function soLuongBuffet(dong: DongHang): number | undefined {
  if (dong.soLuong !== undefined) return Number.isSafeInteger(dong.soLuong) && dong.soLuong > 0 ? dong.soLuong : undefined
  if (dong.donGia && dong.donGia > 0 && dong.thanhTien % dong.donGia === 0) {
    const suyRa = dong.thanhTien / dong.donGia
    return Number.isSafeInteger(suyRa) && suyRa > 0 ? suyRa : undefined
  }
}

function donGiaHieuLuc(dong: DongHang, thanhTienSauThue: number, soLuong: number): number {
  // Cột đơn giá trong phụ lục bám đúng đơn giá thể hiện trên hóa đơn.
  // Thành tiền phân bổ vẫn dùng số tiền sau thuế ở tienDongSauThue().
  if (dong.donGia !== undefined) return dong.donGia
  return Math.round(thanhTienSauThue / soLuong)
}
function thueDong(dong: DongHang, loaiHd?: LoaiHoaDon, cotTienHang?: CotTienHang): number | null {
  if (dong.tienThue !== undefined) return dong.tienThue
  if (dong.thanhTienSauThue !== undefined && cotTienHang === 'truoc_thue') {
    return Math.max(0, dong.thanhTienSauThue - dong.thanhTien)
  }
  if (dong.thueSuat !== undefined && loaiHd !== 'ban_hang' && cotTienHang !== 'sau_thue') {
    return Math.round(dong.thanhTien * dong.thueSuat / 100)
  }
  return null
}

function dongPhuLuc(
  dong: DongHang,
  thanhTien: number,
  loaiHd?: LoaiHoaDon,
  cotTienHang?: CotTienHang,
  ghiChu = '',
  thayDoi: Partial<Pick<DongPhuLuc, 'soLuong' | 'donGia' | 'tienThue'>> = {},
): DongPhuLuc {
  return {
    ten: dong.ten,
    soLuong: thayDoi.soLuong === undefined ? dong.soLuong ?? null : thayDoi.soLuong,
    donGia: thayDoi.donGia === undefined ? dong.donGia ?? null : thayDoi.donGia,
    tienThue: thayDoi.tienThue === undefined ? thueDong(dong, loaiHd, cotTienHang) : thayDoi.tienThue,
    thanhTien,
    ghiChu,
  }
}

function ucln(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

// Exact 0/1 knapsack in integer VND after reducing values by their common divisor.
function chonMonToiDa(ds: readonly { viTri: number; tien: number }[], hanMuc: number): Set<number> | string {
  if (!ds.length) return new Set()
  const tong = ds.reduce((s, d) => s + d.tien, 0)
  if (tong <= hanMuc) return new Set(ds.map(d => d.viTri))
  let donVi = hanMuc
  for (const d of ds) donVi = ucln(donVi, d.tien)
  donVi = Math.max(1, donVi)
  const sucChua = Math.floor(hanMuc / donVi)
  if (sucChua > 5_000_000) return 'Số tiền phân bổ vượt giới hạn tính toán chính xác. Hãy kiểm tra lại số lượng buffet trên hóa đơn.'

  const coTheDat = new Uint8Array(sucChua + 1)
  const monTruoc = new Int32Array(sucChua + 1).fill(-1)
  const tongTruoc = new Int32Array(sucChua + 1)
  coTheDat[0] = 1
  for (let i = 0; i < ds.length; i++) {
    const gia = ds[i].tien / donVi
    for (let so = sucChua; so >= gia; so--) {
      if (!coTheDat[so] && coTheDat[so - gia]) {
        coTheDat[so] = 1
        monTruoc[so] = i
        tongTruoc[so] = so - gia
      }
    }
  }

  let best = sucChua
  while (best > 0 && !coTheDat[best]) best--
  const chon = new Set<number>()
  while (best > 0) {
    const i = monTruoc[best]
    if (i < 0) break
    chon.add(ds[i].viTri)
    best = tongTruoc[best]
  }
  return chon
}

export function phanBoPhuLuc(chiTiet: ChiTietHoaDon): KetQuaPhanBoPhuLuc {
  const parsed = schemaChiTietHoaDon.safeParse(chiTiet)
  if (!parsed.success) return { ...RONG, loi: 'Chi tiết hóa đơn không hợp lệ. Hãy đọc lại hóa đơn.' }
  const { loaiHd, cotTienHang, dongHang } = parsed.data
  const cacDong = dongHang.map(dong => ({
    dong: { ...dong, laRuouBia: dong.laRuouBia ?? laDongRuouBia(dong.ten) },
    tien: tienDongSauThue(dong, loaiHd, cotTienHang),
    buffet: laBuffet(dong.ten),
  }))
  const coBuffet = cacDong.some(d => d.buffet)
  const deNghiTheoDong = new Map<number, DongPhuLuc>()
  const khongDeNghiTheoDong = new Map<number, DongPhuLuc>()
  const cacDongTheoHoaDon: DongBangKe[] = cacDong.map(({ dong, tien }) => ({
    ten: dong.ten, soLuong: dong.soLuong ?? null, thanhTienHoaDon: tien,
    deNghiThanhToan: 0, ghiChu: '',
  }))
  const monKhac: Array<{ viTri: number; tien: number }> = []
  let hanMucCon = 0

  for (let viTri = 0; viTri < cacDong.length; viTri++) {
    const { dong, tien, buffet } = cacDong[viTri]
    if (!Number.isSafeInteger(tien) || tien < 0) return { ...RONG, coBuffet, loi: `Không xác định được thành tiền sau thuế của “${dong.ten}”.` }
    if (dong.laRuouBia) {
      khongDeNghiTheoDong.set(viTri, dongPhuLuc(dong, tien, loaiHd, cotTienHang))
      continue
    }
    if (buffet) {
      const soLuong = soLuongBuffet(dong)
      if (soLuong === undefined) return { ...RONG, coBuffet, loi: `Không đọc được số lượng của “${dong.ten}”. Hãy kiểm tra số suất buffet trên hóa đơn.` }
      const dinhMuc = DINH_MUC_BUFFET * soLuong
      if (!Number.isSafeInteger(dinhMuc)) return { ...RONG, coBuffet, loi: `Số lượng của “${dong.ten}” vượt giới hạn tính toán.` }
      const donGia = donGiaHieuLuc(dong, tien, soLuong)
      const bangKe = cacDongTheoHoaDon[viTri]
      bangKe.soLuong = soLuong
      bangKe.deNghiThanhToan = Math.min(tien, dinhMuc)
      bangKe.ghiChu = `Định mức 390.000đ × ${new Intl.NumberFormat('vi-VN').format(soLuong)} suất = ${new Intl.NumberFormat('vi-VN').format(dinhMuc)}đ`
      if (tien <= dinhMuc) {
        deNghiTheoDong.set(viTri, dongPhuLuc(dong, tien, loaiHd, cotTienHang, '', { soLuong, donGia }))
        hanMucCon += dinhMuc - tien
      } else {
        deNghiTheoDong.set(viTri, dongPhuLuc(dong, dinhMuc, loaiHd, cotTienHang, 'Định mức 390.000đ/suất', {
          soLuong, donGia: DINH_MUC_BUFFET, tienThue: null,
        }))
        khongDeNghiTheoDong.set(viTri, dongPhuLuc(dong, tien - dinhMuc, loaiHd, cotTienHang, 'Phần vượt định mức buffet', {
          soLuong, donGia: Math.max(0, donGia - DINH_MUC_BUFFET), tienThue: null,
        }))
      }
      continue
    }
    if (!coBuffet) {
      deNghiTheoDong.set(viTri, dongPhuLuc(dong, tien, loaiHd, cotTienHang))
      cacDongTheoHoaDon[viTri].deNghiThanhToan = tien
    } else {
      monKhac.push({ viTri, tien })
    }
  }

  if (coBuffet) {
    const chon = chonMonToiDa(monKhac, hanMucCon)
    if (typeof chon === 'string') return { ...RONG, coBuffet, loi: chon }
    for (const { viTri, tien } of monKhac) {
      const { dong } = cacDong[viTri]
      if (chon.has(viTri)) {
        deNghiTheoDong.set(viTri, dongPhuLuc(dong, tien, loaiHd, cotTienHang))
        cacDongTheoHoaDon[viTri].deNghiThanhToan = tien
      } else {
        khongDeNghiTheoDong.set(viTri, dongPhuLuc(dong, tien, loaiHd, cotTienHang, 'Ngoài định mức buffet'))
        cacDongTheoHoaDon[viTri].ghiChu = 'Ngoài định mức buffet'
      }
    }
  }

  // Ghi đè chỉ hai cột người dùng được sửa. Người dùng được quyết định số đề nghị
  // của mọi dòng, kể cả bia rượu hay phần ngoài định mức buffet; chỉ chặn số vượt
  // thành tiền hóa đơn. Snapshot cũ thiếu ghi đè vẫn giữ kết quả phân bổ tự động.
  for (let viTri = 0; viTri < cacDong.length; viTri++) {
    const { dong, tien, buffet } = cacDong[viTri]
    const bangKe = cacDongTheoHoaDon[viTri]
    const deNghi = dong.deNghiThanhToan ?? bangKe.deNghiThanhToan
    if (deNghi > tien) {
      return { ...RONG, coBuffet, loi: `Đề nghị thanh toán dòng ${viTri + 1} không được vượt thành tiền theo hóa đơn.` }
    }

    if (deNghi !== bangKe.deNghiThanhToan) {
      // Phần người dùng chia theo số tiền không có đơn giá/thuế riêng. Bảng kê
      // mới chỉ in thành tiền; không tự suy ra hay nhân lại dữ liệu hóa đơn.
      const phanChia = deNghi > 0 && deNghi < tien ? { donGia: null, tienThue: null } : {}
      if (!buffet && deNghi > 0) bangKe.ghiChu = ''
      if (deNghi > 0) deNghiTheoDong.set(viTri, dongPhuLuc(dong, deNghi, loaiHd, cotTienHang, bangKe.ghiChu, { soLuong: bangKe.soLuong, ...phanChia }))
      else deNghiTheoDong.delete(viTri)
      if (tien > deNghi) khongDeNghiTheoDong.set(viTri, dongPhuLuc(dong, tien - deNghi, loaiHd, cotTienHang, bangKe.ghiChu, { soLuong: bangKe.soLuong, ...phanChia }))
      else khongDeNghiTheoDong.delete(viTri)
      bangKe.deNghiThanhToan = deNghi
    }
    if (dong.ghiChu !== undefined) {
      // Chuỗi rỗng cũng là một chỉnh sửa có chủ đích, không phục hồi ghi chú AI.
      bangKe.ghiChu = dong.ghiChu
      const duoc = deNghiTheoDong.get(viTri)
      const khong = khongDeNghiTheoDong.get(viTri)
      if (duoc) duoc.ghiChu = dong.ghiChu
      if (khong) khong.ghiChu = dong.ghiChu
    }
  }
  // Giữ đúng thứ tự dòng hóa đơn kể cả khi chỉnh sửa làm dòng chuyển nhóm.
  const cacKhoanDeNghi = [...deNghiTheoDong.entries()].sort(([a], [b]) => a - b).map(([, dong]) => dong)
  const cacKhoanKhongDeNghi = [...khongDeNghiTheoDong.entries()].sort(([a], [b]) => a - b).map(([, dong]) => dong)
  const tongDeNghi = cacKhoanDeNghi.reduce((sum, dong) => sum + dong.thanhTien, 0)
  const tongKhongDeNghi = cacKhoanKhongDeNghi.reduce((sum, dong) => sum + dong.thanhTien, 0)
  const tongHoaDon = tongDeNghi + tongKhongDeNghi
  if (![tongDeNghi, tongKhongDeNghi, tongHoaDon].every(Number.isSafeInteger)) {
    return { ...RONG, coBuffet, loi: 'Tổng tiền các dòng hàng vượt giới hạn an toàn.' }
  }
  return { cacKhoanDeNghi, cacKhoanKhongDeNghi, cacDongTheoHoaDon, tongDeNghi, tongKhongDeNghi, tongHoaDon, coBuffet }
}
