import type { CauHinhAi } from './cau-hinh-ai'
import { locMoHinhHienThi, moHinhCanMaxCompletion, nhaDocAnh, timNhaCungCap, urlAnToan, urlDanhSachMoHinh, urlGoiAi, type NhaCungCapAi } from './nha-cung-cap-ai'
import { anChuoiNhatKy, dauKhoa, ghiNhatKyAi, moTaLoiMang, trichThongDiepLoiAi } from './nhat-ky-ai'
import { loiMangNguoiDung, napChungChiHeThong } from './tls-he-thong'

export type KetQuaDanhSachMoHinh = { moHinh: string[] } | { loi: string; maHttp?: number }
export type KetQuaKiemThuAi = { thanhCong: string; moHinh?: string[]; nhatKy?: string[] } | { loi: string; moHinh?: string[]; nhatKy?: string[] }
export type KetQuaPingChat = { ok: true; traLoi: string } | { ok: false; loi: string }

const HET_HAN_MS = 20_000

const GIOI_HAN_MO_HINH = 200

function loiHttpKetNoi(status: number, ten: string): string {
  if (status === 401 || status === 403) return `Khóa ${ten} không hợp lệ.`
  if (status === 404) return `${ten} không có API danh sách model tại địa chỉ này.`
  if (status === 429) return `${ten} đang giới hạn lượt gọi. Thử lại sau.`
  return `Không gọi được ${ten} (mã ${status}).`
}

function headerKetNoi(cauHinh: CauHinhAi, nha: NhaCungCapAi): Record<string, string> {
  if (nha.giaoThuc === 'anthropic') {
    return { 'x-api-key': cauHinh.khoaApi, 'anthropic-version': '2023-06-01' }
  }
  if (nha.giaoThuc === 'google') return { 'x-goog-api-key': cauHinh.khoaApi }
  return { authorization: `Bearer ${cauHinh.khoaApi}` }
}

function tenMoHinh(tho: unknown): string {
  if (typeof tho === 'string') return tho.replace(/^models\//, '').trim()
  if (typeof tho !== 'object' || tho === null) return ''
  const o = tho as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : ''
  const name = typeof o.name === 'string' ? o.name.replace(/^models\//, '') : ''
  return (id || name).trim()
}

export function trichDanhSachMoHinh(body: unknown): string[] {
  const ds: string[] = []
  const seen = new Set<string>()
  const day = (ten: string) => {
    if (!ten || seen.has(ten) || ds.length >= GIOI_HAN_MO_HINH) return
    seen.add(ten)
    ds.push(ten)
  }
  if (Array.isArray(body)) {
    for (const hang of body) day(tenMoHinh(hang))
    return ds
  }
  if (typeof body !== 'object' || body === null) return ds
  const o = body as Record<string, unknown>
  const mang = Array.isArray(o.data) ? o.data : Array.isArray(o.models) ? o.models : []
  for (const hang of mang) day(tenMoHinh(hang))
  return ds
}

function kiemTraKetNoi(cauHinh: CauHinhAi): string | null {
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  if (!nha) return 'Nhà cung cấp AI không hợp lệ.'
  if (!cauHinh.khoaApi) return `Chưa có khóa ${nha.ten}. Điền khóa, hoặc lưu rồi thử lại.`
  if (nha.id === 'custom') {
    if (!cauHinh.urlCoSo.trim()) return 'Hãy điền URL API ngoài.'
    if (!urlAnToan(cauHinh.urlCoSo)) return 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.'
  }
  return null
}

export async function layDanhSachMoHinh(cauHinh: CauHinhAi, nhatKy: string[] = []): Promise<KetQuaDanhSachMoHinh> {
  const thieu = kiemTraKetNoi(cauHinh)
  if (thieu) return { loi: thieu }
  const nha = timNhaCungCap(cauHinh.nhaCungCap)!
  const url = urlDanhSachMoHinh(cauHinh)
  if (!url) return { loi: nha.id === 'custom' ? 'Hãy điền URL API ngoài.' : `Chưa cấu hình endpoint ${nha.ten}.` }
  if (nha.id === 'custom' && !urlAnToan(url)) {
    return { loi: 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.' }
  }
  napChungChiHeThong()
  ghiNhatKyAi(nhatKy, `GET ${url} · khóa=${dauKhoa(cauHinh.khoaApi)}`, cauHinh.khoaApi)
  try {
    const res = await fetch(url, { method: 'GET', headers: headerKetNoi(cauHinh, nha), signal: AbortSignal.timeout(HET_HAN_MS) })
    if (!res.ok) {
      const van = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
      ghiNhatKyAi(nhatKy, `GET HTTP ${res.status}${van ? ` · ${van.slice(0, 160)}` : ''}`, cauHinh.khoaApi)
      return { loi: loiHttpKetNoi(res.status, nha.ten), maHttp: res.status }
    }
    const body = await res.json() as unknown
    const moHinh = locMoHinhHienThi(nha.id, trichDanhSachMoHinh(body), cauHinh.moHinh)
    ghiNhatKyAi(nhatKy, `GET HTTP ${res.status} · ${moHinh.length} model`)
    if (!moHinh.length) return { loi: `${nha.ten} không trả tên model nào.` }
    return { moHinh }
  } catch (error) {
    const mang = anChuoiNhatKy(moTaLoiMang(error), cauHinh.khoaApi)
    ghiNhatKyAi(nhatKy, `GET mạng: ${mang}`, cauHinh.khoaApi)
    return { loi: `Không gọi được ${nha.ten}. ${loiMangNguoiDung(mang)}` }
  }
}

const PING_TOKEN = 16
const PING_TOKEN_LY_LUAN = 256

function chuoiNoiDung(tho: unknown): string {
  if (typeof tho === 'string') return tho.trim()
  if (!Array.isArray(tho)) return ''
  const parts: string[] = []
  for (const hang of tho) {
    if (typeof hang === 'string' && hang.trim()) parts.push(hang.trim())
    else if (hang && typeof hang === 'object') {
      const o = hang as { type?: string; text?: unknown }
      if (typeof o.text === 'string' && o.text.trim()) parts.push(o.text.trim())
    }
  }
  return parts.join(' ').trim()
}

export function trichTraLoiPing(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const o = body as Record<string, unknown>
  const choices = Array.isArray(o.choices) ? o.choices : []
  const c0 = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : undefined
  const msg = c0?.message && typeof c0.message === 'object' ? c0.message as Record<string, unknown> : undefined
  if (msg) {
    const c = chuoiNoiDung(msg.content)
    const r = typeof msg.reasoning_content === 'string' ? msg.reasoning_content.trim() : ''
    const rf = typeof msg.refusal === 'string' ? msg.refusal.trim() : ''
    if (c || r || rf) return c || r || rf
  }
  const text = chuoiNoiDung(o.content)
  if (text) return text
  const cands = Array.isArray(o.candidates) ? o.candidates : []
  const cand0 = cands[0] && typeof cands[0] === 'object' ? cands[0] as { content?: { parts?: Array<{ text?: string }> } } : undefined
  const parts = cand0?.content?.parts ?? []
  for (const p of parts) {
    if (typeof p?.text === 'string' && p.text.trim()) return p.text.trim()
  }
  return ''
}

function trichChiTietPing(body: unknown): { traLoi: string; finish: string; reasoning: number; completion: number } {
  const traLoi = trichTraLoiPing(body)
  if (!body || typeof body !== 'object') return { traLoi, finish: '', reasoning: 0, completion: 0 }
  const o = body as Record<string, unknown>
  const choices = Array.isArray(o.choices) ? o.choices : []
  const c0 = choices[0] && typeof choices[0] === 'object' ? choices[0] as { finish_reason?: unknown } : undefined
  const finish = typeof c0?.finish_reason === 'string' ? c0.finish_reason : ''
  const usage = o.usage && typeof o.usage === 'object' ? o.usage as Record<string, unknown> : undefined
  const completion = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0
  const details = usage?.completion_tokens_details && typeof usage.completion_tokens_details === 'object'
    ? usage.completion_tokens_details as { reasoning_tokens?: unknown }
    : undefined
  const reasoning = typeof details?.reasoning_tokens === 'number' ? details.reasoning_tokens : 0
  return { traLoi, finish, reasoning, completion }
}

function pingChatInit(cauHinh: CauHinhAi, nha: NhaCungCapAi, cau: string, hanMuc: number): RequestInit {
  const moHinh = cauHinh.moHinh.trim()
  if (nha.giaoThuc === 'anthropic') {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cauHinh.khoaApi, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: moHinh, max_tokens: hanMuc, messages: [{ role: 'user', content: cau }] }),
    }
  }
  if (nha.giaoThuc === 'google') {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cauHinh.khoaApi },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: cau }] }], generationConfig: { maxOutputTokens: hanMuc } }),
    }
  }
  const than: Record<string, unknown> = {
    model: moHinh,
    messages: [{ role: 'user', content: cau }],
  }
  if (moHinhCanMaxCompletion(moHinh)) than.max_completion_tokens = hanMuc
  else than.max_tokens = hanMuc
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cauHinh.khoaApi}` },
    body: JSON.stringify(than),
  }
}

async function goiMotLanPing(
  url: string, cauHinh: CauHinhAi, nha: NhaCungCapAi, nhatKy: string[], cau: string, hanMuc: number,
): Promise<{ okHttp: boolean; status: number; van: string; parsed: unknown }> {
  const init = pingChatInit(cauHinh, nha, cau, hanMuc)
  const kieu = moHinhCanMaxCompletion(cauHinh.moHinh) ? 'max_completion_tokens' : 'max_tokens'
  ghiNhatKyAi(nhatKy, `ping chat POST ${url} · model=${cauHinh.moHinh} · ${kieu}=${hanMuc} · khóa=${dauKhoa(cauHinh.khoaApi)}`, cauHinh.khoaApi)
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(HET_HAN_MS) })
  const van = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
  ghiNhatKyAi(nhatKy, `ping HTTP ${res.status || (res.ok ? 200 : '?')} · ${van.slice(0, 180)}`, cauHinh.khoaApi)
  let parsed: unknown
  try { parsed = van ? JSON.parse(van) : null } catch { parsed = van }
  return { okHttp: res.ok, status: res.status, van, parsed }
}

async function pingGoiChat(cauHinh: CauHinhAi, nha: NhaCungCapAi, nhatKy: string[], cau = 'Trả về đúng một chữ: hello'): Promise<KetQuaPingChat> {
  const url = urlGoiAi(cauHinh)
  if (!url) return { ok: false, loi: `Chưa cấu hình endpoint ${nha.ten}.` }
  if (nha.id === 'custom' && !urlAnToan(url)) return { ok: false, loi: 'URL API ngoài không hợp lệ.' }
  const moHinh = cauHinh.moHinh.trim()
  if (!moHinh) return { ok: false, loi: `Chưa chọn model ${nha.ten}.` }
  const hanDau = moHinhCanMaxCompletion(moHinh) ? PING_TOKEN_LY_LUAN : PING_TOKEN
  napChungChiHeThong()
  try {
    let lan = await goiMotLanPing(url, cauHinh, nha, nhatKy, cau, hanDau)
    if (lan.okHttp) {
      let ct = trichChiTietPing(lan.parsed)
      ghiNhatKyAi(nhatKy, `ping finish=${ct.finish || '?'} · chữ=${ct.traLoi.length} · completion=${ct.completion} · reasoning=${ct.reasoning}`)
      if (!ct.traLoi && ct.finish === 'length' && hanDau < 512) {
        ghiNhatKyAi(nhatKy, 'ping hết hạn mức lý luận — thử lại 512 token')
        lan = await goiMotLanPing(url, cauHinh, nha, nhatKy, cau, 512)
        if (lan.okHttp) {
          ct = trichChiTietPing(lan.parsed)
          ghiNhatKyAi(nhatKy, `ping finish=${ct.finish || '?'} · chữ=${ct.traLoi.length} · completion=${ct.completion} · reasoning=${ct.reasoning}`)
        }
      }
      if (lan.okHttp) {
        const traLoi = anChuoiNhatKy(ct.traLoi, cauHinh.khoaApi).slice(0, 80)
        if (traLoi) {
          ghiNhatKyAi(nhatKy, `ping trả lời: ${traLoi}`)
          return { ok: true, traLoi }
        }
        ghiNhatKyAi(nhatKy, `ping HTTP 200 không có chữ (finish=${ct.finish || '?'})`)
        return { ok: true, traLoi: `(HTTP 200, finish=${ct.finish || '?'}, không có chữ)` }
      }
    }
    const gon = anChuoiNhatKy(trichThongDiepLoiAi(lan.parsed) || lan.van, cauHinh.khoaApi).slice(0, 180)
    if (lan.status === 401 || lan.status === 403) return { ok: false, loi: `Khóa ${nha.ten} không hợp lệ.${gon ? ` ${gon}` : ''}` }
    if (lan.status === 404) return { ok: false, loi: `${nha.ten} không nhận model “${moHinh}”.${gon ? ` ${gon}` : ''}` }
    if (lan.status === 429) return { ok: false, loi: `${nha.ten} đang giới hạn lượt gọi.${gon ? ` ${gon}` : ''}` }
    if (/insufficient_quota|quota|billing/i.test(lan.van)) return { ok: false, loi: `${nha.ten} hết hạn mức / chưa thanh toán.${gon ? ` ${gon}` : ''}` }
    return { ok: false, loi: `Gọi chat ${nha.ten} thất bại (HTTP ${lan.status}).${gon ? ` ${gon}` : ''}` }
  } catch (error) {
    const mang = anChuoiNhatKy(moTaLoiMang(error), cauHinh.khoaApi)
    ghiNhatKyAi(nhatKy, `ping mạng: ${mang}`, cauHinh.khoaApi)
    return { ok: false, loi: `Không gọi được chat ${nha.ten}. ${loiMangNguoiDung(mang)}` }
  }
}

export async function pingHello(cauHinh: CauHinhAi): Promise<KetQuaKiemThuAi> {
  const nhatKy: string[] = []
  const thieu = kiemTraKetNoi(cauHinh)
  if (thieu) return { loi: thieu, nhatKy }
  const nha = timNhaCungCap(cauHinh.nhaCungCap)!
  const ping = await pingGoiChat(cauHinh, nha, nhatKy)
  if (!ping.ok) return { loi: ping.loi, nhatKy }
  return { thanhCong: `${nha.ten} trả lời: “${ping.traLoi}”.`, nhatKy }
}

export async function kiemThuApi(cauHinh: CauHinhAi): Promise<KetQuaKiemThuAi> {
  const nhatKy: string[] = []
  const thieu = kiemTraKetNoi(cauHinh)
  if (thieu) return { loi: thieu, nhatKy }
  const ds = await layDanhSachMoHinh(cauHinh, nhatKy)
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  if (!nha) return { loi: 'Nhà cung cấp AI không hợp lệ.', nhatKy }
  const chon = cauHinh.moHinh.trim()
  const ping = chon
    ? await pingGoiChat(cauHinh, nha, nhatKy)
    : { ok: false as const, loi: 'Chưa chọn model nên chưa thử gọi chat.' }
  if ('loi' in ds) {
    if (ping.ok) {
      return {
        loi: `Chat chạy được (“${ping.traLoi}”) nhưng danh sách model lỗi: ${ds.loi}`,
        nhatKy,
      }
    }
    return { loi: ds.loi, nhatKy }
  }
  const coTrongDs = chon ? ds.moHinh.some(m => m === chon || m.endsWith(`/${chon}`)) : false
  if (!ping.ok) {
    return {
      loi: `Danh sách model được (${ds.moHinh.length} model) nhưng gọi chat thất bại: ${ping.loi}`,
      moHinh: ds.moHinh,
      nhatKy,
    }
  }
  if (chon && !coTrongDs) {
    return {
      thanhCong: `Kết nối ${nha.ten} thành công (${ds.moHinh.length} model). Chat trả “${ping.traLoi}”. Tên “${chon}” không có trong danh sách hiện có — hãy chọn lại.`,
      moHinh: ds.moHinh,
      nhatKy,
    }
  }
  const them = nhaDocAnh(nha) ? '' : ' Nhà này không đọc ảnh hóa đơn — lớp AI chỉ đối chiếu chữ OCR trên PDF.'
  return {
    thanhCong: `Kết nối ${nha.ten} thành công. Có ${ds.moHinh.length} model. Chat trả “${ping.traLoi}”.${them}`,
    moHinh: ds.moHinh,
    nhatKy,
  }
}
