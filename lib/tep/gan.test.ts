import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  luu: vi.fn(),
  xoa: vi.fn(),
  transaction: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }))
vi.mock('@/lib/db/pool', () => ({ trongTransaction: m.transaction }))
vi.mock('./luu', () => ({ kiemTraVaLuuTep: m.luu, xoaTepVatLy: m.xoa }))

import { ganTepVaoGiaoDich } from './gan'

const tep = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'hd.pdf', { type: 'application/pdf' })
const ok = {
  ok: true as const, loai: 'hoa_don' as const, tuongDoi: 'gd/a.pdf',
  tenGoc: 'hd.pdf', kichThuoc: 5, mime: 'application/pdf',
}

describe('gắn tệp vào giao dịch', () => {
  const client = { query: vi.fn() }
  beforeEach(() => {
    vi.resetAllMocks()
    m.transaction.mockImplementation(async (_: string, fn: (c: typeof client) => unknown) => fn(client))
    m.luu.mockResolvedValue(ok)
    client.query.mockImplementation(async (sql: string) => ({ rowCount: sql.includes('select 1') ? 1 : 1, rows: [] }))
  })

  it('từ chối trước khi ghi database khi kiểm tra tệp thất bại', async () => {
    m.luu.mockResolvedValue({ ok: false, loi: 'Tệp phải lớn hơn 0 và không quá 10 MB.' })
    expect(await ganTepVaoGiaoDich('u', 'gd', tep, 'hoa_don')).toMatch(/10 MB/)
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it('xóa file vật lý nếu giao dịch không còn', async () => {
    client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    expect(await ganTepVaoGiaoDich('u', 'gd', tep, 'hoa_don')).toBe('Giao dịch không tồn tại.')
    expect(m.xoa).toHaveBeenCalledWith('gd/a.pdf')
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it('ghi tep_dinh_kem rồi làm mới trang hồ sơ', async () => {
    expect(await ganTepVaoGiaoDich('u', 'gd-id', tep, 'hoa_don')).toBeUndefined()
    const insert = client.query.mock.calls.find(c => String(c[0]).includes('insert into tep_dinh_kem'))
    expect(insert?.[1]).toEqual(['gd-id', 'hoa_don', 'gd/a.pdf', 'hd.pdf', 5, 'application/pdf', 'u'])
    expect(m.revalidate).toHaveBeenCalledWith('/tep')
    expect(m.revalidate).toHaveBeenCalledWith('/tep/gd-id')
    expect(m.xoa).not.toHaveBeenCalled()
  })
})
