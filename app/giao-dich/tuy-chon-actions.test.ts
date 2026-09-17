import { beforeEach, describe, expect, it, vi } from 'vitest'

const { query, layPhien } = vi.hoisted(() => ({ query: vi.fn(), layPhien: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien }))
import { docTuyChonCot, luuTuyChonCot } from './tuy-chon-actions'

describe('account column preferences', () => {
  beforeEach(() => { query.mockReset(); layPhien.mockReset() })
  it('does not access preferences without a verified session', async () => {
    layPhien.mockResolvedValue(null)
    expect((await luuTuyChonCot({ an: [], rong: {} })).ok).toBe(false)
    expect((await docTuyChonCot()).loi).toBeTruthy()
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects invalid payloads before writing', async () => {
    layPhien.mockResolvedValue({ id: 'account-a', vai_tro: 'chi_doc' })
    expect((await luuTuyChonCot({ an: [], rong: { ngay: 601 } })).ok).toBe(false)
    expect(query).not.toHaveBeenCalled()
  })
  it('allows read-only accounts to save display settings under their session id', async () => {
    layPhien.mockResolvedValue({ id: 'account-a', vai_tro: 'chi_doc', doi_mat_khau: false })
    query.mockResolvedValue({ rows: [] })
    const prefs = { an: ['tep'], rong: { ngay: 140 } }
    expect((await luuTuyChonCot(prefs)).ok).toBe(true)
    expect(query.mock.calls[0][0]).toContain('values ($1, $2::jsonb)')
    expect(query.mock.calls[0][1]).toEqual(['account-a', JSON.stringify(prefs)])
  })
  it('scopes reads to the current account, and handles corrupt stored data', async () => {
    layPhien.mockResolvedValue({ id: 'account-b', vai_tro: 'admin' })
    query.mockResolvedValue({ rows: [{ tuy_chon: { an: [], rong: { ngay: -1 } } }] })
    expect((await docTuyChonCot()).tuyChon).toEqual(expect.objectContaining({ an: [], rong: {} }))
    expect(query.mock.calls[0][1]).toEqual(['account-b'])
  })
  it('never returns database or session exception details', async () => {
    layPhien.mockRejectedValue(new Error('secret-token-and-database-password'))
    expect(JSON.stringify(await docTuyChonCot())).not.toContain('secret-token')
    expect(JSON.stringify(await luuTuyChonCot({ an: [], rong: {} }))).not.toContain('secret-token')
    expect(query).not.toHaveBeenCalled()
  })
})
