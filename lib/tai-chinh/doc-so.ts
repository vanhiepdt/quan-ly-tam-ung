// Đọc số tiền ra chữ để điền vào các giấy đề nghị.
//
// Quy tắc đọc theo chuẩn tiếng Việt: nhóm ba chữ số, đọc đủ "trăm/mươi/lẻ" ở giữa,
// và các biến thể một/mốt, bốn/tư, năm/lăm. Hàm thuần, không phụ thuộc gì bên ngoài.

const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const
// Bậc của từng nhóm ba chữ số, tính từ phải sang trái.
const BAC = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'] as const

const GIỚI_HẠN = Number.MAX_SAFE_INTEGER

function docNhom(baChuSo: number, batBuocTram: boolean): string {
  const tram = Math.floor(baChuSo / 100)
  const chuc = Math.floor((baChuSo % 100) / 10)
  const donVi = baChuSo % 10
  const phan: string[] = []
  if (tram > 0 || batBuocTram) phan.push(`${CHU_SO[tram]} trăm`)
  if (chuc === 0 && donVi === 0) return phan.join(' ')
  if (chuc === 0) {
    // "lẻ" chỉ xuất hiện khi phía trước đã có hàng trăm, ví dụ "một trăm lẻ năm".
    phan.push(`${tram > 0 || batBuocTram ? 'lẻ ' : ''}${CHU_SO[donVi]}`)
    return phan.join(' ')
  }
  if (chuc === 1) {
    phan.push(donVi === 5 ? 'mười lăm' : donVi === 0 ? 'mười' : `mười ${CHU_SO[donVi]}`)
    return phan.join(' ')
  }
  const duoi = donVi === 0 ? '' : donVi === 1 ? ' mốt' : donVi === 4 ? ' tư' : donVi === 5 ? ' lăm' : ` ${CHU_SO[donVi]}`
  phan.push(`${CHU_SO[chuc]} mươi${duoi}`)
  return phan.join(' ')
}

// Trả về chữ không kèm đơn vị tiền, để mẫu giấy tự thêm "đồng" ở chỗ của nó.
export function docSoTien(soTien: number): string {
  if (!Number.isSafeInteger(soTien)) throw new Error('Số tiền phải là số nguyên trong giới hạn an toàn.')
  if (soTien < 0) throw new Error('Số tiền không được âm.')
  if (soTien === 0) return 'Không'

  const nhom: number[] = []
  for (let con = soTien; con > 0; con = Math.floor(con / 1000)) nhom.push(con % 1000)

  const phan: string[] = []
  for (let i = nhom.length - 1; i >= 0; i--) {
    const giaTri = nhom[i]
    if (giaTri === 0) continue
    // Nhóm ở giữa mà dưới 100 thì phải đọc "không trăm" cho khỏi nhập nhằng bậc.
    const batBuocTram = i < nhom.length - 1 && giaTri < 100
    const chu = docNhom(giaTri, batBuocTram)
    phan.push(BAC[i] ? `${chu} ${BAC[i]}` : chu)
  }
  const cau = phan.join(' ')
  return cau.charAt(0).toUpperCase() + cau.slice(1)
}

export function hopLeDocSo(soTien: unknown): boolean {
  return typeof soTien === 'number' && Number.isSafeInteger(soTien) && soTien >= 0 && soTien <= GIỚI_HẠN
}
