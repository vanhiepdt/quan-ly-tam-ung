import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
  createHash: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  zip: vi.fn(),
}))

vi.mock('node:crypto', () => ({ randomUUID: mocks.randomUUID, createHash: mocks.createHash }))
vi.mock('node:fs/promises', () => ({ mkdir: mocks.mkdir, writeFile: mocks.writeFile }))
vi.mock('@/lib/db/pool', () => ({ db: {}, trongTransaction: vi.fn() }))
vi.mock('@/lib/van-ban/zip', () => ({ docZip: mocks.zip }))

import { capNhatTaiLieuGiay, LoiTaiLieuDangMo } from './tai-lieu'

const nguoiDung = '11111111-1111-4111-8111-111111111111'
const giaoDich = '22222222-2222-4222-8222-222222222222'
const tepMoi = '33333333-3333-4333-8333-333333333333'

// Tệp DOCX tối thiểu cho bộ kiểm tra ZIP: central-directory trống tên + EOCD, còn
// bộ đọc ZIP được mock để xác nhận đây là một Word document hợp lệ.
function docxToiThieu() {
  const data = Buffer.alloc(68)
  data.writeUInt32LE(0x02014b50, 0)
  data.writeUInt32LE(0, 24)
  data.writeUInt32LE(0x06054b50, 46)
  data.writeUInt16LE(1, 56)
  data.writeUInt32LE(0, 62)
  return data
}

const taiLieuCu = {
  id: '44444444-4444-4444-8444-444444444444', giao_dich_id: giaoDich,
  loai: 'tiep_khach', ten_mau: null, phien_ban: 2, tep: '55555555-5555-4555-8555-555555555555', khoa: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.randomUUID.mockReturnValue(tepMoi)
  mocks.createHash.mockReturnValue({ update: () => ({ digest: () => 'sha-moi' }) })
  mocks.mkdir.mockResolvedValue(undefined)
  mocks.writeFile.mockResolvedValue(undefined)
  mocks.zip.mockReturnValue([{ ten: 'word/document.xml' }])
})

describe('capNhatTaiLieuGiay', () => {
  it('không ghi bất kỳ tệp nào khi tài liệu hiện hành đang mở trong OnlyOffice', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('select pg_advisory_xact_lock')) return { rows: [] }
      if (sql.includes('from tai_lieu where giao_dich_id')) return { rows: [{ ...taiLieuCu, khoa: 'onlyoffice-lock' }] }
      return { rows: [] }
    })
    const sinh = vi.fn(async () => docxToiThieu())

    await expect(capNhatTaiLieuGiay(nguoiDung, giaoDich, [{ loai: 'tiep_khach', sinh }], { query } as never))
      .rejects.toBeInstanceOf(LoiTaiLieuDangMo)

    expect(sinh).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('lưu bản Word mới thành phiên bản kế tiếp và giữ bản cũ trong lịch sử', async () => {
    const data = docxToiThieu()
    const moi = { ...taiLieuCu, tep: tepMoi, phien_ban: 3 }
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('select pg_advisory_xact_lock')) return { rows: [] }
      if (sql.includes('from tai_lieu where giao_dich_id')) return { rows: [taiLieuCu] }
      if (sql.startsWith('update tai_lieu')) return { rows: [moi] }
      return { rows: [] }
    })

    await expect(capNhatTaiLieuGiay(nguoiDung, giaoDich, [{ loai: 'tiep_khach', sinh: async () => data }], { query } as never))
      .resolves.toEqual([moi])

    expect(query).toHaveBeenCalledWith(
      'insert into tai_lieu_phien_ban(tai_lieu_id,phien_ban,tep,sha256,nguoi_luu) values($1,$2,$3,$4,$5)',
      [taiLieuCu.id, 3, tepMoi, 'sha-moi', nguoiDung],
    )
    expect(query).toHaveBeenCalledWith(
      'update tai_lieu set tep=$1, phien_ban=$2, sua_luc=now() where id=$3 returning *',
      [tepMoi, 3, taiLieuCu.id],
    )
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining(`${tepMoi}.docx`), data, { flag: 'wx' })
  })
})
