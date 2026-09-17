import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { MAU_WORD } from '@/lib/tai-chinh/in-giay'
import { docMau } from '@/lib/onlyoffice/tai-lieu'
import { docZip } from '@/lib/van-ban/zip'
import { SoanThao } from '@/app/giay/soan-thao'

export default async function MauPage({ params }: { params: Promise<{ ten: string }> }) {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  if (phien.vai_tro !== 'admin' || phien.doi_mat_khau) redirect('/cai-dat')
  const { ten: thamSo } = await params
  // Next.js may preserve percent encoding in dynamic params. Resolve only known templates.
  const ten = Object.values(MAU_WORD).find(mau => mau === thamSo || encodeURIComponent(mau) === thamSo)
  if (!ten) notFound()
  const entries = docZip(await docMau(ten))
  const text = entries.filter(m => m.ten.startsWith('word/') && m.ten.endsWith('.xml')).map(m => m.duLieu.toString().replace(/<[^>]*>/g, '')).join('\n')
  const placeholders = [...new Set([...text.matchAll(/\[\[([A-Za-z_][A-Za-z0-9_]*)\]{1,2}/g)].map(m => `[[${m[1]}]]`))].sort()
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <Link className="btn btn-secondary" href="/cai-dat">← Cài đặt</Link>
    <h1 className="text-2xl font-bold">Mẫu giấy: {ten}</h1>
    <p className="notice">Bản gốc trong thư mục Mau không bị ghi đè. Mỗi lần lưu giữ một phiên bản riêng trong uploads/giay và PostgreSQL. Mẫu mới chỉ áp dụng cho giấy chưa lập.</p>
    <p>Giữ nguyên tên các chỗ điền dữ liệu: {placeholders.join(', ') || 'Không tìm thấy chỗ điền.'}</p>
    <a className="btn btn-primary" href={`/api/onlyoffice/mau?ten=${encodeURIComponent(ten)}`} download>Tải mẫu Word hiện tại</a>
    <SoanThao mau={ten} />
  </main>
}
