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
  HINH_THUC.TAM_UNG_THEM, HINH_THUC.GIAO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ,
])

// Tạm ứng thêm / Giao tiền chị Thúy / Nộp hoàn CQ: nội dung = đúng tên hình thức, không điền tay.
export function noiDungTheoHinhThuc(hinhThuc: string): string | undefined {
  return HINH_THUC_NOI_DUNG_CO_DINH.has(hinhThuc) ? hinhThuc : undefined
}

// Hình thức thanh toán in trên giấy đề nghị: tiền mặt, chuyển khoản, hoặc hoàn tạm ứng.
// Cả ba cùng nằm trong một trường, nhưng mỗi hình thức giao dịch chỉ được dùng một phần:
//   - Tạm ứng thêm: giấy đề nghị tạm ứng có hai ô vuông Chuyển khoản / Tiền mặt.
//   - Hoàn tạm ứng: máy tự điền "Hoàn tạm ứng", người dùng không chọn gì.
//   - Cơ quan trả thẳng: người dùng chọn Tiền mặt hoặc Chuyển khoản.
// Hai hình thức còn lại là dòng tiền nội bộ, không lập giấy nên không có hình thức thanh toán.
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
}

export function dsHinhThucThanhToan(hinhThuc: string): readonly HinhThucThanhToan[] {
  return LUA_CHON_THEO_HINH_THUC[hinhThuc] ?? []
}

// Hoàn tạm ứng chỉ có một lựa chọn nên máy tự điền. Hai hình thức còn lại lấy Tiền mặt
// làm mặc định vì đó là cách chi tiền mặt thường dùng của đơn vị.
export function hinhThucThanhToanMacDinh(hinhThuc: string): HinhThucThanhToan | null {
  return dsHinhThucThanhToan(hinhThuc)[0] ?? null
}

// Giá trị có hợp với hình thức giao dịch không. Bỏ trống luôn hợp lệ vì máy tự điền mặc
// định của hình thức; chỉ giá trị người dùng gửi lên mới phải nằm trong danh sách cho phép.
// Hình thức không lập giấy không có danh sách nên mọi giá trị đều bị từ chối.
export function hopLeHinhThucThanhToan(hinhThuc: string, giaTri: unknown): boolean {
  if (giaTri === null || giaTri === undefined || giaTri === '') return true
  return dsHinhThucThanhToan(hinhThuc).includes(giaTri as HinhThucThanhToan)
}

// Chuyển khoản thì giấy phải in kèm số tài khoản nhận tiền.
export function canTaiKhoanNhan(hinhThucThanhToan: string | null): boolean {
  return hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
}

// Ô vuông in trên giấy đề nghị tạm ứng. Giấy này chỉ có hai ô Chuyển khoản / Tiền mặt;
// mọi giá trị khác — kể cả để trống — đều in ra ô Tiền mặt. Mẫu Word chỉ có hai chỗ
// trống [[CK]] và [[TM]] đứng sát nhau nên nhãn phải nằm trong chính giá trị thay vào.
export function oVuongTamUng(hinhThucThanhToan: string | null): { CK: string; TM: string } {
  const chuyenKhoan = hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
  return {
    CK: `${chuyenKhoan ? '☒' : '☐'} Chuyển khoản`,
    TM: `${chuyenKhoan ? '☐' : '☒'} Tiền mặt`,
  }
}
