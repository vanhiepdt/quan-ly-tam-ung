import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { CAU_HINH_GIAY_MAC_DINH } from '@/lib/tai-chinh/giay'
import { docZip } from '@/lib/van-ban/zip'
const m = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), preview: vi.fn(), context: vi.fn(), template: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: m.auth }))
vi.mock('@/lib/db/pool', () => ({ db: { query: m.query } }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: m.context }))
vi.mock('@/lib/onlyoffice/tai-lieu', () => ({ docMau: m.template, taoHoacLayTaiLieu: m.create }))
vi.mock('@/lib/onlyoffice/xem-truoc', () => ({ taoBanXem: m.preview }))
import { xemGiayNhap } from './xem-giay-actions'
const form = () => {
  const f = new FormData()
  for (const [k, v] of Object.entries({ ngay: '2026-09-17', noi_dung: 'Bản nháp', hinh_thuc: 'Tạm ứng thêm', tam_ung_tu_cq: '250000' })) f.set(k, v)
  return f
}
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ id: 'actor', ho_ten: 'Test', doi_mat_khau: false })
  m.context.mockResolvedValue({ nguoiDeNghi: { id: 'cb', hoTen: 'Test', phong: 'Phòng Kế toán' }, canBo: [], cauHinh: CAU_HINH_GIAY_MAC_DINH, taiKhoanTheoNguoiLayHd: {} })
  m.template.mockImplementation((name: string) => readFile(path.resolve('Mau', name)))
  m.preview.mockResolvedValue({ script: 'script', config: {} })
  m.query.mockResolvedValue({ rows: [{ ten: 'Đơn vị kiểm thử' }] })
})
it('dựng DOCX thật từ dữ liệu nhập, không tạo tài liệu hay ghi giao dịch', async () => {
  expect((await xemGiayNhap(form(), 'tam_ung')).viewer).toBeDefined()
  expect(m.auth).toHaveBeenCalledWith('admin', 'nhap_lieu')
  const xml = docZip(m.preview.mock.calls[0][0]).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
  expect(xml.replace(/<[^>]*>/g, '')).toContain('250.000')
  expect(m.query).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})
it('xem giấy thanh toán dùng đơn vị từ DB bằng SELECT', async () => {
  const f = form(); f.set('hinh_thuc', 'Cơ quan trả thẳng'); f.set('don_vi_id', '11111111-1111-4111-8111-111111111111'); f.set('tong_tien', '300000')
  expect((await xemGiayNhap(f, 'thanh_toan')).viewer).toBeDefined()
  expect(m.query).toHaveBeenCalledTimes(1)
  expect(m.query.mock.calls[0][0]).toMatch(/^select /)
  expect(m.create).not.toHaveBeenCalled()
})
it('không mở riêng giấy tiếp khách khi mẫu đã là một Word gộp', async () => {
  const f = form(); f.set('hinh_thuc', 'Cơ quan trả thẳng'); f.set('don_vi_id', '11111111-1111-4111-8111-111111111111'); f.set('tong_tien', '300000')
  expect((await xemGiayNhap(f, 'tiep_khach')).loi).toContain('không phù hợp')
  expect(m.template).not.toHaveBeenCalled()
})
it('từ chối dữ liệu sai và loại giấy không phù hợp trước khi dựng', async () => {
  expect((await xemGiayNhap(form(), 'thanh_toan')).loi).toBeDefined()
  const f = form(); f.set('tam_ung_tu_cq', '-1')
  expect((await xemGiayNhap(f, 'tam_ung')).loi).toBeDefined()
  expect(m.preview).not.toHaveBeenCalled()
})
it('không có quyền không được đọc mẫu', async () => {
  m.auth.mockRejectedValue(new Error('Không có quyền'))
  await expect(xemGiayNhap(form(), 'tam_ung')).rejects.toThrow('Không có quyền')
  expect(m.template).not.toHaveBeenCalled()
})
it('lỗi dựng bản nháp báo chưa lưu, không tạo tài liệu', async () => {
  m.preview.mockRejectedValue(new Error('OnlyOffice configuration missing'))
  expect((await xemGiayNhap(form(), 'tam_ung')).loi).toContain('chưa được lưu')
  expect(m.create).not.toHaveBeenCalled()
})

const chiTiet = {
  tenBanHang: 'Nhà hàng xem trước', loaiHd: 'ban_hang', cotTienHang: 'sau_thue',
  dongHang: [{ ten: 'Suất Buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 }],
}
function formPhuLuc() {
  const f = form()
  for (const [k, v] of Object.entries({
    hinh_thuc: 'Cơ quan trả thẳng', don_vi_id: '11111111-1111-4111-8111-111111111111',
    tong_tien: '450000', tien_ruou_bia: '60000', ky_hieu_hd: '1C26MBC', so_hd: '00020110',
    chi_tiet_hoa_don: JSON.stringify(chiTiet),
  })) f.set(k, v)
  return f
}
it('xem một Word gộp gồm tiếp khách, thanh toán và phụ lục trước khi lưu', async () => {
  expect((await xemGiayNhap(formPhuLuc(), 'thanh_toan')).viewer).toBeDefined()
  expect(m.template).toHaveBeenCalledWith('tiep khach va thanh toan.docx')
  expect(m.preview.mock.calls[0][1]).toContain('Giấy đề nghị thanh toán')
  const xml = docZip(m.preview.mock.calls[0][0]).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
  for (const value of ['GIẤY ĐỀ NGHỊ TIẾP KHÁCH', 'GIẤY ĐỀ NGHỊ THANH TOÁN', 'PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN', 'Nhà hàng xem trước', '390.000', '60.000', '1C26MBC', '00020110', 'Test']) expect(xml).toContain(value)
  expect(xml).not.toContain('[[')
  expect(m.create).not.toHaveBeenCalled()
  expect(m.query.mock.calls.every(([sql]) => sql.startsWith('select '))).toBe(true)
})
it('dựng giấy theo tiền không thanh toán tính từ chi tiết hóa đơn', async () => {
  const f = formPhuLuc(); f.set('tien_ruou_bia', '0')
  const result = await xemGiayNhap(f, 'thanh_toan')
  expect(result.viewer).toBeDefined()
  const xml = docZip(m.preview.mock.calls[0][0]).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
  expect(xml).toContain('PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN')
  expect(xml).toContain('60.000')
})
it.each(['cu', 'bang_khong'])('vẫn xem một Word nhưng bỏ trang phụ lục khi không áp dụng (%s)', async truongHop => {
  const f = formPhuLuc()
  if (truongHop === 'cu') f.delete('chi_tiet_hoa_don')
  if (truongHop === 'bang_khong') {
    f.set('tien_ruou_bia', '0')
    f.set('tong_tien', '350000')
    f.set('chi_tiet_hoa_don', JSON.stringify({ ...chiTiet, dongHang: [{ ten: 'Suất Buffet 350', soLuong: 1, donGia: 350_000, thanhTien: 350_000 }] }))
  }
  const result = await xemGiayNhap(f, 'thanh_toan')
  expect(result.viewer).toBeDefined()
  const xml = docZip(m.preview.mock.calls[0][0]).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
  expect(xml).not.toContain('PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN')
  expect(xml).not.toContain('Các khoản không đề nghị thanh toán')
  expect(m.create).not.toHaveBeenCalled()
})
it('không xem giấy thanh toán cho hình thức không lập giấy', async () => {
  const f = formPhuLuc(); f.set('hinh_thuc', 'Tạm ứng thêm')
  expect((await xemGiayNhap(f, 'thanh_toan')).loi).toBeDefined()
  expect(m.preview).not.toHaveBeenCalled()
})
