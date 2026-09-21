import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CAU_HINH_GIAY_MAC_DINH, dungGiay, giayChoHinhThuc, kinhPhiDuKien, LOAI_GIAY, mauChuoi, soTienThanhToan, taiKhoanNhan, tenTep, type BoiCanhGiay, type CanBo, type LoaiGiay } from './giay'
import { HINH_THUC, TRANG_THAI, type GiaoDichTinh, type TaiKhoanNhan } from './kieu'
import { dienMauDocx, TEP_NOI_DUNG } from '@/lib/van-ban/docx'
import { docZip } from '@/lib/van-ban/zip'

const nguoiDeNghi: CanBo = {
  id: 'cb-nd', hoTen: 'Phạm Văn Hiệp', gioiTinh: 'Ông', chucDanh: 'Chuyên viên',
  phong: 'Phòng Hành chính Tổ chức', laLanhDao: false, dangHoatDong: true,
}
const lanhDaoTk: CanBo = {
  id: 'cb-tk', hoTen: 'Nguyễn Văn A', gioiTinh: 'Ông', chucDanh: 'Giám đốc',
  phong: null, laLanhDao: true, dangHoatDong: true,
}
const lanhDaoTt: CanBo = {
  id: 'cb-tt', hoTen: 'Trần Thị B', gioiTinh: 'Bà', chucDanh: 'Phó Giám đốc',
  phong: null, laLanhDao: true, dangHoatDong: true,
}
const truongPhong: CanBo = {
  id: 'cb-tp', hoTen: 'Đỗ Thị D', gioiTinh: 'Bà', chucDanh: null,
  phong: 'Phòng Hành chính Tổ chức', laLanhDao: false, dangHoatDong: true,
}
const keToan: CanBo = {
  id: 'cb-kt', hoTen: 'Lê Thị C', gioiTinh: 'Bà', chucDanh: 'Kế toán',
  phong: 'Phòng Kế toán', laLanhDao: false, dangHoatDong: true,
}

const TK: TaiKhoanNhan = { soTaiKhoan: '123456789', nganHang: 'NHCSXH', tenChuTk: 'Phạm Văn Hiệp', canBoId: nguoiDeNghi.id, chiNhanh: 'Hà Nội' }

const gd = (phan: Partial<GiaoDichTinh>): GiaoDichTinh => ({
  id: 'g1', ngay: '2026-09-20', soThuTu: 1, taoLuc: '2026-09-20T00:00:00.000Z', noiDung: 'Tiếp Phòng Kế hoạch',
  kyHieuHd: '1C26MTT', soHd: '00123456', loaiHd: 'Hóa đơn Giá trị gia tăng', trangThaiHd: TRANG_THAI.HOP_LE,
  hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 1_200_000, tienRuouBia: 0, tamUngTuCq: 0, giaoTienChiThuy: 0,
  hoanUngTienMat: 0, nguoiLayHdId: null, nguoiLayHdTen: null, phiLayHdGhiDe: null,
  trangThaiTtPhi: 'Không phát sinh', ghiChu: null, donViId: null, donViTen: 'Phòng Kế hoạch',
  hinhThucThanhToan: null, taiKhoanNhan: null, coHoaDon: true, coChuyenKhoan: false,
  hoanTamUng: 0, cqTraThang: 0, phiLayHd: 0, duLyThuyet: 0, duThucTe: 0, duDangCam: 0,
  ...phan,
})

const ctx = (phan: Partial<BoiCanhGiay> = {}): BoiCanhGiay => ({
  nguoiDeNghi,
  canBo: [nguoiDeNghi, lanhDaoTk, lanhDaoTt, truongPhong, keToan],
  cauHinh: {
    ...CAU_HINH_GIAY_MAC_DINH,
    lanhDaoTiepKhachId: lanhDaoTk.id, lanhDaoThanhToanId: lanhDaoTt.id,
    truongPhongId: truongPhong.id, keToanKiemSoatId: keToan.id,
  },
  taiKhoanTheoNguoiLayHd: {},
  ...phan,
})

describe('viết tắt phòng trên giấy', () => {
  it.each([['Phòng Hành chính Tổ chức', 'PHÒNG HCTC'], ['Phòng Kế toán', 'PHÒNG KT'], ['Phòng Đào tạo', 'PHÒNG ĐT'], ['P. HCTC', 'PHÒNG HCTC'], ['', '']])('%s → %s', (phong, expected) => {
    const g = dungGiay(LOAI_GIAY.TIEP_KHACH, gd({}), ctx({ nguoiDeNghi: { ...nguoiDeNghi, phong } }))
    expect(g.thayThe.PHONGTK).toBe(expected)
  })
})

describe('giấy theo hình thức giao dịch', () => {
  it('tạm ứng thêm lập một giấy, hoàn tạm ứng và cơ quan trả thẳng lập hai giấy', () => {
    expect(giayChoHinhThuc(HINH_THUC.TAM_UNG_THEM)).toEqual([LOAI_GIAY.TAM_UNG])
    expect(giayChoHinhThuc(HINH_THUC.HOAN_TAM_UNG)).toEqual([LOAI_GIAY.TIEP_KHACH, LOAI_GIAY.THANH_TOAN])
    expect(giayChoHinhThuc(HINH_THUC.CQ_TRA_THANG)).toEqual([LOAI_GIAY.TIEP_KHACH, LOAI_GIAY.THANH_TOAN])
  })

  it('dòng tiền nội bộ không có giấy nào', () => {
    for (const hinhThuc of [HINH_THUC.GIAO_CHI_THUY, HINH_THUC.NOP_HOAN_CQ, '', 'Không tồn tại']) {
      expect(giayChoHinhThuc(hinhThuc)).toEqual([])
    }
  })
})

describe('số tiền trên giấy', () => {
  it('kinh phí dự kiến làm tròn lên hàng 500.000 của tổng tiền hóa đơn', () => {
    expect(kinhPhiDuKien(1_200_000)).toBe(1_500_000)
    expect(kinhPhiDuKien(1_700_000)).toBe(2_000_000)
    expect(kinhPhiDuKien(1_500_000)).toBe(1_500_000)
    expect(kinhPhiDuKien(1)).toBe(500_000)
    expect(kinhPhiDuKien(0)).toBe(0)
    expect(kinhPhiDuKien(-100)).toBe(0)
  })

  it('số tiền thanh toán bằng tổng tiền trừ rượu bia', () => {
    expect(soTienThanhToan(gd({ tongTien: 5_647_000, tienRuouBia: 500_000 }))).toBe(5_147_000)
    expect(soTienThanhToan(gd({ tongTien: 1_000_000, tienRuouBia: 0 }))).toBe(1_000_000)
    // Loại trừ nhiều hơn tổng tiền thì không in ra số âm.
    expect(soTienThanhToan(gd({ tongTien: 100_000, tienRuouBia: 500_000 }))).toBe(0)
  })
})

describe('tài khoản nhận tiền in trên giấy', () => {
  it('lấy tài khoản liên kết đúng người đề nghị, không lấy theo giao dịch hoặc mặc định', () => {
    const c = ctx({
      taiKhoanTheoNguoiLayHd: { 'nl-a': TK, 'nl-b': { soTaiKhoan: '999', nganHang: null, tenChuTk: null } },
      cauHinh: { ...CAU_HINH_GIAY_MAC_DINH, nguoiLayHdMacDinhId: 'nl-b' },
    })
    expect(taiKhoanNhan(gd({ nguoiLayHdId: 'nl-a' }), c)).toEqual(TK)
    expect(taiKhoanNhan(gd({ nguoiLayHdId: null }), c)).toEqual(TK)
    expect(taiKhoanNhan(gd({ nguoiLayHdId: 'nl-khac' }), c)).toEqual(TK)
    expect(taiKhoanNhan(gd({}), { ...c, nguoiDeNghi: lanhDaoTk })).toBeNull()
    expect(taiKhoanNhan(gd({}), { ...c, taiKhoanTheoNguoiLayHd: { a: TK, b: TK } })).toBeNull()
  })

  it('không có cả hai thì trả về null để giấy chỉ in chữ "Chuyển khoản"', () => {
    expect(taiKhoanNhan(gd({}), ctx())).toBeNull()
  })
})

describe('giấy đề nghị tạm ứng', () => {
  it('in số tạm ứng, hai ô vuông và chữ ký của trưởng phòng', () => {
    const giay = dungGiay(LOAI_GIAY.TAM_UNG, gd({
      hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 2_000_000, hinhThucThanhToan: 'chuyen_khoan',
    }), ctx())

    expect(giay.tieuDe).toBe('Giấy đề nghị tạm ứng')
    expect(giay.dongNgay).toBe('Hà Nội, ngày 20 tháng 9 năm 2026')
    expect(giay.dauTrang).toEqual(['NGÂN HÀNG CHÍNH SÁCH XÃ HỘI', 'TRUNG TÂM ĐÀO TẠO', 'PHÒNG HCTC'])
    expect(giay.kinhGui).toBe('Kính gửi: Ông Nguyễn Văn A – Giám đốc Trung tâm Đào tạo')
    expect(giay.than).toContain('Số tiền đề nghị tạm ứng: 2.000.000 đ')
    expect(giay.than).toContain('Hình thức tạm ứng: ☒ Chuyển khoản  ☐ Tiền mặt.')
    expect(giay.thayThe.sotien).toBe('2.000.000')
    expect(giay.thayThe.sotienbangchu).toBe('Hai triệu')
    expect(giay.chuKy.map(o => o[0].hoTen)).toEqual([lanhDaoTk.hoTen, truongPhong.hoTen, nguoiDeNghi.hoTen])
  })

  it('để trống hình thức thanh toán thì in ô Tiền mặt', () => {
    const giay = dungGiay(LOAI_GIAY.TAM_UNG, gd({ hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 100_000 }), ctx())
    expect(giay.than).toContain('Hình thức tạm ứng: ☐ Chuyển khoản  ☒ Tiền mặt.')
    expect(giay.hinhThucThanhToan).toBe('Tiền mặt')
  })
})

describe('giấy tiếp khách và giấy thanh toán', () => {
  it('kinh phí dự kiến làm tròn lên và số thanh toán trừ rượu bia', () => {
    const g = gd({ tongTien: 1_700_000, tienRuouBia: 200_000, hinhThuc: HINH_THUC.CQ_TRA_THANG })
    const tiepKhach = dungGiay(LOAI_GIAY.TIEP_KHACH, g, ctx())
    expect(tiepKhach.than).toContain('Kinh phí dự kiến: 2.000.000đ')
    expect(tiepKhach.than).toContain('(Bằng chữ: Hai triệu đồng)')
    expect(tiepKhach.kinhGui).toBe('Kính gửi: Ông Nguyễn Văn A – Giám đốc Trung tâm Đào tạo')

    const thanhToan = dungGiay(LOAI_GIAY.THANH_TOAN, g, ctx())
    expect(thanhToan.than).toContain('2. Số tiền đề nghị thanh toán: 1.500.000 đồng')
    expect(thanhToan.kinhGui).toBe('Kính gửi: Bà Trần Thị B – Phó Giám đốc Trung tâm Đào tạo')
    expect(thanhToan.chuKy.map(o => o[0].hoTen)).toEqual([lanhDaoTt.hoTen, keToan.hoTen, nguoiDeNghi.hoTen])
  })

  it('hoàn tạm ứng in chữ "Hoàn tạm ứng" và không kèm tài khoản', () => {
    const giay = dungGiay(LOAI_GIAY.THANH_TOAN, gd({ hinhThuc: HINH_THUC.HOAN_TAM_UNG }), ctx({
      taiKhoanTheoNguoiLayHd: { 'nl-a': TK },
      cauHinh: { ...CAU_HINH_GIAY_MAC_DINH, nguoiLayHdMacDinhId: 'nl-a' },
    }))
    expect(giay.hinhThucThanhToan).toBe('Hoàn tạm ứng')
    expect(giay.taiKhoan).toBeNull()
    expect(giay.than).toContain('3. Hình thức thanh toán: Hoàn tạm ứng.')
  })

  it('cơ quan trả thẳng bằng chuyển khoản thì in kèm số tài khoản ngay trên dòng đó', () => {
    // Mẫu Word chỉ có một dòng cho mục 3 nên tài khoản phải nằm cùng dòng.
    const giay = dungGiay(LOAI_GIAY.THANH_TOAN, gd({
      hinhThuc: HINH_THUC.CQ_TRA_THANG, hinhThucThanhToan: 'chuyen_khoan', nguoiLayHdId: 'nl-a',
    }), ctx({ taiKhoanTheoNguoiLayHd: { 'nl-a': TK } }))
    expect(giay.taiKhoan).toEqual(TK)
    expect(giay.than).toContain(
      '3. Hình thức thanh toán: Chuyển khoản – Số tài khoản: 123456789 – Ngân hàng: NHCSXH – Chi nhánh: Hà Nội – Chủ tài khoản: Phạm Văn Hiệp.')
    expect(giay.thayThe.dongtaikhoan).toBe('Số tài khoản: 123456789 – Ngân hàng: NHCSXH – Chi nhánh: Hà Nội – Chủ tài khoản: Phạm Văn Hiệp')
    expect(giay.thayThe.sotaiKhoan).toBe('123456789')
  })

  it('chuyển khoản mà chưa cấu hình tài khoản thì chỉ in chữ "Chuyển khoản"', () => {
    const giay = dungGiay(LOAI_GIAY.THANH_TOAN, gd({
      hinhThuc: HINH_THUC.CQ_TRA_THANG, hinhThucThanhToan: 'chuyen_khoan',
    }), ctx())
    expect(giay.taiKhoan).toBeNull()
    expect(giay.than).toContain('3. Hình thức thanh toán: Chuyển khoản.')
    expect(giay.thayThe.dongtaikhoan).toBe('')
  })
})

describe('thay chữ gõ cứng trong mẫu Word', () => {
  it('mẫu chữ khớp cả dạng NFC lẫn dạng tách dấu NFD', () => {
    // Hai tệp mẫu lưu "TRUNG TÂM ĐÀO TẠO" ở hai dạng Unicode khác nhau, nên mẫu phải
    // khớp cả hai; nếu chỉ so chuỗi thường thì một tệp sẽ không được thay.
    const nfc = 'TRUNG TÂM ĐÀO TẠO'
    const nfd = nfc.normalize('NFD')
    expect(nfc).not.toBe(nfd)
    // Regex có cờ g nên giữ lastIndex giữa các lần test; mỗi lần dùng một regex mới.
    const khop = (mau: string, chuoi: string) => mauChuoi(mau).test(chuoi)
    expect(khop(nfc, nfc)).toBe(true)
    expect(khop(nfc, nfd)).toBe(true)
    expect(khop(nfd, nfc)).toBe(true)
    expect(khop(nfd, nfd)).toBe(true)
  })

  it('không khớp chuỗi khác nội dung', () => {
    expect(mauChuoi('Phòng HCTC').test('Phòng Kế hoạch')).toBe(false)
  })

  it('thay tên đơn vị, tên phòng, người đề nghị và lý do gõ cứng', () => {
    const giay = dungGiay(LOAI_GIAY.TAM_UNG, gd({ hinhThuc: HINH_THUC.TAM_UNG_THEM }), ctx({
      cauHinh: {
        ...CAU_HINH_GIAY_MAC_DINH,
        tenDonVi: 'Trung tâm Tin học', diaDanh: 'Đà Nẵng',
        lyDoTamUng: 'Công tác phí', thoiHanThanhToan: 'Trong 30 ngày',
        lanhDaoTiepKhachId: lanhDaoTk.id, truongPhongId: truongPhong.id,
      },
    }))

    const thay = (chuoi: string) => giay.thayCoDinh.reduce((acc, r) => acc.replace(r.mau, r.thay), chuoi)
    expect(thay('Độc lập - Tự do - Tự do')).toBe('Độc lập - Tự do - Hạnh phúc')
    expect(thay('P. HÀNH CHÍNH TỔ CHỨC')).toBe('PHÒNG HCTC')
    expect(thay('Phòng HCTC')).toBe('Phòng Hành chính Tổ chức')
    expect(thay('TRUNG TÂM ĐÀO TẠO').normalize('NFC')).toBe('TRUNG TÂM TIN HỌC')
    expect(thay('Trung tâm Đào tạo')).toBe('Trung tâm Tin học')
    expect(thay('Phạm Văn Hiệp')).toBe('Phạm Văn Hiệp')
    expect(thay('Ngô Anh Phương')).toBe('Đỗ Thị D')
    expect(thay('chi tiêu hành chính')).toBe('Công tác phí')
    expect(thay('Sau khi hoàn thành công việc')).toBe('Trong 30 ngày')
    expect(thay('ngày   tháng')).toBe('ngày 20 tháng')
    expect(thay(']]/ [[')).toBe(']]/[[')
  })

  it('trưởng phòng chưa cấu hình thì xoá tên người soạn mẫu chứ không giữ lại', () => {
    const giay = dungGiay(LOAI_GIAY.TAM_UNG, gd({ hinhThuc: HINH_THUC.TAM_UNG_THEM }), ctx({
      cauHinh: { ...CAU_HINH_GIAY_MAC_DINH, lanhDaoTiepKhachId: lanhDaoTk.id, truongPhongId: null },
    }))
    const thay = giay.thayCoDinh.reduce((acc, r) => acc.replace(r.mau, r.thay), 'Ngô Anh Phương')
    expect(thay).toBe('')
  })

  it('giấy thanh toán thay dòng "Hoàn tạm ứng" gõ cứng bằng hình thức thật', () => {
    const giay = dungGiay(LOAI_GIAY.THANH_TOAN, gd({
      hinhThuc: HINH_THUC.CQ_TRA_THANG, hinhThucThanhToan: 'chuyen_khoan', nguoiLayHdId: 'nl-a',
    }), ctx({ taiKhoanTheoNguoiLayHd: { 'nl-a': TK } }))
    const thay = giay.thayCoDinh.reduce((acc, r) => acc.replace(r.mau, r.thay), '3. Hình thức thanh toán: Hoàn tạm ứng.')
    expect(thay).toContain('3. Hình thức thanh toán: Chuyển khoản – Số tài khoản: 123456789')
  })
})

describe('tên tệp tải về', () => {
  it('ghép tên giấy, ngày và số hóa đơn', () => {
    expect(tenTep(LOAI_GIAY.TAM_UNG, gd({ soHd: '00123456' }))).toBe('Giấy đề nghị tạm ứng 2026-09-20 00123456.docx')
  })

  it('chưa có số hóa đơn thì dùng mã giao dịch và bỏ ký tự không hợp lệ', () => {
    expect(tenTep(LOAI_GIAY.THANH_TOAN, gd({ soHd: null, id: 'a/b c' }))).toBe('Giấy đề nghị thanh toán 2026-09-20 a-b-c.docx')
  })
})

// Phần dưới đây điền thẳng vào hai tệp mẫu thật trong Mau/, nên nó bắt được cả những chỗ
// mẫu Word gõ cứng mà danh sách thay thế bỏ sót — thứ mà một bài kiểm tra chỉ nhìn vào
// dungGiay() không thể thấy.
const THU_MUC_MAU = fileURLToPath(new URL('../../Mau/', import.meta.url))
const MAU: Record<LoaiGiay, Buffer> = {
  [LOAI_GIAY.TAM_UNG]: readFileSync(`${THU_MUC_MAU}Tam ung tien.docx`),
  [LOAI_GIAY.TIEP_KHACH]: readFileSync(`${THU_MUC_MAU}tiep khach va thanh toan.docx`),
  [LOAI_GIAY.THANH_TOAN]: readFileSync(`${THU_MUC_MAU}tiep khach va thanh toan.docx`),
}

// Gộp text của các run trong từng đoạn, giống cách Word hiển thị, để khẳng định chữ in ra
// chứ không kiểm tra XML thô.
function doanCua(tep: Buffer): string[] {
  const muc = docZip(tep).find(m => m.ten === TEP_NOI_DUNG)
  if (!muc) throw new Error('thiếu word/document.xml')
  return [...muc.duLieu.toString('utf8').matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(p => {
    const gop = [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(r => r[1]).join('')
    return gop
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
      .normalize('NFC')
  })
}

const giayThat = (loai: LoaiGiay, g: GiaoDichTinh, c: BoiCanhGiay) => {
  const giay = dungGiay(loai, g, c)
  const { duLieu, thieu } = dienMauDocx(MAU[loai], giay.thayThe, giay.thayCoDinh)
  return { doan: doanCua(duLieu), chu: doanCua(duLieu).join('\n'), thieu }
}

// Cấu hình khác hẳn mẫu ở mọi giá trị gõ cứng, để chỗ nào còn giữ chữ của người soạn mẫu
// sẽ lộ ra ngay.
const cauHinhRieng = {
  ...CAU_HINH_GIAY_MAC_DINH,
  tenDonVi: 'Trung tâm Tin học', diaDanh: 'Đà Nẵng',
  lyDoTamUng: 'Công tác phí', thoiHanThanhToan: 'Trong 30 ngày',
  lanhDaoTiepKhachId: lanhDaoTk.id, lanhDaoThanhToanId: lanhDaoTt.id,
  truongPhongId: truongPhong.id, keToanKiemSoatId: keToan.id,
}
const nguoiDeNghiRieng: CanBo = { ...nguoiDeNghi, hoTen: 'Vũ Văn E' }
const ctxRieng = (phan: Partial<BoiCanhGiay> = {}) => ctx({ nguoiDeNghi: nguoiDeNghiRieng, cauHinh: cauHinhRieng, ...phan })

describe('điền vào tệp Word thật', () => {
  it('hai phần nội dung từ Căn cứ đến hết lời đề nghị dùng Times New Roman 14pt', () => {
    const g = dungGiay(LOAI_GIAY.THANH_TOAN, gd({}), ctx())
    const bytes = dienMauDocx(MAU.thanh_toan, g.thayThe, g.thayCoDinh).duLieu
    const xml = docZip(bytes).find(e => e.ten === TEP_NOI_DUNG)!.duLieu.toString('utf8')
    let active = false, sections = 0, checked = 0
    for (const [p] of xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
      const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').normalize('NFC').trim()
      if (text.startsWith('Căn cứ')) { active = true; sections++ }
      if (/^(DUYỆT CỦA|NGÂN HÀNG)/.test(text)) active = false
      if (!active) continue
      for (const [run] of p.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
        if (!/<w:t[\s>]/.test(run)) continue
        expect(run).toContain('w:ascii="Times New Roman"')
        expect(run).toContain('w:hAnsi="Times New Roman"')
        expect(run).toContain('<w:sz w:val="28"/>')
        expect(run).toContain('<w:szCs w:val="28"/>')
        checked++
      }
    }
    expect(sections).toBe(2)
    expect(checked).toBeGreaterThan(20)
  })
  it('giấy tạm ứng không còn chỗ trống và không giữ chữ gõ cứng của người soạn mẫu', () => {
    const { chu, thieu } = giayThat(LOAI_GIAY.TAM_UNG, gd({
      hinhThuc: HINH_THUC.TAM_UNG_THEM, tamUngTuCq: 2_000_000, hinhThucThanhToan: 'chuyen_khoan',
    }), ctxRieng())

    // Mọi chỗ trống [[...]] đều có dữ liệu; thiếu một cái là giấy in ra còn nguyên tên ô.
    expect(thieu).toEqual([])
    expect(chu).not.toContain('[[')
    // Chữ của người soạn mẫu phải được thay hết, kể cả địa danh ở dòng ngày tháng.
    for (const cuaMau of ['Phạm Văn Hiệp', 'Ngô Anh Phương', 'TRUNG TÂM ĐÀO TẠO', 'Trung tâm Đào tạo', 'Phòng HCTC', 'P. HÀNH CHÍNH TỔ CHỨC', 'chi tiêu hành chính', 'Sau khi hoàn thành công việc', 'Hà Nội', 'Tự do - Tự do']) {
      expect(chu, `còn sót "${cuaMau}"`).not.toContain(cuaMau)
    }
    expect(chu).toContain('Đà Nẵng, ngày 20 tháng 9 năm 2026')
    expect(chu).toContain('TRUNG TÂM TIN HỌC')
    expect(chu).toContain('Họ và tên: Vũ Văn E')
    expect(chu).toContain('Đơn vị công tác: Phòng Hành chính Tổ chức - Trung tâm Tin học.')
    expect(chu).toContain('Lý do tạm ứng: Công tác phí.')
    expect(chu).toContain('Số tiền đề nghị tạm ứng: 2.000.000 đ')
    expect(chu).toContain('Hình thức tạm ứng: ☒ Chuyển khoản ☐ Tiền mặt.')
    expect(chu).toContain('Thời hạn thanh toán: Trong 30 ngày.')
    expect(chu).toContain('Kính gửi: Ông Nguyễn Văn A – Giám đốc Trung tâm Tin học')
    expect(chu).toContain('Đỗ Thị D')
  })

  it('giấy thanh toán chuyển khoản in số tài khoản ngay trên dòng hình thức thanh toán', () => {
    const { chu, thieu } = giayThat(LOAI_GIAY.THANH_TOAN, gd({
      hinhThuc: HINH_THUC.CQ_TRA_THANG, hinhThucThanhToan: 'chuyen_khoan', nguoiLayHdId: 'nl-a',
      tongTien: 1_700_000, tienRuouBia: 200_000,
    }), ctxRieng({ taiKhoanTheoNguoiLayHd: { 'nl-a': TK } }))

    expect(thieu).toEqual([])
    expect(chu).not.toContain('[[')
    // Dòng mục 3 của mẫu gõ cứng "Hoàn tạm ứng"; cơ quan trả thẳng bằng chuyển khoản phải
    // in lại cả hình thức lẫn tài khoản nhận tiền, vì mẫu chỉ có một dòng cho mục này.
    expect(chu).not.toContain('3. Hình thức thanh toán: Hoàn tạm ứng.')
    expect(chu).toContain('3. Hình thức thanh toán: Chuyển khoản – Số tài khoản: 123456789 – Ngân hàng: NHCSXH – Chi nhánh: Hà Nội – Chủ tài khoản: Vũ Văn E.')
    expect(chu).toContain('2. Số tiền đề nghị thanh toán: 1.500.000 đồng')
    expect(chu).toContain('Kính gửi: Bà Trần Thị B – Phó Giám đốc Trung tâm Tin học')
    expect(chu).toContain('- Hóa đơn mã 1C26MTT, số 00123456, ngày 20/9/2026;')
  })

  it('hoàn tạm ứng không in tài khoản, và giấy tiếp khách in kinh phí làm tròn', () => {
    const hoan = giayThat(LOAI_GIAY.THANH_TOAN, gd({ hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 1_200_000 }), ctxRieng())
    expect(hoan.thieu).toEqual([])
    expect(hoan.chu).toContain('3. Hình thức thanh toán: Hoàn tạm ứng.')
    expect(hoan.chu).not.toContain('Số tài khoản:')

    const tiepKhach = giayThat(LOAI_GIAY.TIEP_KHACH, gd({ hinhThuc: HINH_THUC.HOAN_TAM_UNG, tongTien: 1_200_000 }), ctxRieng())
    expect(tiepKhach.thieu).toEqual([])
    expect(tiepKhach.chu).not.toContain('[[')
    expect(tiepKhach.chu).toContain('Kinh phí dự kiến: 1.500.000đ')
    // Mẫu đã có sẵn chữ " đồng)" sau chỗ trống nên phần đọc số chỉ điền tới "nghìn".
    expect(tiepKhach.chu).toContain('(Bằng chữ: Một triệu năm trăm nghìn đồng)')
    expect(tiepKhach.chu).toContain('Ngày tiếp khách: 20/9/2026')
    // Mẫu tiếp khách để phòng trần ở chỗ trống [[PHONGTK]], không kèm chữ "P." như mẫu tạm ứng.
    expect(tiepKhach.chu).toContain('PHÒNG HCTC')
  })
})
