import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  mime: vi.fn(),
  cauHinh: vi.fn(),
  doc: vi.fn(),
  aiCauHinh: vi.fn(),
}))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: m.auth }))
vi.mock('@/lib/tep/kiem-tra', () => ({ loaiTepThat: m.mime }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ docCauHinhGiay: m.cauHinh }))
vi.mock('@/lib/kiem-tra/doc-hoa-don', () => ({ docHoaDonHaiLop: m.doc }))
vi.mock('@/lib/kiem-tra/cau-hinh-ai', () => ({ docCauHinhAi: m.aiCauHinh }))

import { docHoaDon, tinhTrangAiHoaDon } from './doc-hoa-don-actions'

function form(tep: File) {
  const data = new FormData()
  data.set('tep', tep)
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ id: 'actor', vai_tro: 'nhap_lieu' })
  m.mime.mockResolvedValue('application/pdf')
  m.cauHinh.mockResolvedValue({
    mstDonVi: '0100100100', tenDonVi: 'Trung tâm Đào tạo',
    tenMuaHangDonVi: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội', diaChiDonVi: '',
  })
  m.doc.mockResolvedValue({
    trangThai: 'hop_le', deXuat: { soHd: '1', tongTien: 1000 }, qr: { soHd: '1' }, ai: null, phatHien: [],
  })
  m.aiCauHinh.mockResolvedValue({
    dangHoatDong: true, nhaCungCap: 'deepseek', moHinh: 'deepseek-chat',
    khoaApi: 'sk-ds-bi-mat', urlCoSo: '',
  })
})

describe('docHoaDon', () => {
  it('từ chối khi không đủ quyền, không đọc tệp', async () => {
    m.auth.mockRejectedValue(new Error('Bạn không có quyền thực hiện thao tác này.'))
    await expect(docHoaDon(new FormData())).rejects.toThrow('quyền')
    expect(m.doc).not.toHaveBeenCalled()
  })

  it('từ chối khi không có tệp hoặc quá 10 MB', async () => {
    expect(await docHoaDon(new FormData())).toEqual({ loi: 'Hãy chọn tệp hóa đơn PDF hoặc ảnh.' })
    const lon = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.pdf', { type: 'application/pdf' })
    expect(await docHoaDon(form(lon))).toEqual({ loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' })
    expect(m.doc).not.toHaveBeenCalled()
  })

  it('từ chối XML và loại tệp giả', async () => {
    m.mime.mockResolvedValue('application/xml')
    const xml = new File([new Uint8Array([0x3c])], 'a.xml', { type: 'application/xml' })
    expect(await docHoaDon(form(xml))).toEqual({ loi: 'Chỉ nhận PDF hoặc ảnh JPEG/PNG/WEBP.' })
    m.mime.mockResolvedValue(null)
    expect(await docHoaDon(form(new File([new Uint8Array([1, 2, 3])], 'a.pdf')))).toEqual({
      loi: 'Chỉ nhận PDF hoặc ảnh JPEG/PNG/WEBP.',
    })
    expect(m.doc).not.toHaveBeenCalled()
  })

  it('gọi hai lớp với MST đơn vị, không ghi database', async () => {
    const tep = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'hd.pdf', { type: 'application/pdf' })
    const kq = await docHoaDon(form(tep))
    expect(m.auth).toHaveBeenCalledWith('admin', 'nhap_lieu')
    expect(m.doc).toHaveBeenCalledTimes(1)
    expect(m.doc.mock.calls[0][1]).toBe('application/pdf')
    expect(m.doc.mock.calls[0][2]).toEqual({
      mst: '0100100100', ten: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội', diaChi: '',
    })
    expect(kq).toMatchObject({ trangThai: 'hop_le', deXuat: { soHd: '1', tongTien: 1000 } })
    expect(kq.loi).toBeUndefined()
  })

  it('tình trạng AI trước khi quét: không lộ khóa, cảnh báo DeepSeek', async () => {
    const kq = await tinhTrangAiHoaDon()
    expect(m.auth).toHaveBeenCalledWith('admin', 'nhap_lieu')
    expect(kq).toMatchObject({ muc: 'canh_bao', nha: 'DeepSeek', moHinh: 'deepseek-chat', docAnh: false })
    expect(kq.thongDiep).toMatch(/không đọc được ảnh/i)
    expect(JSON.stringify(kq)).not.toContain('sk-ds-bi-mat')
  })

  it('tình trạng AI từ chối khi không đủ quyền', async () => {
    m.auth.mockRejectedValue(new Error('Bạn không có quyền thực hiện thao tác này.'))
    await expect(tinhTrangAiHoaDon()).rejects.toThrow('quyền')
    expect(m.aiCauHinh).not.toHaveBeenCalled()
  })

  it('chưa điền tên mua hàng thì đối chiếu bằng tên in giấy, không đổi giấy', async () => {
    m.cauHinh.mockResolvedValue({
      mstDonVi: '0100695387066', tenDonVi: 'Trung tâm Đào tạo', tenMuaHangDonVi: '',
      diaChiDonVi: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
    })
    const tep = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'hd.pdf', { type: 'application/pdf' })
    await docHoaDon(form(tep))
    expect(m.doc.mock.calls[0][2]).toEqual({
      mst: '0100695387066', ten: 'Trung tâm Đào tạo',
      diaChi: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
    })
  })
})
