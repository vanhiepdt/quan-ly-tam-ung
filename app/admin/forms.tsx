'use client'
import { useActionState, useEffect, useState } from 'react'
import { quanLyTaiKhoan, themNguoiLayHd, suaNguoiLayHd, voHieuHoaNguoiLayHd, kichHoatNguoiLayHd, type KetQua } from './actions'
import { themDonVi, suaDonVi, voHieuHoaDonVi, voHieuHoaNhieuDonVi, kichHoatDonVi, nhapDonViExcel } from './don-vi-actions'
import { themCanBo, suaCanBo, voHieuHoaCanBo, kichHoatCanBo } from './can-bo-actions'
import { GIOI_TINH } from '@/lib/validation/can-bo'
import { TaiKhoanNganHang } from './tai-khoan-ngan-hang'

const initial: KetQua = {}
type LuaChon = { id: string; ten: string }
export type CanBoAdmin = {
  id: string; ho_ten: string; gioi_tinh: string | null; chuc_danh: string | null
  phong: string | null; la_lanh_dao: boolean; dang_hoat_dong: boolean; nguoi_dung_id: string | null
}
function ThongBao({ state }: { state: KetQua & { thanhCong?: string } }) {
  const thanhCong = state.thanh_cong ?? state.thanhCong
  return <>{state.loi && <p className="notice sm:col-span-2 error" role="alert">{state.loi}</p>}{thanhCong && <p className="notice sm:col-span-2 success" role="status">{thanhCong}</p>}</>
}
export function TaoTaiKhoan() {
  const [state, action, pending] = useActionState(quanLyTaiKhoan, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <input type="hidden" name="thao_tac" value="tao" />
    <label className="field">Tên đăng nhập<input name="ten_dang_nhap" required minLength={3} maxLength={50} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="vd: ke_toan" /><small>3–50 ký tự; chữ không dấu, số, dấu . _ -</small></label>
    <label className="field">Tên hiển thị<input name="ho_ten" required maxLength={120} placeholder="Họ và tên người dùng" /></label>
    <label className="field">Mật khẩu ban đầu<input name="mat_khau" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /><small>Tối thiểu 8 ký tự. Gửi riêng cho người nhận.</small></label>
    <label className="field">Vai trò<select name="vai_tro" defaultValue="chi_doc"><option value="chi_doc">Chỉ đọc — xem dữ liệu</option><option value="nhap_lieu">Nhập liệu — quản lý giao dịch</option><option value="admin">Quản trị viên — toàn quyền</option></select></label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang tạo…' : 'Tạo tài khoản'}</button><span>Không yêu cầu email. Tên đăng nhập không phân biệt hoa thường.</span></div>
    <ThongBao state={state} />
  </form>
}
export function ThaoTacTaiKhoan({ id, ten, active, self }: { id: string; ten: string; active: boolean; self: boolean }) {
  const [state, action, pending] = useActionState(quanLyTaiKhoan, initial)
  return <div className="flex flex-col items-start gap-3 [&_details]:w-full">
    <details><summary>Đặt lại mật khẩu</summary><form action={action} className="mt-3 grid min-w-48 gap-3" onSubmit={event => { if (!window.confirm(`Đặt lại mật khẩu cho ${ten}? Tất cả phiên đăng nhập của tài khoản này sẽ bị thu hồi.`)) event.preventDefault() }}>
      <input type="hidden" name="thao_tac" value="dat_lai" /><input type="hidden" name="id" value={id} />
      <label className="field">Mật khẩu mới<input name="mat_khau" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></label>
      <small>Tối thiểu 8 ký tự. {self ? 'Bạn sẽ cần đăng nhập lại sau khi lưu.' : 'Tất cả phiên đăng nhập sẽ bị thu hồi.'}</small>
      <button disabled={pending} className="btn btn-primary">Lưu mật khẩu mới</button>
    </form></details>
    <form action={action} onSubmit={event => { if (!window.confirm(active ? `Vô hiệu hóa ${ten}? Người này sẽ bị đăng xuất. Dữ liệu và lịch sử vẫn được giữ lại.` : `Kích hoạt lại ${ten}?`)) event.preventDefault() }}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="thao_tac" value={active ? 'vo_hieu' : 'kich_hoat'} />
      <button disabled={pending || self} className={active ? 'btn btn-danger' : 'btn btn-secondary'} title={self ? 'Không thể vô hiệu hóa tài khoản đang sử dụng' : undefined}>{active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</button>
    </form>
    <ThongBao state={state} />
  </div>
}

export function TaoNguoiLayHd({ canBo = [] }: { canBo?: LuaChon[] }) {
  const [state, action, pending] = useActionState(themNguoiLayHd, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <label className="field">Tên người lấy hóa đơn *<input name="ten" required maxLength={200} placeholder="Họ và tên" /></label>
    <label className="field">Tỷ lệ phí (%)<input name="ty_le_phi" type="number" step="0.01" min="0" max="100" placeholder="Ví dụ: 15 cho 15%" /><small>Để trống nếu dùng tỷ lệ chung. Nhập % (VD: 15 = 15%)</small></label>
    <TaiKhoanNganHang />
    <label className="field">Cán bộ trong cơ quan<select name="can_bo_id" defaultValue=""><option value="">-- Không gắn --</option>{canBo.map(cb => <option key={cb.id} value={cb.id}>{cb.ten}</option>)}</select><small>Người lấy hóa đơn cũng là cán bộ trong cơ quan.</small></label>
    <label className="field">Ghi chú<textarea name="ghi_chu" rows={2} placeholder="Thông tin bổ sung (tùy chọn)"></textarea></label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang thêm…' : 'Thêm người lấy HĐ'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function SuaNguoiLayHd({ nguoi, canBo = [] }: { nguoi: { id: string; ten: string; ty_le_phi: string | number | null; ngan_hang_bin: string | null; so_tai_khoan: string | null; ten_ngan_hang: string | null; ten_chu_tk: string | null; can_bo_id: string | null; chi_nhanh: string | null; ghi_chu: string | null }; canBo?: LuaChon[] }) {
  const [state, action, pending] = useActionState(suaNguoiLayHd, initial)
  const tyLePhi = nguoi.ty_le_phi != null ? (Number(nguoi.ty_le_phi) * 100).toFixed(2) : ''
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={nguoi.id} />
    <label className="field">Tên người lấy hóa đơn *<input name="ten" required maxLength={200} defaultValue={nguoi.ten} /></label>
    <label className="field">Tỷ lệ phí (%)<input name="ty_le_phi" type="number" step="0.01" min="0" max="100" defaultValue={tyLePhi} placeholder="Để trống nếu dùng tỷ lệ chung" /><small>Nhập % (VD: 15 = 15%)</small></label>
    <TaiKhoanNganHang nguoi={nguoi} />
    <label className="field">Cán bộ trong cơ quan<select name="can_bo_id" defaultValue={nguoi.can_bo_id || ''}><option value="">-- Không gắn --</option>{canBo.map(cb => <option key={cb.id} value={cb.id}>{cb.ten}</option>)}</select></label>
    <label className="field">Ghi chú<textarea name="ghi_chu" rows={2} defaultValue={nguoi.ghi_chu || ''}></textarea></label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function ThaoTacNguoiLayHd({ id, ten, active }: { id: string; ten: string; active: boolean }) {
  const [state, action, pending] = useActionState(active ? voHieuHoaNguoiLayHd : kichHoatNguoiLayHd, initial)
  return <form action={action} onSubmit={event => { if (!window.confirm(active ? `Vô hiệu hóa ${ten}?` : `Kích hoạt lại ${ten}?`)) event.preventDefault() }}>
    <input type="hidden" name="id" value={id} />
    <button disabled={pending} className={active ? 'btn btn-danger' : 'btn btn-secondary'}>{active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</button>
    <ThongBao state={state} />
  </form>
}

export function TaoDonVi() {
  const [state, action, pending] = useActionState(themDonVi, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <label className="field">Tên đơn vị *<input name="ten" required maxLength={200} placeholder="Ví dụ: Trường ĐH Kinh tế" /></label>
    <label className="field">Ghi chú<textarea name="ghi_chu" rows={2} placeholder="Thông tin bổ sung (tùy chọn)"></textarea></label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang thêm…' : 'Thêm đơn vị'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function NhapDonViExcel() {
  const [state, action, pending] = useActionState(nhapDonViExcel, initial)
  return <form action={action} encType="multipart/form-data" className="mt-5 grid grid-cols-1 gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2">
    <label className="field sm:col-span-2">Nhập danh sách bằng Excel
      <input name="tep_excel" type="file" required accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
      <small>Tệp tối đa 5 MB. Dùng trang tính đầu tiên, có cột “Tên đơn vị” (hoặc <code>ten</code>/<code>ten_don_vi</code>); cột “Ghi chú” là tùy chọn. Tối đa 5.000 dòng.</small>
    </label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-secondary">{pending ? 'Đang nhập…' : 'Nhập từ Excel'}</button><span>Đơn vị đã có sẽ được bỏ qua; đơn vị đã vô hiệu hóa sẽ được kích hoạt lại.</span></div>
    <ThongBao state={state} />
  </form>
}

export function SuaDonVi({ donVi }: { donVi: { id: string; ten: string; ghi_chu: string | null } }) {
  const [state, action, pending] = useActionState(suaDonVi, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={donVi.id} />
    <label className="field">Tên đơn vị *<input name="ten" required maxLength={200} defaultValue={donVi.ten} /></label>
    <label className="field">Ghi chú<textarea name="ghi_chu" rows={2} defaultValue={donVi.ghi_chu || ''}></textarea></label>
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function ThaoTacDonVi({ id, ten, active }: { id: string; ten: string; active: boolean }) {
  const [state, action, pending] = useActionState(active ? voHieuHoaDonVi : kichHoatDonVi, initial)
  return <form action={action} onSubmit={event => { if (!window.confirm(active ? `Vô hiệu hóa ${ten}?` : `Kích hoạt lại ${ten}?`)) event.preventDefault() }}>
    <input type="hidden" name="id" value={id} />
    <button disabled={pending} className={active ? 'btn btn-danger' : 'btn btn-secondary'}>{active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</button>
    <ThongBao state={state} />
  </form>
}

export type DonViAdmin = { id: string; ten: string; ghi_chu: string | null; dang_hoat_dong: boolean }

export function QuanLyDanhSachDonVi({ donVi }: { donVi: DonViAdmin[] }) {
  const [chon, setChon] = useState<string[]>([])
  const [state, action, pending] = useActionState(voHieuHoaNhieuDonVi, initial)
  const dangHoatDong = donVi.filter(item => item.dang_hoat_dong)
  const idsDangHoatDong = dangHoatDong.map(item => item.id)
  const tatCaDaChon = idsDangHoatDong.length > 0 && idsDangHoatDong.every(id => chon.includes(id))

  useEffect(() => {
    setChon(current => current.filter(id => idsDangHoatDong.includes(id)))
  }, [donVi])

  function doiChon(id: string, checked: boolean) {
    setChon(current => checked ? [...new Set([...current, id])] : current.filter(item => item !== id))
  }

  return <section className="card mx-auto mb-6 max-w-7xl p-4 sm:p-6"><div className="mb-6 flex flex-wrap items-start justify-between gap-4 [&_p]:mt-2 [&_p]:text-sm [&_p]:text-slate-500"><div><h2>Danh sách đơn vị</h2><p>Quản lý các đơn vị được tiếp. Xóa khỏi danh sách sẽ giữ nguyên giao dịch và lịch sử cũ.</p></div><span className="badge neutral">{donVi.length} đơn vị</span></div>
    <form action={action} onSubmit={event => { if (!chon.length || !window.confirm(`Xóa ${chon.length} đơn vị đã chọn khỏi danh sách đang sử dụng? Giao dịch và lịch sử cũ vẫn được giữ lại.`)) event.preventDefault() }} className="mb-4 flex flex-wrap items-center gap-3">
      {chon.map(id => <input key={id} type="hidden" name="id" value={id} />)}
      <button type="submit" disabled={pending || !chon.length} className="btn btn-danger">{pending ? 'Đang xóa…' : `Xóa đơn vị đã chọn${chon.length ? ` (${chon.length})` : ''}`}</button>
      <span className="text-xs text-slate-500">Chỉ các đơn vị đang hoạt động mới có thể chọn.</span>
    </form>
    <ThongBao state={state} />
    {donVi.length ? <div className="overflow-x-auto [&_table]:w-full [&_table]:text-left [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-600 [&_td]:min-w-36 [&_td]:border-b [&_td]:border-slate-100 [&_td]:p-4 [&_td]:align-top [&_tr:last-child_td]:border-0"><table><thead><tr><th><input type="checkbox" className="size-4 accent-indigo-600" aria-label="Chọn tất cả đơn vị đang hoạt động" checked={tatCaDaChon} disabled={!idsDangHoatDong.length} onChange={event => setChon(event.target.checked ? idsDangHoatDong : [])} /></th><th>Tên đơn vị</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{donVi.map(dv => <tr key={dv.id}><td><input type="checkbox" className="size-4 accent-indigo-600" aria-label={`Chọn ${dv.ten}`} checked={chon.includes(dv.id)} disabled={!dv.dang_hoat_dong} onChange={event => doiChon(dv.id, event.target.checked)} /></td><td><strong>{dv.ten}</strong></td><td>{dv.ghi_chu || <span className="text-slate-500">—</span>}</td><td><span className={`badge neutral ${dv.dang_hoat_dong ? 'good' : ''}`}>{dv.dang_hoat_dong ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</span></td><td><details><summary>Quản lý</summary><SuaDonVi donVi={dv} /><ThaoTacDonVi id={dv.id} ten={dv.ten} active={dv.dang_hoat_dong} /></details></td></tr>)}</tbody></table></div> : <p className="py-6 text-sm text-slate-500">Chưa có đơn vị nào.</p>}
  </section>
}

// Giới tính, chức danh và phòng là những chữ in thẳng lên giấy đề nghị. Lãnh đạo vừa là
// người ký duyệt vừa không thuộc phòng nào, nên khi tích lãnh đạo thì ô phòng bị khoá và
// xoá trống cho khỏi in ra một phòng không có thật.
function OCanBo({ canBo, nguoiDung }: { canBo?: CanBoAdmin; nguoiDung: LuaChon[] }) {
  const [laLanhDao, setLaLanhDao] = useState(canBo?.la_lanh_dao ?? false)
  return <>
    <label className="field">Họ và tên *<input name="ho_ten" required maxLength={200} defaultValue={canBo?.ho_ten ?? ''} placeholder="Họ và tên cán bộ" /></label>
    <label className="field">Giới tính<select name="gioi_tinh" defaultValue={canBo?.gioi_tinh ?? ''}><option value="">-- Không in --</option>{GIOI_TINH.map(g => <option key={g} value={g}>{g}</option>)}</select><small>In trước họ tên trong dòng "Kính gửi".</small></label>
    <label className="field">Chức danh<input name="chuc_danh" maxLength={200} defaultValue={canBo?.chuc_danh ?? ''} placeholder="VD: Giám đốc" /><small>In sau họ tên trong dòng "Kính gửi".</small></label>
    <label className="field">Phòng<input name="phong" maxLength={200} defaultValue={canBo?.phong ?? ''} disabled={laLanhDao} placeholder="VD: Phòng Hành chính tổ chức" /><small>{laLanhDao ? 'Lãnh đạo không thuộc phòng nào.' : 'In ở dòng đơn vị công tác.'}</small></label>
    <label className="field">Tài khoản đăng nhập<select name="nguoi_dung_id" defaultValue={canBo?.nguoi_dung_id ?? ''}><option value="">-- Không gắn --</option>{nguoiDung.map(nd => <option key={nd.id} value={nd.id}>{nd.ten}</option>)}</select><small>Dùng để suy ra phòng và người đề nghị khi lập giấy.</small></label>
    <label className="flex items-center gap-3 pt-2 text-sm font-medium text-slate-700 sm:col-span-2">
      <input type="checkbox" name="la_lanh_dao" checked={laLanhDao} onChange={event => setLaLanhDao(event.target.checked)} className="size-4 accent-indigo-600" />
      Là lãnh đạo — người ký duyệt, không thuộc phòng nào
    </label>
  </>
}

export function TaoCanBo({ nguoiDung = [] }: { nguoiDung?: LuaChon[] }) {
  const [state, action, pending] = useActionState(themCanBo, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <OCanBo nguoiDung={nguoiDung} />
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang thêm…' : 'Thêm cán bộ'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function SuaCanBo({ canBo, nguoiDung = [] }: { canBo: CanBoAdmin; nguoiDung?: LuaChon[] }) {
  const [state, action, pending] = useActionState(suaCanBo, initial)
  return <form action={action} className="grid grid-cols-1 gap-5 py-4 sm:grid-cols-2">
    <input type="hidden" name="id" value={canBo.id} />
    <OCanBo canBo={canBo} nguoiDung={nguoiDung} />
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
    <ThongBao state={state} />
  </form>
}

export function ThaoTacCanBo({ id, ten, active }: { id: string; ten: string; active: boolean }) {
  const [state, action, pending] = useActionState(active ? voHieuHoaCanBo : kichHoatCanBo, initial)
  return <form action={action} onSubmit={event => { if (!window.confirm(active ? `Vô hiệu hóa ${ten}? Người này sẽ không còn chọn được khi lập giấy.` : `Kích hoạt lại ${ten}?`)) event.preventDefault() }}>
    <input type="hidden" name="id" value={id} />
    <button disabled={pending} className={active ? 'btn btn-danger' : 'btn btn-secondary'}>{active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</button>
    <ThongBao state={state} />
  </form>
}
