'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { themGiaoDichConHoiNghi, type KetQua } from '../actions'
import type { NguoiLayHdChon } from '@/lib/tai-chinh/tai-khoan'
import { phanTramTuTien, tienTuPhanTram } from '@/lib/tai-chinh/phi-hoa-don'
import { HINH_THUC, TRANG_THAI } from '@/lib/tai-chinh/kieu'
import type { DuLieuDocTuHoaDon } from '@/lib/kiem-tra/giao-dien'
import { DocHoaDon } from '../doc-hoa-don'
import { chiTietHoaDonTuDeXuat } from '@/lib/kiem-tra/phan-bo-phu-luc'

const initial: KetQua = {}
const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

// Phí hóa đơn nhập được bằng hai cách, nhưng chỉ một cách là nguồn: ô còn lại bị khóa
// và tính theo ô đang nhập, để hai số không bao giờ mâu thuẫn nhau.
type NguonPhi = 'phan_tram' | 'so_tien' | null

export function GiaoDichCon({ hoiNghiId, hinhThuc, ngayHoiNghi, collectors, tyLePhiChung, tyLeTheoNguoi }: {
  hoiNghiId: string
  hinhThuc: string
  ngayHoiNghi: string
  collectors: NguoiLayHdChon[]
  tyLePhiChung: number
  tyLeTheoNguoi: Record<string, number>
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(themGiaoDichConHoiNghi, initial)
  const [noiDung, setNoiDung] = useState('')
  const [ngay, setNgay] = useState(() => new Date().toISOString().slice(0, 10))
  const [tongTien, setTongTien] = useState('0')
  const [tienKhongThanhToan, setTienKhongThanhToan] = useState('0')
  const [tienThanhToan, setTienThanhToan] = useState('0')
  const [kyHieu, setKyHieu] = useState('')
  const [soHd, setSoHd] = useState('')
  const [chiTiet, setChiTiet] = useState<DuLieuDocTuHoaDon | null>(null)
  const [tep, setTep] = useState<File | null>(null)
  const [coTinhPhi, setCoTinhPhi] = useState(false)
  const [nguoiLayHdId, setNguoiLayHdId] = useState('')
  const [phiPhanTram, setPhiPhanTram] = useState('')
  const [phiSoTien, setPhiSoTien] = useState('')
  const [nguonPhi, setNguonPhi] = useState<NguonPhi>(null)
  useEffect(() => { if (state.thanhCong) router.refresh() }, [router, state.thanhCong])

  function dien(deXuat: DuLieuDocTuHoaDon) {
    setChiTiet(chiTietHoaDonTuDeXuat(deXuat))
    if (deXuat.ngay) setNgay(deXuat.ngay)
    if (deXuat.tongTien !== undefined) {
      const tong = String(deXuat.tongTien)
      setTongTien(tong)
      setTienThanhToan(String(Math.max(0, Number(deXuat.tongTien) - Number(deXuat.tienRuouBia ?? 0))))
    }
    if (deXuat.tienRuouBia !== undefined) setTienKhongThanhToan(String(deXuat.tienRuouBia))
    if (deXuat.kyHieuHd) setKyHieu(deXuat.kyHieuHd)
    if (deXuat.soHd) setSoHd(deXuat.soHd)
  }

  function money(value: string) { return value.replace(/\D/g, '') || '0' }

  const chuoi = (value: number | null) => value === null ? '' : String(value)

  function doiPhanTram(value: string) {
    // Chỉ nhận số và một dấu chấm thập phân; xoá hết thì mở khoá cả hai ô.
    const sach = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
    setPhiPhanTram(sach)
    if (!sach) { setNguonPhi(null); setPhiSoTien(''); return }
    setNguonPhi('phan_tram')
    setPhiSoTien(chuoi(tienTuPhanTram(Number(sach), Number(tongTien))))
  }

  function doiSoTienPhi(value: string) {
    const sach = value.replace(/\D/g, '')
    if (!sach) { setPhiSoTien(''); setPhiPhanTram(''); setNguonPhi(null); return }
    setPhiSoTien(sach)
    setNguonPhi('so_tien')
    setPhiPhanTram(chuoi(phanTramTuTien(Number(sach), Number(tongTien))))
  }

  // Tổng tiền đổi thì số phụ thuộc phải tính lại, không để lại số cũ đã sai.
  function doiTongTien(v: string) {
    setTongTien(v)
    setTienThanhToan(String(Math.max(0, Number(v) - Number(tienKhongThanhToan))))
    if (nguonPhi === 'phan_tram') setPhiSoTien(chuoi(tienTuPhanTram(Number(phiPhanTram), Number(v))))
    else if (nguonPhi === 'so_tien') setPhiPhanTram(chuoi(phanTramTuTien(Number(phiSoTien), Number(v))))
  }

  function xoaPhi() { setPhiPhanTram(''); setPhiSoTien(''); setNguonPhi(null) }

  // Gợi ý tỉ lệ đã cấu hình cho người lấy hóa đơn; người nhập vẫn sửa được.
  function doiNguoiLayHd(id: string) {
    setNguoiLayHdId(id)
    if (!coTinhPhi || nguonPhi !== null || !id) return
    const ty = tyLeTheoNguoi[id] ?? tyLePhiChung
    if (ty > 0) doiPhanTram(String(Math.round(ty * 10000) / 100))
  }

  return <form action={action} className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
    <input type="hidden" name="giao_dich_con" value="1" />
    <input type="hidden" name="chi_tiet_hoa_don" value={chiTiet ? JSON.stringify(chiTiet) : ''} />
    <input type="hidden" name="xac_nhan_hoan_tam_ung" value={state.canhBao ? '1' : '0'} />
    <input type="hidden" name="fingerprint_hoan_tam_ung" value={state.canhBao?.fingerprint ?? ''} />
    <input type="hidden" name="co_tinh_phi_lay_hd" value={coTinhPhi ? '1' : '0'} />
    <input type="hidden" name="hoi_nghi_id" value={hoiNghiId} />
    <input type="hidden" name="hinh_thuc" value={hinhThuc} />
    <input type="hidden" name="don_vi_id" value="" />
    <input type="hidden" name="loai_hd" value="Hóa đơn" />
    <input type="hidden" name="trang_thai_hd" value={TRANG_THAI.HOP_LE} />
    <input type="hidden" name="tien_duoc_thanh_toan_goc" value={tienThanhToan} />
    <input type="hidden" name="lam_tron_xuong_hang_nghin" value="0" />
    <input type="hidden" name="chi_thuc_te" value="0" />
    <input type="hidden" name="nguon_bu_chi_thuc_te" value="so_du" />
    <input type="hidden" name="nguoi_lay_hd_id" value={nguoiLayHdId} />
    <input type="hidden" name="phi_lay_hd_ghi_de" value={coTinhPhi ? phiSoTien : ''} />
    <input type="hidden" name="trang_thai_tt_phi" value={coTinhPhi ? 'Chưa thanh toán' : 'Không phát sinh'} />
    <input type="hidden" name="hinh_thuc_thanh_toan" value="" />
    <input type="hidden" name="tien_ruou_bia" value={tienKhongThanhToan} />
    <input type="hidden" name="tien_duoc_thanh_toan" value={tienThanhToan} />
    <input type="hidden" name="tong_tien" value={tongTien} />
    <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Thêm giao dịch con</h3><p className="text-xs text-slate-600">Loại giao dịch cố định theo Hội nghị: {hinhThuc}. Không lập giấy đề nghị.</p></div></div>
    {state.loi && <p className="notice error" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice success" role="status">{state.thanhCong}</p>}
    {state.canhBao && <div className="notice bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-lg space-y-2">
      <p className="font-medium">Cảnh báo vượt số dư tạm ứng:</p>
      <p className="text-sm">Số tiền hoàn ({vnd.format(state.canhBao.hoanTamUng)}) vượt dư lý thuyết ({vnd.format(state.canhBao.duLyThuyet)}) là <strong>{vnd.format(state.canhBao.thieu)}</strong>. Nhấn nút bên dưới để xác nhận lưu tiếp.</p>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field">Ngày *<input className="input" type="date" name="ngay" value={ngay} required max={ngayHoiNghi} onChange={e => setNgay(e.target.value)} /><span className="text-xs text-slate-500">Không được vượt quá ngày Hội nghị ({ngayHoiNghi}).</span></label>
      <label className="field sm:col-span-2">Nội dung *<input className="input" name="noi_dung" value={noiDung} required maxLength={1000} onChange={e => setNoiDung(e.target.value)} placeholder="Nội dung giao dịch con" /></label>
      <label className="field">Tổng tiền (VND) *<input className="input" inputMode="numeric" value={vnd.format(Number(tongTien) || 0)} required onChange={e => doiTongTien(money(e.target.value))} /></label>
      <label className="field">Tiền không được thanh toán (VND)<input className="input" inputMode="numeric" value={vnd.format(Number(tienKhongThanhToan) || 0)} onChange={e => { const v = money(e.target.value); setTienKhongThanhToan(v); setTienThanhToan(String(Math.max(0, Number(tongTien) - Number(v)))) }} /></label>
      <label className="field">Tiền được hoàn/thanh toán (VND) *<input className="input" inputMode="numeric" value={vnd.format(Number(tienThanhToan) || 0)} required onChange={e => setTienThanhToan(money(e.target.value))} /></label>
      <label className="field">Ký hiệu HĐ<input className="input" name="ky_hieu_hd" value={kyHieu} onChange={e => setKyHieu(e.target.value)} /></label>
      <label className="field">Số HĐ<input className="input" name="so_hd" value={soHd} onChange={e => setSoHd(e.target.value)} /></label>
      <label className="field">Người lấy hóa đơn<select className="input" value={nguoiLayHdId} onChange={e => doiNguoiLayHd(e.target.value)}><option value="">-- Không có --</option>{collectors.map(c => <option key={c.id} value={c.id}>{c.ten}</option>)}</select></label>
      <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={coTinhPhi} onChange={e => { setCoTinhPhi(e.target.checked); if (!e.target.checked) xoaPhi() }} /> Tính phí hóa đơn cho giao dịch con</label>
      {coTinhPhi && <div className="sm:col-span-2 grid gap-3 rounded-lg border border-indigo-100 bg-white p-3 sm:grid-cols-2">
        <label className="field">Phí theo % tổng tiền
          <input className="input" inputMode="decimal" value={phiPhanTram} disabled={nguonPhi === 'so_tien'}
            placeholder="Ví dụ: 15" onChange={e => doiPhanTram(e.target.value)} />
        </label>
        <label className="field">Hoặc số tiền phí (VND)
          <input className="input" inputMode="numeric" value={phiSoTien ? vnd.format(Number(phiSoTien)) : ''} disabled={nguonPhi === 'phan_tram'}
            placeholder="Nhập số tiền cụ thể" onChange={e => doiSoTienPhi(e.target.value)} />
        </label>
        <p className="sm:col-span-2 text-xs text-slate-500">
          {nguonPhi === 'phan_tram' ? `Đang tính theo phần trăm: ${phiPhanTram}% × ${vnd.format(Number(tongTien) || 0)} = ${vnd.format(Number(phiSoTien) || 0)} đ.`
            : nguonPhi === 'so_tien' ? `Đang tính theo số tiền: ${vnd.format(Number(phiSoTien) || 0)} đ tương đương ${phiPhanTram || '0'}% tổng tiền.`
            : 'Điền một trong hai ô; ô còn lại sẽ tự tính và bị khoá. Để trống cả hai thì phí tính theo tỷ lệ đã cấu hình của người lấy hóa đơn.'}
          {nguonPhi && <button type="button" className="ml-2 text-indigo-700 underline" onClick={xoaPhi}>Nhập lại</button>}
        </p>
      </div>}
    </div>
    <DocHoaDon onDien={dien} onTep={file => { setTep(file); if (file) setChiTiet(null) }} tep={tep} />
    <div className="flex justify-end">
      <button className="btn btn-primary" disabled={pending}>
        {pending ? 'Đang lưu…' : state.canhBao ? 'Xác nhận vẫn lưu giao dịch con' : 'Lưu giao dịch con'}
      </button>
    </div>
  </form>
}
