import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { diaChi } from './cau-hinh'
import { kyJwt, kyUrl, docUrl } from './jwt'
import { laId } from './tai-lieu'

const folder = () => path.join(tmpdir(), 'finance-word-preview')
const lifetime = 15 * 60 * 1000
// Bản nháp riêng, không tạo giao dịch, tài liệu hay phiên bản trong DB.
export async function taoBanXem(data: Buffer, title: string) {
  const urls = diaChi()
  const id = randomUUID()
  const token = kyUrl({ purpose: 'word-preview', id })
  await mkdir(folder(), { recursive: true, mode: 0o700 })
  for (const name of await readdir(folder())) {
    if (!/^[a-f0-9-]+\.docx$/.test(name)) continue
    const file = path.join(folder(), name)
    try { if (Date.now() - (await stat(file)).mtimeMs > lifetime) await unlink(file) } catch { /* Một request khác đã dọn. */ }
  }
  await writeFile(path.join(folder(), `${id}.docx`), data, { flag: 'wx', mode: 0o600 })
  const config = {
    documentType: 'word', width: '100%', height: '700px',
    document: { fileType: 'docx', key: `preview-${id}`, title,
      url: `${urls.app}/api/onlyoffice/xem-truoc?t=${token}`,
      permissions: { edit: false, download: true, print: true, review: false, comment: false } },
    editorConfig: { mode: 'view', lang: 'vi' },
  }
  return { script: `${urls.public}/web-apps/apps/api/documents/api.js`, config: { ...config, token: kyJwt(config) } }
}
export async function docBanXem(token: string | null) {
  const claim = docUrl(token)
  if (claim.purpose !== 'word-preview' || typeof claim.id !== 'string' || !laId(claim.id)) throw new Error('Sai bản nháp')
  const file = path.join(folder(), `${claim.id}.docx`)
  if (Date.now() - (await stat(file)).mtimeMs > lifetime) throw new Error('Bản nháp hết hạn')
  return readFile(file)
}
