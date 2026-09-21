import Link from 'next/link'
import { redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { danhSachThuMucTep } from '@/lib/tep/danh-sach'
import { LOAI_TEP, NHAN_LOAI_TEP } from '@/lib/tep/loai'

export default async function DanhSachTepPage() {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  let loiKetNoi = false
  let ds: Awaited<ReturnType<typeof danhSachThuMucTep>> = []
  try { ds = await danhSachThuMucTep() } catch { loiKetNoi = true }
  return <div className="app-shell min-h-screen">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
      <Link className="flex items-center gap-3 font-bold tracking-tight text-slate-900" href="/dashboard"><b className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</b><span>Quản lý tạm ứng</span></Link>
      <div className="flex items-center gap-3 text-sm text-slate-600 [&>span]:hidden sm:[&>span]:inline"><span>{phien.ho_ten}</span><b className="grid size-9 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100">{phien.ho_ten.slice(0, 1).toUpperCase()}</b></div>
    </header>
    <div className="app-grid grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:block lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:p-4">
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/dashboard">▦ Tổng quan</Link>
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/giao-dich">≡ Nhật ký giao dịch</Link>
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1 active" href="/tep">▤ Hồ sơ tệp</Link>
        {phien.vai_tro === 'admin' && <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/admin">⚙ Quản trị</Link>}
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/cai-dat">⚙ Cài đặt</Link>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:p-8 xl:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_p:not(.eyebrow)]:mt-2 [&_p:not(.eyebrow)]:text-slate-600">
          <div>
            <p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700">HỒ SƠ TỆP</p>
            <h1>Thư mục theo giao dịch</h1>
            <p>Mỗi giao dịch một thư mục: hóa đơn lúc đọc, tờ trình đã ký, giấy đề nghị thanh toán đã ký (PDF) và ảnh chuyển khoản.</p>
          </div>
          <Link className="btn btn-secondary" href="/giao-dich">← Nhật ký</Link>
        </header>
        {loiKetNoi && <p className="notice error">Không tải được danh sách hồ sơ. Kiểm tra kết nối PostgreSQL.</p>}
        {!loiKetNoi && !ds.length && <p className="card px-6 py-14 text-center text-slate-500">Chưa có giao dịch nào.</p>}
        {ds.length > 0 && <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3">
            <thead><tr><th>Ngày</th><th>Nội dung</th><th>Hình thức</th><th>Tệp</th><th></th></tr></thead>
            <tbody>{ds.map(tm => {
              const dem = LOAI_TEP.map(loai => {
                const n = tm.tep.filter(t => t.loai === loai).length
                return n ? `${NHAN_LOAI_TEP[loai]} ${n}` : null
              }).filter(Boolean)
              return <tr key={tm.id}>
                <td className="whitespace-nowrap tabular-nums">{tm.ngay}<span className="mt-1 block text-xs text-slate-500">#{tm.soThuTu}</span></td>
                <td><b className="font-semibold text-slate-900">{tm.noiDung}</b></td>
                <td>{tm.hinhThuc}</td>
                <td>{dem.length ? dem.join(' · ') : <span className="text-slate-400">Chưa có tệp</span>}</td>
                <td><Link className="text-indigo-700 hover:underline" href={`/tep/${tm.id}`}>Mở thư mục</Link></td>
              </tr>
            })}</tbody>
          </table>
        </div>}
      </main>
    </div>
  </div>
}
