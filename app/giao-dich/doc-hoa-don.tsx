'use client'

import { useEffect, useRef, useState } from 'react'
import { docHoaDon, tinhTrangHaiAiHoaDon, type TinhTrangHaiAi } from './doc-hoa-don-actions'
import type { DuLieuDocTuHoaDon, KetQuaDocHoaDon, PhatHien } from '@/lib/kiem-tra/giao-dien'
import { bangDoiChieuNguoiMua, type HangDoiChieu, type OCotDoiChieu } from '@/lib/kiem-tra/bang-doi-chieu'
import { nhanLoaiHoaDon, tienDongSauThue } from '@/lib/kiem-tra/loai-hoa-don'
import { hienThiMst } from '@/lib/kiem-tra/so-sanh'
import { chiTietHoaDonTuDeXuat, phanBoPhuLuc } from '@/lib/kiem-tra/phan-bo-phu-luc'

const vnd = new Intl.NumberFormat('vi-VN')

const BUOC_TIEN_TRINH = [
  { den: 12, chu: 'Đã nhận tệp, đang kiểm tra định dạng…' },
  { den: 30, chu: 'Đang đọc PDF/XML…' },
  { den: 68, chu: 'Đang gửi tệp cho AI 1 và AI 2…' },
  { den: 88, chu: 'Đang đối chiếu hai kết quả…' },
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

export function DocHoaDon({ onDien, onTep, tep }: {
  onDien: (deXuat: DuLieuDocTuHoaDon, truongSua?: 'deNghiThanhToan' | 'ghiChu') => void
  onTep?: (file: File | null) => void
  tep?: File | null
}) {
  const [dangDoc, setDangDoc] = useState(false)
  const [phanTram, setPhanTram] = useState(0)
  const [buoc, setBuoc] = useState('')
  const [loi, setLoi] = useState('')
  const [ketQua, setKetQua] = useState<KetQuaDocHoaDon | null>(null)
  const [tinhTrangAi, setTinhTrangAi] = useState<TinhTrangHaiAi | null>(null)
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
    tinhTrangHaiAiHoaDon().then(t => { if (!huy) setTinhTrangAi(t) }).catch(() => {
      if (!huy) setTinhTrangAi({
        muc: 'loi',
        thongDiep: 'Không kiểm tra được cấu hình hai AI.',
        ai1: { muc: 'loi', thongDiep: 'Không kiểm tra được.', nha: '', moHinh: '', docAnh: false },
        ai2: { muc: 'loi', thongDiep: 'Không kiểm tra được.', nha: '', moHinh: '', docAnh: false },
      })
    })
    return () => { huy = true }
  }, [])

  async function doc(event: React.ChangeEvent<HTMLInputElement>) {
    const tepMoi = event.target.files?.[0]
    event.target.value = ''
    if (!tepMoi || dangDoc) return
    const tt = tinhTrangAi
    if (tt && tt.muc !== 'ok') {
      const cau = `${tt.thongDiep}\n\nVẫn tiếp tục đọc tệp bằng các nguồn đang sẵn sàng?`
      if (!window.confirm(cau)) return
    }
    onTep?.(tepMoi)
    setDangDoc(true)
    setLoi('')
    setKetQua(null)
    chayTienTrinh()
    try {
      const data = new FormData()
      data.set('tep', tepMoi)
      const kq = await docHoaDon(data)
      dungTienTrinh()
      setPhanTram(100)
      setBuoc(kq.loi ? 'Không đọc được hóa đơn.' : 'Đã đọc xong, đang hiện kết quả…')
      if (kq.loi) { setLoi(kq.loi); return }
      if (!kq.deXuat || !kq.phatHien || !kq.trangThai) {
        setLoi('Không đọc được hóa đơn. Hãy kiểm tra tệp PDF/XML hoặc nhập tay.')
        return
      }
      const hopLe: KetQuaDocHoaDon = {
        trangThai: kq.trangThai,
        deXuat: kq.deXuat,
        ai1: kq.ai1 ?? null,
        ai2: kq.ai2 ?? null,
        xml: kq.xml ?? null,
        phatHien: kq.phatHien,
        nhatKy: kq.nhatKy,
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
    {!tinhTrangAi && <p className="notice" role="status">Đang kiểm tra cấu hình hai AI…</p>}
    {tinhTrangAi && tinhTrangAi.muc !== 'ok' && <p className={tinhTrangAi.muc === 'loi' ? 'notice error' : 'notice bg-amber-50 text-amber-900'} role="status">{tinhTrangAi.thongDiep}</p>}
    {tinhTrangAi?.muc === 'ok' && <p className="notice success" role="status">{tinhTrangAi.thongDiep}</p>}
    <label className="field">
      Đọc từ hóa đơn
      <input type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml" disabled={dangDoc || !tinhTrangAi} onChange={doc} />
      <small className="font-normal text-slate-500">Chỉ nhận PDF hoặc XML, tối đa 10 MB. Tệp được giữ trong hồ sơ giao dịch khi lưu. Kết quả chỉ là đề xuất, hãy soát rồi lưu.</small>
    </label>
    {tep && <p className="mt-2 text-sm text-slate-600" role="status">Sẽ giữ file <b className="font-semibold text-slate-800">{tep.name}</b> khi lưu giao dịch.{onTep && <button type="button" className="ml-2 text-indigo-700 underline" onClick={() => onTep(null)}>Bỏ file</button>}</p>}
    {dangDoc && <ThanhTienTrinh phanTram={phanTram} buoc={buoc} />}
    {loi && <p className="notice error" role="alert">{loi}</p>}
    {ketQua && <KetQuaDoc ketQua={ketQua} onDien={(deXuat, truongSua) => {
      setKetQua(hien => hien ? { ...hien, deXuat } : hien)
      onDien(deXuat, truongSua)
    }} />}
  </div>
}

function ThanhTienTrinh({ phanTram, buoc }: { phanTram: number; buoc: string }) {
  const hien = Math.max(0, Math.min(100, Math.round(phanTram)))
  return <div className="mt-3 space-y-2" role="status" aria-live="polite">
    <div className="flex items-baseline justify-between gap-3 text-sm"><p className="min-w-0 text-slate-700">{buoc}</p><b className="shrink-0 tabular-nums text-indigo-700">{hien}%</b></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hien} role="progressbar"><div className="h-full rounded-full bg-indigo-600 transition-[width] duration-200" style={{ width: `${hien}%` }} /></div>
  </div>
}

function DauKhop({ o }: { o: OCotDoiChieu }) {
  return <span className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-bold ${o.khop ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} title={o.goiY} aria-label={o.goiY}>{o.khop ? '✓' : '✗'}</span>
}

function BangDoiChieu({ hang }: { hang: HangDoiChieu[] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full min-w-[32rem] text-left text-sm">
      <caption className="sr-only">Đối chiếu AI 1, AI 2 và XML</caption>
      <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase"><th className="px-3 py-2 font-semibold">Thông tin</th><th className="px-3 py-2 text-center font-semibold">AI 1</th><th className="px-3 py-2 text-center font-semibold">AI 2</th><th className="px-3 py-2 text-center font-semibold">XML</th></tr></thead>
      <tbody>{hang.map(h => <tr key={h.khoa} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2"><span className="text-slate-500">{h.nhan}: </span><b className="font-semibold text-slate-800" title={h.dayDu}>{h.hienThi}</b></td>{h.cot.map(o => <td key={o.nguon} className="px-3 py-2 text-center"><DauKhop o={o} /></td>)}</tr>)}</tbody>
    </table>
  </div>
}

function KetQuaDoc({ ketQua, onDien }: {
  ketQua: KetQuaDocHoaDon
  onDien: (deXuat: DuLieuDocTuHoaDon, truongSua?: 'deNghiThanhToan' | 'ghiChu') => void
}) {
  const { deXuat, phatHien } = ketQua
  const [duThaoSo, setDuThaoSo] = useState<Record<string, string>>({})
  const [loiChinhSua, setLoiChinhSua] = useState('')
  const mstMua = deXuat.mstMuaHang ? hienThiMst(deXuat.mstMuaHang) : undefined
  const chiTiet = chiTietHoaDonTuDeXuat(deXuat)
  const phanBo = chiTiet ? phanBoPhuLuc(chiTiet) : null

  function suaDongHang(viTri: number, thayDoi: { deNghiThanhToan: number } | { ghiChu: string }): string | null {
    const dongHang = deXuat.dongHang
    if (!dongHang || !dongHang[viTri]) return null
    const danhSachMoi = dongHang.map((dong, i) => i === viTri ? { ...dong, ...thayDoi } : dong)
    const deXuatMoi: DuLieuDocTuHoaDon = { ...deXuat, dongHang: danhSachMoi }
    const chiTietMoi = chiTietHoaDonTuDeXuat(deXuatMoi)
    if (!chiTietMoi) { const loi = 'Chi tiết bảng kê không hợp lệ.'; setLoiChinhSua(loi); return loi }
    const phanBoMoi = phanBoPhuLuc(chiTietMoi)
    if (phanBoMoi.loi) { setLoiChinhSua(phanBoMoi.loi); return phanBoMoi.loi }
    deXuatMoi.tienRuouBia = phanBoMoi.tongKhongDeNghi
    setLoiChinhSua('')
    onDien(deXuatMoi, 'ghiChu' in thayDoi ? 'ghiChu' : 'deNghiThanhToan')
    return null
  }

  return <div className="mt-3 space-y-3">
    {phatHien.map((p, i) => <p key={`${p.ma}-${i}`} className={mauPhatHien(p.muc)} role={p.muc === 'loi' ? 'alert' : 'status'}>{p.thongDiep}</p>)}
    {loiChinhSua && <p className="notice error" role="alert">{loiChinhSua}</p>}
    <BangDoiChieu hang={bangDoiChieuNguoiMua(ketQua)} />
    <div className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      {dongThongTin('Loại hóa đơn', nhanLoaiHoaDon(deXuat.loaiHd))}
      {dongThongTin('Người bán', [deXuat.tenBanHang, deXuat.mstBanHang ? hienThiMst(deXuat.mstBanHang) : ''].filter(Boolean).join(' · '))}
      {dongThongTin('Người mua', [deXuat.tenMuaHang, mstMua].filter(Boolean).join(' · '))}
      {dongThongTin('Địa chỉ người mua', deXuat.diaChiMuaHang)}
      {dongThongTin('Tiền không được thanh toán', deXuat.tienRuouBia)}
    </div>
    {deXuat.dongHang && deXuat.dongHang.length > 0 && <>
      <p className="text-sm text-slate-600">Tên món, số lượng và thành tiền giữ nguyên theo hóa đơn. Chỉ sửa cột Đề nghị thanh toán và Ghi chú.</p>
      {phanBo?.loi && <p className="notice error" role="alert">{phanBo.loi} Hãy chỉnh lại chi tiết hóa đơn trước khi xem hoặc lưu giấy.</p>}
      <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <caption className="sr-only">Chi tiết hóa đơn theo bảng kê thanh toán</caption>
          <thead className="sticky top-0 z-[1] bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              <th scope="col" className="w-12 px-2 py-2 text-center">STT</th>
              <th scope="col" className="min-w-64 px-2 py-2">Nội dung</th>
              <th scope="col" className="w-28 px-2 py-2 text-right">Số lượng</th>
              <th scope="col" className="w-44 px-2 py-2 text-right">Thành tiền theo hóa đơn</th>
              <th scope="col" className="w-44 px-2 py-2 text-right">Đề nghị thanh toán</th>
              <th scope="col" className="min-w-56 px-2 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {deXuat.dongHang.map((d, i) => {
              const tien = tienDongSauThue(d, deXuat.loaiHd, deXuat.cotTienHang)
              const dongPhanBo = phanBo?.cacDongTheoHoaDon[i]
              const khoaDeNghi = `de-nghi-${i}`
              return <tr key={i} className="border-t border-slate-100 align-top">
                <td className="px-2 py-2 text-center tabular-nums text-slate-500">{i + 1}</td>
                <td className="px-2 py-2 text-slate-800">{d.ten}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-700">{d.soLuong === undefined ? '—' : vnd.format(d.soLuong)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-700">{vnd.format(tien)}đ</td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Đề nghị thanh toán dòng ${i + 1}`}
                    inputMode="numeric"
                    value={duThaoSo[khoaDeNghi] ?? vnd.format(d.deNghiThanhToan ?? dongPhanBo?.deNghiThanhToan ?? 0)}
                    onFocus={event => event.currentTarget.select()}
                    onChange={event => {
                      const raw = event.currentTarget.value
                      setDuThaoSo(hien => ({ ...hien, [khoaDeNghi]: raw }))
                      const gon = raw.trim()
                      const digits = gon.replace(/[.,\s]/g, '')
                      const soTien = digits ? Number(digits) : 0
                      const loi = (gon && !/^\d[\d.,\s]*$/.test(gon)) || !Number.isSafeInteger(soTien)
                        ? 'Số tiền đề nghị phải là số nguyên VND không âm.' : ''
                      const loiPhanBo = loi ? '' : suaDongHang(i, { deNghiThanhToan: soTien })
                      event.currentTarget.setCustomValidity(loi || loiPhanBo || '')
                      if (loi) setLoiChinhSua(loi)
                    }}
                    onBlur={event => {
                      if (event.currentTarget.validity.valid) {
                        setDuThaoSo(hien => { const moi = { ...hien }; delete moi[khoaDeNghi]; return moi })
                      }
                    }}
                    className="min-h-9 w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    aria-label={`Ghi chú dòng ${i + 1}`}
                    maxLength={500}
                    value={d.ghiChu ?? dongPhanBo?.ghiChu ?? ''}
                    onChange={event => { suaDongHang(i, { ghiChu: event.target.value }) }}
                    className="min-h-9 w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </td>
              </tr>
            })}
          </tbody>
          {phanBo && !phanBo.loi && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
            <tr>
              <th scope="row" colSpan={3} className="px-2 py-2 text-left">Tổng cộng</th>
              <td className="px-2 py-2 text-right tabular-nums">{vnd.format(phanBo.tongHoaDon)}đ</td>
              <td className="px-2 py-2 text-right tabular-nums">{vnd.format(phanBo.tongDeNghi)}đ</td>
              <td className="px-2 py-2 text-xs font-normal text-slate-600">Không đề nghị: {vnd.format(phanBo.tongKhongDeNghi)}đ</td>
            </tr>
          </tfoot>}
        </table>
      </div>
    </>}
    {ketQua.nhatKy && ketQua.nhatKy.length > 0 && <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><summary className="cursor-pointer font-medium text-slate-800">Nhật ký gọi AI ({ketQua.nhatKy.length} dòng)</summary><ol className="mt-2 list-decimal space-y-1 pl-5 font-mono">{ketQua.nhatKy.map((d, i) => <li key={i}>{d}</li>)}</ol></details>}
    <button type="button" className="btn btn-secondary" onClick={() => onDien(deXuat)}>Điền lại vào form</button>
  </div>
}
