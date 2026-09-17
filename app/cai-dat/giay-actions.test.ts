import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { query, batBuocVaiTro, revalidatePath, docCauHinhGiay } = vi.hoisted(() => ({
  query: vi.fn(),
  batBuocVaiTro: vi.fn(),
  revalidatePath: vi.fn(),
  docCauHinhGiay: vi.fn(),
}))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/tai-chinh/cau-hinh-giay')>(),
  docCauHinhGiay,
}))

import { luuCauHinhGiay, docDuLieuCauHinhGiay } from './giay-actions'
import { KHOA_CAU_HINH_GIAY, VAI_TRO_KY } from '@/lib/tai-chinh/cau-hinh-giay'

const actor = '7b030fce-106e-477f-9e54-bf4a01a51088'
const canBo = '261796ee-8132-4a13-a887-5f1e1c8e92d3'
const nguoiLayHd = '0f0c8c1e-9a2b-4d3c-8e5f-1a2b3c4d5e6f'

function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  data.set('ten_don_vi', ' Trung tâm Đào tạo ')
  data.set('dia_danh', ' Hà Nội ')
  data.set('ly_do_tam_ung', ' Chi tiêu hành chính ')
  data.set('thoi_han_thanh_toan', ' Sau khi hoàn thành công việc ')
  for (const vaiTro of VAI_TRO_KY) data.set(`ky_${vaiTro.id}`, canBo)
  data.set('nguoi_lay_hd_mac_dinh', nguoiLayHd)
  // Client input must never override the authenticated audit actor.
  data.set('nguoi_sua', 'forged-actor')
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '') data.delete(k)
    else data.set(k, v)
  }
  return data
}

// Cấu hình được ghi bằng một câu lệnh duy nhất nên khoá và giá trị phải đi theo đúng thứ
// tự khai báo trong KHOA_CAU_HINH_GIAY, nếu không giấy in sẽ nhận nhầm giá trị.
function giaTriTheoKhoa() {
  const [, [khoa, giaTri]] = query.mock.calls[0]
  return new Map<string, string>(khoa.map((k: string, i: number) => [k, giaTri[i]]))
}

beforeEach(() => {
  vi.resetAllMocks()
  batBuocVaiTro.mockResolvedValue({ id: actor, vai_tro: 'admin' })
  query.mockResolvedValue({ rowCount: 6, rows: [] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('luuCauHinhGiay', () => {
  it.each(['/dang-nhap', '/403'])('preserves role guard redirect to %s without writes', async (destination) => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${destination};307;` })
    batBuocVaiTro.mockRejectedValue(redirect)
    await expect(luuCauHinhGiay({}, new FormData())).rejects.toBe(redirect)
    expect(batBuocVaiTro).toHaveBeenCalledExactlyOnceWith('admin')
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('writes every key in one statement and only then revalidates', async () => {
    query.mockImplementation(async () => {
      expect(revalidatePath).not.toHaveBeenCalled()
      return { rowCount: 6, rows: [] }
    })
    expect(await luuCauHinhGiay({}, form())).toEqual({ thanhCong: 'Đã lưu thông tin giấy đề nghị.' })
    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0]
    expect(sql).toContain('on conflict (khoa) do update')
    expect(params).toHaveLength(2)
    const bang = giaTriTheoKhoa()
    expect([...bang.keys()]).toEqual(Object.values(KHOA_CAU_HINH_GIAY))
    // Chuỗi được cắt khoảng trắng và lưu dạng JSON để đọc lại đúng kiểu.
    expect(bang.get(KHOA_CAU_HINH_GIAY.tenDonVi)).toBe(JSON.stringify('Trung tâm Đào tạo'))
    expect(bang.get(KHOA_CAU_HINH_GIAY.diaDanh)).toBe(JSON.stringify('Hà Nội'))
    expect(bang.get(KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId)).toBe(JSON.stringify(nguoiLayHd))
    const ky = JSON.parse(bang.get(KHOA_CAU_HINH_GIAY.nguoiKyMacDinh)!)
    for (const vaiTro of VAI_TRO_KY) expect(ky[vaiTro.id]).toBe(canBo)
    expect(revalidatePath.mock.calls).toEqual([['/cai-dat'], ['/giao-dich']])
  })

  it('stores an unset role and an unset collector as empty rather than dropping the key', async () => {
    const data = form({ nguoi_lay_hd_mac_dinh: '' })
    for (const vaiTro of VAI_TRO_KY) data.delete(`ky_${vaiTro.id}`)
    expect(await luuCauHinhGiay({}, data)).toEqual({ thanhCong: 'Đã lưu thông tin giấy đề nghị.' })
    const bang = giaTriTheoKhoa()
    expect(bang.get(KHOA_CAU_HINH_GIAY.nguoiLayHdMacDinhId)).toBe(JSON.stringify(''))
    expect(JSON.parse(bang.get(KHOA_CAU_HINH_GIAY.nguoiKyMacDinh)!)).toEqual(
      Object.fromEntries(VAI_TRO_KY.map(v => [v.id, null])))
  })

  it.each([
    ['ten_don_vi', 'Tên đơn vị không được để trống'],
    ['dia_danh', 'Địa danh không được để trống'],
    ['ly_do_tam_ung', 'Lý do tạm ứng không được để trống'],
    ['thoi_han_thanh_toan', 'Thời hạn thanh toán không được để trống'],
  ])('rejects a blank %s and writes nothing at all', async (field, message) => {
    expect(await luuCauHinhGiay({}, form({ [field]: '   ' }))).toEqual({ loi: message })
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects a collector that is not a code before writing', async () => {
    expect(await luuCauHinhGiay({}, form({ nguoi_lay_hd_mac_dinh: 'khong-phai-ma' })))
      .toEqual({ loi: 'Người được chọn không hợp lệ.' })
    expect(query).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns a safe error on a database failure without logging or revalidating', async () => {
    const error = Object.assign(new Error('secret database connection string'), { detail: 'private record' })
    query.mockRejectedValue(error)
    expect(await luuCauHinhGiay({}, form())).toEqual({ loi: 'Không lưu được thông tin giấy đề nghị. Vui lòng thử lại.' })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('docDuLieuCauHinhGiay', () => {
  it('returns the normalized configuration the server will print with', async () => {
    docCauHinhGiay.mockResolvedValue({
      tenDonVi: 'Trung tâm Đào tạo', diaDanh: 'Hà Nội',
      lyDoTamUng: 'Chi tiêu hành chính', thoiHanThanhToan: 'Sau khi hoàn thành công việc',
      nguoiDeNghiId: canBo, lanhDaoTiepKhachId: null, lanhDaoThanhToanId: canBo,
      truongPhongId: null, keToanKiemSoatId: canBo, nguoiLayHdMacDinhId: nguoiLayHd,
    })
    expect(await docDuLieuCauHinhGiay()).toEqual({
      tenDonVi: 'Trung tâm Đào tạo', diaDanh: 'Hà Nội',
      lyDoTamUng: 'Chi tiêu hành chính', thoiHanThanhToan: 'Sau khi hoàn thành công việc',
      nguoiKy: {
        nguoiDeNghiId: canBo, lanhDaoTiepKhachId: null, lanhDaoThanhToanId: canBo,
        truongPhongId: null, keToanKiemSoatId: canBo,
      },
      nguoiLayHdMacDinhId: nguoiLayHd,
    })
  })

  // Trang cài đặt hiện đúng những ô mà biểu mẫu gửi lên, nếu thiếu một khoá thì ô đó sẽ
  // trống dù cấu hình có giá trị.
  it('exposes a key for every role printed on the papers', async () => {
    docCauHinhGiay.mockResolvedValue({
      tenDonVi: 'A', diaDanh: 'B', lyDoTamUng: 'C', thoiHanThanhToan: 'D',
      nguoiDeNghiId: null, lanhDaoTiepKhachId: null, lanhDaoThanhToanId: null,
      truongPhongId: null, keToanKiemSoatId: null, nguoiLayHdMacDinhId: null,
    })
    const duLieu = await docDuLieuCauHinhGiay()
    expect(Object.keys(duLieu.nguoiKy).sort()).toEqual(VAI_TRO_KY.map(v => v.id).sort())
  })
})
