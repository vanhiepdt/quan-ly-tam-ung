import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { danhGiaTinhTrangAi, docJsonAi, goiAiTheoCauHinh, kiemTraCauHinhAi, moHinhCanMaxCompletion } from './ai-hoa-don'
import type { CauHinhAi } from './cau-hinh-ai'

const png = Buffer.from('png')
const jsonHd = JSON.stringify({ soHd: '1', tongTien: 1000 })

function cauHinh(overrides: Partial<CauHinhAi> = {}): CauHinhAi {
  return {
    dangHoatDong: true, nhaCungCap: 'anthropic', moHinh: 'claude-sonnet-5',
    khoaApi: 'khoa-test', urlCoSo: '', ...overrides,
  }
}

describe('đọc JSON lớp AI', () => {
  it('lấy trường hóa đơn từ JSON thuần', () => {
    expect(docJsonAi(JSON.stringify({
      kyHieuHd: '1C26MTT', soHd: '12', ngay: '17/09/2026',
      mstBanHang: '010-123-4567', tenBanHang: 'Nhà hàng A',
      mstMuaHang: '0100695387-066', tenMuaHang: 'Trung tâm Đào tạo',
      diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội',
      tongTien: 200_000, tienRuouBia: 50_000,
      loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
      dongHang: [{ ten: 'Bia Tiger', thanhTien: 50_000, tienThue: 5_000, thueSuat: 10, laRuouBia: true }],
    }))).toMatchObject({
      kyHieuHd: '1C26MTT', soHd: '12', ngay: '2026-09-17',
      mstBanHang: '0101234567', mstMuaHang: '0100695387066',
      diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội',
      tongTien: 200_000, tienRuouBia: 50_000, loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
    })
  })

  it('chấp nhận JSON bọc trong markdown', () => {
    expect(docJsonAi('```json\n{"soHd":"1","tongTien":1000}\n```').soHd).toBe('1')
  })

  it('AI không ghi tienRuouBia thì cộng dòng rượu bia đã gắn', () => {
    expect(docJsonAi(JSON.stringify({
      soHd: '1', tongTien: 1_000_000, loaiHd: 'gtgt', cotTienHang: 'truoc_thue',
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, laRuouBia: true },
        { ten: 'Dê cuốn mỡ chài', thanhTien: 351_491, laRuouBia: false },
        { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, laRuouBia: true },
      ],
    })).tienRuouBia).toBe(622_600)
  })

  it('từ chối JSON thiếu khuôn', () => {
    expect(() => docJsonAi('không phải json')).toThrow()
    expect(() => docJsonAi('{"tongTien":-1}')).toThrow()
  })
})

describe('kiểm tra cấu hình trước khi gọi', () => {
  it('báo rõ khi tắt, thiếu khóa, thiếu model, URL ngoài không hợp lệ', () => {
    expect(kiemTraCauHinhAi(cauHinh({ dangHoatDong: false }))).toMatch(/đang tắt/)
    expect(kiemTraCauHinhAi(cauHinh({ khoaApi: '' }))).toMatch(/Chưa cấu hình khóa/)
    expect(kiemTraCauHinhAi(cauHinh({ moHinh: '  ' }))).toMatch(/Chưa chọn model/)
    expect(kiemTraCauHinhAi(cauHinh({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: '',
    }))).toMatch(/Chưa điền URL/)
    expect(kiemTraCauHinhAi(cauHinh({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://169.254.169.254/',
    }))).toMatch(/không hợp lệ/)
    expect(kiemTraCauHinhAi(cauHinh())).toBeNull()
  })
})

describe('đánh giá tình trạng AI trước khi quét', () => {
  it('cảnh báo DeepSeek không đọc ảnh, lỗi khi thiếu khóa, sẵn sàng khi Claude có khóa', () => {
    const ds = danhGiaTinhTrangAi(cauHinh({ nhaCungCap: 'deepseek', moHinh: 'deepseek-chat' }))
    expect(ds).toMatchObject({ muc: 'canh_bao', docAnh: false, nha: 'DeepSeek', moHinh: 'deepseek-chat' })
    expect(ds.thongDiep).toMatch(/không đọc được ảnh/i)
    expect(JSON.stringify(ds)).not.toContain('khoa-test')

    expect(danhGiaTinhTrangAi(cauHinh({ khoaApi: '' }))).toMatchObject({ muc: 'loi', docAnh: true })
    expect(danhGiaTinhTrangAi(cauHinh({ dangHoatDong: false })).muc).toBe('canh_bao')
    expect(danhGiaTinhTrangAi(cauHinh())).toMatchObject({
      muc: 'ok', nha: 'Anthropic (Claude)', moHinh: 'claude-sonnet-5', docAnh: true,
    })
  })
})

describe('gọi AI theo nhà cung cấp', () => {
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
    const kq = await goiAiTheoCauHinh(png, cauHinh({ khoaApi: '' }))
    expect('loi' in kq && kq.loi).toMatch(/Chưa cấu hình khóa/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Anthropic: x-api-key, đọc content[].text', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ content: [{ type: 'text', text: jsonHd }] }),
    })
    const kq = await goiAiTheoCauHinh(png, cauHinh())
    expect(kq).toMatchObject({ duLieu: expect.objectContaining({ soHd: '1', tongTien: 1000 }) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('khoa-test')
    expect(init.headers.authorization).toBeUndefined()
    const body = JSON.parse(init.body)
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.messages[0].content.some((c: { type: string }) => c.type === 'image')).toBe(true)
  })

  it('OpenAI: Bearer, gửi ảnh', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: jsonHd } }] }),
    })
    const kq = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'openai', moHinh: 'gpt-4o', khoaApi: 'sk-oa',
    }))
    expect(kq).toMatchObject({ duLieu: expect.objectContaining({ soHd: '1' }) })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.authorization).toBe('Bearer sk-oa')
    const body = JSON.parse(init.body)
    expect(body.messages[0].content.some((c: { type: string }) => c.type === 'image_url')).toBe(true)
    expect(body.max_tokens).toBe(2500)
    expect(body.max_completion_tokens).toBeUndefined()
    expect(JSON.stringify(kq)).not.toContain('sk-oa')
  })

  it('gpt-5 / o-series dùng max_completion_tokens, không gửi max_tokens', async () => {
    expect(moHinhCanMaxCompletion('gpt-5')).toBe(true)
    expect(moHinhCanMaxCompletion('gpt-4o')).toBe(false)
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: jsonHd } }] }),
    })
    await goiAiTheoCauHinh(png, cauHinh({ nhaCungCap: 'openai', moHinh: 'gpt-5', khoaApi: 'sk-oa' }))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.max_completion_tokens).toBe(2500)
    expect(body.max_tokens).toBeUndefined()
    expect(body.temperature).toBeUndefined()
  })

  it('OpenAI 400 max_tokens thì thử lại max_completion_tokens', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false, status: 400,
        text: async () => JSON.stringify({ error: { message: 'Unsupported parameter: max_tokens' } }),
      })
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ choices: [{ message: { content: jsonHd } }] }),
      })
    const kq = await goiAiTheoCauHinh(png, cauHinh({ nhaCungCap: 'openai', moHinh: 'gpt-4o', khoaApi: 'sk-oa' }))
    expect(kq).toEqual(expect.objectContaining({ duLieu: expect.objectContaining({ soHd: '1' }) }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_completion_tokens).toBe(2500)
  })

  it('DeepSeek: Bearer, chỉ gửi chữ OCR, không gửi ảnh', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: jsonHd } }] }),
    })
    const ocr = JSON.stringify({ tenMuaHang: 'Trung tâm Đào tạo', mstMuaHang: '0100695387066' })
    const kq = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'deepseek', moHinh: 'deepseek-chat', khoaApi: 'sk-ds',
    }), undefined, ocr)
    expect(kq).toMatchObject({ duLieu: expect.objectContaining({ soHd: '1' }) })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.headers.authorization).toBe('Bearer sk-ds')
    const body = JSON.parse(init.body)
    expect(typeof body.messages[0].content).toBe('string')
    expect(body.messages[0].content).toContain('tenMuaHang')
    expect(JSON.stringify(body)).not.toContain('image_url')
    expect(JSON.stringify(body)).not.toContain(png.toString('base64'))
    expect(body.max_tokens).toBe(2500)
  })

  it('DeepSeek không gọi mạng khi không có chữ OCR', async () => {
    const kq = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'deepseek', moHinh: 'deepseek-chat', khoaApi: 'sk-ds',
    }))
    expect('loi' in kq && kq.loi).toMatch(/không đọc ảnh/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('DeepSeek reasoner: đọc reasoning_content khi content rỗng', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: '', reasoning_content: jsonHd } }] }),
    })
    const kq = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'deepseek', moHinh: 'deepseek-reasoner', khoaApi: 'sk-ds',
    }), undefined, '{"soHd":"1"}')
    expect(kq).toMatchObject({ duLieu: expect.objectContaining({ soHd: '1' }) })
  })

  it('Gemini: x-goog-api-key, không nhét khóa vào URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: jsonHd }] } }] }),
    })
    await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'google', moHinh: 'gemini-2.5-flash', khoaApi: 'gem-khoa',
    }))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(url).not.toContain('gem-khoa')
    expect(init.headers['x-goog-api-key']).toBe('gem-khoa')
  })

  it('API ngoài: gọi URL đã cấu hình, từ chối metadata', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: jsonHd } }] }),
    })
    const kq = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: 'http://127.0.0.1:11434/v1',
    }))
    expect('duLieu' in kq).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions')

    fetchMock.mockClear()
    const cam = await goiAiTheoCauHinh(png, cauHinh({
      nhaCungCap: 'custom', moHinh: 'x', urlCoSo: 'http://169.254.169.254/',
    }))
    expect('loi' in cam && cam.loi).toMatch(/không hợp lệ/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('401 thì báo khóa sai, JSON hỏng thì không ném', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const kq401 = await goiAiTheoCauHinh(png, cauHinh())
    expect(kq401).toEqual(expect.objectContaining({
      loi: 'Khóa Anthropic (Claude) không hợp lệ. Chỉ dùng dữ liệu QR.',
    }))
    expect('nhatKy' in kq401 && kq401.nhatKy?.some(d => d.includes('HTTP 401'))).toBe(true)
    expect(JSON.stringify(kq401)).not.toContain('khoa-test')
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ content: [{ type: 'text', text: 'không phải json' }] }),
    })
    expect(await goiAiTheoCauHinh(png, cauHinh())).toEqual(expect.objectContaining({
      loi: 'AI trả dữ liệu không đọc được. Chỉ dùng dữ liệu QR.',
    }))
  })

  it('OpenAI hết hạn mức thì nói rõ, không nhầm còn credit', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 429,
      text: async () => JSON.stringify({ error: { message: 'You exceeded your current quota, please check your plan and billing details.', type: 'insufficient_quota' } }),
    })
    const kq = await goiAiTheoCauHinh(png, cauHinh({ nhaCungCap: 'openai', moHinh: 'gpt-4o', khoaApi: 'sk-oa' }))
    expect('loi' in kq && kq.loi).toMatch(/hết hạn mức|quota/i)
    expect(JSON.stringify(kq)).not.toContain('sk-oa')
  })
})
