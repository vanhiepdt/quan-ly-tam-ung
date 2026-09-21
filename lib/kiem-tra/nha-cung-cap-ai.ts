export const ID_NHA_CUNG_CAP = [
  'openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral',
  'xai', 'openrouter', 'together', 'fireworks', 'custom',
] as const

export type NhaCungCapId = typeof ID_NHA_CUNG_CAP[number]
export type GiaoThucAi = 'openai' | 'anthropic' | 'google'

export type NhaCungCapAi = {
  id: NhaCungCapId
  ten: string
  giaoThuc: GiaoThucAi
  urlCoSo: string
  moHinhMacDinh: string
  moHinhGoiY: readonly string[]
  moTa: string
  /** false = không gửi ảnh; lớp AI chỉ đối chiếu chữ OCR. */
  docAnh?: boolean
}

// Catalog dùng chung cho form Cài đặt (client) và lớp gọi AI (server). URL catalog
// không phải chỗ admin gõ — chỉ API ngoài mới điền URL tự do.
export const NHA_CUNG_CAP_AI: readonly NhaCungCapAi[] = [
  {
    id: 'openai', ten: 'OpenAI', giaoThuc: 'openai',
    urlCoSo: 'https://api.openai.com/v1',
    moHinhMacDinh: 'gpt-4o',
    moHinhGoiY: ['gpt-4o', 'gpt-4.1', 'gpt-5', 'o4-mini'],
    moTa: 'GPT có vision. Lấy khóa tại platform.openai.com.',
  },
  {
    id: 'anthropic', ten: 'Anthropic (Claude)', giaoThuc: 'anthropic',
    urlCoSo: 'https://api.anthropic.com',
    moHinhMacDinh: 'claude-sonnet-5',
    moHinhGoiY: ['claude-sonnet-5', 'claude-opus-4', 'claude-haiku-4-5'],
    moTa: 'Claude vision. Lấy khóa tại console.anthropic.com.',
  },
  {
    id: 'google', ten: 'Google Gemini', giaoThuc: 'google',
    urlCoSo: 'https://generativelanguage.googleapis.com/v1beta',
    moHinhMacDinh: 'gemini-2.5-flash',
    moHinhGoiY: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    moTa: 'Gemini đọc ảnh. Lấy khóa tại aistudio.google.com.',
  },
  {
    id: 'deepseek', ten: 'DeepSeek', giaoThuc: 'openai',
    urlCoSo: 'https://api.deepseek.com',
    moHinhMacDinh: 'deepseek-chat',
    moHinhGoiY: ['deepseek-chat', 'deepseek-reasoner'],
    docAnh: false,
    moTa: 'Kết nối được nhưng không đọc ảnh hóa đơn. Lớp AI chỉ đối chiếu chữ OCR trên PDF. Ảnh scan thì chọn Claude, Gemini hoặc GPT-4o.',
  },
  {
    id: 'groq', ten: 'Groq', giaoThuc: 'openai',
    urlCoSo: 'https://api.groq.com/openai/v1',
    moHinhMacDinh: 'meta-llama/llama-4-scout-17b-16e-instruct',
    moHinhGoiY: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview'],
    moTa: 'Chạy nhanh. Chọn model có vision.',
  },
  {
    id: 'mistral', ten: 'Mistral', giaoThuc: 'openai',
    urlCoSo: 'https://api.mistral.ai/v1',
    moHinhMacDinh: 'pixtral-large-latest',
    moHinhGoiY: ['pixtral-large-latest', 'pixtral-12b-2409', 'mistral-small-latest'],
    moTa: 'Pixtral đọc ảnh. Lấy khóa tại console.mistral.ai.',
  },
  {
    id: 'xai', ten: 'xAI (Grok)', giaoThuc: 'openai',
    urlCoSo: 'https://api.x.ai/v1',
    moHinhMacDinh: 'grok-2-vision-latest',
    moHinhGoiY: ['grok-2-vision-latest', 'grok-2-latest'],
    moTa: 'Grok vision. Lấy khóa tại console.x.ai.',
  },
  {
    id: 'openrouter', ten: 'OpenRouter', giaoThuc: 'openai',
    urlCoSo: 'https://openrouter.ai/api/v1',
    moHinhMacDinh: 'openai/gpt-4o',
    moHinhGoiY: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash'],
    moTa: 'Một khóa gọi được nhiều nhà. Tên model dạng nhà/model.',
  },
  {
    id: 'together', ten: 'Together AI', giaoThuc: 'openai',
    urlCoSo: 'https://api.together.xyz/v1',
    moHinhMacDinh: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    moHinhGoiY: ['meta-llama/Llama-4-Scout-17B-16E-Instruct'],
    moTa: 'API tương thích OpenAI. Chọn model có vision.',
  },
  {
    id: 'fireworks', ten: 'Fireworks', giaoThuc: 'openai',
    urlCoSo: 'https://api.fireworks.ai/inference/v1',
    moHinhMacDinh: 'accounts/fireworks/models/llama4-scout-instruct-basic',
    moHinhGoiY: ['accounts/fireworks/models/llama4-scout-instruct-basic'],
    moTa: 'API tương thích OpenAI. Chọn model có vision.',
  },
  {
    id: 'custom', ten: 'API ngoài', giaoThuc: 'openai',
    urlCoSo: '',
    moHinhMacDinh: '',
    moHinhGoiY: [],
    moTa: 'Endpoint tương thích OpenAI Chat Completions. Điền URL cơ sở (thường kết thúc /v1) và model có vision — ví dụ Ollama, vLLM, Azure.',
  },
]

export function timNhaCungCap(id: string): NhaCungCapAi | undefined {
  return NHA_CUNG_CAP_AI.find(n => n.id === id)
}

export function laNhaCungCapId(id: string): id is NhaCungCapId {
  return (ID_NHA_CUNG_CAP as readonly string[]).includes(id)
}

// Chặn URL có credential và cổng metadata đám mây. Localhost và LAN vẫn cho phép vì
// admin có thể trỏ Ollama chạy trên chính VPS.
export function urlAnToan(giaTri: string): boolean {
  try {
    const u = new URL(giaTri)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    if (u.username || u.password) return false
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (host === '169.254.169.254' || host.endsWith('.169.254.169.254')) return false
    if (host === '::ffff:169.254.169.254') return false
    if (host === 'metadata.google.internal' || host === 'metadata.goog') return false
    return true
  } catch {
    return false
  }
}

export type CauHinhAiGoi = {
  nhaCungCap: NhaCungCapId
  moHinh: string
  urlCoSo: string
}

export function urlGoiAi(cauHinh: CauHinhAiGoi): string | null {
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  if (!nha) return null
  if (nha.giaoThuc === 'anthropic') return `${nha.urlCoSo}/v1/messages`
  if (nha.giaoThuc === 'google') {
    if (!cauHinh.moHinh.trim()) return null
    return `${nha.urlCoSo}/models/${encodeURIComponent(cauHinh.moHinh.trim())}:generateContent`
  }
  const coSo = (cauHinh.nhaCungCap === 'custom' ? cauHinh.urlCoSo : nha.urlCoSo).replace(/\/+$/, '')
  if (!coSo) return null
  if (/\/chat\/completions$/i.test(coSo)) return coSo
  return `${coSo}/chat/completions`
}

export function nhaDocAnh(nha: NhaCungCapAi | undefined): boolean {
  return nha?.docAnh !== false
}

// gpt-5 / o-series từ chối max_tokens + temperature. Dùng max_completion_tokens.
export function moHinhCanMaxCompletion(moHinh: string): boolean {
  const m = moHinh.trim()
  return /^(gpt-5|o\d|chatgpt-)/i.test(m) || /(^|\/)(gpt-5|o1|o3|o4)([./-]|$)/i.test(m)
}

const BO_OPENAI = /(embed|whisper|tts|transcribe|realtime|dall-e|moderation|sora|babbage|davinci|ada-|canary|audio|image)/i

export function locMoHinhHienThi(nhaId: string, ds: readonly string[], dangChon = ''): string[] {
  let loc = [...ds]
  if (nhaId === 'openai') {
    loc = loc.filter(m => /^(gpt-|o[1-9]|chatgpt-|omni)/i.test(m) && !BO_OPENAI.test(m))
  }
  const chon = dangChon.trim()
  if (chon && !loc.includes(chon)) loc = [chon, ...loc]
  return loc.slice(0, 80)
}

export function urlDanhSachMoHinh(cauHinh: CauHinhAiGoi): string | null {
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  if (!nha) return null
  if (nha.giaoThuc === 'anthropic') return `${nha.urlCoSo}/v1/models`
  if (nha.giaoThuc === 'google') return `${nha.urlCoSo}/models`
  const coSo = (cauHinh.nhaCungCap === 'custom' ? cauHinh.urlCoSo : nha.urlCoSo).replace(/\/+$/, '')
  if (!coSo) return null
  if (/\/models$/i.test(coSo)) return coSo
  if (/\/chat\/completions$/i.test(coSo)) return coSo.replace(/\/chat\/completions$/i, '/models')
  return `${coSo}/models`
}
