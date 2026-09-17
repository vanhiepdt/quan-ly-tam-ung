import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), phien: vi.fn(), transaction: vi.fn(), revalidate: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: mocks.transaction }))
vi.mock('../../lib/xac-thuc/phien', () => ({ layPhien: mocks.phien }))
vi.mock('@/lib/xac-thuc/bao-ve', () => import('../../lib/xac-thuc/bao-ve'))
import { suaGiaoDich } from './actions'

const actor = '11111111-1111-4111-8111-111111111111'
const id = '12345678-1234-4234-8234-123456789abc'
const donVi = '22222222-2222-4222-8222-222222222222'
const nguoiLayHd = '33333333-3333-4333-8333-333333333333'

const gui = (truong: string, giaTri: string, maGiaoDich = id) => {
  const f = new FormData()
  f.set('id', maGiaoDich)
  f.set('truong', truong)
  f.set('gia_tri', giaTri)
  return f
}
// Các câu lệnh ghi thật sự đổi dữ liệu, bỏ qua khóa sổ và đọc kiểm tra.
const capNhat = () => mocks.query.mock.calls.filter((call: unknown[]) => String(call[0]).startsWith('update giao_dich'))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.phien.mockResolvedValue({ id: actor, vai_tro: 'admin' })
  mocks.transaction.mockImplementation(async (_id: string, callback: (c: unknown) => unknown) => callback({ query: mocks.query }))
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
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

  it('đổi ngày thì xếp giao dịch vào cuối ngày mới', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('to_char(ngay')) return { rows: [{ ngay: '2026-09-16' }] }
      if (sql.includes('max(so_thu_tu)')) return { rows: [{ so_thu_tu: 3 }] }
      if (sql.includes('from giao_dich')) return { rows: [{ hinh_thuc: 'Hoàn tạm ứng' }] }
      return { rows: [] }
    })
    expect((await suaGiaoDich({}, gui('ngay', '2026-09-20'))).thanhCong).toContain('2026-09-20')
    const [sql, params] = capNhat()[0]
    expect(sql).toContain('set ngay=$1, so_thu_tu=$2')
    expect(params).toEqual(['2026-09-20', 3, actor, id])
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
    for (const truong of ['tong_tien', 'tien_ruou_bia', 'phi_lay_hd_ghi_de', 'trang_thai_tt_phi', 'tam_ung_tu_cq', 'nguoi_lay_hd_id']) {
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
