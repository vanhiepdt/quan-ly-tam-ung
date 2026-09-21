import type { DonViDoiChieu, KetQuaDocHoaDon, PhatHien } from './giao-dien'
import { docHoaDonBangAi } from './ai-hoa-don'
import { docQrTuTep, thuNhoPng } from './doc-anh'
import { doiChieuNguoiMua, ganTrangThai, hopNhatBaLop } from './hop-nhat'
import { gopDongChu, phanTichChuHoaDon } from './ocr-hoa-don'

export type { DonViDoiChieu }

export function thongDiepLoiVe(error: unknown): string {
  const raw = error instanceof Error ? error.message : ''
  const gon = raw
    .replace(/\b(?:file:\/\/|https?:\/\/)\S+/gi, '')
    .replace(/\b[A-Za-z]:[\\/]\S+/g, '')
    .replace(/(?:\/[\w.-]+){3,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const them = gon && !/sk-|api[_-]?key|bearer/i.test(gon) ? ` ${gon}` : ''
  return `Không dựng được ảnh trang hóa đơn để quét QR.${them}`
}

function jsonNguon(doc: object | null): string | undefined {
  if (!doc) return
  try {
    return JSON.stringify(doc)
  } catch {
    return
  }
}

function jsonChuChoAi(ocr: object | null, dongChu: string[]): string | undefined {
  if (ocr) return jsonNguon(ocr)
  if (!dongChu.length) return
  return jsonNguon({ dongChu: dongChu.slice(0, 80) })
}

// Ba lớp: QR khóa số in trên mã, OCR đọc chữ trang, AI đối chiếu. Cần ít nhất hai nguồn.
export async function docHoaDonHaiLop(
  bytes: Uint8Array,
  mime: string,
  donVi: DonViDoiChieu,
): Promise<KetQuaDocHoaDon> {
  let qr = null
  let ocr = null
  let pngAi: Buffer | null = null
  let dongChu: string[] = []
  const phatSinh: PhatHien[] = []
  try {
    const kq = await docQrTuTep(bytes, mime)
    qr = kq.qr
    pngAi = await thuNhoPng(kq.anh.png, 1280)
    dongChu = kq.chu?.length ? gopDongChu(kq.chu) : []
    ocr = dongChu.length ? phanTichChuHoaDon(dongChu) : null
  } catch (error) {
    phatSinh.push({
      muc: 'canh_bao', ma: 'qr_loi_ve',
      thongDiep: thongDiepLoiVe(error),
    })
  }

  let ai = null
  let nhatKy: string[] = [
    `tệp ${mime} · QR=${qr ? 'có' : 'không'} · OCR=${ocr ? 'có' : 'không'} (${dongChu.length} dòng) · PNG=${pngAi?.length ?? 0}B`,
  ]
  if (pngAi) {
    const kqAi = await docHoaDonBangAi(pngAi, jsonNguon(qr), jsonChuChoAi(ocr, dongChu))
    if (kqAi.nhatKy?.length) nhatKy = [...nhatKy, ...kqAi.nhatKy]
    if ('duLieu' in kqAi) ai = kqAi.duLieu
    else phatSinh.push({ muc: 'canh_bao', ma: 'ai_loi', thongDiep: kqAi.loi })
  } else {
    nhatKy.push('Không có ảnh PNG nên không gọi AI.')
  }

  if (!qr && !ocr && !ai) {
    return {
      trangThai: 'loi_ky_thuat', deXuat: {}, qr: null, ocr: null, ai: null, nhatKy,
      phatHien: [
        ...phatSinh,
        { muc: 'loi', ma: 'khong_doc_duoc', thongDiep: 'Không đọc được QR, OCR lẫn AI. Hãy chụp rõ hơn hoặc nhập tay.' },
      ],
    }
  }

  const gop = hopNhatBaLop(qr, ocr, ai)
  const phat = gop.phatHien.map(p => {
    const aiLoi = phatSinh.find(t => t.ma === 'ai_loi')
    return p.ma === 'ai_khong_chay' && aiLoi ? aiLoi : p
  })
  const conLai = phatSinh.filter(p => p.ma !== 'ai_loi' || !phat.some(q => q.ma === 'ai_loi'))
  return ganTrangThai({ ...gop, phatHien: phat, nhatKy }, [...conLai, ...doiChieuNguoiMua(gop.deXuat, donVi)])
}
