import { afterEach, expect, it, vi } from 'vitest'
import { docJwt, kyJwt, docUrl, kyUrl } from './jwt'
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
it('không chấp nhận đường dẫn thay UUID', () => {
  expect(() => duongDanTaiLieu('../private')).toThrow()
})
it('DOCX phải có word/document.xml và giải nén có giới hạn thực tế', () => {
  const zip = ghiZip([{ ten: 'word/document.xml', duLieu: Buffer.alloc(1024, 65) }])
  expect(() => kiemTraDocx(zip)).not.toThrow()
  expect(() => docZip(zip, 100)).toThrow()
  expect(() => kiemTraDocx(ghiZip([{ ten: 'other', duLieu: Buffer.from('test') }]))).toThrow()
})
