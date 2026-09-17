import { describe, expect, it } from 'vitest'
import { docSoTien, hopLeDocSo } from './doc-so'

describe('docSoTien', () => {
  it('đọc đúng các số lẻ và số nhỏ', () => {
    expect(docSoTien(0)).toBe('Không')
    expect(docSoTien(1)).toBe('Một')
    expect(docSoTien(10)).toBe('Mười')
    expect(docSoTien(11)).toBe('Mười một')
    expect(docSoTien(15)).toBe('Mười lăm')
    expect(docSoTien(21)).toBe('Hai mươi mốt')
    expect(docSoTien(24)).toBe('Hai mươi tư')
    expect(docSoTien(25)).toBe('Hai mươi lăm')
    expect(docSoTien(100)).toBe('Một trăm')
    expect(docSoTien(105)).toBe('Một trăm lẻ năm')
    expect(docSoTien(110)).toBe('Một trăm mười')
    expect(docSoTien(115)).toBe('Một trăm mười lăm')
    expect(docSoTien(121)).toBe('Một trăm hai mươi mốt')
    expect(docSoTien(999)).toBe('Chín trăm chín mươi chín')
  })

  it('đọc đúng các bậc nghìn, triệu, tỷ', () => {
    expect(docSoTien(1_000)).toBe('Một nghìn')
    expect(docSoTien(1_000_000)).toBe('Một triệu')
    expect(docSoTien(1_200_000)).toBe('Một triệu hai trăm nghìn')
    expect(docSoTien(1_500_000)).toBe('Một triệu năm trăm nghìn')
    expect(docSoTien(2_000_000)).toBe('Hai triệu')
    expect(docSoTien(5_647_000)).toBe('Năm triệu sáu trăm bốn mươi bảy nghìn')
    expect(docSoTien(1_000_000_000)).toBe('Một tỷ')
    expect(docSoTien(2_345_678_901)).toBe('Hai tỷ ba trăm bốn mươi lăm triệu sáu trăm bảy mươi tám nghìn chín trăm lẻ một')
  })

  it('giữ chữ "không trăm" và "lẻ" ở nhóm giữa để không nhập nhằng bậc', () => {
    expect(docSoTien(1_005)).toBe('Một nghìn không trăm lẻ năm')
    expect(docSoTien(1_000_005)).toBe('Một triệu không trăm lẻ năm')
    expect(docSoTien(1_050_000)).toBe('Một triệu không trăm năm mươi nghìn')
    expect(docSoTien(20_000_010)).toBe('Hai mươi triệu không trăm mười')
  })

  it('bỏ qua nhóm ba chữ số toàn số không', () => {
    expect(docSoTien(1_000_000_000_000)).toBe('Một nghìn tỷ')
    expect(docSoTien(3_000_000_000)).toBe('Ba tỷ')
  })

  it('viết hoa chữ đầu và không kèm đơn vị tiền', () => {
    const chu = docSoTien(1_500_000)
    expect(chu.charAt(0)).toBe('M')
    expect(chu).not.toContain('đồng')
  })

  it('từ chối số không nguyên, số âm và số vượt giới hạn an toàn', () => {
    expect(() => docSoTien(-1)).toThrow('không được âm')
    expect(() => docSoTien(1.5)).toThrow('số nguyên')
    expect(() => docSoTien(Number.MAX_SAFE_INTEGER + 1)).toThrow('số nguyên')
    expect(() => docSoTien(Number.NaN)).toThrow('số nguyên')
  })

  it('hopLeDocSo phản ánh đúng điều kiện của docSoTien', () => {
    expect(hopLeDocSo(0)).toBe(true)
    expect(hopLeDocSo(1_500_000)).toBe(true)
    expect(hopLeDocSo(-5)).toBe(false)
    expect(hopLeDocSo(1.5)).toBe(false)
    expect(hopLeDocSo('1000')).toBe(false)
    expect(hopLeDocSo(null)).toBe(false)
  })
})
