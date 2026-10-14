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

export type CotPhuLuc = 'ten' | 'soLuong' | 'donGia' | 'tienThue' | 'thanhTien' | 'ghiChu'
export type NhomCotPhuLuc = 'deNghi' | 'khongDeNghi'
export type CauTrucPhuLuc = { soCot: number; nhomCot: NhomCotPhuLuc[]; cot: (CotPhuLuc | null)[] }

function tenCotChuan(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function phanTichCotPhuLuc(headers: readonly string[], nhomHeaders: readonly string[] = []): CauTrucPhuLuc | null {
  if (headers.length < 4 || headers.length > 20) return null
  const cot = headers.map(header => {
    const ten = tenCotChuan(header)
    if (/thanh tien|tong tien|thanh toan|so tien(?! thue)/.test(ten)) return 'thanhTien' as const
    if (/ghi chu/.test(ten)) return 'ghiChu' as const
    if (/so luong/.test(ten)) return 'soLuong' as const
    if (/don gia/.test(ten)) return 'donGia' as const
    if (/tien thue|thue gtgt|thue vat/.test(ten)) return 'tienThue' as const
    if (/so tien/.test(ten)) return 'thanhTien' as const
    if (/noi dung|hang hoa|dich vu|dien giai|ten hang|ten hang hoa/.test(ten)) return 'ten' as const
    return null
  })
  if (!cot.includes('ten') || !cot.includes('soLuong') || !cot.includes('donGia') || !cot.includes('thanhTien')) return null

  const nhom = headers.map((_, index) => {
    const text = tenCotChuan(`${nhomHeaders[index] ?? ''} ${headers[index]}`)
    if (/khong de nghi|khong thanh toan|khong duoc thanh toan/.test(text)) return 'khongDeNghi' as const
    if (/de nghi thanh toan|de nghi|duoc thanh toan/.test(text)) return 'deNghi' as const
    return null
  })
  const coNhom = nhom.some(Boolean)
  if (coNhom && (nhom.some(x => x === 'deNghi') && nhom.some(x => x === 'khongDeNghi')) === false) return null
  return { soCot: headers.length, cot, nhomCot: nhom as NhomCotPhuLuc[] }
}

export function taoDongMangPhuLuc(row: DongPhuLuc, cauTruc: CauTrucPhuLuc, nhom: NhomCotPhuLuc): (string | number | null)[] {
  return cauTruc.cot.map((cot, index) => {
    if (cauTruc.nhomCot[index] && cauTruc.nhomCot[index] !== nhom) return null
    if (cot === 'ten') return row.ten
    if (cot === 'soLuong') return row.soLuong
    if (cot === 'donGia') return row.donGia
    if (cot === 'tienThue') return row.tienThue
    if (cot === 'thanhTien') return row.thanhTien
    if (cot === 'ghiChu') return row.ghiChu || null
    return null
  })
}

export type KetQuaPhanBoPhuLuc = {
  cacKhoanDeNghi: DongPhuLuc[]
  cacKhoanKhongDeNghi: DongPhuLuc[]
  tongDeNghi: number
  tongKhongDeNghi: number
  tongHoaDon: number
  coBuffet: boolean
  loi?: string
}

const RONG: Pick<KetQuaPhanBoPhuLuc, 'cacKhoanDeNghi' | 'cacKhoanKhongDeNghi' | 'tongDeNghi' | 'tongKhongDeNghi' | 'tongHoaDon' | 'coBuffet'> = {
  cacKhoanDeNghi: [], cacKhoanKhongDeNghi: [], tongDeNghi: 0, tongKhongDeNghi: 0, tongHoaDon: 0, coBuffet: false,
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
  const cacKhoanDeNghi: DongPhuLuc[] = []
  const cacKhoanKhongDeNghi: DongPhuLuc[] = []
  const monKhac: Array<{ viTri: number; tien: number }> = []
  let hanMucCon = 0

  for (let viTri = 0; viTri < cacDong.length; viTri++) {
    const { dong, tien, buffet } = cacDong[viTri]
    if (!Number.isSafeInteger(tien) || tien < 0) return { ...RONG, coBuffet, loi: `Không xác định được thành tiền sau thuế của “${dong.ten}”.` }
    if (dong.laRuouBia) {
      cacKhoanKhongDeNghi.push(dongPhuLuc(dong, tien, loaiHd, cotTienHang))
      continue
    }
    if (buffet) {
      const soLuong = soLuongBuffet(dong)
      if (soLuong === undefined) return { ...RONG, coBuffet, loi: `Không đọc được số lượng của “${dong.ten}”. Hãy kiểm tra số suất buffet trên hóa đơn.` }
      const dinhMuc = DINH_MUC_BUFFET * soLuong
      if (!Number.isSafeInteger(dinhMuc)) return { ...RONG, coBuffet, loi: `Số lượng của “${dong.ten}” vượt giới hạn tính toán.` }
      const donGia = donGiaHieuLuc(dong, tien, soLuong)
      if (tien <= dinhMuc) {
        cacKhoanDeNghi.push(dongPhuLuc(dong, tien, loaiHd, cotTienHang, '', { soLuong, donGia }))
        hanMucCon += dinhMuc - tien
      } else {
        cacKhoanDeNghi.push(dongPhuLuc(dong, dinhMuc, loaiHd, cotTienHang, 'Định mức 390.000đ/suất', {
          soLuong, donGia: DINH_MUC_BUFFET, tienThue: null,
        }))
        cacKhoanKhongDeNghi.push(dongPhuLuc(dong, tien - dinhMuc, loaiHd, cotTienHang, 'Phần vượt định mức buffet', {
          soLuong, donGia: Math.max(0, donGia - DINH_MUC_BUFFET), tienThue: null,
        }))
      }
      continue
    }
    if (!coBuffet) {
      cacKhoanDeNghi.push(dongPhuLuc(dong, tien, loaiHd, cotTienHang))
    } else {
      monKhac.push({ viTri, tien })
    }
  }

  if (coBuffet) {
    const chon = chonMonToiDa(monKhac, hanMucCon)
    if (typeof chon === 'string') return { ...RONG, coBuffet, loi: chon }
    for (const { viTri, tien } of monKhac) {
      const { dong } = cacDong[viTri]
      if (chon.has(viTri)) cacKhoanDeNghi.push(dongPhuLuc(dong, tien, loaiHd, cotTienHang))
      else cacKhoanKhongDeNghi.push(dongPhuLuc(dong, tien, loaiHd, cotTienHang, 'Ngoài định mức buffet'))
    }
  }

  const tongDeNghi = cacKhoanDeNghi.reduce((sum, dong) => sum + dong.thanhTien, 0)
  const tongKhongDeNghi = cacKhoanKhongDeNghi.reduce((sum, dong) => sum + dong.thanhTien, 0)
  const tongHoaDon = tongDeNghi + tongKhongDeNghi
  if (![tongDeNghi, tongKhongDeNghi, tongHoaDon].every(Number.isSafeInteger)) {
    return { ...RONG, coBuffet, loi: 'Tổng tiền các dòng hàng vượt giới hạn an toàn.' }
  }
  return { cacKhoanDeNghi, cacKhoanKhongDeNghi, tongDeNghi, tongKhongDeNghi, tongHoaDon, coBuffet }
}
