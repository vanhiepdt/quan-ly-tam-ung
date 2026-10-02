'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db/pool'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { HINH_THUC } from '@/lib/tai-chinh/kieu'
import { HINH_THUC_THANH_TOAN } from '@/lib/tai-chinh/hinh-thuc'
import { donViMacDinh, type DonViTiepKhach } from '@/lib/tai-chinh/don-vi'
import {
  INTAKE_TIMEOUT_MAX,
  INTAKE_TIMEOUT_MIN,
  allowlistLines,
  anKhoaIntake,
  bamAgentToken,
  capNhatTrangThaiWebhook,
  docCauHinhIntake,
  layTelegramBotToken,
  luuCauHinhIntake as luuCauHinhIntakeDb,
  maHoaBiMat,
  parseAllowlistLines,
  type CauHinhIntake,
  type DuLieuCauHinhIntake,
} from '@/lib/intake/cau-hinh'
import { telegramSetWebhook } from '@/lib/intake/telegram'

export type KetQuaIntakeCaiDat = { loi?: string; thanhCong?: string; agentTokenMoi?: string }

export type DuLieuIntakeCaiDat = DuLieuCauHinhIntake & {
  allowlistText: string
  webhookUrl: string
  soIntakeCho: number
  nguoiDung: Array<{ id: string; ten: string; vaiTro: string }>
  donVi: Array<{ id: string; ten: string }>
  nguoiLayHd: Array<{ id: string; ten: string }>
}

const schema = z.object({
  dangBot: z.boolean(),
  dangAgent: z.boolean(),
  tuLuuHetHan: z.boolean(),
  timeoutGiay: z.coerce.number().int().min(INTAKE_TIMEOUT_MIN).max(INTAKE_TIMEOUT_MAX),
  hinhThucMacDinh: z.enum([HINH_THUC.HOAN_TAM_UNG, HINH_THUC.CQ_TRA_THANG]),
  donViIdMacDinh: z.string().uuid('Đơn vị mặc định không hợp lệ.'),
  hinhThucThanhToanMacDinh: z.enum([HINH_THUC_THANH_TOAN.TIEN_MAT, HINH_THUC_THANH_TOAN.CHUYEN_KHOAN]),
  nguoiDungHeThongId: z.string().uuid('User hệ thống không hợp lệ.'),
  allowlistText: z.string().max(10_000),
  botToken: z.string().trim().max(500),
  xoaBotToken: z.boolean(),
})

function linesValid(text: string): boolean {
  return text.split(/\r?\n/).every(line => {
    const value = line.trim()
    return !value || /^(user|chat):\S{1,80}$/.test(value)
  })
}

async function kiemTraThamChieu(d: z.infer<typeof schema>): Promise<string | null> {
  const [user, unit] = await Promise.all([
    db.query<{ id: string }>("select id from nguoi_dung where id=$1 and dang_hoat_dong and vai_tro in ('admin','nhap_lieu')", [d.nguoiDungHeThongId]),
    db.query<{ id: string }>('select id from don_vi where id=$1 and dang_hoat_dong', [d.donViIdMacDinh]),
  ])
  if (!user.rows[0]) return 'User hệ thống phải là tài khoản đang hoạt động và có quyền nhập liệu.'
  if (!unit.rows[0]) return 'Đơn vị mặc định không tồn tại hoặc đã bị vô hiệu hóa.'
  return null
}

export async function docDuLieuCauHinhIntake(): Promise<DuLieuIntakeCaiDat> {
  await batBuocVaiTro('admin')
  const config = await docCauHinhIntake()
  const [{ rows: nguoiDung }, { rows: donVi }, { rows: nguoiLayHd }, { rows: pending }] = await Promise.all([
    db.query<{ id: string; ho_ten: string; vai_tro: string }>("select id, ho_ten, vai_tro from nguoi_dung where dang_hoat_dong and vai_tro in ('admin','nhap_lieu') order by ho_ten"),
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
    db.query<{ id: string; ten: string }>('select id, ten from nguoi_lay_hd where dang_hoat_dong order by ten'),
    db.query<{ so_luong: number }>("select count(*)::int as so_luong from intake_hoa_don where trang_thai='cho_phan_hoi'"),
  ])
  const donViTheoCauHinh = donVi.find(item => item.id === config.donViIdMacDinh)
  const donViIdMacDinh = donViTheoCauHinh?.id
    ?? donViMacDinh(donVi)?.id
    ?? null
  const nguoiDungTheoCauHinh = nguoiDung.find(item => item.id === config.nguoiDungHeThongId)
  const nguoiDungHeThongId = nguoiDungTheoCauHinh?.id
    ?? (nguoiDung.length === 1 ? nguoiDung[0]?.id ?? null : null)
  return {
    ...anKhoaIntake({ ...config, donViIdMacDinh, nguoiDungHeThongId }),
    allowlistText: allowlistLines(config.allowlist),
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL?.trim() || 'https://hc.ttdt.site/api/telegram/webhook',
    soIntakeCho: pending[0]?.so_luong ?? 0,
    nguoiDung: nguoiDung.map(row => ({ id: row.id, ten: row.ho_ten, vaiTro: row.vai_tro })),
    donVi,
    nguoiLayHd,
  }
}

export async function luuCauHinhIntake(_: KetQuaIntakeCaiDat, formData: FormData): Promise<KetQuaIntakeCaiDat> {
  await batBuocVaiTro('admin')
  const parsed = schema.safeParse({
    dangBot: formData.get('dang_bot') === '1',
    dangAgent: formData.get('dang_agent') === '1',
    tuLuuHetHan: formData.get('tu_luu_het_han') === '1',
    timeoutGiay: formData.get('timeout_giay'),
    hinhThucMacDinh: formData.get('hinh_thuc_mac_dinh'),
    donViIdMacDinh: formData.get('don_vi_id_mac_dinh'),
    hinhThucThanhToanMacDinh: formData.get('hinh_thuc_thanh_toan_mac_dinh'),
    nguoiDungHeThongId: formData.get('nguoi_dung_he_thong_id'),
    allowlistText: formData.get('allowlist') ?? '',
    botToken: typeof formData.get('bot_token') === 'string' ? String(formData.get('bot_token')) : '',
    xoaBotToken: formData.get('xoa_bot_token') === '1',
  })
  if (!parsed.success) return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu cài đặt không hợp lệ.' }
  const d = parsed.data
  if (!linesValid(d.allowlistText)) return { loi: 'Allowlist phải ghi mỗi dòng theo dạng user:ID hoặc chat:ID.' }
  const allowlist = parseAllowlistLines(d.allowlistText)
  if (d.dangBot && !allowlist.length) return { loi: 'Khi bật bot phải có ít nhất một dòng allowlist.' }
  const thamChieuLoi = await kiemTraThamChieu(d)
  if (thamChieuLoi) return { loi: thamChieuLoi }
  const current = await docCauHinhIntake()
  let botTokenMaHoa = current.botTokenMaHoa
  try {
    if (d.xoaBotToken) botTokenMaHoa = ''
    else if (d.botToken) botTokenMaHoa = maHoaBiMat(d.botToken)
  } catch (error) {
    return { loi: error instanceof Error ? `${error.message} Hãy thêm biến này vào .env.local/.env rồi khởi động lại máy chủ.` : 'Không lưu được token bot.' }
  }
  if (d.dangBot && !botTokenMaHoa && !process.env.TELEGRAM_BOT_TOKEN?.trim()) return { loi: 'Hãy nhập token bot hoặc cấu hình TELEGRAM_BOT_TOKEN trên máy chủ.' }
  if (d.dangAgent && !current.agentTokenHash) return { loi: 'Hãy tạo token agent trước khi bật agent scan.' }
  const next: CauHinhIntake = {
    ...current,
    dangBot: d.dangBot,
    dangAgent: d.dangAgent,
    tuLuuHetHan: d.tuLuuHetHan,
    timeoutGiay: d.timeoutGiay,
    hinhThucMacDinh: d.hinhThucMacDinh,
    donViIdMacDinh: d.donViIdMacDinh,
    hinhThucThanhToanMacDinh: d.hinhThucThanhToanMacDinh,
    nguoiDungHeThongId: d.nguoiDungHeThongId,
    allowlist,
    botTokenMaHoa,
  }
  await luuCauHinhIntakeDb(next)
  revalidatePath('/cai-dat')
  return { thanhCong: 'Đã lưu cài đặt nhập hóa đơn.' }
}

export async function xoayTokenAgent(_: KetQuaIntakeCaiDat, formData: FormData): Promise<KetQuaIntakeCaiDat> {
  await batBuocVaiTro('admin')
  const confirm = formData.get('xac_nhan')
  if (confirm !== '1') return { loi: 'Hãy xác nhận tạo token agent mới.' }
  const config = await docCauHinhIntake()
  const token = randomBytes(32).toString('base64url')
  await luuCauHinhIntakeDb({ ...config, agentTokenHash: bamAgentToken(token) })
  revalidatePath('/cai-dat')
  return { thanhCong: 'Đã rotate token agent. Token cũ đã mất hiệu lực.', agentTokenMoi: token }
}

export async function datWebhookTelegram(_: KetQuaIntakeCaiDat, _formData: FormData): Promise<KetQuaIntakeCaiDat> {
  await batBuocVaiTro('admin')
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!secret) return { loi: 'Thiếu TELEGRAM_WEBHOOK_SECRET trên máy chủ. Hãy thêm vào .env.local/.env rồi khởi động lại máy chủ.' }
  const config = await docCauHinhIntake()
  const token = await layTelegramBotToken(config)
  if (!token) return { loi: 'Chưa có token bot Telegram.' }
  const url = process.env.TELEGRAM_WEBHOOK_URL?.trim() || 'https://hc.ttdt.site/api/telegram/webhook'
  try {
    await telegramSetWebhook(token, url, secret)
    await capNhatTrangThaiWebhook()
    revalidatePath('/cai-dat')
    return { thanhCong: `Đã đặt webhook: ${url}` }
  } catch {
    return { loi: 'Telegram không nhận webhook. Kiểm tra token, HTTPS và URL webhook.' }
  }
}
