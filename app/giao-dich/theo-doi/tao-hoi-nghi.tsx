'use client'

import { useActionState } from 'react'
import { taoHoiNghi, type KetQuaHoiNghi } from '../hoi-nghi-actions'

const initial: KetQuaHoiNghi = {}

export function TaoHoiNghi() {
  const [state, action, pending] = useActionState(taoHoiNghi, initial)
  return <details className="card mb-5 p-4 sm:p-5"><summary className="cursor-pointer text-base font-semibold text-slate-900">+ Tạo Hội nghị</summary><form action={action} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="field sm:col-span-2">Tên Hội nghị / Nội dung<input className="input" name="ten" required maxLength={1000} /></label><label className="field">Ngày Hội nghị<input className="input" type="date" name="ngay" required /></label><label className="field">Loại giao dịch con<select className="input" name="loai_giao_dich" defaultValue="Hoàn tạm ứng"><option>Hoàn tạm ứng</option><option>Cơ quan trả thẳng</option></select></label><label className="field sm:col-span-2 lg:col-span-3">Ghi chú<textarea className="input" name="ghi_chu" rows={2} required maxLength={5000} /></label><label className="field">Nguồn phí chung<select className="input" name="nguon_phi" defaultValue="so_du"><option value="so_du">Dư theo loại giao dịch</option><option value="quy_chi_thuy">Quỹ Chị Thúy</option></select></label><div className="flex items-end"><button className="btn btn-primary" disabled={pending}>{pending ? 'Đang tạo…' : 'Tạo Hội nghị'}</button></div>{state.loi && <p className="notice error sm:col-span-2 lg:col-span-4" role="alert">{state.loi}</p>}{state.ok && <p className="notice success sm:col-span-2 lg:col-span-4" role="status">Đã tạo Hội nghị. Có thể thêm giao dịch con từ popup.</p>}</form></details>
}
