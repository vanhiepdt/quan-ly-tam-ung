import type { DuLieuDocTuHoaDon, KetQuaDocHoaDon } from './giao-dien'
import { diaChiGanDung, tenGanDung } from './hop-nhat'
import { giongChuoi, giongMst, giongTien, hienThiMst } from './qr-hoa-don'
import { tienRuouBiaCuaLop } from './ruou-bia'

export type NguonDoc = 'ocr' | 'qr' | 'ai'

export type OCotDoiChieu = {
  nguon: NguonDoc
  khop: boolean
  giaTri?: string
  goiY: string
}

export type HangDoiChieu = {
  khoa: 'mstMuaHang' | 'tenMuaHang' | 'diaChiMuaHang' | 'kyHieuSo' | 'ngay' | 'tongTien' | 'tienRuouBia'
  nhan: string
  hienThi: string
  dayDu: string
  cot: OCotDoiChieu[]
}

const NGUON: { id: NguonDoc; nhan: string }[] = [
  { id: 'ocr', nhan: 'OCR' },
  { id: 'qr', nhan: 'QR' },
  { id: 'ai', nhan: 'AI' },
]

const vnd = new Intl.NumberFormat('vi-VN')

export function catDiaChi(chu: string, toiDa = 26): string {
  const t = chu.trim()
  if (t.length <= toiDa) return t
  const cat = t.slice(0, toiDa)
  const cuoi = cat.lastIndexOf(' ')
  const goc = (cuoi >= 12 ? cat.slice(0, cuoi) : cat).replace(/[,\s]+$/, '')
  return `${goc}...`
}

export function nhanRuouBia(deXuat: DuLieuDocTuHoaDon): string {
  if (deXuat.loaiHd === 'gtgt') {
    if (deXuat.cotTienHang === 'sau_thue') return 'Rượu bia (đã gồm thuế GTGT)'
    if (deXuat.cotTienHang === 'truoc_thue') return 'Rượu bia (đã cộng thuế GTGT)'
    return 'Rượu bia'
  }
  if (deXuat.loaiHd === 'ban_hang') return 'Rượu bia'
  return 'Rượu bia (đã cộng thuế GTGT)'
}

function kyHieuSo(doc: DuLieuDocTuHoaDon): string | undefined {
  const gop = [doc.kyHieuHd, doc.soHd].filter(Boolean).join(' · ')
  return gop || undefined
}

function hienThiTien(so?: number): string | undefined {
  if (so === undefined) return
  return `${vnd.format(so)}đ`
}

function chuTruong(doc: DuLieuDocTuHoaDon | null, khoa: HangDoiChieu['khoa'], deXuat: DuLieuDocTuHoaDon = {}): string | undefined {
  if (!doc) return
  if (khoa === 'kyHieuSo') return kyHieuSo(doc)
  if (khoa === 'ngay') return doc.ngay || undefined
  if (khoa === 'tongTien') return hienThiTien(doc.tongTien)
  if (khoa === 'tienRuouBia') return hienThiTien(tienRuouBiaCuaLop(doc, deXuat.loaiHd, deXuat.cotTienHang))
  const raw = doc[khoa]
  if (raw === undefined || raw === '') return
  return khoa === 'mstMuaHang' ? hienThiMst(String(raw)) : String(raw)
}

function khopTruong(
  khoa: HangDoiChieu['khoa'],
  chuan: DuLieuDocTuHoaDon | null,
  soSanh: DuLieuDocTuHoaDon | null,
): boolean {
  if (!chuan || !soSanh) return false
  if (khoa === 'mstMuaHang') return giongMst(chuan.mstMuaHang, soSanh.mstMuaHang)
  if (khoa === 'tenMuaHang') {
    return Boolean(chuan.tenMuaHang && soSanh.tenMuaHang && tenGanDung(chuan.tenMuaHang, soSanh.tenMuaHang))
  }
  if (khoa === 'diaChiMuaHang') {
    return Boolean(chuan.diaChiMuaHang && soSanh.diaChiMuaHang && diaChiGanDung(chuan.diaChiMuaHang, soSanh.diaChiMuaHang))
  }
  if (khoa === 'kyHieuSo') {
    const a = kyHieuSo(chuan), b = kyHieuSo(soSanh)
    return Boolean(a && b && giongChuoi(a, b))
  }
  if (khoa === 'ngay') return Boolean(chuan.ngay && soSanh.ngay && giongChuoi(chuan.ngay, soSanh.ngay))
  if (khoa === 'tongTien') return giongTien(chuan.tongTien, soSanh.tongTien)
  if (khoa === 'tienRuouBia') {
    return giongTien(
      tienRuouBiaCuaLop(chuan, chuan.loaiHd, chuan.cotTienHang),
      tienRuouBiaCuaLop(soSanh, chuan.loaiHd, chuan.cotTienHang),
    )
  }
  return false
}

function oCot(
  nguon: NguonDoc,
  nhanNguon: string,
  khoa: HangDoiChieu['khoa'],
  chuan: DuLieuDocTuHoaDon | null,
  doc: DuLieuDocTuHoaDon | null,
): OCotDoiChieu {
  const giaTri = chuTruong(doc, khoa, chuan ?? {})
  if (!giaTri) {
    return { nguon, khop: false, goiY: `${nhanNguon} không có ${nhanKhoa(khoa, chuan ?? {}).toLowerCase()}` }
  }
  const khop = khopTruong(khoa, chuan, doc)
  return {
    nguon,
    khop,
    giaTri,
    goiY: khop ? `${nhanNguon} khớp` : `${nhanNguon} đọc: ${giaTri}`,
  }
}

function nhanKhoa(khoa: HangDoiChieu['khoa'], deXuat: DuLieuDocTuHoaDon = {}): string {
  if (khoa === 'mstMuaHang') return 'MST người mua'
  if (khoa === 'tenMuaHang') return 'Tên đơn vị mua'
  if (khoa === 'diaChiMuaHang') return 'Địa chỉ đơn vị mua'
  if (khoa === 'kyHieuSo') return 'Ký hiệu / số'
  if (khoa === 'ngay') return 'Ngày'
  if (khoa === 'tongTien') return 'Tổng tiền'
  return nhanRuouBia(deXuat)
}

function hang(
  khoa: HangDoiChieu['khoa'],
  kq: KetQuaDocHoaDon,
): HangDoiChieu {
  const dayDu = chuTruong(kq.deXuat, khoa, kq.deXuat) ?? 'không đọc được'
  const hienThi = khoa === 'diaChiMuaHang' && chuTruong(kq.deXuat, khoa, kq.deXuat)
    ? catDiaChi(dayDu)
    : dayDu
  return {
    khoa,
    nhan: nhanKhoa(khoa, kq.deXuat),
    hienThi,
    dayDu,
    cot: NGUON.map(n => oCot(n.id, n.nhan, khoa, kq.deXuat, kq[n.id])),
  }
}

export function bangDoiChieuNguoiMua(kq: KetQuaDocHoaDon): HangDoiChieu[] {
  return [
    hang('mstMuaHang', kq),
    hang('tenMuaHang', kq),
    hang('diaChiMuaHang', kq),
    hang('kyHieuSo', kq),
    hang('ngay', kq),
    hang('tongTien', kq),
    hang('tienRuouBia', kq),
  ]
}
