import { readFile } from 'node:fs/promises'
import { db } from '@/lib/db/pool'
import { docMau, duongDanTaiLieu } from '@/lib/onlyoffice/tai-lieu'
import { NextResponse } from 'next/server'
import { layPhien } from '@/lib/xac-thuc/phien'
import { dienMauDocx } from '@/lib/van-ban/docx'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { MAU_WORD, giayTheoLoai, timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { tenTep } from '@/lib/tai-chinh/giay'

export const dynamic = 'force-dynamic'

// Địa chỉ tải giấy đề nghị dưới dạng .docx đã điền. Tên tệp nằm trong Content-Disposition
// theo dạng RFC 5987 vì tên giấy có dấu tiếng Việt.
export async function GET(_: Request, { params }: { params: Promise<{ id: string; loai: string }> }) {
  const phien = await layPhien()
  if (!phien) return NextResponse.json({ loi: 'Chưa đăng nhập' }, { status: 401 })
  const { id, loai } = await params
  let giay
  try {
    const gd = await timGiaoDichTinh(id)
    if (!gd) return NextResponse.json({ loi: 'Không tìm thấy giao dịch' }, { status: 404 })
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
      : dienMauDocx(await docMau(MAU_WORD[giay.loai]), giay.thayThe, giay.thayCoDinh).duLieu
    const ten = tenTep(giay.loai, { ngay: giay.ngayLap, soHd: giay.thayThe.sohoadon || null, id })
    return new NextResponse(new Uint8Array(duLieu), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="giay-de-nghi.docx"; filename*=UTF-8''${encodeURIComponent(ten)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    console.error('Không sinh được tệp giấy đề nghị.')
    return NextResponse.json({ loi: 'Không sinh được tệp giấy đề nghị.' }, { status: 500 })
  }
}
