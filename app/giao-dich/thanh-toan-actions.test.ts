import { beforeEach, describe, expect, it, vi } from 'vitest'
const { query, phien } = vi.hoisted(() => ({ query: vi.fn(), phien: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('../../lib/xac-thuc/phien', () => ({ layPhien: phien }))
vi.mock('@/lib/xac-thuc/bao-ve', () => import('../../lib/xac-thuc/bao-ve'))
vi.mock('@/lib/tai-chinh/du-lieu', () => import('../../lib/tai-chinh/du-lieu'))
vi.mock('@/lib/tai-chinh/tinh-toan', () => import('../../lib/tai-chinh/tinh-toan'))
vi.mock('@/lib/qr/vietqr', () => import('../../lib/qr/vietqr'))
import { layQrThanhToan } from './thanh-toan-actions'
const id = '12345678-1234-4234-8234-123456789abc'
function row(extra: Record<string, unknown> = {}) {
  return { id, ngay: '2026-09-16', so_thu_tu: 1, tao_luc: '2026-09-16T00:00:00Z', noi_dung: 'Test', ky_hieu_hd: null, so_hd: '0000123', loai_hd: null,
    trang_thai_hd: 'Hợp lệ', hinh_thuc: 'Hoàn tạm ứng', tong_tien: '1000000', tien_ruou_bia: '0', tam_ung_tu_cq: '0', giao_tien_chi_thuy: '0', hoan_ung_tien_mat: '0',
    nguoi_lay_hd_id: id, phi_lay_hd_ghi_de: null, trang_thai_tt_phi: 'Chưa thanh toán', ghi_chu: null,
    ngan_hang_bin: '970436', so_tai_khoan: '00123456789', ten_chu_tk: 'NGUYEN VAN A', nguoi_hoat_dong: true, ty_le_phi: '0.12', ty_le_chung: 0.15, da_xoa: false, ...extra }
}
describe('payment QR server action (mock database; no writes)', () => {
  beforeEach(() => { query.mockReset(); phien.mockReset(); phien.mockResolvedValue({ id, vai_tro: 'nhap_lieu' }); query.mockResolvedValue({ rows: [row()] }) })
  it.each([null, { id, vai_tro: 'chi_doc' }])('enforces server authorization before parsing or querying', async session => {
    phien.mockResolvedValue(session)
    expect((await layQrThanhToan(id)).loi).toContain('quyền'); expect(query).not.toHaveBeenCalled()
  })
  it.each([null, {}, '', "' OR 1=1", 123, ['id']])('rejects malformed ids %j before querying', async value => {
    expect((await layQrThanhToan(value)).loi).toContain('Mã giao dịch'); expect(query).not.toHaveBeenCalled()
  })
  it.each(['admin', 'nhap_lieu'])('derives current canonical fee for %s without any write', async vai_tro => {
    phien.mockResolvedValue({ id, vai_tro })
    const result = await layQrThanhToan(id)
    expect(result.duLieu?.soTien).toBe(120000)
    expect(result.duLieu?.noiDung).toBe('TT HD 0000123 20260916')
    expect(result.duLieu?.payload).toContain('5406120000')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toMatch(/^select /)
    expect(query.mock.calls[0][0]).toContain('not g.da_xoa')
    expect(query.mock.calls[0][1]).toEqual([id])
  })
  it.each([0, -100, '9007199254740992', 1.5])('blocks zero, negative, unsafe or fractional fee %s', async phi_lay_hd_ghi_de => {
    query.mockResolvedValue({ rows: [row({ phi_lay_hd_ghi_de })] }); expect((await layQrThanhToan(id)).duLieu).toBeUndefined()
  })
  it('uses current general rate when person rate is unset and rejects derived zero', async () => {
    query.mockResolvedValue({ rows: [row({ ty_le_phi: null, ty_le_chung: 0.2 })] })
    expect((await layQrThanhToan(id)).duLieu?.soTien).toBe(200000)
    query.mockResolvedValue({ rows: [row({ tong_tien: '0' })] })
    expect((await layQrThanhToan(id)).loi).toContain('nguyên dương')
  })
  it('uses newly changed fee/payee, never client or old list values', async () => {
    expect((await layQrThanhToan(id)).duLieu?.soTien).toBe(120000)
    query.mockResolvedValue({ rows: [row({ phi_lay_hd_ghi_de: '321000', so_tai_khoan: '000999', ten_chu_tk: 'NEW RECIPIENT' })] })
    expect((await layQrThanhToan(id)).duLieu).toEqual(expect.objectContaining({ soTien: 321000, soTaiKhoan: '000999', tenChuTk: 'NEW RECIPIENT' }))
  })
  it.each([{ trang_thai_tt_phi: 'Đã thanh toán' }, { trang_thai_tt_phi: 'Không phát sinh' }, { da_xoa: true }, { ten_chu_tk: '' }, { nguoi_hoat_dong: false }, { ngan_hang_bin: 'abc' }, { so_hd: '' }, { so_hd: '12345678901' }])('rejects no-longer-payable row %j', async changes => {
    query.mockResolvedValue({ rows: [row(changes)] }); expect((await layQrThanhToan(id)).loi).toBeTruthy()
  })
  it('rejects deleted or missing row', async () => { query.mockResolvedValue({ rows: [] }); expect((await layQrThanhToan(id)).loi).toContain('xóa') })
  it('does not leak database or session errors', async () => {
    query.mockRejectedValue(new Error('secret')); expect(JSON.stringify(await layQrThanhToan(id))).not.toContain('secret')
    phien.mockRejectedValue(new Error('secret')); expect(JSON.stringify(await layQrThanhToan(id))).not.toContain('secret')
  })
})
