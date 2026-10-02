import { db } from '@/lib/db/pool'
import { docCauHinhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { HINH_THUC_THANH_TOAN, hopLeHinhThucThanhToan, lamTronXuongHangNghinMacDinh } from '@/lib/tai-chinh/hinh-thuc'
import { ngayDeNghiMacDinh } from '@/lib/tai-chinh/ngay'
import { donViMacDinh, type DonViTiepKhach } from '@/lib/tai-chinh/don-vi'
import { schemaGiaoDich, type DauVaoGiaoDich } from '@/lib/validation/giao-dich'
import { taoGiaoDichDaParse, type KetQuaTaoGiaoDich } from '@/lib/tai-chinh/tao-giao-dich'
import { soTienThanhToan } from '@/lib/tai-chinh/tien-thanh-toan'
import { deXuatGiaoDich, nhanLoaiHdIntake, type DeXuatIntake } from './doc-hoa-don'
import { docTepIntake, luuTepIntake, xoaTepIntake } from './tep'
import {
  docCauHinhIntake,
  type CauHinhIntake,
  type HinhThucIntake,
} from './cau-hinh'

export type TrangThaiIntake = 'cho_phan_hoi' | 'dang_xu_ly' | 'da_luu' | 'huy' | 'tu_luu_het_han' | 'loi'

export type SnapshotIntake = {
  hinhThuc: HinhThucIntake
  donViId: string
  donViTen: string
  nguoiLayHdId: string | null
  trangThaiTtPhi: string
  hinhThucThanhToan: string
  nguoiDungId: string
  nguoiDungTen: string
  timeoutGiay: number
}

export type ThayDoiIntake = {
  hinhThuc?: HinhThucIntake
  donViId?: string
  nguoiLayHdId?: string | null
  hinhThucThanhToan?: 'tien_mat' | 'chuyen_khoan' | null
  soHd?: string | null
  kyHieuHd?: string | null
  choSuaHoaDon?: boolean
  choNhap?: 'hinh_thuc' | 'don_vi' | 'nguoi_lay_hd' | 'thanh_toan' | 'hoa_don'
  canhBaoFingerprint?: string
}

export type DeXuatLuuIntake = DeXuatIntake & { thayDoi?: ThayDoiIntake }

export type IntakeRow = {
  id: string
  nguon: 'telegram' | 'scan'
  trang_thai: TrangThaiIntake
  chat_telegram_id: string | null
  user_telegram_id: string | null
  message_id: string | null
  idempotency_key: string
  nguoi_dung_id: string | null
  tep_tam_duong_dan: string | null
  tep_tam_ten_goc: string | null
  tep_tam_kich_thuoc: number | string | null
  tep_tam_mime: string | null
  de_xuat: unknown
  mac_dinh_snapshot: unknown
  het_han: string | Date
  giao_dich_id: string | null
  loi: string | null
  tao_luc: string | Date
  sua_luc: string | Date
}

function laObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v))
}

function chuoi(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function uuid(v: unknown): string | null {
  const s = chuoi(v)
  return s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : null
}

function parseSnapshot(v: unknown): SnapshotIntake {
  if (!laObject(v)) throw new Error('Snapshot intake không hợp lệ.')
  const hinhThuc = v.hinhThuc === HINH_THUC.CQ_TRA_THANG ? HINH_THUC.CQ_TRA_THANG : HINH_THUC.HOAN_TAM_UNG
  const donViId = uuid(v.donViId)
  const nguoiDungId = uuid(v.nguoiDungId)
  if (!donViId || !nguoiDungId || typeof v.donViTen !== 'string' || typeof v.nguoiDungTen !== 'string') {
    throw new Error('Cấu hình mặc định intake chưa đầy đủ.')
  }
  return {
    hinhThuc,
    donViId,
    donViTen: v.donViTen,
    nguoiLayHdId: uuid(v.nguoiLayHdId),
    trangThaiTtPhi: typeof v.trangThaiTtPhi === 'string' ? v.trangThaiTtPhi : 'Không phát sinh',
    hinhThucThanhToan: hinhThuc === HINH_THUC.HOAN_TAM_UNG
      ? HINH_THUC_THANH_TOAN.HOAN_TAM_UNG
      : v.hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
        ? HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
        : HINH_THUC_THANH_TOAN.TIEN_MAT,
    nguoiDungId,
    nguoiDungTen: v.nguoiDungTen,
    timeoutGiay: Number.isInteger(v.timeoutGiay) ? Number(v.timeoutGiay) : 180,
  }
}

function parseDeXuat(v: unknown): DeXuatLuuIntake {
  if (!laObject(v)) throw new Error('Đề xuất intake không hợp lệ.')
  const loaiHd = v.loaiHd === 'ban_hang' ? 'ban_hang' : 'gtgt'
  const ngay = typeof v.ngay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.ngay) ? v.ngay : ''
  const tongTien = Number(v.tongTien)
  const tienRuouBia = Number(v.tienRuouBia)
  if (!ngay || !Number.isSafeInteger(tongTien) || tongTien < 0 || !Number.isSafeInteger(tienRuouBia) || tienRuouBia < 0) {
    throw new Error('Đề xuất hóa đơn thiếu ngày hoặc số tiền hợp lệ.')
  }
  const thayDoi = laObject(v.thayDoi) ? v.thayDoi as ThayDoiIntake : undefined
  return {
    ngay,
    kyHieuHd: chuoi(v.kyHieuHd),
    soHd: chuoi(v.soHd),
    tongTien,
    tienRuouBia,
    loaiHd,
    trangThaiHd: v.trangThaiHd === 'Không hợp lệ' ? 'Không hợp lệ' : 'Hợp lệ',
    ...(thayDoi ? { thayDoi } : {}),
  }
}

export function docDeXuatIntake(row: Pick<IntakeRow, 'de_xuat'>): DeXuatLuuIntake {
  return parseDeXuat(row.de_xuat)
}

export function docSnapshotIntake(row: Pick<IntakeRow, 'mac_dinh_snapshot'>): SnapshotIntake {
  return parseSnapshot(row.mac_dinh_snapshot)
}

export async function layMacDinhIntake(cauHinh?: CauHinhIntake): Promise<SnapshotIntake> {
  const config = cauHinh ?? await docCauHinhIntake()
  const actorId = uuid(config.nguoiDungHeThongId)
  if (!actorId) throw new Error('Chưa chọn user hệ thống dùng khi lưu intake.')
  const [{ rows: users }, { rows: units }, cauHinhGiay] = await Promise.all([
    db.query<{ id: string; ho_ten: string }>("select id, ho_ten from nguoi_dung where id=$1 and dang_hoat_dong and vai_tro in ('admin','nhap_lieu')", [actorId]),
    db.query<DonViTiepKhach>(`
      select dv.id, dv.ten,
        to_char(max(gd.ngay), 'DD/MM/YYYY') as lan_cuoi,
        count(gd.id)::int as so_lan
      from don_vi dv
      left join giao_dich gd on gd.don_vi_id = dv.id and not gd.da_xoa
      where dv.dang_hoat_dong
      group by dv.id, dv.ten
      order by dv.ten
    `),
    docCauHinhGiay(),
  ])
  const unit = units.find(item => item.id === config.donViIdMacDinh) ?? donViMacDinh(units)
  const user = users[0]
  if (!user) throw new Error('User hệ thống không tồn tại, đã bị vô hiệu hóa hoặc không có quyền nhập liệu.')
  if (!unit) throw new Error('Chưa có đơn vị giao dịch đang hoạt động.')
  const collectorId = cauHinhGiay.nguoiLayHdMacDinhId
  let nguoiLayHdId: string | null = null
  if (collectorId) {
    const { rows } = await db.query<{ id: string }>('select id from nguoi_lay_hd where id=$1 and dang_hoat_dong', [collectorId])
    nguoiLayHdId = rows[0]?.id ?? null
  }
  const hinhThucThanhToan = config.hinhThucMacDinh === HINH_THUC.HOAN_TAM_UNG
    ? HINH_THUC_THANH_TOAN.HOAN_TAM_UNG
    : config.hinhThucThanhToanMacDinh
  if (!hopLeHinhThucThanhToan(config.hinhThucMacDinh, hinhThucThanhToan)) throw new Error('Hình thức thanh toán mặc định không hợp lệ.')
  return {
    hinhThuc: config.hinhThucMacDinh,
    donViId: unit.id,
    donViTen: unit.ten,
    nguoiLayHdId,
    trangThaiTtPhi: cauHinhGiay.trangThaiTtPhiMacDinh,
    hinhThucThanhToan,
    nguoiDungId: user.id,
    nguoiDungTen: user.ho_ten,
    timeoutGiay: config.timeoutGiay,
  }
}

export function giaoDichTuIntake(row: IntakeRow, dungMacDinh: boolean): { data: DauVaoGiaoDich; snapshot: SnapshotIntake; deXuat: DeXuatLuuIntake } {
  const snapshot = parseSnapshot(row.mac_dinh_snapshot)
  const deXuat = parseDeXuat(row.de_xuat)
  const thayDoi = dungMacDinh ? {} : deXuat.thayDoi ?? {}
  const hinhThuc = thayDoi.hinhThuc ?? snapshot.hinhThuc
  const donViId = thayDoi.donViId ?? snapshot.donViId
  const thanhToan = hinhThuc === HINH_THUC.HOAN_TAM_UNG
    ? HINH_THUC_THANH_TOAN.HOAN_TAM_UNG
    : thayDoi.hinhThucThanhToan ?? snapshot.hinhThucThanhToan
  const lamTronXuongHangNghin = lamTronXuongHangNghinMacDinh(hinhThuc, thanhToan)
  const data = schemaGiaoDich.parse({
    ngay: deXuat.ngay,
    ngay_de_nghi: ngayDeNghiMacDinh(deXuat.ngay),
    noi_dung: '',
    don_vi_id: donViId,
    ky_hieu_hd: dungMacDinh ? deXuat.kyHieuHd : (thayDoi.kyHieuHd ?? deXuat.kyHieuHd),
    so_hd: dungMacDinh ? deXuat.soHd : (thayDoi.soHd ?? deXuat.soHd),
    loai_hd: nhanLoaiHdIntake(deXuat.loaiHd),
    trang_thai_hd: deXuat.trangThaiHd,
    hinh_thuc: hinhThuc,
    tong_tien: deXuat.tongTien,
    tien_ruou_bia: deXuat.tienRuouBia,
    tien_duoc_thanh_toan: soTienThanhToan({
      tongTien: deXuat.tongTien,
      tienRuouBia: deXuat.tienRuouBia,
      lamTronXuongHangNghin,
    }),
    tien_duoc_thanh_toan_goc: Math.max(0, deXuat.tongTien - deXuat.tienRuouBia),
    lam_tron_xuong_hang_nghin: lamTronXuongHangNghin,
    tam_ung_tu_cq: 0,
    giao_tien_chi_thuy: 0,
    hoan_ung_tien_mat: 0,
    nguoi_lay_hd_id: thayDoi.nguoiLayHdId ?? snapshot.nguoiLayHdId,
    phi_lay_hd_ghi_de: null,
    co_tinh_phi_lay_hd: hinhThuc === HINH_THUC.HOAN_TAM_UNG,
    trang_thai_tt_phi: snapshot.trangThaiTtPhi,
    ghi_chu: null,
    hinh_thuc_thanh_toan: thanhToan,
  })
  return { data, snapshot, deXuat }
}

export async function taoIntakeHoaDon(input: {
  nguon: 'telegram' | 'scan'
  idempotencyKey: string
  chatTelegramId?: string | null
  userTelegramId?: string | null
  messageId?: string | null
  deXuat: DeXuatIntake
  snapshot: SnapshotIntake
  tep: File
}): Promise<{ row: IntakeRow; moi: boolean }> {
  const existing = await timIntakeTheoIdempotency(input.nguon, input.idempotencyKey)
  if (existing) return { row: existing, moi: false }
  const tep = await luuTepIntake(input.tep)
  try {
    const { rows } = await db.query<IntakeRow>(`insert into intake_hoa_don (
      nguon, chat_telegram_id, user_telegram_id, message_id, idempotency_key, nguoi_dung_id,
      tep_tam_duong_dan, tep_tam_ten_goc, tep_tam_kich_thuoc, tep_tam_mime,
      de_xuat, mac_dinh_snapshot, het_han
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,now() + ($13 * interval '1 second')) returning *`, [
      input.nguon, input.chatTelegramId ?? null, input.userTelegramId ?? null, input.messageId ?? null, input.idempotencyKey,
      input.snapshot.nguoiDungId, tep.duongDan, tep.tenGoc, tep.kichThuoc, tep.mime,
      JSON.stringify(input.deXuat), JSON.stringify(input.snapshot), input.snapshot.timeoutGiay,
    ])
    return { row: rows[0], moi: true }
  } catch (error) {
    await xoaTepIntake(tep.duongDan)
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      const row = await timIntakeTheoIdempotency(input.nguon, input.idempotencyKey)
      if (row) return { row, moi: false }
    }
    throw error
  }
}

export async function timIntake(id: string): Promise<IntakeRow | null> {
  const { rows } = await db.query<IntakeRow>('select * from intake_hoa_don where id=$1', [id])
  return rows[0] ?? null
}

export async function timIntakeTheoIdempotency(nguon: string, key: string): Promise<IntakeRow | null> {
  const { rows } = await db.query<IntakeRow>('select * from intake_hoa_don where nguon=$1 and idempotency_key=$2', [nguon, key])
  return rows[0] ?? null
}

export async function capNhatDeXuat(row: IntakeRow, thayDoi: ThayDoiIntake): Promise<IntakeRow> {
  const deXuat = parseDeXuat(row.de_xuat)
  const current = deXuat.thayDoi ?? {}
  const next = { ...current, ...thayDoi }
  const { rows } = await db.query<IntakeRow>(
    "update intake_hoa_don set de_xuat=$2::jsonb, loi=null, trang_thai='cho_phan_hoi', sua_luc=now() where id=$1 and trang_thai in ('cho_phan_hoi','loi') returning *",
    [row.id, JSON.stringify({ ...deXuat, thayDoi: next })],
  )
  if (!rows[0]) throw new Error('Intake đã được xử lý hoặc không tồn tại.')
  return rows[0]
}

export async function huyIntake(id: string): Promise<IntakeRow | null> {
  const { rows } = await db.query<IntakeRow>(
    "update intake_hoa_don set trang_thai='huy', sua_luc=now() where id=$1 and trang_thai in ('cho_phan_hoi','loi') returning *", [id])
  if (rows[0]) await xoaTepIntake(rows[0].tep_tam_duong_dan)
  return rows[0] ?? null
}

async function claimIntake(id: string): Promise<IntakeRow | null> {
  const { rows } = await db.query<IntakeRow>(
    "update intake_hoa_don set trang_thai='dang_xu_ly', sua_luc=now() where id=$1 and trang_thai in ('cho_phan_hoi','loi') returning *", [id])
  return rows[0] ?? null
}

async function traLaiChoPhanHoi(id: string, loi?: string, canhBaoFingerprint?: string): Promise<void> {
  const row = await timIntake(id)
  if (!row) return
  const deXuat = parseDeXuat(row.de_xuat)
  const next = canhBaoFingerprint ? { ...(deXuat.thayDoi ?? {}), canhBaoFingerprint } : deXuat.thayDoi
  await db.query("update intake_hoa_don set trang_thai='cho_phan_hoi', loi=$2, de_xuat=$3::jsonb, sua_luc=now() where id=$1", [
    id, loi ?? null, JSON.stringify({ ...deXuat, ...(next ? { thayDoi: next } : {}) }),
  ])
}

async function luuIntakeDaClaim(row: IntakeRow, dungMacDinh: boolean, tuLuuHetHan: boolean): Promise<KetQuaTaoGiaoDich & { row?: IntakeRow }> {
  try {
    const { data, snapshot, deXuat } = giaoDichTuIntake(row, dungMacDinh)
    const file = await docTepIntake(row)
    let result = await taoGiaoDichDaParse(data, {
      actorId: snapshot.nguoiDungId,
      actorName: snapshot.nguoiDungTen,
      tepHoaDon: file,
      lapGiay: false,
      xacNhanHoanTamUng: tuLuuHetHan || (!dungMacDinh && Boolean(deXuat.thayDoi?.canhBaoFingerprint)),
      fingerprintHoanTamUng: dungMacDinh ? null : (deXuat.thayDoi?.canhBaoFingerprint ?? null),
    })
    if (result.canhBao && tuLuuHetHan) {
      result = await taoGiaoDichDaParse(data, {
        actorId: snapshot.nguoiDungId,
        actorName: snapshot.nguoiDungTen,
        tepHoaDon: file,
        lapGiay: false,
        xacNhanHoanTamUng: true,
        fingerprintHoanTamUng: result.canhBao.fingerprint,
      })
    }
    if (result.canhBao) {
      await traLaiChoPhanHoi(row.id, 'Cần xác nhận cảnh báo số dư.', result.canhBao.fingerprint)
      return result
    }
    if (result.loi) {
      await db.query("update intake_hoa_don set trang_thai='loi', loi=$2, sua_luc=now() where id=$1", [row.id, result.loi])
      return result
    }
    await db.query(`update intake_hoa_don set trang_thai=$2, giao_dich_id=$3,
      tep_tam_duong_dan=${result.loiTep ? 'tep_tam_duong_dan' : 'null'},
      tep_tam_ten_goc=${result.loiTep ? 'tep_tam_ten_goc' : 'null'},
      tep_tam_kich_thuoc=${result.loiTep ? 'tep_tam_kich_thuoc' : 'null'},
      tep_tam_mime=${result.loiTep ? 'tep_tam_mime' : 'null'},
      loi=$4, sua_luc=now() where id=$1`, [
      row.id, tuLuuHetHan ? 'tu_luu_het_han' : 'da_luu', result.giaoDichId, result.loiTep ?? null,
    ])
    if (!result.loiTep) await xoaTepIntake(row.tep_tam_duong_dan)
    return { ...result, row: await timIntake(row.id) ?? undefined }
  } catch (error) {
    const loi = error instanceof Error ? error.message : 'Không thể lưu intake.'
    await db.query("update intake_hoa_don set trang_thai='loi', loi=$2, sua_luc=now() where id=$1", [row.id, loi.slice(0, 500)])
    return { loi }
  }
}

export async function luuIntake(id: string, dungMacDinh: boolean, tuLuuHetHan = false): Promise<KetQuaTaoGiaoDich & { row?: IntakeRow }> {
  const before = await timIntake(id)
  if (!before || !['cho_phan_hoi', 'loi'].includes(before.trang_thai)) return { loi: 'Intake đã được xử lý.' }
  const row = await claimIntake(id)
  if (!row) return { loi: 'Intake đang được xử lý hoặc đã được xử lý.' }
  return luuIntakeDaClaim(row, dungMacDinh, tuLuuHetHan)
}

export async function timIntakeChoChat(chatTelegramId: string): Promise<IntakeRow | null> {
  const { rows } = await db.query<IntakeRow>(
    `select * from intake_hoa_don
     where chat_telegram_id=$1 and trang_thai in ('cho_phan_hoi','loi')
     order by tao_luc desc limit 1`, [chatTelegramId])
  return rows[0] ?? null
}

export type KetQuaHetHan = {
  row: IntakeRow
  result: KetQuaTaoGiaoDich & { row?: IntakeRow }
  tuLuu: boolean
}

export async function xuLyHetHanChiTiet(limit = 10): Promise<KetQuaHetHan[]> {
  const config = await docCauHinhIntake()
  const { rows } = await db.query<IntakeRow>(
    `with picked as (
       select id from intake_hoa_don
       where trang_thai='cho_phan_hoi' and het_han <= now()
       order by het_han limit $1 for update skip locked
     )
     update intake_hoa_don i set trang_thai='dang_xu_ly', sua_luc=now()
     from picked where i.id=picked.id returning i.*`, [limit])
  const result: KetQuaHetHan[] = []
  for (const row of rows) {
    if (config.tuLuuHetHan) {
      result.push({ row, result: await luuIntakeDaClaim(row, true, true), tuLuu: true })
    } else {
      const { rows: cancelled } = await db.query<IntakeRow>(
        "update intake_hoa_don set trang_thai='huy', loi='Hết thời gian chờ phản hồi.', sua_luc=now() where id=$1 and trang_thai='dang_xu_ly' returning *", [row.id])
      if (cancelled[0]) {
        await xoaTepIntake(cancelled[0].tep_tam_duong_dan)
        result.push({ row: cancelled[0], result: { loi: 'Hết thời gian chờ phản hồi.' }, tuLuu: false })
      }
    }
  }
  return result
}

export async function xuLyHetHan(limit = 10): Promise<number> {
  const rows = await xuLyHetHanChiTiet(limit)
  return rows.filter(item => item.result.giaoDichId || !item.tuLuu).length
}
