import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { layPhien } from '@/lib/xac-thuc/phien'
import { timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { CAU_HINH_GIAY_MAC_DINH } from '@/lib/tai-chinh/giay'
import { HINH_THUC, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { taoHoacLayTaiLieu, moPhien, docMau, type TaiLieu } from '@/lib/onlyoffice/tai-lieu'
import { docZip } from '@/lib/van-ban/zip'
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: vi.fn() }))
vi.mock('@/lib/tai-chinh/in-giay', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/tai-chinh/in-giay')>(), timGiaoDichTinh: vi.fn(),
}))
vi.mock('@/lib/onlyoffice/tai-lieu', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/onlyoffice/tai-lieu')>(),
  taoHoacLayTaiLieu: vi.fn(), moPhien: vi.fn(), docMau: vi.fn(),
}))
vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(layPhien).mockResolvedValue(null)
})
it('dùng Host gốc thay vì URL nội bộ Next.js, vẫn yêu cầu phiên đăng nhập', async () => {
  const req = new Request('http://localhost:3101/api/onlyoffice/mo', {
    method: 'POST', headers: { host: '127.0.0.1:3101', origin: 'http://127.0.0.1:3101' }, body: '{}',
  })
  expect((await POST(req)).status).toBe(401)
  expect(layPhien).toHaveBeenCalledOnce()
})
it.each(['http://other.local:3101', 'null', '', 'http://127.0.0.1:3102'])('từ chối Origin %s trước khi đọc phiên', async origin => {
  const req = new Request('http://localhost:3101/api/onlyoffice/mo', {
    method: 'POST', headers: { host: '127.0.0.1:3101', ...(origin ? { origin } : {}) }, body: '{}',
  })
  expect((await POST(req)).status).toBe(403)
  expect(layPhien).not.toHaveBeenCalled()
})

const id = '11111111-1111-4111-8111-111111111111'
const actor = { id, ho_ten: 'Người đề nghị', ten_dang_nhap: 'test', email: null, vai_tro: 'admin' as const, doi_mat_khau: false }
const taiLieu: TaiLieu = {
  id: '22222222-2222-4222-8222-222222222222', giao_dich_id: id, loai: 'thanh_toan', ten_mau: null,
  phien_ban: 1, tep: '33333333-3333-4333-8333-333333333333', khoa: null,
}
const chiTiet = {
  tenBanHang: 'Nhà hàng trên hóa đơn', loaiHd: 'ban_hang' as const, cotTienHang: 'sau_thue' as const,
  dongHang: [{ ten: 'Suất Buffet 450', soLuong: 1, donGia: 450_000, thanhTien: 450_000 }],
}
const gd = {
  id, ngay: '2026-10-12', ngayDeNghi: '2026-10-10', hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  tongTien: 450_000, tienRuouBia: 60_000, chiTietHoaDon: chiTiet, tamUngTuCq: 0,
  kyHieuHd: '1C26MBC', soHd: '00020110', donViTen: 'Đơn vị tiếp khách khác bên bán',
} as GiaoDichTinh
const gui = (body: object = { id, loai: 'thanh_toan' }) => POST(new Request('http://localhost/api/onlyoffice/mo', {
  method: 'POST', headers: { host: 'localhost', origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}))
afterEach(() => vi.unstubAllEnvs())

describe('mở Word gộp giấy thanh toán trong OnlyOffice', () => {
  beforeEach(() => {
    vi.stubEnv('ONLYOFFICE_PUBLIC_URL', 'https://office.example.test')
    vi.stubEnv('ONLYOFFICE_INTERNAL_URL', 'http://onlyoffice')
    vi.stubEnv('ONLYOFFICE_APP_URL', 'http://app:3000')
    vi.stubEnv('ONLYOFFICE_JWT_SECRET', 'secret-only-for-unit-tests-12345678')
    vi.mocked(layPhien).mockResolvedValue(actor)
    vi.mocked(timGiaoDichTinh).mockResolvedValue(gd)
    vi.mocked(boiCanhGiay).mockResolvedValue({
      nguoiDeNghi: { id, hoTen: actor.ho_ten, phong: 'Phòng Hành chính', gioiTinh: null, chucDanh: null, laLanhDao: false, dangHoatDong: true },
      canBo: [], cauHinh: CAU_HINH_GIAY_MAC_DINH, taiKhoanTheoNguoiLayHd: {},
    })
    vi.mocked(docMau).mockImplementation(async ten => readFileSync(path.resolve('Mau', ten)))
    vi.mocked(taoHoacLayTaiLieu).mockImplementation(async (_actor, _gd, _loai, _mau, sinh) => { await sinh(); return taiLieu })
    vi.mocked(moPhien).mockImplementation(async t => ({ ...t, khoa: 'hc-phu-luc-1' }))
  })
  it('tạo một tài liệu gộp, điền hết biến và trả cấu hình soạn thảo trực tiếp', async () => {
    const res = await gui()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const data = await res.json()
    expect(data.config.document.title).toBe('Giấy đề nghị thanh toán.docx')
    expect(data.config.editorConfig.mode).toBe('edit')
    expect(data.config.editorConfig.callbackUrl).toContain('/api/onlyoffice/goi-lai?')
    expect(data.config.document.key).toBe('hc-phu-luc-1')
    expect(taoHoacLayTaiLieu).toHaveBeenCalledWith(id, id, 'thanh_toan', null, expect.any(Function))
    expect(moPhien).toHaveBeenCalledWith(taiLieu, id)
    const sinh = vi.mocked(taoHoacLayTaiLieu).mock.calls[0][4]
    const xml = docZip(await sinh()).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
    for (const value of ['GIẤY ĐỀ NGHỊ TIẾP KHÁCH', 'GIẤY ĐỀ NGHỊ THANH TOÁN', 'BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN', 'Nhà hàng trên hóa đơn', 'Người đề nghị', '1C26MBC', '00020110', '390.000', '450.000']) expect(xml).toContain(value)
    expect(xml).not.toContain('[[')
    expect(docMau).toHaveBeenCalledWith('tiep khach va thanh toan.docx')
  })
  it('mở lại bản đã sửa mà không sinh lại hoặc mất phiên bản', async () => {
    vi.mocked(taoHoacLayTaiLieu).mockResolvedValue({ ...taiLieu, phien_ban: 4 })
    const res = await gui()
    expect(res.status).toBe(200)
    expect((await res.json()).phienBan).toBe(4)
    expect(docMau).not.toHaveBeenCalled()
  })
  it.each([
    { ...gd, chiTietHoaDon: null }, { ...gd, tienRuouBia: 0 }, { ...gd, tienRuouBia: 10_000 },
  ])('mở Word gộp nhưng bỏ trang phụ lục khi không áp dụng', async giaoDich => {
    vi.mocked(timGiaoDichTinh).mockResolvedValue(giaoDich)
    expect((await gui()).status).toBe(200)
    const sinh = vi.mocked(taoHoacLayTaiLieu).mock.calls[0][4]
    const xml = docZip(await sinh()).find(e => e.ten === 'word/document.xml')!.duLieu.toString()
    expect(xml).not.toContain('BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN')
  })
  it('giữ chế độ chỉ xem với tài khoản chỉ đọc', async () => {
    vi.mocked(layPhien).mockResolvedValue({ ...actor, vai_tro: 'chi_doc' })
    const res = await gui()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.config.document.permissions.edit).toBe(false)
    expect(data.config.editorConfig.mode).toBe('view')
  })
  it('chặn mã sai và không coi loại phụ lục hoặc giấy tiếp khách là giấy chính', async () => {
    expect((await gui({ id: 'invalid', loai: 'phu-luc' })).status).toBe(400)
    expect(timGiaoDichTinh).not.toHaveBeenCalled()
    expect((await gui({ id, loai: 'phu_luc' })).status).toBe(404)
    expect((await gui({ id, loai: 'phu-luc' })).status).toBe(404)
    expect((await gui({ id, loai: 'tiep_khach' })).status).toBe(404)
    expect(taoHoacLayTaiLieu).not.toHaveBeenCalled()
  })
  it('giấy thanh toán vẫn dùng tệp mẫu và loại tài liệu cũ', async () => {
    expect((await gui({ id, loai: 'thanh_toan' })).status).toBe(200)
    expect(taoHoacLayTaiLieu).toHaveBeenCalledWith(id, id, 'thanh_toan', null, expect.any(Function))
    expect(docMau).toHaveBeenCalledWith('tiep khach va thanh toan.docx')
  })
})
