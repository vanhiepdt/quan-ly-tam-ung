import { afterEach, expect, it, vi } from 'vitest'
import { docJwt, kyJwt, docUrl, kyUrl, docJwtTuYeuCau } from './jwt'
import { kiemTraDocx, duongDanTaiLieu } from './tai-lieu'
import { docZip, ghiZip } from '@/lib/van-ban/zip'
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: vi.fn() }))
afterEach(() => vi.unstubAllEnvs())
const secret = 'synthetic-key-only-for-unit-testing'
it('HS256 roundtrip và từ chối khóa sai', () => {
  const t = kyJwt({ key: 'document' }, secret)
  expect(docJwt(t, secret).key).toBe('document')
  expect(() => docJwt(t, 'another-key')).toThrow()
})
it('từ chối token hết hạn và chưa hiệu lực', () => {
  expect(() => docJwt(kyJwt({ exp: 1 }, secret), secret)).toThrow()
  expect(() => docJwt(kyJwt({ nbf: Date.now() }, secret), secret)).toThrow()
})
it('token URL tách miền khỏi callback và bắt buộc hết hạn', () => {
  vi.stubEnv('ONLYOFFICE_JWT_SECRET', secret)
  const t = kyUrl({ purpose: 'file' })
  expect(docUrl(t).purpose).toBe('file')
  expect(() => docJwt(t)).toThrow()
  expect(() => docUrl(kyJwt({ purpose: 'file' }))).toThrow()
})
it('đọc JWT callback từ Authorization hoặc body', () => {
  vi.stubEnv('ONLYOFFICE_JWT_SECRET', secret)
  const claims = { key: 'hc-doc', status: 2, url: 'http://onlyoffice/cache/file.docx' }
  const headerReq = new Request('http://localhost/api/onlyoffice/goi-lai', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kyJwt({ payload: claims })}` },
    body: '{}',
  })
  expect(docJwtTuYeuCau(headerReq, '{}')).toEqual(claims)
  const bodyReq = new Request('http://localhost/api/onlyoffice/goi-lai', { method: 'POST', body: JSON.stringify({ token: kyJwt(claims) }) })
  expect(docJwtTuYeuCau(bodyReq, JSON.stringify({ token: kyJwt(claims) }))).toEqual(claims)
})
it('không chấp nhận đường dẫn thay UUID', () => {
  expect(() => duongDanTaiLieu('../private')).toThrow()
})
it('DOCX phải có word/document.xml và giải nén có giới hạn thực tế', () => {
  const zip = ghiZip([{ ten: 'word/document.xml', duLieu: Buffer.alloc(1024, 65) }])
  expect(() => kiemTraDocx(zip)).not.toThrow()
  expect(() => docZip(zip, 100)).toThrow()
  expect(() => kiemTraDocx(ghiZip([{ ten: 'other', duLieu: Buffer.from('test') }]))).toThrow()
})
