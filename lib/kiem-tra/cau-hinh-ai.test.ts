import { afterEach, describe, expect, it } from 'vitest'
import {
  anKhoaChoGiaoDien, boSungKhoaTuMoiTruong, CAU_HINH_AI_MAC_DINH, docCauHinhAiTu, KHOA_CAU_HINH_AI,
} from './cau-hinh-ai'

const hang = (gia_tri: unknown) => [{ khoa: KHOA_CAU_HINH_AI, gia_tri }]

describe('đọc cấu hình AI', () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  it('bảng rỗng thì Anthropic mặc định, không có khóa', () => {
    expect(docCauHinhAiTu([])).toEqual(CAU_HINH_AI_MAC_DINH)
    expect(docCauHinhAiTu([{ khoa: 'khac', gia_tri: {} }])).toEqual(CAU_HINH_AI_MAC_DINH)
  })

  it('đọc nhà cung cấp đã lưu và bỏ URL khi không phải API ngoài', () => {
    expect(docCauHinhAiTu(hang({
      dangHoatDong: false, nhaCungCap: 'openai', moHinh: 'gpt-4o',
      khoaApi: 'sk-live', urlCoSo: 'https://khong-dung.example',
    }))).toEqual({
      dangHoatDong: false, nhaCungCap: 'openai', moHinh: 'gpt-4o',
      khoaApi: 'sk-live', urlCoSo: '',
    })
  })

  it('giữ URL khi chọn API ngoài; nhà lạ thì về mặc định', () => {
    expect(docCauHinhAiTu(hang({
      nhaCungCap: 'custom', moHinh: 'llava', urlCoSo: ' http://127.0.0.1:11434/v1 ', khoaApi: 'x',
    })).urlCoSo).toBe('http://127.0.0.1:11434/v1')
    expect(docCauHinhAiTu(hang({ nhaCungCap: 'khong-co' })).nhaCungCap).toBe('anthropic')
  })

  it('form admin không nhận khóa thô', () => {
    const an = anKhoaChoGiaoDien({
      dangHoatDong: true, nhaCungCap: 'openai', moHinh: 'gpt-4o', khoaApi: 'sk-bi-mat', urlCoSo: '',
    })
    expect(an.daCoKhoaLuu).toBe(true)
    expect(an.dungKhoaMoiTruong).toBe(false)
    expect(JSON.stringify(an)).not.toContain('sk-bi-mat')
  })

  it('bổ sung khóa môi trường khi Cài đặt chưa lưu khóa, không ghi đè khóa đã lưu', () => {
    process.env.ANTHROPIC_API_KEY = 'env-claude'
    process.env.OPENAI_API_KEY = 'env-gpt'
    const trong = docCauHinhAiTu([])
    expect(boSungKhoaTuMoiTruong(trong).khoaApi).toBe('env-claude')
    expect(boSungKhoaTuMoiTruong({ ...trong, nhaCungCap: 'openai', moHinh: 'gpt-4o' }).khoaApi).toBe('env-gpt')
    expect(boSungKhoaTuMoiTruong({ ...trong, khoaApi: 'da-luu' }).khoaApi).toBe('da-luu')
  })
})
