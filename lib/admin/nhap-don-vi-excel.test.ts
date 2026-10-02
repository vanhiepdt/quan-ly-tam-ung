import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { GIOI_HAN_DONG_DON_VI, GIOI_HAN_TEP_DON_VI, phanTichDonViExcel } from './nhap-don-vi-excel'

function taoTep(dong: unknown[][], name = 'don-vi.xlsx', size?: number) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(dong), 'Danh sách')
  const bookType = name.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx'
  const bytes = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType }))
  const copy = Uint8Array.from(bytes)
  return {
    name,
    size: size ?? copy.byteLength,
    arrayBuffer: async () => copy.buffer,
  }
}

describe('phanTichDonViExcel', () => {
  it('đọc tên, ghi chú, trim khoảng trắng và bỏ qua dòng trống', async () => {
    const file = taoTep([
      ['Tên đơn vị', 'Ghi chú'],
      ['  Phòng   Kế hoạch  ', '  Ghi chú A '],
      ['', ''],
      ['Trung tâm Đào tạo', ''],
    ])
    await expect(phanTichDonViExcel(file)).resolves.toEqual([
      { ten: 'Phòng Kế hoạch', ghi_chu: 'Ghi chú A', khoaTen: 'phòng kế hoạch' },
      { ten: 'Trung tâm Đào tạo', ghi_chu: null, khoaTen: 'trung tâm đào tạo' },
    ])
  })

  it('hỗ trợ header ten_don_vi và ghi_chu', async () => {
    const file = taoTep([['ten_don_vi', 'ghi_chu'], ['Đơn vị A', 'Nội bộ']], 'don-vi.xls')
    await expect(phanTichDonViExcel(file)).resolves.toMatchObject([{ ten: 'Đơn vị A', ghi_chu: 'Nội bộ' }])
  })

  it.each([
    ['sai đuôi file', taoTep([['Tên đơn vị'], ['A']], 'don-vi.csv'), 'Chỉ nhận tệp Excel'],
    ['thiếu header tên', taoTep([['Ghi chú'], ['A']], 'don-vi.xlsx'), 'phải có cột'],
    ['tên trống', taoTep([['Tên đơn vị'], ['   ']], 'don-vi.xlsx'), 'không có dòng đơn vị hợp lệ'],
    ['trùng tên', taoTep([['Tên đơn vị'], ['Đơn vị A'], ['  đơn vị   a ']], 'don-vi.xlsx'), 'Dòng 3'],
  ])('từ chối %s với lỗi an toàn', async (_, file, message) => {
    await expect(phanTichDonViExcel(file)).rejects.toThrow(message)
  })

  it('báo rõ dòng có tên quá dài', async () => {
    const file = taoTep([['Tên đơn vị'], ['A'.repeat(201)]])
    await expect(phanTichDonViExcel(file)).rejects.toThrow('Dòng 2')
  })

  it('từ chối file quá lớn và quá nhiều dòng trước khi đọc nội dung', async () => {
    const valid = taoTep([['Tên đơn vị'], ['A']], 'don-vi.xlsx', GIOI_HAN_TEP_DON_VI + 1)
    await expect(phanTichDonViExcel(valid)).rejects.toThrow('không quá 5 MB')

    const manyRows = [['Tên đơn vị'], ...Array.from({ length: GIOI_HAN_DONG_DON_VI + 1 }, (_, i) => [`Đơn vị ${i}`])]
    await expect(phanTichDonViExcel(taoTep(manyRows))).rejects.toThrow('5.000 dòng')
  })
})
