import { z } from 'zod'
import type { CotTienHang, DuLieuDocTuHoaDon, LoaiHoaDon } from './giao-dien'
import { chuanHoaMst, chuanHoaNgayQr } from './qr-hoa-don'
import { congTienRuouBia } from './ruou-bia'
import { docCauHinhAi, type CauHinhAi } from './cau-hinh-ai'
import { moHinhCanMaxCompletion, nhaDocAnh, timNhaCungCap, urlAnToan, urlGoiAi, type NhaCungCapAi } from './nha-cung-cap-ai'
import { dauKhoa, ghiNhatKyAi, moTaLoiMang, trichThongDiepLoiAi } from './nhat-ky-ai'
import { loiMangNguoiDung, napChungChiHeThong } from './tls-he-thong'

const dongHangSchema = z.object({
  ten: z.string().trim().min(1).max(300),
  soLuong: z.number().finite().nonnegative().optional(),
  donGia: z.number().int().nonnegative().optional(),
  thanhTien: z.number().int().nonnegative(),
  thueSuat: z.number().finite().nonnegative().optional(),
  tienThue: z.number().int().nonnegative().optional(),
  thanhTienSauThue: z.number().int().nonnegative().optional(),
  laRuouBia: z.boolean().optional(),
})

const aiSchema = z.object({
  kyHieuHd: z.string().trim().max(30).optional(),
  soHd: z.string().trim().max(30).optional(),
  ngay: z.string().trim().max(20).optional(),
  mstBanHang: z.string().trim().max(20).optional(),
  tenBanHang: z.string().trim().max(200).optional(),
  mstMuaHang: z.string().trim().max(20).optional(),
  tenMuaHang: z.string().trim().max(200).optional(),
  diaChiMuaHang: z.string().trim().max(400).optional(),
  tongTien: z.number().int().nonnegative().optional(),
  tienThue: z.number().int().nonnegative().optional(),
  tienRuouBia: z.number().int().nonnegative().optional(),
  loaiHd: z.string().trim().max(40).optional(),
  cotTienHang: z.string().trim().max(40).optional(),
  dongHang: z.array(dongHangSchema).max(80).optional(),
})

export const HUONG_DAN = `Bạn đọc hóa đơn điện tử Việt Nam (PDF/ảnh). Trả về DUY NHẤT một JSON, không markdown, không lời giải thích.
Khóa JSON:
kyHieuHd, soHd, ngay (yyyy-mm-dd), mstBanHang, tenBanHang, mstMuaHang, tenMuaHang, diaChiMuaHang,
tongTien (số nguyên đồng, tổng thanh toán), tienThue, tienRuouBia,
loaiHd ("gtgt" hoặc "ban_hang"), cotTienHang ("truoc_thue" hoặc "sau_thue"),
dongHang: [{ten, soLuong, donGia, thanhTien, thueSuat, tienThue, thanhTienSauThue, laRuouBia}].
BẮT BUỘC tìm khối người mua (bên trái, dưới người bán), không nhầm với người bán:
- tenMuaHang: dòng “Tên đơn vị” / “Đơn vị mua hàng”
- mstMuaHang: dòng “MST/CCCD chủ hộ” hoặc MST người mua (giữ đủ 10 hoặc 13 số)
- diaChiMuaHang: dòng “Địa chỉ” NGAY SAU tên đơn vị mua, chép nguyên, kể cả “Việt Nam”
loaiHd=gtgt nếu tiêu đề HÓA ĐƠN GIÁ TRỊ GIA TĂNG (ký hiệu thường bắt đầu 1); ban_hang nếu HÓA ĐƠN BÁN HÀNG (ký hiệu thường bắt đầu 2).
cotTienHang=sau_thue nếu cột Thành tiền đã gồm thuế (Thành tiền sau thuế GTGT / đã có thuế / đã bao gồm thuế);
truoc_thue nếu cột Thành tiền chưa thuế và có cột Tiền thuế GTGT.
dongHang.thanhTien = số cột Thành tiền nguyên như trên hóa đơn, đừng tự cộng thuế vào đây.
Nếu có thuế suất / tiền thuế dòng thì ghi thueSuat, tienThue; nếu có cột thành tiền sau thuế thì ghi thanhTienSauThue.
BẮT BUỘC gắn laRuouBia true hoặc false cho TỪNG dòng dongHang: true khi bia/rượu/đồ uống có cồn (Heineken, Tiger, Hà Nội, 333, rượu vang, whisky...). Nước ngọt, nước suối, dê, cơm, bia không cồn = false.
BẮT BUỘC luôn có tienRuouBia (số nguyên đồng, 0 nếu không có rượu/bia) — không bỏ khóa này.
tienRuouBia = tổng dòng laRuouBia=true SAU THUẾ: hóa đơn bán hàng lấy thành tiền; hóa đơn GTGT nếu cột đã gồm thuế thì lấy cột đó, nếu chưa thì thành tiền + tiền thuế GTGT (hoặc thành tiền × (1+thuế suất)).
Nếu không đọc được khóa khác thì bỏ khóa đó, đừng bịa. Số tiền là số nguyên, không dấu phẩy.`

function chuanLoaiHd(value?: string): LoaiHoaDon | undefined {
  const a = (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (value === 'gtgt' || /gtgt|gia tri gia tang/.test(a)) return 'gtgt'
  if (value === 'ban_hang' || /ban hang/.test(a)) return 'ban_hang'
}

function chuanCotTien(value?: string): CotTienHang | undefined {
  const a = (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (value === 'sau_thue' || /sau thue|da co thue|bao gom thue/.test(a)) return 'sau_thue'
  if (value === 'truoc_thue' || /truoc thue/.test(a)) return 'truoc_thue'
}

function chuanHoa(tho: z.infer<typeof aiSchema>): DuLieuDocTuHoaDon {
  const ngay = tho.ngay ? chuanHoaNgayQr(tho.ngay) : undefined
  const loaiHd = chuanLoaiHd(tho.loaiHd)
  const cotTienHang = chuanCotTien(tho.cotTienHang)
  let tienRuouBia = tho.tienRuouBia
  if (tienRuouBia === undefined && tho.dongHang?.length) {
    const { tien, dong } = congTienRuouBia(tho.dongHang, loaiHd, cotTienHang)
    if (dong.some(d => d.laRuouBia)) tienRuouBia = tien
  }
  return {
    kyHieuHd: tho.kyHieuHd || undefined,
    soHd: tho.soHd || undefined,
    ngay,
    mstBanHang: tho.mstBanHang ? chuanHoaMst(tho.mstBanHang) : undefined,
    tenBanHang: tho.tenBanHang || undefined,
    mstMuaHang: tho.mstMuaHang ? chuanHoaMst(tho.mstMuaHang) : undefined,
    tenMuaHang: tho.tenMuaHang || undefined,
    diaChiMuaHang: tho.diaChiMuaHang || undefined,
    tongTien: tho.tongTien,
    tienThue: tho.tienThue,
    tongCong: tho.tongTien,
    tienRuouBia,
    ...(loaiHd ? { loaiHd } : {}),
    ...(cotTienHang ? { cotTienHang } : {}),
    dongHang: tho.dongHang,
  }
}

function trichJson(text: string): unknown {
  const gọn = text.trim()
  const fence = gọn.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : gọn
  const bat = raw.indexOf('{'), ket = raw.lastIndexOf('}')
  if (bat < 0 || ket <= bat) throw new Error('AI không trả JSON.')
  return JSON.parse(raw.slice(bat, ket + 1))
}

export function docJsonAi(text: string): DuLieuDocTuHoaDon {
  const parsed = aiSchema.safeParse(trichJson(text))
  if (!parsed.success) throw new Error('AI trả JSON không đúng khuôn hóa đơn.')
  return chuanHoa(parsed.data)
}

export type KetQuaAi = ({ duLieu: DuLieuDocTuHoaDon } | { loi: string }) & { nhatKy?: string[] }

function ketQuaTuText(text: string, nhatKy: string[]): KetQuaAi {
  try {
    const duLieu = docJsonAi(text)
    ghiNhatKyAi(nhatKy, `JSON hợp lệ, trường: ${Object.keys(duLieu).join(', ') || '(trống)'}`)
    return { duLieu }
  } catch (error) {
    const gon = error instanceof Error ? error.message : 'JSON không đọc được'
    ghiNhatKyAi(nhatKy, `JSON hỏng: ${gon}. Mẫu: ${text.slice(0, 120)}`)
    return { loi: 'AI trả dữ liệu không đọc được. Chỉ dùng dữ liệu QR.' }
  }
}

function loiHttp(status: number, ten: string): string {
  if (status === 401 || status === 403) return `Khóa ${ten} không hợp lệ. Chỉ dùng dữ liệu QR.`
  if (status === 404) return `${ten} không nhận model này. Kiểm tra tên model trong Cài đặt AI.`
  if (status === 429) return `${ten} đang giới hạn lượt gọi. Chỉ dùng dữ liệu QR.`
  return `Lớp AI không gọi được ${ten}. Chỉ dùng dữ liệu QR.`
}

function gonLoiNha(raw: string): string {
  return raw
    .replace(/\b(?:sk-|api[_-]?key|bearer)\S*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function loiThanHttp(status: number, ten: string, body: unknown): string {
  const raw = trichThongDiepLoiAi(body)
  const gon = gonLoiNha(raw)
  if (/insufficient_quota|exceeded your current quota|billing/i.test(raw)) {
    return `${ten} hết hạn mức / chưa thanh toán.${gon ? ` ${gon}` : ''} Chỉ dùng QR và OCR.`
  }
  if (/image|vision|multimodal|content.?type|does not support/i.test(raw)) {
    return `${ten} không nhận ảnh với model này.${gon ? ` ${gon}` : ''} Chỉ dùng QR và OCR.`
  }
  if (/max_tokens|max_completion_tokens/i.test(raw)) {
    return `${ten} từ chối tham số token. ${gon || raw} Đổi model hoặc báo quản trị.`
  }
  if (gon && (status === 400 || status >= 500)) return `${ten} từ chối yêu cầu (HTTP ${status}). ${gon}`
  if (gon && (status === 401 || status === 403 || status === 404 || status === 429)) {
    return `${loiHttp(status, ten).replace(/\. Chỉ dùng.+$/, '')}. ${gon} Chỉ dùng dữ liệu QR.`
  }
  return loiHttp(status, ten)
}

async function docThanLoi(res: Response, ten: string, nhatKy: string[], khoa?: string): Promise<string> {
  let van = ''
  try { van = await res.text() } catch { return loiHttp(res.status, ten) }
  if (van) ghiNhatKyAi(nhatKy, `thân lỗi: ${van.slice(0, 240)}`, khoa)
  try { return loiThanHttp(res.status, ten, JSON.parse(van)) } catch { return loiHttp(res.status, ten) }
}

function prompt(qrJson?: string, ocrJson?: string, chiChu = false): string {
  const qr = qrJson ? `\nLớp QR đã đọc (thường không có người mua, đừng bịa thêm trường QR không có):\n${qrJson}\n` : ''
  const ocr = ocrJson ? `\nLớp OCR đã đọc chữ trên trang (đối chiếu, đặc biệt tenMuaHang / mstMuaHang / diaChiMuaHang):\n${ocrJson}\n` : ''
  const chi = chiChu
    ? '\nKhông có ảnh. Chỉ dùng chữ OCR và QR bên trên. Đừng bịa trường chữ không có.\n'
    : ''
  return HUONG_DAN + chi + qr + ocr
}

export type TinhTrangAi = {
  muc: 'ok' | 'canh_bao' | 'loi'
  thongDiep: string
  nha: string
  moHinh: string
  docAnh: boolean
}

export function danhGiaTinhTrangAi(cauHinh: CauHinhAi): TinhTrangAi {
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  const ten = nha?.ten ?? cauHinh.nhaCungCap
  const docAnh = nhaDocAnh(nha)
  const thieu = kiemTraCauHinhAi(cauHinh)
  if (thieu) {
    return {
      muc: cauHinh.dangHoatDong ? 'loi' : 'canh_bao',
      thongDiep: thieu,
      nha: ten, moHinh: cauHinh.moHinh, docAnh,
    }
  }
  if (!docAnh) {
    return {
      muc: 'canh_bao',
      thongDiep: `${ten} (${cauHinh.moHinh || 'chưa chọn model'}) không đọc được ảnh hóa đơn. Lớp AI sẽ đối chiếu chữ OCR trên PDF. Ảnh scan/chụp sẽ thiếu lớp AI — nên chọn Claude, Gemini hoặc GPT-4o.`,
      nha: ten, moHinh: cauHinh.moHinh, docAnh: false,
    }
  }
  return {
    muc: 'ok',
    thongDiep: `AI sẵn sàng: ${ten} · ${cauHinh.moHinh}.`,
    nha: ten, moHinh: cauHinh.moHinh, docAnh: true,
  }
}

function pngBase64(png: Buffer): string {
  return png.toString('base64')
}

export { moHinhCanMaxCompletion }

function thanChatOpenAi(
  cauHinh: CauHinhAi,
  nha: NhaCungCapAi,
  png: Buffer,
  qrJson?: string,
  ocrJson?: string,
): Record<string, unknown> {
  const than: Record<string, unknown> = {
    model: cauHinh.moHinh,
    messages: [{ role: 'user', content: noiDungOpenAi(png, nha, qrJson, ocrJson) }],
  }
  if (moHinhCanMaxCompletion(cauHinh.moHinh)) than.max_completion_tokens = 2500
  else than.max_tokens = 2500
  if (!moHinhCanMaxCompletion(cauHinh.moHinh)) than.temperature = 0
  return than
}

async function goiAnthropic(
  png: Buffer, cauHinh: CauHinhAi, nha: NhaCungCapAi, nhatKy: string[], qrJson?: string, ocrJson?: string,
): Promise<KetQuaAi> {
  const url = urlGoiAi(cauHinh)
  if (!url) return { loi: 'Chưa cấu hình endpoint Anthropic.' }
  ghiNhatKyAi(nhatKy, `POST ${url} · model=${cauHinh.moHinh} · ảnh=${png.length}B · OCR=${ocrJson ? 'có' : 'không'}`, cauHinh.khoaApi)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cauHinh.khoaApi,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cauHinh.moHinh,
      max_tokens: 2500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64(png) } },
          { type: 'text', text: prompt(qrJson, ocrJson) },
        ],
      }],
    }),
  })
  ghiNhatKyAi(nhatKy, `HTTP ${res.status} ${res.statusText || ''}`.trim())
  if (!res.ok) {
    const loi = await docThanLoi(res, nha.ten, nhatKy, cauHinh.khoaApi)
    ghiNhatKyAi(nhatKy, `lỗi: ${loi}`)
    return { loi }
  }
  const body = await res.json() as { content?: Array<{ type: string; text?: string }>; stop_reason?: string }
  const text = body.content?.find(c => c.type === 'text')?.text
  ghiNhatKyAi(nhatKy, `stop=${body.stop_reason ?? '?'} · chữ=${text?.length ?? 0}`)
  if (!text) return { loi: 'AI không trả nội dung. Chỉ dùng dữ liệu QR và OCR.' }
  return ketQuaTuText(text, nhatKy)
}

async function goiOpenAi(
  png: Buffer, cauHinh: CauHinhAi, nha: NhaCungCapAi, nhatKy: string[], qrJson?: string, ocrJson?: string,
): Promise<KetQuaAi> {
  const url = urlGoiAi(cauHinh)
  if (!url) return { loi: nha.id === 'custom'
    ? 'Chưa điền URL API ngoài nên lớp AI không chạy. Chỉ dùng dữ liệu QR.'
    : `Chưa cấu hình endpoint ${nha.ten}.` }
  if (nha.id === 'custom' && !urlAnToan(url)) {
    return { loi: 'URL API ngoài không hợp lệ. Chỉ dùng dữ liệu QR.' }
  }
  let than = thanChatOpenAi(cauHinh, nha, png, qrJson, ocrJson)
  const kieuToken = 'max_completion_tokens' in than ? 'max_completion_tokens' : 'max_tokens'
  const kieuNoiDung = Array.isArray((than.messages as { content?: unknown }[])[0]?.content) ? 'ảnh+chữ' : 'chữ'
  ghiNhatKyAi(nhatKy, `POST ${url} · model=${cauHinh.moHinh} · ${kieuToken} · ${kieuNoiDung} · ảnh=${png.length}B · OCR=${ocrJson ? 'có' : 'không'}`, cauHinh.khoaApi)
  const header = {
    'content-type': 'application/json',
    authorization: `Bearer ${cauHinh.khoaApi}`,
  }
  let res = await fetch(url, { method: 'POST', headers: header, body: JSON.stringify(than) })
  ghiNhatKyAi(nhatKy, `HTTP ${res.status} ${res.statusText || ''}`.trim())
  if (!res.ok) {
    const van = await res.text().catch(() => '')
    if (van) ghiNhatKyAi(nhatKy, `thân lỗi: ${van.slice(0, 240)}`, cauHinh.khoaApi)
    let parsed: unknown
    try { parsed = van ? JSON.parse(van) : null } catch { parsed = van }
    if (res.status === 400 && /max_tokens/i.test(van) && 'max_tokens' in than) {
      delete than.max_tokens
      than = { ...than, max_completion_tokens: 2500 }
      ghiNhatKyAi(nhatKy, 'thử lại với max_completion_tokens')
      res = await fetch(url, { method: 'POST', headers: header, body: JSON.stringify(than) })
      ghiNhatKyAi(nhatKy, `HTTP ${res.status} ${res.statusText || ''} (lần 2)`.trim())
      if (!res.ok) {
        const loi = await docThanLoi(res, nha.ten, nhatKy, cauHinh.khoaApi)
        ghiNhatKyAi(nhatKy, `lỗi: ${loi}`)
        return { loi }
      }
    } else {
      const loi = loiThanHttp(res.status, nha.ten, parsed)
      ghiNhatKyAi(nhatKy, `lỗi: ${loi}`)
      return { loi }
    }
  }
  const body = await res.json() as {
    error?: { message?: string }
    choices?: Array<{
      finish_reason?: string
      message?: {
        content?: string | Array<{ type?: string; text?: string }> | null
        reasoning_content?: string
      }
    }>
  }
  const msg = body.choices?.[0]?.message
  const noiDung = msg?.content
  const tuContent = typeof noiDung === 'string'
    ? noiDung
    : Array.isArray(noiDung) ? noiDung.map(p => p.text ?? '').join('') : ''
  const text = tuContent || msg?.reasoning_content || ''
  ghiNhatKyAi(nhatKy, `finish=${body.choices?.[0]?.finish_reason ?? '?'} · content=${tuContent.length} · reasoning=${msg?.reasoning_content?.length ?? 0}`)
  if (!text) {
    const lyDo = gonLoiNha(trichThongDiepLoiAi(body) || body.error?.message || '')
    if (lyDo) return { loi: `${nha.ten} không trả nội dung. ${lyDo}` }
    if (!nhaDocAnh(nha) && !ocrJson) {
      return { loi: `${nha.ten} không đọc ảnh và không có chữ OCR để đối chiếu. Chỉ dùng dữ liệu QR.` }
    }
    return { loi: 'AI không trả nội dung. Chỉ dùng dữ liệu QR và OCR.' }
  }
  return ketQuaTuText(text, nhatKy)
}

function noiDungOpenAi(png: Buffer, nha: NhaCungCapAi, qrJson?: string, ocrJson?: string) {
  const chiChu = !nhaDocAnh(nha)
  const text = prompt(qrJson, ocrJson, chiChu)
  if (chiChu) return text
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64(png)}` } },
  ]
}

async function goiGoogle(
  png: Buffer, cauHinh: CauHinhAi, nha: NhaCungCapAi, nhatKy: string[], qrJson?: string, ocrJson?: string,
): Promise<KetQuaAi> {
  const url = urlGoiAi(cauHinh)
  if (!url) return { loi: 'Chưa chọn model Gemini nên lớp AI không chạy. Chỉ dùng dữ liệu QR.' }
  ghiNhatKyAi(nhatKy, `POST ${url} · model=${cauHinh.moHinh} · ảnh=${png.length}B · OCR=${ocrJson ? 'có' : 'không'}`, cauHinh.khoaApi)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': cauHinh.khoaApi,
    },
    body: JSON.stringify({
      generationConfig: { temperature: 0, maxOutputTokens: 2500 },
      contents: [{
        role: 'user',
        parts: [
          { text: prompt(qrJson, ocrJson) },
          { inlineData: { mimeType: 'image/png', data: pngBase64(png) } },
        ],
      }],
    }),
  })
  ghiNhatKyAi(nhatKy, `HTTP ${res.status} ${res.statusText || ''}`.trim())
  if (!res.ok) {
    const loi = await docThanLoi(res, nha.ten, nhatKy, cauHinh.khoaApi)
    ghiNhatKyAi(nhatKy, `lỗi: ${loi}`)
    return { loi }
  }
  const body = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> }
  const text = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  ghiNhatKyAi(nhatKy, `finish=${body.candidates?.[0]?.finishReason ?? '?'} · chữ=${text.length}`)
  if (!text) return { loi: 'AI không trả nội dung. Chỉ dùng dữ liệu QR và OCR.' }
  return ketQuaTuText(text, nhatKy)
}

export function kiemTraCauHinhAi(cauHinh: CauHinhAi): string | null {
  if (!cauHinh.dangHoatDong) return 'Lớp AI đang tắt trong Cài đặt. Chỉ dùng dữ liệu QR.'
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  if (!nha) return 'Nhà cung cấp AI không hợp lệ. Chỉ dùng dữ liệu QR.'
  if (!cauHinh.khoaApi) {
    return `Chưa cấu hình khóa ${nha.ten} nên lớp AI không chạy. Chỉ dùng dữ liệu QR.`
  }
  if (!cauHinh.moHinh.trim()) return `Chưa chọn model ${nha.ten} nên lớp AI không chạy. Chỉ dùng dữ liệu QR.`
  if (nha.id === 'custom') {
    if (!cauHinh.urlCoSo.trim()) return 'Chưa điền URL API ngoài nên lớp AI không chạy. Chỉ dùng dữ liệu QR.'
    if (!urlAnToan(cauHinh.urlCoSo)) return 'URL API ngoài không hợp lệ. Chỉ dùng dữ liệu QR.'
  }
  return null
}

export async function goiAiTheoCauHinh(png: Buffer, cauHinh: CauHinhAi, qrJson?: string, ocrJson?: string): Promise<KetQuaAi> {
  const nhatKy: string[] = []
  const nha = timNhaCungCap(cauHinh.nhaCungCap)
  ghiNhatKyAi(nhatKy, `cấu hình: ${nha?.ten ?? cauHinh.nhaCungCap} · model=${cauHinh.moHinh || '(trống)'} · khóa=${dauKhoa(cauHinh.khoaApi)} · bật=${cauHinh.dangHoatDong} · đọc ảnh=${nhaDocAnh(nha)}`)
  const thieu = kiemTraCauHinhAi(cauHinh)
  if (thieu) {
    ghiNhatKyAi(nhatKy, `dừng: ${thieu}`)
    return { loi: thieu, nhatKy }
  }
  const nhaOk = nha!
  if (!nhaDocAnh(nhaOk) && !ocrJson) {
    const loi = `${nhaOk.ten} không đọc ảnh và không có chữ OCR để đối chiếu. Chỉ dùng dữ liệu QR.`
    ghiNhatKyAi(nhatKy, `dừng: ${loi}`)
    return { loi, nhatKy }
  }
  napChungChiHeThong()
  try {
    const kq = nhaOk.giaoThuc === 'anthropic'
      ? await goiAnthropic(png, cauHinh, nhaOk, nhatKy, qrJson, ocrJson)
      : nhaOk.giaoThuc === 'google'
        ? await goiGoogle(png, cauHinh, nhaOk, nhatKy, qrJson, ocrJson)
        : await goiOpenAi(png, cauHinh, nhaOk, nhatKy, qrJson, ocrJson)
    return { ...kq, nhatKy }
  } catch (error) {
    const mang = moTaLoiMang(error)
    ghiNhatKyAi(nhatKy, `mạng: ${mang}`, cauHinh.khoaApi)
    return { loi: `Lớp AI không gọi được ${nhaOk.ten}. ${loiMangNguoiDung(gonLoiNha(mang)) || 'Chỉ dùng dữ liệu QR.'}`, nhatKy }
  }
}

export async function docHoaDonBangAi(png: Buffer, qrJson?: string, ocrJson?: string): Promise<KetQuaAi> {
  return goiAiTheoCauHinh(png, await docCauHinhAi(), qrJson, ocrJson)
}
