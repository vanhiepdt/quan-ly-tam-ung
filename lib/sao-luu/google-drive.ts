import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { db } from '@/lib/db/pool'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3/files'
const OAUTH_FILE = '/etc/quan-ly-tam-ung/google-oauth-client.json'
const REDIRECT_URI = 'https://hc.ttdt.site/api/sao-luu/google-drive/callback'
const FOLDER_NAME = 'Sao lưu Quản lý tạm ứng'
const AAD = Buffer.from('sao-luu-google-drive:v1')

type ClientFile = { web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] } }
type OAuthClient = { id: string; secret: string; redirect: string }
type KetNoi = { email: string; refresh_token_ma_hoa: string; folder_id: string }

export function redirectUriGoogleDrive() {
  const uri = process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim() || REDIRECT_URI
  const url = new URL(uri)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Google Drive cần địa chỉ callback HTTPS.')
  return uri
}

function khoaMaHoa(): Buffer {
  const value = process.env.GOOGLE_DRIVE_TOKEN_KEY?.trim() || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('Chưa cấu hình khóa mã hóa Google Drive trên VPS.')
  const key = Buffer.from(value, 'base64url')
  if (key.length !== 32) throw new Error('Khóa mã hóa Google Drive không hợp lệ.')
  return key
}

export function maHoaRefreshToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', khoaMaHoa(), iv)
  cipher.setAAD(AAD)
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function giaiMaRefreshToken(value: string) {
  const [version, nonce, tag, payload, extra] = value.split('.')
  if (version !== 'v1' || !nonce || !tag || !payload || extra) throw new Error('Token Google Drive không hợp lệ.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', khoaMaHoa(), Buffer.from(nonce, 'base64url'))
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8')
  } catch { throw new Error('Không giải mã được kết nối Google Drive. Kiểm tra GOOGLE_DRIVE_TOKEN_KEY trên VPS.') }
}

async function oauthClient(): Promise<OAuthClient> {
  let config: ClientFile
  try { config = JSON.parse(await readFile(/* turbopackIgnore: true */ process.env.GOOGLE_DRIVE_OAUTH_CLIENT_FILE?.trim() || OAUTH_FILE, 'utf8')) as ClientFile }
  catch { throw new Error('Không đọc được tệp OAuth client Google Drive trên VPS.') }
  const redirect = redirectUriGoogleDrive()
  if (!config.web?.client_id || !config.web.client_secret || !config.web.redirect_uris?.includes(redirect)) {
    throw new Error('OAuth client Google Drive thiếu thông tin hoặc callback không khớp.')
  }
  return { id: config.web.client_id, secret: config.web.client_secret, redirect }
}

export async function cauHinhOAuthHopLe(): Promise<boolean> {
  try { khoaMaHoa(); await oauthClient(); return true } catch { return false }
}

export function urlUyQuyenGoogleDrive(client: OAuthClient, state: string, challenge: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: client.id, redirect_uri: client.redirect, response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/drive.file',
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

export async function batDauUyQuyenGoogleDrive(state: string, verifier: string) {
  khoaMaHoa() // Không gửi người dùng tới Google nếu VPS chưa thể mã hóa refresh token.
  const client = await oauthClient()
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return urlUyQuyenGoogleDrive(client, state, challenge)
}

async function tokenRequest(body: URLSearchParams): Promise<{ access_token?: string; refresh_token?: string }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new Error('Quyền Google Drive đã hết hạn hoặc bị thu hồi. Hãy kết nối lại.')
    throw new Error('Google chưa cấp được quyền truy cập Drive. Vui lòng thử lại.')
  }
  return response.json() as Promise<{ access_token?: string; refresh_token?: string }>
}

async function emailGoogle(accessToken: string): Promise<string> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('Không xác nhận được tài khoản Google đã đăng nhập.')
  const user = await response.json() as { email?: string; email_verified?: boolean }
  if (!user.email || user.email_verified !== true) throw new Error('Google chưa xác nhận email của tài khoản Drive.')
  return user.email
}

async function taoThuMuc(accessToken: string): Promise<string> {
  const response = await fetch(DRIVE_URL + '?fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('Không tạo được thư mục sao lưu trong Drive cá nhân. Kiểm tra quyền đã cấp.')
  const folder = await response.json() as { id?: string }
  if (!folder.id) throw new Error('Google Drive không trả về mã thư mục sao lưu.')
  return folder.id
}

async function docKetNoi(): Promise<KetNoi | null> {
  const { rows } = await db.query<KetNoi>('select email, refresh_token_ma_hoa, folder_id from sao_luu_drive_ket_noi where id=1')
  return rows[0] ?? null
}

export async function emailDaKetNoi(): Promise<string | null> {
  const { rows } = await db.query<{ email: string }>('select email from sao_luu_drive_ket_noi where id=1')
  return rows[0]?.email ?? null
}

export async function hoanTatKetNoiGoogleDrive(code: string, verifier: string): Promise<string> {
  const client = await oauthClient()
  const token = await tokenRequest(new URLSearchParams({
    client_id: client.id, client_secret: client.secret, redirect_uri: client.redirect,
    grant_type: 'authorization_code', code, code_verifier: verifier,
  }))
  if (!token.access_token || !token.refresh_token) throw new Error('Google chưa cấp quyền sao lưu dài hạn. Hãy kết nối lại.')
  const email = await emailGoogle(token.access_token)
  const previous = await docKetNoi()
  const folderId = previous?.email === email && await thuMucConGhiDuoc(token.access_token, previous.folder_id)
    ? previous.folder_id : await taoThuMuc(token.access_token)
  const encrypted = maHoaRefreshToken(token.refresh_token)
  await db.query(`insert into sao_luu_drive_ket_noi (id, email, refresh_token_ma_hoa, folder_id)
    values (1, $1, $2, $3) on conflict (id) do update set email=excluded.email,
    refresh_token_ma_hoa=excluded.refresh_token_ma_hoa, folder_id=excluded.folder_id,
    ket_noi_luc=now(), cap_nhat_luc=now()`, [email, encrypted, folderId])
  return email
}

async function accessToken(refreshToken: string): Promise<string> {
  const client = await oauthClient()
  const data = await tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: refreshToken,
    client_id: client.id, client_secret: client.secret,
  }))
  if (!data.access_token) throw new Error('Google không trả về access token. Hãy kết nối lại.')
  return data.access_token
}

async function thuMucConGhiDuoc(token: string, folderId: string): Promise<boolean> {
  const response = await fetch(DRIVE_URL + '/' + encodeURIComponent(folderId) + '?fields=id,mimeType,trashed,capabilities(canAddChildren)', {
    headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) return false
  const folder = await response.json() as { mimeType?: string; trashed?: boolean; capabilities?: { canAddChildren?: boolean } }
  return folder.mimeType === 'application/vnd.google-apps.folder' && !folder.trashed && folder.capabilities?.canAddChildren === true
}

export async function kiemTraKetNoiGoogleDrive(): Promise<string> {
  const connected = await docKetNoi()
  if (!connected) throw new Error('Chưa kết nối Google Drive cá nhân.')
  const token = await accessToken(giaiMaRefreshToken(connected.refresh_token_ma_hoa))
  const email = await emailGoogle(token)
  if (email !== connected.email || !await thuMucConGhiDuoc(token, connected.folder_id)) {
    throw new Error('Không thể ghi vào thư mục sao lưu. Hãy kết nối lại Google Drive.')
  }
  return email
}

export async function ngatKetNoiGoogleDrive() {
  const connected = await docKetNoi()
  await db.query('delete from sao_luu_drive_ket_noi where id=1')
  if (!connected) return
  try {
    const token = giaiMaRefreshToken(connected.refresh_token_ma_hoa)
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }), signal: AbortSignal.timeout(15_000),
    })
  } catch { /* Kết nối trên VPS đã xóa; Google cũng cho phép thu hồi trong cài đặt tài khoản. */ }
}

async function loiTaiLen(response: Response): Promise<string> {
  const data = await response.json().catch(() => null) as { error?: { errors?: Array<{ reason?: string }> } } | null
  const reasons = data?.error?.errors?.map(error => error.reason) ?? []
  if (reasons.includes('storageQuotaExceeded')) return 'Google Drive cá nhân đã hết dung lượng lưu trữ.'
  if (response.status === 404) return 'Không tìm thấy thư mục sao lưu trên Google Drive. Hãy kết nối lại.'
  if (response.status === 403) return 'Google Drive không cho phép tải bản sao lưu. Kiểm tra dung lượng và quyền đã cấp.'
  return 'Google Drive từ chối tải bản sao lưu (HTTP ' + response.status + ').'
}

export async function taiLenGoogleDrive(filePath: string, name: string): Promise<string> {
  const connected = await docKetNoi()
  if (!connected) throw new Error('Chưa kết nối Google Drive cá nhân trong Cài đặt → Sao lưu dữ liệu.')
  const token = await accessToken(giaiMaRefreshToken(connected.refresh_token_ma_hoa))
  const size = (await stat(filePath)).size
  const start = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'POST', headers: {
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'application/gzip', 'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({ name, parents: [connected.folder_id], mimeType: 'application/gzip' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!start.ok) throw new Error(await loiTaiLen(start))
  const location = start.headers.get('location')
  if (!location) throw new Error('Google Drive không trả về địa chỉ tải lên.')
  const endpoint = new URL(location)
  if (endpoint.protocol !== 'https:' || !['www.googleapis.com', 'content.googleapis.com'].includes(endpoint.hostname)) {
    throw new Error('Địa chỉ tải lên Google Drive không hợp lệ.')
  }
  const stream = createReadStream(filePath)
  try {
    const upload = await fetch(endpoint, {
      method: 'PUT', headers: { 'Content-Type': 'application/gzip', 'Content-Length': String(size) },
      body: Readable.toWeb(stream) as ReadableStream, duplex: 'half',
      signal: AbortSignal.timeout(20 * 60_000),
    } as RequestInit & { duplex: 'half' })
    if (!upload.ok) throw new Error(await loiTaiLen(upload))
    const result = await upload.json() as { id?: string }
    if (!result.id) throw new Error('Google Drive không trả về mã tệp sao lưu.')
    return result.id
  } finally { stream.destroy() }
}
