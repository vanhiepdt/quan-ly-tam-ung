import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { query, batBuocVaiTro, revalidatePath, docCauHinhAiTuDb } = vi.hoisted(() => ({
  query: vi.fn(),
  batBuocVaiTro: vi.fn(),
  revalidatePath: vi.fn(),
  docCauHinhAiTuDb: vi.fn(),
}))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/kiem-tra/cau-hinh-ai', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/kiem-tra/cau-hinh-ai')>(),
  docCauHinhAiTuDb,
}))

import { luuCauHinhAi, docDuLieuCauHinhAi, pingHelloAi, thuNghiemAi, timMoHinhAi } from './ai-actions'
import { KHOA_CAU_HINH_AI } from '@/lib/kiem-tra/cau-hinh-ai'

const actor = '7b030fce-106e-477f-9e54-bf4a01a51088'

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  data.set('dang_hoat_dong', '1')
  data.set('nha_cung_cap', 'openai')
  data.set('mo_hinh', 'gpt-4o')
  data.set('khoa_api', 'sk-moi')
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '') data.delete(k)
    else data.set(k, v)
  }
  return data
}

function giaTriLuu(): Record<string, unknown> {
  const [, params] = query.mock.calls[0]
  expect(params[0]).toBe(KHOA_CAU_HINH_AI)
  return JSON.parse(params[1])
}

beforeEach(() => {
  vi.resetAllMocks()
  batBuocVaiTro.mockResolvedValue({ id: actor, vai_tro: 'admin' })
  query.mockResolvedValue({ rowCount: 1, rows: [] })
  docCauHinhAiTuDb.mockResolvedValue({
    dangHoatDong: true, nhaCungCap: 'anthropic', moHinh: 'claude-sonnet-5',
    khoaApi: 'sk-cu', urlCoSo: '',
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('luuCauHinhAi', () => {
  it.each(['/dang-nhap', '/403'])('preserves role guard redirect to %s without writes', async (destination) => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${destination};307;` })
    batBuocVaiTro.mockRejectedValue(redirect)
    await expect(luuCauHinhAi({}, new FormData())).rejects.toBe(redirect)
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin')
    expect(query).not.toHaveBeenCalled()
  })

  it('lưu đúng model đã chọn, không đổi sang model mặc định', async () => {
    expect(await luuCauHinhAi({}, form({ mo_hinh: 'gpt-5' }))).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: gpt-5.' })
    expect(giaTriLuu()).toMatchObject({ nhaCungCap: 'openai', moHinh: 'gpt-5', khoaApi: 'sk-moi' })
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/cai-dat')
  })

  it('lưu nhà cung cấp mới kèm khóa, không lộ khóa ra kết quả', async () => {
    expect(await luuCauHinhAi({}, form())).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: gpt-4o.' })
    const giaTri = giaTriLuu()
    expect(giaTri).toEqual({
      dangHoatDong: true, nhaCungCap: 'openai', moHinh: 'gpt-4o',
      khoaApi: 'sk-moi', urlCoSo: '',
    })
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/cai-dat')
  })

  it('để trống khóa thì giữ khóa cũ khi cùng nhà, xóa khóa khi đổi nhà', async () => {
    expect(await luuCauHinhAi({}, form({ nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5', khoa_api: '' })))
      .toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: claude-sonnet-5.' })
    expect(giaTriLuu().khoaApi).toBe('sk-cu')

    query.mockClear()
    expect(await luuCauHinhAi({}, form({ khoa_api: '' }))).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: gpt-4o.' })
    expect(giaTriLuu()).toMatchObject({ nhaCungCap: 'openai', khoaApi: '' })
  })

  it('xóa khóa đã lưu khi đánh dấu xoa_khoa', async () => {
    expect(await luuCauHinhAi({}, form({
      nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5', xoa_khoa: '1', khoa_api: 'sk-bo-qua',
    }))).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: claude-sonnet-5.' })
    expect(giaTriLuu().khoaApi).toBe('')
  })

  it('lưu API ngoài sau khi cắt dấu / cuối, từ chối URL metadata', async () => {
    expect(await luuCauHinhAi({}, form({
      nha_cung_cap: 'custom', mo_hinh: 'llava', url_co_so: 'http://127.0.0.1:11434/v1/',
    }))).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: llava.' })
    expect(giaTriLuu()).toMatchObject({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://127.0.0.1:11434/v1',
    })

    query.mockClear()
    expect(await luuCauHinhAi({}, form({
      nha_cung_cap: 'custom', mo_hinh: 'x', url_co_so: 'http://169.254.169.254/latest',
    }))).toEqual({ loi: 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.' })
    expect(query).not.toHaveBeenCalled()
  })

  it('từ chối API ngoài thiếu URL hoặc nhà không có trong catalog', async () => {
    expect(await luuCauHinhAi({}, form({ nha_cung_cap: 'custom', mo_hinh: 'llava', url_co_so: '' })))
      .toEqual({ loi: 'Hãy điền URL API ngoài.' })
    expect(await luuCauHinhAi({}, form({ nha_cung_cap: 'khong-co' })))
      .toEqual({ loi: expect.stringMatching(/Invalid|không hợp lệ|Invalid enum/i) })
    expect(query).not.toHaveBeenCalled()
  })

  it('tắt lớp AI vẫn lưu được', async () => {
    expect(await luuCauHinhAi({}, form({ dang_hoat_dong: '' }))).toEqual({ thanhCong: 'Đã lưu cài đặt AI. Model: gpt-4o.' })
    expect(giaTriLuu().dangHoatDong).toBe(false)
  })

  it('returns a safe error on a database failure without logging', async () => {
    query.mockRejectedValue(Object.assign(new Error('secret'), { detail: 'private' }))
    expect(await luuCauHinhAi({}, form())).toEqual({ loi: 'Không lưu được cài đặt AI. Vui lòng thử lại.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('docDuLieuCauHinhAi', () => {
  it('không đưa khóa thô ra form', async () => {
    const duLieu = await docDuLieuCauHinhAi()
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin')
    expect(duLieu).toMatchObject({
      nhaCungCap: 'anthropic', moHinh: 'claude-sonnet-5', daCoKhoaLuu: true,
    })
    expect(JSON.stringify(duLieu)).not.toContain('sk-cu')
  })

  it('từ chối người không phải admin', async () => {
    batBuocVaiTro.mockRejectedValue(new Error('Bạn không có quyền thực hiện thao tác này.'))
    await expect(docDuLieuCauHinhAi()).rejects.toThrow('quyền')
    expect(docCauHinhAiTuDb).not.toHaveBeenCalled()
  })
})

describe('thuNghiemAi / timMoHinhAi', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each(['/dang-nhap', '/403'])('preserves role guard redirect to %s without fetch', async (destination) => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${destination};307;` })
    batBuocVaiTro.mockRejectedValue(redirect)
    await expect(thuNghiemAi(form())).rejects.toBe(redirect)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dùng khóa gõ trên form, không lộ khóa, không ghi DB', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'o4-mini' }] }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      })
    const kq = await thuNghiemAi(form())
    expect(kq).toMatchObject({
      thanhCong: 'Kết nối OpenAI thành công. Có 2 model. Chat trả “ok”.',
      moHinh: ['gpt-4o', 'o4-mini'],
    })
    expect(JSON.stringify(kq)).not.toContain('sk-moi')
    expect(query).not.toHaveBeenCalled()
  })

  it('để trống khóa thì dùng khóa đã lưu cùng nhà', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ data: [{ id: 'claude-sonnet-5' }] }),
    })
    const kq = await timMoHinhAi(form({
      nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5', khoa_api: '',
    }))
    expect(kq.moHinh).toEqual(['claude-sonnet-5'])
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk-cu')
    expect(JSON.stringify(kq)).not.toContain('sk-cu')
  })

  it('đổi nhà mà không điền khóa thì không gửi khóa nhà cũ', async () => {
    const kq = await thuNghiemAi(form({ khoa_api: '' }))
    expect(kq).toMatchObject({ loi: 'Chưa có khóa OpenAI. Điền khóa, hoặc lưu rồi thử lại.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Gửi hello không gọi /models, hiện chữ trả lời, không lộ khóa', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
    })
    const kq = await pingHelloAi(form())
    expect(kq).toMatchObject({ thanhCong: 'OpenAI trả lời: “hello”.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(JSON.stringify(kq)).not.toContain('sk-moi')
    expect(query).not.toHaveBeenCalled()
  })
})
