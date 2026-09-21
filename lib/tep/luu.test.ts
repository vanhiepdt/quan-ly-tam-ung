import { afterEach, describe, expect, it, vi } from 'vitest'

const { mkdir, writeFile, unlink } = vi.hoisted(() => ({
  mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({ mkdir, writeFile, unlink }))

import { kiemTraVaLuuTep } from './luu'

function tep(bytes: number[], name = 'hoa-don.pdf', type = 'application/pdf') {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('lưu tệp đính kèm', () => {
  afterEach(() => { mkdir.mockReset(); writeFile.mockReset(); unlink.mockReset() })

  it('từ chối loại lạ, tệp rỗng và không phải PDF với giấy đã ký', async () => {
    expect((await kiemTraVaLuuTep(tep([0x25, 0x50, 0x44, 0x46]), 'malware', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).ok).toBe(false)
    expect((await kiemTraVaLuuTep(tep([]), 'hoa_don', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).ok).toBe(false)
    expect((await kiemTraVaLuuTep(tep([0x25, 0x50, 0x44, 0x46]), 'hoa_don', '../etc')).ok).toBe(false)
    const anh = tep([0xff, 0xd8, 0xff, 0xe0], 'a.jpg', 'image/jpeg')
    const kq = await kiemTraVaLuuTep(anh, 'to_trinh_da_ky', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loi).toMatch(/PDF/)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('ghi hóa đơn PDF vào thư mục theo giao dịch', async () => {
    mkdir.mockResolvedValue(undefined)
    writeFile.mockResolvedValue(undefined)
    const kq = await kiemTraVaLuuTep(tep([0x25, 0x50, 0x44, 0x46, 0x2d], 'a.pdf'), 'hoa_don', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(kq.ok).toBe(true)
    if (!kq.ok) return
    expect(kq.loai).toBe('hoa_don')
    expect(kq.mime).toBe('application/pdf')
    expect(kq.tuongDoi.replaceAll('\\', '/')).toMatch(/^aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\/.+\.pdf$/)
    expect(writeFile).toHaveBeenCalled()
  })
})
