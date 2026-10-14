import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: { query: mocks.query } }))

import {
  batDauUyQuyenGoogleDrive, giaiMaRefreshToken, hoanTatKetNoiGoogleDrive,
  kiemTraKetNoiGoogleDrive, maHoaRefreshToken, taiLenGoogleDrive,
} from './google-drive'

let temp: string
const redirect = 'https://hc.ttdt.site/api/sao-luu/google-drive/callback'
const key = Buffer.alloc(32, 7).toString('base64url')
const json = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(data), { status, headers })

beforeEach(async () => {
  temp = await mkdtemp(path.join(tmpdir(), 'drive-test-'))
  const file = path.join(temp, 'oauth.json')
  await writeFile(file, JSON.stringify({ web: { client_id: 'client-id', client_secret: 'client-secret', redirect_uris: [redirect] } }))
  vi.stubEnv('GOOGLE_DRIVE_OAUTH_CLIENT_FILE', file)
  vi.stubEnv('GOOGLE_DRIVE_OAUTH_REDIRECT_URI', redirect)
  vi.stubEnv('GOOGLE_DRIVE_TOKEN_KEY', key)
  mocks.query.mockReset().mockResolvedValue({ rows: [] })
})
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(temp, { recursive: true, force: true }) })

describe('kết nối OAuth Drive cá nhân', () => {
  it('mã hóa refresh token có xác thực và từ chối ciphertext bị sửa', () => {
    const encrypted = maHoaRefreshToken('sensitive-refresh-token')
    expect(encrypted).not.toContain('sensitive-refresh-token')
    expect(giaiMaRefreshToken(encrypted)).toBe('sensitive-refresh-token')
    const [version, iv, tag, payload] = encrypted.split('.')
    const payloadBiSua = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}`
    expect(() => giaiMaRefreshToken([version, iv, tag, payloadBiSua].join('.'))).toThrow()
  })

  it('tạo URL có offline, PKCE, state và scope drive.file (không phải toàn Drive)', async () => {
    const url = new URL(await batDauUyQuyenGoogleDrive('nonce', 'verifier-strong'))
    expect(url.searchParams.get('state')).toBe('nonce')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file')
    expect(url.searchParams.get('scope')).not.toContain('https://www.googleapis.com/auth/drive ')
    expect(url.searchParams.get('redirect_uri')).toBe(redirect)
  })

  it('chỉ lưu token mã hóa sau khi xác nhận email và tạo thư mục trên My Drive', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'access-token', refresh_token: 'refresh-token' }))
      .mockResolvedValueOnce(json({ email: 'owner@example.com', email_verified: true }))
      .mockResolvedValueOnce(json({ id: 'folder-123' }))
    vi.stubGlobal('fetch', fetch)
    expect(await hoanTatKetNoiGoogleDrive('auth-code', 'verifier')).toBe('owner@example.com')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(String(fetch.mock.calls[2][1].body)).toContain('application/vnd.google-apps.folder')
    const insert = mocks.query.mock.calls.find(([sql]) => String(sql).includes('insert into sao_luu_drive_ket_noi'))
    expect(insert).toBeTruthy()
    expect(insert![1][0]).toBe('owner@example.com')
    expect(insert![1][1]).not.toContain('refresh-token')
    expect(giaiMaRefreshToken(insert![1][1])).toBe('refresh-token')
    expect(insert![1][2]).toBe('folder-123')
  })

  it('kiểm tra kết nối bằng refresh token và quyền ghi của thư mục', async () => {
    mocks.query.mockResolvedValue({ rows: [{ email: 'owner@example.com', refresh_token_ma_hoa: maHoaRefreshToken('refresh'), folder_id: 'folder-id' }] })
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'access' }))
      .mockResolvedValueOnce(json({ email: 'owner@example.com', email_verified: true }))
      .mockResolvedValueOnce(json({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } }))
    vi.stubGlobal('fetch', fetch)
    expect(await kiemTraKetNoiGoogleDrive()).toBe('owner@example.com')
    expect(String(fetch.mock.calls[2][0])).toContain('folder-id')
  })

  it('báo lỗi nếu thư mục mất quyền ghi, không đánh dấu thành công giả', async () => {
    mocks.query.mockResolvedValue({ rows: [{ email: 'owner@example.com', refresh_token_ma_hoa: maHoaRefreshToken('refresh'), folder_id: 'folder-id' }] })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'access' }))
      .mockResolvedValueOnce(json({ email: 'owner@example.com', email_verified: true }))
      .mockResolvedValueOnce(json({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } })))
    await expect(kiemTraKetNoiGoogleDrive()).rejects.toThrow('Không thể ghi')
  })

  it('tải luồng gói backup vào thư mục, chỉ trả thành công khi Drive xác nhận file ID', async () => {
    const file = path.join(temp, 'backup.tar.gz')
    await writeFile(file, 'test backup')
    mocks.query.mockResolvedValue({ rows: [{ email: 'owner@example.com', refresh_token_ma_hoa: maHoaRefreshToken('refresh'), folder_id: 'folder-id' }] })
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'access' }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=abc' } }))
      .mockResolvedValueOnce(json({ id: 'drive-file-id' }))
    vi.stubGlobal('fetch', fetch)
    expect(await taiLenGoogleDrive(file, 'backup.tar.gz')).toBe('drive-file-id')
    expect(fetch.mock.calls[1][1].body).toContain('folder-id')
    expect(fetch.mock.calls[2][1].method).toBe('PUT')
  })
})
