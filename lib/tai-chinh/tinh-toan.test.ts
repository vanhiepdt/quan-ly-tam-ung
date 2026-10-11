import { describe, expect, it } from 'vitest'
import { tinhChiSo } from './chi-so'
import { HINH_THUC, TRANG_THAI, type GiaoDichTho } from './kieu'
import { tinhToan } from './tinh-toan'

const dong = (phan: Partial<GiaoDichTho>): GiaoDichTho => ({
  id: phan.id ?? crypto.randomUUID(), ngay: phan.ngay ?? '2026-01-01', soThuTu: phan.soThuTu ?? 1,
  taoLuc: phan.taoLuc ?? '2026-01-01T00:00:00.000Z', noiDung: phan.noiDung ?? '', kyHieuHd: null, soHd: null, loaiHd: null,
  trangThaiHd: TRANG_THAI.HOP_LE, hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 0, tienRuouBia: 0,
  tamUngTuCq: 0, giaoTienChiThuy: 0, duaTienCqTraThangChoChiThuy: 0, hoanUngTienMat: 0, nguoiDeNghiId: null, nguoiDeNghiTen: null, nguoiLayHdId: null, nguoiLayHdTen: null,
  phiLayHdGhiDe: null, coTinhPhi: phan.coTinhPhi ?? ((phan.hinhThuc ?? HINH_THUC.HOAN_TAM_UNG) === HINH_THUC.HOAN_TAM_UNG), trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: null, hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: false, coChuyenKhoan: false,
  ...phan,
})

describe('tinhToan', () => {
  it('tính hoàn ứng và phí với ưu tiên phí ghi đè', () => {
    const [row] = tinhToan([dong({ tongTien: 5_647_000, phiLayHdGhiDe: 700_000 })])
    expect(row.hoanTamUng).toBe(5_647_000)
    expect(row.phiLayHd).toBe(700_000)
  })

  it('loại tiền rượu bia và không tính hóa đơn chờ hoặc không hợp lệ', () => {
    const rows = tinhToan([
      dong({ id: 'valid', tongTien: 1_000_000, tienRuouBia: 100_000 }),
      dong({ id: 'pending', soThuTu: 2, tongTien: 2_000_000, trangThaiHd: TRANG_THAI.CHO_HD }),
      dong({ id: 'invalid', soThuTu: 3, tongTien: 3_000_000, trangThaiHd: 'Không hợp lệ' }),
    ])
    expect(rows.map((r) => r.hoanTamUng)).toEqual([900_000, 0, 0])
  })

  it('dùng số tiền được hoàn đã làm tròn cho hoàn ứng nhưng tính phí theo tổng tiền', () => {
    const [row] = tinhToan([dong({
      tongTien: 1_234_567, tienRuouBia: 100,
      tienDuocThanhToan: 1_234_567, lamTronXuongHangNghin: true,
    })])
    expect(row.hoanTamUng).toBe(1_234_000)
    expect(row.phiLayHd).toBe(Math.round(1_234_567 * 0.15))
  })

  it.each([HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG])('tính phí %s trên số tiền hoàn/thanh toán sau làm tròn khi được chọn', hinhThuc => {
    const [row] = tinhToan([dong({
      hinhThuc, coTinhPhi: true, tongTien: 1_234_567, tienRuouBia: 100_000,
      tienDuocThanhToanGoc: 876_543, lamTronXuongHangNghin: true,
      coSoTinhPhi: 'tien_duoc_thanh_toan',
    })])
    expect(row.phiLayHd).toBe(131_400)
    expect(hinhThuc === HINH_THUC.HOAN_TAM_UNG ? row.hoanTamUng : row.cqTraThang).toBe(876_000)
    expect(row.duThucTe).toBe(-131_400)
  })

  it('giữ số tiền lẻ khi không làm tròn; phí ghi đè vẫn ưu tiên cơ sở được chọn', () => {
    const gd = dong({ tongTien: 2_000_000, tienDuocThanhToan: 876_543, coSoTinhPhi: 'tien_duoc_thanh_toan' })
    expect(tinhToan([gd])[0].phiLayHd).toBe(Math.round(876_543 * 0.15))
    expect(tinhToan([{ ...gd, phiLayHdGhiDe: 50_000 }])[0].phiLayHd).toBe(50_000)
    expect(tinhToan([{ ...gd, coTinhPhi: false }])[0].phiLayHd).toBe(0)
  })

  it('không trừ rượu bia khỏi cơ sở tính phí', () => {
    const [row] = tinhToan([dong({
      tongTien: 2_000_000, tienRuouBia: 500_000,
    })])
    expect(row.hoanTamUng).toBe(1_500_000)
    expect(row.phiLayHd).toBe(300_000)
  })

  it('giữ số lẻ nghìn khi hoàn tạm ứng hoặc cơ quan trả thẳng tiền mặt không chọn làm tròn', () => {
    const rows = tinhToan([
      dong({ id: 'hoan', tongTien: 2_000_000, tienDuocThanhToan: 1_234_567, lamTronXuongHangNghin: false }),
      dong({ id: 'cq', soThuTu: 2, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 2_000_000, tienDuocThanhToan: 1_234_567, lamTronXuongHangNghin: false, coTinhPhi: true }),
    ])
    expect(rows.map(row => row.hoanTamUng)).toEqual([1_234_567, 0])
    expect(rows.map(row => row.cqTraThang)).toEqual([0, 1_234_567])
  })

  it('sắp xếp quyết định và cộng dồn số dư độc lập thứ tự đầu vào', () => {
    const rows = tinhToan([
      dong({ id: 'hand', ngay: '2026-01-02', hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 15_000_000 }),
      dong({ id: 'advance', ngay: '2026-01-01', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 20_000_000 }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['advance', 'hand'])
    expect(rows[1].duLyThuyet).toBe(20_000_000)
    expect(rows[1].duDangCam).toBe(5_000_000)
  })

  it('áp dụng tỷ lệ phí theo người lấy hóa đơn trước tỷ lệ chung', () => {
    const [row] = tinhToan([dong({ tongTien: 1_000_000, nguoiLayHdId: 'hiep' })], {
      tyLePhiChung: 0.15, tyLeTheoNguoi: { hiep: 0.1 },
    })
    expect(row.phiLayHd).toBe(100_000)
  })

  it('cho phép Cơ quan trả thẳng tính phí khi bật cờ', () => {
    const [row] = tinhToan([dong({ hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_000_000, coTinhPhi: true })])
    expect(row.cqTraThang).toBe(1_000_000)
    expect(row.phiLayHd).toBe(150_000)
  })

  it('không tính phí Cơ quan trả thẳng khi tắt cờ, kể cả có phí ghi đè cũ', () => {
    const [row] = tinhToan([dong({ hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_000_000, coTinhPhi: false, phiLayHdGhiDe: 700_000 })])
    expect(row.phiLayHd).toBe(0)
  })

  it('theo dõi riêng tiền CQ trả thẳng, chỉ cộng hóa đơn hợp lệ và không trừ quỹ tạm ứng', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'cq-valid', soThuTu: 2, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 3_000_000 }),
      dong({ id: 'cq-pending', soThuTu: 3, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 1_000_000, trangThaiHd: TRANG_THAI.CHO_HD }),
      dong({ id: 'cq-invalid', soThuTu: 4, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 2_000_000, trangThaiHd: 'Không hợp lệ' }),
      dong({ id: 'advance-handover', soThuTu: 5, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 4_000_000 }),
      dong({ id: 'cq-handover', soThuTu: 6, hinhThuc: HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY, duaTienCqTraThangChoChiThuy: 2_000_000 }),
    ])

    expect(rows.map(row => row.cqTraThang)).toEqual([0, 3_000_000, 0, 0, 0, 0])
    expect(rows.map(row => row.duTienCqTraThang)).toEqual([0, 3_000_000, 3_000_000, 3_000_000, 3_000_000, 1_000_000])
    expect(rows[4]).toMatchObject({ tongTienDuaChiThuy: 4_000_000, duDangCam: 6_000_000, duHiepDangCam: 9_000_000 })
    expect(rows[5]).toMatchObject({
      tongTienDuaChiThuy: 2_000_000,
      duLyThuyet: 10_000_000,
      duThucTe: 6_000_000,
      duDangCam: 6_000_000,
      duHiepDangCam: 7_000_000,
    })
  })

  it('tính 20 chỉ số và đối soát quỹ', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 20_000_000 }),
      dong({ id: 'hand', soThuTu: 2, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 15_000_000 }),
      dong({ id: 'bill', soThuTu: 3, tongTien: 5_647_000, trangThaiTtPhi: TRANG_THAI.PHI_DA_TRA }),
      dong({ id: 'direct', soThuTu: 4, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 3_599_000 }),
      dong({ id: 'pending', soThuTu: 5, trangThaiHd: TRANG_THAI.CHO_HD, tongTien: 1_472_000 }),
    ])
    const kpi = tinhChiSo(rows)
    expect(kpi.tongTamUng).toBe(20_000_000)
    expect(kpi.thuyGoc).toBe(15_000_000)
    expect(kpi.tongBill).toBe(10_718_000)
    expect(kpi.choHd).toBe(1_472_000)
    expect(kpi.canDoi).toBe(true)
  })
})


describe('số dư khi chọn Chi thực tế', () => {
  it('khoản học phí 16.800.000 trừ đủ cả ba số dư và tiếp tục ảnh hưởng dòng sau', () => {
    const rows = tinhToan([
      dong({ id: 'later', ngay: '2026-09-30', hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 1_000_000 }),
      dong({ id: 'tuition', ngay: '2026-09-28', soThuTu: 2, chiThucTe: true, coTinhPhi: false,
        tongTien: 16_800_000, tienDuocThanhToanGoc: 16_800_000 }),
      dong({ id: 'advance', ngay: '2026-09-28', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 20_000_000 }),
    ])
    expect(rows.map(r => r.id)).toEqual(['advance', 'tuition', 'later'])
    expect(rows[1]).toMatchObject({ hoanTamUng: 16_800_000, phiLayHd: 0,
      duLyThuyet: 3_200_000, duThucTe: 3_200_000, duDangCam: 3_200_000, duHiepDangCam: 3_200_000 })
    expect(rows[2]).toMatchObject({ duLyThuyet: 3_200_000, duThucTe: 2_200_000, duDangCam: 2_200_000, duHiepDangCam: 2_200_000 })
  })

  it('tắt Chi thực tế tính lại dòng hiện tại và dòng sau, không đổi dòng trước', () => {
    const source = [
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'actual', soThuTu: 2, chiThucTe: true, coTinhPhi: false, tongTien: 2_000_000, tienRuouBia: 300_000 }),
      dong({ id: 'handover', soThuTu: 3, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 1_000_000 }),
    ]
    const on = tinhToan(source)
    const off = tinhToan(source.map(r => r.id === 'actual' ? { ...r, chiThucTe: false } : r))
    expect(off[0]).toEqual(on[0])
    for (const i of [1, 2]) {
      expect(off[i].duLyThuyet).toBe(on[i].duLyThuyet)
      expect(off[i].duThucTe - on[i].duThucTe).toBe(2_000_000)
      expect(off[i].duDangCam - on[i].duDangCam).toBe(2_000_000)
      expect(off[i].duHiepDangCam - on[i].duHiepDangCam).toBe(2_000_000)
    }
  })

  it('vẫn trừ tiền đã chi khỏi đang cầm khi toàn bộ hóa đơn không được thanh toán', () => {
    const [r] = tinhToan([dong({ chiThucTe: true, coTinhPhi: false, tongTien: 1_000_000, tienRuouBia: 1_000_000 })])
    expect(r).toMatchObject({ hoanTamUng: 0, duLyThuyet: 0, duThucTe: -1_000_000, duDangCam: -1_000_000, duHiepDangCam: -1_000_000 })
  })

  it('hoàn tạm ứng chi thực tế trừ toàn bộ tổng tiền, vẫn trừ số hoàn sửa tay và làm tròn ở dư lý thuyết', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'actual', soThuTu: 2, chiThucTe: true, coTinhPhi: false,
        tongTien: 2_000_000, tienRuouBia: 300_000, tienDuocThanhToanGoc: 1_234_567, lamTronXuongHangNghin: true }),
      dong({ id: 'handover', soThuTu: 3, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 1_000_000 }),
    ])
    expect(rows[1]).toMatchObject({
      hoanTamUng: 1_234_000, phiLayHd: 0, duLyThuyet: 8_766_000, duThucTe: 8_000_000,
      duDangCam: 8_000_000, duHiepDangCam: 8_000_000, duTienCqTraThang: 0,
    })
    expect(rows[2]).toMatchObject({ duLyThuyet: 8_766_000, duThucTe: 7_000_000, duDangCam: 7_000_000 })
  })

  it('CQ trả thẳng chỉ trừ khoản không được thanh toán, giữ công thức số dư đang cầm', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 5_000_000 }),
      dong({ id: 'direct', soThuTu: 2, hinhThuc: HINH_THUC.CQ_TRA_THANG, tongTien: 3_000_000, tienRuouBia: 200_000 }),
      dong({ id: 'actual', soThuTu: 3, hinhThuc: HINH_THUC.CQ_TRA_THANG, chiThucTe: true,
        tongTien: 2_000_000, tienRuouBia: 400_000, tienDuocThanhToanGoc: 1_234_567, lamTronXuongHangNghin: true }),
      dong({ id: 'handover', soThuTu: 4, hinhThuc: HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY, duaTienCqTraThangChoChiThuy: 500_000 }),
    ])
    expect(rows.map(r => r.duTienCqTraThang)).toEqual([0, 2_800_000, 2_400_000, 1_900_000])
    expect(rows[2]).toMatchObject({ cqTraThang: 1_234_000, duLyThuyet: 5_000_000, duThucTe: 5_000_000, duDangCam: 5_000_000 })
    expect(rows[3].duHiepDangCam).toBe(6_900_000)
    for (const r of rows) expect(r.duHiepDangCam).toBe(r.duDangCam + r.duTienCqTraThang)
  })

  it.each([HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG])('bỏ tích giữ nguyên cách tính cũ của %s', hinhThuc => {
    const gd = dong({ hinhThuc, tongTien: 2_000_000, tienRuouBia: 400_000 })
    const [cu] = tinhToan([gd])
    const [boTich] = tinhToan([{ ...gd, chiThucTe: false }])
    expect(boTich).toEqual({ ...cu, chiThucTe: false })
  })

  it.each([HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG])('chỉ áp dụng khoản loại trừ cho hóa đơn hợp lệ: %s', hinhThuc => {
    const rows = tinhToan(['Chờ HĐ', 'Không hợp lệ', 'Không có'].map((trangThaiHd, i) => dong({
      hinhThuc, trangThaiHd, soThuTu: i, chiThucTe: true, coTinhPhi: false, tongTien: 1_000_000, tienRuouBia: 200_000,
    })))
    for (const r of rows) expect(r).toMatchObject({ hoanTamUng: 0, cqTraThang: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0, duTienCqTraThang: 0 })
  })

  it.each([TRANG_THAI.PHI_DA_TRA, 'Chưa thanh toán'])('phát sinh đang cầm cộng lại phí HĐ của giao dịch Chi thực tế: %s', trangThaiTtPhi => {
    const [r] = tinhToan([dong({ chiThucTe: true, coTinhPhi: true, tongTien: 1_000_000, tienRuouBia: 200_000, trangThaiTtPhi })])
    expect(r).toMatchObject({ phiLayHd: 150_000, duLyThuyet: -800_000, duThucTe: -1_150_000, duDangCam: -1_000_000 })
    expect(r.duDangCam).toBe(r.duThucTe + r.phiLayHd)
  })

  it.each([
    { coTinhPhi: false, trangThaiTtPhi: 'Không phát sinh', phiLayHdGhiDe: null, phi: 0 },
    { coTinhPhi: true, trangThaiTtPhi: 'Chưa thanh toán', phiLayHdGhiDe: null, phi: 150_000 },
    { coTinhPhi: true, trangThaiTtPhi: TRANG_THAI.PHI_DA_TRA, phiLayHdGhiDe: 75_000, phi: 75_000 },
  ])('cộng dồn riêng từng số dư, giữ chênh lệch phí cũ: $trangThaiTtPhi, $phi', ({ phi, ...truongPhi }) => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'previous-fee', soThuTu: 2, tongTien: 2_000_000, coTinhPhi: true, trangThaiTtPhi: 'Chưa thanh toán' }),
      dong({ id: 'actual', soThuTu: 3, chiThucTe: true, tongTien: 1_000_000, tienRuouBia: 200_000, ...truongPhi }),
      dong({ id: 'later', soThuTu: 4, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 1_000_000 }),
    ])
    expect(rows[1]).toMatchObject({ duThucTe: 9_700_000, duDangCam: 10_000_000 })
    expect(rows[2]).toMatchObject({ duLyThuyet: 7_200_000, phiLayHd: phi, duThucTe: 8_700_000 - phi, duDangCam: 9_000_000, duHiepDangCam: 9_000_000 })
    expect(rows[2].duDangCam - rows[2].duThucTe).toBe(300_000 + phi)
    expect(rows[3]).toMatchObject({ duThucTe: 7_700_000 - phi, duDangCam: 8_000_000, duHiepDangCam: 8_000_000 })
  })

  it('giao dịch Chi thực tế sau không có phí vẫn giữ chênh lệch phí của dòng trước', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'with-fee', soThuTu: 2, chiThucTe: true, coTinhPhi: true, tongTien: 1_000_000, trangThaiTtPhi: 'Chưa thanh toán' }),
      dong({ id: 'without-fee', soThuTu: 3, chiThucTe: true, coTinhPhi: false, tongTien: 2_000_000, tienRuouBia: 500_000 }),
    ])
    expect(rows[1]).toMatchObject({ duThucTe: 8_850_000, duDangCam: 9_000_000, phiLayHd: 150_000 })
    expect(rows[2]).toMatchObject({ duThucTe: 6_850_000, duDangCam: 7_000_000, phiLayHd: 0 })
  })

  it('giữ chênh lệch 464.469 qua khoản học phí 16.800.000 và dòng giao tiền tiếp theo', () => {
    const rows = tinhToan([
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 5_195_698 }),
      dong({ id: 'unpaid-fee', soThuTu: 2, tongTien: 3_096_460, coTinhPhi: true, trangThaiTtPhi: 'Chưa thanh toán' }),
      dong({ id: 'tuition', soThuTu: 3, tongTien: 16_800_000, tienRuouBia: 2_000_000,
        tienDuocThanhToanGoc: 14_800_000, chiThucTe: true, coTinhPhi: false }),
      dong({ id: 'handover', soThuTu: 4, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 1_000_000 }),
    ])
    expect(rows[1]).toMatchObject({ duThucTe: 4_731_229, duDangCam: 5_195_698, phiLayHd: 464_469 })
    expect(rows[2]).toMatchObject({ duThucTe: -12_068_771, duDangCam: -11_604_302, hoanTamUng: 14_800_000, phiLayHd: 0 })
    expect(rows[3]).toMatchObject({ duThucTe: -13_068_771, duDangCam: -12_604_302 })
    for (const r of rows.slice(1)) expect(r.duDangCam - r.duThucTe).toBe(464_469)
  })

  it('thanh toán phí của dòng trước điều chỉnh liên tục số đang cầm qua các dòng Chi thực tế', () => {
    const source = [
      dong({ id: 'advance', hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 10_000_000 }),
      dong({ id: 'fee', soThuTu: 2, tongTien: 2_000_000, coTinhPhi: true, trangThaiTtPhi: 'Chưa thanh toán' }),
      dong({ id: 'actual-with-fee', soThuTu: 3, tongTien: 1_000_000, chiThucTe: true, coTinhPhi: true, trangThaiTtPhi: 'Chưa thanh toán' }),
      dong({ id: 'actual-without-fee', soThuTu: 4, tongTien: 1_000_000, chiThucTe: true, coTinhPhi: false }),
      dong({ id: 'handover', soThuTu: 5, hinhThuc: HINH_THUC.GIAO_CHI_THUY, giaoTienChiThuy: 500_000 }),
    ]
    const unpaid = tinhToan(source)
    const paid = tinhToan(source.map(r => r.id === 'fee' ? { ...r, trangThaiTtPhi: TRANG_THAI.PHI_DA_TRA } : r))
    expect(paid[0]).toEqual(unpaid[0])
    expect(unpaid.map(r => r.duDangCam)).toEqual([10_000_000, 10_000_000, 9_000_000, 8_000_000, 7_500_000])
    expect(paid.map(r => r.duDangCam)).toEqual([10_000_000, 9_700_000, 8_700_000, 7_700_000, 7_200_000])
    for (let i = 1; i < paid.length; i++) {
      expect(paid[i].duThucTe).toBe(unpaid[i].duThucTe)
      expect(paid[i].duLyThuyet).toBe(unpaid[i].duLyThuyet)
      expect(paid[i].duHiepDangCam).toBe(unpaid[i].duHiepDangCam - 300_000)
    }
  })

  it('không cộng tiền được thanh toán vào dư CQ khi khoản loại trừ bằng không', () => {
    const [r] = tinhToan([dong({ hinhThuc: HINH_THUC.CQ_TRA_THANG, chiThucTe: true, tongTien: 1_000_000 })])
    expect(r).toMatchObject({ cqTraThang: 1_000_000, duTienCqTraThang: 0 })
  })
})
