import { NextResponse } from 'next/server'
import { db } from '@/lib/db/pool'
import { docHoaDonIntake, deXuatGiaoDich } from '@/lib/intake/doc-hoa-don'
import {
  capNhatTrangThaiAgent,
  docCauHinhIntake,
  layTelegramBotToken,
  soKhopAgentToken,
} from '@/lib/intake/cau-hinh'
import { taoIntakeHoaDon } from '@/lib/intake/intake'
import { layMacDinhIntake } from '@/lib/intake/intake'
import { allowRateLimit } from '@/lib/intake/rate-limit'
import { telegramSendMessage } from '@/lib/intake/telegram'
import { keyboardTomTat, tomTatIntake } from '@/lib/intake/telegram-format'
import { chayWorkerIntake, chatTelegramThongBao } from '@/lib/intake/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 12 * 1024 * 1024

function bearer(request: Request): string {
  const value = request.headers.get('authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function clientIp(request: Request): string {
  return request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

async function authAgent(request: Request) {
  const config = await docCauHinhIntake()
  const token = bearer(request)
  if (!soKhopAgentToken(token, config.agentTokenHash)) return { config: null, status: 401 as const }
  return { config, status: 200 as const }
}

async function thongBaoScan(config: Awaited<ReturnType<typeof docCauHinhIntake>>, row: Awaited<ReturnType<typeof taoIntakeHoaDon>>['row']) {
  if (!config.dangBot) return
  const token = await layTelegramBotToken(config)
  if (!token) return
  for (const chatId of chatTelegramThongBao(config)) {
    try {
      await telegramSendMessage(token, chatId, `Máy scan đã nhận hóa đơn.\n${tomTatIntake(row, config)}`, keyboardTomTat(row.id))
    } catch {
      // Không để Telegram lỗi làm agent phải gửi lại cùng một file.
    }
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authAgent(request)
    if (!auth.config) return NextResponse.json({ loi: 'Token agent không hợp lệ.' }, { status: auth.status })
    if (!auth.config.dangAgent) return NextResponse.json({ loi: 'Agent scan đang tắt.' }, { status: 403 })
    if (!allowRateLimit(`agent:${clientIp(request)}`, 60, 60_000)) {
      return NextResponse.json({ loi: 'Quá nhiều yêu cầu.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
    await capNhatTrangThaiAgent()
    await chayWorkerIntake()
    const { rows } = await db.query<{ so_luong: number }>("select count(*)::int as so_luong from intake_hoa_don where trang_thai='cho_phan_hoi'")
    return NextResponse.json({ ok: true, dangAgent: auth.config.dangAgent, choPhanHoi: rows[0]?.so_luong ?? 0 })
  } catch {
    return NextResponse.json({ loi: 'Không kiểm tra được trạng thái agent.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authAgent(request)
    if (!auth.config) return NextResponse.json({ loi: 'Token agent không hợp lệ.' }, { status: auth.status })
    if (!auth.config.dangAgent) return NextResponse.json({ loi: 'Agent scan đang tắt.' }, { status: 403 })
    if (!allowRateLimit(`upload:${clientIp(request)}`, 20, 60_000)) {
      return NextResponse.json({ loi: 'Quá nhiều tệp trong thời gian ngắn.' }, { status: 429, headers: { 'Retry-After': '60' } })
    }
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY) return NextResponse.json({ loi: 'Tệp phải không quá 10 MB.' }, { status: 413 })

    await chayWorkerIntake()
    const form = await request.formData()
    const file = form.get('file') ?? form.get('tep')
    if (!(file instanceof File)) return NextResponse.json({ loi: 'Thiếu tệp PDF/XML.' }, { status: 400 })
    const keyRaw = request.headers.get('idempotency-key') || form.get('idempotency_key')
    const idempotencyKey = typeof keyRaw === 'string' ? keyRaw.trim() : ''
    if (!idempotencyKey || idempotencyKey.length > 200) return NextResponse.json({ loi: 'Thiếu Idempotency-Key hợp lệ.' }, { status: 400 })

    const ketQuaDoc = await docHoaDonIntake(file)
    if (ketQuaDoc.trangThai === 'loi_ky_thuat') {
      return NextResponse.json({ loi: 'Không đọc được hóa đơn. Hãy kiểm tra tệp PDF/XML.' }, { status: 422 })
    }
    const snapshot = await layMacDinhIntake(auth.config)
    const { row, moi } = await taoIntakeHoaDon({
      nguon: 'scan', idempotencyKey, deXuat: deXuatGiaoDich(ketQuaDoc), snapshot, tep: file,
    })
    await capNhatTrangThaiAgent()
    if (moi) await thongBaoScan(auth.config, row)
    return NextResponse.json({
      ok: true, moi, id: row.id, trangThai: row.trang_thai,
      summary: tomTatIntake(row, auth.config),
    }, { status: moi ? 201 : 200 })
  } catch (error) {
    const loi = error instanceof Error && /Tệp|hóa đơn|đơn vị|user|Token|Idempotency/i.test(error.message)
      ? error.message.slice(0, 240)
      : 'Không nhận được tệp PDF/XML.'
    return NextResponse.json({ loi }, { status: /Tệp|hóa đơn/.test(loi) ? 422 : 500 })
  }
}
