import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PoolClient } from 'pg'
import { db, trongTransaction } from '@/lib/db/pool'
import { docZip } from '@/lib/van-ban/zip'

export type TaiLieu = { id: string; giao_dich_id: string | null; loai: string | null; ten_mau: string | null; phien_ban: number; tep: string; khoa: string | null }
export const laId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
export function duongDanTaiLieu(tep: string) {
  if (!laId(tep)) throw new Error('Mã tệp không hợp lệ')
  return path.resolve(process.env.UPLOAD_DIR || 'uploads', 'giay', `${tep}.docx`)
}
export function kiemTraDocx(data: Buffer) {
  if (!data.length || data.length > 20 * 1024 * 1024) throw new Error('Tệp quá lớn')
  // Kiểm tra tổng kích thước giải nén trước khi gọi bộ đọc ZIP hiện có.
  let end = -1
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new Error('ZIP không hợp lệ')
  let offset = data.readUInt32LE(end + 16), total = 0
  const count = data.readUInt16LE(end + 10)
  if (count > 2000) throw new Error('Quá nhiều mục ZIP')
  for (let i = 0; i < count; i++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP không hợp lệ')
    total += data.readUInt32LE(offset + 24)
    if (total > 50 * 1024 * 1024) throw new Error('ZIP quá lớn')
    offset += 46 + data.readUInt16LE(offset + 28) + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32)
  }
  if (!docZip(data).some(m => m.ten === 'word/document.xml')) throw new Error('Không phải DOCX')
}
async function ghiTep(data: Buffer) {
  kiemTraDocx(data)
  const tep = randomUUID(), file = duongDanTaiLieu(tep)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data, { flag: 'wx' })
  return { tep, hash: createHash('sha256').update(data).digest('hex') }
}
export async function taoHoacLayTaiLieu(user: string, gd: string | null, loai: string | null, mau: string | null, sinh: () => Promise<Buffer>, client?: PoolClient): Promise<TaiLieu> {
  const run = async (c: PoolClient) => {
    await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`giay:${gd ?? mau}:${loai}`])
    const old = await c.query<TaiLieu>('select * from tai_lieu where (giao_dich_id=$1 and loai=$2) or ten_mau=$3', [gd, loai, mau])
    if (old.rows[0]) return old.rows[0]
    const { tep, hash } = await ghiTep(await sinh())
    const { rows } = await c.query<TaiLieu>('insert into tai_lieu(giao_dich_id,loai,ten_mau,tep,nguoi_tao) values($1,$2,$3,$4,$5) returning *', [gd, loai, mau, tep, user])
    await c.query('insert into tai_lieu_phien_ban(tai_lieu_id,phien_ban,tep,sha256,nguoi_luu) values($1,1,$2,$3,$4)', [rows[0].id, tep, hash, user])
    return rows[0]
  }
  return client ? run(client) : trongTransaction(user, run)
}
export async function moPhien(t: TaiLieu, user: string) {
  return trongTransaction(user, async c => {
    const { rows } = await c.query<TaiLieu>('select * from tai_lieu where id=$1 for update', [t.id])
    const current = rows[0]
    if (!current.khoa) {
      current.khoa = `${current.id}-${current.phien_ban}-${randomUUID()}`
      await c.query('insert into tai_lieu_phien(khoa,tai_lieu_id,tep_ban_dau) values($1,$2,$3)', [current.khoa, t.id, current.tep])
      await c.query('update tai_lieu set khoa=$1 where id=$2', [current.khoa, t.id])
    }
    return current
  })
}
export async function docMau(ten: string, client: Pick<PoolClient, 'query'> = db) {
  if (!['Tam ung tien.docx', 'tiep khach va thanh toan.docx'].includes(ten)) throw new Error('Mẫu không hợp lệ')
  const { rows } = await client.query<TaiLieu>('select * from tai_lieu where ten_mau=$1', [ten])
  return readFile(rows[0] ? duongDanTaiLieu(rows[0].tep) : path.resolve('Mau', ten))
}
export async function luuPhienBanMoi(khoa: string, user: string, status: number, data?: Buffer) {
  return trongTransaction(user, async c => {
    const { rows } = await c.query<TaiLieu & { da_dong: boolean }>('select t.*,p.da_dong from tai_lieu t join tai_lieu_phien p on p.tai_lieu_id=t.id where p.khoa=$1 for update of t,p', [khoa])
    const t = rows[0]
    if (!t) throw new Error('Phiên không tồn tại')
    if (t.da_dong) return
    if (t.khoa !== khoa) throw new Error('Phiên cũ')
    if (data) {
      const hash = createHash('sha256').update(data).digest('hex')
      const last = await c.query('select sha256 from tai_lieu_phien_ban where tai_lieu_id=$1 and phien_ban=$2', [t.id, t.phien_ban])
      if (last.rows[0].sha256 !== hash) {
        const saved = await ghiTep(data)
        await c.query('insert into tai_lieu_phien_ban(tai_lieu_id,phien_ban,tep,sha256,nguoi_luu) values($1,$2,$3,$4,$5)', [t.id, t.phien_ban + 1, saved.tep, saved.hash, user])
        await c.query('update tai_lieu set tep=$1,phien_ban=phien_ban+1,sua_luc=now() where id=$2', [saved.tep, t.id])
      }
    }
    if (status === 2 || status === 4) {
      await c.query('update tai_lieu_phien set da_dong=true where khoa=$1', [khoa])
      await c.query('update tai_lieu set khoa=null where id=$1', [t.id])
    }
  })
}
