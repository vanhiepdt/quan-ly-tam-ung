import Link from 'next/link'
import { redirect } from 'next/navigation'
import { layPhien } from '@/lib/xac-thuc/phien'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { taoDuLieuTheoDoi } from '@/lib/tai-chinh/theo-doi-giao-dich'
import { taiKhoanTu, type NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { db } from '@/lib/db/pool'
import { ToggleSidebar } from '../toggle-sidebar'
import { FormGiaoDich } from '../form'
import { docCauHinhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { TheoDoiGiaoDich, type HoiNghiTheoDoi } from './theo-doi-giao-dich'
import { TaoHoiNghi } from './tao-hoi-nghi'

export default async function TheoDoiPage() {
  const phien = await layPhien()
  if (!phien) redirect('/dang-nhap')

  let rows: ReturnType<typeof taoDuLieuTheoDoi> = []
  let loiTaiDuLieu: string | undefined
  let collectors: NguoiLayHdChon[] = []
  let donVi: Array<{ id: string; ten: string }> = []
  let nguoiLayHdMacDinhId: string | null = null
  let trangThaiTtPhiMacDinh = 'Không phát sinh'
  let hoiNghi: HoiNghiTheoDoi[] = []
  let tyLePhiChung = 0.15
  let tyLeTheoNguoi: Record<string, number> = {}
  try {
    const { giaoDich, thamSo } = await layDuLieuTaiChinh()
    rows = taoDuLieuTheoDoi(tinhToan(giaoDich, thamSo)).reverse()
    tyLePhiChung = thamSo.tyLePhiChung
    tyLeTheoNguoi = thamSo.tyLeTheoNguoi
    const [collectorResult, donViResult, cauHinhGiay] = await Promise.all([
      db.query<{ id: string; ten: string; so_tai_khoan: string | null; ngan_hang_bin: string | null; ten_ngan_hang: string | null; ten_chu_tk: string | null }>('select id, ten, so_tai_khoan, ngan_hang_bin, ten_ngan_hang, ten_chu_tk from nguoi_lay_hd where dang_hoat_dong order by ten'),
      db.query<{ id: string; ten: string }>('select id, ten from don_vi where dang_hoat_dong order by ten'),
      docCauHinhGiay(),
    ])
    collectors = collectorResult.rows.map(item => ({ id: item.id, ten: item.ten, taiKhoan: taiKhoanTu(item) }))
    donVi = donViResult.rows
    const hoiNghiResult = await db.query<{ id: string; ten: string; ngay: string; ghi_chu: string | null; loai_giao_dich: string; nguon_phi: string }>(`select id,ten,to_char(ngay,'YYYY-MM-DD') ngay,ghi_chu,loai_giao_dich,nguon_phi from hoi_nghi where not da_xoa order by ngay desc,tao_luc desc`)
    const byId = new Map<string, HoiNghiTheoDoi>()
    for (const item of hoiNghiResult.rows) {
      byId.set(item.id, { id: item.id, ten: item.ten, ngay: item.ngay, ghiChu: item.ghi_chu, loaiGiaoDich: item.loai_giao_dich, nguonPhi: item.nguon_phi, rows: [], tongTien: 0, tienDuocThanhToan: 0, tongPhi: 0 })
    }
    // Tổng lấy từ các dòng đã qua tinhToan, không tự tính lại công thức tài chính ở đây.
    for (const row of rows) {
      const group = row.giaoDich.hoiNghiId ? byId.get(row.giaoDich.hoiNghiId) : undefined
      if (!group) continue
      group.rows.push(row)
      group.tongTien += row.tongTien
      group.tienDuocThanhToan += row.tienDuocThanhToan ?? 0
      group.tongPhi += row.phiLayHd
    }
    hoiNghi = [...byId.values()]
    nguoiLayHdMacDinhId = cauHinhGiay.nguoiLayHdMacDinhId
    trangThaiTtPhiMacDinh = cauHinhGiay.trangThaiTtPhiMacDinh
  } catch {
    loiTaiDuLieu = 'Không tải được dữ liệu giao dịch. Kiểm tra kết nối PostgreSQL và thử lại.'
  }
  const coTheSua = phien.vai_tro === 'admin' || phien.vai_tro === 'nhap_lieu'

  return <div className="app-shell min-h-screen">
    <ToggleSidebar />
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8"><Link className="flex items-center gap-3 font-bold tracking-tight text-slate-900" href="/dashboard"><b className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</b><span>Quản lý tạm ứng</span></Link><div className="flex items-center gap-3 text-sm text-slate-600 [&>span]:hidden sm:[&>span]:inline"><span>{phien.ho_ten}</span><b className="grid size-9 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100">{phien.ho_ten.slice(0, 1).toUpperCase()}</b></div></header>
    <div className="app-grid grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="sidebar flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-3 lg:block lg:min-h-[calc(100vh-64px)] lg:border-r lg:border-b-0 lg:p-4"><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/dashboard">▦ Tổng quan</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1 active" href="/giao-dich">≡ Nhật ký giao dịch</Link><Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/tep">▤ Hồ sơ tệp</Link>{phien.vai_tro === 'admin' && <Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/admin">⚙ Quản trị</Link>}<Link className="nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 lg:mb-1" href="/cai-dat">⚙ Cài đặt</Link></aside>
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:p-8 xl:p-10"><header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700">THEO DÕI GIAO DỊCH</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">Theo dõi từng khoản tiền</h1><p className="mt-2 text-sm text-slate-600">Số dư được tính trên toàn bộ nhật ký trước khi lọc danh sách.</p></div><div className="flex flex-wrap gap-3">{coTheSua && <FormGiaoDich collectors={collectors} donVi={donVi} nguoiLayHdMacDinhId={nguoiLayHdMacDinhId} trangThaiTtPhiMacDinh={trangThaiTtPhiMacDinh} />}<Link className="btn btn-secondary" href="/giao-dich">← Bảng nhật ký đầy đủ</Link></div></header><TaoHoiNghi /><TheoDoiGiaoDich rows={rows} hoiNghi={hoiNghi} coTheSua={coTheSua} vaiTro={phien.vai_tro} loiTaiDuLieu={loiTaiDuLieu} collectors={collectors} donVi={donVi} tyLePhiChung={tyLePhiChung} tyLeTheoNguoi={tyLeTheoNguoi} /></main>
    </div>
  </div>
}
