import type { ChiTietHoaDon } from '@/lib/kiem-tra/giao-dien'
import { dienMauDocx, TEP_NOI_DUNG } from '@/lib/van-ban/docx'
import { docZip, ghiZip } from '@/lib/van-ban/zip'
import { LOAI_GIAY, type GiayDeNghi } from './giay'
import { coPhuLucThanhToan } from './co-phu-luc'
import { LoiMauPhuLuc, taoPhuLucDocx } from './phu-luc'

type DuLieuPhuLuc = { chiTietHoaDon?: ChiTietHoaDon | null; tienRuouBia: number }

// Bỏ toàn bộ nội dung phụ lục kể cả ngắt trang nằm ở đoạn tiêu đề; giữ nguyên
// section cuối của Word và hai giấy đề nghị đứng trước. Không cắt theo số trang.
function boPhuLuc(docx: Buffer): Buffer {
  const muc = docZip(docx)
  const document = muc.find(item => item.ten === TEP_NOI_DUNG)
  if (!document) throw new LoiMauPhuLuc('Mẫu giấy thiếu nội dung Word.')
  const xml = document.duLieu.toString('utf8')
  const title = [...xml.matchAll(/<w:p(?=[\s>])[^>]*>[\s\S]*?<\/w:p>/g)].find(m => {
    const text = [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(x => x[1]).join('')
    return text.replace(/\s+/g, ' ').trim().toLocaleUpperCase('vi') === 'PHỤ LỤC BẢNG KÊ CHI TIẾT ĐỀ NGHỊ THANH TOÁN'
  })
  if (!title) return docx // mẫu cũ chưa có trang phụ lục
  const sect = xml.lastIndexOf('<w:sectPr')
  const end = xml.lastIndexOf('</w:body>')
  if (sect <= title.index || end <= sect) throw new LoiMauPhuLuc('Không xác định được ranh giới trang phụ lục trong mẫu giấy.')
  document.duLieu = Buffer.from(xml.slice(0, title.index) + xml.slice(sect), 'utf8')
  return ghiZip(muc)
}

// Một tệp chứa giấy tiếp khách, giấy thanh toán, và khi cần cả phụ lục.
// Bản xem trước, bản tải, bản lưu và bản sửa OnlyOffice đều gọi đúng hàm này.
export function taoGiayDocx(mau: Buffer, giay: GiayDeNghi, gd: DuLieuPhuLuc): Buffer {
  if (giay.loai === LOAI_GIAY.TAM_UNG) {
    return dienMauDocx(mau, giay.thayThe, giay.thayCoDinh).duLieu
  }
  if (coPhuLucThanhToan({ chiTietHoaDon: gd.chiTietHoaDon ?? null, tienRuouBia: gd.tienRuouBia })) {
    return taoPhuLucDocx(mau, gd.chiTietHoaDon!, giay.thayThe, giay.thayCoDinh)
  }
  return boPhuLuc(dienMauDocx(mau, { ...giay.thayThe, benban: gd.chiTietHoaDon?.tenBanHang ?? '' }, giay.thayCoDinh).duLieu)
}
