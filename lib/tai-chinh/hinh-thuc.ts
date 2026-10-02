import { HINH_THUC } from './kieu'

// Chỉ hai hình thức này gắn với một đơn vị tiếp khách cụ thể. Ba hình thức còn lại
// là dòng tiền nội bộ (tạm ứng, giao tiền, nộp hoàn) nên không có đơn vị.
export const HINH_THUC_CAN_DON_VI: readonly string[] = [HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG]

export function canDonVi(hinhThuc: string): boolean {
  return HINH_THUC_CAN_DON_VI.includes(hinhThuc)
}

// Nội dung của giao dịch có đơn vị luôn được suy ra từ tên đơn vị ở phía máy chủ.
// Client gửi lên gì cũng bị bỏ qua để nội dung không lệch khỏi đơn vị.
export function noiDungTheoDonVi(tenDonVi: string): string {
  return `Tiếp ${tenDonVi}`.slice(0, 1000)
}

const HINH_THUC_NOI_DUNG_CO_DINH = new Set<string>([
  HINH_THUC.TAM_UNG_THEM, HINH_THUC.GIAO_CHI_THUY,
  HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ,
])

// Các dòng tiền nội bộ luôn lấy đúng tên hình thức, không cho client ghi đè nội dung.
export function noiDungTheoHinhThuc(hinhThuc: string): string | undefined {
  return HINH_THUC_NOI_DUNG_CO_DINH.has(hinhThuc) ? hinhThuc : undefined
}

// Hình thức thanh toán in trên giấy đề nghị: tiền mặt, chuyển khoản, hoặc hoàn tạm ứng.
// Cả ba cùng nằm trong một trường, nhưng mỗi hình thức giao dịch chỉ được dùng một phần:
//   - Tạm ứng thêm: giấy đề nghị tạm ứng có hai ô vuông Chuyển khoản / Tiền mặt.
//   - Hoàn tạm ứng: máy tự điền "Hoàn tạm ứng", người dùng không chọn gì.
//   - Cơ quan trả thẳng: người dùng chọn Tiền mặt hoặc Chuyển khoản.
// "Đưa tiền CQ trả thẳng cho Chị Thúy" cũng là dòng tiền nội bộ nhưng phải ghi
// nhận tiền mặt hoặc chuyển khoản để đối chiếu khoản đã đưa.
export const HINH_THUC_THANH_TOAN = {
  TIEN_MAT: 'tien_mat', CHUYEN_KHOAN: 'chuyen_khoan', HOAN_TAM_UNG: 'hoan_tam_ung',
} as const
export type HinhThucThanhToan = typeof HINH_THUC_THANH_TOAN[keyof typeof HINH_THUC_THANH_TOAN]

export const NHAN_HINH_THUC_THANH_TOAN: Record<HinhThucThanhToan, string> = {
  [HINH_THUC_THANH_TOAN.TIEN_MAT]: 'Tiền mặt',
  [HINH_THUC_THANH_TOAN.CHUYEN_KHOAN]: 'Chuyển khoản',
  [HINH_THUC_THANH_TOAN.HOAN_TAM_UNG]: 'Hoàn tạm ứng',
}

export const DS_HINH_THUC_THANH_TOAN = [
  HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN, HINH_THUC_THANH_TOAN.HOAN_TAM_UNG,
] as const

export function laHinhThucThanhToan(v: unknown): v is HinhThucThanhToan {
  return (DS_HINH_THUC_THANH_TOAN as readonly unknown[]).includes(v)
}

// Những lựa chọn mà một hình thức giao dịch cho phép. Hình thức không lập giấy trả về
// danh sách rỗng, nghĩa là trường này phải để trống.
const LUA_CHON_THEO_HINH_THUC: Record<string, readonly HinhThucThanhToan[]> = {
  [HINH_THUC.TAM_UNG_THEM]: [HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN],
  [HINH_THUC.HOAN_TAM_UNG]: [HINH_THUC_THANH_TOAN.HOAN_TAM_UNG],
  [HINH_THUC.CQ_TRA_THANG]: [HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN],
  [HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY]: [HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN],
}

export function dsHinhThucThanhToan(hinhThuc: string): readonly HinhThucThanhToan[] {
  return LUA_CHON_THEO_HINH_THUC[hinhThuc] ?? []
}

// Hoàn tạm ứng chỉ có một lựa chọn nên máy tự điền. Hai hình thức còn lại lấy Tiền mặt
// làm mặc định vì đó là cách chi tiền mặt thường dùng của đơn vị.
export function hinhThucThanhToanMacDinh(hinhThuc: string): HinhThucThanhToan | null {
  return dsHinhThucThanhToan(hinhThuc)[0] ?? null
}

// Hoàn tạm ứng luôn giữ nguyên số lẻ. Cơ quan trả thẳng bằng tiền mặt mặc định
// làm tròn xuống hàng nghìn, còn chuyển khoản giữ nguyên số tiền nguồn.
export function lamTronXuongHangNghinMacDinh(hinhThuc: string, hinhThucThanhToan: string | null | undefined): boolean {
  return hinhThuc === HINH_THUC.CQ_TRA_THANG
    && hinhThucThanhToan === HINH_THUC_THANH_TOAN.TIEN_MAT
}

// Giá trị có hợp với hình thức giao dịch không. Bỏ trống luôn hợp lệ vì máy tự điền mặc
// định của hình thức; chỉ giá trị người dùng gửi lên mới phải nằm trong danh sách cho phép.
// Hình thức không lập giấy không có danh sách nên mọi giá trị đều bị từ chối.
export function hopLeHinhThucThanhToan(hinhThuc: string, giaTri: unknown): boolean {
  if (giaTri === null || giaTri === undefined || giaTri === '') return true
  return dsHinhThucThanhToan(hinhThuc).includes(giaTri as HinhThucThanhToan)
}

// Dùng khi đọc dữ liệu cũ hoặc một nguồn nhập chưa biết cờ mới. Trạng thái phí
// khác "Không phát sinh" là dấu hiệu rõ ràng rằng người dùng đã muốn tính phí.
export function coTinhPhiMacDinh(hinhThuc: string, trangThaiTtPhi: string | null | undefined, chiThucTe = false): boolean {
  if (chiThucTe) return false
  return hinhThuc === HINH_THUC.HOAN_TAM_UNG
    || (hinhThuc === HINH_THUC.CQ_TRA_THANG && trangThaiTtPhi !== 'Không phát sinh')
}

// Chuyển khoản thì giấy phải in kèm số tài khoản nhận tiền.
export function canTaiKhoanNhan(hinhThucThanhToan: string | null): boolean {
  return hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
}

// Mẫu giấy đề nghị tạm ứng có hai chỗ trống [[CK]] và [[TM]], nhưng chỉ in phương thức
// đã chọn. Chuyển khoản có thêm dòng tài khoản đã lưu; các giá trị khác (kể cả để trống)
// dùng tiền mặt là mặc định an toàn của giấy tạm ứng.
export function noiDungHinhThucTamUng(
  hinhThucThanhToan: string | null | undefined,
  dongTaiKhoanNhan: string | null | undefined,
): { CK: string; TM: string; noiDung: string } {
  const chuyenKhoan = hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
  const noiDung = chuyenKhoan
    ? (dongTaiKhoanNhan ? `Chuyển khoản – ${dongTaiKhoanNhan}` : 'Chuyển khoản')
    : 'Tiền mặt'
  return chuyenKhoan
    ? { CK: noiDung, TM: '', noiDung }
    : { CK: '', TM: noiDung, noiDung }
}
