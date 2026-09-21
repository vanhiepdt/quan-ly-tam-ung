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
it.each(['tiep_khach', 'thanh_toan'])('xem %s dùng đơn vị từ DB bằng SELECT', async loai => {
  const f = form(); f.set('hinh_thuc', 'Cơ quan trả thẳng'); f.set('don_vi_id', '11111111-1111-4111-8111-111111111111'); f.set('tong_tien', '300000')
  expect((await xemGiayNhap(f, loai)).viewer).toBeDefined()
  expect(m.query).toHaveBeenCalledTimes(1)
  expect(m.query.mock.calls[0][0]).toMatch(/^select /)
  expect(m.create).not.toHaveBeenCalled()
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
