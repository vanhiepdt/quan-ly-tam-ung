'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  kiemTraSaoLuuGoogleDrive, luuCauHinhSaoLuu, ngatKetNoiSaoLuuGoogleDrive,
  yeuCauSaoLuuNgay, type DuLieuCaiDatSaoLuu, type KetQuaSaoLuu,
} from './backup-actions'

const initial: KetQuaSaoLuu = {}
const nhanTrangThai = {
  cho_xu_ly: 'Đang chờ VPS', dang_chay: 'Đang sao lưu',
  thanh_cong: 'Đã sao lưu lên Google Drive', that_bai: 'Sao lưu thất bại',
} as const
const thongBaoOAuth: Record<string, string> = {
  da_ket_noi: 'Đã kết nối Google Drive cá nhân. Hãy bấm “Kiểm tra kết nối” rồi “Backup ngay”.',
  tu_choi: 'Bạn chưa cấp quyền Google Drive. Có thể thử kết nối lại.',
  phien_het_han: 'Phiên kết nối Google đã hết hạn hoặc bạn đã đổi tài khoản quản trị. Hãy thử lại.',
  chua_cau_hinh: 'VPS chưa có cấu hình OAuth Google Drive hợp lệ.',
  loi: 'Không hoàn tất được kết nối Google Drive. Kiểm tra quyền và cấu hình OAuth rồi thử lại.',
}

function thoiGian(value: string | null) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

function ThongBao({ state }: { state: KetQuaSaoLuu }) {
  return <>
    {state.loi && <p className="notice error mt-2" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice success mt-2" role="status">{state.thanhCong}</p>}
  </>
}

export function CaiDatSaoLuu({ banDau, oauthStatus }: { banDau: DuLieuCaiDatSaoLuu; oauthStatus?: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(luuCauHinhSaoLuu, initial)
  const [manualState, manualAction, manualPending] = useActionState(yeuCauSaoLuuNgay, initial)
  const [checkState, checkAction, checkPending] = useActionState(kiemTraSaoLuuGoogleDrive, initial)
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(ngatKetNoiSaoLuuGoogleDrive, initial)
  const active = banDau.lanChay?.trangThai === 'cho_xu_ly' || banDau.lanChay?.trangThai === 'dang_chay'

  return <div className="space-y-6">
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
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
        <div className="sm:col-span-2"><ThongBao state={state} /></div>
      </form>

      <section className="space-y-4 border-t border-slate-200 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        <div>
          <h3 className="font-semibold text-slate-900">Google Drive cá nhân</h3>
          <p className="mt-2 text-sm text-slate-600">{banDau.googleDriveDaCauHinh
            ? <>Đã kết nối: <strong>{banDau.googleDriveEmail}</strong></>
            : banDau.googleDriveEmail ? 'Có tài khoản đã kết nối nhưng cấu hình OAuth trên VPS chưa đầy đủ.' : 'Chưa kết nối.'}</p>
          {oauthStatus && thongBaoOAuth[oauthStatus] && <p className={'notice mt-3 ' + (oauthStatus === 'da_ket_noi' ? 'success' : 'error')} role="status">{thongBaoOAuth[oauthStatus]}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <form method="post" action="/api/sao-luu/google-drive/connect"><button className="btn btn-secondary">{banDau.googleDriveEmail ? 'Kết nối lại' : 'Kết nối Google Drive'}</button></form>
            <form action={checkAction}><button disabled={checkPending || !banDau.googleDriveDaCauHinh} className="btn btn-secondary">{checkPending ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button></form>
            {banDau.googleDriveEmail && <form action={disconnectAction}><button disabled={disconnectPending} className="btn btn-secondary">{disconnectPending ? 'Đang ngắt…' : 'Ngắt kết nối'}</button></form>}
          </div>
          {banDau.googleDriveDaCauHinh && <ThongBao state={checkState} />}<ThongBao state={disconnectState} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Lần sao lưu gần nhất</h3>
          <dl className="mt-3 grid gap-2 text-sm text-slate-600">
            <div className="flex justify-between gap-3"><dt>Trạng thái</dt><dd className="font-medium text-slate-900">{banDau.lanChay ? nhanTrangThai[banDau.lanChay.trangThai] : 'Chưa có bản sao lưu'}</dd></div>
            <div className="flex justify-between gap-3"><dt>Yêu cầu lúc</dt><dd>{thoiGian(banDau.lanChay?.taoLuc ?? null)}</dd></div>
            {banDau.lanChay?.batDauLuc && <div className="flex justify-between gap-3"><dt>Bắt đầu</dt><dd>{thoiGian(banDau.lanChay.batDauLuc)}</dd></div>}
            {banDau.lanChay?.ketThucLuc && <div className="flex justify-between gap-3"><dt>Kết thúc</dt><dd>{thoiGian(banDau.lanChay.ketThucLuc)}</dd></div>}
          </dl>
          {banDau.lanChay?.loi && <p className="notice error mt-3" role="alert">{banDau.lanChay.loi}</p>}
        </div>
        <form action={manualAction}>
          <button disabled={manualPending || active || !banDau.googleDriveDaCauHinh} className="btn btn-primary">{manualPending ? 'Đang gửi yêu cầu…' : 'Backup ngay'}</button>
          <ThongBao state={manualState} />
        </form>
        <p className="text-xs text-slate-500">Sao lưu gồm PostgreSQL và tệp giao dịch. VPS xử lý yêu cầu trong vòng một phút; chỉ khi trạng thái “Đã sao lưu lên Google Drive” mới xác nhận thành công.</p>
      </section>
    </div>
    <section className="border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">Lịch sử sao lưu (30 lần gần nhất)</h3><button type="button" className="btn btn-secondary" onClick={() => router.refresh()}>Làm mới lịch sử</button></div>
      {banDau.lichSu.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có lần sao lưu hoàn tất.</p> : <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-600"><tr><th className="py-2 pr-3">Thời gian</th><th className="py-2 pr-3">Loại</th><th className="py-2 pr-3">Kết quả</th><th className="py-2">Chi tiết</th></tr></thead>
          <tbody>{banDau.lichSu.map(run => <tr key={run.id} className="border-b border-slate-100 align-top">
            <td className="py-2 pr-3 whitespace-nowrap">{thoiGian(run.ketThucLuc ?? run.taoLuc)}</td>
            <td className="py-2 pr-3">{run.loai === 'lich' ? 'Tự động' : 'Thủ công'}</td>
            <td className={'py-2 pr-3 font-medium ' + (run.trangThai === 'thanh_cong' ? 'text-emerald-700' : 'text-red-700')}>{run.trangThai === 'thanh_cong' ? 'Thành công' : 'Thất bại'}</td>
            <td className="py-2 break-words">{run.loi || (run.driveFileId ? <a className="text-indigo-700 underline" target="_blank" rel="noopener noreferrer" href={`https://drive.google.com/file/d/${encodeURIComponent(run.driveFileId)}/view`}>Mở bản sao lưu trên Drive</a> : '—')}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>
}
