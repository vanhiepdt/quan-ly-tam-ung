import Link from 'next/link'
import { redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { docTuyChonCot } from '../giao-dich/tuy-chon-actions'
import { TuyChonCot } from './tuy-chon-cot'
import { ThongTinGiay } from './thong-tin-giay'
import { docDuLieuCauHinhGiay } from './giay-actions'
import { docCanBo } from '@/lib/tai-chinh/cau-hinh-giay'
import { db } from '@/lib/db/pool'
import { dangXuat } from '@/app/dang-nhap/actions'
import { MAU_WORD } from '@/lib/tai-chinh/in-giay'

export default async function CaiDatPage() {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  const tuyChon = await docTuyChonCot()
  const loiBanDau = tuyChon.loi ?? null
  // Cấu hình giấy đề nghị dùng chung cho cả cơ quan nên chỉ quản trị viên xem và sửa.
  const laAdmin = phien.vai_tro === 'admin'
  let giay = null
  let canBo: Array<{ id: string; ten: string }> = []
  let nguoiLayHd: Array<{ id: string; ten: string }> = []
  if (laAdmin) {
    const [duLieu, dsCanBo, { rows: dsNguoiLayHd }] = await Promise.all([
      docDuLieuCauHinhGiay(),
      docCanBo(),
      db.query<{ id: string; ten: string }>('select id, ten from nguoi_lay_hd where dang_hoat_dong order by ten'),
    ])
    giay = duLieu
    canBo = dsCanBo.filter(cb => cb.dangHoatDong).map(cb => ({ id: cb.id, ten: cb.hoTen }))
    nguoiLayHd = dsNguoiLayHd
  }

  return <div className="app-shell min-h-screen">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
      <Link className="flex items-center gap-3 font-bold tracking-tight text-slate-900" href="/dashboard"><b className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</b><span>Quản lý tạm ứng</span></Link>
      <div className="flex items-center gap-3 text-sm text-slate-600 [&>span]:hidden sm:[&>span]:inline"><span>{phien.ho_ten}</span><b className="grid size-9 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100">{phien.ho_ten.slice(0, 1).toUpperCase()}</b></div>
    </header>
    <div className="app-grid grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:block lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:p-4">
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/dashboard">▦ Tổng quan</Link>
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/giao-dich">≡ Nhật ký giao dịch</Link>
        {phien.vai_tro === 'admin' && <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/admin">⚙ Quản trị</Link>}
        <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1 active" href="/cai-dat">⚙ Cài đặt</Link>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:p-8 xl:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_p:not(.eyebrow)]:mt-2 [&_p:not(.eyebrow)]:text-slate-600">
          <div>
            <p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700">CÀI ĐẶT</p>
            <h1>Tùy chỉnh hiển thị</h1>
            <p>Điều chỉnh giao diện, cột nhật ký và thông tin in trên giấy đề nghị.</p>
          </div>
          <form action={dangXuat}><button className="btn btn-secondary">Đăng xuất</button></form>
        </header>

        <div className="card mb-6 p-5 sm:p-6" data-panel="account">
          <h2 className="mb-2 text-lg font-semibold">Thông tin tài khoản</h2>
          <div className="grid gap-2 text-slate-600">
            <p><strong>Tên đăng nhập:</strong> {phien.ten_dang_nhap}</p>
            <p><strong>Họ tên:</strong> {phien.ho_ten}</p>
            <p><strong>Vai trò:</strong> {phien.vai_tro === 'admin' ? 'Quản trị viên' : phien.vai_tro === 'nhap_lieu' ? 'Nhập liệu' : 'Chỉ đọc'}</p>
          </div>
        </div>

        {giay && <div className="card mb-6 p-5 sm:p-6" data-panel="giay">
          <h2 className="mb-2 text-lg font-semibold">Thông tin giấy đề nghị</h2>
          <p className="mb-5 text-slate-500">Những chữ in giống nhau ở mọi giấy đề nghị, và người ký mặc định cho từng vai trò.</p>
          <ThongTinGiay banDau={giay} canBo={canBo} nguoiLayHd={nguoiLayHd} />
        </div>}

        {laAdmin && <section className="card mb-6 space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Mẫu giấy đề nghị</h2>
          <p>Sửa định dạng Word bằng OnlyOffice. Mẫu gốc và các bản đã lưu được giữ riêng, không ghi đè.</p>
          {[...new Set(Object.values(MAU_WORD))].map(ten => <p key={ten}><Link className="btn btn-secondary" href={`/cai-dat/mau/${encodeURIComponent(ten)}`}>{ten}</Link></p>)}
        </section>}

        <div className="card mb-6 p-5 sm:p-6" data-panel="settings">
          <h2 className="mb-4 text-lg font-semibold">Tùy chỉnh cột nhật ký</h2>
          <p className="mb-5 text-slate-500">Chọn cột hiển thị và điều chỉnh độ rộng cho phù hợp với nhu cầu của bạn.</p>
          <TuyChonCot banDau={tuyChon.tuyChon} loiBanDau={loiBanDau} />
        </div>
      </main>
    </div>
  </div>
}
