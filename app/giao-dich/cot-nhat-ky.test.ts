import { describe, expect, it } from 'vitest'
import { catTrangNhatKy, chuyenTuyChonCu, cotMacDinh, cotNhatKy, soDongTrangHopLe, thuTuCot, tuyChonSchema, type CotId } from './cot-nhat-ky'

describe('column preference validation', () => {
  it('accepts defaults, legacy preferences and inclusive integer width boundaries', () => {
    expect(tuyChonSchema.safeParse(cotMacDinh()).success).toBe(true)
    expect(tuyChonSchema.safeParse({ an: ['tep'], rong: { ngay: 90, noiDung: 600 } }).success).toBe(true)
  })
  it('accepts any unique subset of column ids and rejects duplicates or unknown ids', () => {
    const order = cotNhatKy.map(c => c.id)
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, thuTu: [...order].reverse() }).success).toBe(true)
    // Thứ tự thiếu cột vẫn hợp lệ: cột chưa có trong thứ tự được ghép vào cuối khi đọc,
    // nhờ vậy tùy chọn đã lưu trước khi thêm cột mới không bị vô hiệu.
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, thuTu: order.slice(1) }).success).toBe(true)
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, thuTu: [...order.slice(0, -1), order[0]] }).success).toBe(false)
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, thuTu: ['khongCo'] }).success).toBe(false)
  })
  it('appends columns missing from a saved order so new columns still show up', () => {
    // Tùy chọn lưu từ trước các cột Đơn vị và các số dư CQ trả thẳng.
    const thuTuCu: CotId[] = [
      'ngay', 'noiDung', 'nguoiDeNghi', 'nguoiLayHd', 'chungTu', 'trangThaiHd', 'trangThaiTtPhi', 'hinhThuc',
      'tongTien', 'tienRuouBia', 'hoanTamUng', 'cqTraThang', 'phiLayHd', 'tamUngTuCq', 'giaoTienChiThuy',
      'hoanUngTienMat', 'duLyThuyet', 'duThucTe', 'duDangCam', 'tep', 'thaoTac',
    ]
    const cu = { an: [], rong: {}, thuTu: thuTuCu }
    const parsed = tuyChonSchema.parse(cu)
    const daCo = new Set(thuTuCu)
    expect(thuTuCot(parsed)).toEqual([...thuTuCu, ...cotNhatKy.map(c => c.id).filter(id => !daCo.has(id))])
    expect(thuTuCot({ an: [], rong: {} })).toEqual(cotNhatKy.map(c => c.id))
  })
  it('shows all CQ direct-payment and combined-balance columns by default with their new labels', () => {
    const macDinh = cotMacDinh()
    expect(macDinh.an).toEqual([])
    for (const [id, ten] of [
      ['duaTienCqTraThangChoChiThuy', 'Đưa tiền CQ trả thẳng cho Chị Thúy'],
      ['duTienCqTraThang', 'Dư tiền CQ trả thẳng'],
      ['duChiTiepKhachThucTe', 'Dư Chi tiếp khách thực tế'],
      ['tongTienDuaChiThuy', 'Tổng Tiền đưa chị Thúy'],
      ['duHiepDangCam', 'Dư Hiệp đang cầm'],
      ['giaoTienChiThuy', 'Giao tiền TƯ cho Chị Thúy'],
      ['duLyThuyet', 'Dư TƯ lý thuyết'],
      ['duThucTe', 'Dư TƯ thực tế'],
      ['duDangCam', 'Dư TƯ đang cầm'],
    ] as const) {
      expect(macDinh.thuTu).toContain(id)
      expect(cotNhatKy.find(c => c.id === id)?.ten).toBe(ten)
    }
  })
  it('migrates the old combined status column', () => {
    const cu = { an: ['trangThai'], rong: { trangThai: 190 }, thuTu: ['ngay', 'trangThai', 'thaoTac'] }
    const parsed = tuyChonSchema.parse(chuyenTuyChonCu(cu))
    expect(parsed.an).toEqual(['trangThaiHd', 'trangThaiTtPhi'])
    expect(parsed.rong).toEqual({ trangThaiHd: 190, trangThaiTtPhi: 190 })
    expect(thuTuCot(parsed).slice(0, 4)).toEqual(['ngay', 'trangThaiHd', 'trangThaiTtPhi', 'thaoTac'])
  })
  it.each([89, 601, 100.5, NaN, Infinity, '170', null])('rejects invalid width %s', width => {
    expect(tuyChonSchema.safeParse({ an: [], rong: { ngay: width } }).success).toBe(false)
  })
  it('rejects unknown ids, duplicate hidden ids and account injection', () => {
    for (const value of [
      { an: ['unknown'], rong: {} }, { an: [], rong: { unknown: 100 } },
      { an: ['ngay', 'ngay'], rong: {} }, { an: [], rong: {}, nguoi_dung_id: 'other-account' },
      { an: [], rong: { ngay: 100 }, extra: true },
    ]) expect(tuyChonSchema.safeParse(value).success).toBe(false)
  })
  it('requires a visible data column even if actions remain visible', () => {
    expect(tuyChonSchema.safeParse({ an: cotNhatKy.map(c => c.id), rong: {} }).success).toBe(false)
    expect(tuyChonSchema.safeParse({ an: cotNhatKy.filter(c => c.id !== 'thaoTac').map(c => c.id), rong: {} }).success).toBe(false)
    expect(tuyChonSchema.safeParse({ an: cotNhatKy.filter(c => c.id !== 'ngay').map(c => c.id), rong: {} }).success).toBe(true)
  })
  it.each([null, [], {}, { an: [], rong: null }, { an: 'ngay', rong: {} }])('rejects malformed payload %#', value => {
    expect(tuyChonSchema.safeParse(value).success).toBe(false)
  })
  it('accepts optional rows-per-page and ignores unknown sizes', () => {
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, soDongTrang: 10 }).success).toBe(true)
    expect(tuyChonSchema.safeParse({ an: [], rong: {}, soDongTrang: 15 }).success).toBe(false)
    expect(soDongTrangHopLe(undefined)).toBe(20)
    expect(soDongTrangHopLe(50)).toBe(50)
    expect(soDongTrangHopLe(7)).toBe(20)
    const cat = catTrangNhatKy([1, 2, 3, 4, 5], 2, 2)
    expect(cat).toEqual({ trang: 2, tongTrang: 3, dong: [3, 4] })
    expect(catTrangNhatKy([1, 2], 10, 9)).toEqual({ trang: 1, tongTrang: 1, dong: [1, 2] })
    expect(catTrangNhatKy([], 20, 1)).toEqual({ trang: 1, tongTrang: 1, dong: [] })
  })
})
