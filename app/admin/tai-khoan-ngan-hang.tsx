'use client'

import { useRef, useState } from 'react'
import QRCode from 'qrcode'
import { NGAN_HANG, nganHangTheoBin, taoQrThu } from '@/lib/qr/ngan-hang'

export function TaiKhoanNganHang({ nguoi = {} }: { nguoi?: {
  ngan_hang_bin?: string | null; ten_ngan_hang?: string | null; so_tai_khoan?: string | null
  ten_chu_tk?: string | null; chi_nhanh?: string | null
} }) {
  const root = useRef<HTMLDivElement>(null)
  const request = useRef(0)
  const [bin, setBin] = useState(nguoi.ngan_hang_bin || '')
  const [image, setImage] = useState('')
  const [loi, setLoi] = useState('')
  const [busy, setBusy] = useState(false)
  function huyQr() { request.current++; setImage(''); setLoi(''); setBusy(false) }
  async function testQr() {
    const current = ++request.current
    setImage(''); setLoi(''); setBusy(true)
    try {
      const form = root.current?.closest('form')
      if (!form) return
      const data = new FormData(form)
      const payload = taoQrThu({ bin: String(data.get('ngan_hang_bin') || ''), soTaiKhoan: String(data.get('so_tai_khoan') || '') })
      const url = await QRCode.toDataURL(payload, { width: 320, margin: 4, errorCorrectionLevel: 'M' })
      if (current === request.current) setImage(url)
    } catch (error) {
      if (current === request.current) setLoi(error instanceof Error ? error.message : 'Không tạo được QR.')
    } finally { if (current === request.current) setBusy(false) }
  }
  return <div ref={root} className="grid grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2" onChange={huyQr}>
    <label className="field">Tên ngân hàng<select name="ngan_hang_bin" value={bin} onChange={e => setBin(e.target.value)}>
      <option value="">— Chọn ngân hàng —</option>
      {bin && !nganHangTheoBin(bin) && <option value={bin}>{nguoi.ten_ngan_hang || 'Ngân hàng cũ'} — cần chọn lại</option>}
      {NGAN_HANG.map(b => <option key={b.bin} value={b.bin}>{b.shortName} — {b.name}</option>)}
    </select><small>Chọn ngân hàng tự xác định BIN; không cần nhập mã.</small></label>
    <label className="field">Chi nhánh<input name="chi_nhanh" maxLength={200} defaultValue={nguoi.chi_nhanh || ''} placeholder="Chi nhánh mở tài khoản" /></label>
    <label className="field">Số tài khoản<input name="so_tai_khoan" maxLength={50} defaultValue={nguoi.so_tai_khoan || ''} /><small>QR hỗ trợ tài khoản từ 1 đến 19 chữ số.</small></label>
    <label className="field">Tên chủ tài khoản<input name="ten_chu_tk" maxLength={200} defaultValue={nguoi.ten_chu_tk || ''} /><small>Trên giấy đề nghị, chủ tài khoản lấy theo tên người đề nghị đã liên kết.</small></label>
    <div className="sm:col-span-2">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void testQr()}>{busy ? 'Đang tạo QR…' : 'Test QR'}</button>
      <p className="mt-2 text-xs text-slate-500">QR thử không kèm số tiền/nội dung, không lưu và không xác nhận thanh toán. Quét bằng ứng dụng ngân hàng để đối chiếu ngân hàng, tài khoản và tên người nhận thực tế; QR không xác minh chủ tài khoản.</p>
      {loi && <p role="alert" className="text-red-700">{loi}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="QR thử tài khoản người lấy hóa đơn" width={320} height={320} className="mt-3 max-w-full" />}
    </div>
  </div>
}
