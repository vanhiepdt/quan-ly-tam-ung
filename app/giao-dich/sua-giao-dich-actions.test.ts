import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class TaiLieuDangMo extends Error {}
  return {
    query: vi.fn(), phien: vi.fn(), transaction: vi.fn(), revalidate: vi.fn(),
    context: vi.fn(), find: vi.fn(), papers: vi.fn(), refresh: vi.fn(), template: vi.fn(), fill: vi.fn(), TaiLieuDangMo,
  }
})
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: mocks.transaction }))
vi.mock('../../lib/xac-thuc/phien', () => ({ layPhien: mocks.phien }))
vi.mock('@/lib/xac-thuc/bao-ve', () => import('../../lib/xac-thuc/bao-ve'))
vi.mock('@/lib/tai-chinh/cau-hinh-giay', () => ({ boiCanhGiay: mocks.context }))
vi.mock('@/lib/tai-chinh/in-giay', () => ({ timGiaoDichTinh: mocks.find, giayCuaGiaoDich: mocks.papers, MAU_WORD: { tiep_khach: 'tiep khach va thanh toan.docx', thanh_toan: 'tiep khach va thanh toan.docx' } }))
vi.mock('@/lib/onlyoffice/tai-lieu', () => ({ capNhatTaiLieuGiay: mocks.refresh, docMau: mocks.template, LoiTaiLieuDangMo: mocks.TaiLieuDangMo }))
vi.mock('@/lib/van-ban/docx', () => ({ dienMauDocx: mocks.fill }))
import { suaGiaoDich, suaThongTinGiayGiaoDich } from './actions'

const actor = '11111111-1111-4111-8111-111111111111'
const id = '12345678-1234-4234-8234-123456789abc'
const donVi = '22222222-2222-4222-8222-222222222222'
const nguoiLayHd = '33333333-3333-4333-8333-333333333333'
const nguoiDeNghi = '55555555-5555-4555-8555-555555555555'
const lanhDaoTk = '66666666-6666-4666-8666-666666666666'
const lanhDaoTt = '77777777-7777-4777-8777-777777777777'
const truongPhong = '88888888-8888-4888-8888-888888888888'
const keToan = '99999999-9999-4999-8999-999999999999'

const gui = (truong: string, giaTri: string, maGiaoDich = id) => {
  const f = new FormData()
  f.set('id', maGiaoDich)
  f.set('truong', truong)
  f.set('gia_tri', giaTri)
  return f
}
const guiThongTinGiay = () => {
  const f = new FormData()
  f.set('id', id)
  f.set('giay_nguoiDeNghiId', nguoiDeNghi)
  f.set('giay_lanhDaoTiepKhachId', lanhDaoTk)
  f.set('giay_lanhDaoThanhToanId', lanhDaoTt)
  f.set('giay_truongPhongId', truongPhong)
  f.set('giay_keToanKiemSoatId', keToan)
  return f
}
// Các câu lệnh ghi thật sự đổi dữ liệu, bỏ qua khóa sổ và đọc kiểm tra.
const capNhat = () => mocks.query.mock.calls.filter((call: unknown[]) => String(call[0]).startsWith('update giao_dich'))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'admin' })
  mocks.transaction.mockImplementation(async (_id: string, callback: (c: unknown) => unknown) => callback({ query: mocks.query }))
  mocks.context.mockResolvedValue({ canBo: [], cauHinh: {}, nguoiDeNghi: {}, taiKhoanTheoNguoiLayHd: {} })
  mocks.find.mockResolvedValue({ id })
  mocks.papers.mockReturnValue([{ loai: 'tiep_khach', thayThe: {}, thayCoDinh: [] }, { loai: 'thanh_toan', thayThe: {}, thayCoDinh: [] }])
  mocks.refresh.mockResolvedValue([])
  mocks.template.mockResolvedValue(Buffer.from('template'))
  mocks.fill.mockReturnValue({ duLieu: Buffer.from('document') })
  mocks.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
    if (sql.includes('from can_bo')) return { rows: Array.isArray(params?.[0]) ? params![0].map(id => ({ id })) : [] }
    if (sql.includes('from don_vi')) return { rows: [{ ten: 'Phòng Kế hoạch' }] }
    if (sql.includes('from nguoi_lay_hd')) return { rows: [{ '?column?': 1 }] }
    return { rows: [] }
  })
})

describe('suaGiaoDich', () => {
  it('sửa đúng một trường bằng câu lệnh update có tham số', async () => {
    expect((await suaGiaoDich({}, gui('so_hd', '00123456'))).thanhCong).toBeDefined()
    expect(capNhat()).toHaveLength(1)
    const [sql, params] = capNhat()[0]
    // Tên cột lấy từ danh sách trắng, giá trị luôn đi qua tham số $1.
    expect(sql).toBe('update giao_dich set so_hd=$1, sua_luc=now(), nguoi_sua=$2 where id=$3')
    expect(params).toEqual(['00123456', actor, id])
    expect(mocks.revalidate).toHaveBeenCalledWith('/giao-dich')
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard')
  })

  it('khóa sổ tài chính trước khi đọc dòng cần sửa', async () => {
    await suaGiaoDich({}, gui('so_hd', '00123456'))
    expect(mocks.query.mock.calls[0]).toEqual(['select pg_advisory_xact_lock($1, $2)', [20260916, 1]])
    expect(mocks.query.mock.calls[1][0]).toContain('for update')
  })

  it('đổi đơn vị thì ghi luôn nội dung sinh từ tên đơn vị', async () => {
    expect((await suaGiaoDich({}, gui('don_vi_id', donVi))).thanhCong).toContain('nội dung')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('set don_vi_id=$1, noi_dung=$2')
    expect(params).toEqual([donVi, 'Tiếp Phòng Kế hoạch', actor, id])
  })

  it('admin đổi được hình thức và phải chọn đơn vị khi chuyển sang giao dịch có hóa đơn', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        ngay: '2026-09-16', ngay_de_nghi: null, hinh_thuc: 'Tạm ứng thêm', noi_dung: 'Tạm ứng thêm', don_vi_id: null,
        ky_hieu_hd: null, so_hd: null, loai_hd: 'Phiếu chi CQ', trang_thai_hd: 'Không có',
        tong_tien: '0', tien_ruou_bia: '0', tam_ung_tu_cq: '1000', giao_tien_chi_thuy: '0', hoan_ung_tien_mat: '0',
        nguoi_lay_hd_id: null, phi_lay_hd_ghi_de: null, co_tinh_phi_lay_hd: false,
        trang_thai_tt_phi: 'Không phát sinh', hinh_thuc_thanh_toan: 'tien_mat',
      }] }
      if (sql.includes('from don_vi')) return { rows: [{ ten: 'Phòng Kế hoạch' }] }
      return { rows: [] }
    })
    const f = gui('hinh_thuc', 'Cơ quan trả thẳng'); f.set('don_vi_moi', donVi)
    expect((await suaGiaoDich({}, f)).thanhCong).toContain('đổi hình thức')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('hinh_thuc=$1')
    expect(sql).toContain('co_tinh_phi_lay_hd=$20')
    expect(params[0]).toBe('Cơ quan trả thẳng')
    expect(params[1]).toBe('Tiếp Phòng Kế hoạch')
    expect(params[2]).toBe(donVi)
    expect(params[6]).toBe('Hợp lệ')
    expect(params[19]).toBe(false)
    expect(params[20]).toBe('Không phát sinh')
  })

  it('sửa riêng khoản đưa tiền CQ trả thẳng mà không đụng tới tiền tạm ứng', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Đưa tiền CQ trả thẳng cho Chị Thúy' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('dua_tien_cq_tra_thang_cho_chi_thuy', '2500000'))).thanhCong).toContain('đưa tiền cq trả thẳng')
    const [sql, params] = capNhat()[0]
    expect(sql).toBe('update giao_dich set dua_tien_cq_tra_thang_cho_chi_thuy=$1, sua_luc=now(), nguoi_sua=$2 where id=$3')
    expect(params).toEqual([2_500_000, actor, id])
  })

  it('đổi hình thức sang khoản CQ trả thẳng thì xóa toàn bộ tiền nguồn cũ và dùng tiền mặt mặc định', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        ngay: '2026-09-16', ngay_de_nghi: null, hinh_thuc: 'Tạm ứng thêm', noi_dung: 'Tạm ứng thêm', don_vi_id: null,
        ky_hieu_hd: null, so_hd: null, loai_hd: 'Phiếu chi CQ', trang_thai_hd: 'Không có',
        tong_tien: '0', tien_ruou_bia: '0', tam_ung_tu_cq: '1000', giao_tien_chi_thuy: '0', dua_tien_cq_tra_thang_cho_chi_thuy: '0', hoan_ung_tien_mat: '0',
        nguoi_lay_hd_id: null, phi_lay_hd_ghi_de: null, co_tinh_phi_lay_hd: false,
        trang_thai_tt_phi: 'Không phát sinh', hinh_thuc_thanh_toan: 'tien_mat',
      }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('hinh_thuc', 'Đưa tiền CQ trả thẳng cho Chị Thúy'))).thanhCong).toContain('đổi hình thức')
    const [, params] = capNhat()[0]
    expect(params[0]).toBe('Đưa tiền CQ trả thẳng cho Chị Thúy')
    expect(params[1]).toBe('Đưa tiền CQ trả thẳng cho Chị Thúy')
    expect(params.slice(13, 17)).toEqual([0, 0, 0, 0])
    expect(params[21]).toBe('tien_mat')
  })

  it('tắt tính phí thì xóa phí ghi đè và đưa trạng thái về Không phát sinh', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        hinh_thuc: 'Cơ quan trả thẳng', co_tinh_phi_lay_hd: true, phi_lay_hd_ghi_de: '700000', trang_thai_tt_phi: 'Chưa thanh toán',
      }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('co_tinh_phi_lay_hd', '0'))).thanhCong).toContain('tắt tính phí')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('co_tinh_phi_lay_hd=$1')
    expect(params).toEqual([false, null, 'Không phát sinh', actor, id])
  })

  it('admin đổi cơ sở tính phí cho hóa đơn, từ chối giá trị lạ và không cho vai trò nhập liệu đổi', async () => {
    expect((await suaGiaoDich({}, gui('co_so_tinh_phi_lay_hd', 'tien_duoc_thanh_toan'))).thanhCong).toContain('cơ sở tính phí')
    expect(capNhat()[0]).toEqual([
      'update giao_dich set co_so_tinh_phi_lay_hd=$1, sua_luc=now(), nguoi_sua=$2 where id=$3',
      ['tien_duoc_thanh_toan', actor, id],
    ])
    vi.clearAllMocks()
    expect((await suaGiaoDich({}, gui('co_so_tinh_phi_lay_hd', 'khong_hop_le'))).loi).toBeDefined()
    expect(mocks.transaction).not.toHaveBeenCalled()
    mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'nhap_lieu' })
    expect((await suaGiaoDich({}, gui('co_so_tinh_phi_lay_hd', 'tong_tien'))).loi).toContain('quản trị viên')
  })

  it('đổi chuyển khoản sang tiền mặt thì làm tròn theo mặc định và xóa snapshot tài khoản riêng', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        hinh_thuc: 'Cơ quan trả thẳng', hinh_thuc_thanh_toan: 'chuyen_khoan',
        tong_tien: '1700999', tien_ruou_bia: '200000',
        tien_duoc_thanh_toan: '1500999', tien_duoc_thanh_toan_goc: '1500999',
        tai_khoan_nhan_so: '000123', tai_khoan_nhan_ngan_hang: 'Ngân hàng khác',
        tai_khoan_nhan_chi_nhanh: 'Chi nhánh B', tai_khoan_nhan_ten_chu_tk: 'Người nhận khác',
      }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('hinh_thuc_thanh_toan', 'tien_mat'))).thanhCong).toContain('hình thức thanh toán')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('tai_khoan_nhan_so=$5')
    expect(params).toEqual(['tien_mat', true, 1500000, 1500999, null, null, null, null, actor, id])
  })

  it('bỏ làm tròn thì khôi phục đúng số tiền nguồn trước đó', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        hinh_thuc: 'Cơ quan trả thẳng', tong_tien: '1700999', tien_ruou_bia: '200000',
        tien_duoc_thanh_toan: '1500000', tien_duoc_thanh_toan_goc: '1500999',
        lam_tron_xuong_hang_nghin: true,
      }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('lam_tron_xuong_hang_nghin', '0'))).thanhCong).toContain('tắt làm tròn')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('tien_duoc_thanh_toan_goc=$2')
    expect(params).toEqual([1500999, 1500999, false, actor, id])
  })

  it('sửa tiền được hoàn khi đang làm tròn thì lưu cả nguồn và số hiệu dụng', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        hinh_thuc: 'Cơ quan trả thẳng', tong_tien: '1700999', tien_ruou_bia: '200000',
        tien_duoc_thanh_toan: '1500000', tien_duoc_thanh_toan_goc: '1500000',
        lam_tron_xuong_hang_nghin: true,
      }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('tien_duoc_thanh_toan', '1500999'))).thanhCong).toContain('tiền được hoàn')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('tien_duoc_thanh_toan_goc=$2')
    expect(params).toEqual([1500000, 1500999, actor, id])
  })

  it('sửa tổng tiền làm mới cả hai giấy đề nghị đã lập', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        hinh_thuc: 'Hoàn tạm ứng', tong_tien: '2000000', tien_ruou_bia: '0',
        tien_duoc_thanh_toan: '2000000', tien_duoc_thanh_toan_goc: '2000000', lam_tron_xuong_hang_nghin: false,
      }] }
      if (sql.includes('from tai_lieu')) return { rows: [{ loai: 'tiep_khach' }, { loai: 'thanh_toan' }] }
      return { rows: [] }
    })

    expect((await suaGiaoDich({}, gui('tong_tien', '3500000'))).thanhCong).toContain('tổng tiền')
    expect(mocks.find).toHaveBeenCalledWith(id, expect.any(Object))
    expect(mocks.papers).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).toHaveBeenCalledWith(actor, id, expect.any(Array), expect.any(Object))
    expect(mocks.refresh.mock.calls[0][2].map((g: { loai: string }) => g.loai)).toEqual(['tiep_khach', 'thanh_toan'])
    expect(mocks.revalidate).toHaveBeenCalledWith(`/giay/${id}`)
  })

  it('đổi ngày thì xếp giao dịch vào cuối ngày mới', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('to_char(ngay')) return { rows: [{ ngay: '2026-09-16' }] }
      if (sql.includes('max(so_thu_tu)')) return { rows: [{ so_thu_tu: 3 }] }
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng', ngay: '2026-09-16', ngay_de_nghi: null }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('ngay', '2026-09-20'))).thanhCong).toContain('2026-09-20')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('set ngay=$1, so_thu_tu=$2')
    expect(params).toEqual(['2026-09-20', 3, '2026-09-18', actor, id])
    // Số thứ tự cũ không được dùng lại, nên câu đếm phải loại chính dòng đang sửa.
    const dem = mocks.query.mock.calls.find((call: unknown[]) => String(call[0]).includes('max(so_thu_tu)'))
    expect(String(dem![0])).toContain('id<>$2')
    expect(dem![1]).toEqual(['2026-09-20', id])
  })

  it('ngày không đổi thì không ghi gì, tránh làm loãng lịch sử', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('to_char(ngay')) return { rows: [{ ngay: '2026-09-20' }] }
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('ngay', '2026-09-20'))).thanhCong).toContain('không thay đổi')
    expect(capNhat()).toHaveLength(0)
  })

  it('từ chối ngày sai định dạng hoặc không có thật trước khi mở giao dịch', async () => {
    for (const giaTri of ['', '   ', '20/09/2026', '2026-2-9', '2026-02-30', '1899-01-01']) {
      expect((await suaGiaoDich({}, gui('ngay', giaTri))).loi).toBeDefined()
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('nhap_lieu sửa được ngày phát sinh', async () => {
    mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'nhap_lieu' })
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('to_char(ngay')) return { rows: [{ ngay: '2026-09-16' }] }
      if (sql.includes('max(so_thu_tu)')) return { rows: [{ so_thu_tu: 1 }] }
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('ngay', '2026-09-20'))).thanhCong).toBeDefined()
    expect(capNhat()).toHaveLength(1)
  })

  it('từ chối mã giao dịch và mã trường không hợp lệ trước khi mở giao dịch', async () => {
    for (const maGiaoDich of ['', 'khong-phai-uuid', "' or 1=1"]) {
      expect((await suaGiaoDich({}, gui('so_hd', 'x', maGiaoDich))).loi).toContain('Mã giao dịch')
    }
    for (const truong of ['', 'khong_ton_tai', 'id', 'nguoi_tao', "so_hd=null, trang_thai_hd='Hợp lệ'", 'trang_thai_hd; drop table giao_dich']) {
      expect((await suaGiaoDich({}, gui(truong, 'x'))).loi).toContain('không hợp lệ')
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(capNhat()).toHaveLength(0)
  })

  it('chặn nhap_lieu sửa trường tiền dù có gọi thẳng server action', async () => {
    mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'nhap_lieu' })
    for (const truong of ['tong_tien', 'tien_ruou_bia', 'phi_lay_hd_ghi_de', 'co_tinh_phi_lay_hd', 'trang_thai_tt_phi', 'tam_ung_tu_cq', 'dua_tien_cq_tra_thang_cho_chi_thuy', 'nguoi_lay_hd_id', 'hinh_thuc']) {
      expect((await suaGiaoDich({}, gui(truong, '1000'))).loi).toContain('quản trị viên')
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
    // Trường chứng từ thì vẫn sửa được.
    expect((await suaGiaoDich({}, gui('so_hd', '00123456'))).thanhCong).toBeDefined()
  })

  it('chặn cả admin khi sửa trường không thuộc hình thức của giao dịch', async () => {
    // Giao dịch là "Hoàn tạm ứng" nên không có khoản tạm ứng từ cơ quan.
    expect((await suaGiaoDich({}, gui('tam_ung_tu_cq', '1000'))).loi).toContain('không có trường')
    expect(capNhat()).toHaveLength(0)
  })

  it('không cho chi_doc gọi thẳng server action', async () => {
    mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'chi_doc' })
    await expect(suaGiaoDich({}, gui('so_hd', '00123456'))).rejects.toThrow('quyền')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('không cho người dùng chưa đăng nhập gọi thẳng server action', async () => {
    mocks.phien.mockResolvedValue(null)
    await expect(suaGiaoDich({}, gui('so_hd', '00123456'))).rejects.toThrow('quyền')
    expect(capNhat()).toHaveLength(0)
  })

  it('từ chối giá trị không hợp lệ trước khi mở giao dịch', async () => {
    for (const [truong, giaTri] of [['so_hd', 'A'.repeat(51)], ['trang_thai_hd', 'Sai'], ['tong_tien', '-5'], ['don_vi_id', 'khong-phai-uuid']]) {
      expect((await suaGiaoDich({}, gui(truong, giaTri))).loi).toBeDefined()
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('báo lỗi khi giao dịch không tồn tại hoặc đã bị xóa', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('so_hd', '00123456'))).loi).toContain('Không tìm thấy')
    expect(capNhat()).toHaveLength(0)
  })

  it('không lưu đơn vị đã bị vô hiệu hóa', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('don_vi_id', donVi))).loi).toContain('Đơn vị')
    expect(capNhat()).toHaveLength(0)
  })

  it('không lưu người lấy hóa đơn không tồn tại', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('nguoi_lay_hd_id', nguoiLayHd))).loi).toContain('Người lấy hóa đơn')
    expect(capNhat()).toHaveLength(0)
  })

  it('không rò rỉ lỗi database ra thông báo', async () => {
    mocks.query.mockRejectedValue(new Error('password=secret'))
    expect(JSON.stringify(await suaGiaoDich({}, gui('so_hd', '00123456')))).not.toContain('secret')
  })
})

describe('suaThongTinGiayGiaoDich', () => {
  it('lưu đủ năm người ký và làm mới cả giấy tiếp khách lẫn thanh toán', async () => {
    expect((await suaThongTinGiayGiaoDich({}, guiThongTinGiay())).thanhCong).toContain('làm mới')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('lanh_dao_tiep_khach_id=$2')
    expect(sql).toContain('thong_tin_giay_da_chot=true')
    expect(params).toEqual([nguoiDeNghi, lanhDaoTk, lanhDaoTt, truongPhong, keToan, actor, id])
    expect(mocks.find).toHaveBeenCalledWith(id, expect.any(Object))
    expect(mocks.papers).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).toHaveBeenCalledWith(actor, id, expect.any(Array), expect.any(Object))
    expect(mocks.refresh.mock.calls[0][2].map((g: { loai: string }) => g.loai)).toEqual(['tiep_khach', 'thanh_toan'])
    expect(mocks.revalidate).toHaveBeenCalledWith('/giao-dich')
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard')
    expect(mocks.revalidate).toHaveBeenCalledWith(`/giay/${id}`)
  })

  it('từ chối người ký không còn hoạt động trước khi cập nhật hoặc dựng Word', async () => {
    mocks.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      if (sql.includes('from can_bo')) return { rows: Array.isArray(params?.[0]) ? params![0].slice(0, -1).map(id => ({ id })) : [] }
      return { rows: [] }
    })
    expect((await suaThongTinGiayGiaoDich({}, guiThongTinGiay())).loi).toContain('ngừng hoạt động')
    expect(capNhat()).toHaveLength(0)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })

  it('từ chối giao dịch không có giấy đề nghị', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes('from giao_dich')
      ? { rows: [{ hinh_thuc: 'Giao tiền chị Thúy' }] }
      : { rows: [] })
    expect((await suaThongTinGiayGiaoDich({}, guiThongTinGiay())).loi).toContain('không lập giấy')
    expect(capNhat()).toHaveLength(0)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('không công bố thay đổi khi tài liệu đang mở trong OnlyOffice', async () => {
    mocks.refresh.mockRejectedValue(new mocks.TaiLieuDangMo())
    expect((await suaThongTinGiayGiaoDich({}, guiThongTinGiay())).loi).toContain('đang mở trong OnlyOffice')
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })

  it('từ chối người đề nghị rỗng trước khi mở transaction', async () => {
    const form = guiThongTinGiay()
    form.set('giay_nguoiDeNghiId', '')
    expect((await suaThongTinGiayGiaoDich({}, form)).loi).toContain('Thông tin người ký')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})


describe('sửa Chi thực tế', () => {
  it.each(['Hoàn tạm ứng', 'Cơ quan trả thẳng'])('bật cờ trên %s thì tắt phí và giữ các khoản tiền', async hinh_thuc => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('from giao_dich') ? [{
      hinh_thuc, chi_thuc_te: false, co_tinh_phi_lay_hd: true, phi_lay_hd_ghi_de: '700000', trang_thai_tt_phi: 'Đã thanh toán',
    }] : [] }))
    expect((await suaGiaoDich({}, gui('chi_thuc_te', '1'))).thanhCong).toContain('bật Chi thực tế')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('chi_thuc_te=$1')
    expect(sql).not.toContain('tong_tien=')
    expect(sql).not.toContain('tien_duoc_thanh_toan=')
    expect(params).toEqual([true, false, null, 'Không phát sinh', actor, id])
  })

  it('bỏ tích giữ lựa chọn phí đã được người dùng bật lại', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('from giao_dich') ? [{
      hinh_thuc: 'Hoàn tạm ứng', chi_thuc_te: true, co_tinh_phi_lay_hd: true, phi_lay_hd_ghi_de: '5000', trang_thai_tt_phi: 'Chưa thanh toán',
    }] : [] }))
    expect((await suaGiaoDich({}, gui('chi_thuc_te', '0'))).thanhCong).toContain('tắt Chi thực tế')
    expect(capNhat()[0][1]).toEqual([false, true, '5000', 'Chưa thanh toán', actor, id])
  })

  it('lưu lại cùng lựa chọn không làm mất phí đã bật lại', async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('from giao_dich') ? [{
      hinh_thuc: 'Hoàn tạm ứng', chi_thuc_te: true, co_tinh_phi_lay_hd: true,
    }] : [] }))
    expect((await suaGiaoDich({}, gui('chi_thuc_te', '1'))).thanhCong).toContain('không thay đổi')
    expect(capNhat()).toHaveLength(0)
  })

  it.each(['Tạm ứng thêm', 'Giao tiền chị Thúy', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 'Nộp hoàn CQ'])('không cho bật trên hình thức %s', async hinh_thuc => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('from giao_dich') ? [{ hinh_thuc }] : [] }))
    expect((await suaGiaoDich({}, gui('chi_thuc_te', '1'))).loi).toContain('không có trường')
    expect(capNhat()).toHaveLength(0)
  })

  it('giữ giới hạn sửa số dư cho quản trị viên', async () => {
    mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'nhap_lieu' })
    expect((await suaGiaoDich({}, gui('chi_thuc_te', '1'))).loi).toContain('Chỉ quản trị viên')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each([['Cơ quan trả thẳng', true], ['Tạm ứng thêm', false]] as const)('chuyển hình thức sang %s chuẩn hóa cờ thành %s', async (hinhThucMoi, expected) => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('from giao_dich')) return { rows: [{
        ngay: '2026-09-30', hinh_thuc: 'Hoàn tạm ứng', chi_thuc_te: true, co_so_tinh_phi_lay_hd: 'tien_duoc_thanh_toan', don_vi_id: donVi,
        tong_tien: '1000000', tien_ruou_bia: '100000', tien_duoc_thanh_toan_goc: '876543',
        co_tinh_phi_lay_hd: false, trang_thai_tt_phi: 'Không phát sinh', hinh_thuc_thanh_toan: 'hoan_tam_ung',
      }] }
      if (sql.includes('from don_vi')) return { rows: [{ ten: 'Phòng Kế hoạch' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('hinh_thuc', hinhThucMoi))).thanhCong).toContain('đổi hình thức')
    expect(capNhat()[0][0]).toContain('chi_thuc_te=$29')
    expect(capNhat()[0][1][28]).toBe(expected)
    expect(capNhat()[0][1][29]).toBe(expected ? 'tien_duoc_thanh_toan' : 'tong_tien')
  })
})
