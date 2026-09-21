import { db } from '@/lib/db/pool'
import {
  laNhaCungCapId, timNhaCungCap, type NhaCungCapId,
} from './nha-cung-cap-ai'

export const KHOA_CAU_HINH_AI = 'ai_hoa_don'

export type CauHinhAi = {
  dangHoatDong: boolean
  nhaCungCap: NhaCungCapId
  moHinh: string
  khoaApi: string
  urlCoSo: string
}

export const CAU_HINH_AI_MAC_DINH: CauHinhAi = {
  dangHoatDong: true,
  nhaCungCap: 'anthropic',
  moHinh: 'claude-sonnet-5',
  khoaApi: '',
  urlCoSo: '',
}

const KHOA_MOI_TRUONG: Record<NhaCungCapId, readonly string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  groq: ['GROQ_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  xai: ['XAI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  together: ['TOGETHER_API_KEY'],
  fireworks: ['FIREWORKS_API_KEY'],
  custom: ['AI_API_KEY'],
}

function chuoi(giaTri: unknown): string {
  return typeof giaTri === 'string' ? giaTri.trim() : ''
}

export function khoaMoiTruongCua(nha: NhaCungCapId): string {
  for (const ten of KHOA_MOI_TRUONG[nha]) {
    const v = process.env[ten]?.trim()
    if (v) return v
  }
  return ''
}

export function docCauHinhAiTu(rows: readonly { khoa: string; gia_tri: unknown }[]): CauHinhAi {
  const hang = rows.find(r => r.khoa === KHOA_CAU_HINH_AI)
  const tho = hang?.gia_tri
  if (typeof tho !== 'object' || tho === null || Array.isArray(tho)) return { ...CAU_HINH_AI_MAC_DINH }
  const o = tho as Record<string, unknown>
  const nhaCungCap = laNhaCungCapId(chuoi(o.nhaCungCap)) ? o.nhaCungCap as NhaCungCapId : CAU_HINH_AI_MAC_DINH.nhaCungCap
  const nha = timNhaCungCap(nhaCungCap)!
  const moHinh = chuoi(o.moHinh) || nha.moHinhMacDinh
  return {
    dangHoatDong: typeof o.dangHoatDong === 'boolean' ? o.dangHoatDong : CAU_HINH_AI_MAC_DINH.dangHoatDong,
    nhaCungCap,
    moHinh,
    khoaApi: chuoi(o.khoaApi),
    urlCoSo: nhaCungCap === 'custom' ? chuoi(o.urlCoSo) : '',
  }
}

export function boSungKhoaTuMoiTruong(cauHinh: CauHinhAi): CauHinhAi {
  if (cauHinh.khoaApi) return cauHinh
  const khoa = khoaMoiTruongCua(cauHinh.nhaCungCap)
  return khoa ? { ...cauHinh, khoaApi: khoa } : cauHinh
}

export async function docCauHinhAiTuDb(): Promise<CauHinhAi> {
  const { rows } = await db.query<{ khoa: string; gia_tri: unknown }>(
    'select khoa, gia_tri from cau_hinh where khoa = $1', [KHOA_CAU_HINH_AI])
  return docCauHinhAiTu(rows)
}

export async function docCauHinhAi(): Promise<CauHinhAi> {
  return boSungKhoaTuMoiTruong(await docCauHinhAiTuDb())
}

export type DuLieuCauHinhAi = {
  dangHoatDong: boolean
  nhaCungCap: NhaCungCapId
  moHinh: string
  urlCoSo: string
  daCoKhoaLuu: boolean
  dungKhoaMoiTruong: boolean
}

// Form admin không bao giờ nhận khóa thô. Chỉ biết đã lưu hay đang dùng biến môi trường.
export function anKhoaChoGiaoDien(cauHinhDb: CauHinhAi): DuLieuCauHinhAi {
  const khoaEnv = khoaMoiTruongCua(cauHinhDb.nhaCungCap)
  return {
    dangHoatDong: cauHinhDb.dangHoatDong,
    nhaCungCap: cauHinhDb.nhaCungCap,
    moHinh: cauHinhDb.moHinh,
    urlCoSo: cauHinhDb.urlCoSo,
    daCoKhoaLuu: Boolean(cauHinhDb.khoaApi),
    dungKhoaMoiTruong: !cauHinhDb.khoaApi && Boolean(khoaEnv),
  }
}
