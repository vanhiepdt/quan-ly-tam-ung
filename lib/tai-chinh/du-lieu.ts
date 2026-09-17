import { db } from '@/lib/db/pool'
import type { GiaoDichTho, ThamSoTinh } from './kieu'
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
  return {
    id: String(g.id), ngay: ngayIso(g.ngay), soThuTu: Number(g.so_thu_tu), taoLuc: new Date(String(g.tao_luc)).toISOString(),
    noiDung: String(g.noi_dung), kyHieuHd: g.ky_hieu_hd === null ? null : String(g.ky_hieu_hd), soHd: g.so_hd === null ? null : String(g.so_hd), loaiHd: g.loai_hd === null ? null : String(g.loai_hd),
    trangThaiHd: String(g.trang_thai_hd), hinhThuc: String(g.hinh_thuc), tongTien: so(g.tong_tien), tienRuouBia: so(g.tien_ruou_bia),
    tamUngTuCq: so(g.tam_ung_tu_cq), giaoTienChiThuy: so(g.giao_tien_chi_thuy), hoanUngTienMat: so(g.hoan_ung_tien_mat),
    nguoiLayHdId: g.nguoi_lay_hd_id === null ? null : String(g.nguoi_lay_hd_id), nguoiLayHdTen: g.nguoi_lay_hd_ten == null ? null : String(g.nguoi_lay_hd_ten),
    donViId: g.don_vi_id === null || g.don_vi_id === undefined ? null : String(g.don_vi_id), donViTen: g.don_vi_ten == null ? null : String(g.don_vi_ten),
    phiLayHdGhiDe: g.phi_lay_hd_ghi_de === null ? null : so(g.phi_lay_hd_ghi_de), trangThaiTtPhi: String(g.trang_thai_tt_phi),
    hinhThucThanhToan: g.hinh_thuc_thanh_toan === null || g.hinh_thuc_thanh_toan === undefined ? null : String(g.hinh_thuc_thanh_toan),
    // Tài khoản nhận tiền lấy từ chính người lấy hóa đơn của dòng này: một tài khoản
    // vừa nhận tiền thanh toán, vừa dùng để trả phí lấy hóa đơn.
    taiKhoanNhan: taiKhoanTu({
      so_tai_khoan: g.nguoi_lay_hd_so_tai_khoan == null ? null : String(g.nguoi_lay_hd_so_tai_khoan),
      ngan_hang_bin: g.nguoi_lay_hd_ngan_hang_bin == null ? null : String(g.nguoi_lay_hd_ngan_hang_bin),
      ten_ngan_hang: g.nguoi_lay_hd_ten_ngan_hang == null ? null : String(g.nguoi_lay_hd_ten_ngan_hang),
      ten_chu_tk: g.nguoi_lay_hd_ten_chu_tk == null ? null : String(g.nguoi_lay_hd_ten_chu_tk),
    }),
    ghiChu: g.ghi_chu === null ? null : String(g.ghi_chu), coHoaDon: Boolean(g.co_hoa_don), coChuyenKhoan: Boolean(g.co_chuyen_khoan),
  }
}

export async function layDuLieuTaiChinh(client: Pick<import('pg').PoolClient, 'query'> = db): Promise<{ giaoDich: GiaoDichTho[]; thamSo: ThamSoTinh }> {
  const gd = await client.query<DongGiaoDich>(`select g.*, n.ten as nguoi_lay_hd_ten,
      n.so_tai_khoan as nguoi_lay_hd_so_tai_khoan, n.ngan_hang_bin as nguoi_lay_hd_ngan_hang_bin,
      n.ten_ngan_hang as nguoi_lay_hd_ten_ngan_hang, n.ten_chu_tk as nguoi_lay_hd_ten_chu_tk,
      dv.ten as don_vi_ten,
      coalesce(bool_or(t.loai='hoa_don'), false) co_hoa_don,
      coalesce(bool_or(t.loai='chuyen_khoan'), false) co_chuyen_khoan
      from giao_dich g
      left join nguoi_lay_hd n on n.id=g.nguoi_lay_hd_id
      left join don_vi dv on dv.id=g.don_vi_id
      left join tep_dinh_kem t on t.giao_dich_id=g.id
      where not g.da_xoa
      group by g.id, n.ten, n.so_tai_khoan, n.ngan_hang_bin, n.ten_ngan_hang, n.ten_chu_tk, dv.ten
      order by g.ngay, g.so_thu_tu, g.tao_luc, g.id`)
  const nlh = await client.query<DongNguoiLay>('select id, ty_le_phi from nguoi_lay_hd where dang_hoat_dong and ty_le_phi is not null')
  const ch = await client.query<DongCauHinh>("select gia_tri from cau_hinh where khoa='ty_le_phi_chung'")

  const giaoDich = gd.rows.map(chuyenDongGiaoDich)
  const tyLeTheoNguoi = Object.fromEntries(nlh.rows.map((n) => [n.id, Number(n.ty_le_phi)]))
  const giaTri = ch.rows[0]?.gia_tri
  const tyLePhiChung = Number(typeof giaTri === 'object' && giaTri !== null && 'valueOf' in giaTri ? giaTri.valueOf() : giaTri ?? 0.15)
  return { giaoDich, thamSo: { tyLePhiChung, tyLeTheoNguoi } }
}
