import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ session: vi.fn(), begin: vi.fn(), finish: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien: mocks.session }))
vi.mock('@/lib/sao-luu/google-drive', () => ({
  batDauUyQuyenGoogleDrive: mocks.begin, hoanTatKetNoiGoogleDrive: mocks.finish,
  redirectUriGoogleDrive: () => 'https://hc.ttdt.site/api/sao-luu/google-drive/callback',
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))

import { POST, COOKIE } from './connect/route'
import { GET } from './callback/route'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ id: 'admin-id', vai_tro: 'admin' })
  mocks.begin.mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?state=abc')
  mocks.finish.mockResolvedValue('owner@example.com')
})

describe('OAuth callback chỉ cho đúng admin và đúng state', () => {
  it('từ chối bắt đầu từ nguồn khác và người không phải admin', async () => {
    expect((await POST(new NextRequest('https://hc.ttdt.site/api/sao-luu/google-drive/connect', { method: 'POST', headers: { origin: 'https://evil.example' } }))).status).toBe(403)
    mocks.session.mockResolvedValue({ id: 'viewer', vai_tro: 'chi_doc' })
    expect((await POST(new NextRequest('https://hc.ttdt.site/api/sao-luu/google-drive/connect', { method: 'POST', headers: { origin: 'https://hc.ttdt.site' } }))).status).toBe(403)
    expect(mocks.begin).not.toHaveBeenCalled()
  })

  it('khởi tạo cookie HTTP-only và chuyển sang Google', async () => {
    const result = await POST(new NextRequest('https://hc.ttdt.site/api/sao-luu/google-drive/connect', { method: 'POST', headers: { origin: 'https://hc.ttdt.site' } }))
    expect(result.status).toBe(303)
    expect(result.headers.get('location')).toContain('accounts.google.com')
    expect(result.headers.get('set-cookie')).toContain(COOKIE + '=')
    expect(result.headers.get('set-cookie')).toContain('HttpOnly')
    expect(result.headers.get('set-cookie')).toContain('Secure')
  })

  it('sai state không trao đổi code OAuth', async () => {
    const request = new NextRequest('https://hc.ttdt.site/api/sao-luu/google-drive/callback?state=wrong&code=abc', {
      headers: { cookie: `${COOKIE}=state.verifier.admin-id` },
    })
    const result = await GET(request)
    expect(result.headers.get('location')).toContain('drive=phien_het_han')
    expect(mocks.finish).not.toHaveBeenCalled()
  })

  it('đúng state và cùng admin thì kết nối, xóa cookie state', async () => {
    const request = new NextRequest('https://hc.ttdt.site/api/sao-luu/google-drive/callback?state=state&code=abc', {
      headers: { cookie: `${COOKIE}=state.verifier.admin-id` },
    })
    const result = await GET(request)
    expect(mocks.finish).toHaveBeenCalledWith('abc', 'verifier')
    expect(result.headers.get('location')).toContain('drive=da_ket_noi')
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(mocks.revalidate).toHaveBeenCalledWith('/cai-dat')
  })
})
