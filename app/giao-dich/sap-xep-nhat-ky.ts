import type { GiaoDichTinh } from '@/lib/tai-chinh/kieu'
import { cotNhatKy, type CotId } from './cot-nhat-ky'

export type KhoaSapXep = { id: CotId; giam: boolean }

// Giá trị dùng để so sánh. Các cột ghép nhiều trường được nối lại thành một chuỗi
// để thứ tự vẫn xác định.
export function giaTriSoSanh(r: GiaoDichTinh, id: CotId): string | number {
  switch (id) {
    // Cột ghép nhiều trường: nối lại thành một chuỗi để thứ tự vẫn xác định.
    case 'chungTu': return `${r.kyHieuHd ?? ''} ${r.soHd ?? ''}`.trim()
    case 'trangThai': return `${r.trangThaiHd} ${r.trangThaiTtPhi}`
    case 'donVi': return r.donViTen ?? ''
    case 'tep': return `${r.coHoaDon ? 1 : 0}${r.coChuyenKhoan ? 1 : 0}`
    case 'thaoTac': return ''
    // Cột trùng tên với trường của giao dịch.
    case 'ngay': return r.ngay
    case 'noiDung': return r.noiDung
    case 'hinhThuc': return r.hinhThuc
    case 'tongTien': return r.tongTien
    case 'tienRuouBia': return r.tienRuouBia
    case 'hoanTamUng': return r.hoanTamUng
    case 'cqTraThang': return r.cqTraThang
    case 'phiLayHd': return r.phiLayHd
    case 'tamUngTuCq': return r.tamUngTuCq
    case 'giaoTienChiThuy': return r.giaoTienChiThuy
    case 'hoanUngTienMat': return r.hoanUngTienMat
    case 'duLyThuyet': return r.duLyThuyet
    case 'duThucTe': return r.duThucTe
    case 'duDangCam': return r.duDangCam
  }
}

export function sapXepDong(rows: GiaoDichTinh[], khoa: readonly KhoaSapXep[]): GiaoDichTinh[] {
  if (!khoa.length) return rows
  return [...rows].sort((a, b) => {
    for (const k of khoa) {
      const x = giaTriSoSanh(a, k.id), y = giaTriSoSanh(b, k.id)
      const cmp = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'vi')
      if (cmp) return k.giam ? -cmp : cmp
    }
    return 0
  })
}

// Nhấn không giữ phím: thay toàn bộ thứ tự sắp xếp bằng đúng cột này.
// Nhấn giữ Shift: thêm hoặc đảo hướng cột này trong thứ tự sắp xếp nhiều cột.
export function doiKhoaSapXep(khoa: readonly KhoaSapXep[], id: CotId, giuNhieu: boolean): KhoaSapXep[] {
  const daCo = khoa.find(k => k.id === id)
  if (!giuNhieu) return daCo && khoa.length === 1 ? [{ id, giam: !daCo.giam }] : [{ id, giam: false }]
  if (!daCo) return [...khoa, { id, giam: false }]
  if (!daCo.giam) return khoa.map(k => k.id === id ? { id, giam: true } : k)
  return khoa.filter(k => k.id !== id)
}

export function huongSapXep(khoa: readonly KhoaSapXep[], id: CotId): 'ascending' | 'descending' | 'none' {
  const k = khoa.find(item => item.id === id)
  return k ? (k.giam ? 'descending' : 'ascending') : 'none'
}

// Tổng của một cột trên đúng những dòng đang hiển thị. Trả về null khi cột không
// cộng được hoặc tổng vượt giới hạn an toàn của số nguyên.
export function tongCot(rows: readonly GiaoDichTinh[], id: CotId): number | null {
  const cot = cotNhatKy.find(c => c.id === id)
  if (!cot?.congDon) return null
  let tong = 0
  for (const r of rows) {
    const giaTri = giaTriSoSanh(r, id)
    if (typeof giaTri !== 'number') return null
    tong += giaTri
    if (!Number.isSafeInteger(tong)) return null
  }
  return tong
}
