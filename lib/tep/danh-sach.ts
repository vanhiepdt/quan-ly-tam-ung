import { db } from '@/lib/db/pool'
import { laLoaiTep, type LoaiTep } from './loai'

export type TepDong = {
  id: string
  loai: LoaiTep
  tenGoc: string
  kichThuoc: number
  mime: string
  taoLuc: string
}

export type ThuMucGiaoDich = {
  id: string
  ngay: string
  soThuTu: number
  noiDung: string
  hinhThuc: string
  tep: TepDong[]
}

type Dong = {
  id: string
  ngay: Date | string
  so_thu_tu: number
  noi_dung: string
  hinh_thuc: string
  tep: unknown
}

function ngayIso(v: Date | string) {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  return String(v).slice(0, 10)
}

export function tepDong(raw: unknown): TepDong[] {
  if (!Array.isArray(raw)) return []
  const kq: TepDong[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const o = t as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.loai !== 'string' || !laLoaiTep(o.loai)) continue
    kq.push({
      id: o.id,
      loai: o.loai,
      tenGoc: String(o.tenGoc ?? ''),
      kichThuoc: Number(o.kichThuoc) || 0,
      mime: String(o.mime ?? ''),
      taoLuc: String(o.taoLuc ?? ''),
    })
  }
  return kq
}

const SELECT = `select g.id, g.ngay, g.so_thu_tu, g.noi_dung, g.hinh_thuc,
  coalesce(json_agg(json_build_object(
    'id', t.id, 'loai', t.loai, 'tenGoc', t.ten_goc, 'kichThuoc', t.kich_thuoc,
    'mime', t.mime, 'taoLuc', t.tao_luc
  ) order by t.tao_luc) filter (where t.id is not null), '[]'::json) as tep
from giao_dich g
left join tep_dinh_kem t on t.giao_dich_id = g.id`

function mapDong(r: Dong): ThuMucGiaoDich {
  return {
    id: r.id,
    ngay: ngayIso(r.ngay),
    soThuTu: r.so_thu_tu,
    noiDung: r.noi_dung,
    hinhThuc: r.hinh_thuc,
    tep: tepDong(r.tep),
  }
}

export async function danhSachThuMucTep(): Promise<ThuMucGiaoDich[]> {
  const { rows } = await db.query<Dong>(
    `${SELECT} where not g.da_xoa group by g.id order by g.ngay desc, g.so_thu_tu desc, g.tao_luc desc, g.id`,
  )
  return rows.map(mapDong)
}

export async function thuMucTep(id: string): Promise<ThuMucGiaoDich | null> {
  const { rows } = await db.query<Dong>(
    `${SELECT} where not g.da_xoa and g.id=$1 group by g.id`,
    [id],
  )
  return rows[0] ? mapDong(rows[0]) : null
}
