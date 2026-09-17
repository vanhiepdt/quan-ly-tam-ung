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
vi.mock('@/lib/validation/can-bo', () => import('../../lib/validation/can-bo'))

import { themCanBo, suaCanBo, voHieuHoaCanBo, kichHoatCanBo } from './can-bo-actions'

const actor = '7b030fce-106e-477f-9e54-bf4a01a51088'
const id = '261796ee-8132-4a13-a887-5f1e1c8e92d3'
const nguoiDung = 'd1c0f0a6-1b0c-4f0e-9a1e-2b0e6f5a7c31'
const actions = [themCanBo, suaCanBo, voHieuHoaCanBo, kichHoatCanBo]
const existingActions = [suaCanBo, voHieuHoaCanBo, kichHoatCanBo]
const ghiActions = [themCanBo, suaCanBo]

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  data.set('id', id)
  data.set('ho_ten', ' Nguyễn Văn A ')
  data.set('gioi_tinh', 'Ông')
  data.set('chuc_danh', ' Giám đốc ')
  data.set('phong', ' Phòng Hành chính tổ chức ')
  data.set('nguoi_dung_id', nguoiDung)
  // Client input must never override the authenticated audit actor.
  data.set('nguoi_sua', 'forged-actor')
  data.set('nguoi_tao', 'forged-actor')
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '') data.delete(k)
    else data.set(k, v)
  }
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
    expect(await action({}, form())).toEqual({ loi: 'Không thể lưu cán bộ.' })
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
    if (action === themCanBo) {
      expect(sql).toContain('nguoi_tao, nguoi_sua')
      expect(params).toEqual(['Nguyễn Văn A', 'Ông', 'Giám đốc', 'Phòng Hành chính tổ chức', false, nguoiDung, actor])
    } else if (action === suaCanBo) {
      expect(sql).toContain('nguoi_sua=$7 where id=$8')
      expect(params).toEqual(['Nguyễn Văn A', 'Ông', 'Giám đốc', 'Phòng Hành chính tổ chức', false, nguoiDung, actor, id])
    } else {
      expect(sql).toContain(`dang_hoat_dong=${action === kichHoatCanBo}`)
      expect(sql).toContain('nguoi_sua=$1 where id=$2')
      expect(params).toEqual([actor, id])
    }
    expect(revalidatePath.mock.calls).toEqual([['/admin'], ['/cai-dat'], ['/giao-dich']])
  })
})

describe.each(existingActions)('%s ID validation and missing rows', (action) => {
  it.each([null, '', 'not-a-uuid', "' OR 1=1 --", new Blob(['not-an-id'])])('rejects invalid ID %s before database access', async (value) => {
    const data = form()
    if (value === null) data.delete('id')
    else data.set('id', value)
    expect(await action({}, data)).toEqual({ loi: 'Mã cán bộ không hợp lệ.' })
    expect(trongTransaction).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([0, null])('does not report success when rowCount is %s', async (rowCount) => {
    query.mockResolvedValue({ rowCount, rows: [] })
    expect(await action({}, form())).toEqual({ loi: 'Không tìm thấy cán bộ.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe.each(ghiActions)('%s field validation', (action) => {
  it('rejects a blank name before writing', async () => {
    expect(await action({}, form({ ho_ten: ' ' }))).toEqual({ loi: 'Họ tên không được để trống' })
    expect(trongTransaction).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // Lãnh đạo không thuộc phòng nào, nên tích lãnh đạo mà còn phòng là dữ liệu in ra giấy sai.
  it('rejects a leader that still belongs to a department', async () => {
    const data = form({ la_lanh_dao: 'on' })
    expect(await action({}, data)).toEqual({ loi: 'Lãnh đạo không thuộc phòng nào, hãy để trống phòng.' })
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('clears the department and accepts a leader when the field is left blank', async () => {
    const data = form({ la_lanh_dao: 'on', phong: '' })
    expect(await action({}, data)).toEqual({ thanhCong: expect.any(String) })
    const [, params] = query.mock.calls[0]
    expect(params).toContain(true)
    expect(params).toContain(null)
  })

  it('treats an unchecked leader box as a regular staff member', async () => {
    const data = form({ la_lanh_dao: '' })
    expect(await action({}, data)).toEqual({ thanhCong: expect.any(String) })
    expect(query.mock.calls[0][1]).toContain(false)
  })

  it('rejects an unknown gender before writing', async () => {
    expect(await action({}, form({ gioi_tinh: 'Khác' }))).toEqual({ loi: 'Giới tính chỉ có Ông hoặc Bà.' })
    expect(query).not.toHaveBeenCalled()
  })

  it('rejects a malformed linked account before writing', async () => {
    expect(await action({}, form({ nguoi_dung_id: 'khong-phai-uuid' }))).toEqual({ loi: 'Tài khoản đăng nhập không hợp lệ.' })
    expect(query).not.toHaveBeenCalled()
  })

  it('accepts a blank gender and a blank linked account as no value', async () => {
    const data = form({ gioi_tinh: '', nguoi_dung_id: '' })
    expect(await action({}, data)).toEqual({ thanhCong: expect.any(String) })
    const [, params] = query.mock.calls[0]
    expect(params).toContain(null)
  })

  // Một tài khoản đăng nhập chỉ gắn được với một cán bộ, nếu không thì phòng của người đề
  // nghị không xác định được.
  it('explains a duplicate linked account without exposing the database error', async () => {
    query.mockRejectedValue({ code: '23505', detail: 'private record' })
    expect(await action({}, form())).toEqual({ loi: 'Tài khoản đăng nhập này đã gắn với một cán bộ khác.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('explains a linked account that no longer exists', async () => {
    query.mockRejectedValue({ code: '23503', detail: 'private record' })
    expect(await action({}, form())).toEqual({ loi: 'Tài khoản đăng nhập không tồn tại.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('handles non-object database failures safely', async () => {
    query.mockRejectedValue(null)
    expect(await action({}, form())).toEqual({ loi: 'Không thể lưu cán bộ.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})

it.each([0, null])('does not report a successful creation without an inserted row (%s)', async (rowCount) => {
  query.mockResolvedValue({ rowCount, rows: [] })
  expect(await themCanBo({}, form())).toEqual({ loi: 'Không thể lưu cán bộ.' })
  expect(revalidatePath).not.toHaveBeenCalled()
})
