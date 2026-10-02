import { docCauHinhGiay } from '@/lib/tai-chinh/cau-hinh-giay'
import { docHoaDonHaiAi } from '@/lib/kiem-tra/doc-hoa-don'
import type { KetQuaDocHoaDon } from '@/lib/kiem-tra/giao-dien'
import { laSoTienHopLe } from '@/lib/kiem-tra/tien'
import { kiemTraTepIntake } from './tep'

export type DeXuatIntake = {
  ngay: string
  kyHieuHd: string | null
  soHd: string | null
  tongTien: number
  tienRuouBia: number
  loaiHd: 'gtgt' | 'ban_hang'
  trangThaiHd: 'Hợp lệ' | 'Không hợp lệ'
}

export async function docHoaDonIntake(file: File): Promise<KetQuaDocHoaDon> {
  const checked = await kiemTraTepIntake(file)
  if ('loi' in checked) throw new Error(checked.loi)
  const cauHinh = await docCauHinhGiay()
  return docHoaDonHaiAi(await file.arrayBuffer().then(bytes => new Uint8Array(bytes)), checked.mime, {
    mst: cauHinh.mstDonVi,
    ten: cauHinh.tenMuaHangDonVi || cauHinh.tenDonVi,
    diaChi: cauHinh.diaChiDonVi,
  })
}

function ngayMacDinh(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'Asia/Bangkok' }).format(new Date())
}

function tienMacDinh(value: unknown): number {
  return laSoTienHopLe(value) ? value : 0
}

export function deXuatGiaoDich(ketQua: Pick<KetQuaDocHoaDon, 'deXuat' | 'trangThai'>): DeXuatIntake {
  const d = ketQua.deXuat
  const loaiHd = d.loaiHd === 'ban_hang' ? 'ban_hang' : 'gtgt'
  return {
    ngay: d.ngay || ngayMacDinh(),
    kyHieuHd: d.kyHieuHd?.trim() || null,
    soHd: d.soHd?.trim() || null,
    tongTien: tienMacDinh(d.tongTien),
    tienRuouBia: tienMacDinh(d.tienRuouBia),
    loaiHd,
    trangThaiHd: ketQua.trangThai === 'khong_hop_le' ? 'Không hợp lệ' : 'Hợp lệ',
  }
}

export function nhanLoaiHdIntake(loai: DeXuatIntake['loaiHd']): string {
  return loai === 'ban_hang' ? 'Hóa đơn Bán hàng' : 'Hóa đơn Giá trị gia tăng'
}
