'use client'
import { useTransition } from 'react'
import { xoaMemGiaoDich } from './actions'
export function NutXoa({ id }: { id:string }) {
  const [pending, start] = useTransition()
  return <button type="button" disabled={pending} onClick={() => { if (confirm('Xóa mềm giao dịch này?')) start(() => xoaMemGiaoDich(id)) }} className="btn btn-danger min-h-8 px-3 py-1">{pending?'Đang xóa...':'Xóa'}</button>
}
