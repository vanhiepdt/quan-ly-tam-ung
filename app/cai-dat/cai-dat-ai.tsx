'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import {
  luuCauHinhAi, pingHelloAi, thuNghiemAi, timMoHinhAi,
  type KetQuaAiCaiDat, type KetQuaKiemAi,
} from './ai-actions'
import type { DuLieuCauHinhAi } from '@/lib/kiem-tra/cau-hinh-ai'
import { NHA_CUNG_CAP_AI, type NhaCungCapId } from '@/lib/kiem-tra/nha-cung-cap-ai'

const initial: KetQuaAiCaiDat = {}
type Slot = 'ai1' | 'ai2'
type TrangThaiSlot = {
  nhaCungCap: NhaCungCapId
  moHinh: string
  urlCoSo: string
  daCoKhoaLuu: boolean
  dungKhoaMoiTruong: boolean
}

function TieuDeAi({ slot }: { slot: Slot }) {
  return <h3 className="text-base font-semibold text-slate-900">{slot === 'ai1' ? 'AI 1' : 'AI 2'}</h3>
}

function CauHinhSlot({
  slot, banDau, giaTri, setGiaTri, xoaKhoa, setXoaKhoa,
  daKiem, dangKiem, viecKiem, thu,
}: {
  slot: Slot
  banDau: TrangThaiSlot
  giaTri: { nha: NhaCungCapId; moHinh: string; urlCoSo: string }
  setGiaTri: (value: { nha: NhaCungCapId; moHinh: string; urlCoSo: string }) => void
  xoaKhoa: boolean
  setXoaKhoa: (value: boolean) => void
  daKiem: KetQuaKiemAi
  dangKiem: boolean
  viecKiem: 'thu' | 'tim' | 'hello' | null
  thu: (loai: 'thu' | 'tim' | 'hello', hanh: (data: FormData) => Promise<KetQuaKiemAi>, form: HTMLFormElement, slot: Slot) => void
}) {
  const suffix = slot === 'ai1' ? '' : '_2'
  const nhaHien = useMemo(() => NHA_CUNG_CAP_AI.find(n => n.id === giaTri.nha) ?? NHA_CUNG_CAP_AI[1], [giaTri.nha])
  const luaChon = giaTri.moHinh && !nhaHien.moHinhGoiY.includes(giaTri.moHinh)
    ? [giaTri.moHinh, ...nhaHien.moHinhGoiY]
    : [...nhaHien.moHinhGoiY]
  const daCoKhoa = banDau.daCoKhoaLuu && giaTri.nha === banDau.nhaCungCap && !xoaKhoa
  const dungEnv = banDau.dungKhoaMoiTruong && giaTri.nha === banDau.nhaCungCap && !xoaKhoa && !banDau.daCoKhoaLuu

  function doiNha(id: NhaCungCapId) {
    const ke = NHA_CUNG_CAP_AI.find(n => n.id === id)
    setGiaTri({ nha: id, moHinh: ke?.moHinhMacDinh ?? '', urlCoSo: id === 'custom' ? giaTri.urlCoSo : '' })
    setXoaKhoa(false)
  }

  return <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
    <TieuDeAi slot={slot} />
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="field sm:col-span-2">Nhà cung cấp
        <select name={`nha_cung_cap${suffix}`} value={giaTri.nha} onChange={e => doiNha(e.target.value as NhaCungCapId)}>
          {NHA_CUNG_CAP_AI.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
        </select>
        <small>{nhaHien.moTa}</small>
      </label>

      <label className={`field ${nhaHien.id === 'custom' ? '' : 'sm:col-span-2'}`}>Model
        <select name={`mo_hinh${suffix}`} value={giaTri.moHinh} onChange={e => setGiaTri({ ...giaTri, moHinh: e.target.value })}>
          {luaChon.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <small>{nhaHien.docAnh === false ? 'Model này chỉ dùng được với hóa đơn XML.' : 'Chọn model có khả năng đọc ảnh nếu xử lý PDF.'}</small>
      </label>

      {nhaHien.id === 'custom' && <label className="field">URL API ngoài
        <input name={`url_co_so${suffix}`} value={giaTri.urlCoSo} onChange={e => setGiaTri({ ...giaTri, urlCoSo: e.target.value })} maxLength={300} placeholder="https://host/v1" required />
      </label>}

      <label className={`field ${nhaHien.id === 'custom' ? '' : 'sm:col-span-2'}`}>Khóa API
        <input key={`${slot}-${giaTri.nha}`} name={`khoa_api${suffix}`} type="password" autoComplete="new-password" maxLength={500} placeholder={daCoKhoa ? 'Đã lưu — để trống nếu giữ nguyên' : dungEnv ? 'Đang dùng biến môi trường' : 'sk-…'} disabled={xoaKhoa} />
        <small>{xoaKhoa ? 'Khóa đã lưu sẽ bị xóa khi lưu.' : daCoKhoa ? 'Điền khóa mới để thay khóa hiện tại.' : dungEnv ? 'Đang dùng khóa trong biến môi trường.' : 'Khóa chỉ lưu trên máy chủ.'}</small>
      </label>
      <input type="hidden" name={`xoa_khoa${suffix}`} value={xoaKhoa ? '1' : '0'} />
      {(daCoKhoa || xoaKhoa) && <label className="field sm:col-span-2">
        <span className="flex items-center gap-3 font-medium text-slate-700">
          <input type="checkbox" checked={xoaKhoa} onChange={e => setXoaKhoa(e.target.checked)} className="size-4 accent-indigo-600" />
          Xóa khóa đã lưu
        </span>
      </label>}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={dangKiem} className="btn btn-secondary" onClick={e => thu('hello', pingHelloAi, e.currentTarget.form!, slot)}>{viecKiem === 'hello' ? 'Đang gửi…' : 'Gửi hello'}</button>
      <button type="button" disabled={dangKiem} className="btn btn-secondary" onClick={e => thu('thu', thuNghiemAi, e.currentTarget.form!, slot)}>{viecKiem === 'thu' ? 'Đang thử…' : 'Test API'}</button>
      <button type="button" disabled={dangKiem} className="btn btn-secondary" onClick={e => thu('tim', timMoHinhAi, e.currentTarget.form!, slot)}>{viecKiem === 'tim' ? 'Đang tìm…' : 'Tìm model hiện có'}</button>
    </div>
    {daKiem.loi && <p className="notice error mt-3" role="alert">{daKiem.loi}</p>}
    {daKiem.thanhCong && <p className="notice success mt-3" role="status">{daKiem.thanhCong}</p>}
    {daKiem.nhatKy && daKiem.nhatKy.length > 0 && <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <summary className="cursor-pointer font-medium text-slate-800">Nhật ký kiểm tra ({daKiem.nhatKy.length} dòng)</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 font-mono">{daKiem.nhatKy.map((d, i) => <li key={i}>{d}</li>)}</ol>
    </details>}
  </section>
}

export function CaiDatAi({ banDau }: { banDau: DuLieuCauHinhAi }) {
  const [state, action, pending] = useActionState(luuCauHinhAi, initial)
  const [ai1, setAi1] = useState({ nha: banDau.nhaCungCap, moHinh: banDau.moHinh, urlCoSo: banDau.nhaCungCap === 'custom' ? banDau.urlCoSo : '' })
  const [ai2, setAi2] = useState({ nha: banDau.ai2.nhaCungCap, moHinh: banDau.ai2.moHinh, urlCoSo: banDau.ai2.nhaCungCap === 'custom' ? banDau.ai2.urlCoSo : '' })
  const [xoa1, setXoa1] = useState(false)
  const [xoa2, setXoa2] = useState(false)
  const [ds, setDs] = useState<Record<Slot, KetQuaKiemAi>>({ ai1: {}, ai2: {} })
  const [viecKiem, setViecKiem] = useState<'thu' | 'tim' | 'hello' | null>(null)
  const [dangKiem, startKiem] = useTransition()

  function thu(loai: 'thu' | 'tim' | 'hello', hanh: (data: FormData) => Promise<KetQuaKiemAi>, form: HTMLFormElement, slot: Slot) {
    startKiem(async () => {
      setViecKiem(loai)
      setDs(hien => ({ ...hien, [slot]: {} }))
      try {
        const data = new FormData(form)
        data.set('ai', slot === 'ai1' ? '1' : '2')
        const kq = await hanh(data)
        setDs(hien => ({ ...hien, [slot]: kq }))
      } finally { setViecKiem(null) }
    })
  }

  return <form action={action} className="space-y-5">
    <input type="hidden" name="ai" value="1" />
    <label className="field">
      <span className="flex items-center gap-3 font-medium text-slate-700">
        <input type="checkbox" name="dang_hoat_dong" value="1" defaultChecked={banDau.dangHoatDong} className="size-4 accent-indigo-600" />
        Bật hai AI khi đọc hóa đơn
      </span>
      <small>PDF được gửi dưới dạng ảnh trang đầu; XML được gửi dưới dạng văn bản cho cả hai cấu hình.</small>
    </label>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <CauHinhSlot slot="ai1" banDau={{ nhaCungCap: banDau.nhaCungCap, moHinh: banDau.moHinh, urlCoSo: banDau.urlCoSo, daCoKhoaLuu: banDau.daCoKhoaLuu, dungKhoaMoiTruong: banDau.dungKhoaMoiTruong }} giaTri={ai1} setGiaTri={setAi1} xoaKhoa={xoa1} setXoaKhoa={setXoa1} daKiem={ds.ai1} dangKiem={dangKiem || pending} viecKiem={viecKiem} thu={thu} />
      <CauHinhSlot slot="ai2" banDau={{ nhaCungCap: banDau.ai2.nhaCungCap, moHinh: banDau.ai2.moHinh, urlCoSo: banDau.ai2.urlCoSo, daCoKhoaLuu: banDau.ai2.daCoKhoaLuu, dungKhoaMoiTruong: banDau.ai2.dungKhoaMoiTruong }} giaTri={ai2} setGiaTri={setAi2} xoaKhoa={xoa2} setXoaKhoa={setXoa2} daKiem={ds.ai2} dangKiem={dangKiem || pending} viecKiem={viecKiem} thu={thu} />
    </div>
    {state.loi && <p className="notice error" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice success" role="status">{state.thanhCong}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu cài đặt AI'}</button>
      <span className="text-xs text-slate-500">Hai cấu hình được gọi độc lập; API key không xuất hiện trong giao diện hoặc nhật ký.</span>
    </div>
  </form>
}
