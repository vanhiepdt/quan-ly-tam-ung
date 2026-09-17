import { readFile } from 'node:fs/promises'
import { db } from '@/lib/db/pool'
import { docUrl } from '@/lib/onlyoffice/jwt'
import { duongDanTaiLieu, laId } from '@/lib/onlyoffice/tai-lieu'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const token = docUrl(new URL(req.url).searchParams.get('t'))
    if (!laId(id) || token.purpose !== 'file' || token.id !== id) return new Response(null, { status: 403 })
    const { rows } = await db.query(`select p.tep_ban_dau from tai_lieu_phien p join tai_lieu t on t.id=p.tai_lieu_id
      left join giao_dich g on g.id=t.giao_dich_id where p.khoa=$1 and t.id=$2 and not p.da_dong
      and (t.ten_mau is not null or not g.da_xoa)`, [token.key, id])
    if (!rows[0]) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(await readFile(duongDanTaiLieu(rows[0].tep_ban_dau))), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch { return new Response(null, { status: 403 }) }
}
