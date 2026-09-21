import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ qr: vi.fn(), nho: vi.fn(), ai: vi.fn() }))
vi.mock('./doc-anh', () => ({ docQrTuTep: m.qr, thuNhoPng: m.nho }))
vi.mock('./ai-hoa-don', () => ({ docHoaDonBangAi: m.ai }))

import { docHoaDonHaiLop, thongDiepLoiVe } from './doc-hoa-don'

const donVi = { mst: '0100100100', ten: 'Trung tâm Đào tạo', diaChi: '' }
const qr = { mstBanHang: '0101234567', kyHieuHd: '1C', soHd: '1', ngay: '2026-09-17', tongTien: 200_000 }

beforeEach(() => {
  vi.resetAllMocks()
  m.qr.mockResolvedValue({ qr, anh: { png: Buffer.from('x') }, chu: [] })
  m.nho.mockResolvedValue(Buffer.from('y'))
  m.ai.mockResolvedValue({ duLieu: { tenBanHang: 'Nhà hàng A', mstMuaHang: '0100100100', tenMuaHang: 'Trung tâm Đào tạo' } })
})

describe('đọc hóa đơn hai lớp', () => {
  it('QR thắng, AI điền người bán/mua, đối chiếu MST đơn vị', async () => {
    const kq = await docHoaDonHaiLop(new Uint8Array([1]), 'application/pdf', donVi)
    expect(kq.deXuat).toMatchObject({ ...qr, tenBanHang: 'Nhà hàng A', mstMuaHang: '0100100100' })
    expect(kq.phatHien.some(p => p.ma === 'mst_khong_khop')).toBe(false)
    expect(m.ai).toHaveBeenCalledTimes(1)
  })

  it('MST người mua khác đơn vị thì lỗi, vẫn trả đề xuất', async () => {
    m.ai.mockResolvedValue({ duLieu: { mstMuaHang: '1111111111' } })
    const kq = await docHoaDonHaiLop(new Uint8Array([1]), 'image/png', donVi)
    expect(kq.trangThai).toBe('khong_hop_le')
    expect(kq.deXuat.soHd).toBe('1')
    expect(kq.phatHien.some(p => p.ma === 'mst_khong_khop')).toBe(true)
  })

  it('AI hỏng thì giữ QR và ghi rõ lý do', async () => {
    m.ai.mockResolvedValue({ loi: 'Chưa cấu hình khóa Anthropic (Claude) nên lớp AI không chạy. Chỉ dùng dữ liệu QR.' })
    const kq = await docHoaDonHaiLop(new Uint8Array([1]), 'application/pdf', donVi)
    expect(kq.deXuat.tongTien).toBe(200_000)
    expect(kq.phatHien.some(p => p.thongDiep.includes('Chưa cấu hình khóa'))).toBe(true)
    expect(kq.phatHien.some(p => p.ma === 'ai_khong_chay')).toBe(false)
  })

  it('cả hai lớp hỏng thì lỗi kỹ thuật, không bịa số', async () => {
    m.qr.mockRejectedValue(new Error('pdf'))
    const kq = await docHoaDonHaiLop(new Uint8Array([1]), 'application/pdf', donVi)
    expect(kq.trangThai).toBe('loi_ky_thuat')
    expect(kq.deXuat).toEqual({})
    expect(m.ai).not.toHaveBeenCalled()
    expect(kq.phatHien.some(p => p.ma === 'qr_loi_ve' && p.thongDiep.includes('pdf'))).toBe(true)
  })

  it('QR không có người mua thì OCR điền MST/tên/địa chỉ, AI đối chiếu', async () => {
    m.qr.mockResolvedValue({
      qr,
      anh: { png: Buffer.from('x') },
      chu: [
        { x: 31, y: 80, chu: 'Tên đơn vị : Trung tâm Đào tạo' },
        { x: 31, y: 70, chu: 'MST/CCCD chủ hộ : 0100100100' },
        { x: 31, y: 60, chu: 'Địa chỉ : 1 Đống Đa' },
      ],
    })
    m.ai.mockResolvedValue({ duLieu: { tenBanHang: 'Nhà hàng A' } })
    const kq = await docHoaDonHaiLop(new Uint8Array([1]), 'application/pdf', donVi)
    expect(kq.deXuat).toMatchObject({
      ...qr, tenMuaHang: 'Trung tâm Đào tạo', mstMuaHang: '0100100100', diaChiMuaHang: '1 Đống Đa',
    })
    expect(kq.ocr?.mstMuaHang).toBe('0100100100')
    expect(kq.phatHien.some(p => p.ma === 'mst_mua_thieu')).toBe(false)
    expect(m.ai.mock.calls[0][2]).toContain('0100100100')
  })

  it('không nhét đường dẫn hay khóa vào cảnh báo dựng ảnh', () => {
    expect(thongDiepLoiVe(new Error('Setting up fake worker failed: file:///D:/app/pdf.worker.mjs')))
      .toBe('Không dựng được ảnh trang hóa đơn để quét QR. Setting up fake worker failed:')
    expect(thongDiepLoiVe(new Error('sk-secret boom'))).toBe('Không dựng được ảnh trang hóa đơn để quét QR.')
  })
})
