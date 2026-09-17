export const HINH_THUC = {
  TAM_UNG_THEM: 'Tạm ứng thêm', GIAO_CHI_THUY: 'Giao tiền chị Thúy',
  HOAN_TAM_UNG: 'Hoàn tạm ứng', CQ_TRA_THANG: 'Cơ quan trả thẳng',
  NOP_HOAN_CQ: 'Nộp hoàn CQ',
} as const
export const TRANG_THAI = { HOP_LE: 'Hợp lệ', CHO_HD: 'Chờ HĐ', PHI_DA_TRA: 'Đã thanh toán' } as const

// Tài khoản nhận tiền của người lấy hóa đơn. Một tài khoản dùng cho cả hai việc: nhận
// tiền thanh toán khi chuyển khoản và trả phí lấy hóa đơn.
export type TaiKhoanNhan = {
  soTaiKhoan: string
  nganHang: string | null
  tenChuTk: string | null
}

export type GiaoDichTho = {
  id: string; ngay: string; soThuTu: number; taoLuc: string; noiDung: string; kyHieuHd: string | null; soHd: string | null; loaiHd: string | null;
  trangThaiHd: string; hinhThuc: string; tongTien: number; tienRuouBia: number; tamUngTuCq: number; giaoTienChiThuy: number; hoanUngTienMat: number;
  nguoiLayHdId: string | null; nguoiLayHdTen: string | null; phiLayHdGhiDe: number | null; trangThaiTtPhi: string; ghiChu: string | null;
  donViId: string | null; donViTen: string | null;
  // Tiền mặt / chuyển khoản / hoàn tạm ứng, in ở dòng "Hình thức thanh toán" của giấy
  // đề nghị. Cơ quan trả thẳng chọn tiền mặt hoặc chuyển khoản; hoàn tạm ứng thì máy điền.
  hinhThucThanhToan: string | null;
  // Tài khoản nhận tiền của người lấy hóa đơn, chỉ dùng khi hình thức thanh toán là
  // chuyển khoản. Nạp sẵn ở đây để in giấy không phải truy vấn thêm.
  taiKhoanNhan: TaiKhoanNhan | null;
  coHoaDon: boolean; coChuyenKhoan: boolean;
}
export type GiaoDichTinh = GiaoDichTho & { hoanTamUng:number; cqTraThang:number; phiLayHd:number; duLyThuyet:number; duThucTe:number; duDangCam:number }
export type ThamSoTinh = { tyLePhiChung: number; tyLeTheoNguoi: Record<string,number> }