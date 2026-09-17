import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from './route'
import { layPhien } from '@/lib/xac-thuc/phien'
vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(layPhien).mockResolvedValue(null)
})
it('dùng Host gốc thay vì URL nội bộ Next.js, vẫn yêu cầu phiên đăng nhập', async () => {
  const req = new Request('http://localhost:3101/api/onlyoffice/mo', {
    method: 'POST', headers: { host: '127.0.0.1:3101', origin: 'http://127.0.0.1:3101' }, body: '{}',
  })
  expect((await POST(req)).status).toBe(401)
  expect(layPhien).toHaveBeenCalledOnce()
})
it.each(['http://other.local:3101', 'null', '', 'http://127.0.0.1:3102'])('từ chối Origin %s trước khi đọc phiên', async origin => {
  const req = new Request('http://localhost:3101/api/onlyoffice/mo', {
    method: 'POST', headers: { host: '127.0.0.1:3101', ...(origin ? { origin } : {}) }, body: '{}',
  })
  expect((await POST(req)).status).toBe(403)
  expect(layPhien).not.toHaveBeenCalled()
})
