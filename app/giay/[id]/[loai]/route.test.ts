import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { layPhien } from '@/lib/xac-thuc/phien'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { CAU_HINH_GIAY_MAC_DINH } from '@/lib/tai-chinh/giay'
import { HINH_THUC, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { docZip, ghiZip } from '@/lib/van-ban/zip'
import { readFile } from 'node:fs/promises'
import { db } from '@/lib/db/pool'
vi.mock('@/lib/db/pool', () => ({ db: { query: vi.fn() } }))

vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien: vi.fn() }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: vi.fn() }))
vi.mock('@/lib/tai-chinh/in-giay', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/tai-chinh/in-giay')>(), timGiaoDichTinh: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))

const gd: GiaoDichTinh = {
  id: '11111111-1111-4111-8111-111111111111', ngay: '2026-09-20', soThuTu: 1, taoLuc: '2026-09-20T00:00:00.000Z',
  noiDung: 'Giao dịch thử', kyHieuHd: null, soHd: null, loaiHd: 'Phiếu chi CQ', trangThaiHd: 'Hợp lệ',
  hinhThuc: HINH_THUC.TAM_UNG_THEM, tongTien: 0, tienRuouBia: 0, tamUngTuCq: 1500000,
  giaoTienChiThuy: 0, hoanUngTienMat: 0, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: null,
  hinhThucThanhToan: 'tien_mat', taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0,
}
const mau = readFileSync(path.join(process.cwd(), 'Mau', 'Tam ung tien.docx'))
const goi = (loai = 'tam_ung') => GET(new Request('http://localhost/giay'), { params: Promise.resolve({ id: gd.id, loai }) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(db.query).mockResolvedValue({ rows: [] } as never)
  vi.mocked(layPhien).mockResolvedValue({ id: gd.id, ho_ten: 'Người thử', ten_dang_nhap: 'test', email: null, vai_tro: 'chi_doc', doi_mat_khau: false })
  vi.mocked(timGiaoDichTinh).mockResolvedValue(gd)
  vi.mocked(boiCanhGiay).mockResolvedValue({
    cauHinh: CAU_HINH_GIAY_MAC_DINH, canBo: [], taiKhoanTheoNguoiLayHd: {},
    nguoiDeNghi: { id: gd.id, hoTen: 'Người thử', gioiTinh: null, chucDanh: null, phong: null, laLanhDao: false, dangHoatDong: true },
  })
  vi.mocked(readFile).mockResolvedValue(mau)
})
afterEach(() => vi.restoreAllMocks())

describe('route tải giấy DOCX', () => {
  it('trả tệp Word không rỗng, đúng header và giữ các mục định dạng của mẫu thật', async () => {
    const res = await goi()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('wordprocessingml.document')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/)
    const buffer = Buffer.from(await res.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(0)
    const entries = docZip(buffer)
    expect(entries.map(m => m.ten)).toEqual(docZip(mau).map(m => m.ten))
    const xml = entries.find(m => m.ten === 'word/document.xml')!.duLieu.toString()
    expect(xml).not.toContain('[[')
    expect(xml).toContain('1.500.000')
    for (const entry of docZip(mau).filter(m => m.ten !== 'word/document.xml')) {
      expect(entries.find(m => m.ten === entry.ten)!.duLieu).toEqual(entry.duLieu)
    }
  })
  it('đọc lại mẫu ở lần tải tiếp theo, không giữ cache cũ', async () => {
    await goi()
    const changed = docZip(mau).map(m => m.ten === 'word/document.xml'
      ? { ...m, duLieu: Buffer.from(m.duLieu.toString().replace('</w:body>', '<w:p><w:r><w:t>MAU-MOI</w:t></w:r></w:p></w:body>')) } : m)
    vi.mocked(readFile).mockResolvedValue(Buffer.from(ghiZip(changed)))
    const res = await goi()
    const xml = docZip(Buffer.from(await res.arrayBuffer())).find(m => m.ten === 'word/document.xml')!.duLieu.toString()
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(xml).toContain('MAU-MOI')
  })
  it('từ chối người chưa đăng nhập trước khi đọc dữ liệu hoặc tệp', async () => {
    vi.mocked(layPhien).mockResolvedValue(null)
    expect((await goi()).status).toBe(401)
    expect(timGiaoDichTinh).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
  })
  it('từ chối loại giấy không thuộc giao dịch', async () => {
    expect((await goi('thanh_toan')).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })
  it('không trả DOCX khi giao dịch không tồn tại', async () => {
    vi.mocked(timGiaoDichTinh).mockResolvedValue(null)
    expect((await goi()).status).toBe(404)
  })
})
