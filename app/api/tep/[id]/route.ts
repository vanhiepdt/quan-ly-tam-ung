import { NextResponse } from 'next/server'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { layPhien } from '@/lib/xac-thuc/phien'
import { db } from '@/lib/db/pool'

const GOC_TEP = process.env.UPLOAD_DIR ?? '/var/lib/tam-ung/tep'
export async function GET(_: Request, { params }: { params: Promise<{ id:string }> }) {
  if (!await layPhien()) return NextResponse.json({ loi:'Chưa đăng nhập' }, { status:401 })
  const { rows } = await db.query<{ duong_dan:string; mime:string; ten_goc:string }>(`select t.duong_dan,t.mime,t.ten_goc
    from tep_dinh_kem t join giao_dich g on g.id=t.giao_dich_id
    where t.id=$1 and not g.da_xoa`, [(await params).id])
  const tep = rows[0]
  if (!tep) return NextResponse.json({ loi:'Không tìm thấy tệp' }, { status:404 })
  const goc = path.resolve(GOC_TEP) + path.sep
  const duongDan = path.resolve(GOC_TEP, tep.duong_dan)
  if (!duongDan.startsWith(goc)) return NextResponse.json({ loi:'Đường dẫn tệp không hợp lệ' }, { status:400 })
  try {
    const info = await stat(duongDan)
    return new NextResponse(Readable.toWeb(createReadStream(duongDan)) as ReadableStream, { headers:{ 'Content-Type':tep.mime, 'Content-Length':String(info.size), 'Content-Disposition':`inline; filename="${tep.ten_goc.replaceAll('"','')}"`, 'X-Content-Type-Options':'nosniff' } })
  } catch { return NextResponse.json({ loi:'Tệp vật lý không tồn tại' }, { status:404 }) }
}
