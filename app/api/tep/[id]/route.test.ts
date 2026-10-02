import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  query: vi.fn(),
  layPhien: vi.fn(),
  stat: vi.fn(),
  createReadStream: vi.fn(),
}))

vi.mock('@/lib/db/pool', () => ({ db: { query: m.query } }))
vi.mock('@/lib/xac-thuc/phien', () => ({ layPhien: m.layPhien }))
vi.mock('node:fs/promises', () => ({ stat: m.stat }))
vi.mock('node:fs', () => ({ createReadStream: m.createReadStream }))

import { GET } from './route'

const id = 'b15c6343-9e26-43c2-83d6-a9e622e56f56'
const tep = {
  duong_dan: '619b67fe-3aa3-4bca-b48d-493cfd5cf022/9b920a45-74e0-4a86-852f-d3723598dac6.pdf',
  mime: 'application/pdf',
  ten_goc: 'hoá đơn 2.pdf',
}

function goi() {
  return GET(new Request(`http://localhost/api/tep/${id}`), { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.resetAllMocks()
  m.layPhien.mockResolvedValue({ id: 'u1' })
  m.query.mockResolvedValue({ rows: [tep] })
  m.stat.mockResolvedValue({ size: 662066, isFile: () => true })
  m.createReadStream.mockReturnValue(Readable.from([Buffer.from('pdf')]))
})

describe('route tải tệp đính kèm', () => {
  it('tải được tên file tiếng Việt và gửi filename UTF-8 theo RFC 5987', async () => {
    const res = await goi()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe('662066')
    expect(res.headers.get('content-disposition')).toBe(
      "inline; filename=\"hoa don 2.pdf\"; filename*=UTF-8''ho%C3%A1%20%C4%91%C6%A1n%202.pdf",
    )
    expect(await res.text()).toBe('pdf')
  })

  it('chỉ báo không tồn tại khi stat thật sự trả ENOENT/ENOTDIR', async () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' })
    m.stat.mockRejectedValue(error)

    const res = await goi()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ loi: 'Tệp vật lý không tồn tại' })
  })

  it('không giả báo mất file khi hệ thống trả lỗi quyền đọc', async () => {
    const error = Object.assign(new Error('denied'), { code: 'EACCES' })
    m.stat.mockRejectedValue(error)

    const res = await goi()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ loi: 'Không thể đọc tệp vật lý' })
  })
})
