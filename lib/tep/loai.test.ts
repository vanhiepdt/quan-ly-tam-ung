import { describe, expect, it } from 'vitest'
import { laLoaiTep, LOAI_TEP, LOAI_TEP_CHI_PDF, NHAN_LOAI_TEP } from './loai'

describe('loại tệp đính kèm', () => {
  it('nhận đúng bốn loại và từ chối loại lạ', () => {
    expect(LOAI_TEP).toEqual(['hoa_don', 'chuyen_khoan', 'to_trinh_da_ky', 'giay_de_nghi_da_ky'])
    expect(laLoaiTep('hoa_don')).toBe(true)
    expect(laLoaiTep('to_trinh_da_ky')).toBe(true)
    expect(laLoaiTep('giay_de_nghi_da_ky')).toBe(true)
    expect(laLoaiTep('malware')).toBe(false)
    expect(NHAN_LOAI_TEP.giay_de_nghi_da_ky).toMatch(/đã ký/)
    expect(LOAI_TEP_CHI_PDF.has('to_trinh_da_ky')).toBe(true)
    expect(LOAI_TEP_CHI_PDF.has('hoa_don')).toBe(false)
  })
})
