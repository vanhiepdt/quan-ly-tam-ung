import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { DauVaoGiaoDich } from '@/lib/validation/giao-dich'
import { chuyenDongGiaoDich } from './du-lieu'
import { HINH_THUC, TRANG_THAI } from './kieu'
import { tinhToan } from './tinh-toan'

export type CanhBaoHoanTamUng = {
  duLyThuyet: number
  hoanTamUng: number
  thieu: number
  fingerprint: string
}

// All balance-changing writes must take this same transaction-scoped lock
// before reading the ledger or assigning a sequence number.
export async function khoaSoTaiChinh(client: PoolClient) {
  await client.query('select pg_advisory_xact_lock($1, $2)', [20260916, 1])
}

export async function kiemTraHoanTamUng(
  client: PoolClient, d: DauVaoGiaoDich, soThuTu: number, nguoiDungId: string,
): Promise<CanhBaoHoanTamUng | undefined> {
  if (d.hinh_thuc !== HINH_THUC.HOAN_TAM_UNG || d.trang_thai_hd !== TRANG_THAI.HOP_LE) return

  // The candidate is appended to its date (max sequence + 1). Future rows
  // must not fund a backdated reimbursement. Use the transaction's client,
  // not the pool: the snapshot is read only after acquiring the writer lock.
  const { rows } = await client.query<Record<string, unknown>>(
    'select * from giao_dich where not da_xoa and ngay <= $1 order by ngay, so_thu_tu, tao_luc, id', [d.ngay],
  )
  const truoc = tinhToan(rows.map(chuyenDongGiaoDich))
  const duLyThuyet = truoc.at(-1)?.duLyThuyet ?? 0
  const ungVien = chuyenDongGiaoDich({
    ...d, id: 'ung-vien', so_thu_tu: soThuTu, tao_luc: '2000-01-01T00:00:00.000Z',
    trang_thai_hd: d.trang_thai_hd ?? 'Không có', trang_thai_tt_phi: d.trang_thai_tt_phi ?? 'Không phát sinh',
  })
  const hoanTamUng = tinhToan([ungVien])[0].hoanTamUng
  const thieu = hoanTamUng - duLyThuyet
  if (![duLyThuyet, hoanTamUng, thieu, ...truoc.map(g => g.duLyThuyet)].every(Number.isSafeInteger)) {
    throw new Error('Số dư vượt giới hạn an toàn.')
  }
  if (hoanTamUng <= 0 || hoanTamUng <= duLyThuyet) return
  // Bind the acknowledgement to ALL normalized candidate fields, the actor,
  // insertion position and the server-computed displayed amounts.
  const fingerprint = createHash('sha256').update(JSON.stringify({
    version: 1, nguoiDungId, d, soThuTu, duLyThuyet, hoanTamUng, thieu,
  })).digest('hex')
  return { duLyThuyet, hoanTamUng, thieu, fingerprint }
}
