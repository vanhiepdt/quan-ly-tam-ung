import { expect, it } from 'vitest'
import { CAU_HINH_GIAY_MAC_DINH, type BoiCanhGiay, type CanBo } from './giay'
import { apDungNguoiDeNghiMacDinh, apDungNguoiDeNghiTheoForm, apDungNguoiKy, apDungNguoiKyMacDinh, luaChonNguoiKy, truongPhongTheoNguoi } from './chon-nguoi-ky'
import { VAI_TRO_KY } from './vai-tro-ky'

const cb = (id: string, phong = 'Phòng Kế toán', chucDanh = 'Chuyên viên'): CanBo => ({
  id, hoTen: id, phong, chucDanh, gioiTinh: null, laLanhDao: false, dangHoatDong: true,
})
const nguoi = cb('Người mặc định')
const truong = cb('Trưởng kế toán', nguoi.phong!, 'Trưởng phòng')
const khac = cb('Trưởng đào tạo', 'Phòng Đào tạo', 'Trưởng phòng')
const ctx: BoiCanhGiay = {
  nguoiDeNghi: cb('Tài khoản đăng nhập'), canBo: [nguoi, truong, khac], taiKhoanTheoNguoiLayHd: {},
  cauHinh: { ...CAU_HINH_GIAY_MAC_DINH, nguoiDeNghiId: nguoi.id, truongPhongId: khac.id, keToanKiemSoatId: truong.id },
}
it('giữ người ký cài đặt và tự tìm trưởng phòng đúng phòng', () => {
  const { macDinh } = luaChonNguoiKy(ctx)
  expect(macDinh.nguoiDeNghiId).toBe(nguoi.id)
  expect(macDinh.keToanKiemSoatId).toBe(truong.id)
  expect(macDinh.truongPhongId).toBe(truong.id)
  expect(truongPhongTheoNguoi(khac, ctx.canBo, truong.id)).toBe(khac.id)
})
it('dùng đúng người đề nghị mặc định dù chưa mở phần giấy', () => {
  const result = apDungNguoiDeNghiMacDinh(ctx)
  expect(result.nguoiDeNghi).toEqual(nguoi)
  expect(result.cauHinh.nguoiDeNghiId).toBe(nguoi.id)
})
it('chốt đủ năm người ký mặc định, kể cả trưởng phòng suy ra từ người đề nghị', () => {
  const result = apDungNguoiKyMacDinh(ctx)
  expect(result.nguoiDeNghi).toEqual(nguoi)
  expect(result.cauHinh).toMatchObject({
    nguoiDeNghiId: nguoi.id,
    lanhDaoTiepKhachId: null,
    lanhDaoThanhToanId: null,
    truongPhongId: truong.id,
    keToanKiemSoatId: truong.id,
  })
})
it('dùng người đề nghị được chọn trong phần thông tin giấy', () => {
  const form = new FormData()
  form.set('giay_nguoiDeNghiId', khac.id)
  const result = apDungNguoiDeNghiTheoForm(ctx, form)
  expect(result.nguoiDeNghi).toEqual(khac)
  expect(result.cauHinh.nguoiDeNghiId).toBe(khac.id)
  form.set('giay_nguoiDeNghiId', 'không-tồn-tại')
  expect(() => apDungNguoiDeNghiTheoForm(ctx, form)).toThrow('không tồn tại')
})
it('giữ mặc định cùng phòng, không tự chọn cán bộ nghỉ hoặc nhiều trưởng phòng', () => {
  expect(truongPhongTheoNguoi(nguoi, ctx.canBo, truong.id)).toBe(truong.id)
  expect(truongPhongTheoNguoi(nguoi, [nguoi, { ...truong, dangHoatDong: false }], khac.id)).toBe('')
  expect(truongPhongTheoNguoi(nguoi, [truong, { ...truong, id: 'Khác' }], khac.id)).toBe('')
})
it('áp dụng đủ năm người ký chỉ cho lần lập giấy, không đổi cấu hình gốc', () => {
  const form = new FormData()
  const { macDinh } = luaChonNguoiKy(ctx)
  for (const vai of VAI_TRO_KY) form.set(`giay_${vai.id}`, macDinh[vai.id])
  const result = apDungNguoiKy(ctx, form)
  expect(result.nguoiDeNghi).toEqual(nguoi)
  expect(result.cauHinh.truongPhongId).toBe(truong.id)
  expect(ctx.cauHinh.truongPhongId).toBe(khac.id)
  form.set('giay_keToanKiemSoatId', 'Không tồn tại')
  expect(() => apDungNguoiKy(ctx, form)).toThrow('không tồn tại')
  form.delete('giay_keToanKiemSoatId')
  // Biểu mẫu cũ từng chỉ gửi người đề nghị. Vai trò thiếu phải giữ snapshot/mặc
  // định đã có trong bối cảnh thay vì từ chối một giao dịch hợp lệ.
  expect(apDungNguoiKy(ctx, form).cauHinh.keToanKiemSoatId).toBe(truong.id)
})
it('giữ luồng cũ khi không gửi người ký', () => {
  expect(apDungNguoiKy(ctx, new FormData())).toBe(ctx)
})
