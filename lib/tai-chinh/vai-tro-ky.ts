// Năm vai trò ký trên giấy đề nghị. Khai báo tách riêng khỏi phần đọc cấu hình để biểu mẫu
// ở trình duyệt dùng được cùng danh sách mà không kéo theo mã truy cập cơ sở dữ liệu.
export const VAI_TRO_KY = [
  { id: 'nguoiDeNghiId', ten: 'Người đề nghị' },
  { id: 'lanhDaoTiepKhachId', ten: 'Lãnh đạo duyệt giấy tiếp khách' },
  { id: 'lanhDaoThanhToanId', ten: 'Lãnh đạo duyệt giấy thanh toán' },
  { id: 'truongPhongId', ten: 'Trưởng phòng' },
  { id: 'keToanKiemSoatId', ten: 'Kế toán kiểm soát' },
] as const

export type VaiTroKyId = typeof VAI_TRO_KY[number]['id']
