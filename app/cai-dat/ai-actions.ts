'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import {
  anKhoaChoGiaoDien, boSungKhoaTuMoiTruong, docCauHinhAiTuDb, KHOA_CAU_HINH_AI,
  layCauHinhAi2, type CauHinhAi, type CauHinhAiPhu, type DuLieuCauHinhAi,
} from '@/lib/kiem-tra/cau-hinh-ai'
import { kiemThuApi, layDanhSachMoHinh, pingHello } from '@/lib/kiem-tra/kiem-api-ai'
import { ID_NHA_CUNG_CAP, timNhaCungCap, urlAnToan, type NhaCungCapId } from '@/lib/kiem-tra/nha-cung-cap-ai'

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

function giaTri(formData: FormData, ten: string): string {
  const value = formData.get(ten)
  return typeof value === 'string' ? value : ''
}

function docNhap(formData: FormData, hauTo: '' | '_2', coBat = false): { data?: z.infer<typeof schema>; loi?: string } {
  const parsed = schema.safeParse({
    dangHoatDong: coBat ? formData.get('dang_hoat_dong') === '1' : true,
    nhaCungCap: giaTri(formData, `nha_cung_cap${hauTo}`),
    moHinh: giaTri(formData, `mo_hinh${hauTo}`),
    urlCoSo: giaTri(formData, `url_co_so${hauTo}`),
    khoaApi: giaTri(formData, `khoa_api${hauTo}`).trim(),
    xoaKhoa: formData.get(`xoa_khoa${hauTo}`) === '1',
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
  const moHinh = d.moHinh || nha.moHinhMacDinh
  if (!moHinh) return { loi: `Hãy điền tên model ${nha.ten}.` }
  return { data: { ...d, moHinh, urlCoSo } }
}

function phu(d: z.infer<typeof schema>): CauHinhAiPhu {
  return { nhaCungCap: d.nhaCungCap, moHinh: d.moHinh, khoaApi: d.khoaApi, urlCoSo: d.urlCoSo }
}

function khoaSauKhiLuu(
  moi: CauHinhAiPhu,
  cu: CauHinhAiPhu,
  xoaKhoa: boolean,
): CauHinhAiPhu {
  let khoaApi = cu.nhaCungCap === moi.nhaCungCap ? cu.khoaApi : ''
  if (xoaKhoa) khoaApi = ''
  else if (moi.khoaApi) khoaApi = moi.khoaApi
  return { ...moi, khoaApi }
}

export async function luuCauHinhAi(_: KetQuaAiCaiDat, formData: FormData): Promise<KetQuaAiCaiDat> {
  await batBuocVaiTro('admin')
  try {
    const nhap1 = docNhap(formData, '', true)
    if (nhap1.loi || !nhap1.data) return { loi: nhap1.loi }
    const nhap2CoTruong = formData.has('nha_cung_cap_2') || formData.has('mo_hinh_2') || formData.has('khoa_api_2') || formData.has('url_co_so_2')
    const nhap2 = nhap2CoTruong ? docNhap(formData, '_2') : {}
    if (nhap2.loi || (nhap2CoTruong && !nhap2.data)) return { loi: nhap2.loi }

    const hienTai = await docCauHinhAiTuDb()
    const ai1 = khoaSauKhiLuu(phu(nhap1.data), hienTai, nhap1.data.xoaKhoa)
    const ai2Cu = layCauHinhAi2(hienTai)
    const ai2 = nhap2.data ? khoaSauKhiLuu(phu(nhap2.data), ai2Cu, nhap2.data.xoaKhoa) : ai2Cu
    await db.query(
      `insert into cau_hinh (khoa, gia_tri, mo_ta)
       values ($1, $2::jsonb, $3)
       on conflict (khoa) do update set gia_tri=excluded.gia_tri, sua_luc=now()`,
      [KHOA_CAU_HINH_AI, JSON.stringify({ dangHoatDong: nhap1.data.dangHoatDong, ...ai1, ai2 }), 'Cấu hình hai AI đọc và đối chiếu hóa đơn'],
    )
    revalidatePath('/cai-dat')
    return { thanhCong: `Đã lưu cài đặt AI. Model: ${ai1.moHinh}.` }
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
  const hauTo = formData.get('ai') === '2' ? '_2' : ''
  const nhap = docNhap(formData, hauTo)
  if (nhap.loi || !nhap.data) return { loi: nhap.loi }
  return { cauHinh: { dangHoatDong: true, ...phu(nhap.data) } }
}

async function khoaDeThu(nhap: CauHinhAi): Promise<CauHinhAi> {
  if (nhap.khoaApi) return nhap
  const daLuu = await docCauHinhAiTuDb()
  const ai2 = layCauHinhAi2(daLuu)
  const khoaLuu = daLuu.nhaCungCap === nhap.nhaCungCap
    ? daLuu.khoaApi
    : ai2.nhaCungCap === nhap.nhaCungCap ? ai2.khoaApi : ''
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
  return { thanhCong: `Tìm được ${kq.moHinh.length} model ${nha?.ten ?? ''}.`.trim(), moHinh: kq.moHinh, nhatKy }
}

export async function pingHelloAi(formData: FormData): Promise<KetQuaKiemAi> {
  await batBuocVaiTro('admin')
  const nhap = cauHinhNhap(formData)
  if (nhap.loi || !nhap.cauHinh) return { loi: nhap.loi }
  const kq = await pingHello(await khoaDeThu(nhap.cauHinh))
  if ('loi' in kq) return { loi: kq.loi, nhatKy: kq.nhatKy }
  return { thanhCong: kq.thanhCong, nhatKy: kq.nhatKy }
}
