import { createCanvas } from '@napi-rs/canvas'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { quetQr, veTrangHoaDon } from './doc-anh'

describe('quét QR từ ảnh hóa đơn', () => {
  it('đọc payload hóa đơn điện tử từ PNG', async () => {
    const payload = '0101234567|1C26MTT|00001234|2026-09-17|1250000|M1-26-ABC'
    const png = await QRCode.toBuffer(payload, { type: 'png', width: 400, margin: 2, errorCorrectionLevel: 'M' })
    const anh = await veTrangHoaDon(png, 'image/png')
    expect(quetQr(anh)).toMatchObject({
      mstBanHang: '0101234567', kyHieuHd: '1C26MTT', soHd: '00001234',
      ngay: '2026-09-17', tongTien: 1_250_000,
    })
  })

  it('ảnh trống thì không bịa QR', async () => {
    const canvas = createCanvas(80, 80)
    canvas.getContext('2d').fillStyle = '#fff'
    canvas.getContext('2d').fillRect(0, 0, 80, 80)
    const anh = await veTrangHoaDon(canvas.toBuffer('image/png'), 'image/png')
    expect(quetQr(anh)).toBeNull()
  })

  it('dựng được trang 1 của PDF tối thiểu', async () => {
    const pdf = Buffer.from(
      '255044462d312e340a312030206f626a3c3c202f54797065202f436174616c6f67202f5061676573203220302052203e3e656e646f626a0a322030206f626a3c3c202f54797065202f5061676573202f4b696473205b33203020525d202f436f756e742031203e3e656e646f626a0a332030206f626a3c3c202f54797065202f50616765202f506172656e74203220302052202f4d65646961426f78205b30203020323030203230305d203e3e656e646f626a0a787265660a3020340a303030303030303030302036353533352066200a30303030303030303039203030303030206e200a30303030303030303536203030303030206e200a30303030303030313131203030303030206e200a747261696c65723c3c202f53697a652034202f526f6f74203120302052203e3e0a7374617274787265660a3138300a2525454f46',
      'hex',
    )
    const anh = await veTrangHoaDon(pdf, 'application/pdf', 400)
    expect(anh.width).toBe(400)
    expect(anh.height).toBe(400)
    expect(anh.png.length).toBeGreaterThan(100)
    expect(quetQr(anh)).toBeNull()
  }, 20_000)

  it('đọc QR TLV từ PNG (khuôn MISA/TCT)', async () => {
    const payload = '00020199990035DH8KPZX3K3HBAV9VFJ71ZHJ0XFPTNR2QGDJ01100108021157020110306C26MLD040416560508202609110607243916063040427'
    const png = await QRCode.toBuffer(payload, { type: 'png', width: 400, margin: 2, errorCorrectionLevel: 'M' })
    expect(quetQr(await veTrangHoaDon(png, 'image/png'))).toMatchObject({
      mstBanHang: '0108021157', kyHieuHd: '1C26MLD', soHd: '00001656',
      ngay: '2026-09-11', tongTien: 2_439_160,
    })
  })

  it('đọc QR TLV từ PDF hóa đơn mẫu nếu có trong thư mục dự án', async () => {
    const tep = join(process.cwd(), '1C26MLD_00001656_0100695387-066.pdf')
    if (!existsSync(tep)) return
    const anh = await veTrangHoaDon(await readFile(tep), 'application/pdf')
    expect(quetQr(anh)).toMatchObject({
      mstBanHang: '0108021157', kyHieuHd: '1C26MLD', soHd: '00001656',
      ngay: '2026-09-11', tongTien: 2_439_160,
    })
  }, 20_000)
})
