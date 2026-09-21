import type { DuLieuDocTuHoaDon } from './giao-dien'

// Hai khuôn QR hóa đơn điện tử Việt Nam:
// 1. Ống đứng (nhiều nhà cung cấp): MST|ký hiệu|số|ngày|tổng tiền|mã CQT
// 2. TLV kiểu EMV (QĐ TCT / MISA meinvoice…): 000201 + mẫu 80–99
//    01 MST, 02 loại (1–6), 03 ký hiệu, 04 số, 05 ngày yyyymmdd, 06 tổng tiền.
//    Một số PDF (MISA) ghi sai độ dài mẫu 99; khi đó quét từ trường MST 01.
const MST = /^\d{10}(\d{3})?$/
const KY_HIEU = /^[1-6]?[A-Za-z]{1,3}\d{2}[A-Za-z]{2,6}$/

function cat(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function chuanHoaMst(value: string): string {
  return value.replace(/[\s.\-]/g, '')
}

export function hienThiMst(value: string): string {
  const so = chuanHoaMst(value)
  if (/^\d{13}$/.test(so)) return `${so.slice(0, 10)}-${so.slice(10)}`
  return so
}

export function chuanHoaNgayQr(value: string): string | undefined {
  const gọn = value.trim()
  const iso = gọn.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const ymd = gọn.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const dmy = gọn.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
}

export function chuanHoaTienQr(value: string): number | undefined {
  const gọn = value.trim().replace(/\s/g, '').replace(/,/g, '')
  if (!gọn) return
  const so = Number(gọn)
  if (!Number.isFinite(so) || so < 0 || !Number.isSafeInteger(so)) return
  return so
}

function chuanHoaSoHdTlv(value: string): string | undefined {
  const gọn = value.trim()
  if (!gọn) return
  if (/^\d{1,8}$/.test(gọn)) return gọn.padStart(8, '0')
  return gọn
}

function docTlv(chuoi: string, dungSom = false): Map<string, string> | null {
  const map = new Map<string, string>()
  let i = 0
  const n = chuoi.length
  if (n < 8) return null
  while (i + 4 <= n) {
    const tag = chuoi.slice(i, i + 2)
    const lenChu = chuoi.slice(i + 2, i + 4)
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenChu)) {
      if (dungSom) break
      return null
    }
    const len = Number(lenChu)
    i += 4
    if (i + len > n) {
      if (dungSom) break
      return null
    }
    const val = chuoi.slice(i, i + len)
    i += len
    if (tag === '63') break
    map.set(tag, val)
  }
  return map.size ? map : null
}

function bangTrongMau(root: Map<string, string>): Map<string, string> {
  const gop = new Map<string, string>()
  for (const [tag, val] of root) {
    if (tag < '80' || tag > '99') continue
    const inner = docTlv(val, true)
    if (!inner) continue
    for (const [k, v] of inner) gop.set(k, v)
  }
  return gop
}

function tuTruongTlv(bang: Map<string, string>): DuLieuDocTuHoaDon | null {
  const mstBanHang = chuanHoaMst(bang.get('01') ?? '')
  if (!MST.test(mstBanHang)) return null
  const t2 = (bang.get('02') ?? '').trim()
  const t3 = (bang.get('03') ?? '').trim()
  let kyHieuHd: string | undefined
  let soHd: string | undefined
  if (/^[1-6]$/.test(t2)) {
    kyHieuHd = t3 ? (t3.startsWith(t2) ? t3 : t2 + t3) : undefined
    soHd = chuanHoaSoHdTlv(bang.get('04') ?? '')
  } else {
    kyHieuHd = KY_HIEU.test(t2) ? t2 : (KY_HIEU.test(t3) ? t3 : undefined)
    soHd = chuanHoaSoHdTlv(bang.get('04') ?? '')
      ?? (/^\d{1,8}$/.test(t3) ? t3.padStart(8, '0') : undefined)
  }
  const ngay = chuanHoaNgayQr(bang.get('05') ?? '')
  const tongTien = chuanHoaTienQr(bang.get('06') ?? '')
  if (bang.get('06') && tongTien === undefined) return null
  if (!kyHieuHd && !soHd && tongTien === undefined) return null
  return { mstBanHang, kyHieuHd, soHd, ngay, tongTien, tongCong: tongTien }
}

function docQrOng(raw: string): DuLieuDocTuHoaDon | null {
  const parts = raw.split('|').map(cat)
  if (parts.length < 5) return null
  const mstBanHang = chuanHoaMst(parts[0])
  if (!MST.test(mstBanHang)) return null
  const kyHieuHd = parts[1] || undefined
  const soHd = parts[2] || undefined
  const ngay = chuanHoaNgayQr(parts[3])
  const tongTien = chuanHoaTienQr(parts[4])
  if (parts[4] && tongTien === undefined) return null
  if (!kyHieuHd && !soHd && tongTien === undefined) return null
  return { mstBanHang, kyHieuHd, soHd, ngay, tongTien, tongCong: tongTien }
}

function docQrTlvDung(raw: string): DuLieuDocTuHoaDon | null {
  const root = docTlv(raw, true)
  if (!root) return null
  const mau = bangTrongMau(root)
  return chonDu(tuTruongTlv(mau), tuTruongTlv(root))
}

// Một số PDF (MISA) ghi sai độ dài mẫu 99. Quét chuỗi tìm 01 + MST 10/13 số rồi đọc TLV từ đó.
function docQrTlvQuet(raw: string): DuLieuDocTuHoaDon | null {
  let tot: DuLieuDocTuHoaDon | null = null
  for (let i = 0; i <= raw.length - 14; i++) {
    if (raw.slice(i, i + 2) !== '01') continue
    const lenChu = raw.slice(i + 2, i + 4)
    if (lenChu !== '10' && lenChu !== '13') continue
    const bang = docTlv(raw.slice(i), true)
    if (!bang) continue
    tot = chonDu(tot, tuTruongTlv(bang))
  }
  return tot
}

function diem(d: DuLieuDocTuHoaDon | null): number {
  if (!d) return -1
  return [d.mstBanHang, d.kyHieuHd, d.soHd, d.ngay, d.tongTien].filter(x => x !== undefined && x !== '').length
}

function chonDu(a: DuLieuDocTuHoaDon | null, b: DuLieuDocTuHoaDon | null): DuLieuDocTuHoaDon | null {
  return diem(b) > diem(a) ? b : a
}

// Tách chuỗi QR thành dữ liệu hóa đơn. Sai khuôn thì trả null, không đoán.
export function docQrHoaDon(chuoi: string): DuLieuDocTuHoaDon | null {
  const raw = cat(chuoi).replace(/^﻿/, '')
  if (!raw) return null
  return chonDu(docQrOng(raw), chonDu(docQrTlvDung(raw), docQrTlvQuet(raw)))
}

export function giongChuoi(a?: string, b?: string): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

export function giongMst(a?: string, b?: string): boolean {
  const x = chuanHoaMst(a ?? ''), y = chuanHoaMst(b ?? '')
  return Boolean(x) && x === y
}

export function giongTien(a?: number, b?: number): boolean {
  return a !== undefined && b !== undefined && a === b
}
