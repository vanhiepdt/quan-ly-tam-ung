import type { ChiTietHoaDon } from '@/lib/kiem-tra/giao-dien'
import {
  phanBoPhuLuc,
  type DongBangKe,
} from '@/lib/kiem-tra/phan-bo-phu-luc'
import { dienMauDocx, TEP_NOI_DUNG, type ThayTheCoDinh } from '@/lib/van-ban/docx'
import { docZip, ghiZip } from '@/lib/van-ban/zip'
export { coPhuLucThanhToan } from './co-phu-luc'

export class LoiMauPhuLuc extends Error {
  constructor(message: string) { super(message); this.name = 'LoiMauPhuLuc' }
}

type Khoang = { batDau: number; ketThuc: number }
type DongBang = { khoang: Khoang; cells: Khoang[]; text: string[] }
type ThayDoi = { khoang: Khoang; text: string }

const DINH_DANG_TIEN = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const DINH_DANG_SO_LUONG = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 })

function cacKhoang(xml: string, tag: string): Khoang[] {
  const re = new RegExp(`<(/?)${tag}(?=[\\s/>])[^>]*>`, 'g')
  const stack: number[] = []
  const khoang: Khoang[] = []
  for (const m of xml.matchAll(re)) {
    const token = m[0]
    if (m[1]) {
      const batDau = stack.pop()
      if (batDau !== undefined) khoang.push({ batDau, ketThuc: m.index + token.length })
    } else if (!/\/>$/.test(token)) {
      stack.push(m.index)
    }
  }
  return khoang.sort((a, b) => a.batDau - b.batDau)
}

function hangTrucTiepTrongBang(xml: string): Khoang[] {
  const re = /<(\/?)w:(tbl|tr)(?=[\s/>])[^>]*>/g
  const rows: Khoang[] = []
  let tableDepth = 0
  let rowStart: number | null = null
  for (const m of xml.matchAll(re)) {
    const closing = Boolean(m[1])
    const tag = m[2]
    if (tag === 'tbl') {
      if (closing) tableDepth--
      else if (!/\/>$/.test(m[0])) tableDepth++
      continue
    }
    if (tableDepth !== 1) continue
    if (!closing) rowStart = m.index
    else if (rowStart !== null) {
      rows.push({ batDau: rowStart, ketThuc: m.index + m[0].length })
      rowStart = null
    }
  }
  return rows
}

function cellTrucTiepTrongHang(xml: string): Khoang[] {
  const re = /<(\/?)w:(tbl|tc)(?=[\s/>])[^>]*>/g
  const cells: Khoang[] = []
  let tableDepth = 0
  let cellStart: number | null = null
  for (const m of xml.matchAll(re)) {
    const closing = Boolean(m[1])
    const tag = m[2]
    if (tag === 'tbl') {
      if (closing) tableDepth--
      else if (!/\/>$/.test(m[0])) tableDepth++
      continue
    }
    if (tableDepth !== 0) continue
    if (!closing) cellStart = m.index
    else if (cellStart !== null) {
      cells.push({ batDau: cellStart, ketThuc: m.index + m[0].length })
      cellStart = null
    }
  }
  return cells
}

function giaiXml(value: string): string {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, ma) => String.fromCodePoint(parseInt(ma, 16)))
    .replace(/&#(\d+);/g, (_, ma) => String.fromCodePoint(Number(ma)))
    .replace(/&amp;/g, '&')
}

function maXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function textTrongCell(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map(m => giaiXml(m[1])).join('').normalize('NFC')
}

function tenChuan(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function cacDongBang(document: string): { khoang: Khoang; xml: string; dong: DongBang[]; headerIndex: number } {
  for (const bang of cacKhoang(document, 'w:tbl')) {
    const xml = document.slice(bang.batDau, bang.ketThuc)
    const dong = hangTrucTiepTrongBang(xml).map(khoang => {
      const hang = xml.slice(khoang.batDau, khoang.ketThuc)
      const cells = cellTrucTiepTrongHang(hang)
      return { khoang, cells, text: cells.map(cell => textTrongCell(hang.slice(cell.batDau, cell.ketThuc))) }
    })
    const headerIndex = dong.findIndex(row => row.cells.length === 6 &&
      /^stt$|^so thu tu$/.test(tenChuan(row.text[0])) &&
      /^(noi dung|ten hang hoa)/.test(tenChuan(row.text[1])) &&
      /^so luong/.test(tenChuan(row.text[2])) &&
      /^thanh tien\s*theo hoa don$/.test(tenChuan(row.text[3])) &&
      /^de nghi thanh toan$/.test(tenChuan(row.text[4])) &&
      /^ghi chu$/.test(tenChuan(row.text[5])))
    if (headerIndex >= 0) return { khoang: bang, xml, dong, headerIndex }
  }
  throw new LoiMauPhuLuc('Mẫu bảng kê không có đủ sáu cột theo mẫu hiện hành.')
}

function dienCell(xml: string, text: string): string {
  const paragraphs = cacKhoang(xml, 'w:p')
  if (!paragraphs.length) throw new LoiMauPhuLuc('Dòng mẫu phụ lục có ô không chứa đoạn văn.')
  const p = paragraphs[0]
  let doan = xml.slice(p.batDau, p.ketThuc)
  let daCoText = false
  doan = doan.replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (_match, attrs = '') => {
    if (daCoText) return `<w:t${attrs}></w:t>`
    daCoText = true
    const space = /^\s|\s$/.test(text) && !/xml:space=/.test(attrs) ? `${attrs} xml:space="preserve"` : attrs
    return `<w:t${space}>${maXml(text)}</w:t>`
  })
  if (!daCoText && text) {
    const run = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/.exec(doan)
    const noiDung = `<w:t${/^\s|\s$/.test(text) ? ' xml:space="preserve"' : ''}>${maXml(text)}</w:t>`
    if (run) {
      const moi = /<\/w:r>$/.test(run[0])
        ? run[0].replace(/<\/w:r>$/, `${noiDung}</w:r>`)
        : run[0]
      doan = doan.slice(0, run.index) + moi + doan.slice(run.index + run[0].length)
    } else {
      doan = doan.replace(/<\/w:p>$/, `<w:r>${noiDung}</w:r></w:p>`)
    }
  }
  return xml.slice(0, p.batDau) + doan + xml.slice(p.ketThuc)
}

function thayCacCell(hangXml: string, values: readonly string[]): string {
  const cells = cellTrucTiepTrongHang(hangXml)
  if (cells.length !== values.length) throw new LoiMauPhuLuc('Số cột của dòng mẫu phụ lục không khớp dòng tiêu đề.')
  let result = hangXml
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i]
    const content = dienCell(result.slice(cell.batDau, cell.ketThuc), values[i])
    result = result.slice(0, cell.batDau) + content + result.slice(cell.ketThuc)
  }
  return result
}

// Word/OnlyOffice lưu ô gộp bằng gridSpan: chỉ số ô vật lý không còn là
// chỉ số cột. Tìm ô Thành tiền theo lưới bảng, giữ nguyên ô nhãn và định dạng gộp.
function oTaiCot(hangXml: string, cot: number, soCot: number): number {
  const cells = cellTrucTiepTrongHang(hangXml)
  let viTri = 0
  let ketQua = -1
  for (let i = 0; i < cells.length; i++) {
    const cell = hangXml.slice(cells[i].batDau, cells[i].ketThuc)
    const props = /<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/.exec(cell)?.[0] ?? ''
    const span = Number(/<w:gridSpan\b[^>]*\bw:val="(\d+)"/.exec(props)?.[1] ?? 1)
    if (!Number.isSafeInteger(span) || span < 1 || span > soCot) throw new LoiMauPhuLuc('Ô gộp trong dòng tổng cộng không hợp lệ.')
    // Chỉ điền vào ô bắt đầu ở cột tiền, không ghi đè nhãn gộp trùm cột tiền.
    if (viTri === cot) ketQua = i
    viTri += span
  }
  if (viTri !== soCot || ketQua < 0) throw new LoiMauPhuLuc('Dòng tổng cộng trong mẫu phụ lục thiếu ô thành tiền riêng.')
  return ketQua
}

function thayNhieu(xml: string, edits: readonly ThayDoi[]): string {
  let result = xml
  for (const edit of [...edits].sort((a, b) => b.khoang.batDau - a.khoang.batDau)) {
    result = result.slice(0, edit.khoang.batDau) + edit.text + result.slice(edit.khoang.ketThuc)
  }
  return result
}

function chuanHoaHang(
  bangXml: string,
  mauHang: DongBang[],
  noiDung: readonly DongBangKe[],
): ThayDoi[] {
  if (!mauHang.length) throw new LoiMauPhuLuc('Mẫu bảng kê thiếu dòng trống để điền chi tiết.')
  const mau = bangXml.slice(mauHang[0].khoang.batDau, mauHang[0].khoang.ketThuc)
    .replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '')
  const cacHangMoi = noiDung.map((row, index) => thayCacCell(mau, [
    String(index + 1), row.ten,
    row.soLuong === null ? '' : DINH_DANG_SO_LUONG.format(row.soLuong),
    DINH_DANG_TIEN.format(row.thanhTienHoaDon),
    DINH_DANG_TIEN.format(row.deNghiThanhToan), row.ghiChu,
  ])).join('')
  return [
    { khoang: mauHang[0].khoang, text: cacHangMoi },
    ...mauHang.slice(1).map(row => ({ khoang: row.khoang, text: '' })),
  ]
}

export function taoPhuLucDocx(mau: Buffer, chiTiet: ChiTietHoaDon, thayThe: Record<string, string>, thayCoDinh: readonly ThayTheCoDinh[] = []): Buffer {
  const phanBo = phanBoPhuLuc(chiTiet)
  if (phanBo.loi) throw new Error(phanBo.loi)
  if (phanBo.tongKhongDeNghi <= 0) throw new Error('Hóa đơn không có khoản không đề nghị thanh toán.')

  // Dùng đúng biến của giấy thanh toán, kể cả số tiền đã qua luồng làm tròn cũ.
  // Bên bán lấy từ hóa đơn, không nhầm với đơn vị tiếp khách hay người đề nghị.
  const daDien = dienMauDocx(mau, { ...thayThe, benban: chiTiet.tenBanHang?.trim() ?? '' }, [
    ...thayCoDinh,
    { mau: /\]\]\/\s+\[\[/g, thay: ']]/[[' },
  ])
  if (daDien.thieu.length) throw new LoiMauPhuLuc(`Mẫu phụ lục có biến chưa được hỗ trợ: ${daDien.thieu.join(', ')}`)
  const muc = docZip(daDien.duLieu)
  const document = muc.find(item => item.ten === TEP_NOI_DUNG)
  if (!document) throw new LoiMauPhuLuc('Mẫu phụ lục thiếu word/document.xml.')

  const { khoang: bangKhoang, xml: bangXml, dong, headerIndex } = cacDongBang(document.duLieu.toString('utf8'))
  const tong = dong.findIndex((row, index) => index > headerIndex && row.text.some(text => tenChuan(text) === 'tong cong'))
  if (tong <= headerIndex) throw new LoiMauPhuLuc('Không nhận diện được dòng Tổng cộng trong mẫu bảng kê.')
  const mauHang = dong.slice(headerIndex + 1, tong)
    .filter(row => row.cells.length === 6 && row.text.every(text => !text.trim()))
  const edits = chuanHoaHang(bangXml, mauHang, phanBo.cacDongTheoHoaDon)
  const tongRow = dong[tong]
  const totalRow = bangXml.slice(tongRow.khoang.batDau, tongRow.khoang.ketThuc)
  // Dòng tổng có ô nhãn gộp ba cột. Điền đúng hai ô tiền đứng độc lập,
  // không ghi đè nhãn, số lượng hoặc ghi chú của mẫu OnlyOffice.
  const tongHoaDon = oTaiCot(totalRow, 3, 6)
  const tongDeNghi = oTaiCot(totalRow, 4, 6)
  const totalCells = cellTrucTiepTrongHang(totalRow)
  const totalEdit = [
    { khoang: totalCells[tongHoaDon], text: DINH_DANG_TIEN.format(phanBo.tongHoaDon) },
    { khoang: totalCells[tongDeNghi], text: DINH_DANG_TIEN.format(phanBo.tongDeNghi) },
  ]
  const tongMoi = thayNhieu(totalRow, totalEdit.map(({ khoang, text }) => ({
    khoang, text: dienCell(totalRow.slice(khoang.batDau, khoang.ketThuc), text),
  })))
  edits.push({ khoang: tongRow.khoang, text: tongMoi })

  const table = thayNhieu(bangXml, edits)
  const source = document.duLieu.toString('utf8')
  let updated = source.slice(0, bangKhoang.batDau) + table + source.slice(bangKhoang.ketThuc)
  // Word cần đoạn kết sau bảng chữ ký; các dòng trắng thừa của mẫu có thể đẩy
  // riêng đoạn này sang một trang trắng. Chỉ thu gọn đuôi hoàn toàn trống, giữ
  // nguyên bảng chữ ký, khoảng ký và mọi nội dung/đối tượng/ngắt phần của mẫu.
  const cuoiBang = updated.lastIndexOf('</w:tbl>') + '</w:tbl>'.length
  const dauSect = updated.lastIndexOf('<w:sectPr')
  const duoi = updated.slice(cuoiBang, dauSect)
  const chiDinhDangTrong = duoi.replace(/<\/?w:(?:p|pPr|r|rPr|spacing|ind|jc|sz|szCs)(?=[\s/>])[^>]*>/g, '').trim() === ''
  if (cuoiBang >= '</w:tbl>'.length && dauSect > cuoiBang && chiDinhDangTrong) {
    const doanKet = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>'
    updated = updated.slice(0, cuoiBang) + doanKet + updated.slice(dauSect)
  }
  document.duLieu = Buffer.from(updated, 'utf8')
  return ghiZip(muc)
}
