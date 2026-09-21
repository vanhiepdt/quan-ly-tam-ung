import { NextResponse } from 'next/server'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { ganTepVaoGiaoDich } from '@/lib/tep/gan'
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const phien = await batBuocVaiTro('admin', 'nhap_lieu')
    const form = await request.formData()
    const tep = form.get('tep')
    const loai = String(form.get('loai'))
    if (!(tep instanceof File)) return NextResponse.json({ loi: 'Dữ liệu tải lên không hợp lệ.' }, { status: 400 })
    const gd = (await params).id
    const loi = await ganTepVaoGiaoDich(phien.id, gd, tep, loai)
    if (loi) return NextResponse.json({ loi }, { status: loi === 'Giao dịch không tồn tại.' ? 404 : 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ loi: error instanceof Error ? error.message : 'Không tải được tệp.' }, { status: 500 })
  }
}
