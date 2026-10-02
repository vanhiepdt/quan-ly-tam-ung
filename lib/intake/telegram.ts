const API = 'https://api.telegram.org'
const GIOI_HAN = 10 * 1024 * 1024

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string }
export type TelegramKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }

async function goi<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  if (!token) throw new Error('Chưa cấu hình token bot Telegram.')
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => null) as TelegramResponse<T> | null
  if (!response.ok || !data?.ok || data.result === undefined) throw new Error('Telegram không nhận yêu cầu.')
  return data.result
}

export async function telegramSendMessage(token: string, chatId: string, text: string, keyboard?: TelegramKeyboard): Promise<void> {
  await goi(token, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    ...(keyboard ? { reply_markup: keyboard } : {}),
  })
}

export async function telegramAnswerCallback(token: string, queryId: string, text?: string): Promise<void> {
  await goi(token, 'answerCallbackQuery', { callback_query_id: queryId, ...(text ? { text: text.slice(0, 180) } : {}) })
}

export async function telegramSetWebhook(token: string, url: string, secretToken: string): Promise<void> {
  await goi(token, 'setWebhook', { url, secret_token: secretToken, allowed_updates: ['message', 'callback_query'] })
}

export async function telegramGetWebhookInfo(token: string): Promise<{ url: string; pending_update_count: number }> {
  return goi(token, 'getWebhookInfo', {})
}

export async function telegramDownloadFile(token: string, fileId: string, tenGoc: string, mime: string | null, kichThuoc: number | null): Promise<File> {
  if (kichThuoc !== null && kichThuoc > GIOI_HAN) throw new Error('Tệp phải không quá 10 MB.')
  const info = await goi<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId })
  if (!info.file_path || (info.file_size ?? 0) > GIOI_HAN) throw new Error('Tệp phải không quá 10 MB.')
  const response = await fetch(`${API}/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(30000) })
  if (!response.ok || !response.body) throw new Error('Không tải được file từ Telegram.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > GIOI_HAN) throw new Error('Tệp phải không quá 10 MB.')
      chunks.push(part.value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  return new File([Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))], tenGoc, { type: mime || 'application/octet-stream' })
}
