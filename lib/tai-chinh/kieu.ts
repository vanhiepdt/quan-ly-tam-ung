export const HINH_THUC = {
  TAM_UNG_THEM: 'Tạm ứng thêm', GIAO_CHI_THUY: 'Giao tiền chị Thúy',
  DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY: 'Đưa tiền CQ trả thẳng cho Chị Thúy',
  HOAN_TAM_UNG: 'Hoàn tạm ứng', CQ_TRA_THANG: 'Cơ quan trả thẳng',
  NOP_HOAN_CQ: 'Nộp hoàn CQ',
} as const
export const DS_HINH_THUC = [
  HINH_THUC.TAM_UNG_THEM, HINH_THUC.GIAO_CHI_THUY, HINH_THUC.HOAN_TAM_UNG,
  HINH_THUC.CQ_TRA_THANG, HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ,
] as const
export const TRANG_THAI = { HOP_LE: 'Hợp lệ', CHO_HD: 'Chờ HĐ', PHI_DA_TRA: 'Đã thanh toán' } as const

// Tài khoản nhận tiền của người lấy hóa đơn. Một tài khoản dùng cho cả hai việc: nhận
// tiền thanh toán khi chuyển khoản và trả phí lấy hóa đơn.
export type TaiKhoanNhan = {
  soTaiKhoan: string
  nganHang: string | null
  tenChuTk: string | null
  chiNhanh?: string | null
  canBoId?: string | null
}

export type GiaoDichTho = {
  id: string; ngay: string; ngayDeNghi?: string | null; soThuTu: number; taoLuc: string; noiDung: string; kyHieuHd: string | null; soHd: string | null; loaiHd: string | null;
  trangThaiHd: string; hinhThuc: string; tongTien: number; tienRuouBia: number; tamUngTuCq: number; giaoTienChiThuy: number; hoanUngTienMat: number;
  // Optional để máy chủ vẫn đọc được dữ liệu trước migration; chuyenDongGiaoDich
  // luôn chuẩn hóa thành 0 khi cột chưa có trong kết quả truy vấn.
  duaTienCqTraThangChoChiThuy?: number;
  // Dữ liệu cũ không có cờ này được coi là chưa chọn Chi thực tế.
  chiThucTe?: boolean;
  // Giá trị thực tế được hoàn/thanh toán cho giao dịch có hóa đơn. Dữ liệu cũ
  // có thể không có trường này, khi đó máy suy ra từ tổng tiền trừ rượu bia.
  tienDuocThanhToan?: number | null; tienDuocThanhToanGoc?: number | null; lamTronXuongHangNghin?: boolean;
  nguoiDeNghiId: string | null; nguoiDeNghiTen: string | null; nguoiLayHdId: string | null; nguoiLayHdTen: string | null; phiLayHdGhiDe: number | null; coTinhPhi: boolean; trangThaiTtPhi: string; ghiChu: string | null;
  // Năm người ký được chốt cùng giao dịch. Các trường optional để dữ liệu trước
  // migration vẫn đi qua các hàm tính toán và in giấy an toàn.
  lanhDaoTiepKhachId?: string | null; lanhDaoThanhToanId?: string | null;
  truongPhongId?: string | null; keToanKiemSoatId?: string | null;
  thongTinGiayDaChot?: boolean;
  donViId: string | null; donViTen: string | null;
  // Tiền mặt / chuyển khoản / hoàn tạm ứng, in ở dòng "Hình thức thanh toán" của giấy
  // đề nghị. Cơ quan trả thẳng chọn tiền mặt hoặc chuyển khoản; hoàn tạm ứng thì máy điền.
  hinhThucThanhToan: string | null;
  // Tài khoản nhận tiền của người lấy hóa đơn, chỉ dùng khi hình thức thanh toán là
  // chuyển khoản. Nạp sẵn ở đây để in giấy không phải truy vấn thêm.
  taiKhoanNhan: TaiKhoanNhan | null;
  // Snapshot tài khoản người dùng nhập riêng cho giao dịch; undefined/null nghĩa là
  // giấy dùng tài khoản mặc định đã lưu trong bối cảnh in.
  taiKhoanNhanGhiDe?: TaiKhoanNhan | null;
  coHoaDon: boolean; coChuyenKhoan: boolean;
}
export type GiaoDichTinh = GiaoDichTho & {
  duaTienCqTraThangChoChiThuy: number
  hoanTamUng: number
  cqTraThang: number
  phiLayHd: number
  duTienCqTraThang: number
  tongTienDuaChiThuy: number
  duLyThuyet: number
  duThucTe: number
  duDangCam: number
  duHiepDangCam: number
}
export type ThamSoTinh = { tyLePhiChung: number; tyLeTheoNguoi: Record<string,number> }
