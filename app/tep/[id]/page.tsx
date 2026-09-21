import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { layPhien } from '@/lib/xac-thuc/phien'
import { thuMucTep } from '@/lib/tep/danh-sach'
import { NHAN_LOAI_TEP } from '@/lib/tep/loai'
import { TaiTep } from '@/app/giao-dich/upload'

function kichThuocChu(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ThuMucTepPage({ params }: { params: Promise<{ id: string }> }) {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) notFound()
  const tm = await thuMucTep(id.data)
  if (!tm) notFound()
  const coTheTai = phien.vai_tro === 'admin' || phien.vai_tro === 'nhap_lieu'
  return <div className="app-shell min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="eyebrow text-xs font-bold tracking-widest text-indigo-700">HỒ SƠ TỆP</p>
          <h1 className="text-lg font-bold text-slate-950">{tm.noiDung} · {tm.ngay}</h1>
          <p className="mt-1 text-sm text-slate-500">{tm.hinhThuc} · #{tm.soThuTu}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/tep">← Danh sách</Link>
          <Link className="btn btn-secondary" href="/giao-dich">Nhật ký</Link>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      {coTheTai && <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Tải tệp vào thư mục</h2>
        <p className="mb-4 text-sm text-slate-500">Hóa đơn: PDF hoặc ảnh. Tờ trình đã ký và giấy đề nghị thanh toán đã ký: chỉ PDF. Tối đa 10 MB.</p>
        <TaiTep giaoDichId={tm.id} />
      </section>}
      <section className="card overflow-x-auto p-0">
        {!tm.tep.length
          ? <p className="px-6 py-14 text-center text-slate-500">Thư mục còn trống.</p>
          : <table className="w-full text-left text-sm [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3">
            <thead><tr><th>Loại</th><th>Tên file</th><th>Dung lượng</th><th></th></tr></thead>
            <tbody>{tm.tep.map(t => (
              <tr key={t.id}>
                <td>{NHAN_LOAI_TEP[t.loai]}</td>
                <td className="break-all">{t.tenGoc || t.id}</td>
                <td className="tabular-nums">{kichThuocChu(t.kichThuoc)}</td>
                <td><a className="text-indigo-700 hover:underline" href={`/api/tep/${t.id}`}>Tải xuống</a></td>
              </tr>
            ))}</tbody>
          </table>}
      </section>
    </main>
  </div>
}
