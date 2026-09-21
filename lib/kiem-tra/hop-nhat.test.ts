import { describe, expect, it } from 'vitest'
import { diaChiGanDung, doiChieuNguoiMua, hopNhatBaLop, hopNhatHaiLop, tenGanDung } from './hop-nhat'
import type { DonViDoiChieu, DuLieuDocTuHoaDon } from './giao-dien'

const qr: DuLieuDocTuHoaDon = {
  mstBanHang: '0101234567', kyHieuHd: '1C26MTT', soHd: '0001', ngay: '2026-09-17', tongTien: 200_000,
}
const ai: DuLieuDocTuHoaDon = {
  mstBanHang: '0109999999', kyHieuHd: 'SAI', soHd: '9999', ngay: '2026-01-01', tongTien: 1,
  tenBanHang: 'Nhà hàng A', mstMuaHang: '0100100100', tenMuaHang: 'Trung tâm Đào tạo',
  dongHang: [
    { ten: 'Bia Heineken', thanhTien: 50_000 },
    { ten: 'Cơm rang', thanhTien: 150_000 },
  ],
  tienRuouBia: 80_000,
}

describe('hợp nhất hai lớp QR + AI', () => {
  it('QR thắng trên trường khóa, AI điền phần còn lại, lấy tiền rượu bia của AI', () => {
    const kq = hopNhatHaiLop(qr, ai)
    expect(kq.deXuat).toMatchObject({
      ...qr, tenBanHang: 'Nhà hàng A', mstMuaHang: '0100100100', tenMuaHang: 'Trung tâm Đào tạo', tienRuouBia: 80_000,
    })
    expect(kq.phatHien.some(p => p.ma === 'ai_lech_qr' && p.truong === 'tongTien')).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_lech')).toBe(true)
    expect(kq.trangThai).toBe('co_canh_bao')
  })

  it('không có QR thì cảnh báo và lấy AI', () => {
    const kq = hopNhatHaiLop(null, { ...ai, tongTien: 200_000 })
    expect(kq.deXuat.tongTien).toBe(200_000)
    expect(kq.deXuat.tienRuouBia).toBe(80_000)
    expect(kq.phatHien.some(p => p.ma === 'qr_khong_doc_duoc')).toBe(true)
  })

  it('không có AI thì giữ QR, không bịa rượu bia', () => {
    const kq = hopNhatHaiLop(qr, null)
    expect(kq.deXuat).toMatchObject(qr)
    expect(kq.deXuat.tienRuouBia).toBeUndefined()
    expect(kq.phatHien.some(p => p.ma === 'ai_khong_chay')).toBe(true)
  })

  it('rượu bia vượt tổng thì xóa số và đánh lỗi', () => {
    const kq = hopNhatHaiLop(qr, { tienRuouBia: 500_000 })
    expect(kq.deXuat.tienRuouBia).toBeUndefined()
    expect(kq.trangThai).toBe('khong_hop_le')
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_vuot_tong')).toBe(true)
  })

  it('AI không ghi tienRuouBia thì cộng dòng rượu bia AI đã đọc', () => {
    const kq = hopNhatHaiLop(qr, {
      dongHang: [{ ten: 'Bia Tiger', thanhTien: 50_000, laRuouBia: true }, { ten: 'Cơm', thanhTien: 150_000, laRuouBia: false }],
    })
    expect(kq.deXuat.tienRuouBia).toBe(50_000)
    expect(kq.ai?.tienRuouBia).toBe(50_000)
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_co' || p.ma === 'ruou_bia_khong')).toBe(false)
  })

  it('không hiện dòng trạng thái rượu bia vì bảng đối chiếu đã có cột', () => {
    const kq = hopNhatHaiLop(qr, { ...ai, tongTien: 200_000 })
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_co' || p.ma === 'ruou_bia_khong')).toBe(false)
    expect(kq.deXuat.tienRuouBia).toBe(80_000)
  })
})

const ocrNguoiMua: DuLieuDocTuHoaDon = {
  tenMuaHang: 'Trung Tâm Đào Tạo Ngân Hàng Chính Sách Xã Hội',
  mstMuaHang: '0100695387066',
  diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
  dongHang: [
    { ten: 'Bia Tiger', thanhTien: 50_000 },
    { ten: 'Cơm rang', thanhTien: 150_000 },
  ],
}

describe('hợp nhất ba lớp QR + OCR + AI', () => {
  it('QR thắng số in trên mã; OCR∩AI điền người mua', () => {
    const kq = hopNhatBaLop(qr, ocrNguoiMua, {
      ...ocrNguoiMua,
      tenMuaHang: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội',
      tongTien: 1,
    })
    expect(kq.deXuat).toMatchObject({
      ...qr,
      tenMuaHang: ocrNguoiMua.tenMuaHang,
      mstMuaHang: '0100695387066',
      diaChiMuaHang: ocrNguoiMua.diaChiMuaHang,
    })
    expect(kq.deXuat.tienRuouBia).toBe(50_000)
    expect(kq.phatHien.some(p => p.ma === 'qr_khong_doc_duoc')).toBe(false)
    expect(kq.phatHien.some(p => p.ma === 'ocr_khong_doc_duoc')).toBe(false)
    expect(kq.phatHien.some(p => p.ma === 'ai_khong_chay')).toBe(false)
    expect(kq.phatHien.some(p => p.ma === 'ocr_lech_ai' && p.truong === 'tenMuaHang')).toBe(false)
  })

  it('QR không có người mua thì OCR + AI vẫn điền', () => {
    const kq = hopNhatBaLop(qr, ocrNguoiMua, ocrNguoiMua)
    expect(kq.deXuat.mstMuaHang).toBe('0100695387066')
    expect(kq.deXuat.tenMuaHang).toBe(ocrNguoiMua.tenMuaHang)
    expect(kq.deXuat.diaChiMuaHang).toBe(ocrNguoiMua.diaChiMuaHang)
  })

  it('OCR hỏng thì lấy người mua từ AI, vẫn giữ QR', () => {
    const kq = hopNhatBaLop(qr, null, ocrNguoiMua)
    expect(kq.deXuat).toMatchObject({ ...qr, ...ocrNguoiMua, tienRuouBia: 50_000 })
    expect(kq.deXuat.tienRuouBia).toBe(50_000)
    expect(kq.phatHien.some(p => p.ma === 'ocr_khong_doc_duoc')).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'mot_nguon')).toBe(false)
  })

  it('AI hỏng thì lấy người mua từ OCR', () => {
    const kq = hopNhatBaLop(qr, ocrNguoiMua, null)
    expect(kq.deXuat.mstMuaHang).toBe('0100695387066')
    expect(kq.deXuat.tenMuaHang).toBe(ocrNguoiMua.tenMuaHang)
    expect(kq.phatHien.some(p => p.ma === 'ai_khong_chay')).toBe(true)
  })

  it('OCR và AI lệch tên thì giữ chữ trên trang', () => {
    const kq = hopNhatBaLop(qr, ocrNguoiMua, { ...ocrNguoiMua, tenMuaHang: 'Công ty khác hẳn' })
    expect(kq.deXuat.tenMuaHang).toBe(ocrNguoiMua.tenMuaHang)
    expect(kq.phatHien.some(p => p.ma === 'ocr_lech_ai' && p.truong === 'tenMuaHang')).toBe(true)
  })

  it('chỉ một lớp thì cảnh báo không đối chiếu chéo', () => {
    const kq = hopNhatBaLop(null, ocrNguoiMua, null)
    expect(kq.phatHien.some(p => p.ma === 'mot_nguon')).toBe(true)
    expect(kq.deXuat.mstMuaHang).toBe('0100695387066')
  })

  it('hóa đơn GTGT lấy tiền rượu bia của AI, không cộng từ điển dòng hàng', () => {
    const kq = hopNhatBaLop({ ...qr, tongTien: 2_439_160 }, {
      ...ocrNguoiMua,
      loaiHd: 'gtgt',
      cotTienHang: 'truoc_thue',
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, thueSuat: 10 },
        { ten: 'Cơm rang', thanhTien: 120_000, tienThue: 9_600 },
      ],
    }, { ...ocrNguoiMua, tienRuouBia: 308_000 })
    expect(kq.deXuat.loaiHd).toBe('gtgt')
    expect(kq.deXuat.tienRuouBia).toBe(308_000)
    expect(kq.phatHien.some(p => p.ma === 'loai_hd_gtgt')).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_co' || p.ma === 'ruou_bia_khong')).toBe(false)
  })

  it('hóa đơn GTGT không có lớp AI thì không bịa số rượu bia, vẫn gắn nhãn dòng hàng', () => {
    const kq = hopNhatBaLop({ ...qr, kyHieuHd: '1C26MLD', tongTien: 400_000 }, {
      loaiHd: 'gtgt',
      cotTienHang: 'sau_thue',
      dongHang: [{ ten: 'Bia Tiger', thanhTien: 308_000 }],
    }, null)
    expect(kq.deXuat.tienRuouBia).toBeUndefined()
    expect(kq.deXuat.dongHang?.[0].laRuouBia).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'ruou_bia_co' || p.ma === 'ruou_bia_khong')).toBe(false)
  })

  it('AI không ghi tienRuouBia thì cộng Bia Tiger + Bia Hà Nội trên danh mục', () => {
    const kq = hopNhatBaLop({ ...qr, tongTien: 2_439_160 }, {
      loaiHd: 'gtgt',
      cotTienHang: 'truoc_thue',
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, thueSuat: 10 },
        { ten: 'Dê cuốn mỡ chài', thanhTien: 351_491, tienThue: 35_149 },
        { ten: 'Chân Dê hầm ngải cứu thuốc bắc', thanhTien: 165_927, tienThue: 16_593 },
        { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, thueSuat: 10 },
      ],
    }, {
      dongHang: [
        { ten: 'Bia Tiger', thanhTien: 280_000, tienThue: 28_000, laRuouBia: true },
        { ten: 'Dê cuốn mỡ chài', thanhTien: 351_491, laRuouBia: false },
        { ten: 'Chân Dê hầm ngải cứu thuốc bắc', thanhTien: 165_927, laRuouBia: false },
        { ten: 'Bia Hà Nội', thanhTien: 286_000, tienThue: 28_600, laRuouBia: true },
      ],
    })
    expect(kq.deXuat.tienRuouBia).toBe(622_600)
    expect(kq.ai?.tienRuouBia).toBe(622_600)
    expect(kq.deXuat.dongHang?.filter(d => d.laRuouBia).map(d => d.ten)).toEqual(['Bia Tiger', 'Bia Hà Nội'])
  })
})

const donVi = (phan: Partial<DonViDoiChieu> = {}): DonViDoiChieu => ({
  mst: '0100100100', ten: 'Trung tâm Đào tạo', diaChi: '', ...phan,
})

const donViMau: DonViDoiChieu = {
  mst: '0100695387-066',
  ten: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội',
  diaChi: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
}

describe('đối chiếu người mua với MST đơn vị', () => {
  it('MST khác thì lỗi', () => {
    const phat = doiChieuNguoiMua({ mstMuaHang: '1111111111' }, donVi())
    expect(phat.some(p => p.muc === 'loi' && p.ma === 'mst_khong_khop')).toBe(true)
    expect(phat.find(p => p.ma === 'mst_khong_khop')?.thongDiep).toContain('0100100100')
  })

  it('MST khớp, tên lệch thì cảnh báo', () => {
    const phat = doiChieuNguoiMua(
      { mstMuaHang: '0100100100', tenMuaHang: 'Công ty khác' },
      donVi(),
    )
    expect(phat.some(p => p.ma === 'mst_khop' || p.ma === 'mst_khong_khop')).toBe(false)
    expect(phat.some(p => p.muc === 'canh_bao' && p.ma === 'ten_mua_lech')).toBe(true)
  })

  it('chưa cấu hình MST thì chỉ thông tin, không chặn', () => {
    const phat = doiChieuNguoiMua({ mstMuaHang: '0100100100' }, donVi({ mst: '', ten: '' }))
    expect(phat.find(p => p.ma === 'mst_chua_cau_hinh')?.muc).toBe('thong_tin')
    expect(phat.some(p => p.muc === 'loi')).toBe(false)
  })

  it('tên gần đúng không cảnh báo, hoa/thường chữ đầu không ảnh hưởng', () => {
    expect(tenGanDung('Trung tâm Đào tạo', 'TRUNG TAM DAO TAO')).toBe(true)
    expect(tenGanDung(
      'Trung Tâm Đào Tạo Ngân Hàng Chính Sách Xã Hội',
      'Trung tâm Đào tạo Ngân hàng Chính sách xã hội',
    )).toBe(true)
    expect(tenGanDung('Trung tâm Đào tạo', 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội')).toBe(false)
    const phat = doiChieuNguoiMua(
      { mstMuaHang: '0100100100', tenMuaHang: 'Trung tâm Đào tạo' },
      donVi({ mst: '010-010-0100' }),
    )
    expect(phat.some(p => p.ma === 'mst_khop' || p.ma === 'ten_khop')).toBe(false)
    expect(phat.some(p => p.ma === 'ten_mua_lech')).toBe(false)
  })

  it('MST chi nhánh 13 số hiện gạch nối 0100695387-066', () => {
    const phat = doiChieuNguoiMua(
      { mstMuaHang: '0100695387066', tenMuaHang: donViMau.ten, diaChiMuaHang: donViMau.diaChi },
      donViMau,
    )
    expect(phat.some(p => p.ma === 'mst_khop' || p.ma === 'ten_khop' || p.ma === 'dia_chi_khop')).toBe(false)
    expect(phat.some(p => p.muc === 'loi' || p.muc === 'canh_bao')).toBe(false)
  })

  it('địa chỉ hóa đơn thiếu “Việt Nam” vẫn khớp', () => {
    expect(diaChiGanDung(
      'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội',
      donViMau.diaChi,
    )).toBe(true)
    const phat = doiChieuNguoiMua(
      { mstMuaHang: donViMau.mst, tenMuaHang: donViMau.ten, diaChiMuaHang: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội' },
      donViMau,
    )
    expect(phat.some(p => p.ma === 'dia_chi_khop' || p.ma === 'dia_chi_khong_khop')).toBe(false)
  })

  it('địa chỉ khác thì cảnh báo', () => {
    const phat = doiChieuNguoiMua(
      { mstMuaHang: donViMau.mst, tenMuaHang: donViMau.ten, diaChiMuaHang: '1 Đống Đa, Hà Nội' },
      donViMau,
    )
    expect(phat.some(p => p.ma === 'dia_chi_khong_khop')).toBe(true)
  })
})
