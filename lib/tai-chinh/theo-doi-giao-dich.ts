import { HINH_THUC, NGUON_BU, type GiaoDichTinh } from './kieu'

export type BienDongSoDu = {
  id: string
  ten: string
  truoc: number
  thayDoi: number
  sau: number
  lienQuan: boolean
}

export type TrangThaiHoSo = {
  coHoaDon: boolean
  coChuyenKhoan: boolean
  coGiay: boolean
}

export type NhanHinhThuc = {
  nhanNgan: string
  moTa: string
  nhanSoTienChinh: string
}

export type GiaoDichTheoDoi = {
  id: string
  ngay: string
  noiDung: string
  hinhThuc: string
  nhanHinhThuc: NhanHinhThuc
  donViId: string | null
  donViTen: string | null
  kyHieuHd: string | null
  soHd: string | null
  loaiHd: string | null
  nguoiDeNghiTen: string | null
  nguoiLayHdTen: string | null
  soTienChinh: number
  nhanSoTienChinh: string
  tongTien: number
  tienKhongDuocThanhToan: number
  tienDuocThanhToan: number | null
  hoanTamUng: number
  cqTraThang: number
  phiLayHd: number
  trangThaiHd: string
  trangThaiTtPhi: string
  chiThucTe: boolean
  nguonBuChiThucTe: string
  nguonBuChiThucTeNhan: string
  bienDongSoDu: BienDongSoDu[]
  soDuKhac: BienDongSoDu[]
  hoSo: TrangThaiHoSo
  dongCanhBao: string[]
  ghiChu: string | null
  giaoDich: GiaoDichTinh
}

const SO_DU = [
  { id: 'duLyThuyet', ten: 'Dư TƯ lý thuyết' },
  { id: 'duThucTe', ten: 'Dư TƯ thực tế' },
  { id: 'duDangCam', ten: 'Dư TƯ đang cầm' },
  { id: 'duHiepDangCam', ten: 'Dư Hiệp đang cầm' },
  { id: 'duTienCqTraThang', ten: 'Dư tiền CQ trả thẳng' },
  { id: 'duChiTiepKhachThucTe', ten: 'Dư Chi tiếp khách thực tế' },
  { id: 'tongLayQuyChiThuy', ten: 'Tổng lấy quỹ chị Thúy' },
] as const

type SoDuId = typeof SO_DU[number]['id']

const NHAN_NGUON_BU: Record<string, string> = {
  [NGUON_BU.SO_DU]: 'Số dư',
  [NGUON_BU.QUY_CHI_THUY]: 'Quỹ Chị Thúy',
  [NGUON_BU.TU_CHIU]: 'Tự chịu',
}

export function nhanHinhThuc(hinhThuc: string): NhanHinhThuc {
  switch (hinhThuc) {
    case HINH_THUC.TAM_UNG_THEM:
      return { nhanNgan: 'Tạm ứng thêm', moTa: 'Cơ quan cấp thêm tiền tạm ứng', nhanSoTienChinh: 'Tạm ứng từ cơ quan' }
    case HINH_THUC.GIAO_CHI_THUY:
      return { nhanNgan: 'Giao tiền chị Thúy', moTa: 'Giao tiền tạm ứng cho Chị Thúy', nhanSoTienChinh: 'Tiền giao cho Chị Thúy' }
    case HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY:
      return { nhanNgan: 'Đưa tiền CQ trả thẳng cho Chị Thúy', moTa: 'Đưa khoản CQ trả thẳng cho Chị Thúy', nhanSoTienChinh: 'Tiền đưa cho Chị Thúy' }
    case HINH_THUC.HOAN_TAM_UNG:
      return { nhanNgan: 'Hoàn tạm ứng', moTa: 'Tiếp khách bằng tiền tạm ứng', nhanSoTienChinh: 'Tiền ghi nhận hoàn ứng' }
    case HINH_THUC.CQ_TRA_THANG:
      return { nhanNgan: 'Cơ quan trả thẳng', moTa: 'Cơ quan thanh toán trực tiếp khoản tiếp khách', nhanSoTienChinh: 'Tiền ghi nhận CQ trả thẳng' }
    case HINH_THUC.NOP_HOAN_CQ:
      return { nhanNgan: 'Nộp hoàn CQ', moTa: 'Nộp tiền hoàn lại cho cơ quan', nhanSoTienChinh: 'Tiền nộp hoàn' }
    default:
      return { nhanNgan: hinhThuc, moTa: hinhThuc, nhanSoTienChinh: 'Số tiền chính' }
  }
}

function soTienChinh(row: GiaoDichTinh): number {
  switch (row.hinhThuc) {
    case HINH_THUC.TAM_UNG_THEM: return row.tamUngTuCq
    case HINH_THUC.GIAO_CHI_THUY: return row.giaoTienChiThuy
    case HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY: return row.duaTienCqTraThangChoChiThuy
    case HINH_THUC.HOAN_TAM_UNG: return row.hoanTamUng
    case HINH_THUC.CQ_TRA_THANG: return row.cqTraThang
    case HINH_THUC.NOP_HOAN_CQ: return row.hoanUngTienMat
    default: return 0
  }
}

function giaTriSoDu(row: GiaoDichTinh, id: SoDuId): number {
  return row[id]
}

function taoBienDong(row: GiaoDichTinh, truoc: Partial<Record<SoDuId, number>>): BienDongSoDu[] {
  return SO_DU.map(({ id, ten }) => {
    const sau = giaTriSoDu(row, id)
    const truocDong = truoc[id] ?? 0
    return { id, ten, truoc: truocDong, thayDoi: sau - truocDong, sau, lienQuan: sau !== truocDong }
  })
}

function taoCanhBao(row: GiaoDichTinh): string[] {
  const canhBao: string[] = []
  if (row.trangThaiHd === 'Chờ HĐ') canhBao.push('Hóa đơn đang chờ, chưa ghi nhận tiền hoàn/thanh toán.')
  if (row.trangThaiHd === 'Không hợp lệ') canhBao.push('Hóa đơn chưa được tính vào khoản hoàn/thanh toán.')
  if (row.trangThaiTtPhi === 'Chưa thanh toán') canhBao.push('Phí lấy hóa đơn chưa thanh toán.')
  if (!row.coHoaDon && (row.hinhThuc === HINH_THUC.HOAN_TAM_UNG || row.hinhThuc === HINH_THUC.CQ_TRA_THANG)) canhBao.push('Chưa có tệp hóa đơn.')
  if (!row.coChuyenKhoan && row.trangThaiTtPhi === 'Đã thanh toán') canhBao.push('Chưa có tệp chuyển khoản.')
  if (row.duLyThuyet < 0 || row.duThucTe < 0 || row.duDangCam < 0 || row.duTienCqTraThang < 0) canhBao.push('Có số dư âm sau khi ghi sổ.')
  if (row.chiThucTe && row.nguonBuChiThucTe && row.nguonBuChiThucTe !== NGUON_BU.SO_DU) canhBao.push(`Chi thực tế đang dùng nguồn bù: ${NHAN_NGUON_BU[row.nguonBuChiThucTe] ?? row.nguonBuChiThucTe}.`)
  return canhBao
}

export function taoDuLieuTheoDoi(rows: readonly GiaoDichTinh[]): GiaoDichTheoDoi[] {
  const previous: Partial<Record<SoDuId, number>> = {}
  return rows.map(row => {
    const all = taoBienDong(row, previous)
    const related = all.filter(item => item.lienQuan)
    const other = all.filter(item => !item.lienQuan)
    const label = nhanHinhThuc(row.hinhThuc)
    const nguon = row.nguonBuChiThucTe ?? NGUON_BU.SO_DU
    const result: GiaoDichTheoDoi = {
      id: row.id, ngay: row.ngay, noiDung: row.noiDung, hinhThuc: row.hinhThuc, nhanHinhThuc: label,
      donViId: row.donViId, donViTen: row.donViTen, kyHieuHd: row.kyHieuHd, soHd: row.soHd, loaiHd: row.loaiHd,
      nguoiDeNghiTen: row.nguoiDeNghiTen, nguoiLayHdTen: row.nguoiLayHdTen,
      soTienChinh: soTienChinh(row), nhanSoTienChinh: label.nhanSoTienChinh,
      tongTien: row.tongTien, tienKhongDuocThanhToan: row.tienRuouBia,
      tienDuocThanhToan: row.hoanTamUng || row.cqTraThang ? (row.hoanTamUng || row.cqTraThang) : null,
      hoanTamUng: row.hoanTamUng, cqTraThang: row.cqTraThang, phiLayHd: row.phiLayHd,
      trangThaiHd: row.trangThaiHd, trangThaiTtPhi: row.trangThaiTtPhi, chiThucTe: row.chiThucTe === true,
      nguonBuChiThucTe: nguon, nguonBuChiThucTeNhan: NHAN_NGUON_BU[nguon] ?? nguon,
      bienDongSoDu: related, soDuKhac: other,
      hoSo: { coHoaDon: row.coHoaDon, coChuyenKhoan: row.coChuyenKhoan, coGiay: row.hinhThuc === HINH_THUC.TAM_UNG_THEM || row.hinhThuc === HINH_THUC.GIAO_CHI_THUY || row.hinhThuc === HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY || row.hinhThuc === HINH_THUC.HOAN_TAM_UNG || row.hinhThuc === HINH_THUC.CQ_TRA_THANG || row.hinhThuc === HINH_THUC.NOP_HOAN_CQ },
      dongCanhBao: taoCanhBao(row), ghiChu: row.ghiChu, giaoDich: row,
    }
    for (const { id } of SO_DU) previous[id] = row[id]
    return result
  })
}
