import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  config: vi.fn(), match: vi.fn(), invoice: vi.fn(), form: vi.fn(),
  worker: vi.fn(), ping: vi.fn(), db: vi.fn(),
}))

vi.mock('@/lib/intake/cau-hinh', () => ({
  docCauHinhIntake: m.config,
  soKhopAgentToken: m.match,
  capNhatTrangThaiAgent: m.ping,
  layTelegramBotToken: vi.fn(),
}))
vi.mock('@/lib/intake/doc-hoa-don', () => ({ docHoaDonIntake: m.invoice, deXuatGiaoDich: vi.fn() }))
vi.mock('@/lib/intake/intake', () => ({ taoIntakeHoaDon: vi.fn(), layMacDinhIntake: vi.fn() }))
vi.mock('@/lib/intake/worker', () => ({ chayWorkerIntake: m.worker, chatTelegramThongBao: vi.fn(() => []) }))
vi.mock('@/lib/intake/telegram', () => ({ telegramSendMessage: vi.fn() }))
vi.mock('@/lib/intake/telegram-format', () => ({ keyboardTomTat: vi.fn(), tomTatIntake: vi.fn(() => 'summary') }))
vi.mock('@/lib/db/pool', () => ({ db: { query: m.db } }))

import { POST } from './route'

const config = {
  dangAgent: true, dangBot: false, tuLuuHetHan: true, timeoutGiay: 180,
  hinhThucMacDinh: 'Hoàn tạm ứng', donViIdMacDinh: null, hinhThucThanhToanMacDinh: 'tien_mat',
  nguoiDungHeThongId: null, allowlist: [], botTokenMaHoa: '', agentTokenHash: 'hash',
  webhookDaDat: false, webhookDatLuc: null, agentPingLuc: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  m.config.mockResolvedValue(config)
  m.match.mockReturnValue(false)
  m.db.mockResolvedValue({ rows: [{ so_luong: 0 }] })
})

describe('POST /api/intake/scan', () => {
  it('trả 401 với token agent sai và không đọc multipart/hóa đơn', async () => {
    const body = new FormData()
    body.set('file', new File([new Uint8Array([1, 2, 3])], 'a.pdf', { type: 'application/pdf' }))
    const request = new Request('http://localhost/api/intake/scan', {
      method: 'POST', headers: { authorization: 'Bearer wrong', 'content-type': 'multipart/form-data' }, body,
    })
    const formData = vi.spyOn(request, 'formData')
    expect((await POST(request)).status).toBe(401)
    expect(formData).not.toHaveBeenCalled()
    expect(m.invoice).not.toHaveBeenCalled()
  })

  it('không nhận file khi agent đã tắt', async () => {
    m.match.mockReturnValue(true)
    m.config.mockResolvedValue({ ...config, dangAgent: false })
    const request = new Request('http://localhost/api/intake/scan', { method: 'POST', headers: { authorization: 'Bearer valid' } })
    expect((await POST(request)).status).toBe(403)
    expect(m.invoice).not.toHaveBeenCalled()
  })
})

