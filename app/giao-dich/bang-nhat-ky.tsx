'use client'

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import type { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { ThanhToan } from './thanh-toan'
import { NutXoa } from './xoa-nut'
import { SuaGiaoDich } from './sua-giao-dich'
import { LichSu } from './lich-su'
import { cotNhatKy, rongMax, rongMin, thuTuCot, type CotId, type TuyChonCot } from './cot-nhat-ky'
import { doiKhoaSapXep, huongSapXep, sapXepDong, tongCot, type KhoaSapXep } from './sap-xep-nhat-ky'
import { batTatGiaTri, boLocCot, dangLocFacet, demDangLoc, facetCuaCot, locDong, nhanFacet, TRONG, tuyChonFacet, type BoLoc } from './loc-nhat-ky'
import { luuTuyChonCot } from './tuy-chon-actions'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const badge = (s: string) => s === 'Hợp lệ' ? 'good' : s === 'Chờ HĐ' || s === 'Chưa thanh toán' ? 'warn' : s === 'Không hợp lệ' ? 'bad' : 'neutral'
type Dong = ReturnType<typeof tinhToan>[number]

function giaTri(r: Dong, id: CotId, coTheSua: boolean, phuTro: PhuTro): ReactNode {
  switch (id) {
    case 'ngay': return r.ngay
    case 'noiDung': return <><b className="font-semibold text-slate-900">{r.noiDung}</b>{r.ghiChu && <div className="mt-1 text-xs text-slate-500">{r.ghiChu}</div>}</>
    case 'donVi': return r.donViTen ?? <span className="text-slate-400">{TRONG}</span>
    case 'chungTu': return r.kyHieuHd || r.soHd ? <>{r.kyHieuHd ?? TRONG}<br />{r.soHd ?? TRONG}</> : TRONG
    case 'trangThai': return <div className="flex flex-col items-start gap-2"><span className={`badge ${badge(r.trangThaiHd)}`}>{r.trangThaiHd}</span><span className={`badge ${badge(r.trangThaiTtPhi)}`}>{r.trangThaiTtPhi}</span>{coTheSua && r.trangThaiTtPhi === 'Chưa thanh toán' && <ThanhToan id={r.id} />}</div>
    case 'hinhThuc': return r.hinhThuc
    case 'tep': return <>{r.coHoaDon ? '✓ HĐ' : TRONG}<br />{r.coChuyenKhoan ? '✓ CK' : TRONG}</>
    case 'thaoTac': return <div className="flex flex-wrap gap-2">
      {coTheSua && <SuaGiaoDich row={r} collectors={phuTro.collectors} donVi={phuTro.donVi} vaiTro={phuTro.vaiTro} />}
      {/* Giấy đề nghị là bản in của dữ liệu nên mọi vai trò đều mở được, kể cả chi_doc;
          chỉ những hình thức có lập giấy mới hiện nút. */}
      {giayChoHinhThuc(r.hinhThuc).length > 0 && <Link className="btn btn-secondary min-h-8 px-3 py-1" href={`/giay/${r.id}`} prefetch={false}>Giấy</Link>}
      {/* Lịch sử là dữ liệu chỉ đọc nên mọi vai trò đều xem được, kể cả chi_doc. */}
      <LichSu id={r.id} nhan={`${r.ngay} · ${r.noiDung}`} />
      {coTheSua && <NutXoa id={r.id} />}
    </div>
    default: return vnd.format(r[id])
  }
}

type PhuTro = {
  collectors: NguoiLayHdChon[]
  donVi: Array<{ id: string; ten: string }>
  vaiTro: string
}

const RONG_HOP = 272

// Bảng nằm trong khung cuộn ngang nên một hộp lọc đặt tuyệt đối bên trong sẽ bị
// cắt mất. Hộp lọc được vẽ ra body và tự bám theo tiêu đề cột khi cuộn.
function viTriCho(neo: HTMLElement) {
  const rect = neo.getBoundingClientRect()
  const cao = Math.min(340, Math.max(160, window.innerHeight - 24))
  const conDuoi = window.innerHeight - rect.bottom
  return {
    left: Math.max(8, Math.min(rect.right - RONG_HOP, window.innerWidth - RONG_HOP - 8)),
    top: conDuoi > 260 ? rect.bottom + 6 : Math.max(8, rect.top - cao - 6),
    maxHeight: cao,
  }
}

function HopLoc({ neo, cotTen, cotId, rows, boLoc, onBatTat, onXoaCot, onDong }: {
  neo: HTMLElement
  cotTen: string
  cotId: CotId
  rows: readonly GiaoDichTinh[]
  boLoc: BoLoc
  onBatTat: (facetId: string, giaTri: string) => void
  onXoaCot: () => void
  onDong: () => void
}) {
  const hopRef = useRef<HTMLDivElement>(null)
  const [viTri, setViTri] = useState(() => viTriCho(neo))
  const facets = facetCuaCot(cotId)
  const dangLoc = facets.reduce((tong, f) => tong + dangLocFacet(boLoc, f.id).length, 0)

  useEffect(() => {
    const capNhat = () => setViTri(viTriCho(neo))
    const ngoai = (event: PointerEvent) => {
      const dich = event.target as Node
      if (!hopRef.current?.contains(dich) && !neo.contains(dich)) onDong()
    }
    const phim = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onDong()
      neo.focus()
    }
    capNhat()
    window.addEventListener('scroll', capNhat, true)
    window.addEventListener('resize', capNhat)
    document.addEventListener('pointerdown', ngoai, true)
    document.addEventListener('keydown', phim, true)
    return () => {
      window.removeEventListener('scroll', capNhat, true)
      window.removeEventListener('resize', capNhat)
      document.removeEventListener('pointerdown', ngoai, true)
      document.removeEventListener('keydown', phim, true)
    }
  }, [neo, onDong])

  return createPortal(
    <div ref={hopRef} role="dialog" aria-label={`Lọc cột ${cotTen}`}
      className="fixed z-50 w-[272px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl shadow-slate-900/10"
      style={{ left: viTri.left, top: viTri.top, maxHeight: viTri.maxHeight }}>
      <p className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Chọn giá trị hiển thị</p>
      {facets.map(f => {
        const tuyChon = tuyChonFacet(rows, f)
        return <fieldset key={f.id} className="mb-4 min-w-0 border-0 p-0 last:mb-0">
          {facets.length > 1 && <legend className="mb-2 text-xs font-semibold text-slate-600">{f.ten}</legend>}
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {tuyChon.map(o => <label key={o.giaTri} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
              <input type="checkbox" className="size-4 shrink-0 accent-indigo-600"
                checked={dangLocFacet(boLoc, f.id).includes(o.giaTri)}
                onChange={() => onBatTat(f.id, o.giaTri)} />
              <span className="min-w-0 flex-1 truncate text-slate-700">{o.giaTri || TRONG}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">{o.soLuong}</span>
            </label>)}
            {!tuyChon.length && <p className="px-2 py-1.5 text-xs text-slate-400">Không có giá trị nào.</p>}
          </div>
        </fieldset>
      })}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" disabled={!dangLoc} onClick={onXoaCot}>Bỏ lọc cột này</button>
        <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={onDong}>Xong</button>
      </div>
    </div>, document.body)
}

export function BangNhatKy({ rows, coTheSua, banDau, loiBanDau, phuTro }: {
  rows: ReturnType<typeof tinhToan>; coTheSua: boolean; banDau: TuyChonCot; loiBanDau?: string; phuTro: PhuTro
}) {
  const [tuyChon, setTuyChon] = useState(banDau)
  const [daLuu, setDaLuu] = useState(banDau)
  const [dangLuu, setDangLuu] = useState(false)
  const [thongBao, setThongBao] = useState(loiBanDau ?? '')
  const [khoaSapXep, setKhoaSapXep] = useState<KhoaSapXep[]>([])
  const [boLoc, setBoLoc] = useState<BoLoc>({})
  const [hopLoc, setHopLoc] = useState<{ cot: CotId; neo: HTMLElement } | null>(null)
  // Tùy chọn mới nhất, để lệnh lưu tự động sau khi thả chuột luôn dùng đúng giá trị cuối.
  const tuyChonRef = useRef(tuyChon)
  tuyChonRef.current = tuyChon
  const dangLuuRef = useRef(false)
  const choLuuRef = useRef<TuyChonCot | null>(null)
  const nguonKeo = useRef<CotId | null>(null)
  const keo = useRef<{ id: CotId; x: number; rong: number } | null>(null)
  const [cotDangKeo, setCotDangKeo] = useState<CotId | null>(null)
  const [viTriChen, setViTriChen] = useState<{ id: CotId; sau: boolean } | null>(null)

  // Cột thao tác luôn hiện: nút Lịch sử chỉ đọc nên chi_doc cũng cần thấy nó.
  const cacCot = thuTuCot(tuyChon).map(id => cotNhatKy.find(c => c.id === id)!)
  const hienThi = cacCot.filter(c => !tuyChon.an.includes(c.id))
  const daDoi = JSON.stringify(tuyChon) !== JSON.stringify(daLuu)
  const doRong = (c: typeof cotNhatKy[number]) => tuyChon.rong[c.id] ?? c.rong
  const dongHienThi = sapXepDong(locDong(rows, boLoc), khoaSapXep)
  const cotDauTien = hienThi[0]?.id
  const soDangLoc = demDangLoc(boLoc)
  const nhieuKhoa = khoaSapXep.length > 1

  function doiSapXep(id: CotId, giuNhieu: boolean) {
    setKhoaSapXep(khoa => doiKhoaSapXep(khoa, id, giuNhieu))
  }
  function suaRong(id: CotId, value: number) {
    if (!Number.isFinite(value)) return
    setTuyChon(prev => ({ ...prev, rong: { ...prev.rong, [id]: Math.max(rongMin, Math.min(rongMax, Math.round(value))) } }))
    setThongBao('')
  }
  // Lưu tự động: bố cục không còn nút lưu riêng, nên mọi thay đổi đổi cột đều
  // gửi lên ngay. Nếu đang có lệnh lưu dở thì giữ lại giá trị mới nhất và gửi tiếp.
  async function luu(value: TuyChonCot) {
    if (dangLuuRef.current) { choLuuRef.current = value; return }
    dangLuuRef.current = true
    setDangLuu(true)
    try {
      let tiep: TuyChonCot | null = value
      while (tiep) {
        choLuuRef.current = null
        try {
          const result = await luuTuyChonCot(tiep)
          setThongBao(result.thongBao)
          // Chỉ ghi nhận giá trị đã lưu, không gán ngược vào bố cục đang hiển thị:
          // người dùng có thể đã đổi cột trong lúc chờ, gán ngược sẽ nuốt mất thay đổi đó.
          if (result.ok) setDaLuu(tiep)
        } catch {
          setThongBao('Không kết nối được máy chủ. Bố cục chưa được lưu; vui lòng thử lại.')
        }
        tiep = choLuuRef.current
      }
    } finally { dangLuuRef.current = false; setDangLuu(false) }
  }
  function sapXepCot(idKeo: CotId, idDich: CotId, sau: boolean) {
    if (idKeo === idDich || dangLuuRef.current || !cotNhatKy.some(c => c.id === idKeo) || !cotNhatKy.some(c => c.id === idDich)) return
    const thuTu = thuTuCot(tuyChon)
    const khongCoCotKeo = thuTu.filter(id => id !== idKeo)
    const viTriDich = khongCoCotKeo.indexOf(idDich)
    const thuTuMoi = [...khongCoCotKeo]
    thuTuMoi.splice(viTriDich + (sau ? 1 : 0), 0, idKeo)
    const value = { ...tuyChon, thuTu: thuTuMoi }
    setTuyChon(value)
    setThongBao('')
    void luu(value)
  }
  function datViTriChen(event: DragEvent<HTMLTableCellElement>, id: CotId) {
    if (!cotDangKeo || cotDangKeo === id) return
    const rect = event.currentTarget.getBoundingClientRect()
    setViTriChen({ id, sau: event.clientX >= rect.left + rect.width / 2 })
  }
  function doiLoc(facetId: string, giaTri: string) {
    setBoLoc(truoc => batTatGiaTri(truoc, facetId, giaTri))
  }
  function xoaLocCot(cot: CotId) {
    setBoLoc(truoc => boLocCot(truoc, facetCuaCot(cot).map(f => f.id)))
  }
  const trangThaiLuu = thongBao || (dangLuu ? 'Đang lưu bố cục…' : daDoi ? 'Có thay đổi chưa lưu.' : '')
  const chipLoc = Object.entries(boLoc).flatMap(([facetId, giaTri]) => giaTri.map(v => ({ facetId, giaTri: v })))

  return <>
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="badge neutral">{dongHienThi.length}/{rows.length} dòng</span>
      {khoaSapXep.map((k, i) => <button key={k.id} type="button" className="ledger-chip ledger-chip-sort"
        aria-label={`Bỏ sắp xếp ${cotNhatKy.find(c => c.id === k.id)?.ten}`}
        onClick={() => setKhoaSapXep(khoa => khoa.filter(x => x.id !== k.id))}>
        {i + 1}. {cotNhatKy.find(c => c.id === k.id)?.ten} {k.giam ? '↓' : '↑'}<span aria-hidden="true" className="text-slate-400">×</span>
      </button>)}
      {chipLoc.map(chip => <button key={`${chip.facetId}:${chip.giaTri}`} type="button"
        aria-label={`Bỏ lọc ${nhanFacet(chip.facetId)} ${chip.giaTri || TRONG}`}
        className="ledger-chip" onClick={() => doiLoc(chip.facetId, chip.giaTri)}>
        <span className="text-slate-500">{nhanFacet(chip.facetId)}:</span> {chip.giaTri || TRONG}<span aria-hidden="true" className="text-slate-400">×</span>
      </button>)}
      {soDangLoc > 0 && <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => setBoLoc({})}>Bỏ tất cả lọc</button>}
      <p role="status" aria-live="polite" className={`ml-auto text-xs ${thongBao ? 'text-amber-700' : 'text-slate-500'}`}>{trangThaiLuu}</p>
      {thongBao && daDoi && <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => void luu(tuyChon)}>Thử lại lưu bố cục</button>}
    </div>

    <section className="card ledger-wrap max-w-full overflow-auto" tabIndex={0} role="region" aria-label="Nhật ký giao dịch, cuộn ngang để xem các cột">
      <table className="ledger border-separate border-spacing-0 text-sm [&_td]:border-r [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3 [&_th]:border-r [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-600 [&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-indigo-50/60" style={{ tableLayout: 'fixed', minWidth: 0, width: hienThi.reduce((sum, c) => sum + doRong(c), 0) }}>
        <colgroup>{hienThi.map(c => <col key={c.id} style={{ width: doRong(c) }} />)}</colgroup>
        <thead><tr>{hienThi.map(c => {
          const nguonIndex = hienThi.findIndex(item => item.id === cotDangKeo)
          const dichIndex = hienThi.findIndex(item => item.id === viTriChen?.id)
          const index = hienThi.indexOf(c)
          const push = viTriChen && cotDangKeo !== c.id && index > nguonIndex && index < dichIndex ? ' push-left' : viTriChen && cotDangKeo !== c.id && index < nguonIndex && index > dichIndex ? ' push-right' : ''
          const chenTruoc = viTriChen?.id === c.id && !viTriChen.sau
          const chenSau = viTriChen?.id === c.id && viTriChen.sau
          const huong = huongSapXep(khoaSapXep, c.id)
          const thuTuKhoa = nhieuKhoa ? khoaSapXep.findIndex(k => k.id === c.id) + 1 : 0
          const sapXepDuoc = c.id !== 'thaoTac'
          const coLoc = facetCuaCot(c.id).length > 0
          const soLoc = facetCuaCot(c.id).reduce((tong, f) => tong + dangLocFacet(boLoc, f.id).length, 0)
          return <th key={c.id} scope="col" draggable={!dangLuu} aria-grabbed={cotDangKeo === c.id} aria-sort={huong}
            className={`ledger-column-header${cotDangKeo === c.id ? ' is-dragging' : ''}${chenTruoc ? ' insert-before' : ''}${chenSau ? ' insert-after' : ''}${push}`}
            style={{ top: 0, position: 'sticky', whiteSpace: 'normal', overflowWrap: 'anywhere', paddingRight: coLoc ? 62 : 42 }}
            onDragStart={event => { if (dangLuuRef.current) { event.preventDefault(); return }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-ledger-column', c.id); nguonKeo.current = c.id; setCotDangKeo(c.id); setThongBao('') }}
            onDragOver={event => { if (!nguonKeo.current || dangLuuRef.current) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; datViTriChen(event, c.id) }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setViTriChen(prev => prev?.id === c.id ? null : prev) }}
            onDrop={event => { const idKeo = nguonKeo.current; if (!idKeo || dangLuuRef.current) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); sapXepCot(idKeo, c.id, event.clientX >= rect.left + rect.width / 2); nguonKeo.current = null; setCotDangKeo(null); setViTriChen(null) }}
            onDragEnd={() => { nguonKeo.current = null; setCotDangKeo(null); setViTriChen(null) }}>
            <span className="mr-2 inline-block text-base text-slate-400" aria-hidden="true" title="Kéo để đổi vị trí cột">⠿</span>
            {sapXepDuoc
              ? <button type="button" draggable={false} className="ledger-sort" aria-pressed={huong !== 'none'}
                onClick={event => doiSapXep(c.id, event.shiftKey)}>
                {c.ten}<span aria-hidden="true" className="ledger-sort-mark">{huong === 'ascending' ? '↑' : huong === 'descending' ? '↓' : '↕'}{thuTuKhoa > 0 && huong !== 'none' ? thuTuKhoa : ''}</span>
              </button>
              : <span>{c.ten}</span>}
            {coLoc && <button type="button" draggable={false} className={`ledger-filter${soLoc ? ' is-active' : ''}`}
              aria-label={`Lọc cột ${c.ten}`} aria-haspopup="dialog" aria-expanded={hopLoc?.cot === c.id}
              onClick={event => { const neo = event.currentTarget; setHopLoc(truoc => truoc?.cot === c.id ? null : { cot: c.id, neo }) }}
              onDragStart={event => event.preventDefault()}>
              <span aria-hidden="true">▾</span>{soLoc > 0 && <b aria-hidden="true">{soLoc}</b>}
            </button>}
            <button type="button" role="slider" aria-label={`Chiều rộng cột ${c.ten}`} aria-valuemin={rongMin} aria-valuemax={rongMax} aria-valuenow={doRong(c)} aria-valuetext={`${doRong(c)} pixel`} aria-orientation="horizontal"
              className="ledger-resizer" draggable={false}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 18, cursor: 'col-resize', touchAction: 'none', border: 0, borderRight: '2px solid var(--line)', color: 'inherit' }}
              onDragStart={event => event.preventDefault()}
              onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); keo.current = { id: c.id, x: e.clientX, rong: doRong(c) } }}
              onPointerMove={e => { if (keo.current?.id === c.id) suaRong(c.id, keo.current.rong + e.clientX - keo.current.x) }}
              onPointerUp={() => { if (keo.current?.id === c.id) { keo.current = null; void luu(tuyChonRef.current) } }}
              onPointerCancel={() => { keo.current = null }} onLostPointerCapture={() => { keo.current = null }}
              onKeyDown={e => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault()
                  const rongMoi = e.key === 'Home' ? rongMin : e.key === 'End' ? rongMax : doRong(c) + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 25 : 10)
                  suaRong(c.id, rongMoi)
                  const gioiHan = Math.max(rongMin, Math.min(rongMax, Math.round(rongMoi)))
                  void luu({ ...tuyChonRef.current, rong: { ...tuyChonRef.current.rong, [c.id]: gioiHan } })
                }
              }}>↔</button>
          </th>
        })}</tr></thead>
        <tbody>{dongHienThi.map(r => <tr key={r.id}>{hienThi.map(c => <td key={c.id} className={typeof r[c.id as keyof Dong] === 'number' ? 'money' : undefined} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{giaTri(r, c.id, coTheSua, phuTro)}</td>)}</tr>)}
          {!dongHienThi.length && <tr><td colSpan={hienThi.length} className="px-6 py-14 text-center text-slate-500">
            {rows.length
              ? <span className="flex flex-col items-center gap-3">Không có dòng nào khớp bộ lọc.<button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => setBoLoc({})}>Bỏ tất cả lọc</button></span>
              : 'Chưa có giao dịch nào.'}
          </td></tr>}
        </tbody>
        {dongHienThi.length > 0 && <tfoot><tr className="[&_td]:sticky [&_td]:bottom-0 [&_td]:border-t-2 [&_td]:border-slate-300 [&_td]:bg-slate-100 [&_td]:font-semibold [&_td]:text-slate-800">{hienThi.map(c => {
          const tong = tongCot(dongHienThi, c.id)
          if (c.id === cotDauTien) return <td key={c.id}>Tổng {dongHienThi.length} dòng</td>
          return <td key={c.id} className={tong === null ? undefined : 'money'}>{tong === null ? '' : vnd.format(tong)}</td>
        })}</tr></tfoot>}
      </table>
    </section>
    {hopLoc && <HopLoc neo={hopLoc.neo} cotTen={cotNhatKy.find(c => c.id === hopLoc.cot)!.ten} cotId={hopLoc.cot}
      rows={rows} boLoc={boLoc} onBatTat={doiLoc} onXoaCot={() => xoaLocCot(hopLoc.cot)} onDong={() => setHopLoc(null)} />}
  </>
}
