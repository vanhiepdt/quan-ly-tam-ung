'use client'

import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dinhDangLuc, type MucLichSu } from '@/lib/tai-chinh/lich-su'
import { layLichSuGiaoDich } from './lich-su-actions'

const lopTheoHanhDong = (hanhDong: string) =>
  hanhDong === 'INSERT' ? 'good' : hanhDong === 'DELETE' ? 'bad' : 'neutral'

export function LichSu({ id, nhan }: { id: string; nhan: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef(0)
  const titleId = useId()
  const [mo, setMo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState('')
  const [muc, setMuc] = useState<MucLichSu[] | null>(null)

  async function tai() {
    const current = ++request.current
    setBusy(true); setLoi(''); setMuc(null)
    try {
      const result = await layLichSuGiaoDich(id)
      if (current !== request.current) return
      if (result.loi) { setLoi(result.loi); return }
      setMuc(result.muc)
    } catch {
      if (current === request.current) setLoi('Không tải được lịch sử sửa. Vui lòng thử lại.')
    } finally {
      if (current === request.current) setBusy(false)
    }
  }
  function moHopThoai() { setMo(true); void tai() }
  function dong() { request.current++; dialog.current?.close(); setMo(false); setMuc(null); setLoi(''); setBusy(false) }

  return <>
    <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={moHopThoai}>Lịch sử</button>
    {mo && createPortal(<dialog ref={node => { dialog.current = node; if (node && !node.open) node.showModal() }}
      aria-labelledby={titleId} onCancel={event => { event.preventDefault(); dong() }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight text-slate-950">Lịch sử sửa</h2>
          <p className="mt-1 text-xs break-words text-slate-500">{nhan}</p>
        </div>
        <button type="button" aria-label="Đóng lịch sử" onClick={dong}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">×</button>
      </header>

      <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Mỗi lần lưu một trường sinh đúng một mục. Lịch sử do cơ sở dữ liệu ghi lại, không sửa hay xóa được từ ứng dụng.
      </p>

      {busy && <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải lịch sử…</p>}
      {loi && <p className="notice error" role="alert">{loi}</p>}
      {!busy && !loi && muc?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Giao dịch này chưa có thay đổi nào được ghi lại.</p>}

      {!busy && !loi && !!muc?.length && <ol className="space-y-3">
        {muc.map(item => <li key={item.id} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`badge ${lopTheoHanhDong(item.hanhDong)}`}>{item.tomTat}</span>
            <b className="text-sm font-semibold text-slate-900">{item.nguoi}</b>
            <span className="text-xs text-slate-500">{dinhDangLuc(item.luc)}</span>
          </div>
          {item.thayDoi.length
            ? <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(9rem,auto)_minmax(0,1fr)]">
              {item.thayDoi.map(td => <div key={td.cot} className="contents">
                <dt className="text-xs font-semibold text-slate-500 sm:pt-0.5">{td.nhan}</dt>
                <dd className="min-w-0 break-words">
                  {item.hanhDong === 'INSERT'
                    ? <span className="font-medium text-slate-800">{td.moi}</span>
                    : <><span className="text-slate-500 line-through">{td.cu}</span><span aria-hidden="true" className="mx-2 text-slate-400">→</span><span className="font-medium text-slate-800">{td.moi}</span></>}
                </dd>
              </div>)}
            </dl>
            : <p className="text-xs text-slate-500">Không có trường dữ liệu nào đổi giá trị.</p>}
        </li>)}
      </ol>}

      {!busy && !loi && muc && muc.length >= 100 && <p className="mt-3 text-xs text-slate-500">Chỉ hiển thị 100 thay đổi gần nhất.</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void tai()}>Tải lại</button>
        <button type="button" className="btn btn-primary" onClick={dong}>Đóng</button>
      </div>
    </dialog>, document.body)}
  </>
}
