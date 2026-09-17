import { layPhien } from '@/lib/xac-thuc/phien'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { timGiaoDichTinh, giayTheoLoai, MAU_WORD } from '@/lib/tai-chinh/in-giay'
import { dienMauDocx } from '@/lib/van-ban/docx'
import { taoHoacLayTaiLieu, moPhien, docMau, laId } from '@/lib/onlyoffice/tai-lieu'
import { cauHinhEditor, diaChi } from '@/lib/onlyoffice/cau-hinh'

export async function POST(req: Request) {
  let sameOrigin = false
  try {
    const origin = new URL(req.headers.get('origin') || '')
    sameOrigin = origin.host === req.headers.get('host') && ['http:', 'https:'].includes(origin.protocol) && origin.origin === req.headers.get('origin')
  } catch { /* Origin bắt buộc cho thao tác từ trình duyệt. */ }
  if (!sameOrigin) return Response.json({ loi: 'Sai nguồn yêu cầu' }, { status: 403 })
  const phien = await layPhien()
  if (!phien || phien.doi_mat_khau) return Response.json({ loi: 'Vui lòng đăng nhập và đổi mật khẩu nếu được yêu cầu.' }, { status: 401 })
  try {
    diaChi()
    const data = await req.json()
    let t, title: string
    if (typeof data.mau === 'string') {
      if (phien.vai_tro !== 'admin') return Response.json({ loi: 'Chỉ quản trị viên được sửa mẫu.' }, { status: 403 })
      if (!Object.values(MAU_WORD).includes(data.mau)) return Response.json({ loi: 'Mẫu không tồn tại.' }, { status: 404 })
      title = data.mau
      t = await taoHoacLayTaiLieu(phien.id, null, null, data.mau, () => docMau(data.mau))
    } else {
      if (typeof data.id !== 'string' || !laId(data.id)) return Response.json({ loi: 'Mã không hợp lệ.' }, { status: 400 })
      const gd = await timGiaoDichTinh(data.id)
      const giay = gd && giayTheoLoai(gd, await boiCanhGiay(phien), data.loai)
      if (!giay) return Response.json({ loi: 'Giấy không tồn tại.' }, { status: 404 })
      title = `${giay.tieuDe}.docx`
      t = await taoHoacLayTaiLieu(phien.id, data.id, giay.loai, null, async () => dienMauDocx(await docMau(MAU_WORD[giay.loai]), giay.thayThe, giay.thayCoDinh).duLieu)
    }
    const current = await moPhien(t, phien.id)
    return Response.json({ ...cauHinhEditor(current, phien, title), phienBan: current.phien_ban }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('Không mở được OnlyOffice.')
    return Response.json({ loi: 'Không mở được trình soạn thảo. Kiểm tra cấu hình, migration và DocumentServer; vẫn có thể tải Word.' }, { status: 503 })
  }
}
