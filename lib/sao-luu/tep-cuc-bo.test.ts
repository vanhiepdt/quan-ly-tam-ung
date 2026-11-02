import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { dsTepSaoLuuCucBo, duongDanTepSaoLuu, TEN_GOI_SAO_LUU } from './tep-cuc-bo'

const temp = path.join(process.cwd(), 'tmp-sao-luu-test')

describe('TEN_GOI_SAO_LUU', () => {
  it('chỉ khớp đúng dạng tam-ung-YYYYMMDD-HHMMSS.tar.gz', () => {
    expect(TEN_GOI_SAO_LUU.test('tam-ung-20261102-170000.tar.gz')).toBe(true)
    expect(TEN_GOI_SAO_LUU.test('tam-ung-20261102-170000.tar.bz2')).toBe(false)
    expect(TEN_GOI_SAO_LUU.test('../tam-ung-20261102-170000.tar.gz')).toBe(false)
    expect(TEN_GOI_SAO_LUU.test('tam-ung-2026-11-02-17:00.tar.gz')).toBe(false)
  })
})

describe('dsTepSaoLuuCucBo', () => {
  beforeEach(async () => { process.env.BACKUP_DIR = temp; await mkdir(temp, { recursive: true }) })
  afterEach(async () => { delete process.env.BACKUP_DIR; await rm(temp, { recursive: true, force: true }) })

  it('chỉ đọc tên khớp TEN_GOI_SAO_LUU, sắp xếp mới nhất trước', async () => {
    await Promise.all([
      writeFile(path.join(temp, 'tam-ung-20261101-170000.tar.gz'), 'a'),
      writeFile(path.join(temp, 'tam-ung-20261102-180000.tar.gz'), 'bb'),
      writeFile(path.join(temp, 'khac.tar.gz'), 'x'),
    ])
    const ds = await dsTepSaoLuuCucBo(10)
    expect(ds.length).toBe(2)
    expect(ds[0].ten).toBe('tam-ung-20261102-180000.tar.gz')
    expect(ds[0].kichThuoc).toBe(2)
    expect(ds[1].ten).toBe('tam-ung-20261101-170000.tar.gz')
  })

  it('trả mảng rỗng khi thư mục không tồn tại hoặc rỗng', async () => {
    await rm(temp, { recursive: true, force: true })
    expect(await dsTepSaoLuuCucBo()).toEqual([])
    await mkdir(temp)
    expect(await dsTepSaoLuuCucBo()).toEqual([])
  })
})

describe('duongDanTepSaoLuu', () => {
  beforeEach(async () => { process.env.BACKUP_DIR = temp; await mkdir(temp, { recursive: true }) })
  afterEach(async () => { delete process.env.BACKUP_DIR; await rm(temp, { recursive: true, force: true }) })

  it('trả đường dẫn chỉ khi tên hợp lệ và tệp có thật', async () => {
    const ten = 'tam-ung-20261103-170000.tar.gz'
    await writeFile(path.join(temp, ten), 'test')
    const tep = await duongDanTepSaoLuu(ten)
    expect(tep).toBeTruthy()
    expect(tep?.kichThuoc).toBe(4)
    expect(tep?.duongDan).toBe(path.join(temp, ten))
  })

  it('trả null với tên lạ hoặc path traversal', async () => {
    expect(await duongDanTepSaoLuu('../secret.tar.gz')).toBeNull()
    expect(await duongDanTepSaoLuu('khong-ton-tai.tar.gz')).toBeNull()
  })
})
