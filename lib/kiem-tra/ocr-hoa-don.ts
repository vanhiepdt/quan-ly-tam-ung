import type { DongHang, DuLieuDocTuHoaDon } from './giao-dien'
import { doanCotTuChu, doanLoaiTuChu, doanLoaiTuKyHieu } from './loai-hoa-don'
import { chuanHoaMst, chuanHoaNgayQr } from './qr-hoa-don'

export type ChuHoaDon = { x: number; y: number; chu: string }

const NGUONG_Y = 4
const MST = /\d{10}(?:[.\-\s]?\d{3})?/
const KY_HIEU = /[1-6]?[A-Za-z]{1,3}\d{2}[A-Za-z]{2,6}/

function boDau(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

function ascii(value: string): string {
  return boDau(value).toLowerCase()
}

function gon(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function catChamCuoi(value: string): string {
  return value.replace(/[.\s]+$/g, '').trim()
}

export function gopDongChu(items: readonly ChuHoaDon[]): string[] {
  const sach = items.filter(i => i.chu.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const dong: ChuHoaDon[][] = []
  for (const i of sach) {
    const last = dong[dong.length - 1]
    if (last && Math.abs(last[0].y - i.y) <= NGUONG_Y) last.push(i)
    else dong.push([i])
  }
  return dong.map(nhom => gon(nhom.sort((a, b) => a.x - b.x).map(i => i.chu).join(' ')))
}

function tienVnd(value: string): number | undefined {
  const gọn = value.trim()
  if (/^\d{1,3}(\.\d{3})+$/.test(gọn) || /^\d+$/.test(gọn)) {
    const so = Number(gọn.replace(/\./g, ''))
    if (Number.isSafeInteger(so) && so >= 0) return so
  }
}

function sauNhan(dong: string, mau: RegExp): string | undefined {
  const m = dong.match(mau)
  if (!m?.[1]) return
  const giaTri = catChamCuoi(m[1])
  return giaTri || undefined
}

function mstTrong(value: string): string | undefined {
  const m = value.match(MST)
  if (!m) return
  const so = chuanHoaMst(m[0])
  return /^\d{10}(\d{3})?$/.test(so) ? so : undefined
}

function docDongHang(dong: string): DongHang | null {
  const m = dong.match(
    /^(\d{1,3})\s+(.+?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s+([\d.]+)\s+([\d.]+)(?:\s+(\d+)\s*%\s+([\d.]+))?$/,
  )
  if (!m) return null
  const ten = gon(m[2])
  const thanhTien = tienVnd(m[6])
  if (!ten || thanhTien === undefined) return null
  if (/^(stt|ten hang|tong hop|tong cong|thue suat)$/i.test(ascii(ten))) return null
  const thueSuat = m[7] !== undefined ? Number(m[7]) : undefined
  const tienThue = m[8] !== undefined ? tienVnd(m[8]) : undefined
  return {
    ten,
    soLuong: Number(m[4].replace(',', '.')) || undefined,
    donGia: tienVnd(m[5]),
    thanhTien,
    ...(thueSuat !== undefined && Number.isFinite(thueSuat) ? { thueSuat } : {}),
    ...(tienThue !== undefined ? { tienThue } : {}),
  }
}

function trongBangHang(dong: string, dangTrong: boolean): boolean {
  const a = ascii(dong)
  if (/ten hang hoa/.test(a)) return true
  if (!dangTrong) return false
  if (/^tong hop\b/.test(a) || /^tong cong\b/.test(a) || /^thue suat\b/.test(a) || /^so tien viet/.test(a)) {
    return false
  }
  return true
}

export function phanTichChuHoaDon(
  dauVao: string | readonly string[] | readonly ChuHoaDon[],
): DuLieuDocTuHoaDon | null {
  const dong = typeof dauVao === 'string'
    ? dauVao.split(/\r?\n/).map(gon).filter(Boolean)
    : typeof dauVao[0] === 'string'
      ? (dauVao as readonly string[]).map(gon).filter(Boolean)
      : gopDongChu(dauVao as readonly ChuHoaDon[])
  if (!dong.length) return null

  const deXuat: DuLieuDocTuHoaDon = {}
  const dongHang: DongHang[] = []
  let daTenDonVi = false
  let trongBang = false

  for (const raw of dong) {
    const a = ascii(raw)
    const sapVaoBang = trongBangHang(raw, trongBang)
    if (/ten hang hoa/.test(a)) {
      trongBang = true
      continue
    }
    if (trongBang && !sapVaoBang) trongBang = false
    if (trongBang) {
      const hang = docDongHang(raw)
      if (hang) dongHang.push(hang)
      continue
    }

    const tenDonVi = sauNhan(raw, /tên\s+đơn\s+vị\s*:\s*(.+)/i)
      ?? sauNhan(raw, /đơn\s+vị\s+mua\s+hàng\s*:\s*(.+)/i)
    if (tenDonVi) {
      deXuat.tenMuaHang = tenDonVi
      daTenDonVi = true
      continue
    }

    const mstChuHo = sauNhan(raw, /mst\s*\/?\s*cccd[^:]*:\s*(.+)/i)
      ?? sauNhan(raw, /mã\s+số\s+thuế\s+người\s+mua\s*:\s*(.+)/i)
    if (mstChuHo) {
      const mst = mstTrong(mstChuHo)
      if (mst) deXuat.mstMuaHang = mst
      continue
    }

    const mstThue = sauNhan(raw, /mã\s+số\s+thuế\s*:\s*(.+)/i)
    if (mstThue) {
      const mst = mstTrong(mstThue)
      if (mst && !deXuat.mstBanHang) deXuat.mstBanHang = mst
      else if (mst && daTenDonVi && !deXuat.mstMuaHang) deXuat.mstMuaHang = mst
      continue
    }

    const diaChi = sauNhan(raw, /địa\s+chỉ\s*:\s*(.+)/i)
    if (diaChi) {
      if (daTenDonVi && !deXuat.diaChiMuaHang) deXuat.diaChiMuaHang = diaChi
      continue
    }

    const kyHieu = sauNhan(raw, /ký\s+hiệu\s*:\s*([A-Za-z0-9]+)/i)
    if (kyHieu && KY_HIEU.test(kyHieu) && !deXuat.kyHieuHd) deXuat.kyHieuHd = kyHieu

    const soHd = sauNhan(raw, /(?:^|[\s])số\s*:\s*(\d{1,8})(?!\d)/i)
    if (soHd && !deXuat.soHd) deXuat.soHd = soHd.padStart(8, '0')

    const ngay = raw.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i)
    if (ngay && !deXuat.ngay) {
      deXuat.ngay = chuanHoaNgayQr(`${ngay[1]}/${ngay[2]}/${ngay[3]}`)
    }

    const tong = raw.match(/tổng\s+cộng\s*:\s*(.+)/i)
    if (tong && deXuat.tongTien === undefined) {
      const so = [...tong[1].matchAll(/\d{1,3}(?:\.\d{3})+/g)].map(m => tienVnd(m[0])).filter((n): n is number => n !== undefined)
      if (so.length) deXuat.tongTien = so[so.length - 1]
    }

    if (!deXuat.tenBanHang && !raw.includes(':') && raw.length >= 12 && /công ty|doanh nghiệp|tnhh|cổ phần|nhà hàng|quán/i.test(raw)) {
      deXuat.tenBanHang = raw
    }
  }

  if (dongHang.length) deXuat.dongHang = dongHang
  if (deXuat.tongTien !== undefined) deXuat.tongCong = deXuat.tongTien
  const loaiHd = doanLoaiTuChu(dong) ?? doanLoaiTuKyHieu(deXuat.kyHieuHd)
  const cotTienHang = doanCotTuChu(dong)
  if (loaiHd) deXuat.loaiHd = loaiHd
  if (cotTienHang) deXuat.cotTienHang = cotTienHang

  const co = Boolean(
    deXuat.tenMuaHang || deXuat.mstMuaHang || deXuat.diaChiMuaHang
    || deXuat.mstBanHang || deXuat.kyHieuHd || deXuat.soHd
    || deXuat.tongTien !== undefined || deXuat.dongHang?.length,
  )
  return co ? deXuat : null
}
