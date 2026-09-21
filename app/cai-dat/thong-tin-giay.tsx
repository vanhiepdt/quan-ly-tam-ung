'use client'
import { useActionState, useEffect, useState } from 'react'
import { luuCauHinhGiay, type DuLieuCauHinhGiay, type KetQuaGiay } from './giay-actions'
import { TRANG_THAI_PHI } from '@/lib/tai-chinh/danh-muc'
import { VAI_TRO_KY } from '@/lib/tai-chinh/vai-tro-ky'

const initial: KetQuaGiay = {}

// Những chữ giống nhau ở mọi giấy đề nghị, và người ký mặc định cho từng vai trò. Chỉ
// quản trị viên sửa được vì đây là thông tin dùng chung cho cả cơ quan.
export function ThongTinGiay({ banDau, canBo, nguoiLayHd }: {
  banDau: DuLieuCauHinhGiay
  canBo: Array<{ id: string; ten: string }>
  nguoiLayHd: Array<{ id: string; ten: string }>
}) {
  const [state, action, pending] = useActionState(luuCauHinhGiay, initial)
  // React 19 reset uncontrolled fields after useActionState. Giữ giá trị đã lưu bằng
  // state có kiểm soát để người lấy HĐ và trạng thái phí không bị trống ngay sau khi lưu.
  const [nguoiLayHdId, setNguoiLayHdId] = useState(banDau.nguoiLayHdMacDinhId ?? '')
  const [trangThaiPhi, setTrangThaiPhi] = useState(banDau.trangThaiTtPhiMacDinh)
  useEffect(() => {
    setNguoiLayHdId(banDau.nguoiLayHdMacDinhId ?? '')
    setTrangThaiPhi(banDau.trangThaiTtPhiMacDinh)
  }, [banDau.nguoiLayHdMacDinhId, banDau.trangThaiTtPhiMacDinh])
  return <form
    action={action}
    onReset={event => event.preventDefault()}
    className="grid grid-cols-1 gap-5 sm:grid-cols-2"
  >
    <label className="field">Tên đơn vị *<input name="ten_don_vi" required maxLength={200} defaultValue={banDau.tenDonVi} /><small>In ở đầu giấy và trong dòng "Kính gửi". Không dùng để đối chiếu hóa đơn.</small></label>
    <label className="field">Địa danh *<input name="dia_danh" required maxLength={100} defaultValue={banDau.diaDanh} /><small>In ở dòng ngày tháng: "…, ngày 20 tháng 9 năm 2026".</small></label>
    <label className="field sm:col-span-2">Tên đơn vị mua hàng trên hóa đơn<input name="ten_mua_hang_don_vi" maxLength={200} defaultValue={banDau.tenMuaHangDonVi} placeholder="Trung tâm Đào tạo Ngân hàng Chính sách xã hội" /><small>Đối chiếu tên người mua. Hoa/thường chữ đầu không ảnh hưởng. Không in lên giấy.</small></label>
    <label className="field">MST đơn vị mua hàng<input name="mst_don_vi" inputMode="numeric" maxLength={20} defaultValue={banDau.mstDonVi} placeholder="0100695387-066" /><small>Đối chiếu MST người mua. 10 số, hoặc 13 số dạng 0100695387-066. Không in lên giấy.</small></label>
    <label className="field sm:col-span-2">Địa chỉ đơn vị mua hàng<textarea name="dia_chi_don_vi" maxLength={400} rows={2} defaultValue={banDau.diaChiDonVi} placeholder="Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam" /><small>Đối chiếu địa chỉ người mua trên hóa đơn. Không in lên giấy.</small></label>
    <label className="field">Lý do tạm ứng *<input name="ly_do_tam_ung" required maxLength={500} defaultValue={banDau.lyDoTamUng} /><small>In ở giấy đề nghị tạm ứng.</small></label>
    <label className="field">Thời hạn thanh toán *<input name="thoi_han_thanh_toan" required maxLength={500} defaultValue={banDau.thoiHanThanhToan} /><small>In ở giấy đề nghị tạm ứng.</small></label>

    <div className="sm:col-span-2">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Người ký mặc định</h3>
      <p className="mb-4 text-xs text-slate-500">Dùng khi tài khoản đang đăng nhập chưa gắn với cán bộ nào. Người đề nghị luôn ưu tiên cán bộ gắn với tài khoản đăng nhập.</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {VAI_TRO_KY.map(vaiTro => (
          <label key={vaiTro.id} className="field">
            {vaiTro.ten}
            <select name={`ky_${vaiTro.id}`} defaultValue={banDau.nguoiKy[vaiTro.id] ?? ''}>
              <option value="">-- Không mặc định --</option>
              {canBo.map(cb => <option key={cb.id} value={cb.id}>{cb.ten}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>

    <label className="field">
      Người lấy hóa đơn mặc định
      <select name="nguoi_lay_hd_mac_dinh" value={nguoiLayHdId} onChange={e => setNguoiLayHdId(e.target.value)}>
        <option value="">-- Không mặc định --</option>
        {nguoiLayHd.map(n => <option key={n.id} value={n.id}>{n.ten}</option>)}
      </select>
      <small>Hiện trước trên form thêm giao dịch. Tài khoản nhận tiền của người này được in kèm khi thanh toán bằng chuyển khoản mà giao dịch chưa gắn người lấy hóa đơn.</small>
    </label>

    <label className="field">
      Trạng thái thanh toán phí mặc định
      <select name="trang_thai_tt_phi_mac_dinh" value={trangThaiPhi} onChange={e => setTrangThaiPhi(e.target.value)}>
        {TRANG_THAI_PHI.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <small>Hiện trước trên form thêm giao dịch có hóa đơn.</small>
    </label>

    {state.loi && <p className="notice sm:col-span-2 error" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice sm:col-span-2 success" role="status">{state.thanhCong}</p>}
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2 [&_span]:text-xs [&_span]:text-slate-500">
      <button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu thông tin giấy'}</button>
      <span>Áp dụng cho mọi giấy đề nghị in ra sau khi lưu.</span>
    </div>
  </form>
}
