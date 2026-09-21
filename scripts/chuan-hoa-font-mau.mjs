// Chỉ sửa mẫu trong repo; không chạm tài liệu hoặc mẫu đã lưu trong DB.
import { readFile, writeFile } from 'node:fs/promises'
import { docZip, ghiZip } from '../lib/van-ban/zip.ts'

const file = new URL('../Mau/tiep khach va thanh toan.docx', import.meta.url)
const entries = docZip(await readFile(file))
const document = entries.find(e => e.ten === 'word/document.xml')
let active = false, sections = 0, runs = 0
const properties = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/>'
document.duLieu = Buffer.from(document.duLieu.toString('utf8').replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p => {
  const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').normalize('NFC').trim()
  if (text.startsWith('Căn cứ')) { active = true; sections++ }
  if (/^(DUYỆT CỦA|NGÂN HÀNG)/.test(text)) active = false
  if (!active) return p
  return p.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, run => {
    runs++
    const clean = run.replace(/<w:rFonts\b[^>]*\/>|<w:sz(?:Cs)?\b[^>]*\/>/g, '')
    if (/<w:rPr(?:\s[^>]*)?>/.test(clean)) return clean.replace(/<w:rPr(?:\s[^>]*)?>/, m => m + properties)
    return clean.replace(/<w:r(?:\s[^>]*)?>/, m => m + `<w:rPr>${properties}</w:rPr>`)
  })
}))
if (sections !== 2 || !runs) throw new Error('Không tìm đủ hai phần nội dung; không ghi mẫu.')
await writeFile(file, ghiZip(entries))
console.log(`Đã chuẩn hóa ${sections} phần nội dung, ${runs} run: Times New Roman 14pt.`)
