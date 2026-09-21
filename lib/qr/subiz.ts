// TypeScript adaptation of the VND/account-transfer subset of subiz/vietqr.
// Source: https://github.com/subiz/vietqr/blob/master/vietqr.go (MIT)
// See docs/licenses/subiz-vietqr.txt. No Go runtime or remote QR API required.
// Validation belongs to vietqr.ts: unlike upstream we never truncate financial data.
function tlv(id: string, value: string) {
  if (!/^[\x20-\x7e]*$/.test(value) || value.length > 99) throw new Error('Dữ liệu VietQR vượt giới hạn mã hóa.')
  return id + String(value.length).padStart(2, '0') + value
}
export function crc16(value: string) {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? ((crc << 1) ^ 0x1021) : (crc << 1)) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
// Equivalent to GenerateWithParams for validated ASCII, VND, QRIBFTTA and VN.
export function generateAccountTransfer(bin: string, account: string, amount?: number, note = '') {
  const beneficiary = tlv('00', bin) + tlv('01', account)
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA')
  let payload = tlv('00', '01') + tlv('01', amount !== undefined ? '12' : '11') + tlv('38', merchant)
    + tlv('53', '704') + (amount !== undefined ? tlv('54', String(amount)) : '') + tlv('58', 'VN')
  if (note) payload += tlv('62', tlv('08', note))
  payload += '6304'
  return payload + crc16(payload)
}
