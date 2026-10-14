import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ChiTietHoaDon } from '@/lib/kiem-tra/giao-dien'
import { coPhuLucThanhToan, LoiMauPhuLuc, taoPhuLucDocx } from './phu-luc'
import { docZip, ghiZip } from '@/lib/van-ban/zip'
import { TEP_NOI_DUNG } from '@/lib/van-ban/docx'
import { CAU_HINH_GIAY_MAC_DINH, dungGiay, LOAI_GIAY, type DuLieuGiay } from './giay'
import { HINH_THUC } from './kieu'

const mau = readFileSync(fileURLToPath(new URL('../../Mau/tiep khach va thanh toan.docx', import.meta.url)))

const gd: DuLieuGiay = {
  ngay: '2026-10-12', ngayDeNghi: '2026-10-10', hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  hinhThucThanhToan: null, tamUngTuCq: 0, tongTien: 6_933_260, tienRuouBia: 2_264_640,
  tienDuocThanhToan: 4_668_000, lamTronXuongHangNghin: true, donViTen: 'Phòng A',
  nguoiLayHdId: null, kyHieuHd: '1C26MBC', soHd: '00020110', taiKhoanNhanGhiDe: null,
  chiTietHoaDon: null,
}
const thayThe: Record<string, string> = {
  ...dungGiay(LOAI_GIAY.THANH_TOAN, gd, {
    nguoiDeNghi: { id: 'cb', hoTen: 'Nguyễn Văn A', gioiTinh: null, chucDanh: null, phong: 'Phòng A', laLanhDao: false, dangHoatDong: true },
    canBo: [], cauHinh: CAU_HINH_GIAY_MAC_DINH, taiKhoanTheoNguoiLayHd: {},
  }).thayThe,
  sotientt: '4.668.000', sotienttbangchu: 'Bốn triệu sáu trăm sáu mươi tám nghìn đồng',
}

const chiTiet: ChiTietHoaDon = {
  tenBanHang: 'Nhà hàng Buffet Mẫu',
  loaiHd: 'gtgt', cotTienHang: 'truoc_thue', tongTien: 6_933_260,
  dongHang: [
    { ten: 'Suất Buffet 565', soLuong: 10, donGia: 565_000, thanhTien: 5_650_000, tienThue: 452_000 },
    { ten: 'Suất Buffet 279', soLuong: 2, donGia: 279_000, thanhTien: 558_000, tienThue: 44_640 },
    { ten: 'Coca', soLuong: 5, donGia: 29_000, thanhTien: 145_000, tienThue: 14_500 },
    { ten: 'Nước Khoáng Alba', soLuong: 2, donGia: 29_000, thanhTien: 58_000, tienThue: 4_640 },
    { ten: 'Khăn Lạnh', soLuong: 2, donGia: 3_000, thanhTien: 6_000, tienThue: 480 },
  ],
}

function giaiXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, '&')
}

function dongBang(tep: Buffer): string[][] {
  const xml = docZip(tep).find(item => item.ten === TEP_NOI_DUNG)?.duLieu.toString('utf8')
  if (!xml) throw new Error('Mẫu thiếu word/document.xml')
  const bang = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)]
    .find(match => match[0].includes('Các khoản đề nghị thanh toán'))?.[0]
  if (!bang) throw new Error('Mẫu thiếu bảng chi tiết')
  return [...bang.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map(([, row]) =>
    [...row.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(([, cell]) =>
      [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(([, text]) => giaiXml(text)).join('').normalize('NFC')))
}

describe('phụ lục bảng kê DOCX', () => {
  it('chỉ bật khi có snapshot hợp lệ và tiền không được thanh toán lớn hơn 0', () => {
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 2_264_640 })).toBe(true)
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 0 })).toBe(false)
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 2_264_639 })).toBe(false)
    expect(coPhuLucThanhToan({ chiTietHoaDon: null, tienRuouBia: 2_264_640 })).toBe(false)
  })

  it('điền hai nhóm, đủ bảy cột, tổng hóa đơn và tên người đề nghị theo đúng mẫu', () => {
    const rows = dongBang(taoPhuLucDocx(mau, chiTiet, thayThe))
    expect(rows[0]).toEqual([
      'STT', 'Nội dung', 'Số lượng', 'Đơn giá', 'Tiền thuếGTGT(nếu có)',
      'Thành tiền(Bao gồm thuế GTGT)', 'Ghi chú',
    ])

    const buffetVuot = rows.find(row => row[1] === 'Suất Buffet 565' && row[6] === 'Định mức 390.000đ/suất')
    expect(buffetVuot).toEqual(['1', 'Suất Buffet 565', '10', '390.000', '', '3.900.000', 'Định mức 390.000đ/suất'])
    const buffetKhongDeNghi = rows.find(row => row[1] === 'Suất Buffet 565' && row[6] === 'Phần vượt định mức buffet')
    expect(buffetKhongDeNghi).toEqual(['5', 'Suất Buffet 565', '10', '175.000', '', '2.202.000', 'Phần vượt định mức buffet'])
    expect(rows.find(row => row[1] === 'Suất Buffet 279')).toEqual([
      '2', 'Suất Buffet 279', '2', '279.000', '44.640', '602.640', '',
    ])
    expect(rows.find(row => row[1] === 'Coca')).toEqual(['3', 'Coca', '5', '29.000', '14.500', '159.500', ''])
    expect(rows.find(row => row[1] === 'Khăn Lạnh')).toEqual(['4', 'Khăn Lạnh', '2', '3.000', '480', '6.480', ''])
    expect(rows.find(row => row[1] === 'Nước Khoáng Alba')).toEqual([
      '6', 'Nước Khoáng Alba', '2', '29.000', '4.640', '62.640', 'Ngoài định mức buffet',
    ])
    expect(rows.find(row => row.includes('TỔNG CỘNG HÓA ĐƠN'))?.[2]).toBe('6.933.260')
    expect(rows.find(row => row.includes('Các khoản đề nghị thanh toán'))?.[2]).toBe('4.668.620')
    expect(rows.find(row => row.includes('Các khoản không đề nghị thanh toán'))?.[2]).toBe('2.264.640')

    const xml = docZip(taoPhuLucDocx(mau, chiTiet, thayThe))
      .find(item => item.ten === TEP_NOI_DUNG)!.duLieu.toString('utf8')
    expect(xml).toContain('Nguyễn Văn A')
    expect(xml).toContain('Nhà hàng Buffet Mẫu')
    expect(xml).not.toContain('[[')
  })

  it('để trống cột thuế và tách tiền buffet theo giá sau thuế trên hóa đơn bán hàng', () => {
    const banHang: ChiTietHoaDon = {
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
      dongHang: [{ ten: 'Suất buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 }],
    }
    const rows = dongBang(taoPhuLucDocx(mau, banHang, { ...thayThe, nguoidntk: 'Người đề nghị', sotientt: '390.000' }))
    expect(rows.find(row => row[1] === 'Suất buffet 450' && row[6] === 'Định mức 390.000đ/suất'))
      .toEqual(['1', 'Suất buffet 450', '1', '390.000', '', '390.000', 'Định mức 390.000đ/suất'])
    expect(rows.find(row => row[1] === 'Suất buffet 450' && row[6] === 'Phần vượt định mức buffet'))
      .toEqual(['2', 'Suất buffet 450', '1', '60.000', '', '60.000', 'Phần vượt định mức buffet'])
    expect(rows.find(row => row.includes('TỔNG CỘNG HÓA ĐƠN'))?.[2]).toBe('450.000')
  })
})

function noiDung(tep: Buffer): string {
  return docZip(tep).find(item => item.ten === TEP_NOI_DUNG)!.duLieu.toString('utf8')
}

it('điền toàn bộ biến ngày, mã/số hóa đơn, bên bán, số tiền và bằng chữ theo giấy thanh toán', () => {
  const xml = noiDung(taoPhuLucDocx(mau, chiTiet, thayThe))
  const text = giaiXml(xml.replace(/<[^>]+>/g, ''))
  expect(xml).not.toContain('[[')
  for (const key of ['nguoidntk', 'ngaydntk', 'thangdntk', 'namdntk', 'ngaytk', 'thangtk', 'namtk', 'mahoadon', 'sohoadon', 'sotientt', 'sotienttbangchu'] as const) {
    expect(text).toContain(thayThe[key])
  }
  expect(text).toContain(chiTiet.tenBanHang)
  // Số tiền dùng giá trị truyền từ luồng cũ (4.668.000), không tự đổi thành 4.668.620.
  expect(text).toContain('Tổng số tiền đề nghị thanh toán: 4.668.000 đồng')
  // Tổng I vẫn là tổng chưa làm tròn của đúng các dòng hàng sau thuế.
  expect(text).toContain('Các khoản đề nghị thanh toán4.668.620')
})

it('bên bán thiếu thì để trống, không dùng tên người đề nghị hoặc đơn vị tiếp khách', () => {
  const xml = noiDung(taoPhuLucDocx(mau, { ...chiTiet, tenBanHang: undefined }, { ...thayThe, benban: 'Không dùng tên này' }))
  expect(xml).not.toContain('[[')
  expect(xml).not.toContain('Không dùng tên này')
  expect(xml).not.toContain(chiTiet.tenBanHang)
})

it('thay được bên bán bị tách nhiều run trong Word và escape ký tự XML', () => {
  const muc = docZip(mau)
  const doc = muc.find(item => item.ten === TEP_NOI_DUNG)!
  doc.duLieu = Buffer.from(doc.duLieu.toString().replace('[[benban]]', '[[ben</w:t></w:r><w:r><w:t>ban]]'))
  const xml = noiDung(taoPhuLucDocx(ghiZip(muc), { ...chiTiet, tenBanHang: 'Nhà hàng A & B <CN>' }, thayThe))
  expect(xml).toContain('Nhà hàng A &amp; B &lt;CN&gt;')
  expect(xml).not.toContain('[[')
})

it('không trả tệp còn biến lạ chưa được hỗ trợ trong mẫu', () => {
  const muc = docZip(mau)
  const doc = muc.find(item => item.ten === TEP_NOI_DUNG)!
  doc.duLieu = Buffer.from(doc.duLieu.toString().replace('</w:body>', '<w:p><w:r><w:t>[[bien_chua_ho_tro]]</w:t></w:r></w:p></w:body>'))
  expect(() => taoPhuLucDocx(ghiZip(muc), chiTiet, thayThe)).toThrow('bien_chua_ho_tro')
})

it('ngày không bị cách trước năm và đoạn trắng sau chữ ký không tạo thêm trang', () => {
  const xml = noiDung(taoPhuLucDocx(mau, chiTiet, thayThe))
  const text = giaiXml(xml.replace(/<[^>]+>/g, ''))
  expect(text).toContain('10/10/2026')
  expect(text).toContain('12/10/2026')
  const duoi = xml.slice(xml.lastIndexOf('</w:tbl>') + 8, xml.lastIndexOf('<w:sectPr'))
  expect(duoi).toContain('</w:p>')
})
it('giữ nguyên ghi chú, đối tượng và ngắt trang chủ động đặt sau bảng chữ ký', () => {
  const muc = docZip(mau)
  const doc = muc.find(item => item.ten === TEP_NOI_DUNG)!
  doc.duLieu = Buffer.from(doc.duLieu.toString().replace('<w:sectPr', '<w:p><w:r><w:br w:type="page"/><w:t>Ghi chú cuối phụ lục</w:t></w:r></w:p><w:sectPr'))
  const xml = noiDung(taoPhuLucDocx(ghiZip(muc), chiTiet, thayThe))
  expect(xml).toContain('Ghi chú cuối phụ lục')
  expect(xml).toContain('<w:br w:type="page"/>')
})

function dongTongDaGop(tep: Buffer): { nhan: string; thanhTien: string; soO: number; span: number } {
  const xml = noiDung(tep)
  const bang = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)]
    .find(match => match[0].includes('Các khoản đề nghị thanh toán'))?.[0] ?? ''
  const tong = [...bang.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].find(([row]) => row.includes('TỔNG CỘNG HÓA ĐƠN'))?.[0] ?? ''
  const cells = [...tong.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(m => m[0])
  const text = (cell: string) => giaiXml([...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join(''))
  return { nhan: text(cells[1] ?? ''), thanhTien: text(cells[2] ?? ''), soO: cells.length,
    span: Number(/<w:gridSpan\s+w:val="(\d+)"/.exec(cells[1] ?? '')?.[1]) }
}

it('mẫu gộp có dòng tổng cộng gộp ô: điền đúng ô tiền, giữ nguyên ô nhãn', () => {
  const docx = taoPhuLucDocx(mau, chiTiet, thayThe)
  expect(dongTongDaGop(docx)).toEqual({ nhan: 'TỔNG CỘNG HÓA ĐƠN', thanhTien: '6.933.260', soO: 4, span: 4 })
  expect(noiDung(docx)).not.toContain('[[')
})

it('không ghi tiền vào ô nhãn nếu mẫu tổng cộng gộp qua cột Thành tiền', () => {
  const files = docZip(mau)
  const document = files.find(x => x.ten === TEP_NOI_DUNG)!
  document.duLieu = Buffer.from(document.duLieu.toString().replace(/(<w:tr[^>]*>[\s\S]*?TỔNG CỘNG HÓA ĐƠN[\s\S]*?<w:gridSpan w:val=")4("\/>)|(<w:gridSpan w:val=")4("\/>)/, (_all, before, after, before2, after2) => before ? `${before}5${after}` : `${before2}5${after2}`))
  expect(() => taoPhuLucDocx(ghiZip(files), chiTiet, thayThe)).toThrow(LoiMauPhuLuc)
})
