import { describe, it, expect } from 'vitest'
import { schemaNguoiLayHd } from './nguoi-lay-hd'

describe('schemaNguoiLayHd validation', () => {
  it('accepts valid collector with all fields', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'Nguyễn Văn A',
      ty_le_phi: 0.15,
      ngan_hang_bin: '970415',
      so_tai_khoan: '1234567890',
      ten_chu_tk: 'NGUYEN VAN A',
      ghi_chu: 'Người lấy HĐ chính',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal valid collector (name only)', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'Nguyễn Văn B',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects fee rate below 0', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'Test',
      ty_le_phi: -0.1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects fee rate above 1', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'Test',
      ty_le_phi: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null optional fields', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: 'Test',
      ty_le_phi: null,
      ngan_hang_bin: null,
      so_tai_khoan: null,
      ten_chu_tk: null,
      ghi_chu: null,
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from string fields', () => {
    const result = schemaNguoiLayHd.safeParse({
      ten: '  Spaced Name  ',
      ngan_hang_bin: '  970415  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ten).toBe('Spaced Name')
      expect(result.data.ngan_hang_bin).toBe('970415')
    }
  })
})
