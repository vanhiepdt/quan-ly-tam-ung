import { NextResponse } from 'next/server'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { ganTepVaoHoiNghi, LOAI_TEP_HOI_NGHI } from '@/lib/tep/gan-hoi-nghi'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const phien = await batBuocVaiTro('admin', 'nhap_lieu')
    const form = await request.formData()
    const tep = form.get('tep')
    const loai = String(form.get('loai') ?? '')
    if (!(tep instanceof File) || !(LOAI_TEP_HOI_NGHI as readonly string[]).includes(loai)) return NextResponse.json({ loi: 'Dữ liệu chứng từ không hợp lệ.' }, { status: 400 })
    const loi = await ganTepVaoHoiNghi(phien.id, (await params).id, tep, loai, String(form.get('ten_loai') ?? ''), form.get('giao_dich_id') ? String(form.get('giao_dich_id')) : null)
    return loi ? NextResponse.json({ loi }, { status: 400 }) : NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ loi: error instanceof Error ? error.message : 'Không tải được chứng từ.' }, { status: 500 }) }
}
