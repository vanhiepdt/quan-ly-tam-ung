// Điền thông tin vào tệp .docx mẫu.
//
// Word cắt một câu thành nhiều "run" tuỳ theo lần gõ và định dạng, nên chỗ trống
// [[ten]] thường bị vỡ thành nhiều mảnh, có khi cả dấu tiếng Việt cũng bị tách
// ("đ" + "ề"). Vì vậy không thể thay chuỗi trên XML thô: phải gộp text của các run
// trong từng đoạn, tìm chỗ trống trên chuỗi đã gộp, rồi ghi kết quả trở lại đúng run
// chứa nó và xoá phần còn lại ở các run sau.
import { docZip, ghiZip } from './zip'

export type ThayTheCoDinh = { mau: RegExp; thay: string }

export type KetQuaDien = { xml: string; thieu: string[] }

function giaiXml(chuoi: string): string {
  return chuoi
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, ma) => String.fromCodePoint(parseInt(ma, 16)))
    .replace(/&#(\d+);/g, (_, ma) => String.fromCodePoint(Number(ma)))
    .replace(/&amp;/g, '&')
}

function maXml(chuoi: string): string {
  return chuoi.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const RE_RUN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
const RE_DOAN = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g
const RE_CHO_TRONG = /\[\[([A-Za-z_][A-Za-z0-9_]*)\]{1,2}/g

type Cho = { batDau: number; ketThuc: number; chuoi: string }

// Gắn lại từng ký tự của phần thay cố định vào run gốc của nó. Phần thay thường chỉ
// là bản gốc bị bỏ bớt hoặc chèn thêm vài ký tự (ví dụ "]]/ [[" -> "]]/[["), nên dò
// ký tự tương ứng trong bản gốc; ký tự không có trong bản gốc thì gán vào run đang
// đứng, nhờ vậy dấu "]]" vẫn nằm đúng run cũ thay vì dồn hết vào run đầu.
function ganRun(gocTrong: string, chuoi: string, runCua: readonly number[], viTriGoc: number): number[] {
  const run: number[] = []
  let i = 0
  for (let j = 0; j < chuoi.length; j++) {
    const ch = chuoi[j]
    if (i < gocTrong.length && gocTrong[i] === ch) { run.push(runCua[viTriGoc + i]); i++ ; continue }
    const tim = gocTrong.indexOf(ch, i)
    if (tim >= 0) { run.push(runCua[viTriGoc + tim]); i = tim + 1; continue }
    run.push(runCua[viTriGoc + Math.min(i, gocTrong.length - 1)])
  }
  return run
}

// Điền một đoạn văn. Trả về đoạn đã điền và danh sách chỗ trống chưa có dữ liệu.
function dienDoan(doan: string, giaTri: Record<string, string>, thayThe: readonly ThayTheCoDinh[], thieu: Set<string>): string {
  const runs = [...doan.matchAll(RE_RUN)]
  if (!runs.length) return doan
  const goc = runs.map(r => giaiXml(r[1]))
  const gop = goc.join('')
  const reThay = thayThe.map(t => ({ re: new RegExp(t.mau.source, t.mau.flags.includes('g') ? t.mau.flags : t.mau.flags + 'g'), thay: t.thay }))
  if (!gop.includes('[[') && !thayThe.some(t => new RegExp(t.mau.source, t.mau.flags.replace('g', '')).test(gop))) return doan

  const runCua: number[] = []
  for (let i = 0; i < goc.length; i++) for (let k = 0; k < goc[i].length; k++) runCua.push(i)

  // Phần thay cố định áp lên chuỗi gộp trước, rồi mới tìm chỗ trống trên kết quả: có
  // mẫu thay cắt ngang qua chính dấu ]] của một chỗ trống nên hai việc không thể làm
  // độc lập trên chuỗi gốc.
  const ungVien: Cho[] = []
  for (const t of reThay) {
    for (const m of gop.matchAll(t.re)) {
      if (m[0].length === 0) continue
      ungVien.push({ batDau: m.index, ketThuc: m.index + m[0].length, chuoi: m[0].replace(t.re, t.thay) })
    }
  }
  ungVien.sort((a, b) => a.batDau - b.batDau)
  const daThay: Cho[] = []
  for (const c of ungVien) if (!daThay.some(d => c.batDau < d.ketThuc && d.batDau < c.ketThuc)) daThay.push(c)

  const kyTu: { c: string; run: number }[] = []
  let viTri = 0
  for (const c of daThay) {
    for (let k = viTri; k < c.batDau; k++) kyTu.push({ c: gop[k], run: runCua[k] })
    const gocTrong = gop.slice(c.batDau, c.ketThuc)
    const runThay = ganRun(gocTrong, c.chuoi, runCua, c.batDau)
    for (let j = 0; j < c.chuoi.length; j++) kyTu.push({ c: c.chuoi[j], run: runThay[j] })
    viTri = c.ketThuc
  }
  for (let k = viTri; k < gop.length; k++) kyTu.push({ c: gop[k], run: runCua[k] })
  const chuoiMoi = kyTu.map(x => x.c).join('')

  const cho: Cho[] = []
  for (const m of chuoiMoi.matchAll(RE_CHO_TRONG)) {
    const ten = m[1]
    const giaTriThay = giaTri[ten]
    if (giaTriThay === undefined) { thieu.add(ten); continue }
    cho.push({ batDau: m.index, ketThuc: m.index + m[0].length, chuoi: giaTriThay })
  }

  const thayDoi: { tu: number; den: number; chuoi: string }[] = []
  for (let i = 0; i < runs.length; i++) {
    let moi = ''
    // Dữ liệu điền vào có thể bắt đầu hoặc kết thúc bằng dấu cách; nếu không bật
    // xml:space thì Word cắt mất dấu cách ở mép run.
    let coKhoang = false
    for (let k = 0; k < kyTu.length; k++) {
      if (kyTu[k].run !== i) continue
      const c = cho.find(x => k >= x.batDau && k < x.ketThuc)
      if (!c) { moi += kyTu[k].c; continue }
      // Nội dung thay chỉ ghi vào run chứa ký tự đầu của chỗ trống.
      if (k === c.batDau) { moi += c.chuoi; if (/^\s|\s$/.test(c.chuoi)) coKhoang = true }
    }
    if (moi === goc[i]) continue
    const batDauTrong = runs[i].index + runs[i][0].length - runs[i][1].length - '</w:t>'.length
    const theMo = doan.slice(runs[i].index, batDauTrong)
    const canGiuKhoang = (/^\s|\s$/.test(moi) || coKhoang) && !/xml:space=/.test(theMo)
    thayDoi.push({ tu: runs[i].index, den: batDauTrong + runs[i][1].length, chuoi: `${canGiuKhoang ? theMo.replace(/>$/, ' xml:space="preserve">') : theMo}${maXml(moi)}` })
  }
  let ketQua = doan
  for (const t of thayDoi.reverse()) ketQua = ketQua.slice(0, t.tu) + t.chuoi + ketQua.slice(t.den)
  return ketQua
}

export function dienChoTrong(xml: string, giaTri: Record<string, string>, thayThe: readonly ThayTheCoDinh[] = []): KetQuaDien {
  const thieu = new Set<string>()
  let ketQua = ''
  let viTri = 0
  for (const m of xml.matchAll(RE_DOAN)) {
    ketQua += xml.slice(viTri, m.index) + dienDoan(m[0], giaTri, thayThe, thieu)
    viTri = m.index + m[0].length
  }
  ketQua += xml.slice(viTri)
  return { xml: ketQua, thieu: [...thieu].sort() }
}

export const TEP_NOI_DUNG = 'word/document.xml'

// Mở tệp mẫu, điền vào word/document.xml rồi đóng gói lại thành .docx mới.
export function dienMauDocx(mau: Buffer, giaTri: Record<string, string>, thayThe: readonly ThayTheCoDinh[] = []): { duLieu: Buffer; thieu: string[] } {
  const muc = docZip(mau)
  const i = muc.findIndex(m => m.ten === TEP_NOI_DUNG)
  if (i < 0) throw new Error('Tệp mẫu không phải .docx hợp lệ: thiếu word/document.xml.')
  const { xml, thieu } = dienChoTrong(muc[i].duLieu.toString('utf8'), giaTri, thayThe)
  muc[i] = { ten: TEP_NOI_DUNG, duLieu: Buffer.from(xml, 'utf8') }
  return { duLieu: ghiZip(muc), thieu }
}
