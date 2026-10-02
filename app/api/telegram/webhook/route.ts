import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db/pool'
import {
  capNhatDeXuat,
  docDeXuatIntake,
  huyIntake,
  layMacDinhIntake,
  luuIntake,
  timIntake,
  timIntakeChoChat,
  taoIntakeHoaDon,
  type IntakeRow,
  type ThayDoiIntake,
  docSnapshotIntake,
} from '@/lib/intake/intake'
import {
  capNhatTrangThaiWebhook,
  docCauHinhIntake,
  layTelegramBotToken,
  type CauHinhIntake,
} from '@/lib/intake/cau-hinh'
import { deXuatGiaoDich, docHoaDonIntake } from '@/lib/intake/doc-hoa-don'
import { parseTelegramUpdate, allowlisted, type TelegramCallbackEvent, type TelegramFileEvent, type TelegramTextEvent } from '@/lib/intake/telegram-update'
import { telegramAnswerCallback, telegramDownloadFile, telegramSendMessage } from '@/lib/intake/telegram'
import { keyboardLuaChon, keyboardTomTat, nhanHinhThuc, nhanThanhToan, tomTatIntake, thongBaoThanhCong, type TelegramKeyboard } from '@/lib/intake/telegram-format'
import { chayWorkerIntake } from '@/lib/intake/worker'
import { allowRateLimit } from '@/lib/intake/rate-limit'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function secretHopLe(actual: string | null, expected: string): boolean {
  if (!actual || !expected) return false
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function idempotencyTelegram(event: TelegramFileEvent): string {
  return createHash('sha256').update(`${event.chatId}:${event.messageId}:${event.fileId}`).digest('hex')
}

function keyboardHuy(rowId: string): TelegramKeyboard {
  return { inline_keyboard: [[{ text: 'Hủy intake', callback_data: `intake:${rowId}:cancel` }]] }
}

async function layTenBoSung(row: IntakeRow): Promise<{ donViTen?: string; nguoiLayHdTen?: string }> {
  const deXuat = docDeXuatIntake(row)
  const snapshot = docSnapshotIntake(row)
  const donViId = deXuat.thayDoi?.donViId ?? snapshot.donViId
  const nguoiLayHdId = deXuat.thayDoi?.nguoiLayHdId ?? snapshot.nguoiLayHdId
  const [unit, collector] = await Promise.all([
    donViId ? db.query<{ ten: string }>('select ten from don_vi where id=$1', [donViId]) : Promise.resolve({ rows: [] as Array<{ ten: string }> }),
    nguoiLayHdId ? db.query<{ ten: string }>('select ten from nguoi_lay_hd where id=$1', [nguoiLayHdId]) : Promise.resolve({ rows: [] as Array<{ ten: string }> }),
  ])
  return { donViTen: unit.rows[0]?.ten, nguoiLayHdTen: collector.rows[0]?.ten }
}

async function guiTomTat(token: string, chatId: string, row: IntakeRow, config: CauHinhIntake, loi?: string): Promise<void> {
  const names = await layTenBoSung(row)
  const canhBao = Boolean(docDeXuatIntake(row).thayDoi?.canhBaoFingerprint)
  await telegramSendMessage(token, chatId, tomTatIntake(row, config, { ...names, loi }), keyboardTomTat(row.id, canhBao))
}

async function guiThanhCong(token: string, chatId: string, giaoDichId: string, loiTep?: string): Promise<void> {
  const { rows } = await db.query<{ so_thu_tu: number; ngay: string }>('select so_thu_tu, to_char(ngay, \'YYYY-MM-DD\') as ngay from giao_dich where id=$1', [giaoDichId])
  await telegramSendMessage(token, chatId, `${thongBaoThanhCong(giaoDichId, rows[0]?.so_thu_tu, rows[0]?.ngay)}${loiTep ? `\nCảnh báo: ${loiTep}` : ''}`)
}

async function xuLyKetQuaLuu(token: string, chatId: string, rowId: string, result: Awaited<ReturnType<typeof luuIntake>>, config: CauHinhIntake): Promise<void> {
  if (result.giaoDichId) {
    await guiThanhCong(token, chatId, result.giaoDichId, result.loiTep)
    return
  }
  const row = await timIntake(rowId)
  if (!row) {
    await telegramSendMessage(token, chatId, result.loi ?? 'Intake không còn tồn tại.')
    return
  }
  if (result.canhBao) {
    await guiTomTat(token, chatId, row, config, `Cảnh báo số dư: thiếu ${result.canhBao.thieu.toLocaleString('vi-VN')}đ so với số dư lý thuyết. Bấm "Xác nhận lưu" nếu vẫn tiếp tục.`)
    return
  }
  if (result.maLoi === 'trung_hoa_don') {
    await telegramSendMessage(token, chatId, 'Hóa đơn có cùng ký hiệu và số đã tồn tại. Bấm "Đổi số/ký hiệu HĐ" rồi gửi theo dạng ký hiệu|số, hoặc hủy.', {
      inline_keyboard: [
        [{ text: 'Đổi số/ký hiệu HĐ', callback_data: `intake:${rowId}:invoice` }],
        [{ text: 'Hủy', callback_data: `intake:${rowId}:cancel` }],
      ],
    })
    return
  }
  await guiTomTat(token, chatId, row, config, result.loi ?? 'Không lưu được intake. Hãy thử lại hoặc hủy.')
}

async function xuLyFile(token: string, config: CauHinhIntake, event: TelegramFileEvent): Promise<void> {
  let file: File
  try {
    file = await telegramDownloadFile(token, event.fileId, event.tenGoc, event.mime, event.kichThuoc)
  } catch (error) {
    await telegramSendMessage(token, event.chatId, error instanceof Error ? error.message : 'Không tải được tệp từ Telegram.')
    return
  }
  let ketQuaDoc
  try {
    ketQuaDoc = await docHoaDonIntake(file)
  } catch (error) {
    await telegramSendMessage(token, event.chatId, error instanceof Error ? error.message : 'Không đọc được hóa đơn.')
    return
  }
  if (ketQuaDoc.trangThai === 'loi_ky_thuat') {
    await telegramSendMessage(token, event.chatId, 'Không đọc được hóa đơn. Hãy gửi tệp PDF hoặc XML hợp lệ.')
    return
  }
  let snapshot
  try {
    snapshot = await layMacDinhIntake(config)
  } catch (error) {
    await telegramSendMessage(token, event.chatId, error instanceof Error ? error.message : 'Cấu hình mặc định intake chưa đầy đủ.')
    return
  }
  try {
    const { row, moi } = await taoIntakeHoaDon({
      nguon: 'telegram', idempotencyKey: idempotencyTelegram(event), chatTelegramId: event.chatId,
      userTelegramId: event.userId, messageId: event.messageId, deXuat: deXuatGiaoDich(ketQuaDoc), snapshot, tep: file,
    })
    if (!moi) {
      await guiTomTat(token, event.chatId, row, config, 'Tệp PDF/XML này đã được nhận trước đó.')
      return
    }
    await guiTomTat(token, event.chatId, row, config)
  } catch (error) {
    await telegramSendMessage(token, event.chatId, error instanceof Error ? error.message : 'Không tạo được intake hóa đơn.')
  }
}

async function layIntakeCuaEvent(event: Pick<TelegramCallbackEvent, 'chatId' | 'userId'>, id: string): Promise<IntakeRow | null> {
  const row = await timIntake(id)
  if (!row || row.chat_telegram_id !== event.chatId) return null
  if (row.user_telegram_id && row.user_telegram_id !== event.userId) return null
  return row
}

async function xuLyText(token: string, config: CauHinhIntake, event: TelegramTextEvent): Promise<void> {
  const text = event.text.trim()
  const command = text.split(/\s+/)[0]?.toLowerCase()
  if (command === '/start') {
    await telegramSendMessage(token, event.chatId, 'Gửi tệp PDF hoặc XML hóa đơn. Bot sẽ đọc đề xuất, hỏi các mặc định và tự lưu sau thời gian cài đặt nếu bạn không phản hồi.')
    return
  }
  if (command === '/macdinh') {
    try {
      const snapshot = await layMacDinhIntake(config)
      await telegramSendMessage(token, event.chatId, `Mặc định hiện tại:\n- Hình thức: ${nhanHinhThuc(snapshot.hinhThuc)}\n- Đơn vị: ${snapshot.donViTen}\n- Thanh toán: ${nhanThanhToan(snapshot.hinhThucThanhToan)}\n- Thời gian chờ: ${snapshot.timeoutGiay} giây`)
    } catch (error) {
      await telegramSendMessage(token, event.chatId, error instanceof Error ? error.message : 'Chưa đủ cấu hình mặc định.')
    }
    return
  }
  const row = await timIntakeChoChat(event.chatId)
  if (command === '/huy') {
    if (!row || !await huyIntake(row.id)) {
      await telegramSendMessage(token, event.chatId, 'Không có intake nào đang chờ.')
    } else {
      await telegramSendMessage(token, event.chatId, 'Đã hủy intake. Gửi lại hóa đơn nếu cần.')
    }
    return
  }
  if (!row) {
    await telegramSendMessage(token, event.chatId, 'Gửi tệp PDF/XML hóa đơn hoặc dùng /macdinh để xem cấu hình. Bot không nhận lệnh tự do khác.')
    return
  }
  const deXuat = docDeXuatIntake(row)
  const choNhap = deXuat.thayDoi?.choNhap
  if (choNhap === 'hoa_don') {
    const [kyHieu, soHd] = text.split('|').map(value => value.trim())
    if (!kyHieu || !soHd || text.split('|').length !== 2) {
      await telegramSendMessage(token, event.chatId, 'Hãy gửi theo dạng `ký hiệu|số`, ví dụ `1C26TAA|0000123`.', keyboardHuy(row.id))
      return
    }
    await capNhatDeXuat(row, { kyHieuHd: kyHieu, soHd, choNhap: undefined, canhBaoFingerprint: undefined })
    const updated = await timIntake(row.id)
    if (updated) await guiTomTat(token, event.chatId, updated, config)
    return
  }
  await telegramSendMessage(token, event.chatId, 'Hãy dùng các nút bên dưới để đổi đúng một trường, rồi bot sẽ hiện lại tóm tắt.', keyboardTomTat(row.id, Boolean(deXuat.thayDoi?.canhBaoFingerprint)))
}

async function xuLyCallback(token: string, config: CauHinhIntake, event: TelegramCallbackEvent): Promise<void> {
  const parts = event.data.split(':')
  if (parts[0] !== 'intake' || !parts[1] || !parts[2]) return
  const row = await layIntakeCuaEvent(event, parts[1])
  if (!row) {
    await telegramAnswerCallback(token, event.queryId, 'Intake không còn hiệu lực.')
    return
  }
  const action = parts[2]
  const value = parts[3]
  await telegramAnswerCallback(token, event.queryId)
  if (action === 'cancel') {
    await huyIntake(row.id)
    await telegramSendMessage(token, event.chatId, 'Đã hủy intake. Gửi lại hóa đơn nếu cần.')
    return
  }
  if (action === 'save' || action === 'default') {
    await xuLyKetQuaLuu(token, event.chatId, row.id, await luuIntake(row.id, action === 'default'), config)
    return
  }
  if (action === 'summary') {
    await guiTomTat(token, event.chatId, row, config)
    return
  }
  if (action === 'form') {
    await telegramSendMessage(token, event.chatId, 'Chọn hình thức:', keyboardLuaChon(row.id, 'setform', [
      { text: 'Hoàn tạm ứng', value: 'hoan' }, { text: 'Cơ quan trả thẳng', value: 'cq' },
    ]))
    return
  }
  if (action === 'setform' && (value === 'hoan' || value === 'cq')) {
    await capNhatDeXuat(row, {
      hinhThuc: value === 'hoan' ? HINH_THUC.HOAN_TAM_UNG : HINH_THUC.CQ_TRA_THANG,
      hinhThucThanhToan: value === 'hoan' ? null : 'tien_mat', choNhap: undefined,
    })
    const updated = await timIntake(row.id)
    if (updated) await guiTomTat(token, event.chatId, updated, config)
    return
  }
  if (action === 'unit') {
    const { rows } = await db.query<{ id: string; ten: string }>('select id, ten from don_vi where dang_hoat_dong order by ten limit 30')
    await telegramSendMessage(token, event.chatId, rows.length ? 'Chọn đơn vị:' : 'Chưa có đơn vị hoạt động.', keyboardLuaChon(row.id, 'setunit', rows.map(item => ({ text: item.ten, value: item.id }))))
    return
  }
  if (action === 'setunit' && value) {
    const { rows } = await db.query<{ id: string }>('select id from don_vi where id=$1 and dang_hoat_dong', [value])
    if (!rows[0]) return telegramSendMessage(token, event.chatId, 'Đơn vị không tồn tại hoặc đã bị vô hiệu hóa.')
    await capNhatDeXuat(row, { donViId: value, choNhap: undefined })
    const updated = await timIntake(row.id)
    if (updated) await guiTomTat(token, event.chatId, updated, config)
    return
  }
  if (action === 'collector') {
    const { rows } = await db.query<{ id: string; ten: string }>('select id, ten from nguoi_lay_hd where dang_hoat_dong order by ten limit 30')
    await telegramSendMessage(token, event.chatId, 'Chọn người lấy hóa đơn:', keyboardLuaChon(row.id, 'setcollector', [{ text: 'Không chọn', value: 'none' }, ...rows.map(item => ({ text: item.ten, value: item.id }))]))
    return
  }
  if (action === 'setcollector' && value) {
    const valid = value === 'none' ? true : Boolean((await db.query('select 1 from nguoi_lay_hd where id=$1 and dang_hoat_dong', [value])).rows[0])
    if (!valid) return telegramSendMessage(token, event.chatId, 'Người lấy hóa đơn không tồn tại hoặc đã bị vô hiệu hóa.')
    await capNhatDeXuat(row, { nguoiLayHdId: value === 'none' ? null : value, choNhap: undefined })
    const updated = await timIntake(row.id)
    if (updated) await guiTomTat(token, event.chatId, updated, config)
    return
  }
  if (action === 'payment') {
    const deXuat = docDeXuatIntake(row)
    const hinhThuc = deXuat.thayDoi?.hinhThuc ?? (await layMacDinhIntake(config)).hinhThuc
    if (hinhThuc === HINH_THUC.HOAN_TAM_UNG) return telegramSendMessage(token, event.chatId, 'Hoàn tạm ứng dùng thanh toán "Hoàn tạm ứng", không cần đổi.')
    await telegramSendMessage(token, event.chatId, 'Chọn hình thức thanh toán:', keyboardLuaChon(row.id, 'setpayment', [
      { text: 'Tiền mặt', value: 'tien_mat' }, { text: 'Chuyển khoản', value: 'chuyen_khoan' },
    ]))
    return
  }
  if (action === 'setpayment' && (value === 'tien_mat' || value === 'chuyen_khoan')) {
    await capNhatDeXuat(row, { hinhThucThanhToan: value, choNhap: undefined })
    const updated = await timIntake(row.id)
    if (updated) await guiTomTat(token, event.chatId, updated, config)
    return
  }
  if (action === 'invoice') {
    await capNhatDeXuat(row, { choNhap: 'hoa_don' })
    await telegramSendMessage(token, event.chatId, 'Gửi ký hiệu và số hóa đơn theo dạng `ký hiệu|số`, ví dụ `1C26TAA|0000123`.', keyboardHuy(row.id))
  }
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || ''
  if (!secretHopLe(request.headers.get('x-telegram-bot-api-secret-token'), expected)) {
    return NextResponse.json({ loi: 'Không được phép.' }, { status: expected ? 401 : 503 })
  }
  try {
    const config = await docCauHinhIntake()
    const token = await layTelegramBotToken(config)
    if (!config.dangBot || !token) return NextResponse.json({ ok: true })
    const event = parseTelegramUpdate(await request.json())
    if (!event) return NextResponse.json({ ok: true })
    if (!allowlisted(config.allowlist, event)) return NextResponse.json({ ok: true })
    const rateKey = event.loai === 'tep' ? `telegram:file:${event.userId}` : `telegram:${event.loai}:${event.userId}`
    const allowed = allowRateLimit(rateKey, event.loai === 'tep' ? 10 : 60, 60_000)
    if (!allowed) return NextResponse.json({ ok: true })
    await chayWorkerIntake()
    if (event.loai === 'tep') await xuLyFile(token, config, event)
    else if (event.loai === 'van_ban') await xuLyText(token, config, event)
    else await xuLyCallback(token, config, event)
    await capNhatTrangThaiWebhook()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
