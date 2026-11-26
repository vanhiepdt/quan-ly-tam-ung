'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GiaoDichTheoDoi } from '@/lib/tai-chinh/theo-doi-giao-dich'
import { DS_HINH_THUC } from '@/lib/tai-chinh/kieu'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { BoLocTheoDoi, type BoLocTheoDoi as BoLoc } from './bo-loc-theo-doi'
import { ChiTietGiaoDich } from './chi-tiet-giao-dich'
import { FormGiaoDich } from '../form'
import { GiaoDichCon } from './giao-dich-con'
import { TaiChungTuHoiNghi } from './tai-chung-tu-hoi-nghi'
import { NutXoaHoiNghi } from './xoa-hoi-nghi'

export type HoiNghiTheoDoi = {
  id: string
  ten: string
  ngay: string
  ghiChu: string | null
  loaiGiaoDich: string
  nguonPhi: string
  rows: GiaoDichTheoDoi[]
  tongTien: number
  tienDuocThanhToan: number
  tongPhi: number
}

type DongHienThi =
  | { kind: 'giao_dich'; id: string; row: GiaoDichTheoDoi }
  | { kind: 'hoi_nghi'; id: string; hoiNghi: HoiNghiTheoDoi }

const SO_DONG_TRANG = 15
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

function loc(rows: readonly GiaoDichTheoDoi[], boLoc: BoLoc): GiaoDichTheoDoi[] {
  const keyword = boLoc.tuKhoa?.trim().toLocaleLowerCase('vi')
  return rows.filter(row => {
    if (keyword && ![row.noiDung, row.hinhThuc, row.donViTen, row.kyHieuHd, row.soHd, row.nguoiLayHdTen].some(value => value?.toLocaleLowerCase('vi').includes(keyword))) return false
    if (boLoc.tuNgay && row.ngay < boLoc.tuNgay) return false
    if (boLoc.denNgay && row.ngay > boLoc.denNgay) return false
    if (boLoc.hinhThuc && row.hinhThuc !== boLoc.hinhThuc) return false
    if (boLoc.trangThaiHd && row.trangThaiHd !== boLoc.trangThaiHd) return false
    if (boLoc.trangThaiTtPhi && row.trangThaiTtPhi !== boLoc.trangThaiTtPhi) return false
    if (boLoc.hoSo === 'hoaDon' && !row.hoSo.coHoaDon) return false
    if (boLoc.hoSo === 'chuyenKhoan' && !row.hoSo.coChuyenKhoan) return false
    return true
  })
}

function nhanNguon(nguon: string) { return nguon === 'quy_chi_thuy' ? 'Quỹ Chị Thúy' : 'Dư theo loại giao dịch' }

export function TheoDoiGiaoDich({ rows, hoiNghi, coTheSua, vaiTro, loiTaiDuLieu, collectors, donVi, tyLePhiChung, tyLeTheoNguoi }: {
  rows: GiaoDichTheoDoi[]
  hoiNghi?: HoiNghiTheoDoi[]
  coTheSua: boolean
  vaiTro: string
  loiTaiDuLieu?: string
  collectors: NguoiLayHdChon[]
  donVi: Array<{ id: string; ten: string }>
  tyLePhiChung: number
  tyLeTheoNguoi: Record<string, number>
}) {
  const [tuKhoa, setTuKhoa] = useState('')
  const [boLoc, setBoLoc] = useState<BoLoc>({})
  const [trang, setTrang] = useState(1)
  const [dangMo, setDangMo] = useState<DongHienThi | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const filtered = useMemo(() => loc(rows, { ...boLoc, tuKhoa }), [rows, boLoc, tuKhoa])
  const groups = useMemo(() => new Map((hoiNghi ?? []).map(h => [h.id, h])), [hoiNghi])
  const display = useMemo<DongHienThi[]>(() => {
    const result: DongHienThi[] = []
    const seen = new Set<string>()
    for (const row of filtered) {
      if (row.giaoDich.hoiNghiId) {
        const group = groups.get(row.giaoDich.hoiNghiId)
        if (group && !seen.has(group.id)) { result.push({ kind: 'hoi_nghi', id: group.id, hoiNghi: group }); seen.add(group.id) }
      } else result.push({ kind: 'giao_dich', id: row.id, row })
    }
    for (const group of groups.values()) {
      if (!seen.has(group.id) && group.rows.length === 0) {
        result.push({ kind: 'hoi_nghi', id: group.id, hoiNghi: group })
      }
    }
    return result
  }, [filtered, groups])
  const tongTrang = Math.max(1, Math.ceil(display.length / SO_DONG_TRANG))
  const trangHopLe = Math.min(trang, tongTrang)
  const hienThi = display.slice((trangHopLe - 1) * SO_DONG_TRANG, trangHopLe * SO_DONG_TRANG)

  useEffect(() => { if (dangMo) { if (!dialogRef.current?.open) dialogRef.current?.showModal() } else if (dialogRef.current?.open) dialogRef.current.close() }, [dangMo])
  useEffect(() => {
    if (dangMo?.kind !== 'hoi_nghi') return
    const refreshed = groups.get(dangMo.id)
    if (refreshed && refreshed !== dangMo.hoiNghi) {
      setDangMo(current => current?.kind === 'hoi_nghi' && current.id === refreshed.id ? { ...current, hoiNghi: refreshed } : current)
    }
  }, [groups, dangMo])
  // Nhật ký giao dịch gộp cả Hội nghị vào một dòng và liên kết sang đây kèm
  // mã Hội nghị, nên mở sẵn đúng Hội nghị đó thay vì bắt tìm lại trong danh sách.
  useEffect(() => {
    const ma = window.location.hash.replace('#hoi-nghi-', '')
    if (!ma || ma === window.location.hash) return
    const group = groups.get(ma)
    if (group) setDangMo({ kind: 'hoi_nghi', id: group.id, hoiNghi: group })
  }, [groups])
  useEffect(() => { if (trang !== trangHopLe) setTrang(trangHopLe) }, [trang, trangHopLe])

  function dong() { dialogRef.current?.close(); setDangMo(null) }
  const thayDoiLoc = (next: BoLoc) => { setBoLoc(next); if (next.tuKhoa !== undefined) setTuKhoa(next.tuKhoa); setTrang(1) }

  return <>
    {loiTaiDuLieu && <p className="notice error" role="alert">{loiTaiDuLieu}</p>}
    {!loiTaiDuLieu && <BoLocTheoDoi boLoc={{ ...boLoc, tuKhoa, soKetQua: display.length }} hinhThucOptions={DS_HINH_THUC} onChange={thayDoiLoc} onClear={() => { setBoLoc({}); setTuKhoa(''); setTrang(1) }} />}
    {!loiTaiDuLieu && <section className="card overflow-hidden" aria-label="Nhật ký theo dõi giao dịch"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><p role="status" className="text-sm text-slate-600">{display.length ? `Trang ${trangHopLe}/${tongTrang}` : 'Chưa có giao dịch nào.'}</p><span className="badge neutral">{display.length} dòng</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm"><thead><tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><th className="border-b border-slate-200 px-4 py-3">Ngày hóa đơn<br /><span className="font-normal">(Ngày *)</span></th><th className="border-b border-slate-200 px-4 py-3">Đơn vị tiếp khách</th><th className="border-b border-slate-200 px-4 py-3">Loại giao dịch</th><th className="border-b border-slate-200 px-4 py-3 text-right">Tổng tiền (VND) *</th><th className="border-b border-slate-200 px-4 py-3 text-right">Tiền được hoàn/thanh toán (VND) *</th><th className="border-b border-slate-200 px-4 py-3">Người lấy HĐ</th><th className="border-b border-slate-200 px-4 py-3">Trạng thái thanh toán phí</th><th className="border-b border-slate-200 px-4 py-3">Ký hiệu HĐ</th><th className="border-b border-slate-200 px-4 py-3">Số HĐ</th><th className="border-b border-slate-200 px-4 py-3">Thông tin</th></tr></thead><tbody>{hienThi.map(item => item.kind === 'giao_dich' ? <tr key={item.id} className="cursor-pointer hover:bg-indigo-50/60" onClick={() => setDangMo(item)}><td className="border-b border-slate-100 px-4 py-3">{item.row.ngay}</td><td className="border-b border-slate-100 px-4 py-3">{item.row.donViTen ?? '—'}</td><td className="border-b border-slate-100 px-4 py-3 font-medium">{item.row.nhanHinhThuc.nhanNgan}</td><td className="money border-b border-slate-100 px-4 py-3">{vnd.format(item.row.tongTien)}</td><td className="money border-b border-slate-100 px-4 py-3">{vnd.format(item.row.tienDuocThanhToan ?? 0)}</td><td className="border-b border-slate-100 px-4 py-3">{item.row.nguoiLayHdTen ?? '—'}</td><td className="border-b border-slate-100 px-4 py-3">{item.row.trangThaiTtPhi}</td><td className="border-b border-slate-100 px-4 py-3">{item.row.kyHieuHd ?? '—'}</td><td className="border-b border-slate-100 px-4 py-3">{item.row.soHd ?? '—'}</td><td className="border-b border-slate-100 px-4 py-3"><button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={e => { e.stopPropagation(); setDangMo(item) }}>Xem</button></td></tr> : <tr key={item.id} className="cursor-pointer bg-indigo-50/40 hover:bg-indigo-100/60" onClick={() => setDangMo(item)}><td className="border-b border-indigo-100 px-4 py-3">{item.hoiNghi.ngay}</td><td className="border-b border-indigo-100 px-4 py-3">—</td><td className="border-b border-indigo-100 px-4 py-3"><strong>Hội nghị</strong><div className="text-xs text-slate-500">{item.hoiNghi.ten} · {item.hoiNghi.rows.length} giao dịch con</div></td><td className="money border-b border-indigo-100 px-4 py-3">{vnd.format(item.hoiNghi.tongTien)}</td><td className="money border-b border-indigo-100 px-4 py-3">{vnd.format(item.hoiNghi.tienDuocThanhToan)}</td><td className="border-b border-indigo-100 px-4 py-3">Nhiều giao dịch</td><td className="border-b border-indigo-100 px-4 py-3">Phí theo Hội nghị</td><td className="border-b border-indigo-100 px-4 py-3">—</td><td className="border-b border-indigo-100 px-4 py-3">—</td><td className="border-b border-indigo-100 px-4 py-3"><button type="button" className="btn btn-primary min-h-8 px-3 py-1" onClick={e => { e.stopPropagation(); setDangMo(item) }}>Mở Hội nghị</button></td></tr>)}</tbody></table></div>{tongTrang > 1 && <nav className="flex flex-wrap gap-2 border-t border-slate-200 p-3" aria-label="Trang theo dõi giao dịch">{Array.from({ length: tongTrang }, (_, i) => i + 1).map(page => <button key={page} type="button" className={`btn min-h-8 min-w-8 px-3 py-1 ${page === trangHopLe ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTrang(page)}>{page}</button>)}</nav>}</section>}
    {dangMo && <dialog ref={dialogRef} aria-label={dangMo.kind === 'hoi_nghi' ? `Hội nghị ${dangMo.hoiNghi.ten}` : `Chi tiết ${dangMo.row.noiDung}`} onCancel={e => { e.preventDefault(); dong() }} className="fixed inset-0 m-auto max-h-[96dvh] w-[calc(100%-1rem)] max-w-7xl overflow-y-auto rounded-3xl border-0 bg-slate-50 p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/60 sm:w-[calc(100%-2rem)]"><div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:px-8"><div><p className="eyebrow text-xs font-bold tracking-widest text-indigo-700">{dangMo.kind === 'hoi_nghi' ? 'HỘI NGHỊ' : 'CHI TIẾT GIAO DỊCH'}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{dangMo.kind === 'hoi_nghi' ? dangMo.hoiNghi.ten : dangMo.row.noiDung}</h2></div><div className="flex gap-2"><div className="flex flex-wrap items-center justify-end gap-2">{dangMo.kind === 'hoi_nghi' && coTheSua && <NutXoaHoiNghi id={dangMo.hoiNghi.id} ten={dangMo.hoiNghi.ten} soGiaoDich={dangMo.hoiNghi.rows.length} tongTien={dangMo.hoiNghi.tongTien} onDaXoa={dong} />}<button type="button" className="btn btn-secondary" onClick={dong}>Đóng</button></div></div></div><div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">{dangMo.kind === 'giao_dich' ? <ChiTietGiaoDich row={dangMo.row} coTheSua={coTheSua} vaiTro={vaiTro} collectors={collectors} donVi={donVi} onClose={dong} /> : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"><div><span className="text-xs font-medium text-slate-500">Ngày Hội nghị</span><p className="mt-1 text-lg font-semibold">{dangMo.hoiNghi.ngay}</p></div><div><span className="text-xs font-medium text-slate-500">Nguồn phí chung</span><p className="mt-1 text-lg font-semibold">{nhanNguon(dangMo.hoiNghi.nguonPhi)}</p></div><div><span className="text-xs font-medium text-slate-500">Tổng phí</span><p className="mt-1 text-lg font-semibold">{vnd.format(dangMo.hoiNghi.tongPhi)}</p></div></div>{coTheSua && <GiaoDichCon hoiNghiId={dangMo.hoiNghi.id} hinhThuc={dangMo.hoiNghi.loaiGiaoDich} ngayHoiNghi={dangMo.hoiNghi.ngay} collectors={collectors} tyLePhiChung={tyLePhiChung} tyLeTheoNguoi={tyLeTheoNguoi} />}{dangMo.hoiNghi.ghiChu && <p className="notice">{dangMo.hoiNghi.ghiChu}</p>}<TaiChungTuHoiNghi hoiNghiId={dangMo.hoiNghi.id} /><h3 className="text-lg font-semibold">Giao dịch con</h3><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500"><th className="p-2">Ngày *</th><th className="p-2">Nội dung</th><th className="p-2">Loại</th><th className="p-2 text-right">Tổng tiền</th><th className="p-2 text-right">Hoàn/thanh toán</th><th className="p-2">Người lấy HĐ</th><th className="p-2 text-right">Phí</th><th className="p-2">HĐ</th><th className="p-2"></th></tr></thead><tbody>{dangMo.hoiNghi.rows.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.ngay}</td><td className="p-2">{row.noiDung}</td><td className="p-2">{row.nhanHinhThuc.nhanNgan}</td><td className="money p-2">{vnd.format(row.tongTien)}</td><td className="money p-2">{vnd.format(row.tienDuocThanhToan ?? 0)}</td><td className="p-2">{row.nguoiLayHdTen ?? '—'}</td><td className="money p-2">{vnd.format(row.phiLayHd)}</td><td className="p-2">{row.kyHieuHd ?? '—'} / {row.soHd ?? '—'}</td><td className="p-2"><button type="button" className="btn btn-secondary min-h-8 px-2 py-1" onClick={() => setDangMo({ kind: 'giao_dich', id: row.id, row })}>Chi tiết</button></td></tr>)}</tbody><tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="p-2" colSpan={3}>Tổng {dangMo.hoiNghi.rows.length} giao dịch con</td><td className="money p-2">{vnd.format(dangMo.hoiNghi.tongTien)}</td><td className="money p-2">{vnd.format(dangMo.hoiNghi.tienDuocThanhToan)}</td><td className="p-2"></td><td className="money p-2">{vnd.format(dangMo.hoiNghi.tongPhi)}</td><td className="p-2" colSpan={2}></td></tr></tfoot></table></div></div>}</div></dialog>}
  </>
}

export type { BoLoc }
