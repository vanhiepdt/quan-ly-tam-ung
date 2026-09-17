import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { query, batBuocVaiTro, trongTransaction, revalidatePath } = vi.hoisted(() => ({
  query: vi.fn(),
  batBuocVaiTro: vi.fn(),
  trongTransaction: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/db/pool', () => ({ trongTransaction }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/validation/don-vi', () => import('../../lib/validation/don-vi'))

import { themDonVi, suaDonVi, voHieuHoaDonVi, kichHoatDonVi } from './don-vi-actions'

const actor = '7b030fce-106e-477f-9e54-bf4a01a51088'
const id = '261796ee-8132-4a13-a887-5f1e1c8e92d3'
const actions = [themDonVi, suaDonVi, voHieuHoaDonVi, kichHoatDonVi]
const existingActions = [suaDonVi, voHieuHoaDonVi, kichHoatDonVi]

function form() {
  const data = new FormData()
  data.set('id', id)
  data.set('ten', ' Đơn vị A ')
  data.set('ghi_chu', ' Ghi chú ')
  // Client input must never override the authenticated audit actor.
  data.set('nguoi_sua', 'forged-actor')
  data.set('nguoi_tao', 'forged-actor')
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  batBuocVaiTro.mockResolvedValue({ id: actor, vai_tro: 'admin' })
  query.mockResolvedValue({ rowCount: 1, rows: [] })
  trongTransaction.mockImplementation(async (_actor, callback) => callback({ query }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe.each(actions)('%s', (action) => {
  it.each(['/dang-nhap', '/403'])('preserves role guard redirect to %s without writes', async (destination) => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${destination};307;` })
    batBuocVaiTro.mockRejectedValue(redirect)
    await expect(action({}, new FormData())).rejects.toBe(redirect)
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin')
    expect(trongTransaction).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each(['query', 'transaction'])('returns a safe error on %s failure without logging or revalidation', async (source) => {
    const error = Object.assign(new Error('secret database connection string'), { detail: 'private record' })
    if (source === 'query') query.mockRejectedValue(error)
    else trongTransaction.mockRejectedValue(error)
    expect(await action({}, form())).toEqual({ loi: 'Không thể lưu đơn vị.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('only revalidates after a successful write and uses the authenticated audit actor', async () => {
    query.mockImplementation(async () => {
      expect(revalidatePath).not.toHaveBeenCalled()
      return { rowCount: 1, rows: [] }
    })
    expect(await action({}, form())).toEqual({ thanhCong: expect.any(String) })
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin')
    expect(trongTransaction).toHaveBeenCalledExactlyOnceWith(actor, expect.any(Function))
    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0]
    if (action === themDonVi) {
      expect(sql).toContain('nguoi_tao, nguoi_sua')
      expect(params).toEqual(['Đơn vị A', 'Ghi chú', actor])
    } else if (action === suaDonVi) {
      expect(sql).toContain('nguoi_sua=$3 where id=$4')
      expect(params).toEqual(['Đơn vị A', 'Ghi chú', actor, id])
    } else {
      expect(sql).toContain(`dang_hoat_dong=${action === kichHoatDonVi}`)
      expect(sql).toContain('nguoi_sua=$1 where id=$2')
      expect(params).toEqual([actor, id])
    }
    expect(revalidatePath.mock.calls).toEqual([['/admin'], ['/giao-dich']])
  })
})

describe.each(existingActions)('%s ID validation and missing rows', (action) => {
  it.each([null, '', 'not-a-uuid', "' OR 1=1 --", new Blob(['not-an-id'])])('rejects invalid ID %s before database access', async (value) => {
    const data = form()
    if (value === null) data.delete('id')
    else data.set('id', value)
    expect(await action({}, data)).toEqual({ loi: 'Mã đơn vị không hợp lệ.' })
    expect(trongTransaction).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([0, null])('does not report success when rowCount is %s', async (rowCount) => {
    query.mockResolvedValue({ rowCount, rows: [] })
    expect(await action({}, form())).toEqual({ loi: 'Không tìm thấy đơn vị.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe.each([themDonVi, suaDonVi])('%s name validation and errors', (action) => {
  it('retains the duplicate name message without exposing or logging the database error', async () => {
    query.mockRejectedValue({ code: '23505', detail: 'private record' })
    expect(await action({}, form())).toEqual({ loi: 'Tên đơn vị đã tồn tại.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('handles non-object database failures safely', async () => {
    query.mockRejectedValue(null)
    expect(await action({}, form())).toEqual({ loi: 'Không thể lưu đơn vị.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('rejects invalid names before writing', async () => {
    const data = form()
    data.set('ten', ' ')
    expect(await action({}, data)).toEqual({ loi: 'Tên đơn vị không được để trống' })
    expect(trongTransaction).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

it.each([0, null])('does not report a successful creation without an inserted row (%s)', async (rowCount) => {
  query.mockResolvedValue({ rowCount, rows: [] })
  expect(await themDonVi({}, form())).toEqual({ loi: 'Không thể lưu đơn vị.' })
  expect(revalidatePath).not.toHaveBeenCalled()
})
