import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { POST } from './route'
import { kyJwt, kyUrl } from '@/lib/onlyoffice/jwt'
import { db } from '@/lib/db/pool'
import { ghiZip } from '@/lib/van-ban/zip'
import { duongDanTaiLieu } from '@/lib/onlyoffice/tai-lieu'
vi.mock('@/lib/db/pool', () => {
  const query = vi.fn()
  return { db: { query }, trongTransaction: async (_: string, fn: (c: { query: typeof query }) => unknown) => fn({ query }) }
})
let folder = ''
const data = ghiZip([{ ten: 'word/document.xml', duLieu: Buffer.from('<w:document><w:body>TEST</w:body></w:document>') }])
const request = (status = 2, token?: string) => new Request(`http://localhost/api/onlyoffice/goi-lai?t=${kyUrl({ purpose: 'callback', key: 'test-key', id: 'test-id', user: 'test-user', edit: true })}`, {
  method: 'POST', body: JSON.stringify({ token: token ?? kyJwt({ key: 'test-key', status, url: 'http://localhost:8081/cache/file.docx' }) }),
})
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'onlyoffice-test-'))
  vi.stubEnv('UPLOAD_DIR', folder)
  vi.stubEnv('ONLYOFFICE_JWT_SECRET', 'synthetic-onlyoffice-secret-for-unit-tests')
  vi.stubEnv('ONLYOFFICE_PUBLIC_URL', 'http://localhost:8081')
  vi.stubEnv('ONLYOFFICE_INTERNAL_URL', 'http://localhost:8081')
  vi.stubEnv('ONLYOFFICE_APP_URL', 'http://localhost:3000')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(data))))
  vi.mocked(db.query).mockReset()
})
afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(folder, { recursive: true, force: true }) })
it('status 2 ghi tệp thật và đợi INSERT phiên bản trước khi xác nhận thành công', async () => {
  let release!: () => void, entered!: () => void, saved = ''
  const gate = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { entered = resolve })
  vi.mocked(db.query).mockImplementation((async (sql: string, args: unknown[]) => {
    if (sql.includes('select n.vai_tro')) return { rows: [{ vai_tro: 'admin', ten_mau: null }] }
    if (sql.includes('select t.*')) return { rows: [{ id: 'test-id', khoa: 'test-key', phien_ban: 1, da_dong: false }] }
    if (sql.includes('select sha256')) return { rows: [{ sha256: 'previous' }] }
    if (sql.includes('insert into tai_lieu_phien_ban')) { saved = String(args[2]); entered(); await gate }
    return { rows: [] }
  }) as never)
  let complete = false
  const pending = POST(request()).then(res => { complete = true; return res })
  await ready
  expect(complete).toBe(false)
  expect(await readFile(duongDanTaiLieu(saved))).toEqual(data)
  release()
  const res = await pending
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ error: 0 })
  expect(db.query).toHaveBeenCalledWith('update tai_lieu_phien set da_dong=true where khoa=$1', ['test-key'])
})
it('chữ ký sai không đọc DB hoặc tải tệp', async () => {
  expect((await POST(request(2, 'invalid'))).status).toBe(403)
  expect(db.query).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
it('lỗi lưu không trả error 0', async () => {
  vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ vai_tro: 'admin', ten_mau: null }] } as never)
  vi.mocked(db.query).mockRejectedValueOnce(new Error('synthetic failure'))
  const res = await POST(request())
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 1 })
})
