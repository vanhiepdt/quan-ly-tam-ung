'use client'

import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { layQrThanhToan, type ThongTinThanhToan } from './thanh-toan-actions'

export function ThanhToan({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef(0)
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState('')
  const [data, setData] = useState<(ThongTinThanhToan & { image: string }) | null>(null)

  async function taiQr() {
    const current = ++request.current
    setBusy(true); setLoi(''); setData(null)
    try {
      const result = await layQrThanhToan(id)
      if (current !== request.current) return
      if (!result.duLieu) { setLoi(result.loi ?? 'Không thể tạo QR.'); return }
      // Local rendering only: no bank details are sent to any QR service.
      const image = await QRCode.toDataURL(result.duLieu.payload, { width: 320, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      if (current === request.current) setData({ ...result.duLieu, image })
    } catch {
      if (current === request.current) setLoi('Không thể tạo QR. Vui lòng thử lại.')
    } finally {
      if (current === request.current) setBusy(false)
    }
  }
  function dong() { request.current++; dialog.current?.close(); setMounted(false); setData(null); setBusy(false) }
  return <>
    <button type="button" className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50" onClick={() => { setMounted(true); void taiQr() }}>Thanh toán</button>
    {mounted && createPortal(<dialog ref={node => { dialog.current = node; if (node && !node.open) node.showModal() }} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); dong() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold">Thanh toán phí lấy HĐ</h2><button type="button" onClick={dong} className="rounded border px-3 py-1" autoFocus>Đóng</button></div>
      <p className="mt-3 text-sm text-slate-600">Thông tin được tính lại từ dữ liệu hiện tại khi mở hoặc tải lại QR. Đối chiếu người nhận và số tiền trong ứng dụng ngân hàng trước khi chuyển.</p>
      {busy && <p role="status" className="mt-4">Đang lấy dữ liệu và tạo QR…</p>}
      {loi && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{loi}</p>}
      {data && <div className="mt-4 space-y-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 break-words">
          <dt>Chủ tài khoản</dt><dd className="min-w-0 font-semibold">{data.tenChuTk}</dd>
          <dt>Ngân hàng (BIN)</dt><dd>{data.bin}</dd>
          <dt>Số tài khoản</dt><dd className="font-mono">{data.soTaiKhoan}</dd>
          <dt>Phí lấy HĐ</dt><dd className="font-semibold">{data.soTien.toLocaleString('vi-VN')} đồng</dd>
          <dt>Số hóa đơn</dt><dd>{data.soHd}</dd>
          <dt>Ngày giao dịch</dt><dd>{data.ngay}</dd>
        </dl>
        <div className="rounded border bg-slate-50 p-3"><p>Nội dung thực tế trong QR ({data.noiDung.length}/25 ký tự)</p><p className="mt-1 break-all font-mono font-semibold">{data.noiDung}</p><p className="mt-1 text-xs text-slate-600">Bỏ dấu; giữ nguyên số HĐ; ngày theo dạng YYYYMMDD. Không tự rút gọn.</p></div>
        {/* A locally generated data URL, never a remote image provider. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.image} alt="Mã VietQR thanh toán phí lấy hóa đơn" width={320} height={320} className="mx-auto h-auto max-w-full" />
      </div>}
      <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">Tạo hoặc quét QR không xác nhận đã chuyển tiền và không đổi trạng thái phí. Chỉ cập nhật trạng thái sau khi đã kiểm tra giao dịch ngân hàng.</p>
      <button type="button" disabled={busy} onClick={() => void taiQr()} className="mt-4 rounded border px-3 py-2 text-sm disabled:opacity-50">Tải lại QR theo dữ liệu mới nhất</button>
    </dialog>, document.body)}
  </>
}
