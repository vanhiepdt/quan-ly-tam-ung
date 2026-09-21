import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormGiaoDich } from './form'
import { BangNhatKy } from './bang-nhat-ky'
import { ToggleSidebar } from './toggle-sidebar'
import { docTuyChonCot } from './tuy-chon-actions'
import { layPhien } from '@/lib/xac-thuc/phien'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { docCauHinhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { taiKhoanTu, type NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { db } from '@/lib/db/pool'

export default async function GiaoDichPage() {
  // Middleware cookie presence is not authentication. Never fetch financial data before this check.
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  let loiKetNoi = false
  let rows: ReturnType<typeof tinhToan> = []
  let collectors: NguoiLayHdChon[] = []
  let donVi: Array<{ id: string; ten: string; lan_cuoi?: string; so_lan?: number }> = []
  let nguoiLayHdMacDinhId: string | null = null
  let trangThaiTtPhiMacDinh = 'Không phát sinh'
  try {
    const { giaoDich, thamSo } = await layDuLieuTaiChinh()
    rows = tinhToan(giaoDich, thamSo)
    const [nguoiLayHdResult, donViResult, cauHinhGiay] = await Promise.all([
      // Tài khoản nhận tiền đi kèm để form hiện trước số sẽ in khi thanh toán chuyển khoản.
      db.query<{ id: string; ten: string; so_tai_khoan: string | null; ngan_hang_bin: string | null; ten_ngan_hang: string | null; ten_chu_tk: string | null }>(
        'select id, ten, so_tai_khoan, ngan_hang_bin, ten_ngan_hang, ten_chu_tk from nguoi_lay_hd where dang_hoat_dong order by ten'),
      // Ưu tiên: chưa tiếp lần nào, rồi ít lần nhất, rồi lần tiếp xa nhất.
      db.query<{ id: string; ten: string; lan_cuoi: string | null; so_lan: number }>(`
        select dv.id, dv.ten,
          to_char(max(gd.ngay), 'DD/MM/YYYY') as lan_cuoi,
          count(gd.id)::int as so_lan
        from don_vi dv
        left join giao_dich gd on gd.don_vi_id = dv.id and not gd.da_xoa
        where dv.dang_hoat_dong
        group by dv.id, dv.ten
        order by
          case when count(gd.id) = 0 then 0 else 1 end,
          count(gd.id) asc,
          max(gd.ngay) asc nulls first,
          dv.ten
      `),
      docCauHinhGiay(),
    ])
    collectors = nguoiLayHdResult.rows.map(r => ({ id: r.id, ten: r.ten, taiKhoan: taiKhoanTu(r) }))
    donVi = donViResult.rows.map(r => ({
      id: r.id, ten: r.ten, lan_cuoi: r.lan_cuoi || undefined, so_lan: r.so_lan,
    }))
    nguoiLayHdMacDinhId = cauHinhGiay.nguoiLayHdMacDinhId
    trangThaiTtPhiMacDinh = cauHinhGiay.trangThaiTtPhiMacDinh
  } catch { loiKetNoi = true }
  const tuyChon = await docTuyChonCot()
  const coTheSua = phien.vai_tro === 'admin' || phien.vai_tro === 'nhap_lieu'
  return <div className="app-shell min-h-screen">
    <ToggleSidebar />
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8"><Link className="flex items-center gap-3 font-bold tracking-tight text-slate-900" href="/dashboard"><b className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</b><span>Quản lý tạm ứng</span></Link><div className="flex items-center gap-3 text-sm text-slate-600 [&>span]:hidden sm:[&>span]:inline"><span>{phien.ho_ten}</span><b className="grid size-9 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100">{phien.ho_ten.slice(0, 1).toUpperCase()}</b></div></header><div className="app-grid grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:block lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:p-4"><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/dashboard">▦ Tổng quan</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1 active" href="/giao-dich">≡ Nhật ký giao dịch</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/tep">▤ Hồ sơ tệp</Link>{phien.vai_tro === 'admin' && <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/admin">⚙ Quản trị</Link>}<Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/cai-dat">⚙ Cài đặt</Link></aside><main className="min-w-0 px-4 py-7 sm:px-6 lg:p-8 xl:p-10"><header className="mb-8 flex flex-wrap items-start justify-between gap-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_p:not(.eyebrow)]:mt-2 [&_p:not(.eyebrow)]:text-slate-600"><div><p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700">NHẬT KÝ GIAO DỊCH</p><h1>Theo dõi từng khoản tiền</h1><p>Giá trị tính toán được tạo tự động và không lưu đè lên dữ liệu gốc.</p></div><div className="flex flex-wrap gap-3">{coTheSua && <FormGiaoDich collectors={collectors} donVi={donVi} nguoiLayHdMacDinhId={nguoiLayHdMacDinhId} trangThaiTtPhiMacDinh={trangThaiTtPhiMacDinh} />}<Link className="btn btn-secondary" href="/dashboard">← Tổng quan</Link></div></header>
    {loiKetNoi && <p className="notice error">Không tải được dữ liệu PostgreSQL. Kiểm tra dịch vụ Docker trước khi thao tác.</p>}
    <BangNhatKy rows={rows} coTheSua={coTheSua} banDau={tuyChon.tuyChon} loiBanDau={tuyChon.loi}
      phuTro={{ collectors, donVi, vaiTro: phien.vai_tro }} />
  </main></div></div>
}
