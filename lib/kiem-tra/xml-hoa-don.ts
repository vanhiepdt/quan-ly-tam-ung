import type { CotTienHang, DongHang, DuLieuDocTuHoaDon, LoaiHoaDon } from './giao-dien'
import { doanLoaiTuKyHieu, tienDongSauThue } from './loai-hoa-don'
import { chuanHoaNgay, chuanHoaMst } from './so-sanh'
import { congTienRuouBia } from './ruou-bia'

function tenTag(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mauTag(name: string): RegExp {
  return new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${tenTag(name)}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${tenTag(name)}\\s*>`, 'i')
}

function mauTagBatKy(names: readonly string[]): RegExp {
  return new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?(?:${names.map(tenTag).join('|')})\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?(?:${names.map(tenTag).join('|')})\\s*>`, 'i')
}

function giaTri(xml: string, names: readonly string[]): string | undefined {
  for (const name of names) {
    const match = xml.match(mauTag(name))
    if (match?.[1]) return giaiMa(match[1])
  }
}

function giaTriCuoi(xml: string, names: readonly string[]): string | undefined {
  for (const name of names) {
    const regex = new RegExp(mauTag(name).source, 'gi')
    let match: RegExpExecArray | null
    let last: string | undefined
    while ((match = regex.exec(xml))) last = match[1]
    if (last !== undefined) return giaiMa(last)
  }
}

function khoi(xml: string, names: readonly string[]): string | undefined {
  const match = xml.match(mauTagBatKy(names))
  return match?.[1]
}

function giaiMa(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function soTien(value?: string): number | undefined {
  if (!value) return
  const raw = value.trim().replace(/\s/g, '').replace(/[₫đĐ]|VND|VNĐ/gi, '')
  if (!raw) return
  let normalized = raw
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) normalized = raw.replace(/\./g, '').replace(',', '.')
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) normalized = raw.replace(/,/g, '')
  else if (raw.includes(',') && !raw.includes('.')) normalized = raw.replace(',', '.')
  const number = Number(normalized)
  if (!Number.isFinite(number) || number < 0) return
  const rounded = Math.round(number)
  return Number.isSafeInteger(rounded) ? rounded : undefined
}

function soThuc(value?: string): number | undefined {
  if (!value) return
  const number = Number(value.trim().replace('%', '').replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function thueSuat(value?: string): number | undefined {
  const number = soThuc(value)
  if (number === undefined) return
  return number > 0 && number <= 1 ? number * 100 : number
}

function loaiHoaDon(xml: string, kyHieuHd?: string): LoaiHoaDon | undefined {
  const explicit = `${giaTri(xml, ['TCHDon', 'TenHDon', 'LoaiHDon', 'HinhThucHDon']) ?? ''} ${xml.slice(0, 3000)}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/hoa don gia tri gia tang|hoa don gtgt/.test(explicit)) return 'gtgt'
  if (/hoa don ban hang/.test(explicit)) return 'ban_hang'
  return doanLoaiTuKyHieu(kyHieuHd)
}

function khoiDongHang(xml: string): string[] {
  const regex = /<(?:[A-Za-z_][\w.-]*:)?(?:HHDVu|HH|DHang)\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?(?:HHDVu|HH|DHang)\s*>/gi
  const result: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) result.push(match[1])
  return result.slice(0, 200)
}

function docDongHang(khoiXml: string): DongHang | undefined {
  const ten = giaTri(khoiXml, ['Ten', 'THHDVu', 'TenHHDVu', 'TenHang'])
  const soLuong = soThuc(giaTri(khoiXml, ['SLuong', 'SoLuong', 'Luong']))
  const donGia = soTien(giaTri(khoiXml, ['DGia', 'DonGia', 'Gia']))
  const thanhTien = soTien(giaTri(khoiXml, ['ThTien', 'ThanhTien', 'TienHang', 'TTien']))
    ?? (soLuong !== undefined && donGia !== undefined ? Math.round(soLuong * donGia) : undefined)
  if (!ten || thanhTien === undefined) return
  const tienThue = soTien(giaTri(khoiXml, ['TThue', 'TienThue', 'ThueGTGT']))
  const thanhTienSauThue = soTien(giaTri(khoiXml, ['TTSThue', 'ThTienSauThue', 'ThanhTienSauThue', 'TienSauThue']))
  const thue = thueSuat(giaTri(khoiXml, ['TSuat', 'TSThue', 'ThueSuat']))
  return {
    ten,
    ...(soLuong !== undefined ? { soLuong } : {}),
    ...(donGia !== undefined ? { donGia } : {}),
    thanhTien,
    ...(thue !== undefined ? { thueSuat: thue } : {}),
    ...(tienThue !== undefined ? { tienThue } : {}),
    ...(thanhTienSauThue !== undefined ? { thanhTienSauThue } : {}),
  }
}

function docNguoi(xml: string, names: readonly string[]): { mst?: string; ten?: string; diaChi?: string } {
  const block = khoi(xml, names) ?? xml
  const mst = giaTri(block, ['MST', 'MSTSD', 'MSTNguoiMua', 'MSTNguoiBan'])
  const ten = giaTri(block, ['Ten', 'TenNCC', 'TenNguoiMua', 'TenNguoiBan', 'TNV'])
  const diaChi = giaTri(block, ['DChi', 'DiaChi', 'DChiNCC', 'DiaChiNguoiMua', 'DiaChiNguoiBan'])
  return {
    ...(mst ? { mst: chuanHoaMst(mst) } : {}),
    ...(ten ? { ten } : {}),
    ...(diaChi ? { diaChi } : {}),
  }
}

function cotTienHang(xml: string, loaiHd: LoaiHoaDon | undefined, dongHang: readonly DongHang[]): CotTienHang | undefined {
  const moTa = `${giaTri(xml, ['TieuDeCotTien', 'TenCotThanhTien']) ?? ''} ${xml.slice(0, 5000)}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/sau thue|da gom thue|da bao gom thue|thanh tien sau thue/.test(moTa)) return 'sau_thue'
  if (dongHang.some(d => d.thanhTienSauThue !== undefined)) return 'sau_thue'
  if (dongHang.some(d => d.tienThue !== undefined || d.thueSuat !== undefined)) return 'truoc_thue'
  return loaiHd === 'gtgt' ? 'truoc_thue' : undefined
}

export function docHoaDonXml(xml: string): DuLieuDocTuHoaDon {
  const trimmed = xml.replace(/^\uFEFF/, '').trim()
  if (!trimmed || /<!DOCTYPE|<!ENTITY/i.test(trimmed)) throw new Error('XML hóa đơn không được chứa khai báo ngoài.')
  if (!/^<\?xml\b|^<[A-Za-z_]/i.test(trimmed)) throw new Error('Tệp không có cấu trúc XML hợp lệ.')

  const kyHieuHd = giaTri(trimmed, ['KHHDon', 'KHHD', 'KyHieuHDon', 'KyHieu'])
  const soHd = giaTri(trimmed, ['SHDon', 'SoHDon', 'SoHD', 'SoHoaDon'])
  const ngay = chuanHoaNgay(giaTri(trimmed, ['NLap', 'NgayLap', 'NgayHDon', 'Ngay']) ?? '')
  const ban = docNguoi(trimmed, ['NBan', 'NguoiBan', 'Seller'])
  const mua = docNguoi(trimmed, ['NMua', 'NguoiMua', 'Buyer'])
  const loaiHd = loaiHoaDon(trimmed, kyHieuHd)
  const dongHang = khoiDongHang(trimmed).map(docDongHang).filter((d): d is DongHang => Boolean(d))
  const cot = cotTienHang(trimmed, loaiHd, dongHang)
  const tongTien = soTien(giaTriCuoi(trimmed, ['TgTTTBSo', 'TgTToan', 'TongTienThanhToan', 'TToan', 'TgTCThue']))
  const tienThue = soTien(giaTriCuoi(trimmed, ['TgTThue', 'TongTienThue', 'TThue', 'TGTGT']))
  const ketQua: DuLieuDocTuHoaDon = {
    ...(kyHieuHd ? { kyHieuHd } : {}),
    ...(soHd ? { soHd } : {}),
    ...(ngay ? { ngay } : {}),
    ...(ban.mst ? { mstBanHang: ban.mst } : {}),
    ...(ban.ten ? { tenBanHang: ban.ten } : {}),
    ...(mua.mst ? { mstMuaHang: mua.mst } : {}),
    ...(mua.ten ? { tenMuaHang: mua.ten } : {}),
    ...(mua.diaChi ? { diaChiMuaHang: mua.diaChi } : {}),
    ...(tongTien !== undefined ? { tongTien, tongCong: tongTien } : {}),
    ...(tienThue !== undefined ? { tienThue } : {}),
    ...(loaiHd ? { loaiHd } : {}),
    ...(cot ? { cotTienHang: cot } : {}),
    ...(dongHang.length ? { dongHang } : {}),
  }
  if (dongHang.length) {
    const { tien, dong } = congTienRuouBia(dongHang, loaiHd, cot)
    ketQua.dongHang = dong
    ketQua.tienRuouBia = tien
  }
  return ketQua
}

export const phanTichHoaDonXml = docHoaDonXml

export function tongDongRuouBiaXml(doc: DuLieuDocTuHoaDon): number | undefined {
  if (!doc.dongHang?.length) return doc.tienRuouBia
  return doc.dongHang.reduce((sum, dong) => sum + (dong.laRuouBia ? tienDongSauThue(dong, doc.loaiHd, doc.cotTienHang) : 0), 0)
}
