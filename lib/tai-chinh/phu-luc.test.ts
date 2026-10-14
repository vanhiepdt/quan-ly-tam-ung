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
  const xml = noiDung(tep)
  const bang = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)]
    .find(match => match[0].includes('Thành tiền'))?.[0]
  if (!bang) throw new Error('Mẫu thiếu bảng chi tiết')
  return [...bang.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)].map(([, row]) =>
    [...row.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map(([, cell]) =>
      [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(([, text]) => giaiXml(text)).join('').normalize('NFC')))
}

describe('bảng kê chi tiết DOCX theo mẫu gộp sáu cột', () => {
  it('chỉ bật khi có snapshot hợp lệ và tiền không được thanh toán lớn hơn 0', () => {
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 2_264_640 })).toBe(true)
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 0 })).toBe(false)
    expect(coPhuLucThanhToan({ chiTietHoaDon: chiTiet, tienRuouBia: 2_264_639 })).toBe(false)
    expect(coPhuLucThanhToan({ chiTietHoaDon: null, tienRuouBia: 2_264_640 })).toBe(false)
  })

  it('giữ thứ tự hóa đơn, điền sáu cột theo tiền sau thuế và cả hai tổng', () => {
    const rows = dongBang(taoPhuLucDocx(mau, chiTiet, thayThe))
    expect(rows[0]).toEqual(['STT', 'Nội dung', 'Số lượng', 'Thành tiềntheo hóa đơn', 'Đề nghị thanh toán', 'Ghi chú'])
    expect(rows.slice(1, -1)).toEqual([
      ['1', 'Suất Buffet 565', '10', '6.102.000', '3.900.000', 'Định mức 390.000đ × 10 suất = 3.900.000đ'],
      ['2', 'Suất Buffet 279', '2', '602.640', '602.640', 'Định mức 390.000đ × 2 suất = 780.000đ'],
      ['3', 'Coca', '5', '159.500', '159.500', ''],
      ['4', 'Nước Khoáng Alba', '2', '62.640', '0', 'Ngoài định mức buffet'],
      ['5', 'Khăn Lạnh', '2', '6.480', '6.480', ''],
    ])
    expect(rows.at(-1)).toEqual(['Tổng cộng', '6.933.260', '4.668.620', ''])
    const xml = noiDung(taoPhuLucDocx(mau, chiTiet, thayThe))
    expect(xml).toContain('Nguyễn Văn A')
    expect(xml).toContain('Nhà hàng Buffet Mẫu')
    expect(xml).not.toContain('[[')
  })

  it('hóa đơn bán hàng không thuế: một dòng buffet vượt định mức, hai ô tiền riêng', () => {
    const banHang: ChiTietHoaDon = {
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
      dongHang: [{ ten: 'Suất buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 }],
    }
    const rows = dongBang(taoPhuLucDocx(mau, banHang, { ...thayThe, nguoidntk: 'Người đề nghị', sotientt: '390.000' }))
    expect(rows[1]).toEqual(['1', 'Suất buffet 450', '1', '450.000', '390.000', 'Định mức 390.000đ × 1 suất = 390.000đ'])
    expect(rows[2]).toEqual(['Tổng cộng', '450.000', '390.000', ''])
  })

  it('bia rượu không ghi chú và không được thanh toán, các món giữ đúng vị trí hóa đơn', () => {
    const rows = dongBang(taoPhuLucDocx(mau, {
      loaiHd: 'ban_hang', cotTienHang: 'sau_thue', dongHang: [
        { ten: 'Coca', soLuong: 1, thanhTien: 70_000 },
        { ten: 'Suất buffet 350', soLuong: 2, thanhTien: 700_000 },
        { ten: 'Bia Tiger', soLuong: 1, thanhTien: 50_000 },
        { ten: 'Nước suối', soLuong: 1, thanhTien: 30_000 },
      ],
    }, thayThe))
    expect(rows.slice(1, -1).map(row => [row[1], row[3], row[4], row[5]])).toEqual([
      ['Coca', '70.000', '70.000', ''],
      ['Suất buffet 350', '700.000', '700.000', 'Định mức 390.000đ × 2 suất = 780.000đ'],
      ['Bia Tiger', '50.000', '0', ''],
      ['Nước suối', '30.000', '0', 'Ngoài định mức buffet'],
    ])
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
  expect(dongBang(taoPhuLucDocx(mau, chiTiet, thayThe)).at(-1)).toEqual(['Tổng cộng', '6.933.260', '4.668.620', ''])
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

it('mẫu gộp có dòng Tổng cộng gộp ba ô: không ghi đè nhãn hoặc ô ghi chú', () => {
  const docx = taoPhuLucDocx(mau, chiTiet, thayThe)
  const rows = dongBang(docx)
  expect(rows.at(-1)).toEqual(['Tổng cộng', '6.933.260', '4.668.620', ''])
  const tong = [...noiDung(docx).matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)]
    .find(([row]) => row.includes('Tổng cộng'))?.[0] ?? ''
  expect(tong).toContain('<w:gridSpan w:val="3"')
})

it('từ chối dòng tổng cộng khi ô nhãn gộp qua cột Thành tiền hóa đơn', () => {
  const files = docZip(mau)
  const document = files.find(x => x.ten === TEP_NOI_DUNG)!
  document.duLieu = Buffer.from(document.duLieu.toString().replace('<w:gridSpan w:val="3"', '<w:gridSpan w:val="4"'))
  expect(() => taoPhuLucDocx(ghiZip(files), chiTiet, thayThe)).toThrow(LoiMauPhuLuc)
})
