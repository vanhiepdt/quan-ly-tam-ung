'use client'

import { useState, useTransition } from 'react'
import { xoaMemHoiNghi } from '../hoi-nghi-actions'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

// Xóa Hội nghị là xóa mềm luôn mọi giao dịch con, nên hộp xác nhận phải nói rõ
// bao nhiêu giao dịch và bao nhiêu tiền sẽ không còn được tính.
export function NutXoaHoiNghi({ id, ten, soGiaoDich, tongTien, onDaXoa }: {
  id: string
  ten: string
  soGiaoDich: number
  tongTien: number
  onDaXoa: () => void
}) {
  const [pending, start] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)

  function xoa() {
    const canhBao = soGiaoDich > 0
      ? `Xóa Hội nghị "${ten}"?\n\nThao tác này xóa luôn ${soGiaoDich} giao dịch con (tổng ${vnd.format(tongTien)}). Số dư và nhật ký sẽ không còn tính các giao dịch này.`
      : `Xóa Hội nghị "${ten}"?`
    if (!confirm(canhBao)) return
    setLoi(null)
    start(async () => {
      const ketQua = await xoaMemHoiNghi(id)
      if (ketQua.loi) setLoi(ketQua.loi)
      else onDaXoa()
    })
  }

  return <>
    {loi && <span role="alert" className="text-sm text-red-700">{loi}</span>}
    <button type="button" disabled={pending} onClick={xoa} className="btn btn-danger">{pending ? 'Đang xóa...' : 'Xóa Hội nghị'}</button>
  </>
}
