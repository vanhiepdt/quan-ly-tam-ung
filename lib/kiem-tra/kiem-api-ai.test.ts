import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kiemThuApi, layDanhSachMoHinh, pingHello, trichDanhSachMoHinh, trichTraLoiPing } from './kiem-api-ai'
import type { CauHinhAi } from './cau-hinh-ai'

function cauHinh(overrides: Partial<CauHinhAi> = {}): CauHinhAi {
  return {
    dangHoatDong: true, nhaCungCap: 'openai', moHinh: 'gpt-4o',
    khoaApi: 'sk-test', urlCoSo: '', ...overrides,
  }
}

describe('trích danh sách model', () => {
  it('đọc OpenAI data[].id, Anthropic data[].id, Gemini models[].name', () => {
    expect(trichDanhSachMoHinh({ data: [{ id: 'gpt-4o' }, { id: 'o4-mini' }] })).toEqual(['gpt-4o', 'o4-mini'])
    expect(trichDanhSachMoHinh({ data: [{ id: 'claude-sonnet-5' }] })).toEqual(['claude-sonnet-5'])
    expect(trichDanhSachMoHinh({ models: [{ name: 'models/gemini-2.5-flash' }] })).toEqual(['gemini-2.5-flash'])
  })

  it('cắt còn 200 tên, bỏ trùng', () => {
    const data = Array.from({ length: 250 }, (_, i) => ({ id: `m${i % 220}` }))
    expect(trichDanhSachMoHinh({ data })).toHaveLength(200)
  })
})

describe('trích chữ ping', () => {
  it('đọc content rỗng của gpt-5/o-series là không có chữ', () => {
    expect(trichTraLoiPing({
      choices: [{ finish_reason: 'length', message: { role: 'assistant', content: '', refusal: null } }],
    })).toBe('')
    expect(trichTraLoiPing({
      choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null } }],
    })).toBe('')
  })

  it('đọc content mảng hoặc reasoning_content', () => {
    expect(trichTraLoiPing({
      choices: [{ message: { content: [{ type: 'text', text: 'hello' }] } }],
    })).toBe('hello')
    expect(trichTraLoiPing({
      choices: [{ message: { content: '', reasoning_content: 'suy nghĩ' } }],
    })).toBe('suy nghĩ')
  })
})

describe('gọi API danh sách / test', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('không gọi mạng khi thiếu khóa', async () => {
    expect(await layDanhSachMoHinh(cauHinh({ khoaApi: '' }))).toEqual({
      loi: 'Chưa có khóa OpenAI. Điền khóa, hoặc lưu rồi thử lại.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('OpenAI GET /models, không lộ khóa trong kết quả', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4.1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      })
    const kq = await kiemThuApi(cauHinh())
    expect(kq).toMatchObject({
      thanhCong: 'Kết nối OpenAI thành công. Có 2 model. Chat trả “ok”.',
      moHinh: ['gpt-4o', 'gpt-4.1'],
    })
    expect(JSON.stringify(kq)).not.toContain('sk-test')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/models')
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer sk-test')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/chat/completions')
    const ping = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(ping.model).toBe('gpt-4o')
    expect(ping.max_tokens).toBe(16)
    expect('nhatKy' in kq && kq.nhatKy?.some(d => d.includes('HTTP 200'))).toBe(true)
  })

  it('DeepSeek Test API thành công kèm cảnh báo không đọc ảnh', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      })
    const kq = await kiemThuApi(cauHinh({ nhaCungCap: 'deepseek', moHinh: 'deepseek-chat' }))
    expect(kq).toMatchObject({
      thanhCong: 'Kết nối DeepSeek thành công. Có 2 model. Chat trả “ok”. Nhà này không đọc ảnh hóa đơn — lớp AI chỉ đối chiếu chữ OCR trên PDF.',
      moHinh: ['deepseek-chat', 'deepseek-reasoner'],
    })
    expect(JSON.stringify(kq)).not.toContain('sk-test')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/models')
  })

  it('Anthropic x-api-key, Gemini x-goog-api-key không nhét khóa vào URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ data: [{ id: 'claude-sonnet-5' }] }),
    })
    await layDanhSachMoHinh(cauHinh({ nhaCungCap: 'anthropic', moHinh: 'claude-sonnet-5' }))
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models')
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('sk-test')

    fetchMock.mockClear()
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ models: [{ name: 'models/gemini-2.5-flash' }] }),
    })
    await layDanhSachMoHinh(cauHinh({ nhaCungCap: 'google', moHinh: 'gemini-2.5-flash', khoaApi: 'gem-khoa' }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models')
    expect(url).not.toContain('gem-khoa')
    expect(init.headers['x-goog-api-key']).toBe('gem-khoa')
  })

  it('401 thì báo khóa sai, model gõ tay không có trong danh sách thì vẫn kết nối được', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    expect(await kiemThuApi(cauHinh())).toMatchObject({ loi: 'Khóa OpenAI không hợp lệ.' })

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) })
      .mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      })
    const kq = await kiemThuApi(cauHinh({ moHinh: 'model-tu-dat' }))
    expect('thanhCong' in kq && kq.thanhCong).toMatch(/Chat trả “ok”/)
    expect('moHinh' in kq && kq.moHinh).toEqual(['model-tu-dat', 'gpt-4o'])
  })

  it('Test API: /models được nhưng chat 400 thì báo lỗi thật, không nói thành công', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'gpt-5' }] }) })
      .mockResolvedValueOnce({
        ok: false, status: 400,
        text: async () => JSON.stringify({ error: { message: 'Unsupported parameter: max_tokens', code: 'unsupported_parameter' } }),
      })
    const kq = await kiemThuApi(cauHinh({ moHinh: 'gpt-5' }))
    expect('loi' in kq && kq.loi).toMatch(/gọi chat thất bại/i)
    expect('loi' in kq && kq.loi).toMatch(/max_tokens/)
    expect('moHinh' in kq && kq.moHinh).toEqual(['gpt-5'])
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })

  it('API ngoài: gọi /models, từ chối metadata', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ data: [{ id: 'llava' }] }),
    })
    const kq = await layDanhSachMoHinh(cauHinh({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://127.0.0.1:11434/v1',
    }))
    expect(kq).toEqual({ moHinh: ['llava'] })
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/models')

    fetchMock.mockClear()
    expect(await layDanhSachMoHinh(cauHinh({
      nhaCungCap: 'custom', moHinh: 'x', urlCoSo: 'http://169.254.169.254/',
    }))).toEqual({ loi: 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GET /models ném lỗi mạng thì ghi nguyên nhân, không lộ khóa', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) })
    fetchMock.mockRejectedValueOnce(err)
    const kq = await layDanhSachMoHinh(cauHinh())
    expect('loi' in kq && kq.loi).toMatch(/Không gọi được OpenAI/)
    expect('loi' in kq && kq.loi).toMatch(/ECONNREFUSED|fetch failed/)
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })

  it('chứng chỉ tự ký thì nói antivirus/proxy, không tắt HTTPS', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('self-signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }),
    }))
    const kq = await layDanhSachMoHinh(cauHinh())
    expect('loi' in kq && kq.loi).toMatch(/chứng chỉ tự ký/)
    expect('loi' in kq && kq.loi).toMatch(/antivirus/)
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })

  it('OpenAI GET /models lọc whisper/dall-e, giữ model đang chọn', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ data: [{ id: 'whisper-1' }, { id: 'dall-e-3' }, { id: 'gpt-4o' }, { id: 'o4-mini' }] }),
    })
    const kq = await layDanhSachMoHinh(cauHinh({ moHinh: 'gpt-5' }))
    expect(kq).toEqual({ moHinh: ['gpt-5', 'gpt-4o', 'o4-mini'] })
  })

  it('Gửi hello không cần GET /models, hiện chữ trả lời', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
    })
    const kq = await pingHello(cauHinh())
    expect(kq).toMatchObject({ thanhCong: 'OpenAI trả lời: “hello”.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    expect('nhatKy' in kq && kq.nhatKy?.some(d => d.includes('ping trả lời: hello'))).toBe(true)
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })

  it('Test API: GET /models lỗi mạng vẫn gửi hello và ghi cả hai bước', async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }))
      .mockResolvedValueOnce({
        ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'hello' } }] }),
      })
    const kq = await kiemThuApi(cauHinh())
    expect('loi' in kq && kq.loi).toMatch(/Chat chạy được/)
    expect('loi' in kq && kq.loi).toMatch(/ENOTFOUND|fetch failed/)
    expect('nhatKy' in kq && kq.nhatKy?.some(d => /GET mạng/.test(d))).toBe(true)
    expect('nhatKy' in kq && kq.nhatKy?.some(d => d.includes('ping trả lời: hello'))).toBe(true)
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })

  it('gpt-5 ping dùng max_completion_tokens 256, HTTP 200 không chữ vẫn tính kết nối', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
        usage: { completion_tokens: 80, completion_tokens_details: { reasoning_tokens: 80 } },
      }),
    })
    const kq = await pingHello(cauHinh({ moHinh: 'gpt-5' }))
    expect('thanhCong' in kq).toBe(true)
    expect('thanhCong' in kq && kq.thanhCong).toMatch(/HTTP 200/)
    const than = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(than.max_completion_tokens).toBe(256)
    expect('max_tokens' in than).toBe(false)
    expect(JSON.stringify(kq)).not.toContain('sk-test')
  })
})
