import { revalidatePath } from 'next/cache'
import { trongTransaction } from '@/lib/db/pool'
import { kiemTraVaLuuTep, xoaTepVatLy } from './luu'

export const LOAI_TEP_HOI_NGHI = ['de_nghi_don_vi','to_trinh_to_chuc','du_toan','hoa_don','to_trinh_quyet_toan','bao_cao','khac'] as const
export type LoaiTepHoiNghi = typeof LOAI_TEP_HOI_NGHI[number]

export async function ganTepVaoHoiNghi(nguoiId: string, hoiNghiId: string, tep: File, loai: string, tenLoai?: string, giaoDichId?: string | null): Promise<string | undefined> {
  if (!(LOAI_TEP_HOI_NGHI as readonly string[]).includes(loai)) return 'Loại chứng từ không hợp lệ.'
  const validationType = loai === 'hoa_don' ? 'hoa_don' : 'chuyen_khoan'
  const saved = await kiemTraVaLuuTep(tep, validationType, hoiNghiId)
  if (!saved.ok) return saved.loi
  try {
    await trongTransaction(nguoiId, async client => {
      const group = await client.query('select 1 from hoi_nghi where id=$1 and not da_xoa for update', [hoiNghiId])
      if (!group.rowCount) throw new Error('Hội nghị không tồn tại.')
      if (giaoDichId) {
        const child = await client.query('select 1 from giao_dich where id=$1 and hoi_nghi_id=$2 and not da_xoa', [giaoDichId, hoiNghiId])
        if (!child.rowCount) throw new Error('Giao dịch con không thuộc Hội nghị.')
      }
      await client.query('insert into tep_hoi_nghi(hoi_nghi_id,giao_dich_id,loai,ten_loai,duong_dan,ten_goc,kich_thuoc,mime,nguoi_tai_len) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [hoiNghiId, giaoDichId || null, loai, loai === 'khac' ? (tenLoai || 'Khác') : null, saved.tuongDoi, saved.tenGoc, saved.kichThuoc, saved.mime, nguoiId])
    })
  } catch (error) { await xoaTepVatLy(saved.tuongDoi); return error instanceof Error ? error.message : 'Không lưu được chứng từ Hội nghị.' }
  revalidatePath('/giao-dich/theo-doi')
}
