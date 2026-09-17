// EMV values use a two-digit byte length. Keep all encoded text ASCII.
function tlv(id: string, value: string) {
  if (!/^[\x20-\x7e]*$/.test(value) || value.length > 99) throw new Error('Dữ liệu VietQR vượt giới hạn mã hóa.')
  return id + String(value.length).padStart(2, '0') + value
}
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
export function crc16(value: string) {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? ((crc << 1) ^ 0x1021) : (crc << 1)) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
export function taoPayloadVietQR(input: { bin: string; soTaiKhoan: string; soTien?: number; noiDung?: string }) {
  if (!/^\d{6}$/.test(input.bin) || !/^\d{1,19}$/.test(input.soTaiKhoan)) throw new Error('Thông tin ngân hàng không hợp lệ (BIN 6 số, tài khoản tối đa 19 số).')
  if (input.soTien !== undefined && (!Number.isSafeInteger(input.soTien) || input.soTien <= 0 || String(input.soTien).length > 13)) throw new Error('Số tiền VietQR phải là số nguyên dương, tối đa 13 chữ số.')
  const dinhDanh = tlv('00', input.bin) + tlv('01', input.soTaiKhoan)
  const thongTin = tlv('00', 'A000000727') + tlv('01', dinhDanh) + tlv('02', 'QRIBFTTA')
  let payload = tlv('00', '01') + tlv('01', input.soTien !== undefined ? '12' : '11') + tlv('38', thongTin) + tlv('53', '704') + (input.soTien !== undefined ? tlv('54', String(input.soTien)) : '') + tlv('58', 'VN')
  if (input.noiDung) payload += tlv('62', tlv('08', chuanHoaNoiDung(input.noiDung)))
  payload += '6304'
  return payload + crc16(payload)
}
