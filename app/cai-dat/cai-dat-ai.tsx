'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import {
  luuCauHinhAi, pingHelloAi, thuNghiemAi, timMoHinhAi,
  type KetQuaAiCaiDat, type KetQuaKiemAi,
} from './ai-actions'
import type { DuLieuCauHinhAi } from '@/lib/kiem-tra/cau-hinh-ai'
import { NHA_CUNG_CAP_AI, type NhaCungCapId } from '@/lib/kiem-tra/nha-cung-cap-ai'

const initial: KetQuaAiCaiDat = {}

export function CaiDatAi({ banDau }: { banDau: DuLieuCauHinhAi }) {
  const [state, action, pending] = useActionState(luuCauHinhAi, initial)
  const [nha, setNha] = useState<NhaCungCapId>(banDau.nhaCungCap)
  const [moHinh, setMoHinh] = useState(banDau.moHinh)
  const [urlCoSo, setUrlCoSo] = useState(banDau.nhaCungCap === 'custom' ? banDau.urlCoSo : '')
  const [xoaKhoa, setXoaKhoa] = useState(false)
  const [dsMoHinh, setDsMoHinh] = useState<string[]>([])
  const [goTay, setGoTay] = useState(false)
  const [kiem, setKiem] = useState<KetQuaKiemAi>({})
  const [viecKiem, setViecKiem] = useState<'thu' | 'tim' | 'hello' | null>(null)
  const [dangKiem, startKiem] = useTransition()
  const nhaHien = useMemo(() => NHA_CUNG_CAP_AI.find(n => n.id === nha) ?? NHA_CUNG_CAP_AI[1], [nha])
  const luaChon = useMemo(() => {
    const goc = dsMoHinh.length ? dsMoHinh : [...nhaHien.moHinhGoiY]
    return moHinh && !goc.includes(moHinh) ? [moHinh, ...goc] : goc
  }, [dsMoHinh, nhaHien, moHinh])
  const dungSelect = luaChon.length > 0 && !goTay

  function doiNha(id: NhaCungCapId) {
    setNha(id)
    const ke = NHA_CUNG_CAP_AI.find(n => n.id === id)
    setMoHinh(ke?.moHinhMacDinh ?? '')
    setXoaKhoa(false)
    setDsMoHinh([])
    setGoTay(false)
    setKiem({})
    if (id !== 'custom') setUrlCoSo('')
    else setUrlCoSo(banDau.nhaCungCap === 'custom' ? banDau.urlCoSo : '')
  }

  function thu(loai: 'thu' | 'tim' | 'hello', hanh: (data: FormData) => Promise<KetQuaKiemAi>, form: HTMLFormElement) {
    startKiem(async () => {
      setViecKiem(loai)
      setKiem({})
      try {
        const kq = await hanh(new FormData(form))
        setKiem(kq)
        if (kq.moHinh?.length) {
          setDsMoHinh(kq.moHinh)
          setGoTay(false)
        }
      } finally {
        setViecKiem(null)
      }
    })
  }

  const daCoKhoa = banDau.daCoKhoaLuu && nha === banDau.nhaCungCap && !xoaKhoa
  const dungEnv = banDau.dungKhoaMoiTruong && nha === banDau.nhaCungCap && !xoaKhoa && !banDau.daCoKhoaLuu

  return <form action={action} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
    <input type="hidden" name="xoa_khoa" value={xoaKhoa ? '1' : '0'} />

    <label className="field sm:col-span-2">
      <span className="flex items-center gap-3 font-medium text-slate-700">
        <input type="checkbox" name="dang_hoat_dong" value="1" defaultChecked={banDau.dangHoatDong} className="size-4 accent-indigo-600" />
        Bật lớp AI khi đọc hóa đơn
      </span>
      <small>Tắt thì chỉ dùng QR. Ảnh hóa đơn không gửi ra ngoài.</small>
    </label>

    <label className="field sm:col-span-2">Nhà cung cấp
      <select name="nha_cung_cap" value={nha} onChange={e => doiNha(e.target.value as NhaCungCapId)}>
        {NHA_CUNG_CAP_AI.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
      </select>
      <small>{nhaHien.moTa}</small>
    </label>

    <div className={`field ${nhaHien.id === 'custom' ? '' : 'sm:col-span-2'}`}>
      <span>Model</span>
      {dungSelect
        ? <select value={moHinh} onChange={e => setMoHinh(e.target.value)}>
          {luaChon.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        : <input value={moHinh} onChange={e => setMoHinh(e.target.value)} maxLength={200} required={nhaHien.id === 'custom'} placeholder={nhaHien.moHinhMacDinh || 'tên model'} />}
      <input type="hidden" name="mo_hinh" value={moHinh} />
      {luaChon.length > 0 && <p className="mt-1">
        <button type="button" className="text-xs font-medium text-indigo-700 underline-offset-2 hover:underline" onClick={() => setGoTay(g => !g)}>
          {goTay ? 'Chọn từ danh sách' : 'Gõ tên model khác'}
        </button>
      </p>}
      <small>
        {nhaHien.docAnh === false
          ? 'DeepSeek không đọc ảnh. Chọn model trong danh sách (sau Test API) rồi Lưu. Lớp AI chỉ đối chiếu chữ OCR.'
          : dsMoHinh.length
            ? `Đang hiện ${dsMoHinh.length} model lấy từ API. Chọn rồi bấm Lưu.`
            : 'Bấm Test API hoặc Tìm model hiện có để hiện danh sách chọn. Cần model đọc được ảnh.'}
      </small>
    </div>
    {nhaHien.docAnh === false && <p className="notice sm:col-span-2 bg-amber-50 text-amber-900" role="status">
      {nhaHien.ten} kết nối được nhưng không đọc ảnh hóa đơn. PDF có chữ (hóa đơn điện tử) vẫn đối chiếu được bằng OCR + AI. Ảnh scan/chụp thì nên đổi sang Claude, Gemini hoặc GPT-4o.
    </p>}

    {nhaHien.id === 'custom' && <label className="field">URL API ngoài
      <input name="url_co_so" value={urlCoSo} onChange={e => setUrlCoSo(e.target.value)} maxLength={300} placeholder="https://host/v1" required />
      <small>Endpoint tương thích OpenAI. Ví dụ http://127.0.0.1:11434/v1 cho Ollama.</small>
    </label>}

    <label className={`field ${nhaHien.id === 'custom' ? '' : 'sm:col-span-2'}`}>Khóa API
      <input key={nha} name="khoa_api" type="password" autoComplete="new-password" maxLength={500} placeholder={daCoKhoa ? 'Đã lưu — để trống nếu giữ nguyên' : dungEnv ? 'Đang dùng khóa trong biến môi trường' : 'sk-…'} disabled={xoaKhoa} />
      <small>
        {xoaKhoa
          ? 'Khóa đã lưu sẽ bị xóa khi bấm Lưu.'
          : daCoKhoa
            ? 'Khóa đã lưu không hiện lại. Điền khóa mới để thay, hoặc xóa khóa đã lưu.'
            : dungEnv
              ? 'Chưa lưu khóa trong Cài đặt; đang dùng biến môi trường trên VPS.'
              : 'Khóa chỉ lưu trên máy chủ, không hiện lại sau khi lưu.'}
      </small>
    </label>

    {(daCoKhoa || xoaKhoa) && <label className="field sm:col-span-2">
      <span className="flex items-center gap-3 font-medium text-slate-700">
        <input type="checkbox" checked={xoaKhoa} onChange={e => setXoaKhoa(e.target.checked)} className="size-4 accent-indigo-600" />
        Xóa khóa đã lưu
      </span>
      <small>Sau khi xóa, lớp AI dùng biến môi trường nếu có, không thì chỉ đọc QR.</small>
    </label>}

    <p className="sm:col-span-2 text-xs text-slate-500">Hóa đơn gửi tới nhà cung cấp đã chọn khi bật lớp AI. Không ghi khóa vào nhật ký. Test API không lưu cài đặt.</p>

    {state.loi && <p className="notice sm:col-span-2 error" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice sm:col-span-2 success" role="status">{state.thanhCong}</p>}
    {kiem.loi && <p className="notice sm:col-span-2 error" role="alert">{kiem.loi}</p>}
    {kiem.thanhCong && <p className="notice sm:col-span-2 success" role="status">{kiem.thanhCong}</p>}
    {kiem.nhatKy && kiem.nhatKy.length > 0 && (
      <details open={Boolean(kiem.loi)} className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-800">Nhật ký kiểm tra ({kiem.nhatKy.length} dòng)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 font-mono">
          {kiem.nhatKy.map((d, i) => <li key={i}>{d}</li>)}
        </ol>
      </details>
    )}
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500">
      <button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu cài đặt AI'}</button>
      <button type="button" disabled={pending || dangKiem} className="btn btn-secondary" onClick={e => thu('hello', pingHelloAi, e.currentTarget.form!)}>
        {viecKiem === 'hello' ? 'Đang gửi…' : 'Gửi hello'}
      </button>
      <button type="button" disabled={pending || dangKiem} className="btn btn-secondary" onClick={e => thu('thu', thuNghiemAi, e.currentTarget.form!)}>
        {viecKiem === 'thu' ? 'Đang thử…' : 'Test API'}
      </button>
      <button type="button" disabled={pending || dangKiem} className="btn btn-secondary" onClick={e => thu('tim', timMoHinhAi, e.currentTarget.form!)}>
        {viecKiem === 'tim' ? 'Đang tìm…' : 'Tìm model hiện có'}
      </button>
      <span>Gửi hello không cần danh sách model. Test API không lưu cài đặt.</span>
    </div>
  </form>
}
