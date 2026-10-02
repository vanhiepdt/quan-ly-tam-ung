import { docCauHinhIntake, layTelegramBotToken, type CauHinhIntake } from './cau-hinh'
import { xuLyHetHanChiTiet, type KetQuaHetHan } from './intake'
import { telegramSendMessage } from './telegram'
import { thongBaoHetHan } from './telegram-format'

export function chatTelegramThongBao(config: CauHinhIntake): string[] {
  return [...new Set(config.allowlist.filter(item => item.loai === 'chat').map(item => item.giaTri))]
}

export async function thongBaoHetHanTelegram(config: CauHinhIntake, items: readonly KetQuaHetHan[]): Promise<void> {
  if (!items.length || !config.dangBot) return
  const token = await layTelegramBotToken(config)
  if (!token) return
  for (const item of items) {
    if (!item.row.chat_telegram_id) continue
    try {
      const saved = item.result.row?.giao_dich_id ?? item.result.giaoDichId ?? null
      await telegramSendMessage(token, item.row.chat_telegram_id, thongBaoHetHan(saved, item.tuLuu))
    } catch {
      // Telegram không được làm hỏng việc tự lưu; lần sau worker sẽ không xử lý lại intake này.
    }
  }
}

export async function chayWorkerIntake(): Promise<KetQuaHetHan[]> {
  const config = await docCauHinhIntake()
  const items = await xuLyHetHanChiTiet()
  await thongBaoHetHanTelegram(config, items)
  return items
}
