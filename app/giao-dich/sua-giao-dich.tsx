'use client'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { suaGiaoDich, type KetQua } from './actions'
import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { dsHinhThucThanhToan, NHAN_HINH_THUC_THANH_TOAN } from '@/lib/tai-chinh/hinh-thuc'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { NHOM_SUA, giaTriHienTai, truongSuaCho, type TruongSua } from '@/lib/tai-chinh/sua-giao-dich'

const initial: KetQua = {}
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

function formatTien(giaTri: string): string {
  const so = giaTri.replace(/\D/g, '')
  return so ? Number(so).toLocaleString('vi-VN') : ''
}

export function SuaGiaoDich({ row, collectors, donVi, vaiTro }: {
  row: GiaoDichTinh
  collectors: NguoiLayHdChon[]
  donVi: Array<{ id: string; ten: string }>
  vaiTro: string
}) {
  const id = useId()
  const [mo, setMo] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const truongChoPhep = truongSuaCho(vaiTro, row.hinhThuc)
  const [truongId, setTruongId] = useState(() => truongChoPhep[0]?.id ?? '')
  const truong = truongChoPhep.find(t => t.id === truongId)
  const [giaTri, setGiaTri] = useState(() => truong ? giaTriHienTai(row, truong.id) : '')

  useEffect(() => {
    if (mo) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [mo])

  const [state, action, pending] = useActionState(async (previous: typeof initial, data: FormData) => {
    try {
      return await suaGiaoDich(previous, data)
    } catch (error) {
      unstable_rethrow(error)
      return { loi: 'Không nhận được phản hồi từ máy chủ. Kiểm tra nhật ký trước khi thử lại.' }
    }
  }, initial)

  useEffect(() => { if (state.thanhCong) setMo(false) }, [state.thanhCong])

  function moHopThoai() {
    const dau = truongChoPhep[0]
    setTruongId(dau?.id ?? '')
    setGiaTri(dau ? giaTriHienTai(row, dau.id) : '')
    setMo(true)
  }
  function doiTruong(maMoi: string) {
    setTruongId(maMoi)
    setGiaTri(giaTriHienTai(row, maMoi))
  }
  const nhom = truong ? NHOM_SUA.find(n => n.id === truong.nhom) : undefined

  function oNhap(t: TruongSua) {
    const chung = { id: `${id}-gia-tri`, name: 'gia_tri', value: giaTri, disabled: pending, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setGiaTri(event.target.value) }
    if (t.kieu === 'lua-chon') {
      const luaChon = t.id === 'nguoi_lay_hd_id' ? collectors.map(c => ({ value: c.id, nhan: c.ten }))
        : t.id === 'don_vi_id' ? donVi.map(dv => ({ value: dv.id, nhan: dv.ten }))
          // Chỉ hiện những hình thức thanh toán mà hình thức giao dịch này dùng được, và
          // in bằng nhãn tiếng Việt chứ không phải mã lưu trong cơ sở dữ liệu.
          : t.id === 'hinh_thuc_thanh_toan' ? dsHinhThucThanhToan(row.hinhThuc).map(v => ({ value: v, nhan: NHAN_HINH_THUC_THANH_TOAN[v] }))
            : (t.luaChon ?? []).map(v => ({ value: v, nhan: v }))
      return <select {...chung}>
        {t.choPhepRong && <option value="">{t.id === 'don_vi_id' ? '-- Chọn đơn vị --' : '-- Không có --'}</option>}
        {luaChon.map(o => <option key={o.value} value={o.value}>{o.nhan}</option>)}
      </select>
    }
    if (t.kieu === 'tien') {
      // Ô hiển thị có dấu phân cách nghìn, còn giá trị gửi lên là chuỗi số thô ở ô ẩn.
      return <>
        <input id={`${id}-gia-tri`} type="text" inputMode="numeric" placeholder="0" disabled={pending}
          value={formatTien(giaTri)} onChange={event => setGiaTri(event.target.value.replace(/\D/g, ''))} />
        <input type="hidden" name="gia_tri" value={giaTri} />
      </>
    }
    if (t.kieu === 'ngay') {
      return <input {...chung} type="date" required />
    }
    return <input {...chung} type="text" maxLength={t.max} />
  }

  const laTienAnhHuong = truong?.kieu === 'tien' && ['tong_tien', 'tien_ruou_bia', 'phi_lay_hd_ghi_de', 'hoan_ung_tien_mat'].includes(truong.id)
  const laNgayAnhHuong = truong?.id === 'ngay'

  return <>
    <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={moHopThoai}>Sửa</button>
    {mo && <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { if (pending) event.preventDefault(); else setMo(false) }} className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-950">Sửa giao dịch</h2>
          <p className="mt-1 text-xs text-slate-500">{row.ngay} · {row.hinhThuc} · {vnd.format(row.tongTien)}</p>
        </div>
        <button type="button" disabled={pending} aria-label="Đóng hộp thoại" className="grid size-9 shrink-0 place-items-center rounded-lg text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" onClick={() => setMo(false)}>×</button>
      </header>

      {state.loi && <p className="notice error" role="alert">{state.loi}</p>}

      <form action={action}>
        <input type="hidden" name="id" value={row.id} />
        <label className="field mb-4">
          Trường cần sửa
          <select name="truong" value={truongId} disabled={pending} onChange={event => doiTruong(event.target.value)} required>
            {NHOM_SUA.map(n => {
              const trongNhom = truongChoPhep.filter(t => t.nhom === n.id)
              if (!trongNhom.length) return null
              return <optgroup key={n.id} label={n.ten}>
                {trongNhom.map(t => <option key={t.id} value={t.id}>{t.ten}</option>)}
              </optgroup>
            })}
          </select>
        </label>

        <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Mỗi lần lưu chỉ đổi được <strong>một</strong> trường, vì các trường trong cùng một nhóm cùng đổ vào một chuỗi tính toán.
          {nhom && <> Nhóm <strong>{nhom.ten}</strong>: {nhom.moTa}</>}
          {vaiTro !== 'admin' && <> Vai trò của bạn chỉ sửa được ngày phát sinh, chứng từ, đơn vị và ghi chú.</>}
        </p>

        {truong && <label className="field mb-4">
          {truong.ten}
          {oNhap(truong)}
          {truong.goiY && <span className="text-xs font-normal text-slate-500">{truong.goiY}</span>}
          <span className="text-xs font-normal text-slate-500">Giá trị hiện tại: <strong>{giaTriHienTai(row, truong.id) || '—'}</strong></span>
        </label>}

        {laTienAnhHuong && <p className="notice" role="status">Số dư lý thuyết, dư thực tế và đang cầm của mọi dòng sau giao dịch này sẽ được tính lại.</p>}
        {laNgayAnhHuong && <p className="notice" role="status">Đổi ngày sẽ chuyển giao dịch tới cuối ngày mới. Số dư lý thuyết, dư thực tế và đang cầm của mọi dòng liên quan sẽ được tính lại.</p>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setMo(false)}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={pending || !truong}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>
      </form>
    </dialog>}
  </>
}
