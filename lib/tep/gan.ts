import { revalidatePath } from 'next/cache'
import { trongTransaction } from '@/lib/db/pool'
import { kiemTraVaLuuTep, xoaTepVatLy } from './luu'

export async function ganTepVaoGiaoDich(
  nguoiId: string,
  giaoDichId: string,
  tep: File,
  loai: string,
): Promise<string | undefined> {
  const luu = await kiemTraVaLuuTep(tep, loai, giaoDichId)
  if (!luu.ok) return luu.loi
  try {
    await trongTransaction(nguoiId, async client => {
      const ok = await client.query('select 1 from giao_dich where id=$1 and not da_xoa', [giaoDichId])
      if (!ok.rowCount) throw new Error('Giao dịch không tồn tại.')
      await client.query(
        'insert into tep_dinh_kem(giao_dich_id,loai,duong_dan,ten_goc,kich_thuoc,mime,nguoi_tai_len) values($1,$2,$3,$4,$5,$6,$7)',
        [giaoDichId, luu.loai, luu.tuongDoi, luu.tenGoc, luu.kichThuoc, luu.mime, nguoiId],
      )
    })
  } catch (error) {
    await xoaTepVatLy(luu.tuongDoi)
    return error instanceof Error && error.message === 'Giao dịch không tồn tại.'
      ? error.message
      : 'Không lưu được tệp đính kèm.'
  }
  revalidatePath('/tep')
  revalidatePath(`/tep/${giaoDichId}`)
  revalidatePath('/giao-dich')
}
