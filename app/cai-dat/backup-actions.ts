'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db, trongTransaction } from '@/lib/db/pool'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { docDuLieuCaiDatSaoLuu, type DuLieuCaiDatSaoLuu } from '@/lib/sao-luu/cau-hinh'

const gioSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Thời gian phải theo dạng HH:mm.')

export type KetQuaSaoLuu = { loi?: string; thanhCong?: string }
export type { DuLieuCaiDatSaoLuu }

export async function docDuLieuSaoLuu(): Promise<DuLieuCaiDatSaoLuu> {
  await batBuocVaiTro('admin')
  return docDuLieuCaiDatSaoLuu()
}

export async function luuCauHinhSaoLuu(_: KetQuaSaoLuu, formData: FormData): Promise<KetQuaSaoLuu> {
  await batBuocVaiTro('admin')
  const parsed = z.object({ batTuDong: z.boolean(), gioChay: gioSchema }).safeParse({
    batTuDong: formData.get('bat_tu_dong') === '1',
    gioChay: formData.get('gio_chay'),
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Cấu hình sao lưu không hợp lệ.' }

  try {
    await db.query(
      'insert into sao_luu_cau_hinh (id, bat_tu_dong, gio_chay) ' +
      'values (1, $1, $2::time) on conflict (id) do update set ' +
      'bat_tu_dong=excluded.bat_tu_dong, gio_chay=excluded.gio_chay, sua_luc=now()',
      [parsed.data.batTuDong, parsed.data.gioChay],
    )
    revalidatePath('/cai-dat')
    return { thanhCong: 'Đã lưu lịch sao lưu.' }
  } catch {
    return { loi: 'Không lưu được lịch sao lưu. Vui lòng thử lại.' }
  }
}

export async function yeuCauSaoLuuNgay(_: KetQuaSaoLuu, _formData: FormData): Promise<KetQuaSaoLuu> {
  const phien = await batBuocVaiTro('admin')
  try {
    const daTao = await trongTransaction(phien.id, async client => {
      await client.query("select pg_advisory_xact_lock(hashtext('quan-ly-tam-ung-backup'))")
      const { rows: active } = await client.query<{ trang_thai: string }>(
        "select trang_thai from sao_luu_lan_chay where trang_thai in ('cho_xu_ly', 'dang_chay') limit 1")
      if (active[0]) return false
      await client.query(
        "insert into sao_luu_lan_chay (loai, trang_thai, nguoi_yeu_cau) values ('thu_cong', 'cho_xu_ly', $1)",
        [phien.id],
      )
      return true
    })
    revalidatePath('/cai-dat')
    return daTao
      ? { thanhCong: 'Đã gửi yêu cầu. VPS sẽ xử lý và cập nhật kết quả Google Drive.' }
      : { thanhCong: 'Đã có một bản sao lưu đang chờ hoặc đang thực hiện.' }
  } catch {
    return { loi: 'Không gửi được yêu cầu sao lưu. Vui lòng thử lại.' }
  }
}

export async function kiemTraSaoLuuGoogleDrive(_: KetQuaSaoLuu, _formData: FormData): Promise<KetQuaSaoLuu> {
  await batBuocVaiTro('admin')
  try {
    const { kiemTraKetNoiGoogleDrive } = await import('@/lib/sao-luu/google-drive')
    const email = await kiemTraKetNoiGoogleDrive()
    revalidatePath('/cai-dat')
    return { thanhCong: `Kết nối Google Drive thành công (${email}). Thư mục sao lưu có quyền ghi.` }
  } catch (error) {
    return { loi: error instanceof Error ? error.message : 'Không kiểm tra được kết nối Google Drive.' }
  }
}

export async function ngatKetNoiSaoLuuGoogleDrive(_: KetQuaSaoLuu, _formData: FormData): Promise<KetQuaSaoLuu> {
  await batBuocVaiTro('admin')
  try {
    const { ngatKetNoiGoogleDrive } = await import('@/lib/sao-luu/google-drive')
    await ngatKetNoiGoogleDrive()
    revalidatePath('/cai-dat')
    return { thanhCong: 'Đã ngắt kết nối Google Drive. Lịch tự động sẽ không tải bản sao lưu lên Drive đến khi kết nối lại.' }
  } catch {
    return { loi: 'Không ngắt được kết nối Google Drive. Vui lòng thử lại.' }
  }
}
