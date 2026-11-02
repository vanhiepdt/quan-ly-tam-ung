import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { layPhien } from '@/lib/xac-thuc/phien'
import { duongDanTepSaoLuu } from '@/lib/sao-luu/tep-cuc-bo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Tải trực tiếp gói sao lưu đang nằm trên VPS. Chỉ quản trị viên; tên tệp phải đúng
// dạng worker tạo ra nên không đọc được tệp nào khác (không có path traversal).
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const phien = await layPhien()
  if (phien?.vai_tro !== 'admin') return NextResponse.json({ loi: 'Không có quyền.' }, { status: 403 })
  const { file } = await params
  const tep = await duongDanTepSaoLuu(file)
  if (!tep) return NextResponse.json({ loi: 'Không tìm thấy bản sao lưu.' }, { status: 404 })
  const stream = createReadStream(tep.duongDan)
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(tep.kichThuoc),
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
