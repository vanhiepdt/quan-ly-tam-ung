'use client'
import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { suaGiaoDich, suaThongTinGiayGiaoDich, type KetQua } from './actions'
import { HINH_THUC, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { canDonVi, dsHinhThucThanhToan, NHAN_HINH_THUC_THANH_TOAN } from '@/lib/tai-chinh/hinh-thuc'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { NHOM_SUA, giaTriHienTai, truongSuaCho, type TruongSua } from '@/lib/tai-chinh/sua-giao-dich'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { taiNguoiKyGiay } from './xem-giay-actions'
import { truongPhongTheoNguoi, type LuaChonNguoiKy, type NguoiKyGiay } from '@/lib/tai-chinh/chon-nguoi-ky'
import { VAI_TRO_KY, type VaiTroKyId } from '@/lib/tai-chinh/vai-tro-ky'

const initial: KetQua = {}
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

function formatTien(giaTri: string): string {
  const so = giaTri.replace(/\D/g, '')
  return so ? Number(so).toLocaleString('vi-VN') : ''
}

const VAI_TRO_HIEN_THI = [...VAI_TRO_KY].sort((a, b) => Number(a.id === 'truongPhongId') - Number(b.id === 'truongPhongId'))

function nguoiKyCuaGiaoDich(row: GiaoDichTinh, macDinh: NguoiKyGiay): NguoiKyGiay {
  return Object.fromEntries(VAI_TRO_KY.map(vai => {
    const daLuu = row[vai.id]
    return [vai.id, row.thongTinGiayDaChot ? daLuu ?? '' : daLuu ?? macDinh[vai.id]]
  })) as NguoiKyGiay
}

type CheDoSua = 'giao_dich' | 'thong_tin_giay'

export function SuaGiaoDich({ row, collectors, donVi, vaiTro }: {
  row: GiaoDichTinh
  collectors: NguoiLayHdChon[]
  donVi: Array<{ id: string; ten: string }>
  vaiTro: string
}) {
  const id = useId()
  const [mo, setMo] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const yeuCauTaiNguoiKy = useRef(0)
  const coThongTinGiay = giayChoHinhThuc(row.hinhThuc).length > 0
  const [cheDo, setCheDo] = useState<CheDoSua>('giao_dich')
  const [dangTaiNguoiKy, setDangTaiNguoiKy] = useState(false)
  const [loiTaiNguoiKy, setLoiTaiNguoiKy] = useState('')
  const [daGuiThongTinGiay, setDaGuiThongTinGiay] = useState(false)
  const [luaChonNguoiKy, setLuaChonNguoiKy] = useState<LuaChonNguoiKy | null>(null)
  const [nguoiKy, setNguoiKy] = useState<NguoiKyGiay | null>(null)
  const truongChoPhep = truongSuaCho(vaiTro, row.hinhThuc)
  const [truongId, setTruongId] = useState(() => truongChoPhep[0]?.id ?? '')
  const truong = truongChoPhep.find(t => t.id === truongId)
  const [giaTri, setGiaTri] = useState(() => truong ? giaTriHienTai(row, truong.id) : '')
  const [donViMoi, setDonViMoi] = useState(row.donViId ?? '')

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
  const [stateThongTinGiay, actionThongTinGiay, dangLuuThongTinGiay] = useActionState(async (previous: typeof initial, data: FormData) => {
    try {
      return await suaThongTinGiayGiaoDich(previous, data)
    } catch (error) {
      unstable_rethrow(error)
      return { loi: 'Không nhận được phản hồi từ máy chủ. Kiểm tra nhật ký trước khi thử lại.' }
    }
  }, initial)
  const dangLuu = pending || dangLuuThongTinGiay

  useEffect(() => {
    if (state.thanhCong || stateThongTinGiay.thanhCong) {
      yeuCauTaiNguoiKy.current++
      setMo(false)
    }
  }, [state.thanhCong, stateThongTinGiay.thanhCong])

  function dong() {
    if (dangLuu || dangTaiNguoiKy) return
    yeuCauTaiNguoiKy.current++
    setMo(false)
    setCheDo('giao_dich')
    setDangTaiNguoiKy(false)
    setLoiTaiNguoiKy('')
    setDaGuiThongTinGiay(false)
    setLuaChonNguoiKy(null)
    setNguoiKy(null)
  }
  function moHopThoai() {
    const dau = truongChoPhep[0]
    yeuCauTaiNguoiKy.current++
    setTruongId(dau?.id ?? '')
    setGiaTri(dau ? giaTriHienTai(row, dau.id) : '')
    setDonViMoi(row.donViId ?? '')
    setCheDo('giao_dich')
    setDangTaiNguoiKy(false)
    setLoiTaiNguoiKy('')
    setDaGuiThongTinGiay(false)
    setLuaChonNguoiKy(null)
    setNguoiKy(null)
    setMo(true)
  }
  function chonThongTinGiaoDich() {
    if (dangLuu) return
    yeuCauTaiNguoiKy.current++
    setDangTaiNguoiKy(false)
    setLoiTaiNguoiKy('')
    setCheDo('giao_dich')
  }
  async function chonThongTinGiay() {
    if (dangLuu) return
    setCheDo('thong_tin_giay')
    if (luaChonNguoiKy && nguoiKy) return
    const yeuCau = ++yeuCauTaiNguoiKy.current
    setDangTaiNguoiKy(true)
    setLoiTaiNguoiKy('')
    setDaGuiThongTinGiay(false)
    try {
      const ketQua = await taiNguoiKyGiay()
      if (yeuCau !== yeuCauTaiNguoiKy.current) return
      setLuaChonNguoiKy(ketQua)
      setNguoiKy(nguoiKyCuaGiaoDich(row, ketQua.macDinh))
    } catch {
      if (yeuCau === yeuCauTaiNguoiKy.current) setLoiTaiNguoiKy('Không tải được danh sách người ký. Vui lòng thử lại.')
    } finally {
      if (yeuCau === yeuCauTaiNguoiKy.current) setDangTaiNguoiKy(false)
    }
  }
  function doiNguoiKy(vaiId: VaiTroKyId, value: string) {
    setNguoiKy(hienTai => {
      if (!hienTai || !luaChonNguoiKy) return hienTai
      const moi = { ...hienTai, [vaiId]: value }
      if (vaiId === 'nguoiDeNghiId') {
        moi.truongPhongId = truongPhongTheoNguoi(
          luaChonNguoiKy.canBo.find(cb => cb.id === value), luaChonNguoiKy.canBo, luaChonNguoiKy.macDinh.truongPhongId,
        )
      }
      return moi
    })
  }
  function doiTruong(maMoi: string) {
    setTruongId(maMoi)
    setGiaTri(giaTriHienTai(row, maMoi))
    if (maMoi === 'hinh_thuc') setDonViMoi(row.donViId ?? '')
  }
  const nhom = truong ? NHOM_SUA.find(n => n.id === truong.nhom) : undefined

  function oNhap(t: TruongSua) {
    const chung = { id: `${id}-gia-tri`, name: 'gia_tri', value: giaTri, disabled: pending, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setGiaTri(event.target.value) }
    if (t.id === 'lam_tron_xuong_hang_nghin' || t.id === 'chi_thuc_te') {
      return <>
        <input type="hidden" name="gia_tri" value={giaTri === '1' ? '1' : '0'} />
        <span className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
          <input id={`${id}-gia-tri`} type="checkbox" className="size-4 accent-indigo-600" checked={giaTri === '1'} disabled={pending}
            onChange={event => setGiaTri(event.target.checked ? '1' : '0')} />
          <span>{t.ten}</span>
        </span>
      </>
    }
    if (t.kieu === 'lua-chon') {
      const luaChon = t.id === 'nguoi_lay_hd_id' ? collectors.map(c => ({ value: c.id, nhan: c.ten }))
        : t.id === 'don_vi_id' ? donVi.map(dv => ({ value: dv.id, nhan: dv.ten }))
          // Chỉ hiện những hình thức thanh toán mà hình thức giao dịch này dùng được, và
          // in bằng nhãn tiếng Việt chứ không phải mã lưu trong cơ sở dữ liệu.
          : t.id === 'hinh_thuc_thanh_toan' ? dsHinhThucThanhToan(row.hinhThuc).map(v => ({ value: v, nhan: NHAN_HINH_THUC_THANH_TOAN[v] }))
            : (t.luaChon ?? []).map(v => ({ value: v, nhan: t.nhanLuaChon?.[v] ?? v }))
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

  const laTienTamUngAnhHuong = (truong?.kieu === 'tien' && ['tong_tien', 'tien_ruou_bia', 'tien_duoc_thanh_toan', 'phi_lay_hd_ghi_de', 'giao_tien_chi_thuy', 'hoan_ung_tien_mat'].includes(truong.id))
    || ['lam_tron_xuong_hang_nghin', 'co_so_tinh_phi_lay_hd'].includes(truong?.id ?? '')
  const laTienCqAnhHuong = truong?.id === 'dua_tien_cq_tra_thang_cho_chi_thuy'
  const laNgayAnhHuong = truong?.id === 'ngay' || truong?.id === 'ngay_de_nghi'
  const loiThongTinGiay = loiTaiNguoiKy || (daGuiThongTinGiay ? stateThongTinGiay.loi : undefined)
  const giaoDichPanel = `${id}-giao-dich`
  const thongTinGiayPanel = `${id}-thong-tin-giay`

  return <>
    <button type="button" className="btn btn-secondary min-h-8 px-3 py-1" onClick={moHopThoai}>Sửa</button>
    {mo && <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { if (dangLuu || dangTaiNguoiKy) event.preventDefault(); else dong() }} className={`fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm`}>
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-950">Sửa giao dịch</h2>
          <p className="mt-1 text-xs text-slate-500">{row.ngay} · {row.hinhThuc} · {vnd.format(row.tongTien)}</p>
        </div>
        <button type="button" disabled={dangLuu || dangTaiNguoiKy} aria-label="Đóng hộp thoại" className="grid size-9 shrink-0 place-items-center rounded-lg text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" onClick={dong}>×</button>
      </header>

      {coThongTinGiay && <div className="mb-5 flex border-b border-slate-200" role="tablist" aria-label="Nội dung sửa giao dịch">
        <button id={`${id}-giao-dich-tab`} type="button" role="tab" aria-controls={giaoDichPanel} aria-selected={cheDo === 'giao_dich'} disabled={dangLuu}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${cheDo === 'giao_dich' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          onClick={chonThongTinGiaoDich}>Thông tin giao dịch</button>
        <button id={`${id}-thong-tin-giay-tab`} type="button" role="tab" aria-controls={thongTinGiayPanel} aria-selected={cheDo === 'thong_tin_giay'} disabled={dangLuu}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${cheDo === 'thong_tin_giay' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
          onClick={() => void chonThongTinGiay()}>Thông tin giấy đề nghị</button>
      </div>}

      {cheDo === 'giao_dich' && <section id={giaoDichPanel} role="tabpanel"
        aria-labelledby={coThongTinGiay ? `${id}-giao-dich-tab` : undefined}
        aria-label={coThongTinGiay ? undefined : 'Thông tin giao dịch'}>
      {state.loi && <p className="notice error" role="alert">{state.loi}</p>}

      <form aria-busy={pending} onSubmit={event => {
        event.preventDefault()
        if (pending) return
        // Giữ nguyên lựa chọn trên form khi máy chủ trả lỗi, tránh reset checkbox.
        const data = new FormData(event.currentTarget)
        startTransition(() => action(data))
      }}>
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
          <span className="text-xs font-normal text-slate-500">Giá trị hiện tại: <strong>{truong.nhanLuaChon?.[giaTriHienTai(row, truong.id)] ?? (giaTriHienTai(row, truong.id) || '—')}</strong></span>
        </label>}

        {truong?.id === 'hinh_thuc' && canDonVi(giaTri) && <label className="field mb-4">
          Đơn vị tiếp khách cho hình thức mới *
          <select name="don_vi_moi" value={donViMoi} onChange={event => setDonViMoi(event.target.value)} required disabled={pending}>
            <option value="">-- Chọn đơn vị --</option>
            {donVi.map(dv => <option key={dv.id} value={dv.id}>{dv.ten}</option>)}
          </select>
          <span className="text-xs font-normal text-slate-500">Đổi từ giao dịch nội bộ sang hình thức có hóa đơn thì phải chọn đơn vị.</span>
        </label>}

        {truong?.id === 'chi_thuc_te' && <p className="notice" role="status">{row.hinhThuc === HINH_THUC.HOAN_TAM_UNG
          ? 'Với Hoàn tạm ứng hợp lệ có Chi thực tế, hai số dư TƯ được cộng dồn riêng từ dòng trước và cùng trừ toàn bộ Tổng tiền. Phí HĐ trừ vào dư thực tế, còn phần phát sinh đang cầm cộng lại phí của dòng này. Chênh lệch các dòng trước được giữ nguyên. Dư TƯ lý thuyết vẫn trừ Tiền được hoàn/thanh toán.'
          : 'Khi tích Chi thực tế, dư tiền CQ trả thẳng chỉ trừ tiền không được thanh toán, không cộng tiền được hoàn/thanh toán.'}</p>}
        {laTienTamUngAnhHuong && <p className="notice" role="status">Dư TƯ lý thuyết, dư TƯ thực tế và dư TƯ đang cầm của mọi dòng sau giao dịch này sẽ được tính lại.</p>}
        {laTienCqAnhHuong && <p className="notice" role="status">Dư tiền CQ trả thẳng và dư Hiệp đang cầm của mọi dòng sau giao dịch này sẽ được tính lại.</p>}
        {laNgayAnhHuong && <p className="notice" role="status">Đổi ngày sẽ chuyển giao dịch tới cuối ngày mới. Các số dư TƯ, dư tiền CQ trả thẳng và dư Hiệp đang cầm của mọi dòng liên quan sẽ được tính lại.</p>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={dong}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={pending || !truong}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </div>
      </form>
      </section>}

      {cheDo === 'thong_tin_giay' && <section id={thongTinGiayPanel} role="tabpanel" aria-labelledby={`${id}-thong-tin-giay-tab`}>
        {dangTaiNguoiKy && <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải người ký…</p>}
        {!dangTaiNguoiKy && loiThongTinGiay && <p className="notice error" role="alert">{loiThongTinGiay}</p>}
        {!dangTaiNguoiKy && luaChonNguoiKy && nguoiKy && <form action={actionThongTinGiay} onSubmit={() => setDaGuiThongTinGiay(true)}>
          <input type="hidden" name="id" value={row.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            {VAI_TRO_HIEN_THI.map(vai => <label key={vai.id} className="field">{vai.ten}
              <select name={`giay_${vai.id}`} value={nguoiKy[vai.id]} required={vai.id === 'nguoiDeNghiId'} disabled={dangLuuThongTinGiay}
                onChange={event => doiNguoiKy(vai.id, event.target.value)}>
                <option value="">— Chưa chọn —</option>
                {luaChonNguoiKy.canBo.map(cb => <option key={cb.id} value={cb.id}>{cb.hoTen}{cb.phong ? ` — ${cb.phong}` : ''}</option>)}
              </select>
            </label>)}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" disabled={dangLuuThongTinGiay} onClick={dong}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={dangLuuThongTinGiay}>{dangLuuThongTinGiay ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </div>
        </form>}
      </section>}
    </dialog>}
  </>
}
