import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { giayChoHinhThuc, TEN_GIAY } from '@/lib/tai-chinh/giay'
import { SoanThao } from '../soan-thao'

export default async function XemGiayPage({ params }: { params: Promise<{ id: string }> }) {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  const { id } = await params
  const gd = await timGiaoDichTinh(id)
  if (!gd) notFound()
  const giay = giayChoHinhThuc(gd.hinhThuc)

  return <div className="app-shell min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="eyebrow text-xs font-bold tracking-widest text-indigo-700">GIẤY ĐỀ NGHỊ</p>
          <h1 className="text-lg font-bold text-slate-950">{gd.noiDung || 'Giao dịch'} · {gd.ngay}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href={`/tep/${id}`}>Hồ sơ tệp</Link>
          <Link className="btn btn-secondary" href="/giao-dich">← Nhật ký</Link>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      {giay.length === 0
        ? <p className="notice error">Hình thức của giao dịch này không lập giấy đề nghị.</p>
        : <>
          <p>Mở giấy trong OnlyOffice để chỉnh sửa và in đúng định dạng Word, hoặc tải DOCX về máy. Không in trang web này.</p>
          <p className="notice">Bản chỉnh sửa trực tuyến được lưu riêng theo giao dịch, không tự thay đổi khi sửa số liệu nhật ký. Bản sửa bằng Word trên máy không tự gửi lại ứng dụng.</p>
          {giay.map(loai => <section className="card flex flex-wrap items-center justify-between gap-4 p-5" key={loai}>
            <h2 className="text-lg font-semibold">{TEN_GIAY[loai]}</h2>
            <a className="btn btn-primary" href={`/giay/${id}/${loai}`} download aria-label={`Tải .docx — ${TEN_GIAY[loai]}`}>Tải .docx</a>
            <SoanThao id={id} loai={loai} />
          </section>)}
        </>}
    </main>
  </div>
}
