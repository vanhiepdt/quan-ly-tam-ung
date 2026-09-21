import Link from 'next/link'
import { redirect } from 'next/navigation'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhChiSo } from '@/lib/tai-chinh/chi-so'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { layPhien } from '@/lib/xac-thuc/phien'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const tien = (so: number) => vnd.format(so)

type Nhom = { tieuDe: string; moTa: string; muc: Array<[string, number, string]> }

export default async function Dashboard() {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')
  let loiKetNoi = false
  let duLieu: Awaited<ReturnType<typeof layDuLieuTaiChinh>> = { giaoDich: [], thamSo: { tyLePhiChung: .15, tyLeTheoNguoi: {} } }
  try { duLieu = await layDuLieuTaiChinh() } catch { loiKetNoi = true }
  const giaoDich = tinhToan(duLieu.giaoDich, duLieu.thamSo)
  const k = tinhChiSo(giaoDich)
  const nhom: Nhom[] = [
    { tieuDe: 'Tạm ứng từ cơ quan', moTa: 'Dòng tiền cơ quan đã cấp và số dư theo lý thuyết.', muc: [
      ['Tổng tạm ứng', k.tongTamUng, 'Tất cả khoản tiền cơ quan đã cấp'], ['Tạm ứng thêm', k.tamUngThem, 'Khoản cấp bổ sung'],
      ['Tồn quỹ cơ quan', k.tonQuyCoQuan, 'Quỹ phí và quỹ chị Thúy còn lại'], ['Số dư lý thuyết', k.duNoLyThuyet, 'Tạm ứng trừ hoàn ứng và tiền nộp lại'],
    ] },
    { tieuDe: 'Quỹ phí hóa đơn', moTa: 'Theo dõi tiền do người phụ trách đang giữ để trả phí lấy hóa đơn.', muc: [
      ['Đã nhận', k.quyToiNhan, 'Tạm ứng nhận về trừ tiền đã giao chị Thúy'], ['Phí đã trả', k.quyToiDaChi, 'Chỉ gồm khoản được đánh dấu đã thanh toán'],
      ['Đã nộp trả CQ', k.quyToiNopTra, 'Tiền mặt hoàn về cơ quan'], ['Còn lại', k.quyToiDu, 'Tiền quỹ phí đang còn giữ'],
    ] },
    { tieuDe: 'Quỹ chị Thúy', moTa: 'Theo dõi tiền giao và các khoản chị Thúy đã hoàn ứng.', muc: [
      ['Giao ban đầu', k.thuyGoc, 'Lần giao tiền đầu tiên'], ['Giao thêm', k.thuyThem, 'Các lần giao tiếp theo'],
      ['Đã hoàn ứng', k.thuyDaHoan, 'Hóa đơn hợp lệ theo hình thức hoàn tạm ứng'], ['Còn lại', k.thuyDu, 'Tiền chị Thúy đang giữ theo sổ'],
    ] },
    { tieuDe: 'Chi tiếp khách', moTa: 'Tổng hợp chi phí hóa đơn và phần cơ quan thanh toán trực tiếp.', muc: [
      ['Tổng hóa đơn', k.tongBill, 'Tất cả giá trị hóa đơn đã ghi nhận'], ['Rượu bia loại trừ', k.tongRuouBia, 'Phần không được hoàn ứng'],
      ['CQ trả thẳng', k.cqTraThang, 'Hóa đơn hợp lệ cơ quan thanh toán trực tiếp'], ['Chi thực tế', k.tongChiThucTe, 'Phí đã trả và khoản chị Thúy đã hoàn ứng'],
    ] },
    { tieuDe: 'Chờ xử lý', moTa: 'Các khoản cần bổ sung hóa đơn hoặc đối chiếu thanh toán.', muc: [
      ['Chờ hoàn ứng', k.choHd, 'Hóa đơn chờ theo hình thức hoàn tạm ứng'], ['Chờ CQ trả thẳng', k.choCqTraThang, 'Hóa đơn chờ theo hình thức CQ trả thẳng'],
      ['Số dư thực tế', k.duThucTe, 'Trừ toàn bộ phí tính theo lý thuyết'], ['Tiền đang cầm', k.duDangCam, 'Chỉ trừ phí đã thanh toán'],
    ] },
  ]
  const ve = k.tonQuyCoQuan + k.tongChiThucTe + k.quyToiNopTra

  return <div className="app-shell min-h-screen"><header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8"><Link className="flex items-center gap-3 font-bold tracking-tight text-slate-900" href="/dashboard"><b className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</b><span>Quản lý tạm ứng</span></Link><div className="flex items-center gap-3 text-sm text-slate-600 [&>span]:hidden sm:[&>span]:inline"><span>{phien?.ho_ten ?? 'Tài khoản'}</span><b className="grid size-9 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100">{(phien?.ho_ten ?? 'T').slice(0, 1).toUpperCase()}</b></div></header><div className="app-grid grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:block lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:p-4"><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1 active" href="/dashboard">▦ Tổng quan</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/giao-dich">≡ Nhật ký giao dịch</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/tep">▤ Hồ sơ tệp</Link>{phien?.vai_tro === 'admin' && <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/admin">⚙ Quản trị</Link>}<Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/cai-dat">⚙ Cài đặt</Link></aside><main className="min-w-0 px-4 py-7 sm:px-6 lg:p-8 xl:p-10"><header className="mb-8 flex flex-wrap items-start justify-between gap-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-950 [&_p:not(.eyebrow)]:mt-2 [&_p:not(.eyebrow)]:text-slate-600"><div><p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700">TỔNG QUAN TÀI CHÍNH</p><h1>Kiểm soát tạm ứng rõ ràng</h1><p>Cập nhật theo từng giao dịch, hóa đơn và khoản thanh toán phí.</p></div><div className="flex flex-wrap gap-3"><Link className="btn btn-secondary" href="/giao-dich">Xem nhật ký</Link>{phien?.vai_tro !== 'chi_doc' && <Link className="btn btn-primary" href="/giao-dich">+ Thêm giao dịch</Link>}</div></header>
  {loiKetNoi ? <div className="reconcile warn"><b>⚠</b><div><b>Chưa tải được dữ liệu PostgreSQL.</b><br />Kiểm tra Docker PostgreSQL và cấu hình DATABASE_URL trước khi nhập liệu.</div></div> : <div className={`reconcile ${k.canDoi ? 'good' : 'warn'}`}><b>{k.canDoi ? '✓' : '⚠'}</b><div><b>{k.canDoi ? 'Quỹ đã đối soát.' : 'Quỹ cần được đối soát.'}</b><br />Tồn quỹ {tien(k.tonQuyCoQuan)} + chi thực tế {tien(k.tongChiThucTe)} + nộp trả {tien(k.quyToiNopTra)} = {tien(ve)}; tổng tạm ứng {tien(k.tongTamUng)}.</div></div>}
  {!giaoDich.length && !loiKetNoi ? <section className="card px-6 py-14 text-center text-slate-500 [&_p]:my-3"><b>Chưa có giao dịch nào.</b><p>Thêm khoản tạm ứng, hóa đơn hoặc giao tiền để bắt đầu theo dõi quỹ.</p>{phien?.vai_tro !== 'chi_doc' && <Link className="btn btn-primary" href="/giao-dich">Thêm giao dịch đầu tiên</Link>}</section> : nhom.map((n) => <section className="my-8" key={n.tieuDe}><h2 className="mb-2 text-lg font-semibold text-slate-900">{n.tieuDe}</h2><p className="text-slate-500" >{n.moTa}</p><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{n.muc.map(([ten, giaTri, chuThich]) => <article className="card min-w-0 p-5" key={ten}><p className="mb-4 text-sm font-medium text-slate-600">{ten}</p><strong className="block break-words text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">{tien(giaTri)}</strong><p className="mt-3 text-xs leading-relaxed text-slate-500">{chuThich}</p></article>)}</div></section>)}</main></div></div>
}
