import type { CauHinhAi } from './cau-hinh-ai'
import { docCauHinhAi, layCauHinhAi2 } from './cau-hinh-ai'
import { goiAiTheoCauHinh, type DauVaoAi } from './ai-hoa-don'
import { veTrangChoAi } from './doc-anh'
import type { DonViDoiChieu, KetQuaDocHoaDon, PhatHien } from './giao-dien'
import { doiChieuNguoiMua, ganTrangThai, hopNhatHaiAi } from './hop-nhat'
import { docHoaDonXml } from './xml-hoa-don'

export type { DonViDoiChieu }

function thongDiepAnToan(error: unknown): string {
  const raw = error instanceof Error ? error.message : ''
  const gon = raw
    .replace(/\b(?:file:\/\/|https?:\/\/)\S+/gi, '')
    .replace(/\b[A-Za-z]:[\\/]\S+/g, '')
    .replace(/(?:\/[\w.-]+){3,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  return gon ? `Không đọc được tệp hóa đơn. ${gon}` : 'Không đọc được tệp hóa đơn.'
}

function nhatKyCauHinh(cauHinh: CauHinhAi): string {
  const ai2 = layCauHinhAi2(cauHinh)
  return `AI 1=${cauHinh.nhaCungCap}/${cauHinh.moHinh || '(trống)'} · AI 2=${ai2.nhaCungCap}/${ai2.moHinh || '(trống)'}`
}

function ketQuaLoiKyThuat(phatHien: PhatHien[], nhatKy: string[]): KetQuaDocHoaDon {
  return {
    trangThai: 'loi_ky_thuat', deXuat: {}, ai1: null, ai2: null, xml: null,
    phatHien: [...phatHien, { muc: 'loi', ma: 'khong_doc_duoc', thongDiep: 'Không đọc được dữ liệu hóa đơn. Hãy kiểm tra lại tệp PDF/XML hoặc nhập tay.' }],
    nhatKy,
  }
}

export async function docHoaDonHaiAi(bytes: Uint8Array, mime: string, donVi: DonViDoiChieu): Promise<KetQuaDocHoaDon> {
  if (mime !== 'application/pdf' && mime !== 'application/xml' && mime !== 'text/xml') {
    return ketQuaLoiKyThuat([{ muc: 'loi', ma: 'loai_tap_khong_ho_tro', thongDiep: 'Chỉ nhận hóa đơn PDF hoặc XML.' }], [`tệp ${mime}`])
  }

  const phatSinh: PhatHien[] = []
  const nhatKy = [`tệp ${mime} · kích thước=${bytes.byteLength}B`]
  let input: DauVaoAi
  let xml: ReturnType<typeof docHoaDonXml> | null = null

  if (mime === 'application/pdf') {
    try {
      const anh = await veTrangChoAi(bytes, mime)
      input = { loai: 'anh', duLieu: anh.png }
      nhatKy.push(`PDF đã dựng trang đầu thành PNG ${anh.width}x${anh.height} · ${anh.png.length}B`)
    } catch (error) {
      phatSinh.push({ muc: 'loi', ma: 'pdf_loi', thongDiep: thongDiepAnToan(error) })
      return ketQuaLoiKyThuat(phatSinh, nhatKy)
    }
  } else {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    input = { loai: 'xml', duLieu: text }
    nhatKy.push(`XML đã nhận ${text.length} ký tự`)
    try {
      xml = docHoaDonXml(text)
      nhatKy.push(`XML trích được ${xml.dongHang?.length ?? 0} dòng hàng`)
    } catch (error) {
      phatSinh.push({ muc: 'canh_bao', ma: 'xml_loi', thongDiep: thongDiepAnToan(error) })
    }
  }

  const cauHinh = await docCauHinhAi()
  nhatKy.push(nhatKyCauHinh(cauHinh))
  const [kqAi1, kqAi2] = await Promise.all([
    goiAiTheoCauHinh(input, cauHinh),
    goiAiTheoCauHinh(input, { ...layCauHinhAi2(cauHinh), dangHoatDong: cauHinh.dangHoatDong }),
  ])
  const ai1 = 'duLieu' in kqAi1 ? kqAi1.duLieu : null
  const ai2 = 'duLieu' in kqAi2 ? kqAi2.duLieu : null
  if (!ai1) phatSinh.push({ muc: 'canh_bao', ma: 'ai1_loi', thongDiep: 'AI 1 không trả được kết quả.' })
  if (!ai2) phatSinh.push({ muc: 'canh_bao', ma: 'ai2_loi', thongDiep: 'AI 2 không trả được kết quả.' })
  if ('nhatKy' in kqAi1 && kqAi1.nhatKy?.length) nhatKy.push(...kqAi1.nhatKy.map(d => `AI 1: ${d}`))
  if ('nhatKy' in kqAi2 && kqAi2.nhatKy?.length) nhatKy.push(...kqAi2.nhatKy.map(d => `AI 2: ${d}`))
  if ('loi' in kqAi1) nhatKy.push(`AI 1 lỗi: ${kqAi1.loi}`)
  if ('loi' in kqAi2) nhatKy.push(`AI 2 lỗi: ${kqAi2.loi}`)

  const gop = hopNhatHaiAi(ai1, ai2, xml)
  const phatHien = [...gop.phatHien, ...phatSinh.filter(p => !gop.phatHien.some(q => q.ma === p.ma && q.thongDiep === p.thongDiep))]
  if (!ai1 && !ai2 && !xml) return ketQuaLoiKyThuat(phatHien, nhatKy)
  return ganTrangThai({ ...gop, phatHien, nhatKy }, doiChieuNguoiMua(gop.deXuat, donVi))
}

/** Tên cũ giữ lại cho các tích hợp bên ngoài; luồng thực thi dùng hai AI. */
export const docHoaDonHaiLop = docHoaDonHaiAi
