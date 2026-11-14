import type { DongNhatKy, GiaoDichTinh } from './kieu'

// Cột tiền phát sinh: dòng gộp lấy tổng của các giao dịch con, nhờ vậy hàng tổng
// của nhật ký vẫn ra đúng số như khi hiện từng dòng con.
const CONG_DON = [
  'tongTien', 'tienRuouBia', 'tamUngTuCq', 'giaoTienChiThuy', 'hoanUngTienMat',
  'duaTienCqTraThangChoChiThuy', 'hoanTamUng', 'cqTraThang', 'phiLayHd',
  'layQuyChiThuy', 'tongTienDuaChiThuy',
] as const

// Cột số dư là giá trị luỹ kế, cộng lại không có nghĩa kế toán. Dòng gộp lấy số
// dư sau giao dịch con cuối cùng — đúng trạng thái sổ khi cả Hội nghị đã ghi xong.
const SO_DU = [
  'duTienCqTraThang', 'duChiTiepKhachThucTe', 'tongLayQuyChiThuy',
  'duLyThuyet', 'duThucTe', 'duDangCam', 'duHiepDangCam',
] as const

// Trường mô tả chỉ giữ lại khi mọi giao dịch con trùng nhau; khác nhau thì để
// trống vì một dòng gộp không thể nói thay cho nhiều giá trị.
function giongNhau(ds: readonly GiaoDichTinh[], chon: (r: GiaoDichTinh) => string | null): string | null {
  const dau = chon(ds[0])
  return dau && ds.every(r => chon(r) === dau) ? dau : null
}

function tenNguoiLayHd(ds: readonly GiaoDichTinh[]): string | null {
  const ten = [...new Set(ds.map(r => r.nguoiLayHdTen).filter((v): v is string => Boolean(v)))]
  return ten.length ? ten.join(', ') : null
}

function gop(hoiNghiId: string, ds: readonly GiaoDichTinh[]): DongNhatKy {
  const cuoi = ds[ds.length - 1]
  const cong = Object.fromEntries(CONG_DON.map(id => [id, ds.reduce((tong, r) => tong + r[id], 0)])) as Pick<GiaoDichTinh, typeof CONG_DON[number]>
  const soDu = Object.fromEntries(SO_DU.map(id => [id, cuoi[id]])) as Pick<GiaoDichTinh, typeof SO_DU[number]>
  const motTrangThaiHd = ds.every(r => r.trangThaiHd === ds[0].trangThaiHd)
  const motTrangThaiPhi = ds.every(r => r.trangThaiTtPhi === ds[0].trangThaiTtPhi)
  return {
    ...cuoi, ...cong, ...soDu,
    // Mã riêng để không đụng id của giao dịch thật; mọi nơi nhận ra dòng gộp qua gopHoiNghi.
    id: `hoi-nghi:${hoiNghiId}`,
    ngay: cuoi.hoiNghiNgay ?? cuoi.ngay,
    noiDung: cuoi.hoiNghiTen ?? 'Hội nghị',
    ghiChu: `${ds.length} giao dịch con`,
    kyHieuHd: null, soHd: null, loaiHd: null, chiTietHoaDon: null,
    trangThaiHd: motTrangThaiHd ? ds[0].trangThaiHd : 'Nhiều trạng thái',
    trangThaiTtPhi: motTrangThaiPhi ? ds[0].trangThaiTtPhi : 'Nhiều trạng thái',
    chiThucTe: ds.every(r => r.chiThucTe === true),
    donViId: null, donViTen: giongNhau(ds, r => r.donViTen),
    nguoiDeNghiId: null, nguoiDeNghiTen: giongNhau(ds, r => r.nguoiDeNghiTen),
    // Cột người lấy hóa đơn liệt kê đủ tên của các giao dịch con, vì một Hội nghị
    // thường chia hóa đơn cho nhiều người và đây là thông tin cần thấy ngay.
    nguoiLayHdId: null, nguoiLayHdTen: tenNguoiLayHd(ds),
    // Dấu tệp chỉ bật khi mọi giao dịch con đã có, để không báo đủ hồ sơ quá sớm.
    coHoaDon: ds.every(r => r.coHoaDon), coChuyenKhoan: ds.every(r => r.coChuyenKhoan),
    tienDuocThanhToan: null, tienDuocThanhToanGoc: null,
    gopHoiNghi: { hoiNghiId, soCon: ds.length, soHoaDon: ds.filter(r => r.kyHieuHd || r.soHd).length },
  }
}

// Gộp các giao dịch con của cùng một Hội nghị thành một dòng nhật ký duy nhất.
// Giao dịch không thuộc Hội nghị nào đi qua nguyên vẹn.
export function gomHoiNghi(rows: readonly GiaoDichTinh[]): DongNhatKy[] {
  const con = new Map<string, GiaoDichTinh[]>()
  for (const row of rows) {
    if (!row.hoiNghiId) continue
    const ds = con.get(row.hoiNghiId)
    if (ds) ds.push(row)
    else con.set(row.hoiNghiId, [row])
  }
  if (!con.size) return [...rows]
  const ket: DongNhatKy[] = []
  for (const row of rows) {
    if (!row.hoiNghiId) { ket.push(row); continue }
    const ds = con.get(row.hoiNghiId)!
    // Dòng gộp đứng đúng chỗ giao dịch con cuối cùng, để cột số dư luỹ kế đọc
    // xuôi theo thứ tự sổ thay vì nhảy lên trước những dòng chưa ghi xong.
    if (row === ds[ds.length - 1]) ket.push(gop(row.hoiNghiId, ds))
  }
  return ket
}
