import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), create: vi.fn(), find: vi.fn(), papers: vi.fn(), warning: vi.fn(), gan: vi.fn(), context: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: m.transaction }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: vi.fn(async () => ({ id: 'actor', ho_ten: 'Test' })) }))
vi.mock('@/lib/tai-chinh/in-giay', () => ({ timGiaoDichTinh: m.find, giayCuaGiaoDich: m.papers, MAU_WORD: { tam_ung: 'Tam ung tien.docx' } }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: m.context }))
vi.mock('@/lib/onlyoffice/tai-lieu', () => ({ taoHoacLayTaiLieu: m.create, docMau: vi.fn() }))
vi.mock('@/lib/tai-chinh/xac-nhan-hoan-ung', () => ({ khoaSoTaiChinh: vi.fn(), kiemTraHoanTamUng: m.warning }))
vi.mock('@/lib/tep/gan', () => ({ ganTepVaoGiaoDich: m.gan }))
import { themGiaoDich } from './actions'
const client = { query: m.query }
const form = (lap = true, hinhThuc = 'Tạm ứng thêm') => {
  const f = new FormData()
  for (const [key, value] of Object.entries({ ngay: '2026-09-17', noi_dung: 'Test', hinh_thuc: hinhThuc, tam_ung_tu_cq: '100000' })) f.set(key, value)
  if (lap) f.set('lap_giay', '1')
  return f
}
beforeEach(() => {
  vi.resetAllMocks()
  m.transaction.mockImplementation(async (_: string, fn: (c: unknown) => unknown) => fn(client))
  m.context.mockResolvedValue({
    nguoiDeNghi: { id: 'cb-account', hoTen: 'Cán bộ tài khoản', gioiTinh: null, chucDanh: null, phong: null, laLanhDao: false, dangHoatDong: true },
    canBo: [
      { id: 'cb-default', hoTen: 'Người mặc định', gioiTinh: null, chucDanh: null, phong: null, laLanhDao: false, dangHoatDong: true },
      { id: 'cb-account', hoTen: 'Cán bộ tài khoản', gioiTinh: null, chucDanh: null, phong: null, laLanhDao: false, dangHoatDong: true },
      { id: 'cb-other', hoTen: 'Người được chọn', gioiTinh: null, chucDanh: null, phong: null, laLanhDao: false, dangHoatDong: true },
    ],
    cauHinh: { nguoiDeNghiId: 'cb-default', lanhDaoTiepKhachId: null, lanhDaoThanhToanId: null, truongPhongId: null, keToanKiemSoatId: null },
    taiKhoanTheoNguoiLayHd: {},
  })
  m.query.mockImplementation(async (sql: string, params: unknown[]) => ({ rows: sql.includes('max(so_thu_tu)') ? [{ so_thu_tu: 1 }] : sql.startsWith('insert into giao_dich') ? [{ id: 'gd-id' }] : sql.includes('from can_bo') ? (Array.isArray(params?.[0]) ? params[0].map(id => ({ id })) : []) : sql.includes('from don_vi') ? [{ ten: 'Phòng Kế hoạch' }] : [] }))
  m.find.mockResolvedValue({})
  m.papers.mockReturnValue([{ loai: 'tam_ung', thayThe: {}, thayCoDinh: [] }])
  m.create.mockResolvedValue({ id: 'doc-id' })
})
it('không chọn thì chỉ thêm giao dịch, không tạo giấy hay savepoint', async () => {
  expect(await themGiaoDich({}, form(false))).toMatchObject({ giaoDichId: 'gd-id', thanhCong: 'Đã thêm giao dịch.' })
  expect(m.create).not.toHaveBeenCalled()
  expect(m.query.mock.calls.some(c => c[0].includes('savepoint'))).toBe(false)
})
it('lưu người đề nghị mặc định trong thông tin giấy dù không bấm lập giấy', async () => {
  const result = await themGiaoDich({}, form(false))
  expect(result.giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1][17]).toBe('cb-default')
})
it('lưu người đề nghị được chọn trong thông tin giấy', async () => {
  const f = form(false)
  f.set('giay_nguoiDeNghiId', 'cb-other')
  const result = await themGiaoDich({}, f)
  expect(result.giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1][17]).toBe('cb-other')
})
it('chốt đủ năm vai trò ký khi tạo giao dịch, kể cả khi không lập Word ngay', async () => {
  const f = form(false)
  for (const vai of ['nguoiDeNghiId', 'lanhDaoTiepKhachId', 'lanhDaoThanhToanId', 'truongPhongId', 'keToanKiemSoatId']) {
    f.set(`giay_${vai}`, 'cb-other')
  }
  expect((await themGiaoDich({}, f)).giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1].slice(17, 23)).toEqual(['cb-other', 'cb-other', 'cb-other', 'cb-other', 'cb-other', true])
})
it('lưu snapshot tài khoản nhập riêng cho giao dịch chuyển khoản', async () => {
  const f = form(false, 'Cơ quan trả thẳng')
  f.set('don_vi_id', '22222222-2222-4222-8222-222222222222')
  f.set('hinh_thuc_thanh_toan', 'chuyen_khoan')
  f.set('dung_tai_khoan_mac_dinh', '0')
  f.set('tai_khoan_nhan_so', '000123')
  f.set('tai_khoan_nhan_ngan_hang', 'Ngân hàng khác')
  f.set('tai_khoan_nhan_chi_nhanh', 'Chi nhánh B')
  f.set('tai_khoan_nhan_ten_chu_tk', 'Người nhận khác')
  expect((await themGiaoDich({}, f)).giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1].slice(29, 33)).toEqual(['000123', 'Ngân hàng khác', 'Chi nhánh B', 'Người nhận khác'])
})
it('lập giấy bằng chính client transaction và trả id sau commit', async () => {
  const result = await themGiaoDich({}, form())
  expect(result).toMatchObject({ giaoDichId: 'gd-id', taiLieuIds: ['doc-id'] })
  expect(m.find).toHaveBeenCalledWith('gd-id', client)
  expect(m.create.mock.calls[0][5]).toBe(client)
  expect(m.query).toHaveBeenCalledWith('savepoint lap_giay')
  expect(m.query).toHaveBeenLastCalledWith('release savepoint lap_giay')
})
it('giấy thứ hai lỗi thì rollback toàn bộ giấy, vẫn trả giao dịch và cảnh báo', async () => {
  m.papers.mockReturnValue([{ loai: 'tiep_khach' }, { loai: 'thanh_toan' }])
  m.create.mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(new Error('disk failure'))
  const result = await themGiaoDich({}, form())
  expect(result.thanhCong).toBeDefined()
  expect(result.loiGiay).toContain('Không thêm lại')
  expect(result.taiLieuIds).toBeUndefined()
  expect(m.query).toHaveBeenCalledWith('rollback to savepoint lap_giay')
})
it('chỉ lập loại giấy được chọn', async () => {
  const f = form()
  f.set('loai_giay', 'tam_ung')
  m.papers.mockReturnValue([{ loai: 'tam_ung' }, { loai: 'thanh_toan' }])
  expect((await themGiaoDich({}, f)).taiLieuIds).toEqual(['doc-id'])
  expect(m.create).toHaveBeenCalledTimes(1)
  expect(m.create.mock.calls[0][2]).toBe('tam_ung')
})
it('từ chối loại giấy không thuộc giao dịch trước khi ghi dữ liệu', async () => {
  const f = form()
  f.set('loai_giay', 'thanh_toan')
  expect((await themGiaoDich({}, f)).loi).toContain('không phù hợp')
  expect(m.transaction).not.toHaveBeenCalled()
})
it('commit lỗi không báo thành công hoặc trả id giấy', async () => {
  m.transaction.mockImplementation(async (_: string, fn: (c: unknown) => unknown) => { await fn(client); throw new Error('commit failed') })
  expect(await themGiaoDich({}, form())).toEqual({ loi: expect.any(String) })
})
it('cảnh báo dư chưa xác nhận thì chưa insert hoặc lập giấy', async () => {
  m.warning.mockResolvedValue({ fingerprint: 'test' })
  expect((await themGiaoDich({}, form())).canhBao).toBeDefined()
  expect(m.create).not.toHaveBeenCalled()
  expect(m.query.mock.calls.some(c => c[0].startsWith('insert'))).toBe(false)
})
it('hình thức không có giấy bị từ chối nếu ép checkbox', async () => {
  expect((await themGiaoDich({}, form(true, 'Giao tiền chị Thúy'))).loi).toBeDefined()
  expect(m.transaction).not.toHaveBeenCalled()
})
it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 'Nộp hoàn CQ'] as const)('lưu nội dung đúng tên hình thức %s, bỏ nội dung client', async hinhThuc => {
  const f = form(false, hinhThuc)
  f.set('noi_dung', 'nội dung giả')
  if (hinhThuc === 'Giao tiền chị Thúy') f.set('giao_tien_chi_thuy', '100000')
  if (hinhThuc === 'Đưa tiền CQ trả thẳng cho Chị Thúy') {
    f.set('tam_ung_tu_cq', '0')
    f.set('dua_tien_cq_tra_thang_cho_chi_thuy', '100000')
  }
  if (hinhThuc === 'Nộp hoàn CQ') f.set('hoan_ung_tien_mat', '100000')
  expect((await themGiaoDich({}, f)).giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1][2]).toBe(hinhThuc)
})
it.each(['tien_mat', 'chuyen_khoan'] as const)('lưu riêng khoản CQ trả thẳng được đưa bằng %s', async hinhThucThanhToan => {
  const f = form(false, 'Đưa tiền CQ trả thẳng cho Chị Thúy')
  f.set('tam_ung_tu_cq', '0')
  f.set('dua_tien_cq_tra_thang_cho_chi_thuy', '2500000')
  f.set('hinh_thuc_thanh_toan', hinhThucThanhToan)
  expect((await themGiaoDich({}, f)).giaoDichId).toBe('gd-id')
  const insert = m.query.mock.calls.find(c => String(c[0]).startsWith('insert into giao_dich'))
  expect(insert?.[1].slice(13, 17)).toEqual([0, 0, 2_500_000, 0])
  expect(insert?.[1][28]).toBe(hinhThucThanhToan)
})
it('không gắn tệp khi form không có file hóa đơn', async () => {
  expect(await themGiaoDich({}, form(false))).toMatchObject({ giaoDichId: 'gd-id', thanhCong: 'Đã thêm giao dịch.' })
  expect(m.gan).not.toHaveBeenCalled()
})
it('lỗi giữ file hóa đơn không rollback giao dịch', async () => {
  m.gan.mockResolvedValue('Tệp phải lớn hơn 0 và không quá 10 MB.')
  const f = form(false)
  f.set('tep_hoa_don', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'hd.pdf', { type: 'application/pdf' }))
  const kq = await themGiaoDich({}, f)
  expect(kq.thanhCong).toBe('Đã thêm giao dịch.')
  expect(kq.giaoDichId).toBe('gd-id')
  expect(kq.loiTep).toMatch(/chưa giữ được file/)
  expect(m.gan).toHaveBeenCalledWith('actor', 'gd-id', expect.any(File), 'hoa_don')
})
