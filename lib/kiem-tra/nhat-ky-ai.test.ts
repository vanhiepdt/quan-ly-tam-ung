import { describe, expect, it } from 'vitest'
import { anChuoiNhatKy, dauKhoa, moTaLoiMang, trichThongDiepLoiAi } from './nhat-ky-ai'

describe('nhật ký AI', () => {
  it('che khóa, ảnh base64, giữ host URL', () => {
    expect(anChuoiNhatKy('Bearer sk-abc123456789 và data:image/png;base64,AAA=', 'sk-abc123456789'))
      .toBe('Bearer [khoa] và [anh]')
    expect(anChuoiNhatKy('gọi https://api.openai.com/v1/chat/completions?key=sk-aaaaaaaa'))
      .toBe('gọi https://api.openai.com/v1/chat/completions')
    expect(JSON.stringify(anChuoiNhatKy('sk-secretsecretsecret'))).not.toContain('sk-secret')
  })

  it('mô tả khóa không lộ bản thân khóa', () => {
    expect(dauKhoa('')).toBe('không')
    expect(dauKhoa('sk-abcdefghijklmnopqrstuvwxyz')).toBe('…wxyz (29 ký tự)')
    expect(dauKhoa('sk-abcdefghijklmnopqrstuvwxyz')).not.toContain('sk-abcdefghijklmnop')
  })

  it('trích message/code từ JSON lỗi OpenAI', () => {
    expect(trichThongDiepLoiAi({
      error: { message: 'Unsupported parameter: max_tokens', code: 'unsupported_parameter', type: 'invalid_request_error' },
    })).toMatch(/max_tokens/)
    expect(trichThongDiepLoiAi({ error: 'nope' })).toBe('nope')
  })

  it('mô tả lỗi mạng gồm code Node, không lộ khóa', () => {
    const err = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }),
    })
    expect(moTaLoiMang(err)).toMatch(/ECONNREFUSED/)
    expect(moTaLoiMang(err)).toMatch(/fetch failed/)
    expect(moTaLoiMang('x')).toBe('lỗi mạng')
  })
})
