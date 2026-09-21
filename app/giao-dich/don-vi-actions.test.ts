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

import { themDonViNhanh } from './don-vi-actions'

const actor = '7b030fce-106e-477f-9e54-bf4a01a51088'
const id = '261796ee-8132-4a13-a887-5f1e1c8e92d3'

beforeEach(() => {
  vi.resetAllMocks()
  batBuocVaiTro.mockResolvedValue({ id: actor, vai_tro: 'nhap_lieu' })
  query.mockResolvedValue({ rowCount: 1, rows: [] })
  trongTransaction.mockImplementation(async (_actor: string, callback: (c: { query: typeof query }) => unknown) => callback({ query }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('themDonViNhanh', () => {
  it('cho phép nhập liệu thêm đơn vị mới', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id, ten: 'Phòng A' }] })
    expect(await themDonViNhanh(' Phòng A ')).toEqual({ id, ten: 'Phòng A', thanhCong: 'Đã thêm đơn vị.' })
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin', 'nhap_lieu')
    expect(query.mock.calls[1][0]).toMatch(/insert into don_vi/)
    expect(query.mock.calls[1][1]).toEqual(['Phòng A', actor])
    expect(revalidatePath.mock.calls).toEqual([['/giao-dich'], ['/admin']])
  })

  it('trùng tên thì lấy đơn vị có sẵn, không insert', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id, ten: 'Phòng A', dang_hoat_dong: true }] })
    expect(await themDonViNhanh('phòng a')).toEqual({ id, ten: 'Phòng A', thanhCong: 'Đã chọn đơn vị có sẵn.' })
    expect(query).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('đơn vị đã tắt thì bật lại', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id, ten: 'Phòng A', dang_hoat_dong: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
    expect(await themDonViNhanh('Phòng A')).toMatchObject({ id, ten: 'Phòng A' })
    expect(query.mock.calls[1][0]).toMatch(/dang_hoat_dong=true/)
  })

  it('từ chối tên trống trước khi ghi', async () => {
    expect(await themDonViNhanh('  ')).toEqual({ loi: 'Tên đơn vị không được để trống' })
    expect(trongTransaction).not.toHaveBeenCalled()
  })
})
