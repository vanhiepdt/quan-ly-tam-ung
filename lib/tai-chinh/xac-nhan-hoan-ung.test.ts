import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), role: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: mocks.role }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: mocks.transaction }))
vi.mock('@/lib/validation/giao-dich', async () => import('../validation/giao-dich'))
vi.mock('@/lib/tai-chinh/xac-nhan-hoan-ung', async () => import('./xac-nhan-hoan-ung'))
import { themGiaoDich, xoaMemGiaoDich } from '../../app/giao-dich/actions'

const actor = '11111111-1111-4111-8111-111111111111'
const donVi = '22222222-2222-4222-8222-222222222222'
const TEN_DON_VI = 'Phòng Kế hoạch'
const dong = (overrides: Record<string, unknown> = {}) => ({
  id: 'funding', ngay: '2026-01-01', so_thu_tu: 1, tao_luc: '2026-01-01T00:00:00Z',
  noi_dung: 'Tạm ứng', ky_hieu_hd: null, so_hd: null, loai_hd: null,
  trang_thai_hd: 'Không có', hinh_thuc: 'Tạm ứng thêm', tong_tien: '0', tien_ruou_bia: '0',
  tam_ung_tu_cq: '100', giao_tien_chi_thuy: '0', hoan_ung_tien_mat: '0',
  nguoi_lay_hd_id: null, phi_lay_hd_ghi_de: null, trang_thai_tt_phi: 'Không phát sinh', ghi_chu: null,
  ...overrides,
})
const form = (overrides: Record<string, string> = {}) => {
  const f = new FormData()
  Object.entries({ ngay: '2026-01-02', noi_dung: 'Chi tiếp khách', hinh_thuc: 'Hoàn tạm ứng',
    don_vi_id: donVi, trang_thai_hd: 'Hợp lệ', tong_tien: '160', tien_ruou_bia: '10', ...overrides,
  }).forEach(([key, value]) => f.set(key, value))
  return f
}
let ledger: ReturnType<typeof dong>[]
let sequence: number
const inserts = () => mocks.query.mock.calls.filter(([sql]) => sql.startsWith('insert into'))

beforeEach(() => {
  vi.clearAllMocks()
  ledger = [dong()]
  sequence = 1
  mocks.role.mockResolvedValue({ id: actor })
  mocks.transaction.mockImplementation(async (_id, callback) => callback({ query: mocks.query }))
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.startsWith('insert into giao_dich')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333' }] }
    if (sql.includes('max(so_thu_tu)')) return { rows: [{ so_thu_tu: sequence }] }
    if (sql.startsWith('select * from giao_dich')) return { rows: ledger.filter(g => String(g.ngay) <= String(params[0])) }
    // Tra tên đơn vị để máy chủ sinh nội dung "Tiếp <đơn vị>".
    if (sql.includes('from don_vi')) return { rows: [{ ten: TEN_DON_VI }] }
    return { rows: [] }
  })
})

describe('server reimbursement confirmation', () => {
  it('warns without inserting or revalidating, ignores client balance and prior action state', async () => {
    const result = await themGiaoDich({ thanhCong: 'untrusted' }, form({ du_ly_thuyet: '999999' }))
    expect(result.canhBao).toMatchObject({ duLyThuyet: 100, hoanTamUng: 150, thieu: 50 })
    expect(result.canhBao?.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(inserts()).toHaveLength(0)
    expect(mocks.revalidate).not.toHaveBeenCalled()
    expect(mocks.role).toHaveBeenCalledWith('admin', 'nhap_lieu')
    expect(mocks.transaction).toHaveBeenCalledWith(actor, expect.any(Function))
    expect(mocks.query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock($1, $2)', [20260916, 1]])
  })

  it('inserts only after explicit confirmation with the matching fingerprint', async () => {
    const first = await themGiaoDich({}, form())
    const f = form({ fingerprint_hoan_tam_ung: first.canhBao!.fingerprint })
    expect((await themGiaoDich(first, f)).canhBao).toBeDefined()
    expect(inserts()).toHaveLength(0)
    f.set('xac_nhan_hoan_tam_ung', '1')
    expect((await themGiaoDich({}, f)).thanhCong).toBeDefined()
    expect(inserts()).toHaveLength(1)
    // người tạo/người sửa là hai tham số cuối của câu insert, dùng vị trí cuối để
    // không phải sửa lại chỉ số mỗi khi thêm cột mới vào giao_dich.
    expect(inserts()[0][1].at(-1)).toBe(actor)
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard')
  })

  it.each(['balance', 'candidate', 'sequence'])('requires a new confirmation after %s changes', async change => {
    const first = await themGiaoDich({}, form())
    const f = form({ xac_nhan_hoan_tam_ung: '1', fingerprint_hoan_tam_ung: first.canhBao!.fingerprint })
    if (change === 'balance') ledger[0].tam_ung_tu_cq = '80'
    if (change === 'candidate') f.set('ghi_chu', 'Nội dung thay đổi')
    if (change === 'sequence') sequence = 2
    const next = await themGiaoDich({}, f)
    expect(next.canhBao).toBeDefined()
    expect(next.canhBao!.fingerprint).not.toBe(first.canhBao!.fingerprint)
    expect(inserts()).toHaveLength(0)
    f.set('fingerprint_hoan_tam_ung', next.canhBao!.fingerprint)
    expect((await themGiaoDich({}, f)).thanhCong).toBeDefined()
  })

  it('uses preceding same-day rows but not later funding for backdated entries', async () => {
    ledger = [dong({ ngay: '2026-01-02', tam_ung_tu_cq: '40' }), dong({ id: 'future', ngay: '2026-02-01', tam_ung_tu_cq: '9999' })]
    sequence = 2
    expect((await themGiaoDich({}, form())).canhBao).toMatchObject({ duLyThuyet: 40, hoanTamUng: 150, thieu: 110 })
    expect(inserts()).toHaveLength(0)
  })

  it('compares the balance before the candidate, not including its own funding', async () => {
    expect((await themGiaoDich({}, form({ tam_ung_tu_cq: '500' }))).canhBao?.duLyThuyet).toBe(100)
    expect(inserts()).toHaveLength(0)
  })

  it.each<Record<string, string>>([
    { tong_tien: '110' },
    { trang_thai_hd: 'Chờ HĐ' },
    { trang_thai_hd: '' },
    { hinh_thuc: 'Cơ quan trả thẳng' },
    { tong_tien: '10', tien_ruou_bia: '10' },
  ])('does not warn when no excess reimbursable amount: %o', async overrides => {
    expect((await themGiaoDich({}, form(overrides))).thanhCong).toBeDefined()
    expect(inserts()).toHaveLength(1)
  })

  it('rechecks and saves without warning when fresh balance now covers reimbursement', async () => {
    const first = await themGiaoDich({}, form())
    ledger[0].tam_ung_tu_cq = '500'
    expect((await themGiaoDich({}, form({ xac_nhan_hoan_tam_ung: '1', fingerprint_hoan_tam_ung: first.canhBao!.fingerprint }))).thanhCong).toBeDefined()
  })

  it('stores the chosen unit and derives the description from its name', async () => {
    // Số dư đủ lớn để không phát sinh cảnh báo hoàn tạm ứng, nhờ vậy lệnh ghi chạy thẳng.
    ledger = [dong({ tam_ung_tu_cq: '500' })]
    await themGiaoDich({}, form({ noi_dung: 'Nội dung client tự gửi' }))
    const values = inserts()[0][1]
    // Nội dung do máy chủ sinh, không lấy từ client, để nhật ký không lệch tên đơn vị.
    expect(values[2]).toBe(`Tiếp ${TEN_DON_VI}`)
    expect(values[3]).toBe(donVi)
  })

  it('preserves null/default fields and drops the unit on internal cash rows', async () => {
    await themGiaoDich({}, form({ hinh_thuc: 'Tạm ứng thêm', trang_thai_hd: '', don_vi_id: '', noi_dung: 'Tạm ứng tháng 1' }))
    const values = inserts()[0][1]
    expect(values[2]).toBe('Tạm ứng tháng 1')
    expect(values[3]).toBeNull()
    expect(values[4]).toBeNull()
    expect(values[7]).toBe('Không có')
    expect(values[15]).toBeNull()
    expect(values[16]).toBe('Không phát sinh')
  })

  it('uses the same financial lock for soft delete and retains actor auditing', async () => {
    await xoaMemGiaoDich('transaction-id')
    expect(mocks.query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock($1, $2)', [20260916, 1]])
    expect(mocks.query.mock.calls[1][1]).toEqual([actor, 'transaction-id'])
  })

  it('rejects unauthorized writes before starting a transaction', async () => {
    mocks.role.mockRejectedValueOnce(new Error('Không đủ quyền'))
    await expect(themGiaoDich({}, form())).rejects.toThrow('Không đủ quyền')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('warns for an empty ledger and correctly includes prior cash refunds and reimbursements', async () => {
    ledger = []
    expect((await themGiaoDich({}, form())).canhBao).toMatchObject({ duLyThuyet: 0, thieu: 150 })
    ledger = [dong(), dong({ id: 'refund', tam_ung_tu_cq: '0', hoan_ung_tien_mat: '20' }),
      dong({ id: 'expense', tam_ung_tu_cq: '0', hinh_thuc: 'Hoàn tạm ứng', trang_thai_hd: 'Hợp lệ', tong_tien: '100', tien_ruou_bia: '10' })]
    expect((await themGiaoDich({}, form())).canhBao).toMatchObject({ duLyThuyet: -10, thieu: 160 })
    expect(inserts()).toHaveLength(0)
  })

  it('does not permit a fake or cross-user confirmation fingerprint', async () => {
    const first = await themGiaoDich({}, form())
    expect((await themGiaoDich({}, form({ xac_nhan_hoan_tam_ung: '1', fingerprint_hoan_tam_ung: 'fake' }))).canhBao).toBeDefined()
    mocks.role.mockResolvedValue({ id: 'other-user' })
    expect((await themGiaoDich({}, form({ xac_nhan_hoan_tam_ung: '1', fingerprint_hoan_tam_ung: first.canhBao!.fingerprint }))).canhBao?.fingerprint).not.toBe(first.canhBao!.fingerprint)
    expect(inserts()).toHaveLength(0)
  })

  it('rejects unsafe monetary amounts before touching the ledger', async () => {
    expect((await themGiaoDich({}, form({ tong_tien: '9007199254740992' }))).loi).toBeDefined()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('returns validation errors without touching the ledger', async () => {
    expect((await themGiaoDich({}, form({ tien_ruou_bia: '999' }))).loi).toBeDefined()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
