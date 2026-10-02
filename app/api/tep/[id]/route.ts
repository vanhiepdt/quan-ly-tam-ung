import { NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { layPhien } from '@/lib/xac-thuc/phien'
import { db } from '@/lib/db/pool'

const GOC_TEP = process.env.UPLOAD_DIR ?? '/var/lib/tam-ung/tep'

type LoiHeThongTep = NodeJS.ErrnoException

function laLoiMa(error: unknown, code: string): error is LoiHeThongTep {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code
}

function contentDisposition(tenGoc: string) {
  // Header HTTP chỉ nhận chuỗi ASCII. filename* giữ tên UTF-8 thật, còn filename là
  // tên dự phòng cho trình duyệt cũ và không được phép chứa dấu ngoặc kép/control char.
  const fallback = (tenGoc.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0111\u0110]/g, kyTu => kyTu === '\u0111' ? 'd' : 'D')
    .replace(/[^\x20-\x7e]/g, '_').replace(/["\\/]/g, '_').trim()) || 'tep'
  const encoded = encodeURIComponent(tenGoc).replace(/[!'()*]/g, kyTu => `%${kyTu.charCodeAt(0).toString(16).toUpperCase()}`)
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(_: Request, { params }: { params: Promise<{ id:string }> }) {
  if (!await layPhien()) return NextResponse.json({ loi:'Chưa đăng nhập' }, { status:401 })
  const { rows } = await db.query<{ duong_dan:string; mime:string; ten_goc:string }>(`select t.duong_dan,t.mime,t.ten_goc
    from tep_dinh_kem t join giao_dich g on g.id=t.giao_dich_id
    where t.id=$1 and not g.da_xoa`, [(await params).id])
  const tep = rows[0]
  if (!tep) return NextResponse.json({ loi:'Không tìm thấy tệp' }, { status:404 })
  const goc = path.resolve(GOC_TEP) + path.sep
  const duongDan = path.resolve(GOC_TEP, ...String(tep.duong_dan).split(/[/\\]/).filter(Boolean))
  if (!duongDan.startsWith(goc) || duongDan === goc.slice(0, -1)) return NextResponse.json({ loi:'Đường dẫn tệp không hợp lệ' }, { status:400 })

  let info
  try {
    info = await stat(duongDan)
  } catch (error) {
    if (laLoiMa(error, 'ENOENT') || laLoiMa(error, 'ENOTDIR')) {
      return NextResponse.json({ loi:'Tệp vật lý không tồn tại' }, { status:404 })
    }
    console.error('Không đọc được thông tin tệp đính kèm', { id: (await params).id, error })
    return NextResponse.json({ loi:'Không thể đọc tệp vật lý' }, { status:500 })
  }
  if (!info.isFile()) return NextResponse.json({ loi:'Tệp vật lý không tồn tại' }, { status:404 })

  try {
    return new NextResponse(Readable.toWeb(createReadStream(duongDan)) as ReadableStream, { headers:{ 'Content-Type':tep.mime, 'Content-Length':String(info.size), 'Content-Disposition':contentDisposition(tep.ten_goc), 'X-Content-Type-Options':'nosniff' } })
  } catch (error) {
    console.error('Không tạo được luồng đọc tệp đính kèm', { id: (await params).id, error })
    return NextResponse.json({ loi:'Không thể đọc tệp vật lý' }, { status:500 })
  }
}
