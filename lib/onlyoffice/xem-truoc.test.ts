import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const fs = vi.hoisted(() => ({ mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), readdir: vi.fn(), unlink: vi.fn(), stat: vi.fn() }))
vi.mock('node:fs/promises', () => fs)
import { taoBanXem, docBanXem } from './xem-truoc'
import { docJwt, docUrl, kyUrl } from './jwt'
import { GET } from '@/app/api/onlyoffice/xem-truoc/route'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ONLYOFFICE_JWT_SECRET', 'preview-test-secret-longer-than-32-chars')
  vi.stubEnv('ONLYOFFICE_PUBLIC_URL', 'http://localhost:8081')
  vi.stubEnv('ONLYOFFICE_INTERNAL_URL', 'http://localhost:8081')
  vi.stubEnv('ONLYOFFICE_APP_URL', 'http://localhost:3000')
  fs.readdir.mockResolvedValue([])
  fs.stat.mockResolvedValue({ mtimeMs: Date.now() })
  fs.readFile.mockResolvedValue(Buffer.from('draft'))
})
afterEach(() => vi.unstubAllEnvs())
it('cấu hình ký chỉ đọc không có callback, URL hạn 15 phút', async () => {
  const result = await taoBanXem(Buffer.from('draft'), 'Nháp.docx')
  expect(result.config.editorConfig.mode).toBe('view')
  expect(result.config.editorConfig).not.toHaveProperty('callbackUrl')
  expect(result.config.document.permissions.edit).toBe(false)
  expect(docJwt(result.config.token).document).toEqual(result.config.document)
  const token = new URL(result.config.document.url).searchParams.get('t')
  expect(docUrl(token).purpose).toBe('word-preview')
  expect(Number(docUrl(token).exp)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 900)
  expect(await docBanXem(token)).toEqual(Buffer.from('draft'))
  expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), Buffer.from('draft'), { flag: 'wx', mode: 0o600 })
})
it('route trả DOCX không cache', async () => {
  const result = await taoBanXem(Buffer.from('draft'), 'Nháp.docx')
  const response = await GET(new Request(result.config.document.url))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.get('content-type')).toContain('wordprocessingml')
  expect(await response.text()).toBe('draft')
})
it('không đọc tệp khi token thiếu, sai mục đích hoặc hết hạn', async () => {
  for (const token of [null, 'invalid', kyUrl({ purpose: 'file', id: '11111111-1111-4111-8111-111111111111' }), kyUrl({ purpose: 'word-preview', id: '11111111-1111-4111-8111-111111111111' }, -1)]) {
    await expect(docBanXem(token)).rejects.toThrow()
  }
  expect(fs.readFile).not.toHaveBeenCalled()
  expect((await GET(new Request('http://localhost/api/onlyoffice/xem-truoc'))).status).toBe(403)
})
it('không phục vụ tệp quá hạn dù token còn hiệu lực', async () => {
  fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 901000 })
  await expect(docBanXem(kyUrl({ purpose: 'word-preview', id: '11111111-1111-4111-8111-111111111111' }))).rejects.toThrow('hết hạn')
  expect(fs.readFile).not.toHaveBeenCalled()
})
