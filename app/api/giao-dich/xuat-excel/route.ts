import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { layPhien } from '@/lib/xac-thuc/phien'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { taoWorkbookNhatKyServer } from '@/app/giao-dich/xuat-nhat-ky-excel-server'
import { tenTepNhatKy, type TepXuatNhatKy } from '@/app/giao-dich/xuat-nhat-ky-excel'
import { taoZipNhatKy } from '@/app/giao-dich/xuat-nhat-ky-zip'

export const dynamic = 'force-dynamic'

const inputSchema = z.object({
  ids: z.array(z.string().uuid()).max(20_000).refine(ids => new Set(ids).size === ids.length, 'Danh sách giao dịch bị trùng.'),
})

type TepRow = { id: string; giao_dich_id: string; loai: string; duong_dan: string; ten_goc: string; mime: string }

function tenAnToan(value: string, fallback: string) {
  const cleaned = value.normalize('NFC').replace(/[\\/\x00-\x1f\x7f]/g, '_').replace(/\s+/g, ' ').trim()
  return (cleaned || fallback).slice(0, 180)
}

function duongDanTep(duongDan: string): string | null {
  const root = path.resolve(process.env.UPLOAD_DIR ?? '/var/lib/tam-ung/tep') + path.sep
  const full = path.resolve(root, ...duongDan.split(/[/\\]/).filter(Boolean))
  return full.startsWith(root) ? full : null
}

export async function POST(request: Request) {
  if (!await layPhien()) return Response.json({ loi: 'Chưa đăng nhập' }, { status: 401 })
  let parsed: z.infer<typeof inputSchema>
  try { parsed = inputSchema.parse(await request.json()) } catch { return Response.json({ loi: 'Danh sách giao dịch không hợp lệ.' }, { status: 400 }) }

  try {
    const { giaoDich, thamSo } = await layDuLieuTaiChinh()
    const calculated = tinhToan(giaoDich, thamSo)
    const byId = new Map(calculated.map(row => [row.id, row]))
    const rows = parsed.ids.map(id => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))
    const fileRows = parsed.ids.length
      ? (await db.query<TepRow>(
        'select id, giao_dich_id, loai, duong_dan, ten_goc, mime from tep_dinh_kem where giao_dich_id = any($1::uuid[]) order by giao_dich_id, tao_luc, id',
        [parsed.ids],
      )).rows
      : []
    const attachments = new Map<string, TepXuatNhatKy[]>()
    const files: TepXuatNhatKy[] = []
    const countByTransaction = new Map<string, number>()
    for (const row of fileRows) {
      const index = (countByTransaction.get(row.giao_dich_id) ?? 0) + 1
      countByTransaction.set(row.giao_dich_id, index)
      const physical = duongDanTep(row.duong_dan)
      const safe = tenAnToan(row.ten_goc, 'tep-' + index)
      const zipPath = 'tep-dinh-kem/' + row.giao_dich_id + '/' + String(index).padStart(2, '0') + '-' + safe
      let tonTai = false
      if (physical) {
        try { await readFile(physical); tonTai = true } catch { tonTai = false }
      }
      const file: TepXuatNhatKy = {
        id: row.id, giaoDichId: row.giao_dich_id, loai: row.loai, tenGoc: row.ten_goc,
        mime: row.mime, duongDan: physical ?? '', zipPath, tonTai,
      }
      files.push(file)
      const list = attachments.get(row.giao_dich_id) ?? []
      list.push(file)
      attachments.set(row.giao_dich_id, list)
    }
    const workbook = await taoWorkbookNhatKyServer(rows, attachments)
    const zip = await taoZipNhatKy(workbook, files)
    const filename = tenTepNhatKy()
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zip.length),
        'Content-Disposition': 'attachment; filename="nhat-ky-giao-dich.zip"; filename*=UTF-8\'\'' + encodeURIComponent(filename),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Không xuất được nhật ký Excel', error)
    return Response.json({ loi: 'Không thể xuất nhật ký Excel. Vui lòng thử lại.' }, { status: 500 })
  }
}
