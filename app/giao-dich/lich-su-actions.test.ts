import { beforeEach, describe, expect, it, vi } from 'vitest'
const { query, phien } = vi.hoisted(() => ({ query: vi.fn(), phien: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))
vi.mock('../../lib/xac-thuc/phien', () => ({ layPhien: phien }))
import { layLichSuGiaoDich } from './lich-su-actions'

const id = '12345678-1234-4234-8234-123456789abc'
const donVi = '22222222-2222-4222-8222-222222222222'
const nguoiDung = '44444444-4444-4444-8444-444444444444'

const ban = (ghiDe: Record<string, unknown> = {}) => ({
  id, ngay: '2026-09-16', so_thu_tu: 1, tao_luc: '2026-09-16T03:00:00.000Z', sua_luc: '2026-09-16T03:00:00.000Z',
  nguoi_tao: nguoiDung, nguoi_sua: nguoiDung, noi_dung: 'Tiếp Phòng Kế hoạch', don_vi_id: donVi,
  ky_hieu_hd: null, so_hd: 'E2E01', loai_hd: null, trang_thai_hd: 'Hợp lệ', hinh_thuc: 'Hoàn tạm ứng',
  tong_tien: '200000', tien_ruou_bia: '0', tam_ung_tu_cq: '0', giao_tien_chi_thuy: '0', hoan_ung_tien_mat: '0',
  nguoi_lay_hd_id: null, phi_lay_hd_ghi_de: null, trang_thai_tt_phi: 'Không phát sinh', ghi_chu: null, da_xoa: false,
  ...ghiDe,
})
const dongLichSu = (ghiDe: Record<string, unknown> = {}) => ({
  id: '7', hanh_dong: 'UPDATE', tao_luc: '2026-09-17T02:00:00.000Z',
  ho_ten: 'Synthetic E2E Admin', ten_dang_nhap: 'e2e_admin',
  gia_tri_cu: ban(), gia_tri_moi: ban({ so_hd: 'E2E02' }), ...ghiDe,
})
// Chỉ trả lời đúng những câu truy vấn mà action thật sự phát ra.
const traLoi = (lichSu: unknown[], tenDonVi: Record<string, string> = { [donVi]: 'Phòng Kế hoạch' }) =>
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('from lich_su')) return { rows: lichSu }
    if (sql.includes('from don_vi')) return { rows: Object.entries(tenDonVi).map(([ma, ten]) => ({ id: ma, ten })) }
    return { rows: [] }
  })
const goiDonVi = () => query.mock.calls.filter((call: unknown[]) => String(call[0]).includes('from don_vi'))

beforeEach(() => {
  vi.clearAllMocks()
  phien.mockResolvedValue({ id, vai_tro: 'nhap_lieu' })
  traLoi([dongLichSu()])
})

describe('layLichSuGiaoDich', () => {
  it.each([null, undefined])('từ chối phiên không hợp lệ trước khi truy vấn', async session => {
    phien.mockResolvedValue(session)
    expect((await layLichSuGiaoDich(id)).loi).toContain('Phiên không hợp lệ')
    expect(query).not.toHaveBeenCalled()
  })

  it.each([null, undefined, {}, '', 123, 'khong-phai-uuid', "' or 1=1", [id]])(
    'từ chối mã không phải uuid %j trước khi chạm cột uuid của bảng lich_su', async value => {
      expect((await layLichSuGiaoDich(value)).loi).toContain('Mã giao dịch')
      expect(query).not.toHaveBeenCalled()
    })

  it('đọc đúng bản ghi, mới nhất trước, có giới hạn', async () => {
    const { muc } = await layLichSuGiaoDich(id)
    const [sql, params] = query.mock.calls[0]
    expect(String(sql)).toContain("ls.bang = 'giao_dich'")
    expect(String(sql)).toContain('ls.ban_ghi_id = $1')
    expect(String(sql)).toContain('order by ls.id desc')
    expect(params).toEqual([id, 100])
    expect(muc).toHaveLength(1)
    expect(muc[0]).toMatchObject({ id: 7, hanhDong: 'UPDATE', tomTat: 'Sửa giao dịch', nguoi: 'Synthetic E2E Admin' })
    expect(muc[0].thayDoi.map(t => t.cot)).toEqual(['so_hd'])
  })

  it('tra tên khóa ngoại một lượt thay vì hiện uuid trần', async () => {
    const { muc } = await layLichSuGiaoDich(id)
    expect(goiDonVi()).toHaveLength(1)
    expect(String(goiDonVi()[0][0])).toContain('where id = any($1::uuid[])')
    expect(goiDonVi()[0][1]).toEqual([[donVi]])
    // nguoi_tao/nguoi_sua bị bỏ qua khi so sánh nhưng vẫn phải tra được tên cho bối cảnh.
    expect(muc[0].thayDoi[0]).toEqual({ cot: 'so_hd', nhan: 'Số hóa đơn', cu: 'E2E01', moi: 'E2E02' })
  })

  it('không tra bảng nào khi lịch sử không tham chiếu mã nào', async () => {
    traLoi([dongLichSu({ gia_tri_cu: ban({ don_vi_id: null, nguoi_tao: null, nguoi_sua: null }), gia_tri_moi: ban({ don_vi_id: null, nguoi_tao: null, nguoi_sua: null }) })])
    const { muc } = await layLichSuGiaoDich(id)
    expect(query).toHaveBeenCalledTimes(1)
    expect(muc).toHaveLength(1)
  })

  it('giao dịch chưa có thay đổi nào thì trả về danh sách rỗng', async () => {
    traLoi([])
    expect(await layLichSuGiaoDich(id)).toEqual({ muc: [] })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('chi_doc vẫn xem được lịch sử vì đây là dữ liệu chỉ đọc', async () => {
    phien.mockResolvedValue({ id, vai_tro: 'chi_doc' })
    expect((await layLichSuGiaoDich(id)).muc).toHaveLength(1)
  })

  it('dòng cũ thiếu người thực hiện vẫn dựng được mục', async () => {
    traLoi([dongLichSu({ ho_ten: null, ten_dang_nhap: null })])
    expect((await layLichSuGiaoDich(id)).muc[0].nguoi).toBe('Không xác định')
  })

  it('không rò rỉ lỗi database ra thông báo', async () => {
    query.mockRejectedValue(new Error('password=secret'))
    const ketQua = await layLichSuGiaoDich(id)
    expect(ketQua.loi).toContain('Không tải được lịch sử sửa')
    expect(JSON.stringify(ketQua)).not.toContain('secret')
  })
})
