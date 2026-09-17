import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dienChoTrong, dienMauDocx, TEP_NOI_DUNG } from './docx'
import { crc32, docZip, ghiZip } from './zip'

const thuMucMau = fileURLToPath(new URL('../../Mau/', import.meta.url))
const mauTamUng = readFileSync(`${thuMucMau}Tam ung tien.docx`)
const mauTiepKhach = readFileSync(`${thuMucMau}tiep khach va thanh toan.docx`)

// Gộp text của các run trong từng đoạn, giống cách Word hiển thị, để khẳng định
// nội dung sau khi điền chứ không kiểm tra XML thô.
function docDoan(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
    .map(p => [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map(r => r[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&'))
      .join(''))
}

const noiDung = (tep: Buffer) => {
  const muc = docZip(tep).find(m => m.ten === TEP_NOI_DUNG)
  if (!muc) throw new Error('thiếu word/document.xml')
  return muc.duLieu.toString('utf8')
}

const duLieuTamUng = {
  ngay: '20', thang: '9', nam: '2026',
  gioi_tinh: 'Ông', bangiamdoc: 'Nguyễn Văn A', chucdanh: 'Giám đốc',
  sotien: '1.500.000', sotienbangchu: 'Một triệu năm trăm nghìn đồng',
  CK: '☒ Chuyển khoản', TM: '☐ Tiền mặt',
}

const duLieuTiepKhach = {
  PHONGTK: 'P. HÀNH CHÍNH TỔ CHỨC', PHONGTKVT: 'Phòng Hành chính Tổ chức',
  ngaytk: '20', thangtk: '9', namtk: '2026', thang: '9', nam: '2026',
  gioi_tinhtk: 'Ông', bangiamdoctk: 'Nguyễn Văn A', chucdanhtk: 'Giám đốc',
  gioi_tinhtt: 'Bà', bangiamdoctt: 'Trần Thị B', chucdanhtt: 'Phó Giám đốc',
  donvitiepkhac: 'Phòng Tổ chức', sotiendukien: '2.000.000', sotiendukienbangchu: 'Hai triệu đồng',
  sotientt: '1.700.000', sotienttbangchu: 'Một triệu bảy trăm nghìn đồng',
  mahoadon: '1C26MTT', sohoadon: '00123456', ketoankiemsoat: 'Lê Thị C', nguoidntk: 'Phạm Văn Hiệp',
}

describe('zip', () => {
  it('đọc được mọi mục của tệp .docx thật', () => {
    const ten = docZip(mauTamUng).map(m => m.ten).sort()
    expect(ten).toContain(TEP_NOI_DUNG)
    expect(ten).toContain('[Content_Types].xml')
    expect(ten).toContain('word/styles.xml')
  })

  it('ghi rồi đọc lại thì nội dung từng mục không đổi', () => {
    const goc = docZip(mauTiepKhach)
    const lai = docZip(ghiZip(goc))
    expect(lai.map(m => m.ten)).toEqual(goc.map(m => m.ten))
    for (const m of goc) expect(lai.find(x => x.ten === m.ten)!.duLieu.equals(m.duLieu)).toBe(true)
  })

  it('crc32 khớp bảng kiểm chuẩn', () => {
    expect(crc32(Buffer.from(''))).toBe(0)
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })
})

describe('dienChoTrong', () => {
  it('điền được chỗ trống bị Word cắt vỡ qua nhiều run', () => {
    const xml = '<w:p><w:r><w:t>Kính gửi: [[gioi_tin</w:t></w:r><w:r><w:t>h]] [[bangiamdoc]]</w:t></w:r></w:p>'
    const { xml: ketQua, thieu } = dienChoTrong(xml, { gioi_tinh: 'Ông', bangiamdoc: 'Nguyễn Văn A' })
    expect(thieu).toEqual([])
    expect(docDoan(ketQua)).toEqual(['Kính gửi: Ông Nguyễn Văn A'])
  })

  it('giữ nguyên chỗ trống chưa có dữ liệu và báo lại tên', () => {
    const xml = '<w:p><w:r><w:t>[[khong_co]] và [[co]]</w:t></w:r></w:p>'
    const { xml: ketQua, thieu } = dienChoTrong(xml, { co: 'X' })
    expect(thieu).toEqual(['khong_co'])
    expect(docDoan(ketQua)).toEqual(['[[khong_co]] và X'])
  })

  it('giữ khoảng trắng đầu cuối bằng xml:space khi cần', () => {
    const xml = '<w:p><w:r><w:t>a [[x]] b</w:t></w:r></w:p>'
    const { xml: ketQua } = dienChoTrong(xml, { x: ' giữa ' })
    expect(ketQua).toContain('xml:space="preserve"')
    expect(docDoan(ketQua)).toEqual(['a  giữa  b'])
  })

  it('thoát ký tự XML trong dữ liệu điền vào', () => {
    const { xml: ketQua } = dienChoTrong('<w:p><w:r><w:t>[[x]]</w:t></w:r></w:p>', { x: 'A & B <C>' })
    expect(ketQua).toContain('A &amp; B &lt;C&gt;')
    expect(docDoan(ketQua)).toEqual(['A & B <C>'])
  })

  it('áp dụng được phần thay cố định bằng biểu thức chính quy', () => {
    const xml = '<w:p><w:r><w:t>Độc lập - Tự do - Tự do</w:t></w:r></w:p>'
    const { xml: ketQua } = dienChoTrong(xml, {}, [{ mau: /Tự do - Tự do/, thay: 'Tự do - Hạnh phúc' }])
    expect(docDoan(ketQua)).toEqual(['Độc lập - Tự do - Hạnh phúc'])
  })
})

describe('dienMauDocx trên tệp mẫu thật', () => {
  it('điền hết chỗ trống của giấy đề nghị tạm ứng', () => {
    const { duLieu, thieu } = dienMauDocx(mauTamUng, duLieuTamUng, [{ mau: /Tự do - Tự do/, thay: 'Tự do - Hạnh phúc' }])
    expect(thieu).toEqual([])
    const doan = docDoan(noiDung(duLieu))
    expect(doan).toContain('Hà Nội, ngày 20 tháng 9 năm 2026')
    expect(doan).toContain('Kính gửi: Ông Nguyễn Văn A – Giám đốc Trung tâm Đào tạo')
    expect(doan).toContain('Số tiền đề nghị tạm ứng: 1.500.000 đ')
    expect(doan).toContain('Bằng chữ: Một triệu năm trăm nghìn đồng.')
    expect(doan).toContain('Hình thức tạm ứng: ☒ Chuyển khoản ☐ Tiền mặt.')
    expect(doan).toContain('Nguyễn Văn A')
    expect(doan).toContain('Độc lập - Tự do - Hạnh phúc')
    expect(noiDung(duLieu)).not.toContain('[[')
  })

  it('điền hết chỗ trống của giấy tiếp khách và giấy thanh toán', () => {
    const { duLieu, thieu } = dienMauDocx(mauTiepKhach, duLieuTiepKhach, [
      { mau: /\]\]\/\s+\[\[/g, thay: ']]/[[' },
      { mau: /(ngày)\s+tháng/, thay: '$1 20 tháng' },
      { mau: /P\. HÀNH CHÍNH TỔ CHỨC/, thay: 'P. HÀNH CHÍNH TỔ CHỨC' },
    ])
    expect(thieu).toEqual([])
    const doan = docDoan(noiDung(duLieu))
    expect(doan).toContain('P. HÀNH CHÍNH TỔ CHỨC')
    expect(doan).toContain('Hà Nội, ngày 20 tháng 9 năm 2026')
    expect(doan).toContain('Đối tượng tiếp khách: Phòng Tổ chức.')
    expect(doan).toContain('Ngày tiếp khách: 20/9/2026')
    expect(doan).toContain('Kinh phí dự kiến: 2.000.000đ')
    expect(doan).toContain('(Bằng chữ: Hai triệu đồng đồng)')
    expect(doan).toContain('2. Số tiền đề nghị thanh toán: 1.700.000 đồng')
    expect(doan).toContain('- Hóa đơn mã 1C26MTT, số 00123456, ngày 20/9/2026;')
    expect(doan).toContain('Căn cứ Giấy đề nghị tiếp khách đã được phê duyệt ngày 20/9/2026 của Phòng Hành chính Tổ chức, nay bộ phận được giao tiếp khách đề nghị thanh toán chi phí tiếp khách với nội dung như sau:')
    expect(doan).toContain('Trần Thị B')
    expect(doan).toContain('Lê Thị C')
    expect(doan).toContain('Phạm Văn Hiệp')
    expect(noiDung(duLieu)).not.toContain('[[')
  })

  it('tệp sinh ra vẫn giữ đủ các mục để Word mở được', () => {
    const goc = docZip(mauTamUng)
    const { duLieu } = dienMauDocx(mauTamUng, duLieuTamUng)
    expect(docZip(duLieu).map(m => m.ten)).toEqual(goc.map(m => m.ten))
  })

  it('từ chối tệp không phải .docx', () => {
    expect(() => dienMauDocx(Buffer.from('không phải zip'), {})).toThrow('ZIP')
  })
})
