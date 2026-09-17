import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { cotNhatKy } from './cot-nhat-ky'
import { doiKhoaSapXep, giaTriSoSanh, huongSapXep, sapXepDong, tongCot } from './sap-xep-nhat-ky'

const dong = (phan: Partial<GiaoDichTinh>): GiaoDichTinh => ({
  id: 'g', ngay: '2026-01-01', soThuTu: 1, taoLuc: '2026-01-01T00:00:00.000Z', noiDung: '',
  kyHieuHd: null, soHd: null, loaiHd: null, trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  tongTien: 0, tienRuouBia: 0, tamUngTuCq: 0, giaoTienChiThuy: 0, hoanUngTienMat: 0,
  nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null, trangThaiTtPhi: 'Không phát sinh',
  ghiChu: null, donViId: null, donViTen: null, hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0,
  ...phan,
})

describe('sắp xếp nhật ký', () => {
  it('sắp xếp theo số đúng thứ tự số học chứ không theo chuỗi', () => {
    const rows = [dong({ id: 'a', tongTien: 9 }), dong({ id: 'b', tongTien: 100 }), dong({ id: 'c', tongTien: 20 })]
    expect(sapXepDong(rows, [{ id: 'tongTien', giam: false }]).map(r => r.id)).toEqual(['a', 'c', 'b'])
    expect(sapXepDong(rows, [{ id: 'tongTien', giam: true }]).map(r => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('sắp xếp theo nhiều cột, cột sau chỉ dùng khi cột trước bằng nhau', () => {
    const rows = [
      dong({ id: '1', donViTen: 'Phòng B', tongTien: 100 }),
      dong({ id: '2', donViTen: 'Phòng A', tongTien: 300 }),
      dong({ id: '3', donViTen: 'Phòng B', tongTien: 200 }),
    ]
    const theoDonViRoiTien = sapXepDong(rows, [{ id: 'donVi', giam: false }, { id: 'tongTien', giam: true }])
    expect(theoDonViRoiTien.map(r => r.id)).toEqual(['2', '3', '1'])
    // Đảo hướng cột đầu thì thứ tự trong từng nhóm vẫn theo cột hai.
    expect(sapXepDong(rows, [{ id: 'donVi', giam: true }, { id: 'tongTien', giam: true }]).map(r => r.id))
      .toEqual(['3', '1', '2'])
  })

  it('giữ nguyên mảng gốc và giữ thứ tự ghi sổ khi không có khóa', () => {
    const rows = [dong({ id: 'a' }), dong({ id: 'b' })]
    expect(sapXepDong(rows, [])).toBe(rows)
    const daSapXep = sapXepDong(rows, [{ id: 'ngay', giam: true }])
    expect(daSapXep).not.toBe(rows)
    expect(rows.map(r => r.id)).toEqual(['a', 'b'])
  })

  it('so sánh được các cột ghép nhiều trường và cột đơn vị', () => {
    const row = dong({ kyHieuHd: '1C26MTT', soHd: '00123', donViTen: 'Phòng A', coHoaDon: true, coChuyenKhoan: false })
    expect(giaTriSoSanh(row, 'chungTu')).toBe('1C26MTT 00123')
    expect(giaTriSoSanh(row, 'donVi')).toBe('Phòng A')
    expect(giaTriSoSanh(row, 'tep')).toBe('10')
    // Đơn vị trống xếp trước đơn vị có tên khi sắp xếp tăng dần.
    const rows = [dong({ id: 'x', donViTen: 'Phòng A' }), dong({ id: 'y', donViTen: null })]
    expect(sapXepDong(rows, [{ id: 'donVi', giam: false }]).map(r => r.id)).toEqual(['y', 'x'])
  })

  it('cột thao tác không có giá trị nên không làm đổi thứ tự', () => {
    expect(giaTriSoSanh(dong({ id: 'a' }), 'thaoTac')).toBe('')
    const rows = [dong({ id: 'a' }), dong({ id: 'b' })]
    expect(sapXepDong(rows, [{ id: 'thaoTac', giam: false }]).map(r => r.id)).toEqual(['a', 'b'])
  })
})

describe('đổi khóa sắp xếp', () => {
  it('bấm thường thay toàn bộ thứ tự bằng đúng cột vừa bấm', () => {
    expect(doiKhoaSapXep([{ id: 'ngay', giam: false }, { id: 'tongTien', giam: true }], 'donVi', false))
      .toEqual([{ id: 'donVi', giam: false }])
  })

  it('bấm lại một cột đang là khóa duy nhất thì đảo hướng', () => {
    expect(doiKhoaSapXep([{ id: 'ngay', giam: false }], 'ngay', false)).toEqual([{ id: 'ngay', giam: true }])
    expect(doiKhoaSapXep([{ id: 'ngay', giam: true }], 'ngay', false)).toEqual([{ id: 'ngay', giam: false }])
  })

  it('giữ Shift để thêm, đảo rồi bỏ cột khỏi thứ tự', () => {
    const mot = doiKhoaSapXep([{ id: 'ngay', giam: false }], 'tongTien', true)
    expect(mot).toEqual([{ id: 'ngay', giam: false }, { id: 'tongTien', giam: false }])
    const hai = doiKhoaSapXep(mot, 'tongTien', true)
    expect(hai).toEqual([{ id: 'ngay', giam: false }, { id: 'tongTien', giam: true }])
    expect(doiKhoaSapXep(hai, 'tongTien', true)).toEqual([{ id: 'ngay', giam: false }])
  })

  it('giữ Shift trên cột chưa có khóa nào thì bắt đầu bằng cột đó', () => {
    expect(doiKhoaSapXep([], 'ngay', true)).toEqual([{ id: 'ngay', giam: false }])
  })

  it('báo đúng hướng đang sắp xếp cho từng tiêu đề cột', () => {
    const khoa = [{ id: 'ngay', giam: false }, { id: 'tongTien', giam: true }] as const
    expect(huongSapXep(khoa, 'ngay')).toBe('ascending')
    expect(huongSapXep(khoa, 'tongTien')).toBe('descending')
    expect(huongSapXep(khoa, 'donVi')).toBe('none')
  })
})

describe('hàng tổng', () => {
  const rows = [dong({ id: 'a', tongTien: 1_000_000, hoanTamUng: 900_000 }), dong({ id: 'b', tongTien: 500, hoanTamUng: 500 })]

  it('cộng đúng các dòng đang hiển thị', () => {
    expect(tongCot(rows, 'tongTien')).toBe(1_000_500)
    expect(tongCot(rows.slice(0, 1), 'tongTien')).toBe(1_000_000)
    expect(tongCot([], 'tongTien')).toBe(0)
  })

  it('không cộng cột chữ, cột số dư luỹ kế hay cột thao tác', () => {
    for (const id of ['ngay', 'noiDung', 'donVi', 'trangThai', 'tep', 'thaoTac', 'duLyThuyet', 'duThucTe', 'duDangCam'] as const) {
      expect(tongCot(rows, id)).toBeNull()
    }
  })

  it('cột tiền nào cũng cộng được', () => {
    const congDon = cotNhatKy.filter(c => c.congDon).map(c => c.id)
    expect(congDon).toEqual(['tongTien', 'tienRuouBia', 'hoanTamUng', 'cqTraThang', 'phiLayHd', 'tamUngTuCq', 'giaoTienChiThuy', 'hoanUngTienMat'])
    for (const id of congDon) expect(typeof tongCot(rows, id)).toBe('number')
  })

  it('trả về null khi tổng vượt giới hạn an toàn của số nguyên', () => {
    expect(tongCot([dong({ tongTien: Number.MAX_SAFE_INTEGER }), dong({ tongTien: 1 })], 'tongTien')).toBeNull()
  })
})
