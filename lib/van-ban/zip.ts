// Đọc và ghi tệp ZIP tối thiểu, đủ để mở một tệp .docx, thay nội dung một mục rồi
// đóng gói lại. Không dùng thư viện ngoài: chỉ cần zlib có sẵn của Node.
import { deflateRawSync, inflateRawSync } from 'node:zlib'

export type MucZip = { ten: string; duLieu: Buffer }

const CHU_KY_CUC_BO = 0x04034b50
const CHU_KY_TRUNG_TAM = 0x02014b50
const CHU_KY_KET_THUC = 0x06054b50
// 2026-01-01 00:00:00 theo định dạng thời gian của ZIP. Cố định để tệp sinh ra
// giống nhau ở mọi lần chạy.
const GIO_ZIP = 0
const NGAY_ZIP = ((2026 - 1980) << 9) | (1 << 5) | 1

const BANG_CRC = (() => {
  const bang = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    bang[i] = c >>> 0
  }
  return bang
})()

export function crc32(duLieu: Buffer): number {
  let c = 0xffffffff
  for (const byte of duLieu) c = BANG_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function timKetThuc(zip: Buffer): number {
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === CHU_KY_KET_THUC) return i
  }
  throw new Error('Tệp không phải ZIP hợp lệ: không tìm thấy phần kết thúc.')
}

export function docZip(zip: Buffer, maxOutputLength = 50 * 1024 * 1024): MucZip[] {
  const ketThuc = timKetThuc(zip)
  const soMuc = zip.readUInt16LE(ketThuc + 10)
  let viTri = zip.readUInt32LE(ketThuc + 16)
  const muc: MucZip[] = []
  for (let i = 0; i < soMuc; i++) {
    if (zip.readUInt32LE(viTri) !== CHU_KY_TRUNG_TAM) throw new Error('Tệp ZIP hỏng: mục trong thư mục trung tâm sai chữ ký.')
    const phuongPhap = zip.readUInt16LE(viTri + 10)
    const nén = zip.readUInt32LE(viTri + 20)
    const tenDai = zip.readUInt16LE(viTri + 28)
    const themDai = zip.readUInt16LE(viTri + 30)
    const ghiChuDai = zip.readUInt16LE(viTri + 32)
    const dauCucBo = zip.readUInt32LE(viTri + 42)
    const ten = zip.toString('utf8', viTri + 46, viTri + 46 + tenDai)
    if (zip.readUInt32LE(dauCucBo) !== CHU_KY_CUC_BO) throw new Error(`Tệp ZIP hỏng: mục ${ten} sai chữ ký ở đầu.`)
    // Độ dài tên và phần mở rộng phải lấy từ đầu cục bộ, vì thư mục trung tâm có thể khai khác.
    const batDau = dauCucBo + 30 + zip.readUInt16LE(dauCucBo + 26) + zip.readUInt16LE(dauCucBo + 28)
    const tho = zip.subarray(batDau, batDau + nén)
    if (phuongPhap !== 0 && phuongPhap !== 8) throw new Error('Phương pháp nén ZIP không được hỗ trợ.')
    if (maxOutputLength <= 0) throw new Error('Dữ liệu giải nén vượt giới hạn.')
    const duLieu = phuongPhap === 8 ? inflateRawSync(tho, { maxOutputLength }) : Buffer.from(tho)
    maxOutputLength -= duLieu.length
    if (maxOutputLength < 0) throw new Error('Dữ liệu giải nén vượt giới hạn.')
    muc.push({ ten, duLieu })
    viTri += 46 + tenDai + themDai + ghiChuDai
  }
  return muc
}

export function ghiZip(muc: readonly MucZip[]): Buffer {
  const phan: Buffer[] = []
  const trungTam: Buffer[] = []
  let viTri = 0
  for (const m of muc) {
    const ten = Buffer.from(m.ten, 'utf8')
    const crc = crc32(m.duLieu)
    const nén = deflateRawSync(m.duLieu, { level: 9 })
    const cucBo = Buffer.alloc(30 + ten.length)
    cucBo.writeUInt32LE(CHU_KY_CUC_BO, 0)
    cucBo.writeUInt16LE(20, 4)
    cucBo.writeUInt16LE(0, 6)
    cucBo.writeUInt16LE(8, 8)
    cucBo.writeUInt16LE(GIO_ZIP, 10)
    cucBo.writeUInt16LE(NGAY_ZIP, 12)
    cucBo.writeUInt32LE(crc, 14)
    cucBo.writeUInt32LE(nén.length, 18)
    cucBo.writeUInt32LE(m.duLieu.length, 22)
    cucBo.writeUInt16LE(ten.length, 26)
    cucBo.writeUInt16LE(0, 28)
    ten.copy(cucBo, 30)
    phan.push(cucBo, nén)

    const o = Buffer.alloc(46 + ten.length)
    o.writeUInt32LE(CHU_KY_TRUNG_TAM, 0)
    o.writeUInt16LE(20, 4)
    o.writeUInt16LE(20, 6)
    o.writeUInt16LE(0, 8)
    o.writeUInt16LE(8, 10)
    o.writeUInt16LE(GIO_ZIP, 12)
    o.writeUInt16LE(NGAY_ZIP, 14)
    o.writeUInt32LE(crc, 16)
    o.writeUInt32LE(nén.length, 20)
    o.writeUInt32LE(m.duLieu.length, 24)
    o.writeUInt16LE(ten.length, 28)
    o.writeUInt16LE(0, 30)
    o.writeUInt16LE(0, 32)
    o.writeUInt16LE(0, 34)
    o.writeUInt16LE(0, 36)
    o.writeUInt32LE(0, 38)
    o.writeUInt32LE(viTri, 42)
    ten.copy(o, 46)
    trungTam.push(o)
    viTri += cucBo.length + nén.length
  }
  const thuMuc = Buffer.concat(trungTam)
  const ketThuc = Buffer.alloc(22)
  ketThuc.writeUInt32LE(CHU_KY_KET_THUC, 0)
  ketThuc.writeUInt16LE(0, 4)
  ketThuc.writeUInt16LE(0, 6)
  ketThuc.writeUInt16LE(muc.length, 8)
  ketThuc.writeUInt16LE(muc.length, 10)
  ketThuc.writeUInt32LE(thuMuc.length, 12)
  ketThuc.writeUInt32LE(viTri, 16)
  ketThuc.writeUInt16LE(0, 20)
  return Buffer.concat([...phan, thuMuc, ketThuc])
}
