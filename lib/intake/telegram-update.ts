export type TelegramFileEvent = {
  loai: 'tep'
  chatId: string
  userId: string
  messageId: string
  fileId: string
  tenGoc: string
  mime: string | null
  kichThuoc: number | null
  caption: string | null
}

export type TelegramTextEvent = {
  loai: 'van_ban'
  chatId: string
  userId: string
  messageId: string
  text: string
}

export type TelegramCallbackEvent = {
  loai: 'callback'
  queryId: string
  chatId: string
  userId: string
  messageId: string
  data: string
}

export type TelegramUpdateEvent = TelegramFileEvent | TelegramTextEvent | TelegramCallbackEvent

function object(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function text(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function id(v: unknown): string | null {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return String(v)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function userAndChat(message: Record<string, unknown>): { chatId: string; userId: string } | null {
  const chat = object(message.chat)
  const from = object(message.from)
  const chatId = id(chat?.id)
  const userId = id(from?.id)
  return chatId && userId ? { chatId, userId } : null
}

export function parseTelegramUpdate(input: unknown): TelegramUpdateEvent | null {
  const update = object(input)
  if (!update) return null

  const callback = object(update.callback_query)
  if (callback) {
    const from = object(callback.from)
    const message = object(callback.message)
    const context = message ? userAndChat({ ...message, from }) : null
    const queryId = id(callback.id)
    const data = text(callback.data)
    const messageId = id(message?.message_id)
    if (queryId && context && data && messageId) return {
      loai: 'callback', queryId, chatId: context.chatId, userId: context.userId, messageId, data,
    }
    return null
  }

  const message = object(update.message)
  if (!message) return null
  const context = userAndChat(message)
  const messageId = id(message.message_id)
  if (!context || !messageId) return null

  const photo = Array.isArray(message.photo) ? message.photo.map(object).filter(Boolean) : []
  if (photo.length) {
    const largest = photo.at(-1)!
    const fileId = id(largest.file_id)
    if (fileId) return {
      loai: 'tep', chatId: context.chatId, userId: context.userId, messageId, fileId,
      tenGoc: `hoa-don-${messageId}.jpg`, mime: 'image/jpeg',
      kichThuoc: typeof largest.file_size === 'number' ? largest.file_size : null,
      caption: text(message.caption),
    }
  }

  const document = object(message.document)
  if (document) {
    const fileId = id(document.file_id)
    if (fileId) return {
      loai: 'tep', chatId: context.chatId, userId: context.userId, messageId, fileId,
      tenGoc: text(document.file_name)?.slice(0, 255) || `hoa-don-${messageId}`,
      mime: text(document.mime_type),
      kichThuoc: typeof document.file_size === 'number' ? document.file_size : null,
      caption: text(message.caption),
    }
  }

  const messageText = text(message.text)
  if (messageText !== null) return { loai: 'van_ban', chatId: context.chatId, userId: context.userId, messageId, text: messageText }
  return null
}

export function allowlisted(allowlist: readonly { loai: 'user' | 'chat'; giaTri: string }[], event: Pick<TelegramUpdateEvent, 'chatId' | 'userId'>): boolean {
  return allowlist.some(item => (item.loai === 'user' && item.giaTri === event.userId) || (item.loai === 'chat' && item.giaTri === event.chatId))
}
