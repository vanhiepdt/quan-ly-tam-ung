import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { layPhien } from '@/lib/xac-thuc/phien'
import { layDuLieuTaiChinh } from '@/lib/tai-chinh/du-lieu'
import { tinhToan } from '@/lib/tai-chinh/tinh-toan'
import { gomHoiNghi } from '@/lib/tai-chinh/gom-hoi-nghi'
import type { DongNhatKy, GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { taoWorkbookNhatKyServer } from '@/app/giao-dich/xuat-nhat-ky-excel-server'
import { tenTepNhatKy, type TepXuatNhatKy } from '@/app/giao-dich/xuat-nhat-ky-excel'
import { taoZipNhatKy } from '@/app/giao-dich/xuat-nhat-ky-zip'

export const dynamic = 'force-dynamic'

// Nhật ký gửi lên mã giao dịch thật (UUID) hoặc mã dòng gộp Hội nghị "hoi-nghi:<UUID>".
const MA_DONG = /^(hoi-nghi:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inputSchema = z.object({
  ids: z.array(z.string().regex(MA_DONG)).max(20_000).refine(ids => new Set(ids).size === ids.length, 'Danh sách giao dịch bị trùng.'),
})

const TEN_LOAI_TEP_HOI_NGHI: Record<string, string> = {
  de_nghi_don_vi: 'Đề nghị của đơn vị đề xuất',
  to_trinh_to_chuc: 'Tờ trình tổ chức hội nghị',
  du_toan: 'Dự toán tổ chức hội nghị',
  hoa_don: 'Hóa đơn',
  to_trinh_quyet_toan: 'Tờ trình quyết toán',
  bao_cao: 'Báo cáo hội nghị',
  khac: 'Khác',
}

type TepRow = { id: string; giao_dich_id: string; loai: string; duong_dan: string; ten_goc: string; mime: string }
type TepHoiNghiRow = { id: string; hoi_nghi_id: string; giao_dich_id: string | null; loai: string; ten_loai: string | null; duong_dan: string; ten_goc: string; mime: string }

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
    // Gộp đúng như trang nhật ký để mã "hoi-nghi:..." gửi lên khớp với dòng người dùng thấy.
    const byId = new Map(gomHoiNghi(calculated).map(row => [row.id, row]))
    const rows = parsed.ids.map(id => byId.get(id)).filter((row): row is DongNhatKy => Boolean(row))
    const hoiNghiIds = rows.flatMap(row => row.gopHoiNghi ? [row.gopHoiNghi.hoiNghiId] : [])
    const conHoiNghi = new Map<string, GiaoDichTinh[]>(hoiNghiIds.map(id => [id, []]))
    for (const row of calculated) if (row.hoiNghiId) conHoiNghi.get(row.hoiNghiId)?.push(row)
    const conIds = new Set([...conHoiNghi.values()].flat().map(row => row.id))
    const giaoDichIds = [...rows.filter(row => !row.gopHoiNghi).map(row => row.id), ...conIds]

    const [fileRows, hoiNghiFileRows] = await Promise.all([
      giaoDichIds.length
        ? db.query<TepRow>(
          'select id, giao_dich_id, loai, duong_dan, ten_goc, mime from tep_dinh_kem where giao_dich_id = any($1::uuid[]) order by giao_dich_id, tao_luc, id',
          [giaoDichIds],
        ).then(r => r.rows)
        : Promise.resolve([] as TepRow[]),
      hoiNghiIds.length
        ? db.query<TepHoiNghiRow>(
          'select id, hoi_nghi_id, giao_dich_id, loai, ten_loai, duong_dan, ten_goc, mime from tep_hoi_nghi where hoi_nghi_id = any($1::uuid[]) order by hoi_nghi_id, tao_luc, id',
          [hoiNghiIds],
        ).then(r => r.rows)
        : Promise.resolve([] as TepHoiNghiRow[]),
    ])

    const attachments = new Map<string, TepXuatNhatKy[]>()
    const files: TepXuatNhatKy[] = []
    const countByFolder = new Map<string, number>()
    async function themTep(key: string, folder: string, row: { id: string; loai: string; duong_dan: string; ten_goc: string; mime: string }) {
      const index = (countByFolder.get(folder) ?? 0) + 1
      countByFolder.set(folder, index)
      const physical = duongDanTep(row.duong_dan)
      const safe = tenAnToan(row.ten_goc, 'tep-' + index)
      const zipPath = 'tep-dinh-kem/' + folder + '/' + String(index).padStart(2, '0') + '-' + safe
      let tonTai = false
      if (physical) {
        try { await readFile(physical); tonTai = true } catch { tonTai = false }
      }
      const file: TepXuatNhatKy = {
        id: row.id, giaoDichId: key, loai: row.loai, tenGoc: row.ten_goc,
        mime: row.mime, duongDan: physical ?? '', zipPath, tonTai,
      }
      files.push(file)
      const list = attachments.get(key) ?? []
      list.push(file)
      attachments.set(key, list)
    }
    for (const row of fileRows) await themTep(row.giao_dich_id, row.giao_dich_id, row)
    for (const row of hoiNghiFileRows) {
      // Chứng từ gắn với một giao dịch con còn sống thì hiện ở dòng con đó; còn lại
      // (kể cả khi giao dịch con đã bị xóa) là chứng từ chung của Hội nghị.
      const key = row.giao_dich_id && conIds.has(row.giao_dich_id) ? row.giao_dich_id : 'hoi-nghi:' + row.hoi_nghi_id
      const loai = row.loai === 'khac' && row.ten_loai ? row.ten_loai : TEN_LOAI_TEP_HOI_NGHI[row.loai] ?? row.loai
      await themTep(key, 'hoi-nghi-' + row.hoi_nghi_id, { ...row, loai })
    }
    const workbook = await taoWorkbookNhatKyServer(rows, attachments, conHoiNghi)
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
