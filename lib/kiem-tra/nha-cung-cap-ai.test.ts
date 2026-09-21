import { describe, expect, it } from 'vitest'
import {
  ID_NHA_CUNG_CAP, NHA_CUNG_CAP_AI, laNhaCungCapId, locMoHinhHienThi, moHinhCanMaxCompletion, nhaDocAnh, timNhaCungCap, urlAnToan, urlDanhSachMoHinh, urlGoiAi,
} from './nha-cung-cap-ai'

describe('catalog nhà cung cấp AI', () => {
  it('có OpenAI đến DeepSeek và API ngoài', () => {
    expect(ID_NHA_CUNG_CAP).toEqual([
      'openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral',
      'xai', 'openrouter', 'together', 'fireworks', 'custom',
    ])
    expect(NHA_CUNG_CAP_AI.map(n => n.id)).toEqual([...ID_NHA_CUNG_CAP])
    expect(timNhaCungCap('deepseek')?.urlCoSo).toBe('https://api.deepseek.com')
    expect(laNhaCungCapId('openai')).toBe(true)
    expect(laNhaCungCapId('khong-co')).toBe(false)
    expect(timNhaCungCap('deepseek')?.docAnh).toBe(false)
    expect(nhaDocAnh(timNhaCungCap('deepseek'))).toBe(false)
    expect(nhaDocAnh(timNhaCungCap('openai'))).toBe(true)
    expect(nhaDocAnh(timNhaCungCap('anthropic'))).toBe(true)
    expect(moHinhCanMaxCompletion('gpt-5')).toBe(true)
    expect(moHinhCanMaxCompletion('o4-mini')).toBe(true)
    expect(moHinhCanMaxCompletion('gpt-4o')).toBe(false)
    expect(moHinhCanMaxCompletion('deepseek-chat')).toBe(false)
    expect(locMoHinhHienThi('openai', ['gpt-4o', 'dall-e-3', 'whisper-1', 'o4-mini', 'text-embedding-3-small'], 'gpt-5'))
      .toEqual(['gpt-5', 'gpt-4o', 'o4-mini'])
    expect(locMoHinhHienThi('deepseek', ['deepseek-chat', 'deepseek-reasoner'], 'deepseek-chat'))
      .toEqual(['deepseek-chat', 'deepseek-reasoner'])
  })

  it('suy ra URL gọi theo giao thức', () => {
    expect(urlGoiAi({ nhaCungCap: 'anthropic', moHinh: 'claude-sonnet-5', urlCoSo: '' }))
      .toBe('https://api.anthropic.com/v1/messages')
    expect(urlGoiAi({ nhaCungCap: 'openai', moHinh: 'gpt-4o', urlCoSo: '' }))
      .toBe('https://api.openai.com/v1/chat/completions')
    expect(urlGoiAi({ nhaCungCap: 'deepseek', moHinh: 'deepseek-chat', urlCoSo: '' }))
      .toBe('https://api.deepseek.com/chat/completions')
    expect(urlGoiAi({ nhaCungCap: 'google', moHinh: 'gemini-2.5-flash', urlCoSo: '' }))
      .toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(urlGoiAi({ nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://127.0.0.1:11434/v1' }))
      .toBe('http://127.0.0.1:11434/v1/chat/completions')
    expect(urlGoiAi({ nhaCungCap: 'custom', moHinh: 'x', urlCoSo: 'https://host/v1/chat/completions' }))
      .toBe('https://host/v1/chat/completions')
    expect(urlGoiAi({ nhaCungCap: 'custom', moHinh: 'x', urlCoSo: '' })).toBeNull()
  })

  it('suy ra URL danh sách model', () => {
    expect(urlDanhSachMoHinh({ nhaCungCap: 'anthropic', moHinh: 'x', urlCoSo: '' }))
      .toBe('https://api.anthropic.com/v1/models')
    expect(urlDanhSachMoHinh({ nhaCungCap: 'openai', moHinh: 'x', urlCoSo: '' }))
      .toBe('https://api.openai.com/v1/models')
    expect(urlDanhSachMoHinh({ nhaCungCap: 'google', moHinh: 'x', urlCoSo: '' }))
      .toBe('https://generativelanguage.googleapis.com/v1beta/models')
    expect(urlDanhSachMoHinh({ nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://127.0.0.1:11434/v1' }))
      .toBe('http://127.0.0.1:11434/v1/models')
    expect(urlDanhSachMoHinh({ nhaCungCap: 'custom', moHinh: 'x', urlCoSo: 'https://host/v1/chat/completions' }))
      .toBe('https://host/v1/models')
    expect(urlDanhSachMoHinh({ nhaCungCap: 'custom', moHinh: 'x', urlCoSo: '' })).toBeNull()
  })

  it('chặn URL có credential hoặc metadata đám mây, cho phép localhost', () => {
    expect(urlAnToan('https://api.openai.com/v1')).toBe(true)
    expect(urlAnToan('http://127.0.0.1:11434/v1')).toBe(true)
    expect(urlAnToan('https://user:pass@host/v1')).toBe(false)
    expect(urlAnToan('http://169.254.169.254/latest')).toBe(false)
    expect(urlAnToan('http://metadata.google.internal/')).toBe(false)
    expect(urlAnToan('ftp://host/v1')).toBe(false)
    expect(urlAnToan('không phải url')).toBe(false)
  })
})
