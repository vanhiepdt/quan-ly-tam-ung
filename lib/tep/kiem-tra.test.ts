import { describe, expect, it } from 'vitest'
import { loaiTepThat } from './kiem-tra'

describe('tự nhận diện loại tệp hóa đơn', () => {
  it('nhận PDF bằng magic bytes, không phụ thuộc phần mở rộng', async () => {
    await expect(loaiTepThat(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'hoa-don.xml', { type: 'text/xml' })))
      .resolves.toBe('application/pdf')
  })

  it('nhận XML bằng nội dung, kể cả BOM và mime khai báo khác', async () => {
    const xml = '\uFEFF<?xml version="1.0"?><HDon><SHDon>1</SHDon></HDon>'
    await expect(loaiTepThat(new File([xml], 'hoa-don.pdf', { type: 'application/pdf' })))
      .resolves.toBe('application/xml')
  })

  it('từ chối tệp không phải PDF/XML hoặc XML quá ngắn', async () => {
    await expect(loaiTepThat(new File(['not an invoice'], 'hoa-don.txt'))).resolves.toBeNull()
    await expect(loaiTepThat(new File(['<H'], 'hoa-don.xml'))).resolves.toBeNull()
  })
})
