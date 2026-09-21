export type DonViTiepKhach = {
  id: string
  ten: string
  lan_cuoi?: string
  so_lan?: number
}

function boDau(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

export function giongTenDonVi(a: string, b: string): boolean {
  return boDau(a) === boDau(b)
}

export function locDonViTheoTen(ds: readonly DonViTiepKhach[], chu: string): DonViTiepKhach[] {
  const q = boDau(chu)
  if (!q) return [...ds]
  return ds.filter(dv => boDau(dv.ten).includes(q))
}

function soLan(dv: DonViTiepKhach): number {
  return dv.so_lan ?? (dv.lan_cuoi ? 1 : 0)
}

// lan_cuoi trên form là DD/MM/YYYY; so chuỗi sẽ xếp 15/01 sau 01/03. Đổi sang ISO để so đúng.
function ngayCuoi(dv: DonViTiepKhach): string {
  const s = dv.lan_cuoi ?? ''
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s
}

// Ưu tiên: chưa tiếp lần nào → tiếp ít lần nhất → lần tiếp xa nhất → tên.
export function sapXepDonViTiepKhach(ds: readonly DonViTiepKhach[]): DonViTiepKhach[] {
  return [...ds].sort((a, b) => {
    const lanA = soLan(a), lanB = soLan(b)
    if (lanA === 0 && lanB !== 0) return -1
    if (lanB === 0 && lanA !== 0) return 1
    if (lanA !== lanB) return lanA - lanB
    if (ngayCuoi(a) !== ngayCuoi(b)) return ngayCuoi(a).localeCompare(ngayCuoi(b))
    return a.ten.localeCompare(b.ten, 'vi')
  })
}

export function donViMacDinh(ds: readonly DonViTiepKhach[]): DonViTiepKhach | undefined {
  return sapXepDonViTiepKhach(ds)[0]
}

export function timDonViTheoTen(ds: readonly DonViTiepKhach[], ten: string): DonViTiepKhach | undefined {
  const q = boDau(ten)
  if (!q) return
  return ds.find(dv => boDau(dv.ten) === q)
}
