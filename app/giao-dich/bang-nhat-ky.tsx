'use client'

import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { canDonVi } from '@/lib/tai-chinh/hinh-thuc'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import type { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { ThanhToan } from './thanh-toan'
import { NutXoa } from './xoa-nut'
import { SuaGiaoDich } from './sua-giao-dich'
import { LichSu } from './lich-su'
import { catTrangNhatKy, cotNhatKy, rongMax, rongMin, soDongTrangHopLe, SO_DONG_TRANG, thuTuCot, type CotId, type TuyChonCot } from './cot-nhat-ky'
import { doiKhoaSapXep, huongSapXep, sapXepDong, tongCot, type KhoaSapXep } from './sap-xep-nhat-ky'
import { batTatGiaTri, boLocCot, dangLocFacet, demDangLoc, facetCuaCot, locDong, nhanFacet, TRONG, tuyChonFacet, type BoLoc } from './loc-nhat-ky'
import { luuTuyChonCot } from './tuy-chon-actions'
import { xuatNhatKyExcel } from './xuat-nhat-ky-excel'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const LEDGER_STICKY_TOP = 64
const badge = (s: string) => s === 'Hợp lệ' ? 'good' : s === 'Chờ HĐ' || s === 'Chưa thanh toán' ? 'warn' : s === 'Không hợp lệ' ? 'bad' : 'neutral'
type Dong = ReturnType<typeof tinhToan>[number]
type StickyHeader = { left: number; width: number; scrollLeft: number } | null

// Click vào một nút hoặc liên kết trong cột thao tác phải giữ nguyên dòng đang chọn;
// chỉ vùng dữ liệu của hàng mới đổi trạng thái chọn.
function clickTuongTac(event: MouseEvent<HTMLTableRowElement>): boolean {
  return event.target instanceof Element && Boolean(event.target.closest('a, button, input, select, textarea, label, [role="button"], [role="slider"]'))
}

function giaTri(r: Dong, id: CotId, coTheSua: boolean, phuTro: PhuTro): ReactNode {
  switch (id) {
    case 'ngay': return r.ngay
    case 'noiDung': return <><b className="font-semibold text-slate-900">{r.noiDung}</b>{r.ghiChu && <div className="mt-1 text-xs text-slate-500">{r.ghiChu}</div>}</>
    case 'donVi': return r.donViTen ?? <span className="text-slate-400">{TRONG}</span>
    case 'nguoiDeNghi': return r.nguoiDeNghiTen ?? <span className="text-slate-400">{TRONG}</span>
    case 'nguoiLayHd': return r.nguoiLayHdTen ?? <span className="text-slate-400">{TRONG}</span>
    case 'chungTu': return r.kyHieuHd || r.soHd ? <>{r.kyHieuHd ?? TRONG}<br />{r.soHd ?? TRONG}</> : TRONG
    case 'trangThaiHd': return <div className="flex flex-col items-start gap-2">
      <span className={`badge ${badge(r.trangThaiHd)}`}>{r.trangThaiHd}</span>
      {canDonVi(r.hinhThuc) && <span className={`badge ${r.chiThucTe ? 'good' : 'neutral'}`}>{r.chiThucTe ? 'Chi thực tế' : 'Không chi thực tế'}</span>}
    </div>
    case 'trangThaiTtPhi': return <div className="flex flex-col items-start gap-2"><span className={`badge ${badge(r.trangThaiTtPhi)}`}>{r.trangThaiTtPhi}</span>{coTheSua && r.trangThaiTtPhi === 'Chưa thanh toán' && <ThanhToan id={r.id} />}</div>
    case 'hinhThuc': return r.hinhThuc
    case 'tep': return <Link href={`/tep/${r.id}`} prefetch={false} className="text-indigo-700 hover:underline">
      {r.coHoaDon ? '✓ HĐ' : TRONG}<br />{r.coChuyenKhoan ? '✓ CK' : TRONG}
    </Link>
    case 'thaoTac': return <div className="flex flex-wrap gap-2">
      {coTheSua && <SuaGiaoDich row={r} collectors={phuTro.collectors} donVi={phuTro.donVi} vaiTro={phuTro.vaiTro} />}
      {/* Giấy đề nghị là bản in của dữ liệu nên mọi vai trò đều mở được, kể cả chi_doc;
          chỉ những hình thức có lập giấy mới hiện nút. */}
      {giayChoHinhThuc(r.hinhThuc).length > 0 && <Link className="btn btn-secondary min-h-8 px-3 py-1" href={`/giay/${r.id}`} prefetch={false}>Giấy</Link>}
      <Link className="btn btn-secondary min-h-8 px-3 py-1" href={`/tep/${r.id}`} prefetch={false}>Tệp</Link>
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
  const [dangXuatExcel, setDangXuatExcel] = useState(false)
  const [thongBaoXuatExcel, setThongBaoXuatExcel] = useState<{ loi: boolean; noiDung: string } | null>(null)
  const [khoaSapXep, setKhoaSapXep] = useState<KhoaSapXep[]>([])
  const [boLoc, setBoLoc] = useState<BoLoc>({})
  const [hopLoc, setHopLoc] = useState<{ cot: CotId; neo: HTMLElement } | null>(null)
  const [trang, setTrang] = useState(1)
  const [dongDangChon, setDongDangChon] = useState<string | null>(null)
  const [stickyHeader, setStickyHeader] = useState<StickyHeader>(null)
  const refreshStickyHeaderRef = useRef<() => void>(() => {})
  const horizontalScrollRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const tableHeadRef = useRef<HTMLTableSectionElement>(null)
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
  const soDongTrang = soDongTrangHopLe(tuyChon.soDongTrang)
  const phanTrang = catTrangNhatKy(dongHienThi, soDongTrang, trang)
  const dongTrang = phanTrang.dong
  const cotDauTien = hienThi[0]?.id
  const soDangLoc = demDangLoc(boLoc)
  const nhieuKhoa = khoaSapXep.length > 1
  const tableWidth = hienThi.reduce((sum, c) => sum + doRong(c), 0)
  const tableClassName = 'ledger border-separate border-spacing-0 text-sm [&_td]:border-r [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-3 [&_th]:border-r [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-600 [&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-indigo-50/60'

  useEffect(() => {
    const scroller = horizontalScrollRef.current
    const table = tableRef.current
    const head = tableHeadRef.current
    if (!scroller || !table || !head) return

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (keo.current) return
        const headRect = head.getBoundingClientRect()
        const tableRect = table.getBoundingClientRect()
        const scrollRect = scroller.getBoundingClientRect()
        const active = headRect.top < LEDGER_STICKY_TOP
          && tableRect.bottom > LEDGER_STICKY_TOP + headRect.height
        const next = active
          ? { left: scrollRect.left, width: scroller.clientWidth, scrollLeft: scroller.scrollLeft }
          : null
        setStickyHeader(previous => previous?.left === next?.left
          && previous?.width === next?.width
          && previous?.scrollLeft === next?.scrollLeft
          ? previous
          : next)
      })
    }
    refreshStickyHeaderRef.current = update

    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    observer.observe(table)
    observer.observe(head)
    window.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update)
    scroller.addEventListener('scroll', update, { passive: true })
    update()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      scroller.removeEventListener('scroll', update)
      if (refreshStickyHeaderRef.current === update) refreshStickyHeaderRef.current = () => {}
    }
  }, [tuyChon, dongTrang.length])

  function doiSapXep(id: CotId, giuNhieu: boolean) {
    setKhoaSapXep(khoa => doiKhoaSapXep(khoa, id, giuNhieu))
    setTrang(1)
  }
  function doiSoDongTrang(so: number) {
    const value = { ...tuyChon, soDongTrang: soDongTrangHopLe(so) }
    setTuyChon(value)
    setTrang(1)
    setThongBao('')
    void luu(value)
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
    setTrang(1)
  }
  function xoaLocCot(cot: CotId) {
    setBoLoc(truoc => boLocCot(truoc, facetCuaCot(cot).map(f => f.id)))
    setTrang(1)
  }
  async function xuatExcel() {
    if (dangXuatExcel) return
    setDangXuatExcel(true)
    setThongBaoXuatExcel(null)
    try {
      // dongHienThi đã áp dụng mọi bộ lọc và khóa sắp xếp, nhưng chưa phân trang.
      await xuatNhatKyExcel(dongHienThi)
      setThongBaoXuatExcel({ loi: false, noiDung: `Đã xuất ${dongHienThi.length} dòng Excel.` })
    } catch {
      setThongBaoXuatExcel({ loi: true, noiDung: 'Không thể xuất Excel. Vui lòng thử lại.' })
    } finally {
      setDangXuatExcel(false)
    }
  }
  const trangThaiLuu = thongBao || (dangLuu ? 'Đang lưu bố cục…' : daDoi ? 'Có thay đổi chưa lưu.' : '')
  const chipLoc = Object.entries(boLoc).flatMap(([facetId, giaTri]) => giaTri.map(v => ({ facetId, giaTri: v })))

  function renderTableHead(ref: boolean): ReactNode {
    return <thead ref={ref ? tableHeadRef : undefined}
      aria-hidden={ref && stickyHeader ? true : undefined}
      inert={ref && stickyHeader !== null}><tr>{hienThi.map(c => {
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
        style={{ position: 'relative', whiteSpace: 'normal', overflowWrap: 'anywhere', paddingRight: coLoc ? 62 : 42 }}
        onDragStart={event => { if (dangLuuRef.current) { event.preventDefault(); return }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-ledger-column', c.id); nguonKeo.current = c.id; refreshStickyHeaderRef.current(); setCotDangKeo(c.id); setThongBao('') }}
        onDragOver={event => { if (!nguonKeo.current || dangLuuRef.current) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; datViTriChen(event, c.id) }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setViTriChen(prev => prev?.id === c.id ? null : prev) }}
        onDrop={event => { const idKeo = nguonKeo.current; if (!idKeo || dangLuuRef.current) return; event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); sapXepCot(idKeo, c.id, event.clientX >= rect.left + rect.width / 2); nguonKeo.current = null; refreshStickyHeaderRef.current(); setCotDangKeo(null); setViTriChen(null) }}
        onDragEnd={() => { nguonKeo.current = null; refreshStickyHeaderRef.current(); setCotDangKeo(null); setViTriChen(null) }}>
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
          onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); keo.current = { id: c.id, x: e.clientX, rong: doRong(c) }; refreshStickyHeaderRef.current() }}
          onPointerMove={e => { if (keo.current?.id === c.id) suaRong(c.id, keo.current.rong + e.clientX - keo.current.x) }}
          onPointerUp={() => { if (keo.current?.id === c.id) { keo.current = null; refreshStickyHeaderRef.current(); void luu(tuyChonRef.current) } }}
          onPointerCancel={() => { keo.current = null; refreshStickyHeaderRef.current() }} onLostPointerCapture={() => { keo.current = null; refreshStickyHeaderRef.current() }}
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
  }

  return <>
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Số dòng mỗi trang
        <select aria-label="Số dòng mỗi trang" className="min-h-8 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          value={soDongTrang} onChange={event => doiSoDongTrang(Number(event.target.value))}>
          {SO_DONG_TRANG.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="badge neutral">{dongHienThi.length}/{rows.length} dòng</span>
      <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" disabled={dangXuatExcel} onClick={() => void xuatExcel()}>
        {dangXuatExcel ? 'Đang xuất Excel…' : 'Xuất Excel'}
      </button>
      {thongBaoXuatExcel && <p role={thongBaoXuatExcel.loi ? 'alert' : 'status'} className={`text-xs ${thongBaoXuatExcel.loi ? 'text-red-700' : 'text-emerald-700'}`}>{thongBaoXuatExcel.noiDung}</p>}
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
      {soDangLoc > 0 && <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => { setBoLoc({}); setTrang(1) }}>Bỏ tất cả lọc</button>}
      <p role="status" aria-live="polite" className={`ml-auto text-xs ${thongBao ? 'text-amber-700' : 'text-slate-500'}`}>{trangThaiLuu}</p>
      {thongBao && daDoi && <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => void luu(tuyChon)}>Thử lại lưu bố cục</button>}
    </div>

    <section className="card ledger-wrap max-w-full" tabIndex={0} role="region" aria-label="Nhật ký giao dịch, cuộn ngang để xem các cột">
      <div ref={horizontalScrollRef} className="ledger-horizontal-scroll max-w-full overflow-x-auto">
        <table ref={tableRef} className={tableClassName} style={{ tableLayout: 'fixed', minWidth: 0, width: tableWidth }}>
        <colgroup>{hienThi.map(c => <col key={c.id} style={{ width: doRong(c) }} />)}</colgroup>
        {renderTableHead(true)}
        <tbody>{dongTrang.map(r => {
          const daChon = dongDangChon === r.id
          return <tr key={r.id} data-selected={daChon ? 'true' : 'false'}
            className={`ledger-row-selectable${daChon ? ' ledger-row-selected' : ''}`}
            onClick={event => {
              if (clickTuongTac(event)) return
              setDongDangChon(dong => dong === r.id ? null : r.id)
            }}>
            {hienThi.map(c => <td key={c.id} className={typeof r[c.id as keyof Dong] === 'number' ? 'money' : undefined} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{giaTri(r, c.id, coTheSua, phuTro)}</td>)}
          </tr>
        })}
          {!dongHienThi.length && <tr><td colSpan={hienThi.length} className="px-6 py-14 text-center text-slate-500">
            {rows.length
              ? <span className="flex flex-col items-center gap-3">Không có dòng nào khớp bộ lọc.<button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => { setBoLoc({}); setTrang(1) }}>Bỏ tất cả lọc</button></span>
              : 'Chưa có giao dịch nào.'}
          </td></tr>}
        </tbody>
        {dongHienThi.length > 0 && <tfoot><tr className="[&_td]:border-t-2 [&_td]:border-slate-300 [&_td]:bg-slate-100 [&_td]:font-semibold [&_td]:text-slate-800">{hienThi.map(c => {
          const tong = tongCot(dongHienThi, c.id)
          if (c.id === cotDauTien) return <td key={c.id}>Tổng {dongHienThi.length} dòng</td>
          return <td key={c.id} className={tong === null ? undefined : 'money'}>{tong === null ? '' : vnd.format(tong)}</td>
        })}</tr></tfoot>}
        </table>
      </div>
    </section>
    {stickyHeader && <div className="ledger-sticky-header" style={{ left: stickyHeader.left, top: LEDGER_STICKY_TOP, width: stickyHeader.width }}>
      <table className={tableClassName} style={{ tableLayout: 'fixed', minWidth: 0, width: tableWidth, transform: `translateX(-${stickyHeader.scrollLeft}px)` }}>
        <colgroup>{hienThi.map(c => <col key={c.id} style={{ width: doRong(c) }} />)}</colgroup>
        {renderTableHead(false)}
      </table>
    </div>}
    {phanTrang.tongTrang > 1 && <nav className="mt-3 flex flex-wrap items-center gap-1" aria-label="Trang nhật ký">
      {Array.from({ length: phanTrang.tongTrang }, (_, i) => i + 1).map(so => (
        <button key={so} type="button" aria-label={`Trang ${so}`} aria-current={so === phanTrang.trang ? 'page' : undefined}
          className={`btn min-h-8 min-w-8 px-3 py-1 ${so === phanTrang.trang ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTrang(so)}>{so}</button>
      ))}
    </nav>}
    {hopLoc && <HopLoc neo={hopLoc.neo} cotTen={cotNhatKy.find(c => c.id === hopLoc.cot)!.ten} cotId={hopLoc.cot}
      rows={rows} boLoc={boLoc} onBatTat={doiLoc} onXoaCot={() => xoaLocCot(hopLoc.cot)} onDong={() => setHopLoc(null)} />}
  </>
}
