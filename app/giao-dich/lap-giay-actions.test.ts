import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), create: vi.fn(), find: vi.fn(), papers: vi.fn(), warning: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: m.transaction }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: vi.fn(async () => ({ id: 'actor', ho_ten: 'Test' })) }))
vi.mock('@/lib/tai-chinh/in-giay', () => ({ timGiaoDichTinh: m.find, giayCuaGiaoDich: m.papers, MAU_WORD: { tam_ung: 'Tam ung tien.docx' } }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: vi.fn(async () => ({})) }))
vi.mock('@/lib/onlyoffice/tai-lieu', () => ({ taoHoacLayTaiLieu: m.create, docMau: vi.fn() }))
vi.mock('@/lib/tai-chinh/xac-nhan-hoan-ung', () => ({ khoaSoTaiChinh: vi.fn(), kiemTraHoanTamUng: m.warning }))
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
  m.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('max(so_thu_tu)') ? [{ so_thu_tu: 1 }] : sql.startsWith('insert into giao_dich') ? [{ id: 'gd-id' }] : [] }))
  m.find.mockResolvedValue({})
  m.papers.mockReturnValue([{ loai: 'tam_ung', thayThe: {}, thayCoDinh: [] }])
  m.create.mockResolvedValue({ id: 'doc-id' })
})
it('không chọn thì chỉ thêm giao dịch, không tạo giấy hay savepoint', async () => {
  expect(await themGiaoDich({}, form(false))).toMatchObject({ giaoDichId: 'gd-id', thanhCong: 'Đã thêm giao dịch.' })
  expect(m.create).not.toHaveBeenCalled()
  expect(m.query.mock.calls.some(c => c[0].includes('savepoint'))).toBe(false)
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
