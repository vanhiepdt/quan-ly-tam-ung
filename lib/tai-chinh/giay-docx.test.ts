import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { CAU_HINH_GIAY_MAC_DINH, dungGiay, LOAI_GIAY, type DuLieuGiay } from './giay'
import { taoGiayDocx } from './giay-docx'
import { HINH_THUC } from './kieu'
import { docZip } from '@/lib/van-ban/zip'

const mau = readFileSync(fileURLToPath(new URL('../../Mau/tiep khach va thanh toan.docx', import.meta.url)))
const chiTiet = {
  tenBanHang: 'Nhà hàng A', loaiHd: 'ban_hang' as const, cotTienHang: 'sau_thue' as const,
  dongHang: [
    { ten: 'Suất Buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 },
    { ten: 'Bia Tiger', soLuong: 1, donGia: 50_000, thanhTien: 50_000 },
  ],
}
const giaoDich: DuLieuGiay = {
  ngay: '2026-10-12', ngayDeNghi: '2026-10-10', hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  hinhThucThanhToan: null, tamUngTuCq: 0, tongTien: 500_000, tienRuouBia: 110_000,
  tienDuocThanhToan: 390_000, lamTronXuongHangNghin: false,
  donViTen: 'Phòng A', nguoiLayHdId: null, kyHieuHd: '1C26MBC', soHd: '00020110',
  taiKhoanNhanGhiDe: null, chiTietHoaDon: chiTiet,
}
const ctx = {
  nguoiDeNghi: { id: 'cb', hoTen: 'Người đề nghị', gioiTinh: null, chucDanh: null, phong: 'Phòng Hành chính', laLanhDao: false, dangHoatDong: true },
  canBo: [], cauHinh: CAU_HINH_GIAY_MAC_DINH, taiKhoanTheoNguoiLayHd: {},
}
function xml(doc: Buffer): string { return docZip(doc).find(e => e.ten === 'word/document.xml')!.duLieu.toString('utf8') }
function cells(row: string): string[] {
  return [...row.matchAll(/<w:tc(?=[\s>])[^>]*>[\s\S]*?<\/w:tc>/g)].map(c =>
    [...c[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t => t[1]).join(''))
}
function rowOf(table: string, name: string): string[] {
  const row = [...table.matchAll(/<w:tr(?=[\s>])[^>]*>[\s\S]*?<\/w:tr>/g)]
    .find(r => cells(r[0]).some(text => text === name))
  if (!row) throw new Error(`Không có hàng ${name}`)
  return cells(row[0])
}

it('một Word điền giấy tiếp khách, thanh toán và phụ lục; tổng I, II ở cột Thành tiền', () => {
  const giay = dungGiay(LOAI_GIAY.THANH_TOAN, giaoDich, ctx)
  const contents = xml(taoGiayDocx(mau, giay, giaoDich))
  for (const title of ['GIẤY ĐỀ NGHỊ TIẾP KHÁCH', 'GIẤY ĐỀ NGHỊ THANH TOÁN', 'PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN']) expect(contents).toContain(title)
  expect(contents).toContain('Nhà hàng A')
  expect(contents).not.toContain('[[')
  const bang = [...contents.matchAll(/<w:tbl(?=[\s>])[^>]*>[\s\S]*?<\/w:tbl>/g)]
    .find(t => t[0].includes('Các khoản không đề nghị thanh toán'))![0]
  expect(rowOf(bang, 'Các khoản đề nghị thanh toán')[2]).toBe('390.000')
  expect(rowOf(bang, 'Các khoản không đề nghị thanh toán')[2]).toBe('110.000')
  expect(rowOf(bang, 'TỔNG CỘNG HÓA ĐƠN')[2]).toBe('500.000')
  expect(rowOf(bang, 'Bia Tiger')).toEqual(['3', 'Bia Tiger', '1', '50.000', '', '50.000', ''])
})

it('không phát sinh tiền không thanh toán thì xóa hẳn trang phụ lục và ngắt trang của nó', () => {
  const gd = { ...giaoDich, tienRuouBia: 0, chiTietHoaDon: null }
  const contents = xml(taoGiayDocx(mau, dungGiay(LOAI_GIAY.THANH_TOAN, gd, ctx), gd))
  expect(contents).toContain('GIẤY ĐỀ NGHỊ TIẾP KHÁCH')
  expect(contents).toContain('GIẤY ĐỀ NGHỊ THANH TOÁN')
  expect(contents).not.toContain('PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN')
  expect(contents).not.toContain('Các khoản không đề nghị thanh toán')
  expect(contents.match(/w:type="page"/g)).toHaveLength(1)
  expect(contents).not.toContain('[[')
})
