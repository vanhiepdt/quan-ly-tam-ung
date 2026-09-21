import { describe, expect, it } from 'vitest'
import { donViMacDinh, giongTenDonVi, locDonViTheoTen, sapXepDonViTiepKhach, timDonViTheoTen } from './don-vi'

const a = { id: 'a', ten: 'Phòng A', lan_cuoi: '01/01/2026', so_lan: 3 }
const b = { id: 'b', ten: 'Phòng B', lan_cuoi: '01/06/2026', so_lan: 1 }
const c = { id: 'c', ten: 'Phòng C' }
const d = { id: 'd', ten: 'Đơn vị D', lan_cuoi: '01/03/2026', so_lan: 1 }

describe('sắp xếp đơn vị tiếp khách', () => {
  it('ưu tiên chưa tiếp, rồi ít lần, rồi lần xa nhất', () => {
    expect(sapXepDonViTiepKhach([a, b, c, d]).map(x => x.id)).toEqual(['c', 'd', 'b', 'a'])
    expect(donViMacDinh([a, b, d])?.id).toBe('d')
    expect(donViMacDinh([a, b, c])?.id).toBe('c')
  })

  it('so ngày theo lịch, không so chuỗi DD/MM', () => {
    const e = { id: 'e', ten: 'Phòng E', lan_cuoi: '15/01/2026', so_lan: 1 }
    const f = { id: 'f', ten: 'Phòng F', lan_cuoi: '01/03/2026', so_lan: 1 }
    expect(sapXepDonViTiepKhach([f, e]).map(x => x.id)).toEqual(['e', 'f'])
  })

  it('tìm không phân biệt hoa thường / dấu', () => {
    expect(giongTenDonVi('Phòng Kế hoạch', 'phong ke hoach')).toBe(true)
    expect(timDonViTheoTen([a, b, c], 'phòng b')?.id).toBe('b')
    expect(locDonViTheoTen([a, b, c], 'phòng c').map(x => x.id)).toEqual(['c'])
    expect(locDonViTheoTen([a, b, c], '')).toHaveLength(3)
  })
})
