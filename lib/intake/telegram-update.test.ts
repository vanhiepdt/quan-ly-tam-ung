import { describe, expect, it } from 'vitest'
import { allowlisted, parseTelegramUpdate } from './telegram-update'

describe('parseTelegramUpdate', () => {
  it('lấy ảnh lớn nhất trong message photo', () => {
    const event = parseTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 22,
        chat: { id: -100123 },
        from: { id: 456 },
        photo: [
          { file_id: 'small', width: 100, height: 100, file_size: 1000 },
          { file_id: 'large', width: 1200, height: 900, file_size: 9000 },
        ],
        caption: 'không dùng caption làm số tiền',
      },
    })
    expect(event).toEqual(expect.objectContaining({ loai: 'tep', chatId: '-100123', userId: '456', fileId: 'large', messageId: '22' }))
    expect(allowlisted([{ loai: 'chat', giaTri: '-100123' }], event!)).toBe(true)
  })

  it('nhận document PDF và giữ tên gốc, không tin mime để bỏ qua kiểm magic-byte', () => {
    const event = parseTelegramUpdate({
      message: {
        message_id: 23,
        chat: { id: 7 },
        from: { id: 8 },
        document: { file_id: 'file-1', file_name: 'hoa-don.pdf', mime_type: 'application/pdf', file_size: 1234 },
      },
    })
    expect(event).toMatchObject({ loai: 'tep', fileId: 'file-1', tenGoc: 'hoa-don.pdf', mime: 'application/pdf', kichThuoc: 1234 })
  })

  it('parse callback và từ chối update thiếu user/chat/message', () => {
    expect(parseTelegramUpdate({ callback_query: {
      id: 'query-1', from: { id: 8 }, message: { message_id: 23, chat: { id: 7 } }, data: 'intake:id:save',
    } })).toEqual({ loai: 'callback', queryId: 'query-1', chatId: '7', userId: '8', messageId: '23', data: 'intake:id:save' })
    expect(parseTelegramUpdate({ message: { message_id: 1, chat: { id: 7 }, text: '/start' } })).toBeNull()
  })
})

