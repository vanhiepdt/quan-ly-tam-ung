import { createHmac, timingSafeEqual } from 'node:crypto'

export function biMat() {
  const secret = process.env.ONLYOFFICE_JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('Chưa cấu hình khóa OnlyOffice (ít nhất 32 ký tự).')
  return secret
}
export function kyJwt(payload: Record<string, unknown>, secret = biMat()) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`
}
export function docJwt(token: unknown, secret = biMat()): Record<string, unknown> {
  if (typeof token !== 'string' || token.length > 65536) throw new Error('Token không hợp lệ')
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('Token không hợp lệ')
  const [header, body, signature] = parts
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw new Error('Sai chữ ký')
  if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256') throw new Error('Sai thuật toán')
  const data = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Sai payload')
  const now = Math.floor(Date.now() / 1000)
  if (data.exp !== undefined && (!Number.isFinite(data.exp) || data.exp <= now)) throw new Error('Token hết hạn')
  if (data.nbf !== undefined && (!Number.isFinite(data.nbf) || data.nbf > now)) throw new Error('Token chưa hiệu lực')
  return data
}
// Khóa tách miền: token trình duyệt/callback không thể dùng thay token URL của ứng dụng.
export function kyUrl(payload: Record<string, unknown>, seconds = 900) {
  return kyJwt({ ...payload, exp: Math.floor(Date.now() / 1000) + seconds }, `${biMat()}:file-url`)
}
export function docUrl(token: unknown) {
  const data = docJwt(token, `${biMat()}:file-url`)
  if (typeof data.exp !== 'number') throw new Error('Thiếu hạn token')
  return data
}
