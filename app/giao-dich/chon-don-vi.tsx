'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { themDonViNhanh } from './don-vi-actions'
import { locDonViTheoTen, sapXepDonViTiepKhach, timDonViTheoTen, type DonViTiepKhach } from '@/lib/tai-chinh/don-vi'

function nhanLan(dv: DonViTiepKhach): string {
  if (!dv.so_lan) return 'chưa tiếp'
  const lan = dv.so_lan === 1 ? '1 lần' : `${dv.so_lan} lần`
  return dv.lan_cuoi ? `tiếp ${lan}, lần cuối ${dv.lan_cuoi}` : `tiếp ${lan}`
}

export function ChonDonVi({
  ds,
  value,
  onChange,
  required,
}: {
  ds: DonViTiepKhach[]
  value: string
  onChange: (id: string, ten?: string) => void
  required?: boolean
}) {
  const id = useId()
  const hop = useRef<HTMLDivElement>(null)
  const oNhap = useRef<HTMLInputElement>(null)
  const [chu, setChu] = useState(() => ds.find(d => d.id === value)?.ten ?? '')
  const [mo, setMo] = useState(false)
  const [loi, setLoi] = useState('')
  const [dangThem, setDangThem] = useState(false)
  const sapXep = useMemo(() => sapXepDonViTiepKhach(ds), [ds])
  const loc = useMemo(() => locDonViTheoTen(sapXep, chu), [sapXep, chu])
  const khop = timDonViTheoTen(ds, chu)
  const coTheThem = chu.trim().length > 0 && !khop

  useEffect(() => {
    const ten = ds.find(d => d.id === value)?.ten
    if (ten && ten !== chu && (!chu.trim() || timDonViTheoTen(ds, chu)?.id === value)) setChu(ten)
  }, [value, ds]) // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đồng bộ khi id/ds đổi, không ghi đè lúc đang gõ

  useEffect(() => {
    function dong(event: MouseEvent) {
      if (!hop.current?.contains(event.target as Node)) setMo(false)
    }
    document.addEventListener('mousedown', dong)
    return () => document.removeEventListener('mousedown', dong)
  }, [])

  useEffect(() => {
    const o = oNhap.current
    if (!o || !required) return
    o.setCustomValidity(value ? '' : chu.trim()
      ? 'Bấm “Thêm vào danh sách” hoặc chọn đơn vị có sẵn.'
      : 'Chọn đơn vị tiếp khách.')
  }, [required, value, chu])

  function chon(dv: DonViTiepKhach) {
    setChu(dv.ten)
    setLoi('')
    setMo(false)
    onChange(dv.id, dv.ten)
  }

  async function them() {
    if (!coTheThem || dangThem) return
    setDangThem(true)
    setLoi('')
    try {
      const kq = await themDonViNhanh(chu)
      if (kq.loi || !kq.id) { setLoi(kq.loi || 'Không thêm được đơn vị.'); return }
      setChu(kq.ten || chu.trim())
      setMo(false)
      onChange(kq.id, kq.ten)
    } catch {
      setLoi('Không thêm được đơn vị.')
    } finally {
      setDangThem(false)
    }
  }

  return <div ref={hop} className="relative">
    <input
      id={id}
      ref={oNhap}
      role="combobox"
      aria-expanded={mo}
      aria-controls={`${id}-ds`}
      aria-autocomplete="list"
      autoComplete="off"
      required={required}
      placeholder="Gõ tên đơn vị để tìm hoặc thêm mới"
      value={chu}
      onChange={event => {
        const v = event.target.value
        setChu(v)
        setMo(true)
        const dung = timDonViTheoTen(ds, v)
        onChange(dung?.id ?? '', dung?.ten)
      }}
      onFocus={() => setMo(true)}
    />
    <input type="hidden" name="don_vi_id" value={value} />
    {mo && (
      <ul id={`${id}-ds`} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
        {loc.map(dv => (
          <li key={dv.id}>
            <button type="button" role="option" aria-selected={dv.id === value}
              className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-indigo-50 ${dv.id === value ? 'bg-indigo-50' : ''}`}
              onClick={() => chon(dv)}>
              <span className="font-medium text-slate-800">{dv.ten}</span>
              <span className="text-xs text-slate-500">{nhanLan(dv)}</span>
            </button>
          </li>
        ))}
        {coTheThem && (
          <li>
            <button type="button" disabled={dangThem}
              className="flex w-full px-3 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              onClick={them}>
              {dangThem ? 'Đang thêm…' : `Thêm “${chu.trim()}” vào danh sách`}
            </button>
          </li>
        )}
        {!loc.length && !coTheThem && (
          <li className="px-3 py-2 text-sm text-slate-500">Không có đơn vị.</li>
        )}
      </ul>
    )}
    {loi && <p className="mt-1 text-xs font-normal text-red-700" role="alert">{loi}</p>}
    <span className="text-xs font-normal text-slate-500">Gõ để tìm. Không thấy thì thêm tên vừa gõ vào danh sách.</span>
  </div>
}
