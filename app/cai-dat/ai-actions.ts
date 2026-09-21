'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import {
  anKhoaChoGiaoDien, boSungKhoaTuMoiTruong, docCauHinhAiTuDb, KHOA_CAU_HINH_AI,
  type CauHinhAi, type DuLieuCauHinhAi,
} from '@/lib/kiem-tra/cau-hinh-ai'
import { kiemThuApi, layDanhSachMoHinh, pingHello } from '@/lib/kiem-tra/kiem-api-ai'
import { ID_NHA_CUNG_CAP, timNhaCungCap, urlAnToan } from '@/lib/kiem-tra/nha-cung-cap-ai'

export type KetQuaAiCaiDat = { loi?: string; thanhCong?: string }
export type KetQuaKiemAi = { loi?: string; thanhCong?: string; moHinh?: string[]; nhatKy?: string[] }

const schema = z.object({
  dangHoatDong: z.boolean(),
  nhaCungCap: z.enum(ID_NHA_CUNG_CAP),
  moHinh: z.string().trim().max(200),
  urlCoSo: z.string().trim().max(300),
  khoaApi: z.string().max(500),
  xoaKhoa: z.boolean(),
})

function urlCustom(url: string): string {
  return url.replace(/\/+$/, '')
}

export async function luuCauHinhAi(_: KetQuaAiCaiDat, formData: FormData): Promise<KetQuaAiCaiDat> {
  await batBuocVaiTro('admin')
  try {
    const parsed = schema.safeParse({
      dangHoatDong: formData.get('dang_hoat_dong') === '1',
      nhaCungCap: formData.get('nha_cung_cap'),
      moHinh: formData.get('mo_hinh') ?? '',
      urlCoSo: formData.get('url_co_so') ?? '',
      khoaApi: typeof formData.get('khoa_api') === 'string' ? String(formData.get('khoa_api')).trim() : '',
      xoaKhoa: formData.get('xoa_khoa') === '1',
    })
    if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
    const d = parsed.data
    const nha = timNhaCungCap(d.nhaCungCap)
    if (!nha) return { loi: 'Nhà cung cấp không hợp lệ.' }
    const moHinh = d.moHinh || nha.moHinhMacDinh
    if (!moHinh) return { loi: 'Hãy điền tên model.' }
    const urlCoSo = d.nhaCungCap === 'custom' ? urlCustom(d.urlCoSo) : ''
    if (d.nhaCungCap === 'custom') {
      if (!urlCoSo) return { loi: 'Hãy điền URL API ngoài.' }
      if (!urlAnToan(urlCoSo)) return { loi: 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.' }
    }

    const hienTai = await docCauHinhAiTuDb()
    let khoaApi = hienTai.khoaApi
    if (d.xoaKhoa) khoaApi = ''
    else if (d.khoaApi) khoaApi = d.khoaApi
    else if (d.nhaCungCap !== hienTai.nhaCungCap) khoaApi = ''

    await db.query(
      `insert into cau_hinh (khoa, gia_tri, mo_ta)
       values ($1, $2::jsonb, $3)
       on conflict (khoa) do update set gia_tri=excluded.gia_tri, sua_luc=now()`,
      [KHOA_CAU_HINH_AI, JSON.stringify({
        dangHoatDong: d.dangHoatDong,
        nhaCungCap: d.nhaCungCap,
        moHinh,
        khoaApi,
        urlCoSo,
      }), 'Cấu hình lớp AI đọc hóa đơn'],
    )
    revalidatePath('/cai-dat')
    return { thanhCong: `Đã lưu cài đặt AI. Model: ${moHinh}.` }
  } catch (error) {
    if (error instanceof z.ZodError) return { loi: error.issues[0].message }
    return { loi: 'Không lưu được cài đặt AI. Vui lòng thử lại.' }
  }
}

export async function docDuLieuCauHinhAi(): Promise<DuLieuCauHinhAi> {
  await batBuocVaiTro('admin')
  return anKhoaChoGiaoDien(await docCauHinhAiTuDb())
}

function cauHinhNhap(formData: FormData): { cauHinh?: CauHinhAi; loi?: string } {
  const parsed = schema.safeParse({
    dangHoatDong: true,
    nhaCungCap: formData.get('nha_cung_cap'),
    moHinh: formData.get('mo_hinh') ?? '',
    urlCoSo: formData.get('url_co_so') ?? '',
    khoaApi: typeof formData.get('khoa_api') === 'string' ? String(formData.get('khoa_api')).trim() : '',
    xoaKhoa: formData.get('xoa_khoa') === '1',
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
  const d = parsed.data
  const nha = timNhaCungCap(d.nhaCungCap)
  if (!nha) return { loi: 'Nhà cung cấp không hợp lệ.' }
  const urlCoSo = d.nhaCungCap === 'custom' ? urlCustom(d.urlCoSo) : ''
  if (d.nhaCungCap === 'custom') {
    if (!urlCoSo) return { loi: 'Hãy điền URL API ngoài.' }
    if (!urlAnToan(urlCoSo)) return { loi: 'URL API ngoài phải là http hoặc https, không chứa tài khoản trong địa chỉ.' }
  }
  return {
    cauHinh: {
      dangHoatDong: true,
      nhaCungCap: d.nhaCungCap,
      moHinh: d.moHinh || nha.moHinhMacDinh,
      khoaApi: d.khoaApi,
      urlCoSo,
    },
  }
}

async function khoaDeThu(nhap: CauHinhAi): Promise<CauHinhAi> {
  if (nhap.khoaApi) return nhap
  const daLuu = await docCauHinhAiTuDb()
  const khoaLuu = daLuu.nhaCungCap === nhap.nhaCungCap ? daLuu.khoaApi : ''
  return boSungKhoaTuMoiTruong({ ...nhap, khoaApi: khoaLuu })
}

export async function thuNghiemAi(formData: FormData): Promise<KetQuaKiemAi> {
  await batBuocVaiTro('admin')
  const nhap = cauHinhNhap(formData)
  if (nhap.loi || !nhap.cauHinh) return { loi: nhap.loi }
  const kq = await kiemThuApi(await khoaDeThu(nhap.cauHinh))
  if ('loi' in kq) return { loi: kq.loi, moHinh: kq.moHinh, nhatKy: kq.nhatKy }
  return { thanhCong: kq.thanhCong, moHinh: kq.moHinh, nhatKy: kq.nhatKy }
}

export async function timMoHinhAi(formData: FormData): Promise<KetQuaKiemAi> {
  await batBuocVaiTro('admin')
  const nhap = cauHinhNhap(formData)
  if (nhap.loi || !nhap.cauHinh) return { loi: nhap.loi }
  const nhatKy: string[] = []
  const kq = await layDanhSachMoHinh(await khoaDeThu(nhap.cauHinh), nhatKy)
  if ('loi' in kq) return { loi: kq.loi, nhatKy }
  const nha = timNhaCungCap(nhap.cauHinh.nhaCungCap)
  return {
    thanhCong: `Tìm được ${kq.moHinh.length} model ${nha?.ten ?? ''}.`.trim(),
    moHinh: kq.moHinh,
    nhatKy,
  }
}

export async function pingHelloAi(formData: FormData): Promise<KetQuaKiemAi> {
  await batBuocVaiTro('admin')
  const nhap = cauHinhNhap(formData)
  if (nhap.loi || !nhap.cauHinh) return { loi: nhap.loi }
  const kq = await pingHello(await khoaDeThu(nhap.cauHinh))
  if ('loi' in kq) return { loi: kq.loi, nhatKy: kq.nhatKy }
  return { thanhCong: kq.thanhCong, nhatKy: kq.nhatKy }
}
