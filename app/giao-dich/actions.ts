'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { batBuocVaiTro } from '@/lib/xac-thuc/bao-ve'
import { trongTransaction } from '@/lib/db/pool'
import { schemaGiaoDich } from '@/lib/validation/giao-dich'

import { canDonVi, hinhThucThanhToanMacDinh, hopLeHinhThucThanhToan, noiDungTheoDonVi, noiDungTheoHinhThuc } from '@/lib/tai-chinh/hinh-thuc'
import { chuanHoaGiaTri, apDungChoHinhThuc, timTruongSua } from '@/lib/tai-chinh/sua-giao-dich'
import { khoaSoTaiChinh, kiemTraHoanTamUng, type CanhBaoHoanTamUng } from '@/lib/tai-chinh/xac-nhan-hoan-ung'

import { giayChoHinhThuc } from '@/lib/tai-chinh/giay'
import { giayCuaGiaoDich, timGiaoDichTinh, MAU_WORD } from '@/lib/tai-chinh/in-giay'
import { boiCanhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { apDungNguoiKy } from '@/lib/tai-chinh/chon-nguoi-ky'
import { taoHoacLayTaiLieu, docMau } from '@/lib/onlyoffice/tai-lieu'
import { dienMauDocx } from '@/lib/van-ban/docx'
import { ganTepVaoGiaoDich } from '@/lib/tep/gan'

export type KetQua = { loi?: string; thanhCong?: string; canhBao?: CanhBaoHoanTamUng; giaoDichId?: string; loiGiay?: string; loiTep?: string; taiLieuIds?: string[] }

const schemaId = z.string().uuid()
// Lỗi nội bộ để phân biệt "đơn vị không hợp lệ" với lỗi database chung.
class LoiDonVi extends Error {}

function layDuLieu(formData: FormData) {
  const get = (key: string) => {
    const val = formData.get(key)
    return val === null || val === '' ? null : val
  }
  return {
    ngay: get('ngay'), noi_dung: get('noi_dung'), don_vi_id: get('don_vi_id'),
    ky_hieu_hd: get('ky_hieu_hd'), so_hd: get('so_hd'), loai_hd: get('loai_hd'),
    trang_thai_hd: get('trang_thai_hd'), hinh_thuc: get('hinh_thuc'),
    tong_tien: get('tong_tien') || 0, tien_ruou_bia: get('tien_ruou_bia') || 0,
    tam_ung_tu_cq: get('tam_ung_tu_cq') || 0, giao_tien_chi_thuy: get('giao_tien_chi_thuy') || 0,
    hoan_ung_tien_mat: get('hoan_ung_tien_mat') || 0, nguoi_lay_hd_id: get('nguoi_lay_hd_id'),
    phi_lay_hd_ghi_de: get('phi_lay_hd_ghi_de'), trang_thai_tt_phi: get('trang_thai_tt_phi'),
    ghi_chu: get('ghi_chu'), hinh_thuc_thanh_toan: get('hinh_thuc_thanh_toan'),
  }
}

// Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới gắn đơn vị. Khi gắn thì nội dung do máy
// chủ sinh từ tên đơn vị; khi không gắn thì đơn vị bị bỏ trống để nhật ký không hiện
// đơn vị cũ trên một dòng tiền nội bộ.
async function chuanHoaDonVi(client: { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  hinhThuc: string, donViId: string | null, noiDung: string) {
  if (!canDonVi(hinhThuc)) return { donViId: null, noiDung: noiDungTheoHinhThuc(hinhThuc) ?? noiDung }
  if (!donViId) throw new LoiDonVi()
  const { rows } = await client.query('select ten from don_vi where id=$1 and dang_hoat_dong', [donViId])
  if (!rows.length) throw new LoiDonVi()
  return { donViId, noiDung: noiDungTheoDonVi(String(rows[0].ten)) }
}

export async function themGiaoDich(_: KetQua, formData: FormData): Promise<KetQua> {
  const phien = await batBuocVaiTro('admin', 'nhap_lieu')
  const duLieu = layDuLieu(formData)
  const parsed = schemaGiaoDich.safeParse(duLieu)
  if (!parsed.success) {
    return { loi: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
  }
  const d = parsed.data
  // Gán giá trị mặc định cho các trường required trong DB nhưng optional trong logic
  const trangThaiHd = d.trang_thai_hd || 'Không có'
  const trangThaiTtPhi = d.trang_thai_tt_phi || 'Không phát sinh'
  // Hoàn tạm ứng chỉ có một hình thức thanh toán nên máy tự điền, không phụ thuộc form
  // có gửi lên hay không. Hình thức không lập giấy thì mặc định là null.
  const hinhThucThanhToan = d.hinh_thuc_thanh_toan ?? hinhThucThanhToanMacDinh(d.hinh_thuc)

  const lapGiay = formData.get('lap_giay') === '1'
  if (lapGiay && !giayChoHinhThuc(d.hinh_thuc).length) return { loi: 'Hình thức này không lập giấy đề nghị.' }
  const chonGiay = formData.getAll('loai_giay')
  if (lapGiay && chonGiay.some(loai => typeof loai !== 'string' || !giayChoHinhThuc(d.hinh_thuc).some(g => g === loai))) {
    return { loi: 'Loại giấy không phù hợp với giao dịch.' }
  }
  let ketQua: KetQua
  try {
    ketQua = await trongTransaction(phien.id, async (client): Promise<KetQua> => {
      await khoaSoTaiChinh(client)
      const donVi = await chuanHoaDonVi(client, d.hinh_thuc, d.don_vi_id, d.noi_dung)
      const { rows } = await client.query<{ so_thu_tu: number }>(
        'select coalesce(max(so_thu_tu), 0) + 1 as so_thu_tu from giao_dich where ngay=$1 and not da_xoa', [d.ngay]
      )
      const canhBao = await kiemTraHoanTamUng(client, { ...d, noi_dung: donVi.noiDung, don_vi_id: donVi.donViId }, rows[0].so_thu_tu, phien.id)
      if (canhBao && (formData.get('xac_nhan_hoan_tam_ung') !== '1'
        || formData.get('fingerprint_hoan_tam_ung') !== canhBao.fingerprint)) {
        return { canhBao }
      }
      const inserted = await client.query<{ id: string }>(`insert into giao_dich (
        ngay, so_thu_tu, noi_dung, don_vi_id, ky_hieu_hd, so_hd, loai_hd, trang_thai_hd, hinh_thuc,
        tong_tien, tien_ruou_bia, tam_ung_tu_cq, giao_tien_chi_thuy, hoan_ung_tien_mat,
        nguoi_lay_hd_id, phi_lay_hd_ghi_de, trang_thai_tt_phi, ghi_chu, hinh_thuc_thanh_toan, nguoi_tao, nguoi_sua
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) returning id`, [
        d.ngay, rows[0].so_thu_tu, donVi.noiDung, donVi.donViId, d.ky_hieu_hd, d.so_hd, d.loai_hd, trangThaiHd, d.hinh_thuc,
        d.tong_tien, d.tien_ruou_bia, d.tam_ung_tu_cq, d.giao_tien_chi_thuy, d.hoan_ung_tien_mat,
        d.nguoi_lay_hd_id, d.phi_lay_hd_ghi_de, trangThaiTtPhi, d.ghi_chu, hinhThucThanhToan, phien.id,
      ])
      const giaoDichId = inserted.rows[0].id
      const result: KetQua = { giaoDichId }
      if (lapGiay) {
        // Tất cả giấy của giao dịch cùng thành công hoặc cùng rollback; giữ dòng nhật ký.
        await client.query('savepoint lap_giay')
        try {
          const gd = await timGiaoDichTinh(giaoDichId, client)
          if (!gd) throw new Error('Không tìm thấy giao dịch vừa thêm')
          const giay = giayCuaGiaoDich(gd, apDungNguoiKy(await boiCanhGiay(phien), formData))
          const ids: string[] = []
          for (const g of giay.filter(g => !chonGiay.length || chonGiay.includes(g.loai))) {
            const t = await taoHoacLayTaiLieu(phien.id, giaoDichId, g.loai, null,
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
    // PostgreSQL errors can contain the complete failing financial row.
    console.error('Không thể thêm giao dịch.')
    return { loi: 'Không thể lưu giao dịch. Kiểm tra các trường bắt buộc và dữ liệu hóa đơn.' }
  }
  const tepHoaDon = formData.get('tep_hoa_don')
  if (tepHoaDon instanceof File && tepHoaDon.size > 0 && ketQua.giaoDichId) {
    const loiTep = await ganTepVaoGiaoDich(phien.id, ketQua.giaoDichId, tepHoaDon, 'hoa_don')
    if (loiTep) ketQua.loiTep = `Giao dịch đã lưu nhưng chưa giữ được file hóa đơn. ${loiTep}`
  }
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
      const { rows } = await client.query<{ hinh_thuc: string }>(
        'select hinh_thuc from giao_dich where id=$1 and not da_xoa for update', [id.data])
      if (!rows.length) return { loi: 'Không tìm thấy giao dịch hoặc giao dịch đã bị xóa.' }
      const hinhThuc = rows[0].hinh_thuc
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
        await client.query('update giao_dich set ngay=$1, so_thu_tu=$2, sua_luc=now(), nguoi_sua=$3 where id=$4',
          [chuanHoa.giaTri, rows[0].so_thu_tu, phien.id, id.data])
        return { thanhCong: `Đã chuyển giao dịch sang ngày ${chuanHoa.giaTri} và tính lại số dư.` }
      }

      if (truong.id === 'don_vi_id') {
        if (chuanHoa.giaTri === null) return { loi: 'Đơn vị tiếp khách không được để trống.' }
        const dv = await client.query<{ ten: string }>('select ten from don_vi where id=$1 and dang_hoat_dong', [chuanHoa.giaTri])
        if (!dv.rows.length) return { loi: 'Đơn vị không tồn tại hoặc đã bị vô hiệu hóa.' }
        // Đổi đơn vị thì nội dung phải đi theo, nếu không nhật ký sẽ lệch tên đơn vị.
        await client.query('update giao_dich set don_vi_id=$1, noi_dung=$2, sua_luc=now(), nguoi_sua=$3 where id=$4',
          [chuanHoa.giaTri, noiDungTheoDonVi(dv.rows[0].ten), phien.id, id.data])
        return { thanhCong: `Đã cập nhật ${truong.ten.toLowerCase()} và nội dung.` }
      }

      if (truong.id === 'hinh_thuc_thanh_toan') {
        // Mỗi hình thức giao dịch chỉ dùng một phần giá trị: hoàn tạm ứng luôn in
        // "Hoàn tạm ứng", cơ quan trả thẳng chọn tiền mặt hoặc chuyển khoản.
        if (!hopLeHinhThucThanhToan(hinhThuc, chuanHoa.giaTri)) {
          return { loi: `Hình thức "${hinhThuc}" không dùng hình thức thanh toán này.` }
        }
      }

      if (truong.id === 'nguoi_lay_hd_id' && chuanHoa.giaTri !== null) {
        const nlh = await client.query('select 1 from nguoi_lay_hd where id=$1', [chuanHoa.giaTri])
        if (!nlh.rows.length) return { loi: 'Người lấy hóa đơn không tồn tại.' }
      }
      await client.query(`update giao_dich set ${truong.id}=$1, sua_luc=now(), nguoi_sua=$2 where id=$3`,
        [chuanHoa.giaTri, phien.id, id.data])
      return { thanhCong: `Đã cập nhật ${truong.ten.toLowerCase()}.` }
    })
    if ('loi' in ketQua) return ketQua
  } catch {
    console.error('Không thể sửa giao dịch.')
    return { loi: 'Không thể lưu thay đổi. Kiểm tra ràng buộc số tiền, ví dụ tiền rượu bia không được vượt tổng tiền.' }
  }
  revalidatePath('/giao-dich')
  revalidatePath('/dashboard')
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
