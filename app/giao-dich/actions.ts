'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { PoolClient } from 'pg'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaGiaoDich } from '@/lib/validation/giao-dich'
import { taoGiaoDichDaParse, type KetQuaTaoGiaoDich } from '@/lib/tai-chinh/tao-giao-dich'

import { LOAI_HD_HOA_DON } from '@/lib/tai-chinh/danh-muc'
import { canDonVi, coTinhPhiMacDinh, HINH_THUC_THANH_TOAN, hinhThucThanhToanMacDinh, hopLeHinhThucThanhToan, lamTronXuongHangNghinMacDinh, noiDungTheoDonVi, noiDungTheoHinhThuc } from '@/lib/tai-chinh/hinh-thuc'
import { chuanHoaGiaTri, apDungChoHinhThuc, timTruongSua } from '@/lib/tai-chinh/sua-giao-dich'
import { CO_SO_TINH_PHI, HINH_THUC, type CoSoTinhPhi } from '@/lib/tai-chinh/kieu'
import { khoaSoTaiChinh } from '@/lib/tai-chinh/xac-nhan-hoan-ung'
import { soTienThanhToan, tienTheoHoaDon } from '@/lib/tai-chinh/tien-thanh-toan'
import { ngayHienTaiBangkok } from '@/lib/tai-chinh/ngay'
import { giayChoHinhThuc, giayChinhChoHinhThuc } from '@/lib/tai-chinh/giay'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { giayCuaGiaoDich, MAU_WORD, timGiaoDichTinh } from '@/lib/tai-chinh/in-giay'
import { VAI_TRO_KY } from '@/lib/tai-chinh/vai-tro-ky'
import { capNhatTaiLieuGiay, docMau, LoiTaiLieuDangMo } from '@/lib/onlyoffice/tai-lieu'
import { taoGiayDocx } from '@/lib/tai-chinh/giay-docx'

export type KetQua = KetQuaTaoGiaoDich

const schemaId = z.string().uuid()
const schemaThongTinGiay = z.object({
  id: schemaId,
  nguoiDeNghiId: schemaId,
  lanhDaoTiepKhachId: schemaId.nullable(),
  lanhDaoThanhToanId: schemaId.nullable(),
  truongPhongId: schemaId.nullable(),
  keToanKiemSoatId: schemaId.nullable(),
})

type DongSua = {
  ngay: string | Date
  ngay_de_nghi: string | Date | null
  hinh_thuc: string
  chi_thuc_te?: boolean | string | null
  noi_dung: string
  don_vi_id: string | null
  ky_hieu_hd: string | null
  so_hd: string | null
  loai_hd: string | null
  trang_thai_hd: string
  tong_tien: number | string
  tien_ruou_bia: number | string
  tien_duoc_thanh_toan: number | string | null
  tien_duoc_thanh_toan_goc: number | string | null
  lam_tron_xuong_hang_nghin?: boolean | string | null
  tam_ung_tu_cq: number | string
  giao_tien_chi_thuy: number | string
  dua_tien_cq_tra_thang_cho_chi_thuy: number | string
  hoan_ung_tien_mat: number | string
  nguoi_lay_hd_id: string | null
  phi_lay_hd_ghi_de: number | string | null
  co_tinh_phi_lay_hd?: boolean | string | null
  co_so_tinh_phi_lay_hd?: CoSoTinhPhi | null
  trang_thai_tt_phi: string
  hinh_thuc_thanh_toan: string | null
  tai_khoan_nhan_so: string | null
  tai_khoan_nhan_ngan_hang: string | null
  tai_khoan_nhan_chi_nhanh: string | null
  tai_khoan_nhan_ten_chu_tk: string | null
}

type DongGiay = { hinh_thuc: string }

const tien = (value: unknown) => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 0 ? n : 0
}

const tienHoacNull = (value: unknown) => value === null || value === undefined ? null : tien(value)
const dung = (value: unknown) => value === true || value === 'true' || value === '1'

function ngayIso(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return String(value).slice(0, 10)
}

function tienNguonCuaDong(row: Pick<DongSua, 'tong_tien' | 'tien_ruou_bia' | 'tien_duoc_thanh_toan' | 'tien_duoc_thanh_toan_goc'>, tongTien = tien(row.tong_tien), tienRuouBia = tien(row.tien_ruou_bia)): number {
  return tienHoacNull(row.tien_duoc_thanh_toan_goc)
    ?? tienHoacNull(row.tien_duoc_thanh_toan)
    ?? tienTheoHoaDon({ tongTien, tienRuouBia })
}

const laHinhThucHoaDon = (hinhThuc: string) => hinhThuc === HINH_THUC.HOAN_TAM_UNG || hinhThuc === HINH_THUC.CQ_TRA_THANG

const loaiHdMacDinh = (hinhThuc: string) => {
  if (hinhThuc === HINH_THUC.TAM_UNG_THEM) return 'Phiếu chi CQ'
  if (hinhThuc === HINH_THUC.GIAO_CHI_THUY) return 'Giấy biên nhận'
  if (hinhThuc === HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY) return 'Giấy biên nhận'
  if (hinhThuc === HINH_THUC.NOP_HOAN_CQ) return 'Giấy nộp tiền'
  return LOAI_HD_HOA_DON[0]
}

const coTinhPhiDong = (row: DongSua) => row.co_tinh_phi_lay_hd === undefined || row.co_tinh_phi_lay_hd === null
  ? coTinhPhiMacDinh(row.hinh_thuc, row.trang_thai_tt_phi, dung(row.chi_thuc_te))
  : dung(row.co_tinh_phi_lay_hd)

const TRUONG_LAM_MOI_GIAY = new Set([
  'ngay', 'ngay_de_nghi', 'hinh_thuc', 'don_vi_id', 'ky_hieu_hd', 'so_hd',
  'tong_tien', 'tien_ruou_bia', 'tien_duoc_thanh_toan', 'lam_tron_xuong_hang_nghin',
  'nguoi_lay_hd_id', 'hinh_thuc_thanh_toan',
])

async function lamMoiGiayDangCo(
  client: PoolClient,
  userId: string,
  giaoDichId: string,
  phien: { id: string; ho_ten: string },
): Promise<void> {
  const { rows: taiLieu } = await client.query<{ loai: string }>(
    'select loai from tai_lieu where giao_dich_id=$1 and loai is not null for update', [giaoDichId])
  if (!taiLieu.length) return

  const giaoDich = await timGiaoDichTinh(giaoDichId, client)
  if (!giaoDich) throw new Error('Không đọc được giao dịch sau khi cập nhật.')
  const loaiDaCo = new Set(taiLieu.map(t => t.loai))
  const context = await boiCanhGiay(phien)
  const giayChinh = giayChinhChoHinhThuc(giaoDich.hinhThuc)
  const tatCaGiay = giayCuaGiaoDich(giaoDich, context)
  const canCapNhat: Array<{ loai: string; sinh: () => Promise<Buffer> }> = tatCaGiay
    .filter(g => g.loai === giayChinh && loaiDaCo.has(g.loai)).map(g => ({
      loai: g.loai,
      sinh: async () => taoGiayDocx(await docMau(MAU_WORD[g.loai], client), g, giaoDich),
    }))
  if (canCapNhat.length) await capNhatTaiLieuGiay(userId, giaoDichId, canCapNhat, client)
}

const maHoacNull = (formData: FormData, khoa: string) => {
  const raw = formData.get(khoa)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function layDuLieu(formData: FormData) {
  const get = (key: string) => {
    const val = formData.get(key)
    return val === null || val === '' ? null : val
  }
  return {
    ngay: get('ngay'), noi_dung: get('noi_dung'), don_vi_id: get('don_vi_id'),
    ky_hieu_hd: get('ky_hieu_hd'), so_hd: get('so_hd'), loai_hd: get('loai_hd'),
    trang_thai_hd: get('trang_thai_hd'), hinh_thuc: get('hinh_thuc'), chi_thuc_te: get('chi_thuc_te'),
    tong_tien: get('tong_tien') || 0, tien_ruou_bia: get('tien_ruou_bia') || 0,
    chi_tiet_hoa_don: get('chi_tiet_hoa_don'),
    tien_duoc_thanh_toan: get('tien_duoc_thanh_toan'), tien_duoc_thanh_toan_goc: get('tien_duoc_thanh_toan_goc'),
    ngay_de_nghi: get('ngay_de_nghi'),
    lam_tron_xuong_hang_nghin: get('lam_tron_xuong_hang_nghin'),
    tam_ung_tu_cq: get('tam_ung_tu_cq') || 0, giao_tien_chi_thuy: get('giao_tien_chi_thuy') || 0,
    dua_tien_cq_tra_thang_cho_chi_thuy: get('dua_tien_cq_tra_thang_cho_chi_thuy') || 0,
    hoan_ung_tien_mat: get('hoan_ung_tien_mat') || 0, nguoi_lay_hd_id: get('nguoi_lay_hd_id'),
    phi_lay_hd_ghi_de: get('phi_lay_hd_ghi_de'), co_tinh_phi_lay_hd: get('co_tinh_phi_lay_hd'),
    co_so_tinh_phi_lay_hd: get('co_so_tinh_phi_lay_hd') ?? undefined, trang_thai_tt_phi: get('trang_thai_tt_phi'),
    ghi_chu: get('ghi_chu'), hinh_thuc_thanh_toan: get('hinh_thuc_thanh_toan'),
    dung_tai_khoan_mac_dinh: get('dung_tai_khoan_mac_dinh'),
    tai_khoan_nhan_so: get('tai_khoan_nhan_so'),
    tai_khoan_nhan_ngan_hang: get('tai_khoan_nhan_ngan_hang'),
    tai_khoan_nhan_chi_nhanh: get('tai_khoan_nhan_chi_nhanh'),
    tai_khoan_nhan_ten_chu_tk: get('tai_khoan_nhan_ten_chu_tk'),
  }
}

export async function themGiaoDich(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const duLieu = layDuLieu(formData)
  const parsed = schemaGiaoDich.safeParse(duLieu)
  if (!parsed.success) {
    return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
  }
  const tepHoaDon = formData.get('tep_hoa_don')
  const ketQua = await taoGiaoDichDaParse(parsed.data, {
    actorId: phien.id,
    actorName: phien.ho_ten,
    tepHoaDon: tepHoaDon instanceof File ? tepHoaDon : null,
    lapGiay: formData.get('lap_giay') === '1',
    loaiGiay: formData.getAll('loai_giay').filter((loai): loai is string => typeof loai === 'string'),
    xacNhanHoanTamUng: formData.get('xac_nhan_hoan_tam_ung') === '1',
    fingerprintHoanTamUng: typeof formData.get('fingerprint_hoan_tam_ung') === 'string' ? String(formData.get('fingerprint_hoan_tam_ung')) : null,
    formData,
  })
  if (ketQua.canhBao || ketQua.loi) return ketQua
  revalidatePath('/giao-dich')
  revalidatePath('/dashboard')
  revalidatePath('/tep')
  if (ketQua.giaoDichId) revalidatePath(`/tep/${ketQua.giaoDichId}`)
  return { ...ketQua, thanhCong: 'Đã thêm giao dịch.' }
}

// Sửa đúng MỘT trường mỗi lần lưu. Tên cột lấy từ danh sách trắng TRUONG_SUA, không
// bao giờ lấy từ client; client chỉ gửi mã trường đã được đối chiếu với vai trò.
export async function suaGiaoDich(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const id = schemaId.safeParse(formData.get('id'))
  if (!id.success) return { loi: 'Mã giao dịch không hợp lệ.' }
  const truong = timTruongSua(formData.get('truong'))
  if (!truong) return { loi: 'Trường cần sửa không hợp lệ.' }
  if (truong.vaiTro === 'admin' && phien.vai_tro !== 'admin') {
    return { loi: `Chỉ quản trị viên được sửa "${truong.ten}".` }
  }
  const chuanHoa = chuanHoaGiaTri(truong, formData.get('gia_tri'))
  if (!chuanHoa.ok) return { loi: chuanHoa.loi }

  let ketQua: { loi: string } | { thanhCong: string }
  try {
    ketQua = await trongTransaction(phien.id, async (client) => {
      await khoaSoTaiChinh(client)
      const { rows } = await client.query<DongSua>(
        'select * from giao_dich where id=$1 and not da_xoa for update', [id.data])
      if (!rows.length) return { loi: 'Không tìm thấy giao dịch hoặc giao dịch đã bị xóa.' }
      const row = rows[0]
      const hinhThuc = row.hinh_thuc
      if (!apDungChoHinhThuc(truong, hinhThuc)) {
        return { loi: `Hình thức "${hinhThuc}" không có trường "${truong.ten}".` }
      }

      if (truong.id === 'ngay') {
        if (chuanHoa.giaTri === null) return { loi: 'Ngày phát sinh không được để trống.' }
        const hienTai = await client.query<{ ngay: string }>(
          "select to_char(ngay, 'YYYY-MM-DD') as ngay from giao_dich where id=$1", [id.data])
        // Ngày không đổi thì không ghi gì cả: một câu UPDATE vô ích vẫn sinh thêm một
        // dòng lịch sử và làm loãng đúng thứ mà người dùng đang muốn xem.
        if (hienTai.rows[0].ngay === chuanHoa.giaTri) return { thanhCong: 'Ngày phát sinh không thay đổi.' }
        // Số thứ tự chỉ có nghĩa trong một ngày. Giao dịch chuyển ngày được xếp vào cuối
        // ngày mới, đúng như khi thêm mới, để thứ tự trong ngày luôn xác định.
        const { rows } = await client.query<{ so_thu_tu: number }>(
          'select coalesce(max(so_thu_tu), 0) + 1 as so_thu_tu from giao_dich where ngay=$1 and not da_xoa and id<>$2',
          [chuanHoa.giaTri, id.data])
        // Ngày đề nghị là ngày lập giấy đã lưu, không chạy theo ngày hóa đơn.
        const ngayDeNghiCu = row.ngay_de_nghi == null ? null : ngayIso(row.ngay_de_nghi)
        const ngayDeNghiMoi = canDonVi(hinhThuc) ? (ngayDeNghiCu ?? ngayHienTaiBangkok()) : null
        await client.query('update giao_dich set ngay=$1, so_thu_tu=$2, ngay_de_nghi=$3, sua_luc=now(), nguoi_sua=$4 where id=$5',
          [chuanHoa.giaTri, rows[0].so_thu_tu, ngayDeNghiMoi, phien.id, id.data])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: `Đã chuyển giao dịch sang ngày ${chuanHoa.giaTri} và tính lại số dư.` }
      }

      if (truong.id === 'ngay_de_nghi') {
        const ngayMoi = String(chuanHoa.giaTri)
        const ngayCu = row.ngay_de_nghi === null ? null : ngayIso(row.ngay_de_nghi)
        if (ngayCu === ngayMoi) return { thanhCong: 'Ngày đề nghị không thay đổi.' }
        await client.query('update giao_dich set ngay_de_nghi=$1, sua_luc=now(), nguoi_sua=$2 where id=$3',
          [ngayMoi, phien.id, id.data])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: 'Đã cập nhật ngày đề nghị và làm mới giấy.' }
      }

      if (truong.id === 'hinh_thuc') {
        const hinhThucMoi = String(chuanHoa.giaTri)
        if (hinhThucMoi === hinhThuc) return { thanhCong: 'Hình thức giao dịch không thay đổi.' }

        const coHoaDonMoi = laHinhThucHoaDon(hinhThucMoi)
        const coHoaDonCu = laHinhThucHoaDon(hinhThuc)
        let donViId: string | null = null
        let noiDung: string
        if (coHoaDonMoi) {
          const rawDonVi = formData.get('don_vi_moi')
          const donViMoi = typeof rawDonVi === 'string' && rawDonVi.trim() ? rawDonVi.trim() : row.don_vi_id
          if (!donViMoi) return { loi: 'Hãy chọn đơn vị tiếp khách khi đổi sang hình thức có hóa đơn.' }
          const dv = await client.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [donViMoi])
          if (!dv.rows.length) return { loi: 'Đơn vị không tồn tại hoặc đã bị vô hiệu hóa.' }
          donViId = donViMoi
          noiDung = noiDungTheoDonVi(dv.rows[0].ten)
        } else {
          noiDung = noiDungTheoHinhThuc(hinhThucMoi) ?? hinhThucMoi
        }

        const chiThucTe = coHoaDonMoi && coHoaDonCu && dung(row.chi_thuc_te)
        const coTinhPhi = coHoaDonMoi
          ? (coHoaDonCu ? coTinhPhiDong(row) : hinhThucMoi === HINH_THUC.HOAN_TAM_UNG)
          : false
        const hinhThucThanhToan = coHoaDonMoi && coHoaDonCu && hopLeHinhThucThanhToan(hinhThucMoi, row.hinh_thuc_thanh_toan)
          && row.hinh_thuc_thanh_toan
          ? row.hinh_thuc_thanh_toan
          : hinhThucThanhToanMacDinh(hinhThucMoi)
        const lamTronXuongHangNghin = coHoaDonMoi && lamTronXuongHangNghinMacDinh(hinhThucMoi, hinhThucThanhToan)
        const taiKhoanGhiDe = hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN && coHoaDonMoi && coHoaDonCu
          ? {
              so: row.tai_khoan_nhan_so,
              nganHang: row.tai_khoan_nhan_ngan_hang,
              chiNhanh: row.tai_khoan_nhan_chi_nhanh,
              tenChuTk: row.tai_khoan_nhan_ten_chu_tk,
            }
          : { so: null, nganHang: null, chiNhanh: null, tenChuTk: null }
        const invoiceFields = coHoaDonMoi ? {
          kyHieuHd: coHoaDonCu ? row.ky_hieu_hd : null,
          soHd: coHoaDonCu ? row.so_hd : null,
          loaiHd: coHoaDonCu ? row.loai_hd || LOAI_HD_HOA_DON[0] : LOAI_HD_HOA_DON[0],
          trangThaiHd: coHoaDonCu ? row.trang_thai_hd || 'Hợp lệ' : 'Hợp lệ',
          tongTien: coHoaDonCu ? tien(row.tong_tien) : 0,
          tienRuouBia: coHoaDonCu ? Math.min(tien(row.tien_ruou_bia), tien(row.tong_tien)) : 0,
          tienDuocThanhToanGoc: coHoaDonCu
            ? tienNguonCuaDong(row, tien(row.tong_tien), Math.min(tien(row.tien_ruou_bia), tien(row.tong_tien)))
            : 0,
          nguoiLayHdId: coHoaDonCu ? row.nguoi_lay_hd_id : null,
          coSoTinhPhi: coHoaDonCu ? row.co_so_tinh_phi_lay_hd ?? CO_SO_TINH_PHI.TONG_TIEN : CO_SO_TINH_PHI.TONG_TIEN,
          phiLayHdGhiDe: coTinhPhi && coHoaDonCu ? (row.phi_lay_hd_ghi_de == null ? null : tien(row.phi_lay_hd_ghi_de)) : null,
          trangThaiTtPhi: coTinhPhi && coHoaDonCu ? row.trang_thai_tt_phi || 'Không phát sinh' : 'Không phát sinh',
        } : {
          kyHieuHd: null, soHd: null, loaiHd: loaiHdMacDinh(hinhThucMoi), trangThaiHd: 'Không có',
          tongTien: 0, tienRuouBia: 0, tienDuocThanhToanGoc: 0, nguoiLayHdId: null, coSoTinhPhi: CO_SO_TINH_PHI.TONG_TIEN, phiLayHdGhiDe: null, trangThaiTtPhi: 'Không phát sinh',
        }
        const tienDuocThanhToan = coHoaDonMoi
          ? soTienThanhToan({
              tongTien: invoiceFields.tongTien,
              tienRuouBia: invoiceFields.tienRuouBia,
              tienDuocThanhToanGoc: invoiceFields.tienDuocThanhToanGoc,
              lamTronXuongHangNghin,
            })
          : null
        const ngayDeNghi = coHoaDonMoi
          ? (coHoaDonCu && row.ngay_de_nghi ? ngayIso(row.ngay_de_nghi) : ngayHienTaiBangkok())
          : null
        // Đổi hình thức luôn xóa mọi khoản thuộc nguồn cũ. Khoản mới được nhập
        // riêng sau khi đổi, tránh vô tình chuyển tiền CQ trả thẳng sang tạm ứng.
        const dongTien = {
          tamUngTuCq: 0,
          giaoTienChiThuy: 0,
          duaTienCqTraThangChoChiThuy: 0,
          hoanUngTienMat: 0,
        }
        await client.query(`update giao_dich set
          hinh_thuc=$1, noi_dung=$2, don_vi_id=$3, ky_hieu_hd=$4, so_hd=$5, loai_hd=$6, trang_thai_hd=$7,
          tong_tien=$8, tien_ruou_bia=$9, tien_duoc_thanh_toan=$10, tien_duoc_thanh_toan_goc=$11,
          lam_tron_xuong_hang_nghin=$12, ngay_de_nghi=$13,
          tam_ung_tu_cq=$14, giao_tien_chi_thuy=$15, dua_tien_cq_tra_thang_cho_chi_thuy=$16, hoan_ung_tien_mat=$17,
          nguoi_lay_hd_id=$18, phi_lay_hd_ghi_de=$19, co_tinh_phi_lay_hd=$20, trang_thai_tt_phi=$21,
          hinh_thuc_thanh_toan=$22, tai_khoan_nhan_so=$23, tai_khoan_nhan_ngan_hang=$24,
          tai_khoan_nhan_chi_nhanh=$25, tai_khoan_nhan_ten_chu_tk=$26, chi_thuc_te=$29,
          co_so_tinh_phi_lay_hd=$30, sua_luc=now(), nguoi_sua=$27 where id=$28`, [
          hinhThucMoi, noiDung, donViId, invoiceFields.kyHieuHd, invoiceFields.soHd, invoiceFields.loaiHd, invoiceFields.trangThaiHd,
          invoiceFields.tongTien, invoiceFields.tienRuouBia, tienDuocThanhToan, invoiceFields.tienDuocThanhToanGoc,
          lamTronXuongHangNghin, ngayDeNghi,
          dongTien.tamUngTuCq, dongTien.giaoTienChiThuy, dongTien.duaTienCqTraThangChoChiThuy, dongTien.hoanUngTienMat,
          invoiceFields.nguoiLayHdId, invoiceFields.phiLayHdGhiDe, coTinhPhi, invoiceFields.trangThaiTtPhi,
          hinhThucThanhToan, taiKhoanGhiDe.so, taiKhoanGhiDe.nganHang, taiKhoanGhiDe.chiNhanh, taiKhoanGhiDe.tenChuTk,
          phien.id, id.data, chiThucTe, invoiceFields.coSoTinhPhi,
        ])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: 'Đã đổi hình thức giao dịch và làm sạch các trường không còn phù hợp.' }
      }

      if (truong.id === 'don_vi_id') {
        if (chuanHoa.giaTri === null) return { loi: 'Đơn vị tiếp khách không được để trống.' }
        const dv = await client.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [chuanHoa.giaTri])
        if (!dv.rows.length) return { loi: 'Đơn vị không tồn tại hoặc đã bị vô hiệu hóa.' }
        // Đổi đơn vị thì nội dung phải đi theo, nếu không nhật ký sẽ lệch tên đơn vị.
        await client.query('update giao_dich set don_vi_id=$1, noi_dung=$2, sua_luc=now(), nguoi_sua=$3 where id=$4',
          [chuanHoa.giaTri, noiDungTheoDonVi(dv.rows[0].ten), phien.id, id.data])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: `Đã cập nhật ${truong.ten.toLowerCase()} và nội dung.` }
      }

      if (truong.id === 'hinh_thuc_thanh_toan') {
        // Mỗi hình thức giao dịch chỉ dùng một phần giá trị: hoàn tạm ứng luôn in
        // "Hoàn tạm ứng", cơ quan trả thẳng chọn tiền mặt hoặc chuyển khoản.
        if (!hopLeHinhThucThanhToan(hinhThuc, chuanHoa.giaTri)) {
          return { loi: `Hình thức "${hinhThuc}" không dùng hình thức thanh toán này.` }
        }
        const hinhThucThanhToan = typeof chuanHoa.giaTri === 'string' && chuanHoa.giaTri
          ? chuanHoa.giaTri
          : hinhThucThanhToanMacDinh(hinhThuc)
        const dungChuyenKhoan = hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN
        const lamTronXuongHangNghin = lamTronXuongHangNghinMacDinh(hinhThuc, hinhThucThanhToan)
        const tienDuocThanhToanGoc = canDonVi(hinhThuc)
          ? tienNguonCuaDong(row)
          : null
        const tienDuocThanhToan = canDonVi(hinhThuc)
          ? soTienThanhToan({
              tongTien: tien(row.tong_tien),
              tienRuouBia: tien(row.tien_ruou_bia),
              tienDuocThanhToanGoc,
              lamTronXuongHangNghin,
            })
          : null
        await client.query(`update giao_dich set hinh_thuc_thanh_toan=$1,
          lam_tron_xuong_hang_nghin=$2, tien_duoc_thanh_toan=$3, tien_duoc_thanh_toan_goc=$4,
          tai_khoan_nhan_so=$5, tai_khoan_nhan_ngan_hang=$6, tai_khoan_nhan_chi_nhanh=$7,
          tai_khoan_nhan_ten_chu_tk=$8, sua_luc=now(), nguoi_sua=$9 where id=$10`, [
          hinhThucThanhToan, lamTronXuongHangNghin, tienDuocThanhToan, tienDuocThanhToanGoc,
          dungChuyenKhoan ? row.tai_khoan_nhan_so : null,
          dungChuyenKhoan ? row.tai_khoan_nhan_ngan_hang : null,
          dungChuyenKhoan ? row.tai_khoan_nhan_chi_nhanh : null,
          dungChuyenKhoan ? row.tai_khoan_nhan_ten_chu_tk : null,
          phien.id, id.data,
        ])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: 'Đã cập nhật hình thức thanh toán.' }
      }

      const dangTinhPhi = coTinhPhiDong(row)
      if (truong.id === 'tong_tien' || truong.id === 'tien_ruou_bia') {
        const tongTien = truong.id === 'tong_tien' ? Number(chuanHoa.giaTri) : tien(row.tong_tien)
        const tienRuouBia = truong.id === 'tien_ruou_bia' ? Number(chuanHoa.giaTri) : tien(row.tien_ruou_bia)
        if (tienRuouBia > tongTien) return { loi: 'Tiền không được thanh toán không được vượt tổng tiền.' }
        const tienDuocThanhToanGoc = tienTheoHoaDon({ tongTien, tienRuouBia })
        const tienDuocThanhToan = soTienThanhToan({
          tongTien, tienRuouBia, tienDuocThanhToanGoc,
          lamTronXuongHangNghin: dung(row.lam_tron_xuong_hang_nghin),
        })
        await client.query(`update giao_dich set tong_tien=$1, tien_ruou_bia=$2,
          tien_duoc_thanh_toan=$3, tien_duoc_thanh_toan_goc=$4, sua_luc=now(), nguoi_sua=$5 where id=$6`, [
          tongTien, tienRuouBia, tienDuocThanhToan, tienDuocThanhToanGoc, phien.id, id.data,
        ])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: `Đã cập nhật ${truong.ten.toLowerCase()} và tính lại tiền được hoàn/thanh toán.` }
      }
      if (truong.id === 'tien_duoc_thanh_toan') {
        const tienDuocThanhToanGoc = Number(chuanHoa.giaTri)
        const tienDuocThanhToan = soTienThanhToan({
          tongTien: tien(row.tong_tien),
          tienRuouBia: tien(row.tien_ruou_bia),
          tienDuocThanhToanGoc,
          lamTronXuongHangNghin: dung(row.lam_tron_xuong_hang_nghin),
        })
        await client.query('update giao_dich set tien_duoc_thanh_toan=$1, tien_duoc_thanh_toan_goc=$2, sua_luc=now(), nguoi_sua=$3 where id=$4',
          [tienDuocThanhToan, tienDuocThanhToanGoc, phien.id, id.data])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: 'Đã cập nhật tiền được hoàn/thanh toán.' }
      }
      if (truong.id === 'lam_tron_xuong_hang_nghin') {
        const lamTronXuongHangNghin = chuanHoa.giaTri === '1'
        const tienDuocThanhToanGoc = tienNguonCuaDong(row)
        const tienDuocThanhToan = soTienThanhToan({
          tongTien: tien(row.tong_tien),
          tienRuouBia: tien(row.tien_ruou_bia),
          tienDuocThanhToanGoc,
          lamTronXuongHangNghin,
        })
        await client.query(`update giao_dich set tien_duoc_thanh_toan=$1, tien_duoc_thanh_toan_goc=$2,
          lam_tron_xuong_hang_nghin=$3, sua_luc=now(), nguoi_sua=$4 where id=$5`, [
          tienDuocThanhToan, tienDuocThanhToanGoc, lamTronXuongHangNghin, phien.id, id.data,
        ])
        await lamMoiGiayDangCo(client, phien.id, id.data, phien)
        return { thanhCong: lamTronXuongHangNghin ? 'Đã làm tròn xuống hàng nghìn.' : 'Đã tắt làm tròn xuống hàng nghìn.' }
      }
      if (truong.id === 'chi_thuc_te') {
        const bat = chuanHoa.giaTri === '1'
        if (bat === dung(row.chi_thuc_te)) return { thanhCong: 'Lựa chọn Chi thực tế không thay đổi.' }
        await client.query(`update giao_dich set chi_thuc_te=$1,
          co_tinh_phi_lay_hd=$2, phi_lay_hd_ghi_de=$3, trang_thai_tt_phi=$4,
          sua_luc=now(), nguoi_sua=$5 where id=$6`, [
          bat, bat ? false : dangTinhPhi, bat ? null : row.phi_lay_hd_ghi_de,
          bat ? 'Không phát sinh' : row.trang_thai_tt_phi, phien.id, id.data,
        ])
        return { thanhCong: bat ? 'Đã bật Chi thực tế và tắt tính phí hóa đơn.' : 'Đã tắt Chi thực tế.' }
      }
      if (truong.id === 'co_tinh_phi_lay_hd') {
        const bat = chuanHoa.giaTri === '1'
        await client.query('update giao_dich set co_tinh_phi_lay_hd=$1, phi_lay_hd_ghi_de=$2, trang_thai_tt_phi=$3, sua_luc=now(), nguoi_sua=$4 where id=$5',
          [bat, bat ? row.phi_lay_hd_ghi_de : null, bat ? row.trang_thai_tt_phi : 'Không phát sinh', phien.id, id.data])
        return { thanhCong: bat ? 'Đã bật tính phí hóa đơn.' : 'Đã tắt tính phí hóa đơn.' }
      }
      if (truong.id === 'phi_lay_hd_ghi_de' && !dangTinhPhi && chuanHoa.giaTri !== null) {
        return { loi: 'Giao dịch đang chọn Không tính phí hóa đơn. Hãy bật tính phí trước khi nhập phí ghi đè.' }
      }
      if (truong.id === 'trang_thai_tt_phi' && !dangTinhPhi && chuanHoa.giaTri !== 'Không phát sinh') {
        return { loi: 'Giao dịch đang chọn Không tính phí hóa đơn. Hãy bật tính phí trước khi đổi trạng thái thanh toán.' }
      }

      if (truong.id === 'nguoi_lay_hd_id' && chuanHoa.giaTri !== null) {
        const nlh = await client.query('select 1 from nguoi_lay_hd where id=$1', [chuanHoa.giaTri])
        if (!nlh.rows.length) return { loi: 'Người lấy hóa đơn không tồn tại.' }
      }
      await client.query(`update giao_dich set ${truong.id}=$1, sua_luc=now(), nguoi_sua=$2 where id=$3`,
        [chuanHoa.giaTri, phien.id, id.data])
      if (TRUONG_LAM_MOI_GIAY.has(truong.id)) await lamMoiGiayDangCo(client, phien.id, id.data, phien)
      return { thanhCong: `Đã cập nhật ${truong.ten.toLowerCase()}.` }
    })
    if ('loi' in ketQua) return ketQua
  } catch (error) {
    if (error instanceof LoiTaiLieuDangMo) {
      return { loi: 'Có giấy đang mở trong OnlyOffice. Hãy đóng trình soạn thảo của giao dịch này rồi lưu lại.' }
    }
    console.error('Không thể sửa giao dịch.')
    return { loi: 'Không thể lưu thay đổi. Kiểm tra ràng buộc số tiền, ví dụ tiền không được thanh toán không được vượt tổng tiền.' }
  }
  revalidatePath('/giao-dich')
  revalidatePath('/dashboard')
  revalidatePath(`/giay/${id.data}`)
  return ketQua
}

// Thông tin giấy là một nhóm dữ liệu phải đổi cùng lúc: nếu lưu từng ô như nhật ký
// thông thường, các giấy đang có có thể lấy người ký từ hai lần lưu khác nhau.
export async function suaThongTinGiayGiaoDich(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const parsed = schemaThongTinGiay.safeParse({
    id: formData.get('id'),
    nguoiDeNghiId: maHoacNull(formData, 'giay_nguoiDeNghiId'),
    lanhDaoTiepKhachId: maHoacNull(formData, 'giay_lanhDaoTiepKhachId'),
    lanhDaoThanhToanId: maHoacNull(formData, 'giay_lanhDaoThanhToanId'),
    truongPhongId: maHoacNull(formData, 'giay_truongPhongId'),
    keToanKiemSoatId: maHoacNull(formData, 'giay_keToanKiemSoatId'),
  })
  if (!parsed.success) {
    return { loi: parsed.error.issues[0]?.path[0] === 'id'
      ? 'Mã giao dịch không hợp lệ.'
      : 'Thông tin người ký không hợp lệ. Vui lòng chọn người đề nghị.' }
  }

  let context
  try {
    context = await boiCanhGiay(phien)
  } catch {
    return { loi: 'Không tải được thông tin giấy đề nghị. Vui lòng thử lại.' }
  }

  let ketQua: { loi: string } | { thanhCong: string }
  try {
    ketQua = await trongTransaction(phien.id, async (client) => {
      const { rows } = await client.query<DongGiay>(
        'select hinh_thuc from giao_dich where id=$1 and not da_xoa for update', [parsed.data.id])
      const dong = rows[0]
      if (!dong) return { loi: 'Không tìm thấy giao dịch hoặc giao dịch đã bị xóa.' }
      if (!giayChoHinhThuc(dong.hinh_thuc).length) return { loi: 'Hình thức giao dịch này không lập giấy đề nghị.' }

      const nguoiKy = VAI_TRO_KY.map(vai => parsed.data[vai.id]).filter((ma): ma is string => ma !== null)
      const maKhongTrung = [...new Set(nguoiKy)]
      const { rows: canBo } = await client.query<{ id: string }>(
        'select id from can_bo where dang_hoat_dong and id = any($1::uuid[])', [maKhongTrung])
      if (canBo.length !== maKhongTrung.length) {
        return { loi: 'Có người ký không tồn tại hoặc đã ngừng hoạt động. Vui lòng tải lại và chọn lại.' }
      }

      await client.query(`update giao_dich set
        nguoi_de_nghi_id=$1, lanh_dao_tiep_khach_id=$2, lanh_dao_thanh_toan_id=$3,
        truong_phong_id=$4, ke_toan_kiem_soat_id=$5, thong_tin_giay_da_chot=true,
        sua_luc=now(), nguoi_sua=$6 where id=$7`, [
        parsed.data.nguoiDeNghiId, parsed.data.lanhDaoTiepKhachId, parsed.data.lanhDaoThanhToanId,
        parsed.data.truongPhongId, parsed.data.keToanKiemSoatId, phien.id, parsed.data.id,
      ])

      const giaoDich = await timGiaoDichTinh(parsed.data.id, client)
      if (!giaoDich) throw new Error('Không đọc được giao dịch sau khi cập nhật thông tin giấy.')
      const giay = giayCuaGiaoDich(giaoDich, context)
      const canCapNhat: Array<{ loai: string; sinh: () => Promise<Buffer> }> = giay
        .filter(g => g.loai === giayChinhChoHinhThuc(giaoDich.hinhThuc))
        .map(g => ({
          loai: g.loai,
          sinh: async () => taoGiayDocx(await docMau(MAU_WORD[g.loai], client), g, giaoDich),
        }))
      await capNhatTaiLieuGiay(phien.id, parsed.data.id, canCapNhat, client)
      return { thanhCong: 'Đã lưu thông tin giấy đề nghị và làm mới tài liệu Word.' }
    })
  } catch (error) {
    if (error instanceof LoiTaiLieuDangMo) {
      return { loi: 'Có giấy đang mở trong OnlyOffice. Hãy đóng trình soạn thảo của giao dịch này rồi lưu lại.' }
    }
    console.error('Không thể cập nhật thông tin giấy đề nghị.')
    return { loi: 'Không thể lưu thông tin giấy đề nghị hoặc làm mới tài liệu Word.' }
  }
  if ('loi' in ketQua) return ketQua
  revalidatePath('/giao-dich')
  revalidatePath('/dashboard')
  revalidatePath(`/giay/${parsed.data.id}`)
  return ketQua
}

export async function xoaMemGiaoDich(id: string): Promise<void> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  await trongTransaction(phien.id, async (client) => {
    await khoaSoTaiChinh(client)
    await client.query(`update giao_dich set da_xoa=true, xoa_luc=now(), nguoi_xoa=$1,
      sua_luc=now(), nguoi_sua=$1 where id=$2 and not da_xoa`, [phien.id, id])
  })
  revalidatePath('/giao-dich')
  revalidatePath('/dashboard')
}
