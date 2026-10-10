import { access } from 'node:fs/promises'
import { db } from '@/lib/db/pool'

export const KHOA_MUI_GIO_SAO_LUU = 'Asia/Ho_Chi_Minh'
export const GIO_SAO_LUU_MAC_DINH = '17:00'

export type TrangThaiSaoLuu = 'cho_xu_ly' | 'dang_chay' | 'thanh_cong' | 'that_bai'
export type LoaiSaoLuu = 'thu_cong' | 'lich'

export type CauHinhSaoLuu = {
  batTuDong: boolean
  gioChay: string
}

export type LanChaySaoLuu = {
  id: string
  loai: LoaiSaoLuu
  trangThai: TrangThaiSaoLuu
  ngayLich: string | null
  taoLuc: string
  batDauLuc: string | null
  ketThucLuc: string | null
  driveFileId: string | null
  loi: string | null
}

export type DuLieuCaiDatSaoLuu = {
  cauHinh: CauHinhSaoLuu
  lanChay: LanChaySaoLuu | null
  googleDriveDaCauHinh: boolean
}

type RowCauHinh = { bat_tu_dong: boolean; gio_chay: string | null }
type RowLanChay = {
  id: string
  loai: LoaiSaoLuu
  trang_thai: TrangThaiSaoLuu
  ngay_lich: string | Date | null
  tao_luc: string | Date
  bat_dau_luc: string | Date | null
  ket_thuc_luc: string | Date | null
  drive_file_id: string | null
  loi: string | null
}

function ngay(value: string | Date | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function luc(value: string | Date | null): string | null {
  if (value === null) return null
  return new Date(value).toISOString()
}

export function cauHinhSaoLuuTuRow(row?: Partial<RowCauHinh> | null): CauHinhSaoLuu {
  const gio = typeof row?.gio_chay === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.gio_chay)
    ? row.gio_chay
    : GIO_SAO_LUU_MAC_DINH
  return { batTuDong: row?.bat_tu_dong === true, gioChay: gio }
}

export function lanChaySaoLuuTuRow(row?: RowLanChay | null): LanChaySaoLuu | null {
  if (!row) return null
  return {
    id: String(row.id), loai: row.loai, trangThai: row.trang_thai, ngayLich: ngay(row.ngay_lich),
    taoLuc: luc(row.tao_luc)!, batDauLuc: luc(row.bat_dau_luc), ketThucLuc: luc(row.ket_thuc_luc),
    driveFileId: row.drive_file_id, loi: row.loi,
  }
}

export async function docCauHinhSaoLuu(client: Pick<typeof db, 'query'> = db): Promise<CauHinhSaoLuu> {
  const { rows } = await client.query<RowCauHinh>(
    "select bat_tu_dong, to_char(gio_chay, 'HH24:MI') as gio_chay from sao_luu_cau_hinh where id=1",
  )
  return cauHinhSaoLuuTuRow(rows[0])
}

export async function docLanChaySaoLuu(client: Pick<typeof db, 'query'> = db): Promise<LanChaySaoLuu | null> {
  const { rows } = await client.query<RowLanChay>(
    'select id, loai, trang_thai, ngay_lich, tao_luc, bat_dau_luc, ket_thuc_luc, drive_file_id, loi from sao_luu_lan_chay order by tao_luc desc limit 1',
  )
  return lanChaySaoLuuTuRow(rows[0])
}

export async function docDuLieuCaiDatSaoLuu(client: Pick<typeof db, 'query'> = db): Promise<DuLieuCaiDatSaoLuu> {
  const [config, run] = await Promise.all([docCauHinhSaoLuu(client), docLanChaySaoLuu(client)])
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  const account = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE?.trim()
  const readable = account ? await access(account).then(() => true, () => false) : false
  return { cauHinh: config, lanChay: run, googleDriveDaCauHinh: Boolean(folder && readable) }
}

export function tachNgayGio(value: Date = new Date(), timeZone = KHOA_MUI_GIO_SAO_LUU) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value)
  const get = (name: string) => parts.find(part => part.type === name)?.value ?? ''
  return {
    ngay: [get('year'), get('month'), get('day')].join('-'),
    gio: get('hour') + ':' + get('minute'),
  }
}

