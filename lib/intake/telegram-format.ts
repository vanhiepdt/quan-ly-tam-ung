import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { NHAN_HINH_THUC_THANH_TOAN, HINH_THUC_THANH_TOAN } from '@/lib/tai-chinh/hinh-thuc'
import type { CauHinhIntake } from './cau-hinh'
import { docDeXuatIntake, docSnapshotIntake, type IntakeRow } from './intake'

export const INTAKE_PUBLIC_URL = (process.env.INTAKE_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://hc.ttdt.site').replace(/\/$/, '')

export function tienVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

export function nhanHinhThuc(value: string): string {
  if (value === HINH_THUC.HOAN_TAM_UNG) return 'Hoàn tạm ứng'
  if (value === HINH_THUC.CQ_TRA_THANG) return 'Cơ quan trả thẳng'
  return value
}

export function nhanThanhToan(value: string): string {
  return NHAN_HINH_THUC_THANH_TOAN[value as keyof typeof NHAN_HINH_THUC_THANH_TOAN] ?? value
}

export function ngayViet(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

export function idCallback(rowId: string, action: string, value?: string): string {
  return ['intake', rowId, action, value].filter(Boolean).join(':').slice(0, 64)
}

export type TelegramKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }

export function keyboardTomTat(rowId: string, canhBao = false): TelegramKeyboard {
  return {
    inline_keyboard: [
      [
        { text: canhBao ? 'Xác nhận lưu' : 'Lưu ngay', callback_data: idCallback(rowId, 'save') },
        { text: 'Dùng mặc định', callback_data: idCallback(rowId, 'default') },
      ],
      [
        { text: 'Đổi hình thức', callback_data: idCallback(rowId, 'form') },
        { text: 'Đổi đơn vị', callback_data: idCallback(rowId, 'unit') },
      ],
      [
        { text: 'Đổi người lấy HĐ', callback_data: idCallback(rowId, 'collector') },
        { text: 'Đổi thanh toán', callback_data: idCallback(rowId, 'payment') },
      ],
      ...(canhBao ? [[{ text: 'Đổi số/ký hiệu HĐ', callback_data: idCallback(rowId, 'invoice') }]] : []),
      [{ text: 'Hủy', callback_data: idCallback(rowId, 'cancel') }],
    ],
  }
}

export function keyboardLuaChon(rowId: string, action: string, choices: Array<{ text: string; value: string }>): TelegramKeyboard {
  return {
    inline_keyboard: [
      ...choices.map(choice => [{ text: choice.text, callback_data: idCallback(rowId, action, choice.value) }]),
      [{ text: 'Quay lại tóm tắt', callback_data: idCallback(rowId, 'summary') }],
    ],
  }
}

export function tomTatIntake(
  row: IntakeRow,
  config: CauHinhIntake,
  options: { donViTen?: string; nguoiLayHdTen?: string; loi?: string } = {},
): string {
  const deXuat = docDeXuatIntake(row)
  const snapshot = docSnapshotIntake(row)
  const thayDoi = deXuat.thayDoi ?? {}
  const hinhThuc = thayDoi.hinhThuc ?? snapshot.hinhThuc
  const payment = hinhThuc === HINH_THUC.HOAN_TAM_UNG
    ? HINH_THUC_THANH_TOAN.HOAN_TAM_UNG
    : thayDoi.hinhThucThanhToan ?? snapshot.hinhThucThanhToan
  const kyHieu = thayDoi.kyHieuHd ?? deXuat.kyHieuHd ?? '—'
  const so = thayDoi.soHd ?? deXuat.soHd ?? '—'
  const collector = (thayDoi.nguoiLayHdId ?? snapshot.nguoiLayHdId) === null
    ? 'Không chọn'
    : options.nguoiLayHdTen || 'Theo mặc định'
  const lines = [
    `HĐ ${kyHieu} / ${so} · ${ngayViet(deXuat.ngay)} · ${tienVnd(deXuat.tongTien)} · rượu bia ${tienVnd(deXuat.tienRuouBia)}`,
    `Mặc định: ${nhanHinhThuc(hinhThuc)} · ${options.donViTen || snapshot.donViTen} · ${collector} · ${nhanThanhToan(payment)} · ${deXuat.loaiHd === 'ban_hang' ? 'Hóa đơn Bán hàng' : 'Hóa đơn GTGT'} · phí ${snapshot.trangThaiTtPhi}`,
    `Đổi gì không? ${config.timeoutGiay} giây nữa sẽ lưu mặc định.`,
  ]
  if (deXuat.trangThaiHd !== 'Hợp lệ') lines.push('Cảnh báo: hóa đơn chưa được đánh dấu hợp lệ.')
  if (row.loi) lines.push(`Lỗi trước đó: ${row.loi}`)
  if (options.loi) lines.push(options.loi)
  return lines.join('\n')
}

export function thongBaoThanhCong(giaoDichId: string, soThuTu?: number, ngay?: string): string {
  const stt = soThuTu === undefined ? '' : ` ${ngay ? `${ngayViet(ngay)} ` : ''}STT ${soThuTu}`
  return `Đã thêm giao dịch${stt}. Mở: ${INTAKE_PUBLIC_URL}/tep/${giaoDichId}`
}

export function thongBaoHetHan(giaoDichId: string | null, tuLuu: boolean): string {
  if (tuLuu && giaoDichId) return `Đã tự lưu hóa đơn theo mặc định vì hết thời gian chờ. Mở: ${INTAKE_PUBLIC_URL}/tep/${giaoDichId}`
  return 'Intake đã hết thời gian chờ nên không lưu. Gửi lại hóa đơn nếu cần.'
}
