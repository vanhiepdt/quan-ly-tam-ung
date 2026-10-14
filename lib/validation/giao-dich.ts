import { z } from 'zod'
import { schemaChiTietHoaDon } from '@/lib/kiem-tra/phan-bo-phu-luc'
import { canDonVi, HINH_THUC_THANH_TOAN, hopLeHinhThucThanhToan, noiDungTheoHinhThuc } from '@/lib/tai-chinh/hinh-thuc'
import { CO_SO_TINH_PHI, DS_CO_SO_TINH_PHI, HINH_THUC } from '@/lib/tai-chinh/kieu'

const tien = z.coerce.number({ invalid_type_error: 'Số tiền không hợp lệ.' })
  .finite('Số tiền không hợp lệ.')
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER, 'Số tiền vượt giới hạn an toàn.')

// Accept null, undefined, or string. Transform empty string to null.
const stringOrNull = z.union([
  z.null(),
  z.undefined(),
  z.string().trim().transform(val => val === '' ? null : val)
]).transform(val => val === undefined ? null : val)

const textOrNull = (max: number) => stringOrNull.pipe(z.string().max(max).nullable())

const soTaiKhoanOrNull = stringOrNull.refine(value => value === null || /^\d{1,19}$/.test(value), {
  message: 'Số tài khoản phải gồm từ 1 đến 19 chữ số.',
})

const uuidOrNull = z.union([
  z.null(),
  z.undefined(),
  z.literal(''),
  z.string().uuid('Mã đơn vị không hợp lệ.'),
]).transform(val => (val === undefined || val === '' ? null : val))

const checkbox = z.preprocess(value => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === true || value === '1' || value === 'true' || value === 'on') return true
  if (value === false || value === '0' || value === 'false' || value === 'off') return false
  return value
}, z.boolean().optional())

export const schemaGiaoDich = z.object({
  ngay: z.string().date(),
  ngay_de_nghi: z.union([z.null(), z.undefined(), z.string().date()]).transform(val => val === undefined ? null : val),
  // Form gửi chuỗi rỗng thành null. Ba hình thức nội bộ và hai hình thức có đơn vị
  // đều để máy chủ điền nội dung, nên null / rỗng đều hợp lệ ở đây.
  noi_dung: z.union([z.null(), z.undefined(), z.string()])
    .transform(val => (typeof val === 'string' ? val.trim() : ''))
    .pipe(z.string().max(1000)),
  don_vi_id: uuidOrNull,
  ky_hieu_hd: stringOrNull,
  so_hd: stringOrNull,
  loai_hd: stringOrNull,
  trang_thai_hd: stringOrNull,
  hinh_thuc: z.string().min(1),
  chi_thuc_te: checkbox.transform(value => value ?? false),
  tong_tien: tien.default(0),
  tien_ruou_bia: tien.default(0),
  chi_tiet_hoa_don: z.preprocess((value) => {
    if (value === '') return null
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) as unknown } catch { return value }
  }, schemaChiTietHoaDon.nullish()).transform(value => value ?? null),
  // Giá trị ghi đè cho cột Hoàn ứng/CQ trả thẳng. Nếu nguồn nhập không gửi
  // trường này (intake hoặc dữ liệu cũ), service sẽ lấy tổng tiền trừ rượu bia.
  tien_duoc_thanh_toan: z.union([z.null(), z.undefined(), tien]).transform(val => val === undefined ? null : val),
  // Nguồn không làm tròn được form giữ riêng để khi bỏ tích có thể khôi phục số tiền.
  // Các nguồn nhập cũ không gửi trường này; service sẽ suy ra từ số tiền hiện có.
  tien_duoc_thanh_toan_goc: z.union([z.null(), z.undefined(), tien]).transform(val => val === undefined ? null : val),
  // Không default ở schema: mặc định phụ thuộc đồng thời vào hình thức giao
  // dịch và hình thức thanh toán, nên được áp dụng ở service nghiệp vụ.
  lam_tron_xuong_hang_nghin: checkbox,
  tam_ung_tu_cq: tien.default(0),
  giao_tien_chi_thuy: tien.default(0),
  dua_tien_cq_tra_thang_cho_chi_thuy: tien.default(0),
  hoan_ung_tien_mat: tien.default(0),
  nguoi_lay_hd_id: uuidOrNull,
  phi_lay_hd_ghi_de: z.union([z.null(), z.undefined(), tien]).transform(val => val === undefined ? null : val),
  co_tinh_phi_lay_hd: checkbox,
  co_so_tinh_phi_lay_hd: z.enum(DS_CO_SO_TINH_PHI).default(CO_SO_TINH_PHI.TONG_TIEN),
  trang_thai_tt_phi: stringOrNull,
  ghi_chu: stringOrNull,
  // Tiền mặt / chuyển khoản / hoàn tạm ứng. Hình thức giao dịch quyết định giá trị nào
  // hợp lệ, nên chỉ kiểm tra được kiểu ở đây; ràng buộc theo hình thức nằm ở refine dưới.
  hinh_thuc_thanh_toan: z.union([z.null(), z.undefined(), z.string()])
    .transform(val => (val === undefined || val === '' ? null : val)),
  // Chỉ dùng khi in giấy thanh toán bằng chuyển khoản. Mặc định là tài khoản đã
  // lưu; bỏ chọn thì phải nhập ít nhất số tài khoản, các thông tin còn lại là tùy chọn.
  dung_tai_khoan_mac_dinh: checkbox.default(true),
  tai_khoan_nhan_so: soTaiKhoanOrNull,
  tai_khoan_nhan_ngan_hang: textOrNull(200),
  tai_khoan_nhan_chi_nhanh: textOrNull(200),
  tai_khoan_nhan_ten_chu_tk: textOrNull(200),
}).refine((d) => d.tien_ruou_bia <= d.tong_tien, {
  message: 'Tiền không được thanh toán không được vượt tổng tiền',
  path: ['tien_ruou_bia']
}).refine((d) => !d.chi_thuc_te || canDonVi(d.hinh_thuc), {
  message: 'Chi thực tế chỉ áp dụng cho Hoàn tạm ứng và Cơ quan trả thẳng.',
  path: ['chi_thuc_te']
}).refine((d) => canDonVi(d.hinh_thuc) || Boolean(noiDungTheoHinhThuc(d.hinh_thuc)) || d.noi_dung.length > 0, {
  message: 'Nội dung không được để trống.',
  path: ['noi_dung']
}).refine((d) => !canDonVi(d.hinh_thuc) || d.don_vi_id !== null, {
  // Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới gắn đơn vị, nhưng khi đã gắn thì bắt buộc.
  message: 'Hình thức này phải chọn đơn vị tiếp khách.',
  path: ['don_vi_id']
}).refine((d) => canDonVi(d.hinh_thuc) || d.don_vi_id === null, {
  // Chiều ngược lại: dòng tiền nội bộ không được mang đơn vị, kể cả khi client cố gửi lên.
  message: 'Hình thức này không gắn với đơn vị tiếp khách.',
  path: ['don_vi_id']
}).refine((d) => canDonVi(d.hinh_thuc) || d.tien_duoc_thanh_toan === null, {
  message: 'Chỉ giao dịch có hóa đơn mới có tiền được hoàn/thanh toán.',
  path: ['tien_duoc_thanh_toan']
}).refine((d) => canDonVi(d.hinh_thuc) || d.tien_duoc_thanh_toan_goc === null, {
  message: 'Chỉ giao dịch có hóa đơn mới có số tiền nguồn hoàn/thanh toán.',
  path: ['tien_duoc_thanh_toan_goc']
}).refine((d) => canDonVi(d.hinh_thuc) || d.co_so_tinh_phi_lay_hd === CO_SO_TINH_PHI.TONG_TIEN, {
  message: 'Chỉ giao dịch có hóa đơn mới được chọn tính phí theo tiền được hoàn/thanh toán.',
  path: ['co_so_tinh_phi_lay_hd']
}).refine((d) => hopLeHinhThucThanhToan(d.hinh_thuc, d.hinh_thuc_thanh_toan), {
  // Mỗi hình thức giao dịch chỉ lập một số giấy nhất định, và mỗi giấy chỉ in được một
  // số hình thức thanh toán. Client cố gửi giá trị lạ thì bị từ chối thay vì lưu rác.
  message: 'Hình thức thanh toán không hợp với hình thức giao dịch.',
  path: ['hinh_thuc_thanh_toan']
}).refine((d) => d.hinh_thuc_thanh_toan !== HINH_THUC_THANH_TOAN.CHUYEN_KHOAN || d.dung_tai_khoan_mac_dinh !== false || d.tai_khoan_nhan_so !== null, {
  message: 'Hãy nhập số tài khoản khi không dùng tài khoản mặc định.',
  path: ['tai_khoan_nhan_so'],
}).refine((d) => d.hinh_thuc === HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY || d.dua_tien_cq_tra_thang_cho_chi_thuy === 0, {
  message: 'Khoản đưa tiền CQ trả thẳng chỉ dùng cho đúng hình thức giao dịch.',
  path: ['dua_tien_cq_tra_thang_cho_chi_thuy'],
}).refine((d) => d.hinh_thuc !== HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY
  || (d.tam_ung_tu_cq === 0 && d.giao_tien_chi_thuy === 0 && d.hoan_ung_tien_mat === 0), {
  message: 'Đưa tiền CQ trả thẳng cho Chị Thúy không dùng các khoản tiền tạm ứng.',
  path: ['dua_tien_cq_tra_thang_cho_chi_thuy'],
})

export type DauVaoGiaoDich = z.infer<typeof schemaGiaoDich>
