import { generateAccountTransfer } from './subiz'
export { crc16 } from './subiz'
export function chuanHoaNoiDung(value: string) {
  const text = value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim()
  if (!/^[\x20-\x7e]*$/.test(text)) throw new Error('Nội dung chuyển khoản chứa ký tự không được hỗ trợ.')
  if (text.length > 25) throw new Error('Nội dung chuyển khoản tối đa 25 ký tự; không tự cắt số hóa đơn hoặc ngày.')
  return text
}
export function taoNoiDungThanhToan(soHd: string, ngay: string) {
  if (!soHd.trim()) throw new Error('Cần số hóa đơn để tạo nội dung chuyển khoản.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || !Number.isFinite(Date.parse(ngay)) || new Date(ngay).toISOString().slice(0, 10) !== ngay) throw new Error('Ngày giao dịch không hợp lệ.')
  return chuanHoaNoiDung(`TT HD ${soHd.trim()} ${ngay.replace(/-/g, '')}`)
}
export function taoPayloadVietQR(input: { bin: string; soTaiKhoan: string; soTien?: number; noiDung?: string }) {
  if (!/^\d{6}$/.test(input.bin) || !/^\d{1,19}$/.test(input.soTaiKhoan)) throw new Error('Thông tin ngân hàng không hợp lệ (BIN 6 số, tài khoản tối đa 19 số).')
  if (input.soTien !== undefined && (!Number.isSafeInteger(input.soTien) || input.soTien <= 0 || String(input.soTien).length > 13)) throw new Error('Số tiền VietQR phải là số nguyên dương, tối đa 13 chữ số.')
  return generateAccountTransfer(input.bin, input.soTaiKhoan, input.soTien, input.noiDung ? chuanHoaNoiDung(input.noiDung) : '')
}
