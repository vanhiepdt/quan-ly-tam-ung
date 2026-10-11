import type { PoolClient } from 'pg'
import { trongTransaction } from '@/lib/db/pool'
import type { DauVaoGiaoDich } from '@/lib/validation/giao-dich'
import { canDonVi, coTinhPhiMacDinh, hinhThucThanhToanMacDinh, HINH_THUC_THANH_TOAN, lamTronXuongHangNghinMacDinh, noiDungTheoDonVi, noiDungTheoHinhThuc } from './hinh-thuc'
import { ngayDeNghiMacDinh } from './ngay'
import { khoaSoTaiChinh, kiemTraHoanTamUng, type CanhBaoHoanTamUng } from './xac-nhan-hoan-ung'
import { giayChoHinhThuc } from './giay'
import { giayCuaGiaoDich, timGiaoDichTinh, MAU_WORD } from './in-giay'
import { boiCanhGiay } from './cau-hinh-giay'
import { apDungNguoiDeNghiTheoForm, apDungNguoiKy, apDungNguoiKyMacDinh } from './chon-nguoi-ky'
import { VAI_TRO_KY } from './vai-tro-ky'
import type { BoiCanhGiay } from './giay'
import { taoHoacLayTaiLieu, docMau } from '@/lib/onlyoffice/tai-lieu'
import { dienMauDocx } from '@/lib/van-ban/docx'
import { ganTepVaoGiaoDich } from '@/lib/tep/gan'
import { taiKhoanTuNhap } from './tai-khoan'
import { soTienThanhToan, tienTheoHoaDon } from './tien-thanh-toan'
import { CO_SO_TINH_PHI, HINH_THUC } from './kieu'

export type KetQuaTaoGiaoDich = {
  loi?: string
  maLoi?: 'trung_hoa_don'
  thanhCong?: string
  canhBao?: CanhBaoHoanTamUng
  giaoDichId?: string
  loiGiay?: string
  loiTep?: string
  taiLieuIds?: string[]
}

export type TuyChonTaoGiaoDich = {
  actorId: string
  actorName: string
  tepHoaDon?: File | null
  formData?: FormData
  lapGiay?: boolean
  loaiGiay?: string[]
  xacNhanHoanTamUng?: boolean
  fingerprintHoanTamUng?: string | null
}

export class LoiDonVi extends Error {}

function laLoiTrungHoaDon(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

// Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới gắn đơn vị. Khi gắn thì nội dung do
// máy chủ sinh từ tên đơn vị; client không thể ép nội dung khác.
async function chuanHoaDonVi(
  client: Pick<PoolClient, 'query'>,
  hinhThuc: string,
  donViId: string | null,
  noiDung: string,
) {
  if (!canDonVi(hinhThuc)) return { donViId: null, noiDung: noiDungTheoHinhThuc(hinhThuc) ?? noiDung }
  if (!donViId) throw new LoiDonVi()
  const { rows } = await client.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [donViId])
  if (!rows.length) throw new LoiDonVi()
  return { donViId, noiDung: noiDungTheoDonVi(rows[0].ten) }
}

// Chỉ cột tiền thuộc đúng hình thức giao dịch mới được lưu. Đây là lớp bảo vệ
// phía máy chủ để form cũ hoặc request tự tạo không thể làm lẫn quỹ tạm ứng với
// khoản CQ trả thẳng vừa bổ sung.
function dongTienTheoHinhThuc(d: Pick<DauVaoGiaoDich,
  'hinh_thuc' | 'tam_ung_tu_cq' | 'giao_tien_chi_thuy' | 'dua_tien_cq_tra_thang_cho_chi_thuy' | 'hoan_ung_tien_mat'>) {
  const khong = {
    tam_ung_tu_cq: 0,
    giao_tien_chi_thuy: 0,
    dua_tien_cq_tra_thang_cho_chi_thuy: 0,
    hoan_ung_tien_mat: 0,
  }
  switch (d.hinh_thuc) {
    case HINH_THUC.TAM_UNG_THEM:
      return { ...khong, tam_ung_tu_cq: d.tam_ung_tu_cq }
    case HINH_THUC.GIAO_CHI_THUY:
      return { ...khong, giao_tien_chi_thuy: d.giao_tien_chi_thuy }
    case HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY:
      return { ...khong, dua_tien_cq_tra_thang_cho_chi_thuy: d.dua_tien_cq_tra_thang_cho_chi_thuy }
    case HINH_THUC.NOP_HOAN_CQ:
      return { ...khong, hoan_ung_tien_mat: d.hoan_ung_tien_mat }
    default:
      return khong
  }
}

export async function taoGiaoDichDaParse(
  d: DauVaoGiaoDich,
  options: TuyChonTaoGiaoDich,
): Promise<KetQuaTaoGiaoDich> {
  const dongTien = dongTienTheoHinhThuc(d)
  const trangThaiHd = d.trang_thai_hd || 'Không có'
  const chiThucTe = canDonVi(d.hinh_thuc) && d.chi_thuc_te === true
  const coTinhPhi = canDonVi(d.hinh_thuc) && (d.co_tinh_phi_lay_hd ?? coTinhPhiMacDinh(d.hinh_thuc, d.trang_thai_tt_phi, chiThucTe))
  const trangThaiTtPhi = coTinhPhi ? (d.trang_thai_tt_phi || 'Không phát sinh') : 'Không phát sinh'
  const phiLayHdGhiDe = coTinhPhi ? d.phi_lay_hd_ghi_de : null
  const coSoTinhPhi = canDonVi(d.hinh_thuc) ? d.co_so_tinh_phi_lay_hd : CO_SO_TINH_PHI.TONG_TIEN
  const hinhThucThanhToan = d.hinh_thuc_thanh_toan ?? hinhThucThanhToanMacDinh(d.hinh_thuc)
  const lamTronXuongHangNghin = canDonVi(d.hinh_thuc)
    && (d.lam_tron_xuong_hang_nghin ?? lamTronXuongHangNghinMacDinh(d.hinh_thuc, hinhThucThanhToan))
  const tienDuocThanhToanGoc = canDonVi(d.hinh_thuc)
    ? d.tien_duoc_thanh_toan_goc ?? d.tien_duoc_thanh_toan ?? tienTheoHoaDon({
        tongTien: d.tong_tien,
        tienRuouBia: d.tien_ruou_bia,
      })
    : null
  const tienDuocThanhToan = canDonVi(d.hinh_thuc)
    ? soTienThanhToan({
        tongTien: d.tong_tien,
        tienRuouBia: d.tien_ruou_bia,
        tienDuocThanhToanGoc: tienDuocThanhToanGoc,
        lamTronXuongHangNghin,
      })
    : null
  const ngayDeNghi = canDonVi(d.hinh_thuc) ? d.ngay_de_nghi ?? ngayDeNghiMacDinh(d.ngay) : null
  const taiKhoanNhanGhiDe = hinhThucThanhToan === HINH_THUC_THANH_TOAN.CHUYEN_KHOAN && d.dung_tai_khoan_mac_dinh === false
    ? taiKhoanTuNhap({
        soTaiKhoan: d.tai_khoan_nhan_so,
        nganHang: d.tai_khoan_nhan_ngan_hang,
        chiNhanh: d.tai_khoan_nhan_chi_nhanh,
        tenChuTk: d.tai_khoan_nhan_ten_chu_tk,
      })
    : null
  const lapGiay = options.lapGiay === true
  const chonGiay = options.loaiGiay ?? []

  if (lapGiay && !giayChoHinhThuc(d.hinh_thuc).length) return { loi: 'Hình thức này không lập giấy đề nghị.' }
  if (lapGiay && chonGiay.some(loai => !giayChoHinhThuc(d.hinh_thuc).some(g => g === loai))) {
    return { loi: 'Loại giấy không phù hợp với giao dịch.' }
  }

  // Cùng một resolver được dùng cho phần "Thông tin giấy đề nghị" trên màn hình:
  // không mở phần đó thì lấy mặc định; đã chọn thì kiểm tra lại ID ở máy chủ.
  const formGiay = options.formData ?? new FormData()
  let contextGiay: BoiCanhGiay
  try {
    const context = await boiCanhGiay({ id: options.actorId, ho_ten: options.actorName })
    const contextNguoiDeNghi = apDungNguoiDeNghiTheoForm(context, formGiay)
    contextGiay = apDungNguoiKyMacDinh(contextNguoiDeNghi)
    if (VAI_TRO_KY.some(v => formGiay.has(`giay_${v.id}`))) {
      contextGiay = apDungNguoiKy(contextGiay, formGiay)
    }
  } catch (error) {
    return { loi: error instanceof Error ? error.message : 'Không xác định được người đề nghị.' }
  }

  let ketQua: KetQuaTaoGiaoDich
  try {
    ketQua = await trongTransaction(options.actorId, async (client): Promise<KetQuaTaoGiaoDich> => {
      await khoaSoTaiChinh(client)
      const donVi = await chuanHoaDonVi(client, d.hinh_thuc, d.don_vi_id, d.noi_dung)
      const { rows } = await client.query<{ so_thu_tu: number }>(
        'select coalesce(max(so_thu_tu), 0) + 1 as so_thu_tu from giao_dich where ngay=$1 and not da_xoa', [d.ngay])
      const normalized = {
        ...d,
        ...dongTien,
        chi_thuc_te: chiThucTe,
        noi_dung: donVi.noiDung,
        don_vi_id: donVi.donViId,
        tien_duoc_thanh_toan: tienDuocThanhToan,
        lam_tron_xuong_hang_nghin: lamTronXuongHangNghin,
      }
      const canhBao = await kiemTraHoanTamUng(client, normalized, rows[0].so_thu_tu, options.actorId)
      if (canhBao && (!options.xacNhanHoanTamUng || options.fingerprintHoanTamUng !== canhBao.fingerprint)) {
        return { canhBao }
      }
      const nguoiDeNghiId = contextGiay.cauHinh.nguoiDeNghiId
      const lanhDaoTiepKhachId = contextGiay.cauHinh.lanhDaoTiepKhachId
      const lanhDaoThanhToanId = contextGiay.cauHinh.lanhDaoThanhToanId
      const truongPhongId = contextGiay.cauHinh.truongPhongId
      const keToanKiemSoatId = contextGiay.cauHinh.keToanKiemSoatId
      const nguoiKyIds = [nguoiDeNghiId, lanhDaoTiepKhachId, lanhDaoThanhToanId, truongPhongId, keToanKiemSoatId]
        .filter((ma): ma is string => Boolean(ma))
      const { rows: canBoRows } = await client.query<{ id: string }>(
        'select id from can_bo where id = any($1::uuid[]) and dang_hoat_dong', [[...new Set(nguoiKyIds)]])
      const canBoDangHoatDong = new Set(canBoRows.map(cb => cb.id))
      if (!nguoiDeNghiId || nguoiKyIds.some(ma => !canBoDangHoatDong.has(ma))) {
        throw new Error('Người ký giấy đề nghị không tồn tại hoặc đã ngừng hoạt động.')
      }
      const inserted = await client.query<{ id: string }>(`insert into giao_dich (
        ngay, so_thu_tu, noi_dung, don_vi_id, ky_hieu_hd, so_hd, loai_hd, trang_thai_hd, hinh_thuc,
        tong_tien, tien_ruou_bia, tien_duoc_thanh_toan, lam_tron_xuong_hang_nghin,
        tam_ung_tu_cq, giao_tien_chi_thuy, dua_tien_cq_tra_thang_cho_chi_thuy, hoan_ung_tien_mat,
        nguoi_de_nghi_id, lanh_dao_tiep_khach_id, lanh_dao_thanh_toan_id, truong_phong_id, ke_toan_kiem_soat_id, thong_tin_giay_da_chot,
        nguoi_lay_hd_id, phi_lay_hd_ghi_de, co_tinh_phi_lay_hd, trang_thai_tt_phi, ghi_chu,
        hinh_thuc_thanh_toan, tai_khoan_nhan_so, tai_khoan_nhan_ngan_hang, tai_khoan_nhan_chi_nhanh,
        tai_khoan_nhan_ten_chu_tk, nguoi_tao, nguoi_sua, tien_duoc_thanh_toan_goc, ngay_de_nghi, chi_thuc_te, co_so_tinh_phi_lay_hd
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$34,$35,$36,$37,$38) returning id`, [
        d.ngay, rows[0].so_thu_tu, donVi.noiDung, donVi.donViId, d.ky_hieu_hd, d.so_hd, d.loai_hd, trangThaiHd, d.hinh_thuc,
        d.tong_tien, d.tien_ruou_bia, tienDuocThanhToan, lamTronXuongHangNghin,
        dongTien.tam_ung_tu_cq, dongTien.giao_tien_chi_thuy, dongTien.dua_tien_cq_tra_thang_cho_chi_thuy, dongTien.hoan_ung_tien_mat,
        nguoiDeNghiId, lanhDaoTiepKhachId, lanhDaoThanhToanId, truongPhongId, keToanKiemSoatId, true,
        canDonVi(d.hinh_thuc) ? d.nguoi_lay_hd_id : null, phiLayHdGhiDe, coTinhPhi, trangThaiTtPhi, d.ghi_chu,
        hinhThucThanhToan, taiKhoanNhanGhiDe?.soTaiKhoan ?? null, taiKhoanNhanGhiDe?.nganHang ?? null,
        taiKhoanNhanGhiDe?.chiNhanh ?? null, taiKhoanNhanGhiDe?.tenChuTk ?? null, options.actorId,
        tienDuocThanhToanGoc, ngayDeNghi, chiThucTe, coSoTinhPhi,
      ])
      const giaoDichId = inserted.rows[0].id
      const result: KetQuaTaoGiaoDich = { giaoDichId }
      if (lapGiay) {
        await client.query('savepoint lap_giay')
        try {
          const gd = await timGiaoDichTinh(giaoDichId, client)
          if (!gd) throw new Error('Không tìm thấy giao dịch vừa thêm')
          const giay = giayCuaGiaoDich(gd, contextGiay)
          const ids: string[] = []
          for (const g of giay.filter(g => !chonGiay.length || chonGiay.includes(g.loai))) {
            const t = await taoHoacLayTaiLieu(options.actorId, giaoDichId, g.loai, null,
              async () => dienMauDocx(await docMau(MAU_WORD[g.loai], client), g.thayThe, g.thayCoDinh).duLieu, client)
            ids.push(t.id)
          }
          result.taiLieuIds = ids
        } catch {
          await client.query('rollback to savepoint lap_giay')
          result.loiGiay = 'Giao dịch đã lưu nhưng chưa lập được giấy. Không thêm lại giao dịch; mở trang giấy để thử lại.'
        }
        await client.query('release savepoint lap_giay')
      }
      return result
    })
    if (ketQua.canhBao) return ketQua
  } catch (error: unknown) {
    if (error instanceof LoiDonVi) return { loi: 'Đơn vị tiếp khách không tồn tại hoặc đã bị vô hiệu hóa. Vui lòng chọn lại.' }
    if (laLoiTrungHoaDon(error)) return { loi: 'Hóa đơn có cùng ký hiệu và số đã tồn tại. Hãy hủy hoặc sửa số/ký hiệu trước khi lưu.', maLoi: 'trung_hoa_don' }
    console.error('Không thể thêm giao dịch.')
    return { loi: 'Không thể lưu giao dịch. Kiểm tra các trường bắt buộc và dữ liệu hóa đơn.' }
  }

  const tepHoaDon = options.tepHoaDon
  if (tepHoaDon instanceof File && tepHoaDon.size > 0 && ketQua.giaoDichId) {
    const loiTep = await ganTepVaoGiaoDich(options.actorId, ketQua.giaoDichId, tepHoaDon, 'hoa_don')
    if (loiTep) ketQua.loiTep = `Giao dịch đã lưu nhưng chưa giữ được file hóa đơn. ${loiTep}`
  }
  return { ...ketQua, thanhCong: 'Đã thêm giao dịch.' }
}
