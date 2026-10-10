import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  query: vi.fn(), transaction: vi.fn(), guard: vi.fn(), revalidate: vi.fn(), clientQuery: vi.fn(),
}))
vi.mock('@/lib/db/pool', () => ({ db: { query: m.query }, trongTransaction: m.transaction }))
vi.mock('@/lib/xac-thuc/bao-ve', () => ({ batBuocVaiTro: m.guard }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }))

import { luuCauHinhSaoLuu, yeuCauSaoLuuNgay } from './backup-actions'

function form(time = '17:00', enabled = true) {
  const data = new FormData()
  if (enabled) data.set('bat_tu_dong', '1')
  data.set('gio_chay', time)
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  m.guard.mockResolvedValue({ id: 'admin-1', vai_tro: 'admin' })
  m.query.mockResolvedValue({ rows: [] })
  m.clientQuery.mockResolvedValue({ rows: [] })
  m.transaction.mockImplementation(async (_id: string, fn: (client: { query: typeof m.clientQuery }) => unknown) => fn({ query: m.clientQuery }))
})

describe('cài đặt sao lưu', () => {
  it('lưu giờ và trạng thái tự động', async () => {
    expect(await luuCauHinhSaoLuu({}, form('05:30', false))).toEqual({ thanhCong: 'Đã lưu lịch sao lưu.' })
    expect(m.query).toHaveBeenCalledWith(expect.stringContaining('insert into sao_luu_cau_hinh'), [false, '05:30'])
    expect(m.revalidate).toHaveBeenCalledWith('/cai-dat')
  })

  it('từ chối giờ sai trước khi ghi database', async () => {
    expect(await luuCauHinhSaoLuu({}, form('25:00'))).toEqual({ loi: 'Thời gian phải theo dạng HH:mm.' })
    expect(m.query).not.toHaveBeenCalled()
  })

  it('tạo yêu cầu backup thủ công khi chưa có job đang chạy', async () => {
    m.clientQuery.mockImplementation(async (sql: string) => sql.includes('trang_thai in') ? { rows: [] } : { rows: [] })
    expect(await yeuCauSaoLuuNgay({}, new FormData())).toEqual({ thanhCong: 'Đã gửi yêu cầu. VPS sẽ xử lý và cập nhật kết quả Google Drive.' })
    expect(m.transaction).toHaveBeenCalledWith('admin-1', expect.any(Function))
    expect(m.clientQuery).toHaveBeenCalledWith(expect.stringContaining("insert into sao_luu_lan_chay"), ['admin-1'])
  })

  it('không tạo thêm job khi đã có backup đang chờ', async () => {
    m.clientQuery.mockImplementation(async (sql: string) => sql.includes('trang_thai in') ? { rows: [{ trang_thai: 'dang_chay' }] } : { rows: [] })
    expect(await yeuCauSaoLuuNgay({}, new FormData())).toEqual({ thanhCong: 'Đã có một bản sao lưu đang chờ hoặc đang thực hiện.' })
    expect(m.clientQuery).not.toHaveBeenCalledWith(expect.stringContaining("insert into sao_luu_lan_chay"), expect.anything())
  })
})
