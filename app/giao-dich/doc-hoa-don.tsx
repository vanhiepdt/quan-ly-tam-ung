'use client'

import { useEffect, useRef, useState } from 'react'
import { docHoaDon, tinhTrangAiHoaDon, type TinhTrangAi } from './doc-hoa-don-actions'
import type { DuLieuDocTuHoaDon, KetQuaDocHoaDon, PhatHien } from '@/lib/kiem-tra/giao-dien'
import { bangDoiChieuNguoiMua, type HangDoiChieu, type OCotDoiChieu } from '@/lib/kiem-tra/bang-doi-chieu'
import { nhanLoaiHoaDon, tienDongSauThue } from '@/lib/kiem-tra/loai-hoa-don'
import { hienThiMst } from '@/lib/kiem-tra/qr-hoa-don'

const vnd = new Intl.NumberFormat('vi-VN')

const BUOC_TIEN_TRINH = [
  { den: 12, chu: 'Đã nhận tệp, đang gửi lên máy chủ…' },
  { den: 28, chu: 'Đang dựng trang PDF và quét mã QR hóa đơn…' },
  { den: 46, chu: 'Đang đọc chữ trên hóa đơn (OCR)…' },
  { den: 70, chu: 'Đang nhờ AI đọc người mua, địa chỉ, dòng hàng và rượu bia…' },
  { den: 88, chu: 'Đang đối chiếu QR, OCR và AI (tên, MST, địa chỉ)…' },
] as const

function mauPhatHien(muc: PhatHien['muc']) {
  if (muc === 'loi') return 'notice error'
  if (muc === 'canh_bao') return 'notice bg-amber-50 text-amber-900'
  return 'notice success'
}

function dongThongTin(nhan: string, giaTri?: string | number) {
  if (giaTri === undefined || giaTri === '') return null
  const chu = typeof giaTri === 'number' ? `${vnd.format(giaTri)}đ` : giaTri
  return <p><span className="text-slate-500">{nhan}: </span><b className="font-semibold text-slate-800">{chu}</b></p>
}

export function DocHoaDon({
  onDien, onTep, tep,
}: {
  onDien: (deXuat: DuLieuDocTuHoaDon) => void
  onTep?: (file: File | null) => void
  tep?: File | null
}) {
  const [dangDoc, setDangDoc] = useState(false)
  const [phanTram, setPhanTram] = useState(0)
  const [buoc, setBuoc] = useState('')
  const [loi, setLoi] = useState('')
  const [ketQua, setKetQua] = useState<KetQuaDocHoaDon | null>(null)
  const [tinhTrangAi, setTinhTrangAi] = useState<TinhTrangAi | null>(null)
  const huyTienTrinh = useRef<ReturnType<typeof setInterval> | null>(null)

  function dungTienTrinh() {
    if (huyTienTrinh.current) {
      clearInterval(huyTienTrinh.current)
      huyTienTrinh.current = null
    }
  }

  function chayTienTrinh() {
    dungTienTrinh()
    let giaTri = 4
    let buocHien = 0
    setPhanTram(giaTri)
    setBuoc(BUOC_TIEN_TRINH[0].chu)
    huyTienTrinh.current = setInterval(() => {
      const moc = BUOC_TIEN_TRINH[buocHien]
      if (giaTri < moc.den) {
        giaTri = Math.min(moc.den, giaTri + (buocHien === 0 ? 3 : 1))
        setPhanTram(giaTri)
        return
      }
      if (buocHien < BUOC_TIEN_TRINH.length - 1) {
        buocHien += 1
        setBuoc(BUOC_TIEN_TRINH[buocHien].chu)
        return
      }
      giaTri = Math.min(96, giaTri + 0.4)
      setPhanTram(Math.floor(giaTri))
    }, 280)
  }

  useEffect(() => () => dungTienTrinh(), [])

  useEffect(() => {
    let huy = false
    tinhTrangAiHoaDon().then(t => { if (!huy) setTinhTrangAi(t) }).catch(() => {
      if (!huy) setTinhTrangAi({
        muc: 'loi', nha: '', moHinh: '', docAnh: false,
        thongDiep: 'Không kiểm tra được lớp AI. Có thể chỉ dùng QR và OCR.',
      })
    })
    return () => { huy = true }
  }, [])

  async function doc(event: React.ChangeEvent<HTMLInputElement>) {
    const tep = event.target.files?.[0]
    event.target.value = ''
    if (!tep || dangDoc) return
    const tt = tinhTrangAi
    if (tt && tt.muc !== 'ok') {
      const cau = tt.muc === 'loi'
        ? `${tt.thongDiep}\n\nVẫn đọc hóa đơn bằng QR và OCR (không có lớp AI)?`
        : `${tt.thongDiep}\n\nVẫn tiếp tục đọc hóa đơn?`
      if (!window.confirm(cau)) return
    }
    onTep?.(tep)
    setDangDoc(true)
    setLoi('')
    setKetQua(null)
    chayTienTrinh()
    try {
      const data = new FormData()
      data.set('tep', tep)
      const kq = await docHoaDon(data)
      dungTienTrinh()
      setPhanTram(100)
      setBuoc(kq.loi ? 'Không đọc được hóa đơn.' : 'Đã đọc xong, đang hiện kết quả…')
      if (kq.loi) { setLoi(kq.loi); return }
      if (!kq.deXuat || !kq.phatHien || !kq.trangThai) {
        setLoi('Không đọc được hóa đơn. Hãy thử ảnh rõ hơn hoặc nhập tay.')
        return
      }
      const hopLe: KetQuaDocHoaDon = {
        trangThai: kq.trangThai, deXuat: kq.deXuat, qr: kq.qr ?? null, ocr: kq.ocr ?? null, ai: kq.ai ?? null, phatHien: kq.phatHien, nhatKy: kq.nhatKy,
      }
      setKetQua(hopLe)
      onDien(hopLe.deXuat)
    } catch {
      dungTienTrinh()
      setPhanTram(100)
      setBuoc('Không gửi được tệp.')
      setLoi('Không gửi được tệp. Kiểm tra kết nối rồi thử lại.')
    } finally {
      setDangDoc(false)
    }
  }

  return <div className="sm:col-span-2">
    {!tinhTrangAi && <p className="notice" role="status">Đang kiểm tra lớp AI trước khi đọc hóa đơn…</p>}
    {tinhTrangAi && tinhTrangAi.muc !== 'ok' && (
      <p className={tinhTrangAi.muc === 'loi' ? 'notice error' : 'notice bg-amber-50 text-amber-900'} role="status">
        {tinhTrangAi.thongDiep}
      </p>
    )}
    {tinhTrangAi?.muc === 'ok' && (
      <p className="notice success" role="status">{tinhTrangAi.thongDiep}</p>
    )}
    <label className="field">
      Đọc từ hóa đơn
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={dangDoc || !tinhTrangAi} onChange={doc} />
      <small className="font-normal text-slate-500">
        PDF hoặc ảnh, tối đa 10 MB. File này được giữ trong hồ sơ giao dịch khi lưu. QR khóa số hóa đơn; OCR đọc chữ trên trang (tên, MST, địa chỉ người mua); AI đối chiếu. Cần ít nhất hai lớp. Chỉ là đề xuất, hãy soát rồi lưu.
      </small>
    </label>
    {tep && <p className="mt-2 text-sm text-slate-600" role="status">
      Sẽ giữ file <b className="font-semibold text-slate-800">{tep.name}</b> khi lưu giao dịch.
      {onTep && <button type="button" className="ml-2 text-indigo-700 underline" onClick={() => onTep(null)}>Bỏ file</button>}
    </p>}
    {dangDoc && <ThanhTienTrinh phanTram={phanTram} buoc={buoc} />}
    {loi && <p className="notice error" role="alert">{loi}</p>}
    {ketQua && <KetQuaDoc ketQua={ketQua} onDien={onDien} />}
  </div>
}

function ThanhTienTrinh({ phanTram, buoc }: { phanTram: number; buoc: string }) {
  const hien = Math.max(0, Math.min(100, Math.round(phanTram)))
  return <div className="mt-3 space-y-2" role="status" aria-live="polite">
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <p className="min-w-0 text-slate-700">{buoc}</p>
      <b className="shrink-0 tabular-nums text-indigo-700">{hien}%</b>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hien} role="progressbar">
      <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-200" style={{ width: `${hien}%` }} />
    </div>
  </div>
}

function DauKhop({ o }: { o: OCotDoiChieu }) {
  return <span
    className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-bold ${o.khop ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
    title={o.goiY}
    aria-label={o.goiY}
  >{o.khop ? '✓' : '✗'}</span>
}

function BangDoiChieu({ hang }: { hang: HangDoiChieu[] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full min-w-[28rem] text-left text-sm">
      <caption className="sr-only">Đối chiếu OCR, QR và AI</caption>
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <th className="px-3 py-2 font-semibold">Thông tin</th>
          <th className="px-3 py-2 text-center font-semibold">OCR</th>
          <th className="px-3 py-2 text-center font-semibold">QR</th>
          <th className="px-3 py-2 text-center font-semibold">AI</th>
        </tr>
      </thead>
      <tbody>
        {hang.map(h => (
          <tr key={h.khoa} className="border-b border-slate-100 last:border-0">
            <td className="px-3 py-2">
              <span className="text-slate-500">{h.nhan}: </span>
              <b className="font-semibold text-slate-800" title={h.dayDu}>{h.hienThi}</b>
            </td>
            {h.cot.map(o => (
              <td key={o.nguon} className="px-3 py-2 text-center">
                <DauKhop o={o} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
}

function KetQuaDoc({ ketQua, onDien }: { ketQua: KetQuaDocHoaDon; onDien: (deXuat: DuLieuDocTuHoaDon) => void }) {
  const { deXuat, phatHien } = ketQua
  const mstMua = deXuat.mstMuaHang ? hienThiMst(deXuat.mstMuaHang) : undefined
  const loai = nhanLoaiHoaDon(deXuat.loaiHd)
  return <div className="mt-3 space-y-3">
    {phatHien.map((p, i) => (
      <p key={`${p.ma}-${i}`} className={mauPhatHien(p.muc)} role={p.muc === 'loi' ? 'alert' : 'status'}>{p.thongDiep}</p>
    ))}
    <BangDoiChieu hang={bangDoiChieuNguoiMua(ketQua)} />
    <div className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      {dongThongTin('Loại hóa đơn', loai)}
      {dongThongTin('Người bán', [deXuat.tenBanHang, deXuat.mstBanHang ? hienThiMst(deXuat.mstBanHang) : ''].filter(Boolean).join(' · '))}
      {dongThongTin('Người mua', [deXuat.tenMuaHang, mstMua].filter(Boolean).join(' · '))}
      {dongThongTin('Địa chỉ người mua', deXuat.diaChiMuaHang)}
    </div>
    {deXuat.dongHang && deXuat.dongHang.length > 0 && (
      <ul className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm">
        {deXuat.dongHang.map((d, i) => {
          const tien = tienDongSauThue(d, deXuat.loaiHd, deXuat.cotTienHang)
          const thue = d.laRuouBia && deXuat.loaiHd === 'gtgt' && d.tienThue !== undefined
            ? ` + thuế ${vnd.format(d.tienThue)}đ`
            : ''
          return (
            <li key={i} className={d.laRuouBia ? 'font-medium text-amber-800' : 'text-slate-700'}>
              {d.ten} — {vnd.format(tien)}đ{d.laRuouBia ? ` (rượu bia${thue})` : ''}
            </li>
          )
        })}
      </ul>
    )}
    {ketQua.nhatKy && ketQua.nhatKy.length > 0 && (
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-800">Nhật ký gọi AI ({ketQua.nhatKy.length} dòng)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 font-mono">
          {ketQua.nhatKy.map((d, i) => <li key={i}>{d}</li>)}
        </ol>
      </details>
    )}
    <button type="button" className="btn btn-secondary" onClick={() => onDien(deXuat)}>Điền lại vào form</button>
  </div>
}
