import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { PoolClient } from 'pg'
import { db, trongTransaction } from '@/lib/db/pool'

const bamToken = (token: string) => createHash('sha256').update(token).digest('hex')
export type Phien = { id: string; ho_ten: string; ten_dang_nhap: string; email: string | null; vai_tro: 'admin' | 'nhap_lieu' | 'chi_doc'; doi_mat_khau: boolean }

export async function taoPhien(nguoiDungId: string, expectedHash: string) {
  const token = randomBytes(32).toString('base64url')
  const ok = await trongTransaction(nguoiDungId, async client => {
    const { rows } = await client.query('select id from nguoi_dung where id=$1 and dang_hoat_dong and mat_khau_hash=$2 for update', [nguoiDungId, expectedHash])
    if (!rows.length) return false
    await client.query(`insert into phien (nguoi_dung_id, token_hash, het_luc) values ($1,$2,now() + interval '7 days')`, [nguoiDungId, bamToken(token)])
    return true
  })
  if (!ok) return false
  ;(await cookies()).set('phien', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 })
  return true
}
export async function layPhien(client?: PoolClient): Promise<Phien | null> {
  const token = (await cookies()).get('phien')?.value
  if (!token) return null
  const { rows } = await (client ?? db).query<Phien>(`select nd.id,nd.ho_ten,nd.ten_dang_nhap,nd.email,nd.vai_tro,nd.doi_mat_khau from phien p join nguoi_dung nd on nd.id=p.nguoi_dung_id where p.token_hash=$1 and p.het_luc>now() and nd.dang_hoat_dong`, [bamToken(token)])
  return rows[0] ?? null
}
export async function huyPhien() {
  const token = (await cookies()).get('phien')?.value
  if (token) await db.query('delete from phien where token_hash=$1', [bamToken(token)])
  ;(await cookies()).delete('phien')
}
