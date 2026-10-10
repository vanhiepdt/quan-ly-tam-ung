'use client'

import { useActionState } from 'react'
import { luuCauHinhSaoLuu, yeuCauSaoLuuNgay, type DuLieuCaiDatSaoLuu, type KetQuaSaoLuu } from './backup-actions'

const initial: KetQuaSaoLuu = {}
const nhanTrangThai = {
  cho_xu_ly: 'Đang chờ VPS',
  dang_chay: 'Đang sao lưu',
  thanh_cong: 'Đã sao lưu lên Google Drive',
  that_bai: 'Sao lưu thất bại',
} as const

function thoiGian(value: string | null) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export function CaiDatSaoLuu({ banDau }: { banDau: DuLieuCaiDatSaoLuu }) {
  const [state, action, pending] = useActionState(luuCauHinhSaoLuu, initial)
  const [manualState, manualAction, manualPending] = useActionState(yeuCauSaoLuuNgay, initial)
  const active = banDau.lanChay?.trangThai === 'cho_xu_ly' || banDau.lanChay?.trangThai === 'dang_chay'

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
    <form action={action} className="grid content-start gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
      <label className="field sm:col-span-2">
        <span className="flex items-center gap-3 font-medium text-slate-700">
          <input type="checkbox" name="bat_tu_dong" value="1" defaultChecked={banDau.cauHinh.batTuDong} className="size-4 accent-indigo-600" />
          Bật sao lưu Google Drive hằng ngày
        </span>
      </label>
      <label className="field">Giờ sao lưu
        <input name="gio_chay" type="time" defaultValue={banDau.cauHinh.gioChay} required />
        <small>Theo giờ Việt Nam.</small>
      </label>
      <div className="flex items-end"><button disabled={pending} className="btn btn-primary w-full">{pending ? 'Đang lưu…' : 'Lưu lịch'}</button></div>
      {state.loi && <p className="notice error sm:col-span-2" role="alert">{state.loi}</p>}
      {state.thanhCong && <p className="notice success sm:col-span-2" role="status">{state.thanhCong}</p>}
    </form>

    <section className="space-y-4 border-t border-slate-200 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
      <div>
        <h3 className="font-semibold text-slate-900">Trạng thái sao lưu</h3>
        <dl className="mt-3 grid gap-2 text-sm text-slate-600">
          <div className="flex justify-between gap-3"><dt>Google Drive</dt><dd className="font-medium text-slate-900">{banDau.googleDriveDaCauHinh ? 'Đã cấu hình trên VPS' : 'Chưa cấu hình trên VPS'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Lần gần nhất</dt><dd className="font-medium text-slate-900">{banDau.lanChay ? nhanTrangThai[banDau.lanChay.trangThai] : 'Chưa có bản sao lưu'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Yêu cầu lúc</dt><dd>{thoiGian(banDau.lanChay?.taoLuc ?? null)}</dd></div>
          {banDau.lanChay?.batDauLuc && <div className="flex justify-between gap-3"><dt>Bắt đầu</dt><dd>{thoiGian(banDau.lanChay.batDauLuc)}</dd></div>}
          {banDau.lanChay?.ketThucLuc && <div className="flex justify-between gap-3"><dt>Kết thúc</dt><dd>{thoiGian(banDau.lanChay.ketThucLuc)}</dd></div>}
        </dl>
        {banDau.lanChay?.loi && <p className="notice error mt-3" role="alert">{banDau.lanChay.loi}</p>}
      </div>
      <form action={manualAction}>
        <button disabled={manualPending || active} className="btn btn-secondary">{manualPending ? 'Đang gửi yêu cầu…' : 'Backup ngay'}</button>
        {manualState.loi && <p className="notice error" role="alert">{manualState.loi}</p>}
        {manualState.thanhCong && <p className="notice success" role="status">{manualState.thanhCong}</p>}
      </form>
      <p className="text-xs text-slate-500">Sao lưu gồm dữ liệu PostgreSQL và tệp giao dịch. VPS kiểm tra yêu cầu trong vòng một phút. Khóa Google Drive được giữ riêng trên VPS.</p>
    </section>
  </div>
}
