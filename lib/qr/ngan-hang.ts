import data from './ngan-hang.json'
import { taoPayloadVietQR } from './vietqr'

// Snapshot API VietQR.io; không gửi thông tin tài khoản tới dịch vụ bên ngoài.
export const NGAN_HANG = [...data].sort((a, b) => a.shortName.localeCompare(b.shortName, 'vi'))
export function nganHangTheoBin(bin: string | null | undefined) {
  return NGAN_HANG.find(b => b.bin === bin?.trim())
}
export function taoQrThu(input: { bin: string; soTaiKhoan: string }) {
  if (!nganHangTheoBin(input.bin)) throw new Error('Vui lòng chọn ngân hàng trong danh sách.')
  return taoPayloadVietQR({ bin: input.bin, soTaiKhoan: input.soTaiKhoan.trim() })
}
