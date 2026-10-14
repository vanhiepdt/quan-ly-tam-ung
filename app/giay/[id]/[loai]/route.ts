import { readFile } from 'node:fs/promises'
import { db } from '@/lib/db/pool'
import { docMau, duongDanTaiLieu } from '@/lib/onlyoffice/tai-lieu'
import { NextResponse } from 'next/server'
import { layPhien } from '@/lib/xac-thuc/phien'
import { taoGiayDocx } from '@/lib/tai-chinh/giay-docx'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { MAU_WORD, giayTheoLoai, timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { giayChoHinhThuc, LOAI_GIAY, tenTep } from '@/lib/tai-chinh/giay'
import { coPhuLucThanhToan } from '@/lib/tai-chinh/phu-luc'
import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'

export const dynamic = 'force-dynamic'

// Địa chỉ tải giấy đề nghị dưới dạng .docx đã điền. Tên tệp nằm trong Content-Disposition
// theo dạng RFC 5987 vì tên giấy có dấu tiếng Việt.
export async function GET(_: Request, { params }: { params: Promise<{ id: string; loai: string }> }) {
  const phien = await layPhien()
  if (!phien) return NextResponse.json({ loi: 'Chưa đăng nhập' }, { status: 401 })
  const { id, loai } = await params
  let gd: GiaoDichTinh | null
  try {
    gd = await timGiaoDichTinh(id)
    if (!gd) return NextResponse.json({ loi: 'Không tìm thấy giao dịch' }, { status: 404 })
  } catch {
    console.error('Không đọc được dữ liệu để in giấy đề nghị.')
    return NextResponse.json({ loi: 'Không đọc được dữ liệu. Vui lòng thử lại.' }, { status: 500 })
  }

  if (loai === 'phu-luc') {
    if (!giayChoHinhThuc(gd.hinhThuc).includes(LOAI_GIAY.THANH_TOAN)
      || !coPhuLucThanhToan(gd) || !gd.chiTietHoaDon) {
      return NextResponse.json({ loi: 'Giao dịch không có phụ lục cần thanh toán.' }, { status: 404 })
    }
    try {
      const { rows } = await db.query<{ tep: string }>('select tep from tai_lieu where giao_dich_id=$1 and loai=$2', [id, 'phu_luc'])
      // Chỉ giữ lối tải bản phụ lục cũ đã lưu; giao dịch mới dùng một Word gộp.
      if (!rows[0]) return NextResponse.json({ loi: 'Phụ lục riêng không tồn tại.' }, { status: 404 })
      const duLieu = await readFile(duongDanTaiLieu(rows[0].tep))
      const dinhDanh = (gd.soHd || id).replace(/[^\p{L}\p{N}._-]+/gu, '-')
      const ten = `Phụ lục bảng kê chi tiết đề nghị thanh toán ${gd.ngay} ${dinhDanh}.docx`
      return new NextResponse(new Uint8Array(duLieu), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="phu-luc.docx"; filename*=UTF-8''${encodeURIComponent(ten)}`,
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      console.error('Không sinh được tệp phụ lục thanh toán.')
      return NextResponse.json({ loi: 'Không sinh được tệp phụ lục thanh toán.' }, { status: 500 })
    }
  }

  let giay
  try {
    giay = giayTheoLoai(gd, await boiCanhGiay(phien), loai)
    if (!giay) return NextResponse.json({ loi: 'Hình thức của giao dịch không lập giấy này' }, { status: 404 })
  } catch {
    console.error('Không đọc được dữ liệu để in giấy đề nghị.')
    return NextResponse.json({ loi: 'Không đọc được dữ liệu. Vui lòng thử lại.' }, { status: 500 })
  }
  try {
    const { rows } = await db.query<{ tep: string }>('select tep from tai_lieu where giao_dich_id=$1 and loai=$2', [id, giay.loai])
    const duLieu = rows[0]
      ? await readFile(duongDanTaiLieu(rows[0].tep))
      : taoGiayDocx(await docMau(MAU_WORD[giay.loai]), giay, gd)
    const ten = tenTep(giay.loai, { ngay: giay.ngayLap, soHd: giay.thayThe.sohoadon || null, id })
    return new NextResponse(new Uint8Array(duLieu), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="giay-de-nghi.docx"; filename*=UTF-8''${encodeURIComponent(ten)}`,
        // URL tải giữ nguyên theo giao dịch, nên không cho trình duyệt tái dùng bản DOCX
        // cũ sau khi số tiền đã được sửa và tài liệu đã sinh lại ở máy chủ.
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    console.error('Không sinh được tệp giấy đề nghị.')
    return NextResponse.json({ loi: 'Không sinh được tệp giấy đề nghị.' }, { status: 500 })
  }
}
