import { beforeEach, describe, expect, it } from 'vitest'
import {
  CAU_HINH_INTAKE_MAC_DINH,
  KHOA_CAU_HINH_INTAKE,
  anKhoaIntake,
  bamAgentToken,
  docCauHinhIntakeTuRows,
  giaiMaBiMat,
  maHoaBiMat,
  soKhopAgentToken,
} from './cau-hinh'

beforeEach(() => { process.env.INTAKE_TOKEN_ENCRYPTION_KEY = 'test-encryption-key' })

describe('cấu hình intake', () => {
  it('giữ mặc định 180 giây, Hoàn tạm ứng và tự lưu', () => {
    expect(docCauHinhIntakeTuRows([])).toMatchObject({
      timeoutGiay: 180,
      hinhThucMacDinh: CAU_HINH_INTAKE_MAC_DINH.hinhThucMacDinh,
      tuLuuHetHan: true,
    })
  })

  it('giới hạn timeout và che token khỏi dữ liệu giao diện', () => {
    const config = docCauHinhIntakeTuRows([{ khoa: KHOA_CAU_HINH_INTAKE, gia_tri: {
      timeoutGiay: 99999, botTokenMaHoa: 'encrypted', agentTokenHash: bamAgentToken('agent'),
    } }])
    expect(config.timeoutGiay).toBe(3600)
    const display = anKhoaIntake(config)
    expect(display).toMatchObject({ coBotToken: true, coAgentToken: true })
    expect(JSON.stringify(display)).not.toContain('encrypted')
    expect(JSON.stringify(display)).not.toContain(bamAgentToken('agent'))
  })

  it('mã hóa token bot và so khớp agent constant-time', () => {
    const encrypted = maHoaBiMat('123456:bot-secret')
    expect(giaiMaBiMat(encrypted)).toBe('123456:bot-secret')
    expect(soKhopAgentToken('agent-secret', bamAgentToken('agent-secret'))).toBe(true)
    expect(soKhopAgentToken('agent-other', bamAgentToken('agent-secret'))).toBe(false)
  })
})

