// Tạm: kiểm kê phần tử XML trong hai mẫu để thiết kế bộ chuyển DOCX sang HTML.
import { readFile } from 'node:fs/promises'
import { docZip } from '../lib/van-ban/zip.ts'

for (const ten of ['Mau/tiep khach va thanh toan.docx', 'Mau/Tam ung tien.docx']) {
  const entries = docZip(await readFile(new URL('../' + ten, import.meta.url)))
  const xml = entries.find(e => e.ten === 'word/document.xml').duLieu.toString('utf8')
  const tags = new Map()
  for (const m of xml.matchAll(/<(\/?)([\w:]+)((?:\s[^<>]*?)?)\/?>/g)) {
    if (m[1] === '/') continue
    const key = m[2] + (m[3].endsWith('/') ? ' (tự đóng)' : '')
    tags.set(key, (tags.get(key) ?? 0) + 1)
  }
  console.log('=== ' + ten)
  for (const [k, v] of [...tags].sort()) console.log(String(v).padStart(5), k)
}
