import { db } from '@/lib/db/pool'
import { CO_SO_TINH_PHI, type GiaoDichTho, type ThamSoTinh } from './kieu'
import { coTinhPhiMacDinh } from './hinh-thuc'
import { taiKhoanTu } from './tai-khoan'

type DongGiaoDich = Record<string, unknown>
type DongNguoiLay = { id: string; ty_le_phi: string | number | null }
type DongCauHinh = { gia_tri: unknown }

const so = (v: unknown) => {
  const n = Number(v)
  if (!Number.isSafeInteger(n)) throw new Error('Số tiền vượt giới hạn an toàn.')
  return n
}
// pg parses DATE at local midnight; converting it to UTC can change the calendar day.
const ngayIso = (v: unknown) => v instanceof Date
  ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  : String(v).slice(0, 10)

export function chuyenDongGiaoDich(g: DongGiaoDich): GiaoDichTho {
  const chiThucTe = g.chi_thuc_te === true || g.chi_thuc_te === 'true'
  return {
    chiThucTe,
    id: String(g.id), ngay: ngayIso(g.ngay), ngayDeNghi: g.ngay_de_nghi == null ? null : ngayIso(g.ngay_de_nghi), soThuTu: Number(g.so_thu_tu), taoLuc: new Date(String(g.tao_luc)).toISOString(),
    noiDung: String(g.noi_dung), kyHieuHd: g.ky_hieu_hd === null ? null : String(g.ky_hieu_hd), soHd: g.so_hd === null ? null : String(g.so_hd), loaiHd: g.loai_hd === null ? null : String(g.loai_hd),
    trangThaiHd: String(g.trang_thai_hd), hinhThuc: String(g.hinh_thuc), tongTien: so(g.tong_tien), tienRuouBia: so(g.tien_ruou_bia),
    tamUngTuCq: so(g.tam_ung_tu_cq), giaoTienChiThuy: so(g.giao_tien_chi_thuy), hoanUngTienMat: so(g.hoan_ung_tien_mat),
    duaTienCqTraThangChoChiThuy: g.dua_tien_cq_tra_thang_cho_chi_thuy === null || g.dua_tien_cq_tra_thang_cho_chi_thuy === undefined
      ? 0
      : so(g.dua_tien_cq_tra_thang_cho_chi_thuy),
    tienDuocThanhToan: g.tien_duoc_thanh_toan === null || g.tien_duoc_thanh_toan === undefined ? null : so(g.tien_duoc_thanh_toan),
    tienDuocThanhToanGoc: g.tien_duoc_thanh_toan_goc === null || g.tien_duoc_thanh_toan_goc === undefined ? null : so(g.tien_duoc_thanh_toan_goc),
    lamTronXuongHangNghin: g.lam_tron_xuong_hang_nghin === true || g.lam_tron_xuong_hang_nghin === 'true',
    nguoiDeNghiId: g.nguoi_de_nghi_id === null || g.nguoi_de_nghi_id === undefined ? null : String(g.nguoi_de_nghi_id),
    nguoiDeNghiTen: g.nguoi_de_nghi_ten == null ? null : String(g.nguoi_de_nghi_ten),
    lanhDaoTiepKhachId: g.lanh_dao_tiep_khach_id === null || g.lanh_dao_tiep_khach_id === undefined ? null : String(g.lanh_dao_tiep_khach_id),
    lanhDaoThanhToanId: g.lanh_dao_thanh_toan_id === null || g.lanh_dao_thanh_toan_id === undefined ? null : String(g.lanh_dao_thanh_toan_id),
    truongPhongId: g.truong_phong_id === null || g.truong_phong_id === undefined ? null : String(g.truong_phong_id),
    keToanKiemSoatId: g.ke_toan_kiem_soat_id === null || g.ke_toan_kiem_soat_id === undefined ? null : String(g.ke_toan_kiem_soat_id),
    thongTinGiayDaChot: g.thong_tin_giay_da_chot === true || g.thong_tin_giay_da_chot === 'true',
    nguoiLayHdId: g.nguoi_lay_hd_id === null ? null : String(g.nguoi_lay_hd_id), nguoiLayHdTen: g.nguoi_lay_hd_ten == null ? null : String(g.nguoi_lay_hd_ten),
    donViId: g.don_vi_id === null || g.don_vi_id === undefined ? null : String(g.don_vi_id), donViTen: g.don_vi_ten == null ? null : String(g.don_vi_ten),
    phiLayHdGhiDe: g.phi_lay_hd_ghi_de === null ? null : so(g.phi_lay_hd_ghi_de),
    coTinhPhi: g.co_tinh_phi_lay_hd === undefined || g.co_tinh_phi_lay_hd === null
      ? coTinhPhiMacDinh(String(g.hinh_thuc), g.trang_thai_tt_phi == null ? null : String(g.trang_thai_tt_phi), chiThucTe)
      : g.co_tinh_phi_lay_hd === true || g.co_tinh_phi_lay_hd === 'true',
    coSoTinhPhi: g.co_so_tinh_phi_lay_hd === CO_SO_TINH_PHI.TIEN_DUOC_THANH_TOAN
      ? CO_SO_TINH_PHI.TIEN_DUOC_THANH_TOAN : CO_SO_TINH_PHI.TONG_TIEN,
    trangThaiTtPhi: String(g.trang_thai_tt_phi),
    hinhThucThanhToan: g.hinh_thuc_thanh_toan === null || g.hinh_thuc_thanh_toan === undefined ? null : String(g.hinh_thuc_thanh_toan),
    // Tài khoản nhận tiền lấy từ chính người lấy hóa đơn của dòng này: một tài khoản
    // vừa nhận tiền thanh toán, vừa dùng để trả phí lấy hóa đơn.
    taiKhoanNhan: taiKhoanTu({
      so_tai_khoan: g.nguoi_lay_hd_so_tai_khoan == null ? null : String(g.nguoi_lay_hd_so_tai_khoan),
      ngan_hang_bin: g.nguoi_lay_hd_ngan_hang_bin == null ? null : String(g.nguoi_lay_hd_ngan_hang_bin),
      ten_ngan_hang: g.nguoi_lay_hd_ten_ngan_hang == null ? null : String(g.nguoi_lay_hd_ten_ngan_hang),
      ten_chu_tk: g.nguoi_lay_hd_ten_chu_tk == null ? null : String(g.nguoi_lay_hd_ten_chu_tk),
    }),
    taiKhoanNhanGhiDe: taiKhoanTu({
      so_tai_khoan: g.tai_khoan_nhan_so == null ? null : String(g.tai_khoan_nhan_so),
      ten_ngan_hang: g.tai_khoan_nhan_ngan_hang == null ? null : String(g.tai_khoan_nhan_ngan_hang),
      chi_nhanh: g.tai_khoan_nhan_chi_nhanh == null ? null : String(g.tai_khoan_nhan_chi_nhanh),
      ten_chu_tk: g.tai_khoan_nhan_ten_chu_tk == null ? null : String(g.tai_khoan_nhan_ten_chu_tk),
    }),
    ghiChu: g.ghi_chu === null ? null : String(g.ghi_chu), coHoaDon: Boolean(g.co_hoa_don), coChuyenKhoan: Boolean(g.co_chuyen_khoan),
  }
}

export async function layDuLieuTaiChinh(client: Pick<import('pg').PoolClient, 'query'> = db): Promise<{ giaoDich: GiaoDichTho[]; thamSo: ThamSoTinh }> {
  const gd = await client.query<DongGiaoDich>(`select g.*, coalesce(cb.ho_ten, nd.ho_ten) as nguoi_de_nghi_ten, n.ten as nguoi_lay_hd_ten,
      n.so_tai_khoan as nguoi_lay_hd_so_tai_khoan, n.ngan_hang_bin as nguoi_lay_hd_ngan_hang_bin,
      n.ten_ngan_hang as nguoi_lay_hd_ten_ngan_hang, n.ten_chu_tk as nguoi_lay_hd_ten_chu_tk,
      dv.ten as don_vi_ten,
      coalesce(bool_or(t.loai='hoa_don'), false) co_hoa_don,
      coalesce(bool_or(t.loai='chuyen_khoan'), false) co_chuyen_khoan
      from giao_dich g
      left join can_bo cb on cb.id=g.nguoi_de_nghi_id
      left join nguoi_dung nd on nd.id=g.nguoi_tao
      left join nguoi_lay_hd n on n.id=g.nguoi_lay_hd_id
      left join don_vi dv on dv.id=g.don_vi_id
      left join tep_dinh_kem t on t.giao_dich_id=g.id
      where not g.da_xoa
      group by g.id, cb.ho_ten, nd.ho_ten, n.ten, n.so_tai_khoan, n.ngan_hang_bin, n.ten_ngan_hang, n.ten_chu_tk, dv.ten
      order by g.ngay, g.so_thu_tu, g.tao_luc, g.id`)
  const nlh = await client.query<DongNguoiLay>('select id, ty_le_phi from nguoi_lay_hd where dang_hoat_dong and ty_le_phi is not null')
  const ch = await client.query<DongCauHinh>("select gia_tri from cau_hinh where khoa='ty_le_phi_chung'")

  const giaoDich = gd.rows.map(chuyenDongGiaoDich)
  const tyLeTheoNguoi = Object.fromEntries(nlh.rows.map((n) => [n.id, Number(n.ty_le_phi)]))
  const giaTri = ch.rows[0]?.gia_tri
  const tyLePhiChung = Number(typeof giaTri === 'object' && giaTri !== null && 'valueOf' in giaTri ? giaTri.valueOf() : giaTri ?? 0.15)
  return { giaoDich, thamSo: { tyLePhiChung, tyLeTheoNguoi } }
}
