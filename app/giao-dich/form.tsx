'use client'
import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from 'react'
import { themGiaoDich, type KetQua } from './actions'
import { unstable_rethrow } from 'next/navigation'
import { LOAI_HD, LOAI_HD_HOA_DON, TRANG_THAI_HD, TRANG_THAI_PHI } from '@/lib/tai-chinh/danh-muc'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { canDonVi, dsHinhThucThanhToan, HINH_THUC_THANH_TOAN, hinhThucThanhToanMacDinh, NHAN_HINH_THUC_THANH_TOAN, noiDungTheoDonVi, noiDungTheoHinhThuc } from '@/lib/tai-chinh/hinh-thuc'
import { donViMacDinh, type DonViTiepKhach } from '@/lib/tai-chinh/don-vi'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { dongTaiKhoan } from '@/lib/tai-chinh/tai-khoan'
import Link from 'next/link'
import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { VAI_TRO_KY } from '@/lib/tai-chinh/vai-tro-ky'
import { truongPhongTheoNguoi, type LuaChonNguoiKy, type NguoiKyGiay } from '@/lib/tai-chinh/chon-nguoi-ky'
import { loadScript } from '@/app/giay/soan-thao'
import { xemGiayNhap, taiNguoiKyGiay } from './xem-giay-actions'
import { DocHoaDon } from './doc-hoa-don'
import { ChonDonVi } from './chon-don-vi'
import { kiemTraTrungKyHieu } from './trung-ky-hieu-actions'

type BanXem = { script: string; config: Record<string, unknown> }
type TrinhDocEditor = { DocEditor: new (el: string, cfg: Record<string, unknown>) => { destroyEditor: () => void } }

// Khung OnlyOffice chỉ xem: nạp api.js rồi dựng editor vào placeholder. Hủy editor khi
// popup đóng để ngắt kết nối DocumentServer, không giữ tài nguyên của bản nháp.
function KhungXemWord({ viewer }: { viewer: BanXem }) {
  const domId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [loi, setLoi] = useState('')
  const [sanSang, setSanSang] = useState(false)
  useEffect(() => {
    let editor: { destroyEditor: () => void } | undefined
    let huy = false
    const timer = setTimeout(() => { if (!huy) setLoi('Hết thời gian mở Word. Bấm Xem để thử lại.') }, 60000)
    loadScript(viewer.script).then(() => {
      if (huy) return
      const DocsAPI = (window as unknown as { DocsAPI?: TrinhDocEditor }).DocsAPI
      if (!DocsAPI) throw new Error('OnlyOffice chưa sẵn sàng')
      editor = new DocsAPI.DocEditor(domId, { ...viewer.config, events: {
        onDocumentReady: () => { if (!huy) { clearTimeout(timer); setSanSang(true); setLoi('') } },
        onError: () => { if (!huy) { clearTimeout(timer); setLoi('OnlyOffice không mở được Word. Bấm Xem để thử lại.') } },
      } })
    }).catch(() => { if (!huy) { clearTimeout(timer); setLoi('Không tải được OnlyOffice. Kiểm tra kết nối và bấm Xem để thử lại.') } })
    return () => { huy = true; clearTimeout(timer); editor?.destroyEditor() }
  }, [viewer, domId])
  return <div aria-label="Xem trước bản Word" className="my-4 w-full">
    {loi ? <p role="alert" className="notice error">{loi} Giao dịch chưa được lưu.</p> : <p role="status">{sanSang ? 'Bản Word chỉ xem — giao dịch chưa được lưu.' : 'Đang mở bản Word…'}</p>}
    <div className="h-[700px] w-full"><div id={domId} /></div>
  </div>
}

const initial: KetQua = {}
const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

const loaiHdAll = LOAI_HD
const loaiHdInvoiceOnly = LOAI_HD_HOA_DON
const trangThaiHd = TRANG_THAI_HD
const trangThaiPhi = TRANG_THAI_PHI

function idNguoiLayHdHopLe(ds: NguoiLayHdChon[], id?: string | null): string {
  return id && ds.some(c => c.id === id) ? id : ''
}

function defaultValues(mac?: {
  collectors?: NguoiLayHdChon[]
  nguoiLayHdMacDinhId?: string | null
  trangThaiTtPhiMacDinh?: string | null
}): Record<string, string> {
  const today = new Date()
  const ngay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const phi = mac?.trangThaiTtPhiMacDinh
  return {
    ngay, noi_dung: HINH_THUC.TAM_UNG_THEM, don_vi_id: '', hinh_thuc: HINH_THUC.TAM_UNG_THEM,
    trang_thai_hd: 'Hợp lệ', loai_hd: 'Phiếu chi CQ', ky_hieu_hd: '', so_hd: '',
    trang_thai_tt_phi: phi && (TRANG_THAI_PHI as readonly string[]).includes(phi) ? phi : 'Không phát sinh',
    tong_tien: '0', tien_ruou_bia: '0', tam_ung_tu_cq: '0', giao_tien_chi_thuy: '0',
    hoan_ung_tien_mat: '0', phi_lay_hd_ghi_de: '',
    nguoi_lay_hd_id: idNguoiLayHdHopLe(mac?.collectors ?? [], mac?.nguoiLayHdMacDinhId),
    ghi_chu: '',
    // Hoàn tạm ứng chỉ có một hình thức thanh toán nên máy tự điền; hai hình thức còn
    // lại lấy Tiền mặt làm mặc định, người dùng đổi sang chuyển khoản nếu cần.
    hinh_thuc_thanh_toan: hinhThucThanhToanMacDinh(HINH_THUC.TAM_UNG_THEM) ?? '',
  }
}

// Tự động điền loại chứng từ theo hình thức giao dịch
function getAutoLoaiHd(hinhThuc: string): string {
  if (hinhThuc === HINH_THUC.TAM_UNG_THEM) return 'Phiếu chi CQ'
  if (hinhThuc === HINH_THUC.GIAO_CHI_THUY) return 'Giấy biên nhận'
  if (hinhThuc === HINH_THUC.NOP_HOAN_CQ) return 'Giấy nộp tiền'
  return ''
}

function formatMoney(value: string): string {
  const num = value.replace(/\D/g, '')
  if (!num) return ''
  return parseInt(num, 10).toLocaleString('vi-VN')
}

function parseMoney(formatted: string): string {
  return formatted.replace(/\./g, '')
}

export function FormGiaoDich({
  collectors = [],
  donVi = [],
  nguoiLayHdMacDinhId = null,
  trangThaiTtPhiMacDinh = 'Không phát sinh',
}: {
  collectors?: NguoiLayHdChon[]
  donVi?: DonViTiepKhach[]
  // Người lấy hóa đơn mặc định trong Cài đặt: hiện trước trên form thêm giao dịch.
  nguoiLayHdMacDinhId?: string | null
  trangThaiTtPhiMacDinh?: string | null
}) {
  const id = useId()
  const macForm = { collectors, nguoiLayHdMacDinhId, trangThaiTtPhiMacDinh }
  const [values, setValues] = useState(() => defaultValues(macForm))
  const [canhBaoKyHieu, setCanhBaoKyHieu] = useState('')
  const kyHieuDaKiem = useRef('')
  const [donViMoi, setDonViMoi] = useState<DonViTiepKhach[]>([])
  const dsDonVi = useMemo(() => {
    const daCo = new Set(donVi.map(d => d.id))
    return [...donVi, ...donViMoi.filter(d => !daCo.has(d.id))]
  }, [donVi, donViMoi])
  const [canBoGiay, setCanBoGiay] = useState<LuaChonNguoiKy | null>(null)
  const [nguoiKy, setNguoiKy] = useState<NguoiKyGiay | null>(null)
  const [dangTaiNguoiKy, setDangTaiNguoiKy] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [lapGiay, setLapGiay] = useState(false)
  const [moThongTinGiay, setMoThongTinGiay] = useState(false)
  const [viewer, setViewer] = useState<BanXem[] | null>(null)
  const [dangXem, setDangXem] = useState(false)
  const [loiXem, setLoiXem] = useState<string | null>(null)
  const [chonGiay, setChonGiay] = useState<string[]>([])
  const giayDialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (moThongTinGiay && showDialog) giayDialogRef.current?.showModal()
    else giayDialogRef.current?.close()
  }, [moThongTinGiay, showDialog])
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const warningRef = useRef<HTMLDialogElement>(null)
  const [tepHoaDon, setTepHoaDon] = useState<File | null>(null)
  const [canhBao, setCanhBao] = useState<KetQua['canhBao']>()
  useEffect(() => {
    if (canhBao && showDialog) warningRef.current?.showModal()
    else warningRef.current?.close()
  }, [canhBao, showDialog])
  useEffect(() => {
    if (showDialog) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [showDialog])
  const [state, action, pending] = useActionState(async (previous: typeof initial, data: FormData) => {
    try {
      const result = await themGiaoDich(previous, data)
      setCanhBao(result.canhBao)
      if (result.thanhCong) {
        setValues(defaultValues(macForm))
        setCanhBaoKyHieu('')
        kyHieuDaKiem.current = ''
        setTepHoaDon(null)
        setLapGiay(false)
        setMoThongTinGiay(false)
        setChonGiay([])
        setShowDialog(false)
      }
      return result
    } catch (error) {
      unstable_rethrow(error)
      setCanhBao(undefined)
      return { loi: 'Không nhận được phản hồi từ máy chủ. Kiểm tra nhật ký trước khi thử lại để tránh ghi trùng giao dịch.' }
    }
  }, initial)

  const bind = (name: string) => ({
    name, value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const newValue = event.target.value
      if (name === 'hinh_thuc') { setLapGiay(false); setChonGiay([]); setMoThongTinGiay(false) }
      if (name === 'ky_hieu_hd') setCanhBaoKyHieu('')
      setValues((current) => {
        const updated = { ...current, [name]: newValue }
        // Tự động điền loại chứng từ khi đổi hình thức giao dịch
        if (name === 'hinh_thuc') {
          updated.loai_hd = getAutoLoaiHd(newValue) || loaiHdInvoiceOnly[0]
          // Rời khỏi hình thức có đơn vị thì bỏ đơn vị cũ, tránh gắn nhầm vào dòng tiền nội bộ.
          if (!canDonVi(newValue)) updated.don_vi_id = ''
          else if (!updated.don_vi_id) updated.don_vi_id = donViMacDinh(dsDonVi)?.id ?? ''
          const noiDungCoDinh = noiDungTheoHinhThuc(newValue)
          if (noiDungCoDinh) updated.noi_dung = noiDungCoDinh
          // Hình thức thanh toán hợp lệ đổi theo hình thức giao dịch: hoàn tạm ứng chỉ có
          // một lựa chọn, cơ quan trả thẳng và tạm ứng thêm có tiền mặt / chuyển khoản.
          updated.hinh_thuc_thanh_toan = hinhThucThanhToanMacDinh(newValue) ?? ''
          if ((newValue === HINH_THUC.HOAN_TAM_UNG || newValue === HINH_THUC.CQ_TRA_THANG)
            && !updated.nguoi_lay_hd_id) {
            updated.nguoi_lay_hd_id = idNguoiLayHdHopLe(collectors, nguoiLayHdMacDinhId)
          }
        }
        return updated
      })
    },
  })

  const bindMoney = (name: string) => {
    const displayValue = formatMoney(values[name])
    return {
      value: displayValue,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseMoney(event.target.value)
        setValues((current) => ({ ...current, [name]: raw }))
      },
    }
  }

  const hinhThuc = values.hinh_thuc as string
  const needsInvoice = hinhThuc === HINH_THUC.HOAN_TAM_UNG || hinhThuc === HINH_THUC.CQ_TRA_THANG
  const canChonDonVi = canDonVi(hinhThuc)
  const donViDaChon = dsDonVi.find(dv => dv.id === values.don_vi_id)
  const noiDungCoDinh = noiDungTheoHinhThuc(hinhThuc)
  // Nội dung cố định theo hình thức, hoặc sinh từ đơn vị tiếp khách; không điền tay.
  const noiDungHienThi = canChonDonVi
    ? (donViDaChon ? noiDungTheoDonVi(donViDaChon.ten) : '')
    : (noiDungCoDinh ?? values.noi_dung)
  const noiDungChiDoc = Boolean(canChonDonVi || noiDungCoDinh)
  const loaiHdTuDong = getAutoLoaiHd(hinhThuc)
  const loaiHdOptions = loaiHdTuDong ? [loaiHdTuDong] : needsInvoice ? loaiHdInvoiceOnly : loaiHdAll

  // Hình thức thanh toán in trên giấy đề nghị. Danh sách lựa chọn do miền nghiệp vụ
  // quyết định: rỗng là hình thức không lập giấy, một lựa chọn là máy tự điền, hai lựa
  // chọn thì người dùng chọn tiền mặt hay chuyển khoản.
  const dsThanhToan = dsHinhThucThanhToan(hinhThuc)
  const thanhToan = values.hinh_thuc_thanh_toan || hinhThucThanhToanMacDinh(hinhThuc) || ''
  const laChuyenKhoan = thanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
  const nguoiDeNghiIn = canBoGiay?.canBo.find(c => c.id === nguoiKy?.nguoiDeNghiId)
  const dsTaiKhoanIn = nguoiDeNghiIn ? Object.values(canBoGiay?.taiKhoanTheoNguoiLayHd ?? {}).filter(tk => tk.canBoId === nguoiDeNghiIn.id) : []
  const taiKhoanIn = laChuyenKhoan && dsTaiKhoanIn.length === 1 ? { ...dsTaiKhoanIn[0], tenChuTk: nguoiDeNghiIn!.hoTen } : null

  async function xemWord() {
    if (!formRef.current || pending || dangXem || !formRef.current.reportValidity()) return
    const data = new FormData(formRef.current)
    setDangXem(true); setViewer(null); setLoiXem(null); setMoThongTinGiay(true)
    try {
      const bans: BanXem[] = []
      for (const loai of chonGiay) {
        const result = await xemGiayNhap(data, loai)
        if (!result.viewer) throw new Error(result.loi || 'Không mở được bản Word.')
        bans.push(result.viewer)
      }
      setViewer(bans)
    } catch (error) {
      setLoiXem(error instanceof Error ? error.message : 'Không nhận được bản Word. Giao dịch chưa được lưu.')
    } finally { setDangXem(false) }
  }

  function kiemKyHieu(ky: string) {
    const gon = ky.trim()
    if (!gon) { setCanhBaoKyHieu(''); kyHieuDaKiem.current = ''; return }
    if (gon === kyHieuDaKiem.current) return
    kyHieuDaKiem.current = gon
    startTransition(async () => {
      const kq = await kiemTraTrungKyHieu(gon)
      if (kyHieuDaKiem.current === gon) setCanhBaoKyHieu(kq.canhBao ?? '')
    })
  }

  function dienTuHoaDon(deXuat: { ngay?: string; kyHieuHd?: string; soHd?: string; tongTien?: number; tienRuouBia?: number }) {
    setValues(hien => ({
      ...hien,
      ngay: deXuat.ngay || hien.ngay,
      ky_hieu_hd: deXuat.kyHieuHd ?? hien.ky_hieu_hd,
      so_hd: deXuat.soHd ?? hien.so_hd,
      tong_tien: deXuat.tongTien !== undefined ? String(deXuat.tongTien) : hien.tong_tien,
      tien_ruou_bia: deXuat.tienRuouBia !== undefined ? String(deXuat.tienRuouBia) : hien.tien_ruou_bia,
    }))
    if (deXuat.kyHieuHd) kiemKyHieu(deXuat.kyHieuHd)
  }

  function tiepTucHoanUng() {
    if (!canhBao || !formRef.current || pending) return
    if (!formRef.current.reportValidity()) { setCanhBao(undefined); return }
    const data = new FormData(formRef.current)
    data.set('xac_nhan_hoan_tam_ung', '1')
    data.set('fingerprint_hoan_tam_ung', canhBao.fingerprint)
    if (tepHoaDon) data.set('tep_hoa_don', tepHoaDon)
    startTransition(() => action(data))
  }

  return <>
    <button type="button" className="btn btn-primary" onClick={() => {
      setValues(hien => {
        if (!canDonVi(hien.hinh_thuc) || hien.don_vi_id) return hien
        const macDinh = donViMacDinh(dsDonVi)
        return macDinh ? { ...hien, don_vi_id: macDinh.id } : hien
      })
      setShowDialog(true)
    }}>+ Thêm giao dịch</button>

    {!showDialog && state.thanhCong && <div className="space-y-2">
      <p className="notice success" role="status">{state.thanhCong}</p>
      {state.loiGiay && <p className="notice error" role="alert">{state.loiGiay}</p>}
      {state.loiTep && <p className="notice error" role="alert">{state.loiTep}</p>}
      {state.giaoDichId && (state.taiLieuIds?.length || state.loiGiay) && <Link className="btn btn-secondary" href={`/giay/${state.giaoDichId}`}>Mở giấy của giao dịch vừa lưu</Link>}
      {state.giaoDichId && <Link className="btn btn-secondary" href={`/tep/${state.giaoDichId}`}>Mở hồ sơ tệp</Link>}
    </div>}
    {showDialog && <dialog ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { if (pending) event.preventDefault(); else setShowDialog(false) }} className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm">
      <form ref={formRef} aria-busy={pending} onSubmit={event => {
        event.preventDefault()
        if (pending || dangTaiNguoiKy || dangXem) return
        // Dispatch explicitly: React's action-form reset also resets select DOM values
        // on validation/warning responses. Only clear our fields after real success.
        const data = new FormData(event.currentTarget)
        if (tepHoaDon) data.set('tep_hoa_don', tepHoaDon)
        startTransition(() => action(data))
      }} onChange={() => setCanhBao(undefined)}>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-950">Thêm giao dịch</h2>
            <p className="mt-0.5 text-xs text-slate-500">Điền theo chứng từ gốc. Số dư được tính lại ngay sau khi lưu.</p>
          </div>
          <button type="button" disabled={pending} aria-label="Đóng hộp thoại" className="grid size-9 shrink-0 place-items-center rounded-lg text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" onClick={() => setShowDialog(false)}>×</button>
        </header>

        <div className="px-5 py-5 sm:px-7">
          {state.loi && <p className="notice error" role="alert">{state.loi}</p>}
          {state.thanhCong && <p className="notice success" role="status">{state.thanhCong}</p>}
          <fieldset disabled={pending || dangTaiNguoiKy || dangXem} className="m-0 min-w-0 border-0 p-0">

            <section className="form-section">
              <h3>Thông tin chung</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="field">Ngày *<input type="date" required {...bind('ngay')} /></label>
                <label className="field">
                  Hình thức giao dịch *
                  <select required {...bind('hinh_thuc')}>
                    <option value={HINH_THUC.TAM_UNG_THEM}>Tạm ứng thêm</option>
                    <option value={HINH_THUC.GIAO_CHI_THUY}>Giao tiền chị Thúy</option>
                    <option value={HINH_THUC.HOAN_TAM_UNG}>Hoàn tạm ứng</option>
                    <option value={HINH_THUC.CQ_TRA_THANG}>Cơ quan trả thẳng</option>
                    <option value={HINH_THUC.NOP_HOAN_CQ}>Nộp hoàn CQ</option>
                  </select>
                </label>

                {canChonDonVi && (
                  <label className="field sm:col-span-2">
                    Đơn vị tiếp khách *
                    <ChonDonVi
                      ds={dsDonVi}
                      value={values.don_vi_id}
                      required
                      onChange={(idDonVi, ten) => {
                        if (idDonVi && ten && !dsDonVi.some(d => d.id === idDonVi)) {
                          setDonViMoi(hien => [...hien, { id: idDonVi, ten }])
                        }
                        setValues(hien => ({ ...hien, don_vi_id: idDonVi }))
                      }}
                    />
                  </label>
                )}

                <div className="field sm:col-span-2">
                  <label className="flex min-w-0 flex-col gap-2">
                    Nội dung *
                    {noiDungChiDoc
                      ? <input name="noi_dung" value={noiDungHienThi} readOnly required aria-readonly="true" className="cursor-not-allowed bg-slate-100 text-slate-600" />
                      : <input required placeholder="Ví dụ: Tiếp khách đối tác" {...bind('noi_dung')} />}
                  </label>
                  {canChonDonVi && <span className="text-xs font-normal text-slate-500">Tự động theo đơn vị tiếp khách, không sửa được.</span>}
                  {noiDungCoDinh && <span className="text-xs font-normal text-slate-500">Tự điền theo hình thức giao dịch, không cần điền.</span>}
                </div>
              </div>
            </section>

            <section className="form-section">
              <h3>Số tiền</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hinhThuc === HINH_THUC.TAM_UNG_THEM && (
                  <>
                    <label className="field">Tạm ứng từ cơ quan (VND) *<input type="text" required {...bindMoney('tam_ung_tu_cq')} inputMode="numeric" placeholder="0" /></label>
                    <input type="hidden" name="tam_ung_tu_cq" value={values.tam_ung_tu_cq} />
                  </>
                )}

                {hinhThuc === HINH_THUC.GIAO_CHI_THUY && (
                  <>
                    <label className="field">Giao tiền chị Thúy (VND) *<input type="text" required {...bindMoney('giao_tien_chi_thuy')} inputMode="numeric" placeholder="0" /></label>
                    <input type="hidden" name="giao_tien_chi_thuy" value={values.giao_tien_chi_thuy} />
                  </>
                )}

                {needsInvoice && (
                  <>
                    <label className="field">Tổng tiền (VND) *<input type="text" required {...bindMoney('tong_tien')} inputMode="numeric" placeholder="0" /></label>
                    <input type="hidden" name="tong_tien" value={values.tong_tien} />
                    <label className="field">Tiền rượu bia loại trừ (VND)<input type="text" {...bindMoney('tien_ruou_bia')} inputMode="numeric" placeholder="0" /></label>
                    <input type="hidden" name="tien_ruou_bia" value={values.tien_ruou_bia} />
                  </>
                )}

                {hinhThuc === HINH_THUC.NOP_HOAN_CQ && (
                  <>
                    <label className="field">Hoàn tiền mặt cho CQ (VND) *<input type="text" required {...bindMoney('hoan_ung_tien_mat')} inputMode="numeric" placeholder="0" /></label>
                    <input type="hidden" name="hoan_ung_tien_mat" value={values.hoan_ung_tien_mat} />
                  </>
                )}
              </div>
            </section>

            {needsInvoice && (
              <section className="form-section">
                <h3>Hóa đơn &amp; phí lấy hóa đơn</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DocHoaDon onDien={dienTuHoaDon} onTep={setTepHoaDon} tep={tepHoaDon} />
                  <label className="field">Ký hiệu HĐ
                    <input placeholder="VD: 1C26MTT" {...bind('ky_hieu_hd')} onBlur={e => kiemKyHieu(e.target.value)} />
                    {canhBaoKyHieu && <small className="text-amber-800" role="status">{canhBaoKyHieu}</small>}
                  </label>
                  <label className="field">Số HĐ<input placeholder="Số hóa đơn" {...bind('so_hd')} /></label>
                  <label className="field">Trạng thái HĐ<select {...bind('trang_thai_hd')}>{trangThaiHd.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                  <label className="field">Người lấy HĐ<select {...bind('nguoi_lay_hd_id')}><option value="">-- Không có --</option>{collectors.map(c => <option key={c.id} value={c.id}>{c.ten}</option>)}</select></label>
                  <label className="field">Phí ghi đè (VND)<input type="text" {...bindMoney('phi_lay_hd_ghi_de')} inputMode="numeric" placeholder="Để trống nếu dùng tỷ lệ" /></label>
                  <input type="hidden" name="phi_lay_hd_ghi_de" value={values.phi_lay_hd_ghi_de || ''} />
                  <label className="field">Trạng thái thanh toán phí<select {...bind('trang_thai_tt_phi')}>{trangThaiPhi.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                  <label className="field">Loại chứng từ *<select required {...bind('loai_hd')}>{loaiHdOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                </div>
              </section>
            )}

            {!needsInvoice && (
              <section className="form-section">
                <h3>Chứng từ</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="field">Loại chứng từ *<select required {...bind('loai_hd')}>{loaiHdOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                </div>
              </section>
            )}

            {dsThanhToan.length > 0 && (
              <section className="form-section">
                <h3>Hình thức thanh toán</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {dsThanhToan.length === 1 ? (
                    // Hoàn tạm ứng chỉ có một hình thức nên không có gì để chọn; giá trị
                    // vẫn gửi lên qua ô ẩn để giấy in đúng chữ.
                    <div className="field sm:col-span-2">
                      <span>In trên giấy đề nghị</span>
                      <p className="rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700">{NHAN_HINH_THUC_THANH_TOAN[dsThanhToan[0]]}</p>
                      <input type="hidden" name="hinh_thuc_thanh_toan" value={dsThanhToan[0]} />
                      <span className="text-xs font-normal text-slate-500">Máy tự điền theo hình thức giao dịch, không sửa được.</span>
                    </div>
                  ) : (
                    <label className="field sm:col-span-2">
                      In trên giấy đề nghị *
                      <select required {...bind('hinh_thuc_thanh_toan')}>
                        {dsThanhToan.map(v => <option key={v} value={v}>{NHAN_HINH_THUC_THANH_TOAN[v]}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {laChuyenKhoan && (
                  <p className="mt-3 text-xs text-slate-500">
                    {taiKhoanIn
                      ? <>Giấy in kèm tài khoản nhận tiền: <b className="font-semibold text-slate-700">{dongTaiKhoan(taiKhoanIn)}</b></>
                      : <>Chưa có số tài khoản nhận tiền. Bấm Lập giấy đề nghị để chọn người đề nghị. Trong Quản trị, cấu hình ngân hàng, chi nhánh và liên kết đúng cán bộ cho người lấy hóa đơn; mỗi cán bộ chỉ nên có một tài khoản đang hoạt động.</>}
                  </p>
                )}
              </section>
            )}

            {giayChoHinhThuc(hinhThuc).length > 0 && <section className="form-section">
              {!lapGiay && <button type="button" className="btn btn-secondary" disabled={dangTaiNguoiKy} onClick={async () => {
                if (dangTaiNguoiKy) return
                setDangTaiNguoiKy(true); setLoiXem(null)
                try {
                  const kq = await taiNguoiKyGiay()
                  setCanBoGiay(kq); setNguoiKy(kq.macDinh)
                  setChonGiay([...giayChoHinhThuc(hinhThuc)])
                  setLapGiay(true)
                } catch { setLoiXem('Không tải được người ký. Bấm Lập giấy đề nghị để thử lại.') }
                finally { setDangTaiNguoiKy(false) }
              }}>{dangTaiNguoiKy ? 'Đang tải người ký…' : 'Lập giấy đề nghị'}</button>}
              {lapGiay && canBoGiay && nguoiKy && <div aria-labelledby={`${id}-thong-tin-giay`}>
                <h3 id={`${id}-thong-tin-giay`}>Thông tin giấy đề nghị</h3>
                <input type="hidden" name="lap_giay" value="1" />
                {chonGiay.map(loai => <input key={loai} type="hidden" name="loai_giay" value={loai} />)}
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...VAI_TRO_KY].sort((a, b) => Number(a.id === 'truongPhongId') - Number(b.id === 'truongPhongId')).map(vai => <label key={vai.id} className="field">{vai.ten}
                    <select name={`giay_${vai.id}`} value={nguoiKy[vai.id]} required={vai.id === 'nguoiDeNghiId'} onChange={event => {
                      const value = event.target.value
                      setNguoiKy(current => current && ({ ...current, [vai.id]: value,
                        ...(vai.id === 'nguoiDeNghiId' ? { truongPhongId: truongPhongTheoNguoi(canBoGiay.canBo.find(cb => cb.id === value), canBoGiay.canBo, canBoGiay.macDinh.truongPhongId) } : {}),
                      }))
                      setLoiXem(null)
                    }}>
                      <option value="">— Chưa chọn —</option>
                      {canBoGiay.canBo.map(cb => <option key={cb.id} value={cb.id}>{cb.hoTen}{cb.phong ? ` — ${cb.phong}` : ''}</option>)}
                    </select>
                  </label>)}
                </div>
                <button type="button" className="btn btn-secondary mt-4" disabled={pending || dangXem} onClick={xemWord}>{dangXem ? 'Đang dựng Word…' : 'Xem'}</button>
              </div>}
              {loiXem && !moThongTinGiay && <p role="alert" className="notice error">{loiXem}</p>}
            </section>}

            <section className="form-section">
              <h3>Ghi chú</h3>
              <label className="field">Thông tin bổ sung<textarea rows={2} placeholder="Tùy chọn" {...bind('ghi_chu')}></textarea></label>
            </section>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDialog(false)}>Hủy</button>
              <button type="submit" disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu giao dịch'}</button>
            </div>
          </fieldset>
        </div>
      </form>
    </dialog>}
    {showDialog && moThongTinGiay && <dialog ref={giayDialogRef} aria-labelledby={`${id}-giay-title`} onCancel={event => { if (dangXem) event.preventDefault(); else { setMoThongTinGiay(false); setViewer(null) } }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50">
      <h2 id={`${id}-giay-title`} className="text-xl font-semibold">Xem giấy đề nghị</h2>
      {dangXem && <p role="status">Đang dựng Word…</p>}
      {loiXem && <p role="alert" className="notice error">{loiXem}</p>}
      {viewer?.map(ban => <KhungXemWord key={String((ban.config.document as { key: string }).key)} viewer={ban} />)}
      <div className="mt-5 flex justify-end">
        <button type="button" className="btn btn-secondary" disabled={dangXem} onClick={() => { setMoThongTinGiay(false); setViewer(null) }}>Đóng</button>
      </div>
    </dialog>}
    {showDialog && canhBao && <dialog ref={warningRef} aria-labelledby={`${id}-warning-title`} aria-describedby={`${id}-warning-description`} onCancel={event => { if (pending) event.preventDefault(); else setCanhBao(undefined) }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/50">
      <h2 id={`${id}-warning-title`} className="text-xl font-semibold text-amber-900">Hoàn ứng vượt dư lý thuyết</h2>
      <p id={`${id}-warning-description`} className="mt-3 text-sm text-slate-600">Giao dịch chưa được lưu. Khoản hoàn ứng lớn hơn số dư tại thời điểm ghi nhận giao dịch. Bạn có muốn tiếp tục không?</p>
      <dl className="my-5 space-y-3 rounded-xl bg-amber-50 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><dt>Dư lý thuyết trước giao dịch</dt><dd className="font-semibold tabular-nums">{vnd.format(canhBao.duLyThuyet)}</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt>Số tiền hoàn ứng</dt><dd className="font-semibold tabular-nums">{vnd.format(canhBao.hoanTamUng)}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-amber-200 pt-3"><dt>Số tiền vượt dư</dt><dd className="font-semibold tabular-nums text-red-700">{vnd.format(canhBao.thieu)}</dd></div>
      </dl>
      <p className="mb-4 text-xs text-slate-500">Máy chủ sẽ kiểm tra lại số dư trước khi lưu. Nếu số liệu thay đổi, bạn sẽ cần xác nhận lại.</p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus disabled={pending} className="btn btn-secondary" onClick={() => setCanhBao(undefined)}>Quay lại chỉnh sửa</button>
        <button type="button" disabled={pending} className="btn btn-primary" onClick={tiepTucHoanUng}>{pending ? 'Đang kiểm tra…' : 'Tiếp tục lưu'}</button>
      </div>
    </dialog>}
  </>
}
