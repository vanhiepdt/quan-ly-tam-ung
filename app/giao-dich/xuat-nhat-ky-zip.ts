import { ZipArchive } from 'archiver'
import { PassThrough } from 'node:stream'
import type { TepXuatNhatKy } from './xuat-nhat-ky-excel'

export async function taoZipNhatKy(workbook: Buffer, files: readonly TepXuatNhatKy[]): Promise<Buffer> {
  const output = new PassThrough()
  const chunks: Buffer[] = []
  const done = new Promise<void>((resolve, reject) => {
    output.on('data', chunk => chunks.push(Buffer.from(chunk)))
    output.once('end', resolve)
    output.once('error', reject)
  })
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const failed = new Promise<never>((_, reject) => archive.once('error', reject))
  archive.pipe(output)
  archive.append(workbook, { name: 'nhat-ky-giao-dich.xlsx' })
  for (const file of files) if (file.tonTai) archive.file(file.duongDan, { name: file.zipPath })
  await archive.finalize()
  await Promise.race([done, failed])
  return Buffer.concat(chunks)
}
