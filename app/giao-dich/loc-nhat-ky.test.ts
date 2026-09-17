import { describe, expect, it } from 'vitest'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { cotNhatKy, type CotId } from './cot-nhat-ky'
import { batTatGiaTri, boLocCot, dangLocFacet, demDangLoc, FACET_THEO_ID, facetCuaCot, locDong, nhanFacet, TRONG, tuyChonFacet } from './loc-nhat-ky'

const dong = (phan: Partial<GiaoDichTinh>): GiaoDichTinh => ({
  id: 'g', ngay: '2026-01-01', soThuTu: 1, taoLuc: '2026-01-01T00:00:00.000Z', noiDung: '',
  kyHieuHd: null, soHd: null, loaiHd: null, trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG,
  tongTien: 0, tienRuouBia: 0, tamUngTuCq: 0, giaoTienChiThuy: 0, hoanUngTienMat: 0,
  nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null, trangThaiTtPhi: 'Không phát sinh',
  ghiChu: null, donViId: null, donViTen: null, hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0,
  ...phan,
})

const rows = [
  dong({ id: 'a', donViTen: 'Phòng A', trangThaiHd: 'Hợp lệ', trangThaiTtPhi: 'Đã thanh toán', soHd: '0001' }),
  dong({ id: 'b', donViTen: 'Phòng B', trangThaiHd: 'Chờ HĐ', trangThaiTtPhi: 'Đã thanh toán', coHoaDon: true }),
  dong({ id: 'c', donViTen: 'Phòng A', trangThaiHd: 'Hợp lệ', trangThaiTtPhi: 'Chưa thanh toán' }),
]

describe('nhóm lọc của cột', () => {
  it('tách cột ghép nhiều trường thành nhiều nhóm lọc riêng', () => {
    expect(facetCuaCot('chungTu').map(f => f.id)).toEqual(['kyHieuHd', 'soHd', 'loaiHd'])
    expect(facetCuaCot('trangThai').map(f => f.id)).toEqual(['trangThaiHd', 'trangThaiTtPhi'])
    expect(facetCuaCot('tep').map(f => f.id)).toEqual(['coHoaDon', 'coChuyenKhoan'])
    expect(facetCuaCot('donVi').map(f => f.id)).toEqual(['donVi'])
  })

  it('không lọc theo cột tiền và cột thao tác', () => {
    for (const id of ['tongTien', 'hoanTamUng', 'duLyThuyet', 'duThucTe', 'duDangCam', 'thaoTac'] as const) {
      expect(facetCuaCot(id)).toEqual([])
    }
  })

  it('mọi nhóm lọc đều có tên và mã duy nhất', () => {
    const ids = cotNhatKy.flatMap(c => facetCuaCot(c.id).map(f => f.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(FACET_THEO_ID.size).toBe(ids.length)
    for (const id of ids) expect(nhanFacet(id)).not.toBe(id)
    expect(nhanFacet('khongCo')).toBe('khongCo')
  })
})

describe('lọc dòng', () => {
  it('không có lọc thì trả về đúng mảng ban đầu', () => {
    expect(locDong(rows, {})).toBe(rows)
    expect(locDong(rows, { donVi: [] })).toBe(rows)
  })

  it('trong cùng một nhóm thì lấy hợp', () => {
    expect(locDong(rows, { donVi: ['Phòng A'] }).map(r => r.id)).toEqual(['a', 'c'])
    expect(locDong(rows, { donVi: ['Phòng A', 'Phòng B'] }).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('khác nhóm thì lấy giao, kể cả trong cùng một cột', () => {
    expect(locDong(rows, { trangThaiHd: ['Hợp lệ'], trangThaiTtPhi: ['Đã thanh toán'] }).map(r => r.id)).toEqual(['a'])
    expect(locDong(rows, { trangThaiHd: ['Hợp lệ'], trangThaiTtPhi: ['Chưa thanh toán'] }).map(r => r.id)).toEqual(['c'])
  })

  it('lọc được theo giá trị rỗng và theo cột tệp', () => {
    // Hai dòng chưa có số hóa đơn, một dòng đã có.
    expect(locDong(rows, { soHd: [''] }).map(r => r.id)).toEqual(['b', 'c'])
    expect(locDong(rows, { coHoaDon: ['Có hóa đơn'] }).map(r => r.id)).toEqual(['b'])
  })

  it('bỏ qua nhóm không tồn tại thay vì ẩn hết dữ liệu', () => {
    expect(locDong(rows, { khongCo: ['x'] }).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('danh sách giá trị để tick', () => {
  it('đếm số dòng và xếp giá trị rỗng xuống cuối', () => {
    const facet = facetCuaCot('chungTu').find(f => f.id === 'soHd')!
    expect(tuyChonFacet(rows, facet)).toEqual([{ giaTri: '0001', soLuong: 1 }, { giaTri: '', soLuong: 2 }])
  })

  it('gộp giá trị trùng và sắp theo tiếng Việt', () => {
    const facet = facetCuaCot('donVi')[0]
    expect(tuyChonFacet(rows, facet)).toEqual([{ giaTri: 'Phòng A', soLuong: 2 }, { giaTri: 'Phòng B', soLuong: 1 }])
  })

  it('danh sách rỗng khi chưa có dòng nào', () => {
    expect(tuyChonFacet([], facetCuaCot('donVi')[0])).toEqual([])
  })
})

describe('bật tắt giá trị lọc', () => {
  it('thêm rồi bỏ giá trị, xóa hẳn nhóm khi không còn giá trị nào', () => {
    const mot = batTatGiaTri({}, 'donVi', 'Phòng A')
    expect(mot).toEqual({ donVi: ['Phòng A'] })
    const hai = batTatGiaTri(mot, 'donVi', 'Phòng B')
    expect(hai).toEqual({ donVi: ['Phòng A', 'Phòng B'] })
    expect(batTatGiaTri(hai, 'donVi', 'Phòng A')).toEqual({ donVi: ['Phòng B'] })
    expect(batTatGiaTri(batTatGiaTri(hai, 'donVi', 'Phòng A'), 'donVi', 'Phòng B')).toEqual({})
  })

  it('không sửa đối tượng gốc', () => {
    const goc = { donVi: ['Phòng A'] }
    expect(batTatGiaTri(goc, 'donVi', 'Phòng B')).not.toBe(goc)
    expect(goc).toEqual({ donVi: ['Phòng A'] })
  })

  it('bỏ lọc của một cột chỉ xóa nhóm thuộc cột đó', () => {
    const goc = { soHd: [''], loaiHd: ['Khác'], donVi: ['Phòng A'] }
    expect(boLocCot(goc, facetCuaCot('chungTu').map(f => f.id))).toEqual({ donVi: ['Phòng A'] })
    expect(goc).toEqual({ soHd: [''], loaiHd: ['Khác'], donVi: ['Phòng A'] })
  })

  it('đếm số giá trị đang lọc và đọc được giá trị của một nhóm', () => {
    expect(demDangLoc({})).toBe(0)
    expect(demDangLoc({ soHd: [''], donVi: ['Phòng A', 'Phòng B'] })).toBe(3)
    expect(dangLocFacet({ donVi: ['Phòng A'] }, 'donVi')).toEqual(['Phòng A'])
    expect(dangLocFacet({}, 'donVi')).toEqual([])
    expect(TRONG).toBe('—')
  })
})

describe('lọc kết hợp với cột đang hiển thị', () => {
  it('mọi mã cột trong bảng đều được khai báo tường minh', () => {
    const coFacet = (Object.keys({ ngay: 1, noiDung: 1, donVi: 1, chungTu: 1, trangThai: 1, hinhThuc: 1, tep: 1 }) as CotId[])
    for (const id of coFacet) expect(facetCuaCot(id).length).toBeGreaterThan(0)
  })
})
