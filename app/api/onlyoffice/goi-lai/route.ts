import { db } from '@/lib/db/pool'
import { docJwt, docUrl } from '@/lib/onlyoffice/jwt'
import { diaChi } from '@/lib/onlyoffice/cau-hinh'
import { luuPhienBanMoi } from '@/lib/onlyoffice/tai-lieu'

export async function POST(req: Request) {
  let capability: Record<string, unknown>, body: Record<string, unknown>
  try {
    capability = docUrl(new URL(req.url).searchParams.get('t'))
    if (Number(req.headers.get('content-length')) > 65536) throw new Error('Body quá lớn')
    const text = await req.text()
    if (text.length > 65536) throw new Error('Body quá lớn')
    body = docJwt(JSON.parse(text).token)
    if (capability.purpose !== 'callback' || capability.key !== body.key || typeof body.key !== 'string') throw new Error('Sai phiên')
    const { rows } = await db.query(`select n.vai_tro,t.ten_mau from nguoi_dung n cross join tai_lieu t
      join tai_lieu_phien p on p.tai_lieu_id=t.id
      left join giao_dich g on g.id=t.giao_dich_id
      where n.id=$1 and t.id=$2 and p.khoa=$3 and n.dang_hoat_dong and not n.doi_mat_khau
      and (t.ten_mau is not null or not g.da_xoa)`, [capability.user, capability.id, body.key])
    const row = rows[0]
    if (!row) throw new Error('Không có quyền')
    if ([2, 6].includes(Number(body.status)) && (capability.edit !== true || row.vai_tro === 'chi_doc' || (row.ten_mau && row.vai_tro !== 'admin'))) throw new Error('Không có quyền sửa')
  } catch { return Response.json({ error: 1 }, { status: 403 }) }
  try {
    const status = body.status
    if (typeof status !== 'number' || ![1, 2, 3, 4, 6, 7].includes(status)) return Response.json({ error: 1 }, { status: 400 })
    if (status === 3 || status === 7) return Response.json({ error: 1 })
    let data: Buffer | undefined
    if (status === 2 || status === 6) {
      if (typeof body.url !== 'string') throw new Error('Thiếu URL')
      const urls = diaChi(), url = new URL(body.url)
      // Chỉ tải từ DocumentServer đã cấu hình; không theo redirect ra máy khác.
      if (![urls.internal, urls.public].includes(url.origin) || url.username || url.password) throw new Error('URL không hợp lệ')
      const target = new URL(url.pathname + url.search, urls.internal)
      const res = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(30000) })
      if (!res.ok || !res.body || Number(res.headers.get('content-length')) > 20 * 1024 * 1024) throw new Error('Không tải được tệp')
      const reader = res.body.getReader(), chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          size += value.length
          if (size > 20 * 1024 * 1024) throw new Error('Tệp quá lớn')
          chunks.push(value)
        }
      } finally { await reader.cancel() }
      data = Buffer.concat(chunks)
    }
    if (status === 2 || status === 4 || status === 6) await luuPhienBanMoi(String(body.key), String(capability.user), status, data)
    return Response.json({ error: 0 })
  } catch {
    console.error('Không lưu được callback OnlyOffice; không xác nhận lưu thành công.')
    return Response.json({ error: 1 }, { status: 500 })
  }
}
