export function laSoTienHopLe(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

// Không để giá trị đọc hóa đơn lỗi ghi đè số hiện có trong form.
export function chuoiTienHopLe(value: unknown, hienTai: string): string {
  return laSoTienHopLe(value) ? String(value) : hienTai
}
