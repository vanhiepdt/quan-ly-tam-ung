import { docBanXem } from '@/lib/onlyoffice/xem-truoc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DocumentServer không có cookie: chỉ nhận capability ký riêng, hạn 15 phút.
export async function GET(req: Request) {
  try {
    const bytes = await docBanXem(new URL(req.url).searchParams.get('t'))
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="xem-truoc.docx"',
    } })
  } catch {
    return Response.json({ loi: 'Bản xem trước không tồn tại hoặc đã hết hạn.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
}
