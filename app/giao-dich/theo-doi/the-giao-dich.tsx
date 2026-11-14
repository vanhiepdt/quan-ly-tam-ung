'use client'

import Link from 'next/link'
import type { GiaoDichTheoDoi } from '@/lib/tai-chinh/theo-doi-giao-dich'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'

const badge = (value: string) => value === 'Hợp lệ' || value === 'Đã thanh toán' ? 'good' : value === 'Chờ HĐ' || value === 'Chưa thanh toán' ? 'warn' : value === 'Không hợp lệ' ? 'bad' : 'neutral'
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

export function TheGiaoDich({ row, selected, onSelect, coTheSua, vaiTro }: {
  row: GiaoDichTheoDoi
  selected: boolean
  onSelect: () => void
  coTheSua: boolean
  vaiTro: string
}) {
  return <article className={`card overflow-hidden transition-shadow ${selected ? 'ring-2 ring-indigo-500 ring-offset-2' : 'hover:shadow-lg'}`}>
    <button type="button" className="block w-full cursor-pointer p-4 text-left focus-visible:outline-offset-[-3px]" aria-selected={selected} onClick={onSelect}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className={`badge ${badge(row.trangThaiHd)}`}>{row.trangThaiHd}</span>
          <span className={`badge ${badge(row.trangThaiTtPhi)}`}>{row.trangThaiTtPhi}</span>
        </div>
        <time className="text-xs font-medium text-slate-500" dateTime={row.ngay}>{row.ngay}</time>
      </div>
      <h2 className="text-base font-semibold text-slate-950">{row.noiDung}</h2>
      <p className="mt-1 text-xs font-medium text-indigo-700">{row.nhanHinhThuc.nhanNgan}</p>
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">{row.nhanSoTienChinh}</dt><dd className="money">{vnd.format(row.soTienChinh)}</dd>
        <dt className="text-slate-500">Hóa đơn</dt><dd className="text-right text-xs text-slate-700">{row.kyHieuHd || row.soHd ? `${row.kyHieuHd ?? ''} · ${row.soHd ?? ''}` : '—'}</dd>
      </dl>
      <p className="mt-3 text-xs text-slate-500">Tệp: Hóa đơn {row.hoSo.coHoaDon ? '✓' : '—'} · Chuyển khoản {row.hoSo.coChuyenKhoan ? '✓' : '—'}</p>
      {row.dongCanhBao.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{row.dongCanhBao[0]}</p>}
    </button>
    <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3" onClick={event => event.stopPropagation()}>
      <Link className="btn btn-secondary min-h-8 px-3 py-1" href={`/tep/${row.id}`} prefetch={false}>Tệp</Link>
      {giayChoHinhThuc(row.hinhThuc).length > 0 && <Link className="btn btn-secondary min-h-8 px-3 py-1" href={`/giay/${row.id}`} prefetch={false}>Giấy</Link>}
      <span className="sr-only">Vai trò: {vaiTro}; {coTheSua ? 'có thể sửa' : 'chỉ xem'}</span>
    </div>
  </article>
}
