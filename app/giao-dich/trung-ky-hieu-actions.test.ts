import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { query, batBuocVaiTro } = vi.hoisted(() => ({
  query: vi.fn(),
  batBuocVaiTro: vi.fn(),
}))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro }))

import { kiemTraTrungKyHieu } from './trung-ky-hieu-actions'

beforeEach(() => {
  vi.resetAllMocks()
  batBuocVaiTro.mockResolvedValue({ id: 'actor', vai_tro: 'nhap_lieu' })
  query.mockResolvedValue({ rows: [] })
})
afterEach(() => vi.restoreAllMocks())

describe('kiemTraTrungKyHieu', () => {
  it('từ chối khi không đủ quyền, không đọc database', async () => {
    batBuocVaiTro.mockRejectedValue(new Error('Bạn không có quyền thực hiện thao tác này.'))
    await expect(kiemTraTrungKyHieu('1C26MTT')).rejects.toThrow('quyền')
    expect(query).not.toHaveBeenCalled()
  })

  it('chuỗi trống thì không hỏi database', async () => {
    expect(await kiemTraTrungKyHieu('   ')).toEqual({})
    expect(query).not.toHaveBeenCalled()
  })

  it('không trùng thì im lặng', async () => {
    expect(await kiemTraTrungKyHieu('1C26MTT')).toEqual({})
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin', 'nhap_lieu')
    expect(query.mock.calls[0][0]).toMatch(/not da_xoa/)
    expect(query.mock.calls[0][1]).toEqual(['1C26MTT'])
  })

  it('trùng thì cảnh báo, không chặn', async () => {
    query.mockResolvedValue({ rows: [{ ngay: '17/09/2026', so_hd: '00001656' }] })
    expect(await kiemTraTrungKyHieu(' 1c26mtt ')).toEqual({
      canhBao: 'Ký hiệu HĐ 1c26mtt đã có trên giao dịch ngày 17/09/2026, số 00001656.',
    })
  })

  it('lỗi database thì nuốt, không làm hỏng form', async () => {
    query.mockRejectedValue(new Error('secret'))
    expect(await kiemTraTrungKyHieu('1C26MTT')).toEqual({})
  })
})
