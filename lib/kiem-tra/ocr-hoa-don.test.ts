import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { docChuPdf } from './doc-anh'
import { gopDongChu, phanTichChuHoaDon } from './ocr-hoa-don'

const CHU_MAU = `
CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI TIẾN THẮNG
Mã số thuế : 0108021157
Địa chỉ : Số 5 BT3 Lan Viên 2, KĐT Đặng Xá, Xã Thuận An, Thành phố Hà Nội, Việt Nam
Họ và tên người mua hàng :
Tên đơn vị : Trung Tâm Đào Tạo Ngân Hàng Chính Sách Xã Hội
MST/CCCD chủ hộ : 0100695387-066
Địa chỉ : Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam.
HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ngày 11 tháng 09 năm 2026
Ký hiệu : 1C26MLD
Số : 00001656
STT Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền
1 Sung muối Bát 1,0 19.000 19.000 8% 1.520
8 Bia Tiger Chai 10,0 28.000 280.000 10% 28.000
11 Bia Hà Nội Chai 13,0 22.000 286.000 10% 28.600
Tổng hợp Thành tiền trước thuế GTGT Tiền thuế GTGT Cộng tiền thanh toán
Tổng cộng : 2.248.000 191.160 2.439.160
`.trim()

describe('OCR chữ hóa đơn điện tử', () => {
  it('đọc tên, MST, địa chỉ người mua và không nhầm địa chỉ người bán', () => {
    const kq = phanTichChuHoaDon(CHU_MAU)
    expect(kq).toMatchObject({
      tenBanHang: 'CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI TIẾN THẮNG',
      mstBanHang: '0108021157',
      tenMuaHang: 'Trung Tâm Đào Tạo Ngân Hàng Chính Sách Xã Hội',
      mstMuaHang: '0100695387066',
      diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
      kyHieuHd: '1C26MLD',
      soHd: '00001656',
      ngay: '2026-09-11',
      tongTien: 2_439_160,
      loaiHd: 'gtgt',
      cotTienHang: 'truoc_thue',
    })
    expect(kq?.diaChiMuaHang).not.toMatch(/Lan Viên/)
    expect(kq?.dongHang?.some(d => d.ten === 'Bia Tiger' && d.thanhTien === 280_000 && d.tienThue === 28_000 && d.thueSuat === 10)).toBe(true)
    expect(kq?.dongHang?.some(d => d.ten === 'Bia Hà Nội' && d.thanhTien === 286_000 && d.tienThue === 28_600)).toBe(true)
  })

  it('gộp mảnh chữ cùng dòng theo tọa độ', () => {
    expect(gopDongChu([
      { x: 31, y: 661, chu: 'Tên đơn vị' },
      { x: 73, y: 661, chu: ':' },
      { x: 78, y: 662, chu: 'Trung Tâm Đào Tạo' },
    ])).toEqual(['Tên đơn vị : Trung Tâm Đào Tạo'])
  })

  it('trang trống thì không bịa', () => {
    expect(phanTichChuHoaDon('')).toBeNull()
    expect(phanTichChuHoaDon([])).toBeNull()
  })

  it('đọc chữ PDF mẫu nếu có trong thư mục dự án', async () => {
    const tep = join(process.cwd(), '1C26MLD_00001656_0100695387-066.pdf')
    if (!existsSync(tep)) return
    const kq = phanTichChuHoaDon(await docChuPdf(await readFile(tep)))
    expect(kq).toMatchObject({
      tenMuaHang: 'Trung Tâm Đào Tạo Ngân Hàng Chính Sách Xã Hội',
      mstMuaHang: '0100695387066',
      kyHieuHd: '1C26MLD',
      soHd: '00001656',
      ngay: '2026-09-11',
      tongTien: 2_439_160,
    })
    expect(kq?.diaChiMuaHang).toMatch(/169 phố Linh Đường/i)
    expect(kq?.dongHang?.some(d => /bia tiger/i.test(d.ten))).toBe(true)
    expect(kq?.dongHang?.some(d => /bia hà nội/i.test(d.ten))).toBe(true)
  }, 20_000)
})
