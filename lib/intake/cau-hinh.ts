import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db/pool'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { HINH_THUC_THANH_TOAN, type HinhThucThanhToan } from '@/lib/tai-chinh/hinh-thuc'

export const KHOA_CAU_HINH_INTAKE = 'intake_hoa_don'
export const INTAKE_TIMEOUT_MAC_DINH = 180
export const INTAKE_TIMEOUT_MIN = 30
export const INTAKE_TIMEOUT_MAX = 3600

export type HinhThucIntake = typeof HINH_THUC.HOAN_TAM_UNG | typeof HINH_THUC.CQ_TRA_THANG
export type AllowlistIntake = { loai: 'user' | 'chat'; giaTri: string }

export type CauHinhIntake = {
  dangBot: boolean
  dangAgent: boolean
  tuLuuHetHan: boolean
  timeoutGiay: number
  hinhThucMacDinh: HinhThucIntake
  donViIdMacDinh: string | null
  hinhThucThanhToanMacDinh: HinhThucThanhToan
  nguoiDungHeThongId: string | null
  allowlist: AllowlistIntake[]
  botTokenMaHoa: string
  agentTokenHash: string
  webhookDaDat: boolean
  webhookDatLuc: string | null
  agentPingLuc: string | null
}

export type DuLieuCauHinhIntake = Omit<CauHinhIntake, 'botTokenMaHoa' | 'agentTokenHash'> & {
  coBotToken: boolean
  coAgentToken: boolean
}

export const CAU_HINH_INTAKE_MAC_DINH: CauHinhIntake = {
  dangBot: false,
  dangAgent: false,
  tuLuuHetHan: true,
  timeoutGiay: INTAKE_TIMEOUT_MAC_DINH,
  hinhThucMacDinh: HINH_THUC.HOAN_TAM_UNG,
  donViIdMacDinh: null,
  hinhThucThanhToanMacDinh: HINH_THUC_THANH_TOAN.TIEN_MAT,
  nguoiDungHeThongId: null,
  allowlist: [],
  botTokenMaHoa: '',
  agentTokenHash: '',
  webhookDaDat: false,
  webhookDatLuc: null,
  agentPingLuc: null,
}

function chuoi(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function uuid(v: unknown): string | null {
  const s = chuoi(v)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null
}

function timeout(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n)) return INTAKE_TIMEOUT_MAC_DINH
  return Math.max(INTAKE_TIMEOUT_MIN, Math.min(INTAKE_TIMEOUT_MAX, n))
}

function hinhThuc(v: unknown): HinhThucIntake {
  return v === HINH_THUC.CQ_TRA_THANG ? HINH_THUC.CQ_TRA_THANG : HINH_THUC.HOAN_TAM_UNG
}

function thanhToan(v: unknown): HinhThucThanhToan {
  return v === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
    ? HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
    : HINH_THUC_THANH_TOAN.TIEN_MAT
}

function allowlist(v: unknown): AllowlistIntake[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const result: AllowlistIntake[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const loai = o.loai === 'chat' ? 'chat' : o.loai === 'user' ? 'user' : null
    const giaTri = chuoi(o.giaTri)
    if (!loai || !giaTri || giaTri.length > 80) continue
    const key = `${loai}:${giaTri}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ loai, giaTri })
    }
  }
  return result.slice(0, 100)
}

export function docCauHinhIntakeTuRows(rows: readonly { khoa: string; gia_tri: unknown }[]): CauHinhIntake {
  const row = rows.find(r => r.khoa === KHOA_CAU_HINH_INTAKE)
  const raw = row?.gia_tri
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...CAU_HINH_INTAKE_MAC_DINH }
  const o = raw as Record<string, unknown>
  return {
    dangBot: typeof o.dangBot === 'boolean' ? o.dangBot : CAU_HINH_INTAKE_MAC_DINH.dangBot,
    dangAgent: typeof o.dangAgent === 'boolean' ? o.dangAgent : CAU_HINH_INTAKE_MAC_DINH.dangAgent,
    tuLuuHetHan: typeof o.tuLuuHetHan === 'boolean' ? o.tuLuuHetHan : CAU_HINH_INTAKE_MAC_DINH.tuLuuHetHan,
    timeoutGiay: timeout(o.timeoutGiay),
    hinhThucMacDinh: hinhThuc(o.hinhThucMacDinh),
    donViIdMacDinh: uuid(o.donViIdMacDinh),
    hinhThucThanhToanMacDinh: thanhToan(o.hinhThucThanhToanMacDinh),
    nguoiDungHeThongId: uuid(o.nguoiDungHeThongId),
    allowlist: allowlist(o.allowlist),
    botTokenMaHoa: chuoi(o.botTokenMaHoa),
    agentTokenHash: chuoi(o.agentTokenHash),
    webhookDaDat: o.webhookDaDat === true,
    webhookDatLuc: chuoi(o.webhookDatLuc) || null,
    agentPingLuc: chuoi(o.agentPingLuc) || null,
  }
}

export async function docCauHinhIntake(): Promise<CauHinhIntake> {
  const { rows } = await db.query<{ khoa: string; gia_tri: unknown }>(
    'select khoa, gia_tri from cau_hinh where khoa=$1', [KHOA_CAU_HINH_INTAKE])
  return docCauHinhIntakeTuRows(rows)
}

export function anKhoaIntake(cauHinh: CauHinhIntake): DuLieuCauHinhIntake {
  const { botTokenMaHoa: _, agentTokenHash: __, ...hienThi } = cauHinh
  return { ...hienThi, coBotToken: Boolean(cauHinh.botTokenMaHoa || process.env.TELEGRAM_BOT_TOKEN?.trim()), coAgentToken: Boolean(cauHinh.agentTokenHash) }
}

function khoaMaHoa(): Buffer {
  const raw = process.env.INTAKE_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error('Thiếu INTAKE_TOKEN_ENCRYPTION_KEY để lưu token bot.')
  return createHash('sha256').update(raw).digest()
}

export function maHoaBiMat(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', khoaMaHoa(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}

export function giaiMaBiMat(value: string): string {
  const [ivText, tagText, dataText] = value.split('.')
  if (!ivText || !tagText || !dataText) throw new Error('Token đã lưu không hợp lệ.')
  const decipher = createDecipheriv('aes-256-gcm', khoaMaHoa(), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8')
}

export async function layTelegramBotToken(cauHinh?: CauHinhIntake): Promise<string> {
  const config = cauHinh ?? await docCauHinhIntake()
  if (config.botTokenMaHoa) {
    try { return giaiMaBiMat(config.botTokenMaHoa) } catch { return '' }
  }
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
}

export function bamAgentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function soKhopAgentToken(token: string, hash: string): boolean {
  if (!token || !hash || !/^[0-9a-f]{64}$/i.test(hash)) return false
  const a = Buffer.from(bamAgentToken(token), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function parseAllowlistLines(text: string): AllowlistIntake[] {
  return allowlist(text.split(/\r?\n/).map(line => {
    const [prefix, ...rest] = line.split(':')
    const loai = prefix?.trim().toLowerCase()
    return { loai, giaTri: rest.join(':').trim() }
  }))
}

export function allowlistLines(items: readonly AllowlistIntake[]): string {
  return items.map(item => `${item.loai}:${item.giaTri}`).join('\n')
}

export async function luuCauHinhIntake(cauHinh: CauHinhIntake): Promise<void> {
  await db.query(
    `insert into cau_hinh (khoa, gia_tri, mo_ta) values ($1,$2::jsonb,$3)
     on conflict (khoa) do update set gia_tri=excluded.gia_tri, sua_luc=now()`,
    [KHOA_CAU_HINH_INTAKE, JSON.stringify(cauHinh), 'Bot Telegram và agent scan hóa đơn'],
  )
}

export async function capNhatTrangThaiAgent(luc: Date = new Date()): Promise<void> {
  const cauHinh = await docCauHinhIntake()
  await luuCauHinhIntake({ ...cauHinh, agentPingLuc: luc.toISOString() })
}

export async function capNhatTrangThaiWebhook(luc: Date = new Date()): Promise<void> {
  const cauHinh = await docCauHinhIntake()
  await luuCauHinhIntake({ ...cauHinh, webhookDaDat: true, webhookDatLuc: luc.toISOString() })
}
