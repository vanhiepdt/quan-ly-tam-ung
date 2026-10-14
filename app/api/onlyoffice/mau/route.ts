import { layPhien } from '@/lib/xac-thuc/phien'
import { docMau } from '@/lib/onlyoffice/tai-lieu'
import { DANH_SACH_MAU_WORD } from '@/lib/van-ban/mau-word'

export async function GET(req: Request) {
  const phien = await layPhien()
  if (!phien || phien.vai_tro !== 'admin' || phien.doi_mat_khau) return new Response(null, { status: 403 })
  const ten = new URL(req.url).searchParams.get('ten')
  if (!ten || !(DANH_SACH_MAU_WORD as readonly string[]).includes(ten)) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(await docMau(ten)), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="mau.docx"; filename*=UTF-8''${encodeURIComponent(ten)}`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } })
}
