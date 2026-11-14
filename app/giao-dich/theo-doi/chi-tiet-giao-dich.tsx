'use client'

import Link from 'next/link'
import { SuaGiaoDich } from '../sua-giao-dich'
import { ThanhToan } from '../thanh-toan'
import { LichSu } from '../lich-su'
import { NutXoa } from '../xoa-nut'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import type { GiaoDichTheoDoi } from '@/lib/tai-chinh/theo-doi-giao-dich'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const badge = (value: string) => value === 'Hợp lệ' || value === 'Đã thanh toán' ? 'good' : value === 'Chờ HĐ' || value === 'Chưa thanh toán' ? 'warn' : value === 'Không hợp lệ' ? 'bad' : 'neutral'

function MoneyRow({ label, value }: { label: string; value: number | null }) {
  return <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-0"><dt className="text-slate-600">{label}</dt><dd className="money">{value == null ? '—' : vnd.format(value)}</dd></div>
}

export function ChiTietGiaoDich({ row, coTheSua, vaiTro, collectors, donVi, onClose }: {
  row: GiaoDichTheoDoi
  coTheSua: boolean
  vaiTro: string
  collectors: NguoiLayHdChon[]
  donVi: Array<{ id: string; ten: string }>
  onClose?: () => void
}) {
  const original = row.giaoDich
  return <div className="space-y-5">
    <header className="border-b border-slate-200 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow mb-1 text-xs font-bold tracking-widest text-indigo-700">CHI TIẾT GIAO DỊCH</p><h2 className="break-words text-2xl font-bold tracking-tight text-slate-950">{row.noiDung}</h2><p className="mt-1 text-sm text-slate-500">{row.ngay} · {row.nhanHinhThuc.moTa}</p></div>
        {onClose && <button type="button" className="btn btn-secondary min-h-9 px-3 py-1" onClick={onClose}>Đóng</button>}
      </div>
      <p className="mt-3 text-sm text-slate-600">Đơn vị: <strong>{row.donViTen ?? 'Không gắn đơn vị tiếp khách'}</strong></p>
    </header>

    <section aria-labelledby="chi-tiet-trang-thai"><h3 id="chi-tiet-trang-thai" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Trạng thái</h3><div className="flex flex-wrap gap-2"><span className={`badge ${badge(row.trangThaiHd)}`}>Hóa đơn: {row.trangThaiHd}</span><span className={`badge ${badge(row.trangThaiTtPhi)}`}>Phí: {row.trangThaiTtPhi}</span><span className="badge neutral">Chi thực tế: {row.chiThucTe ? 'Có' : 'Không'}</span></div>{row.dongCanhBao.map(item => <p key={item} className="notice warn mt-3">{item}</p>)}</section>

    <section aria-labelledby="chi-tiet-tien"><h3 id="chi-tiet-tien" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Các khoản tiền</h3><dl><MoneyRow label={row.nhanSoTienChinh} value={row.soTienChinh} /><MoneyRow label="Tổng hóa đơn" value={row.tongTien} /><MoneyRow label="Khoản không được thanh toán" value={row.tienKhongDuocThanhToan} /><MoneyRow label="Tiền được hoàn/thanh toán" value={row.tienDuocThanhToan} /><MoneyRow label="Phí lấy hóa đơn" value={row.phiLayHd} /></dl></section>

    {row.bienDongSoDu.length > 0 && <section aria-labelledby="chi-tiet-so-du"><h3 id="chi-tiet-so-du" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Tác động số dư</h3><div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-3">Số dư</th><th className="px-3 py-2 text-right">Trước</th><th className="px-3 py-2 text-right">Thay đổi</th><th className="py-2 pl-3 text-right">Sau</th></tr></thead><tbody>{row.bienDongSoDu.map(item => <tr key={item.id} className="border-b border-slate-100"><th className="py-2 pr-3 text-left font-medium">{item.ten}</th><td className="money px-3 py-2">{vnd.format(item.truoc)}</td><td className={`money px-3 py-2 ${item.thayDoi < 0 ? 'text-red-700' : item.thayDoi > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{item.thayDoi > 0 ? '+' : ''}{vnd.format(item.thayDoi)}</td><td className="money py-2 pl-3">{vnd.format(item.sau)}</td></tr>)}</tbody></table></div><details className="mt-3 rounded-xl border border-slate-200 p-3"><summary className="font-semibold text-slate-700">Xem thêm số dư ({row.soDuKhac.length})</summary><dl className="mt-2">{row.soDuKhac.map(item => <MoneyRow key={item.id} label={item.ten} value={item.sau} />)}</dl></details></section>}

    <section aria-labelledby="chi-tiet-hoa-don"><h3 id="chi-tiet-hoa-don" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Hóa đơn và phí</h3><dl className="grid gap-y-2 text-sm sm:grid-cols-[minmax(10rem,auto)_1fr]"><dt className="text-slate-500">Ký hiệu / số</dt><dd>{row.kyHieuHd ?? '—'} / {row.soHd ?? '—'}</dd><dt className="text-slate-500">Loại chứng từ</dt><dd>{row.loaiHd ?? '—'}</dd><dt className="text-slate-500">Người lấy hóa đơn</dt><dd>{row.nguoiLayHdTen ?? '—'}</dd><dt className="text-slate-500">Tệp hóa đơn</dt><dd>{row.hoSo.coHoaDon ? 'Có' : 'Chưa có'}</dd><dt className="text-slate-500">Tệp chuyển khoản</dt><dd>{row.hoSo.coChuyenKhoan ? 'Có' : 'Chưa có'}</dd><dt className="text-slate-500">Tính phí lấy hóa đơn</dt><dd>{original.coTinhPhi ? 'Có' : 'Không'}</dd><dt className="text-slate-500">Cơ sở tính phí</dt><dd>{original.coSoTinhPhi === 'tien_duoc_thanh_toan' ? 'Tiền được thanh toán' : 'Tổng tiền'}</dd></dl>{row.trangThaiHd === 'Chờ HĐ' && <p className="notice mt-3">Chưa ghi nhận tiền hoàn/thanh toán từ hóa đơn này.</p>}{row.trangThaiHd === 'Không hợp lệ' && <p className="notice error mt-3">Hóa đơn chưa được tính vào khoản hoàn/thanh toán.</p>}</section>

    {(original.hinhThuc === 'Hoàn tạm ứng' || original.hinhThuc === 'Cơ quan trả thẳng') && <section aria-labelledby="chi-tiet-chi-thuc-te"><h3 id="chi-tiet-chi-thuc-te" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Chi thực tế</h3><p>Chi thực tế: <strong>{row.chiThucTe ? 'Có' : 'Không'}</strong></p><p className="mt-1">Nguồn bù: <strong>{row.nguonBuChiThucTeNhan}</strong></p>{row.chiThucTe && row.nguonBuChiThucTe === 'tu_chiu' && <p className="notice mt-3">Khoản không được thanh toán không trừ vào số dư và không ghi nhận là khoản lấy quỹ Chị Thúy.</p>}</section>}

    <section aria-labelledby="chi-tiet-ho-so"><h3 id="chi-tiet-ho-so" className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Hồ sơ và thao tác</h3><div className="flex flex-wrap gap-2"><Link className="btn btn-secondary" href={`/tep/${row.id}`} prefetch={false}>Tệp</Link>{row.hoSo.coGiay && giayChoHinhThuc(row.hinhThuc).length > 0 && <Link className="btn btn-secondary" href={`/giay/${row.id}`} prefetch={false}>Giấy</Link>}<LichSu id={row.id} nhan={`${row.ngay} · ${row.noiDung}`} />{coTheSua && <SuaGiaoDich row={original} collectors={collectors} donVi={donVi} vaiTro={vaiTro} />}{coTheSua && row.trangThaiTtPhi === 'Chưa thanh toán' && <ThanhToan id={row.id} coTheXacNhan={vaiTro === 'admin'} />}{coTheSua && <NutXoa id={row.id} />}</div></section>
    {row.ghiChu && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Ghi chú: {row.ghiChu}</p>}
  </div>
}
