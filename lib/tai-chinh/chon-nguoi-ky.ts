import type { BoiCanhGiay, CanBo } from './giay'
import { VAI_TRO_KY, type VaiTroKyId } from './vai-tro-ky'

export type NguoiKyGiay = Record<VaiTroKyId, string>
export type LuaChonNguoiKy = { canBo: CanBo[]; macDinh: NguoiKyGiay; taiKhoanTheoNguoiLayHd: BoiCanhGiay['taiKhoanTheoNguoiLayHd'] }
const chuanHoa = (s: string | null) => (s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')

// Giữ trưởng phòng mặc định nếu cùng phòng. Nếu không, chỉ tự chọn khi tìm được
// đúng một cán bộ đang hoạt động có chức danh Trưởng phòng trong phòng đó.
export function truongPhongTheoNguoi(nguoi: CanBo | undefined, ds: readonly CanBo[], macDinh: string): string {
  const phong = chuanHoa(nguoi?.phong ?? null)
  if (!phong) return macDinh
  const cungPhong = ds.filter(cb => cb.dangHoatDong && chuanHoa(cb.phong) === phong)
  if (cungPhong.some(cb => cb.id === macDinh)) return macDinh
  const truongPhong = cungPhong.filter(cb => /^trưởng phòng(?:\s|$)/u.test(chuanHoa(cb.chucDanh)))
  if (truongPhong.length === 1) return truongPhong[0].id
  return ''
}

export function luaChonNguoiKy(ctx: BoiCanhGiay): LuaChonNguoiKy {
  const canBo = ctx.canBo.filter(cb => cb.dangHoatDong)
  if (ctx.nguoiDeNghi.dangHoatDong && !canBo.some(cb => cb.id === ctx.nguoiDeNghi.id)) canBo.push(ctx.nguoiDeNghi)
  const macDinh = Object.fromEntries(VAI_TRO_KY.map(v => [v.id, canBo.some(cb => cb.id === ctx.cauHinh[v.id]) ? ctx.cauHinh[v.id] : ''])) as NguoiKyGiay
  macDinh.nguoiDeNghiId ||= ctx.nguoiDeNghi.dangHoatDong ? ctx.nguoiDeNghi.id : ''
  macDinh.truongPhongId = truongPhongTheoNguoi(canBo.find(cb => cb.id === macDinh.nguoiDeNghiId), canBo, macDinh.truongPhongId)
  return { canBo, macDinh, taiKhoanTheoNguoiLayHd: ctx.taiKhoanTheoNguoiLayHd }
}

// Khi người dùng không mở phần "Thông tin giấy đề nghị", giao dịch vẫn phải dùng
// đúng người đề nghị mặc định mà phần đó sẽ hiển thị nếu được mở.
export function apDungNguoiDeNghiMacDinh(ctx: BoiCanhGiay): BoiCanhGiay {
  const { canBo, macDinh } = luaChonNguoiKy(ctx)
  const nguoiDeNghi = canBo.find(cb => cb.id === macDinh.nguoiDeNghiId)
  if (!nguoiDeNghi) throw new Error('Chưa có người đề nghị đang hoạt động trong cấu hình giấy.')
  return {
    ...ctx,
    canBo,
    nguoiDeNghi,
    cauHinh: { ...ctx.cauHinh, nguoiDeNghiId: nguoiDeNghi.id },
  }
}

// Khi không mở phần giấy trên biểu mẫu, vẫn phải chốt đúng cả năm giá trị mà phần
// đó sẽ hiển thị. Điều này cũng lưu lại trưởng phòng được suy ra từ người đề nghị.
export function apDungNguoiKyMacDinh(ctx: BoiCanhGiay): BoiCanhGiay {
  const { canBo, macDinh } = luaChonNguoiKy(ctx)
  const nguoiDeNghi = canBo.find(cb => cb.id === macDinh.nguoiDeNghiId)
  if (!nguoiDeNghi) throw new Error('Chưa có người đề nghị đang hoạt động trong cấu hình giấy.')
  const cauHinh = { ...ctx.cauHinh }
  for (const vai of VAI_TRO_KY) cauHinh[vai.id] = macDinh[vai.id] || null
  return {
    ...ctx,
    canBo,
    nguoiDeNghi,
    cauHinh,
  }
}

// Chỉ dùng giá trị người đề nghị do form gửi khi người dùng đã mở phần giấy. ID
// được đối chiếu với danh sách cán bộ đang hoạt động ở máy chủ, không tin tên hiển thị.
export function apDungNguoiDeNghiTheoForm(ctx: BoiCanhGiay, form: FormData): BoiCanhGiay {
  const raw = form.get('giay_nguoiDeNghiId')
  if (raw === null) return apDungNguoiDeNghiMacDinh(ctx)
  const { canBo } = luaChonNguoiKy(ctx)
  const nguoiDeNghi = typeof raw === 'string' ? canBo.find(cb => cb.id === raw) : undefined
  if (!nguoiDeNghi) throw new Error('Người đề nghị không tồn tại hoặc đã ngừng hoạt động.')
  return {
    ...ctx,
    canBo,
    nguoiDeNghi,
    cauHinh: { ...ctx.cauHinh, nguoiDeNghiId: nguoiDeNghi.id },
  }
}

// Chỉ ghi đè bối cảnh của lần lập giấy này, không thay Cài đặt chung.
export function apDungNguoiKy(ctx: BoiCanhGiay, form: FormData): BoiCanhGiay {
  if (!VAI_TRO_KY.some(v => form.has(`giay_${v.id}`))) return ctx
  const { canBo } = luaChonNguoiKy(ctx)
  const cauHinh = { ...ctx.cauHinh }
  let nguoiDeNghi = ctx.nguoiDeNghi
  for (const vai of VAI_TRO_KY) {
    const value = form.get(`giay_${vai.id}`)
    // Chỉ người đề nghị đã chọn ở các biểu mẫu cũ vẫn hợp lệ: những vai trò còn
    // lại giữ giá trị mặc định đã được áp vào bối cảnh trước khi gọi hàm này.
    if (value === null) continue
    if (typeof value !== 'string') throw new Error('Thiếu thông tin người ký giấy đề nghị.')
    const cb = canBo.find(c => c.id === value)
    if (value && !cb) throw new Error(`${vai.ten} không tồn tại hoặc đã ngừng hoạt động.`)
    if (vai.id === 'nguoiDeNghiId') {
      if (!cb) throw new Error('Vui lòng chọn người đề nghị.')
      nguoiDeNghi = cb
    }
    cauHinh[vai.id] = value || null
  }
  return { ...ctx, canBo, cauHinh, nguoiDeNghi }
}
