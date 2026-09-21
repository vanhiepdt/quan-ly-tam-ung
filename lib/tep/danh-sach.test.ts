import { describe, expect, it, vi } from 'vitest'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/db/pool', () => ({ db: { query } }))

import { danhSachThuMucTep, tepDong, thuMucTep } from './danh-sach'

describe('danh sách hồ sơ tệp', () => {
  it('bỏ phần tử json không phải loại tệp đã biết', () => {
    expect(tepDong(null)).toEqual([])
    expect(tepDong([{ id: 't1', loai: 'malware', tenGoc: 'x' }])).toEqual([])
    expect(tepDong([{ id: 't1', loai: 'hoa_don', tenGoc: 'a.pdf', kichThuoc: 12, mime: 'application/pdf', taoLuc: '2026-01-01' }]))
      .toEqual([{ id: 't1', loai: 'hoa_don', tenGoc: 'a.pdf', kichThuoc: 12, mime: 'application/pdf', taoLuc: '2026-01-01' }])
  })

  it('một dòng mỗi giao dịch, kể cả khi chưa có tệp', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'g1', ngay: '2026-09-17', so_thu_tu: 2, noi_dung: 'Tiếp A', hinh_thuc: 'Hoàn tạm ứng',
        tep: [],
      }],
    })
    const ds = await danhSachThuMucTep()
    expect(ds).toEqual([{
      id: 'g1', ngay: '2026-09-17', soThuTu: 2, noiDung: 'Tiếp A', hinhThuc: 'Hoàn tạm ứng', tep: [],
    }])
    expect(String(query.mock.calls[0][0])).toContain('where not g.da_xoa')
  })

  it('chi tiết trả null khi không có giao dịch', async () => {
    query.mockResolvedValueOnce({ rows: [] })
    expect(await thuMucTep('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBeNull()
  })
})
