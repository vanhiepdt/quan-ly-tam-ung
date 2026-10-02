'use client'

import { useActionState } from 'react'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { datWebhookTelegram, luuCauHinhIntake, xoayTokenAgent, type DuLieuIntakeCaiDat, type KetQuaIntakeCaiDat } from './intake-actions'

const initial: KetQuaIntakeCaiDat = {}

function ThongBao({ state }: { state: KetQuaIntakeCaiDat }) {
  return <>
    {state.loi && <p className="notice sm:col-span-2 error" role="alert">{state.loi}</p>}
    {state.thanhCong && <p className="notice sm:col-span-2 success" role="status">{state.thanhCong}</p>}
  </>
}

export function CaiDatIntake({ banDau }: { banDau: DuLieuIntakeCaiDat }) {
  const [state, action, pending] = useActionState(luuCauHinhIntake, initial)
  const [rotateState, rotateAction, rotatePending] = useActionState(xoayTokenAgent, initial)
  const [webhookState, webhookAction, webhookPending] = useActionState(datWebhookTelegram, initial)
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
    <form action={action} className="contents">
      <label className="field sm:col-span-2">
        <span className="flex items-center gap-3 font-medium text-slate-700"><input type="checkbox" name="dang_bot" value="1" defaultChecked={banDau.dangBot} className="size-4 accent-indigo-600" /> Bật bot Telegram</span>
        <small>Chỉ user/chat trong allowlist mới được gửi hóa đơn và bấm nút xử lý.</small>
      </label>
      <label className="field">
        <span className="flex items-center gap-3 font-medium text-slate-700"><input type="checkbox" name="dang_agent" value="1" defaultChecked={banDau.dangAgent} className="size-4 accent-indigo-600" /> Bật agent scan</span>
        <small>Agent chỉ gọi HTTPS ra máy chủ, không mở cổng inbound.</small>
      </label>
      <label className="field">
        <span className="flex items-center gap-3 font-medium text-slate-700"><input type="checkbox" name="tu_luu_het_han" value="1" defaultChecked={banDau.tuLuuHetHan} className="size-4 accent-indigo-600" /> Tự lưu khi hết hạn</span>
        <small>Ghi theo snapshot mặc định tại lúc nhận file.</small>
      </label>

      <label className="field sm:col-span-2">Token bot Telegram
        <input name="bot_token" type="password" autoComplete="new-password" maxLength={500} placeholder={banDau.coBotToken ? 'Đã lưu — để trống nếu giữ nguyên' : 'Dán token lấy từ BotFather'} />
        <small>{banDau.coBotToken ? 'Token không được hiển thị lại. Điền token mới để thay.' : 'Token chỉ lưu ở máy chủ dưới dạng mã hóa.'}</small>
      </label>
      {banDau.coBotToken && <label className="field sm:col-span-2"><span className="flex items-center gap-3 font-medium text-slate-700"><input type="checkbox" name="xoa_bot_token" value="1" className="size-4 accent-indigo-600" /> Xóa token bot đã lưu</span></label>}

      <label className="field sm:col-span-2">Allowlist Telegram
        <textarea name="allowlist" rows={4} defaultValue={banDau.allowlistText} placeholder={'user:123456789\nchat:-1001234567890'} />
        <small>Mỗi dòng một mục: <code>user:ID</code> hoặc <code>chat:ID</code>. Không ghi token vào đây.</small>
      </label>
      <label className="field">Thời gian chờ (giây)
        <input name="timeout_giay" type="number" min={30} max={3600} step={1} defaultValue={banDau.timeoutGiay} required />
        <small>Cho phép từ 30 đến 3.600 giây. Mặc định 180 giây.</small>
      </label>
      <label className="field">Hình thức mặc định
        <select name="hinh_thuc_mac_dinh" defaultValue={banDau.hinhThucMacDinh}>
          <option value={HINH_THUC.HOAN_TAM_UNG}>Hoàn tạm ứng</option>
          <option value={HINH_THUC.CQ_TRA_THANG}>Cơ quan trả thẳng</option>
        </select>
      </label>
      <label className="field">Đơn vị giao dịch mặc định
        <select name="don_vi_id_mac_dinh" defaultValue={banDau.donViIdMacDinh ?? ''} required>
          <option value="">-- Chọn đơn vị --</option>
          {banDau.donVi.map(item => <option key={item.id} value={item.id}>{item.ten}</option>)}
        </select>
        <small>Giống trường “Đơn vị tiếp khách” khi mở form thêm giao dịch: ưu tiên đơn vị chưa tiếp, rồi ít lần nhất, rồi lần tiếp xa nhất. Nếu đã chọn riêng ở đây, intake sẽ dùng lựa chọn đó.</small>
      </label>
      <label className="field">Thanh toán mặc định cho cơ quan trả thẳng
        <select name="hinh_thuc_thanh_toan_mac_dinh" defaultValue={banDau.hinhThucThanhToanMacDinh}>
          <option value="tien_mat">Tiền mặt</option>
          <option value="chuyen_khoan">Chuyển khoản</option>
        </select>
      </label>
      <label className="field sm:col-span-2">User hệ thống dùng khi tự lưu
        <select name="nguoi_dung_he_thong_id" defaultValue={banDau.nguoiDungHeThongId ?? ''} required>
          <option value="">-- Chọn user có quyền nhập liệu --</option>
          {banDau.nguoiDung.map(item => <option key={item.id} value={item.id}>{item.ten} ({item.vaiTro})</option>)}
        </select>
        <small>Giao dịch Telegram/scan luôn có người tạo cụ thể, không tạo dữ liệu ẩn danh.</small>
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">Người lấy hóa đơn và trạng thái phí mặc định dùng chung cấu hình ở phần Thông tin giấy đề nghị.</p>
      <ThongBao state={state} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button disabled={pending} className="btn btn-primary">{pending ? 'Đang lưu…' : 'Lưu cài đặt intake'}</button></div>
    </form>

    <section className="sm:col-span-2 grid grid-cols-1 gap-5 border-t border-slate-200 pt-5 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Token agent Windows Service</h3>
        <p className="text-sm text-slate-500">Token cũ bị vô hiệu hóa ngay khi tạo token mới. Token mới chỉ hiện trong kết quả lần này.</p>
        <form action={rotateAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="xac_nhan" value="1" />
          <button disabled={rotatePending} className="btn btn-secondary">{rotatePending ? 'Đang tạo…' : 'Tạo/rotate token agent'}</button>
        </form>
        <ThongBao state={rotateState} />
        {rotateState.agentTokenMoi && <div className="notice success break-all"><strong>Lưu token này vào máy Windows ngay:</strong><br /><code>{rotateState.agentTokenMoi}</code></div>}
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Trạng thái kết nối</h3>
        <dl className="grid gap-2 text-sm text-slate-600">
          <div className="flex justify-between gap-3"><dt>Webhook</dt><dd>{banDau.webhookDaDat ? `Đã đặt${banDau.webhookDatLuc ? ` · ${banDau.webhookDatLuc}` : ''}` : 'Chưa đặt'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Agent ping cuối</dt><dd>{banDau.agentPingLuc || 'Chưa có'}</dd></div>
          <div className="flex justify-between gap-3"><dt>Intake chờ phản hồi</dt><dd>{banDau.soIntakeCho}</dd></div>
        </dl>
        <p className="break-all text-xs text-slate-500">Webhook URL: {banDau.webhookUrl}</p>
        <form action={webhookAction}><button disabled={webhookPending} className="btn btn-secondary">{webhookPending ? 'Đang gọi Telegram…' : 'Đặt webhook Telegram'}</button></form>
        <ThongBao state={webhookState} />
      </div>
    </section>
  </div>
}
