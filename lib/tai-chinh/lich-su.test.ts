import { describe, expect, it } from 'vitest'
import {
  boCanhRong, dinhDangLuc, dungMucLichSu, gomMaThamChieu, hienThiGiaTri,
  nhanCot, soSanhThayDoi, tenNguoiThucHien, tomTatHanhDong, TRONG,
} from './lich-su'

const DON_VI = '11111111-1111-4111-8111-111111111111'
const DON_VI_KHAC = '22222222-2222-4222-8222-222222222222'
const NGUOI_LAY = '33333333-3333-4333-8333-333333333333'
const NGUOI_DUNG = '44444444-4444-4444-8444-444444444444'

const boCanh = {
  donVi: { [DON_VI]: 'Phòng Kế hoạch', [DON_VI_KHAC]: 'Phòng Tổ chức' },
  nguoiLayHd: { [NGUOI_LAY]: 'Trần Thị Thúy' },
  nguoiDung: { [NGUOI_DUNG]: 'Nguyễn Văn A' },
}

// Một dòng giao_dich đầy đủ như trigger chụp lại. Các mốc thời gian tự đổi mỗi lần
// ghi nên có mặt trong jsonb nhưng không bao giờ được hiện ra.
const ban = (ghiDe: Record<string, unknown> = {}) => ({
  id: 'g1', ngay: '2026-01-15', so_thu_tu: 1,
  tao_luc: '2026-01-15T03:00:00.000Z', sua_luc: '2026-01-15T03:00:00.000Z',
  nguoi_tao: NGUOI_DUNG, nguoi_sua: NGUOI_DUNG,
  noi_dung: 'Tiếp Phòng Kế hoạch', don_vi_id: DON_VI,
  ky_hieu_hd: '1C26MTT', so_hd: '00123456', loai_hd: 'Hóa đơn Giá trị gia tăng',
  trang_thai_hd: 'Hợp lệ', hinh_thuc: 'Hoàn tạm ứng',
  tong_tien: 5_647_000, tien_ruou_bia: 500_000,
  tam_ung_tu_cq: 0, giao_tien_chi_thuy: 0, hoan_ung_tien_mat: 0,
  nguoi_lay_hd_id: NGUOI_LAY, phi_lay_hd_ghi_de: null,
  trang_thai_tt_phi: 'Chưa thanh toán', ghi_chu: null, da_xoa: false,
  ...ghiDe,
})

describe('hiển thị một giá trị trong lịch sử', () => {
  it('giá trị rỗng hiện bằng dấu gạch chứ không phải chuỗi rỗng', () => {
    expect(hienThiGiaTri('ghi_chu', null)).toBe(TRONG)
    expect(hienThiGiaTri('ghi_chu', '')).toBe(TRONG)
    expect(hienThiGiaTri('phi_lay_hd_ghi_de', undefined)).toBe(TRONG)
  })

  it('cột tiền hiện theo định dạng tiền Việt Nam', () => {
    expect(hienThiGiaTri('tong_tien', 5_647_000)).toContain('5.647.000')
    expect(hienThiGiaTri('phi_lay_hd_ghi_de', 700_000)).toContain('700.000')
    // Số không phải số nguyên an toàn thì đành hiện nguyên văn thay vì làm tròn sai.
    expect(hienThiGiaTri('tong_tien', 'khong-phai-so')).toBe('khong-phai-so')
  })

  it('khóa ngoại được tra sang tên đọc được', () => {
    expect(hienThiGiaTri('don_vi_id', DON_VI, boCanh)).toBe('Phòng Kế hoạch')
    expect(hienThiGiaTri('nguoi_lay_hd_id', NGUOI_LAY, boCanh)).toBe('Trần Thị Thúy')
  })

  it('bản ghi đã bị xóa cứng thì lùi về mã rút gọn, không hiện uuid trần', () => {
    const la = hienThiGiaTri('don_vi_id', DON_VI_KHAC)
    expect(la).toBe('22222222…')
    expect(la).not.toContain('-')
  })

  it('cờ đã xóa hiện bằng Có/Không', () => {
    expect(hienThiGiaTri('da_xoa', true)).toBe('Có')
    expect(hienThiGiaTri('da_xoa', false)).toBe('Không')
  })

  it('nhãn cột lạ thì dùng lại chính tên cột thay vì hiện khoảng trắng', () => {
    expect(nhanCot('tong_tien')).toBe('Tổng tiền')
    expect(nhanCot('cot_moi_them')).toBe('cot_moi_them')
  })
})

describe('so sánh hai phiên bản của cùng một dòng', () => {
  it('lần tạo chỉ tóm tắt các cột cốt lõi, không liệt kê toàn bộ dòng', () => {
    const thayDoi = soSanhThayDoi(null, ban(), boCanh)
    expect(thayDoi.map(t => t.cot)).toEqual(['ngay', 'noi_dung', 'don_vi_id', 'so_hd', 'hinh_thuc', 'trang_thai_hd', 'tong_tien'])
    expect(thayDoi.every(t => t.cu === TRONG)).toBe(true)
    expect(thayDoi.find(t => t.cot === 'don_vi_id')!.moi).toBe('Phòng Kế hoạch')
    // Cột rỗng không được chiếm một dòng trong bản tóm tắt.
    expect(thayDoi.map(t => t.cot)).not.toContain('ghi_chu')
  })

  it('lần sửa chỉ liệt kê đúng những cột đổi giá trị', () => {
    const cu = ban()
    const moi = ban({ ghi_chu: 'Đã bổ sung hóa đơn', so_hd: '00999999' })
    const thayDoi = soSanhThayDoi(cu, moi, boCanh)
    expect(thayDoi.map(t => t.cot)).toEqual(['so_hd', 'ghi_chu'])
    expect(thayDoi.find(t => t.cot === 'so_hd')).toEqual({ cot: 'so_hd', nhan: 'Số hóa đơn', cu: '00123456', moi: '00999999' })
  })

  it('đổi đơn vị tiếp khách hiện cả đơn vị lẫn nội dung đi kèm', () => {
    // Máy chủ sinh lại nội dung từ tên đơn vị, nên lịch sử phải cho thấy cả hai
    // cột cùng đổi chứ không chỉ đơn vị.
    const cu = ban()
    const moi = ban({ don_vi_id: DON_VI_KHAC, noi_dung: 'Tiếp Phòng Tổ chức' })
    const thayDoi = soSanhThayDoi(cu, moi, boCanh)
    expect(thayDoi.map(t => t.cot)).toEqual(['noi_dung', 'don_vi_id'])
    expect(thayDoi.find(t => t.cot === 'don_vi_id')!.cu).toBe('Phòng Kế hoạch')
    expect(thayDoi.find(t => t.cot === 'don_vi_id')!.moi).toBe('Phòng Tổ chức')
  })

  it('đổi ngày hiện cả ngày lẫn số thứ tự trong ngày', () => {
    const cu = ban()
    const moi = ban({ ngay: '2026-02-01', so_thu_tu: 4 })
    const thayDoi = soSanhThayDoi(cu, moi, boCanh)
    expect(thayDoi.map(t => t.cot)).toEqual(['ngay', 'so_thu_tu'])
    expect(thayDoi.find(t => t.cot === 'so_thu_tu')!.moi).toBe('4')
  })

  it('bỏ qua mốc thời gian và người ghi, vì chúng tự đổi mỗi lần lưu', () => {
    const cu = ban()
    const moi = ban({ sua_luc: '2026-03-01T10:00:00.000Z', nguoi_sua: NGUOI_LAY, trang_thai_kiem_tra: 'ok', ket_qua_kiem_tra: 'ok', __v: 2 })
    expect(soSanhThayDoi(cu, moi, boCanh)).toEqual([])
  })

  it('không có bản mới thì không có gì để so', () => {
    expect(soSanhThayDoi(ban(), null, boCanh)).toEqual([])
  })

  it('giá trị null và chuỗi rỗng được coi là khác nhau để không giấu mất thay đổi', () => {
    const cu = ban({ ghi_chu: null })
    const moi = ban({ ghi_chu: '' })
    // jsonb phân biệt null với chuỗi rỗng, và người dùng cũng vậy: xóa trắng ghi chú
    // là một thay đổi thật.
    expect(soSanhThayDoi(cu, moi, boCanh).map(t => t.cot)).toEqual(['ghi_chu'])
  })
})

describe('tóm tắt hành động', () => {
  it('phân biệt tạo, sửa, xóa mềm và khôi phục', () => {
    expect(tomTatHanhDong('INSERT', null, ban())).toBe('Tạo giao dịch')
    expect(tomTatHanhDong('DELETE', ban(), null)).toBe('Xóa vĩnh viễn')
    expect(tomTatHanhDong('UPDATE', ban(), ban({ ghi_chu: 'x' }))).toBe('Sửa giao dịch')
    expect(tomTatHanhDong('UPDATE', ban(), ban({ da_xoa: true }))).toBe('Xóa giao dịch')
    expect(tomTatHanhDong('UPDATE', ban({ da_xoa: true }), ban({ da_xoa: false }))).toBe('Khôi phục giao dịch')
  })

  it('xóa mềm đọc theo giá trị da_xoa chứ không theo tg_op của trigger', () => {
    // Xóa mềm là một UPDATE, nên nếu chỉ nhìn hanh_dong thì sẽ hiện nhầm "Sửa giao dịch".
    expect(tomTatHanhDong('UPDATE', ban(), ban({ da_xoa: true }))).not.toBe('Sửa giao dịch')
  })
})

describe('dựng một mục lịch sử từ dòng lich_su', () => {
  it('ghép người thực hiện, thời điểm và các thay đổi', () => {
    const muc = dungMucLichSu({
      id: '7', hanh_dong: 'UPDATE', tao_luc: '2026-03-01T10:00:00.000Z',
      ho_ten: 'Nguyễn Văn A', ten_dang_nhap: 'a.nguyen',
      gia_tri_cu: ban(), gia_tri_moi: ban({ ghi_chu: 'Đã bổ sung' }),
    }, boCanh)
    expect(muc).toMatchObject({ id: 7, hanhDong: 'UPDATE', tomTat: 'Sửa giao dịch', nguoi: 'Nguyễn Văn A' })
    expect(muc.thayDoi.map(t => t.cot)).toEqual(['ghi_chu'])
    expect(Number.isNaN(Date.parse(muc.luc))).toBe(false)
  })

  it('tài khoản chưa có họ tên thì lùi về tên đăng nhập', () => {
    expect(tenNguoiThucHien(null, 'a.nguyen')).toBe('a.nguyen')
    expect(tenNguoiThucHien('   ', 'a.nguyen')).toBe('a.nguyen')
    expect(tenNguoiThucHien(null, null)).toBe('Không xác định')
  })

  it('dòng cũ thiếu người thực hiện vẫn dựng được mục', () => {
    const muc = dungMucLichSu({
      id: 1, hanh_dong: 'INSERT', tao_luc: '2026-01-15T03:00:00.000Z',
      ho_ten: null, ten_dang_nhap: null, gia_tri_cu: null, gia_tri_moi: ban(),
    }, boCanh)
    expect(muc.nguoi).toBe('Không xác định')
    expect(muc.tomTat).toBe('Tạo giao dịch')
    expect(muc.thayDoi.length).toBeGreaterThan(0)
  })

  it('định dạng thời điểm chịu được giá trị không phải ngày', () => {
    expect(dinhDangLuc('khong-phai-ngay')).toBe('khong-phai-ngay')
    expect(dinhDangLuc('2026-03-01T10:00:00.000Z')).not.toBe('2026-03-01T10:00:00.000Z')
  })
})

describe('gom mã tham chiếu để tra tên một lượt', () => {
  it('gom đủ ba loại khóa ngoại từ cả bản cũ lẫn bản mới, không trùng lặp', () => {
    const ma = gomMaThamChieu([
      { gia_tri_cu: ban(), gia_tri_moi: ban({ don_vi_id: DON_VI_KHAC }) },
      { gia_tri_cu: null, gia_tri_moi: ban({ nguoi_lay_hd_id: null }) },
    ])
    expect(ma.donVi.sort()).toEqual([DON_VI, DON_VI_KHAC].sort())
    expect(ma.nguoiLayHd).toEqual([NGUOI_LAY])
    expect(ma.nguoiDung).toEqual([NGUOI_DUNG])
  })

  it('bỏ qua giá trị không phải uuid để không gửi rác vào câu truy vấn tra tên', () => {
    const ma = gomMaThamChieu([{ gia_tri_cu: null, gia_tri_moi: ban({ don_vi_id: 'khong-phai-uuid' }) }])
    expect(ma.donVi).toEqual([])
  })

  it('chịu được dòng không có jsonb', () => {
    const ma = gomMaThamChieu([{ gia_tri_cu: null, gia_tri_moi: null }, { gia_tri_cu: 'chuoi', gia_tri_moi: 5 }])
    expect(ma).toEqual({ donVi: [], nguoiLayHd: [], nguoiDung: [] })
  })

  it('bối cảnh rỗng dùng được ngay, không cần khởi tạo ở nơi gọi', () => {
    expect(boCanhRong()).toEqual({ donVi: {}, nguoiLayHd: {}, nguoiDung: {} })
    expect(hienThiGiaTri('don_vi_id', DON_VI)).toBe('11111111…')
  })
})
