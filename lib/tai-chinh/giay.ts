import { docSoTien } from './doc-so'
import { canTaiKhoanNhan, hinhThucThanhToanMacDinh, NHAN_HINH_THUC_THANH_TOAN, oVuongTamUng } from './hinh-thuc'
import { HINH_THUC, type GiaoDichTinh, type TaiKhoanNhan } from './kieu'
import { dongTaiKhoan } from './tai-khoan'
import type { ThayTheCoDinh } from '@/lib/van-ban/docx'

// Ba giấy đề nghị in ra từ mẫu trong thư mục Mau/. Giấy nào dùng cho hình thức nào:
// tạm ứng thêm thì lập giấy đề nghị tạm ứng; hoàn tạm ứng và cơ quan trả thẳng thì
// lập giấy đề nghị tiếp khách trước, thanh toán sau.
export const LOAI_GIAY = { TAM_UNG: 'tam_ung', TIEP_KHACH: 'tiep_khach', THANH_TOAN: 'thanh_toan' } as const
export type LoaiGiay = typeof LOAI_GIAY[keyof typeof LOAI_GIAY]

export type CanBo = {
  id: string
  hoTen: string
  gioiTinh: string | null
  chucDanh: string | null
  phong: string | null
  laLanhDao: boolean
  dangHoatDong: boolean
}

export type CauHinhGiay = {
  nguoiDeNghiId: string | null
  lanhDaoTiepKhachId: string | null
  lanhDaoThanhToanId: string | null
  truongPhongId: string | null
  keToanKiemSoatId: string | null
  tenDonVi: string
  diaDanh: string
  lyDoTamUng: string
  thoiHanThanhToan: string
  // Người lấy hóa đơn dùng khi giao dịch chưa gắn người nào: tài khoản nhận tiền của họ
  // được in kèm khi thanh toán bằng chuyển khoản.
  nguoiLayHdMacDinhId: string | null
}

export const CAU_HINH_GIAY_MAC_DINH: CauHinhGiay = {
  nguoiDeNghiId: null, lanhDaoTiepKhachId: null, lanhDaoThanhToanId: null, truongPhongId: null, keToanKiemSoatId: null,
  tenDonVi: 'Trung tâm Đào tạo', diaDanh: 'Hà Nội',
  lyDoTamUng: 'Chi tiêu hành chính', thoiHanThanhToan: 'Sau khi hoàn thành công việc',
  nguoiLayHdMacDinhId: null,
}

// Hình thức "Giao tiền chị Thúy" và "Nộp hoàn CQ" là dòng tiền nội bộ, không có giấy.
const GIAY_THEO_HINH_THUC: Record<string, readonly LoaiGiay[]> = {
  [HINH_THUC.TAM_UNG_THEM]: [LOAI_GIAY.TAM_UNG],
  [HINH_THUC.HOAN_TAM_UNG]: [LOAI_GIAY.TIEP_KHACH, LOAI_GIAY.THANH_TOAN],
  [HINH_THUC.CQ_TRA_THANG]: [LOAI_GIAY.TIEP_KHACH, LOAI_GIAY.THANH_TOAN],
}

export function giayChoHinhThuc(hinhThuc: string): readonly LoaiGiay[] {
  return GIAY_THEO_HINH_THUC[hinhThuc] ?? []
}

export const TEN_GIAY: Record<LoaiGiay, string> = {
  [LOAI_GIAY.TAM_UNG]: 'Giấy đề nghị tạm ứng',
  [LOAI_GIAY.TIEP_KHACH]: 'Giấy đề nghị tiếp khách',
  [LOAI_GIAY.THANH_TOAN]: 'Giấy đề nghị thanh toán',
}

// Kinh phí dự kiến xin trước khi tiếp khách: làm tròn lên hàng 500.000 của tổng tiền
// trên hóa đơn, để con số xin không nhỏ hơn số thực chi.
export const BAC_LAM_TRON = 500_000

export function kinhPhiDuKien(tongTien: number): number {
  if (tongTien <= 0) return 0
  return Math.ceil(tongTien / BAC_LAM_TRON) * BAC_LAM_TRON
}

// Số tiền đề nghị thanh toán đúng bằng số hoàn ứng: tổng tiền trừ phần rượu bia loại trừ.
export function soTienThanhToan(gd: Pick<GiaoDichTinh, 'tongTien' | 'tienRuouBia'>): number {
  return Math.max(0, gd.tongTien - gd.tienRuouBia)
}

const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

export type OChuKy = { tieuDe: string; hoTen: string | null; chucDanh: string | null }

export type GiayDeNghi = {
  loai: LoaiGiay
  tieuDe: string
  tenDonVi: string
  phong: string
  ngayLap: string
  diaDanh: string
  // Dòng ngày tháng in ở góc phải: "Hà Nội, ngày 20 tháng 9 năm 2026".
  dongNgay: string
  // Khối chữ ở góc trái: cơ quan chủ quản, tên đơn vị và phòng.
  dauTrang: string[]
  kinhGui: string
  than: string[]
  chuKy: OChuKy[][]
  // Hình thức thanh toán in ở dòng "3. Hình thức thanh toán" của giấy thanh toán, và tài
  // khoản nhận tiền in kèm ngay dưới khi hình thức đó là chuyển khoản.
  hinhThucThanhToan: string
  taiKhoan: TaiKhoanNhan | null
  // Khóa của bảng này khớp đúng tên chỗ trống trong hai tệp mẫu, kể cả những tên
  // viết sai chính tả trong mẫu (donvitiepkhac) để không phải sửa lại tệp Word.
  thayThe: Record<string, string>
  // Những chỗ mẫu Word gõ cứng, thay bằng biểu thức chính quy.
  thayCoDinh: ThayTheCoDinh[]
}

const NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function phanNgay(ngay: string): { ngay: string; thang: string; nam: string } {
  const khop = NGAY_ISO.exec(ngay)
  if (!khop) return { ngay, thang: '', nam: '' }
  return { ngay: String(Number(khop[3])), thang: String(Number(khop[2])), nam: khop[1] }
}

function goiCanBo(ds: readonly CanBo[], id: string | null): CanBo | null {
  return id === null ? null : ds.find(cb => cb.id === id) ?? null
}

// "Kính gửi: Ông Nguyễn Văn A – Giám đốc Trung tâm Đào tạo". Cán bộ là lãnh đạo thì
// không thuộc phòng nào nên phần sau chức danh luôn là tên đơn vị.
function dungKinhGui(cb: CanBo | null, tenDonVi: string): string {
  if (!cb) return `Kính gửi: Lãnh đạo ${tenDonVi}`
  const dau = [cb.gioiTinh, cb.hoTen].filter(Boolean).join(' ')
  const duoi = [cb.chucDanh, tenDonVi].filter(Boolean).join(' ')
  return `Kính gửi: ${duoi ? `${dau} – ${duoi}` : dau}`
}

function hoTen(cb: CanBo | null): string | null {
  return cb?.hoTen ?? null
}

export type BoiCanhGiay = {
  // Người đề nghị là tài khoản đang đăng nhập; phòng lấy theo cán bộ gắn với tài khoản đó.
  nguoiDeNghi: CanBo
  canBo: readonly CanBo[]
  cauHinh: CauHinhGiay
  // Tài khoản nhận tiền tra theo mã người lấy hóa đơn. Chuyển khoản thì giấy in kèm
  // tài khoản của người lấy hóa đơn gắn với giao dịch, không có thì lấy người mặc định.
  taiKhoanTheoNguoiLayHd: Record<string, TaiKhoanNhan>
}

// Tài khoản nhận tiền in trên giấy: ưu tiên người lấy hóa đơn của chính giao dịch, sau
// đó tới người lấy hóa đơn mặc định trong cấu hình. Không có cả hai thì giấy chỉ in
// chữ "Chuyển khoản" mà không kèm số tài khoản.
export function taiKhoanNhan(gd: GiaoDichTinh, ctx: BoiCanhGiay): TaiKhoanNhan | null {
  const cuaGiaoDich = gd.nguoiLayHdId ? ctx.taiKhoanTheoNguoiLayHd[gd.nguoiLayHdId] : undefined
  const macDinh = ctx.cauHinh.nguoiLayHdMacDinhId ? ctx.taiKhoanTheoNguoiLayHd[ctx.cauHinh.nguoiLayHdMacDinhId] : undefined
  return cuaGiaoDich ?? macDinh ?? null
}

export function dungGiay(loai: LoaiGiay, gd: GiaoDichTinh, ctx: BoiCanhGiay): GiayDeNghi {
  const { cauHinh } = ctx
  const { ngay, thang, nam } = phanNgay(gd.ngay)
  const tenDonVi = cauHinh.tenDonVi
  const phong = ctx.nguoiDeNghi.phong ?? ''
  const phongHoa = phong.toLocaleUpperCase('vi')

  const lanhDaoTk = goiCanBo(ctx.canBo, cauHinh.lanhDaoTiepKhachId)
  const lanhDaoTt = goiCanBo(ctx.canBo, cauHinh.lanhDaoThanhToanId)
  const truongPhong = goiCanBo(ctx.canBo, cauHinh.truongPhongId)
  const keToan = goiCanBo(ctx.canBo, cauHinh.keToanKiemSoatId)

  const sotien = gd.tamUngTuCq
  const sotientt = soTienThanhToan(gd)
  const kinhPhi = kinhPhiDuKien(gd.tongTien)
  const donViTiepKhach = gd.donViTen ?? ''
  const oVuong = oVuongTamUng(gd.hinhThucThanhToan)
  // Nhãn in ở dòng "Hình thức thanh toán". Dòng nào chưa có thì in theo mặc định của
  // hình thức giao dịch để giấy không bao giờ trống ô này.
  const nhanThanhToan = NHAN_HINH_THUC_THANH_TOAN[
    (gd.hinhThucThanhToan ?? hinhThucThanhToanMacDinh(gd.hinhThuc) ?? '') as keyof typeof NHAN_HINH_THUC_THANH_TOAN
  ] ?? gd.hinhThuc
  const tk = canTaiKhoanNhan(gd.hinhThucThanhToan) ? taiKhoanNhan(gd, ctx) : null
  // Dòng "3. Hình thức thanh toán" của giấy thanh toán. Chuyển khoản thì số tài khoản
  // nhận tiền in ngay trên cùng dòng, vì mẫu Word chỉ có một dòng cho mục này.
  const dongHinhThucTt = tk ? `${nhanThanhToan} – ${dongTaiKhoan(tk)}` : nhanThanhToan
  const dungThayCoDinh = thayCoDinh({
    phong, tenDonVi, diaDanh: cauHinh.diaDanh, ngay, nguoiDeNghi: ctx.nguoiDeNghi.hoTen,
    truongPhong: truongPhong?.hoTen ?? null,
    lyDoTamUng: cauHinh.lyDoTamUng, thoiHanThanhToan: cauHinh.thoiHanThanhToan,
    hinhThucThanhToan: dongHinhThucTt,
  })

  const chung: Record<string, string> = {
    ngay, thang, nam, ngaytk: ngay, thangtk: thang, namtk: nam,
    gioi_tinh: ctx.nguoiDeNghi.gioiTinh ?? '', bangiamdoc: lanhDaoTk?.hoTen ?? '', chucdanh: lanhDaoTk?.chucDanh ?? '',
    gioi_tinhtk: lanhDaoTk?.gioiTinh ?? '', bangiamdoctk: lanhDaoTk?.hoTen ?? '', chucdanhtk: lanhDaoTk?.chucDanh ?? '',
    gioi_tinhtt: lanhDaoTt?.gioiTinh ?? '', bangiamdoctt: lanhDaoTt?.hoTen ?? '', chucdanhtt: lanhDaoTt?.chucDanh ?? '',
    PHONGTK: phongHoa, PHONGTKVT: phong,
    nguoidntk: ctx.nguoiDeNghi.hoTen,
    ketoankiemsoat: keToan?.hoTen ?? '',
    donvitiepkhac: donViTiepKhach,
    sotien: vnd.format(sotien), sotienbangchu: docSoTien(sotien),
    sotientt: vnd.format(sotientt), sotienttbangchu: docSoTien(sotientt),
    sotiendukien: vnd.format(kinhPhi), sotiendukienbangchu: docSoTien(kinhPhi),
    mahoadon: gd.kyHieuHd ?? '', sohoadon: gd.soHd ?? '',
    CK: oVuong.CK, TM: oVuong.TM,
    // Hình thức thanh toán in thành chữ ở giấy thanh toán, kèm số tài khoản nhận tiền
    // khi chuyển khoản. Tài khoản lấy từ người lấy hóa đơn — cùng tài khoản dùng để trả
    // phí lấy hóa đơn — nên hai chỗ không bao giờ lệch nhau.
    hinhthucthanhtoan: nhanThanhToan,
    sotaiKhoan: tk?.soTaiKhoan ?? '', nganhang: tk?.nganHang ?? '', chutaikhoan: tk?.tenChuTk ?? '',
    dongtaikhoan: tk ? dongTaiKhoan(tk) : '',
  }

  const oNguoiDeNghi: OChuKy = { tieuDe: 'NGƯỜI ĐỀ NGHỊ', hoTen: ctx.nguoiDeNghi.hoTen, chucDanh: ctx.nguoiDeNghi.chucDanh }

  // Giấy đề nghị tạm ứng in đủ ba dòng đầu trang; hai giấy còn lại chỉ in tên phòng,
  // đúng như mẫu Word.
  const dauTrangTamUng = ['NGÂN HÀNG CHÍNH SÁCH XÃ HỘI', tenDonVi.toLocaleUpperCase('vi'), `P. ${phongHoa || tenDonVi.toLocaleUpperCase('vi')}`]
  const dauTrangPhong = [phongHoa || tenDonVi.toLocaleUpperCase('vi')]
  const dongNgay = `${cauHinh.diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`

  if (loai === LOAI_GIAY.TAM_UNG) {
    return {
      loai, tieuDe: TEN_GIAY[loai], tenDonVi, phong, ngayLap: gd.ngay, diaDanh: cauHinh.diaDanh,
      dongNgay, dauTrang: dauTrangTamUng,
      kinhGui: dungKinhGui(lanhDaoTk, tenDonVi),
      than: [
        `Họ và tên: ${ctx.nguoiDeNghi.hoTen}`,
        `Đơn vị công tác: ${phong ? `${phong} - ${tenDonVi}` : tenDonVi}.`,
        `Lý do tạm ứng: ${cauHinh.lyDoTamUng}.`,
        `Số tiền đề nghị tạm ứng: ${vnd.format(sotien)} đ`,
        `Bằng chữ: ${docSoTien(sotien)}./`,
        `Hình thức tạm ứng: ${chung.CK}  ${chung.TM}.`,
        `Thời hạn thanh toán: ${cauHinh.thoiHanThanhToan}.`,
      ],
      chuKy: [[{ tieuDe: 'DUYỆT CỦA LÃNH ĐẠO', hoTen: hoTen(lanhDaoTk), chucDanh: lanhDaoTk?.chucDanh ?? null }],
        [{ tieuDe: 'TRƯỞNG PHÒNG', hoTen: hoTen(truongPhong), chucDanh: null }],
        [{ tieuDe: 'NGƯỜI ĐỀ NGHỊ\nTẠM ỨNG', hoTen: oNguoiDeNghi.hoTen, chucDanh: null }]],
      thayThe: chung, thayCoDinh: dungThayCoDinh, hinhThucThanhToan: nhanThanhToan, taiKhoan: tk,
    }
  }

  const thoiGian = `${ngay}/${thang}/${nam}`
  const canCu = [
    'Căn cứ văn bản 3358/NHCS-KTTC ngày 01/9/2016 của Tổng Giám đốc về việc Hướng dẫn thực hiện Quy chế quản lý tài chính trong hệ thống Ngân hàng Chính sách xã hội (NHCSXH) và văn bản số 5486/NHCS-KTTC ngày 09/6/2025 sửa đổi một số nội dung của văn bản 3358/NHCS-KTTC.',
  ]

  if (loai === LOAI_GIAY.TIEP_KHACH) {
    return {
      loai, tieuDe: TEN_GIAY[loai], tenDonVi, phong, ngayLap: gd.ngay, diaDanh: cauHinh.diaDanh,
      dongNgay, dauTrang: dauTrangPhong,
      kinhGui: dungKinhGui(lanhDaoTk, tenDonVi),
      than: [
        ...canCu,
        'Thực hiện nhiệm vụ được phân công, bộ phận được giao tiếp khách xin lập giấy đề nghị tiếp khách với nội dung cụ thể như sau:',
        `Đối tượng tiếp khách: ${donViTiepKhach}.`,
        `Ngày tiếp khách: ${thoiGian}`,
        `Kinh phí dự kiến: ${vnd.format(kinhPhi)}đ`,
        `(Bằng chữ: ${docSoTien(kinhPhi)} đồng)`,
        `Kính đề nghị ${lanhDaoTk?.gioiTinh ?? 'Lãnh đạo'} xem xét, phê duyệt.`,
      ],
      chuKy: [[{ tieuDe: 'DUYỆT CỦA LÃNH ĐẠO', hoTen: hoTen(lanhDaoTk), chucDanh: lanhDaoTk?.chucDanh ?? null }],
        [{ tieuDe: 'TM. Bộ phận tiếp khách', hoTen: oNguoiDeNghi.hoTen, chucDanh: null }]],
      thayThe: chung, thayCoDinh: dungThayCoDinh, hinhThucThanhToan: nhanThanhToan, taiKhoan: tk,
    }
  }

  return {
    loai, tieuDe: TEN_GIAY[loai], tenDonVi, phong, ngayLap: gd.ngay, diaDanh: cauHinh.diaDanh,
    dongNgay, dauTrang: dauTrangPhong,
    kinhGui: dungKinhGui(lanhDaoTt, tenDonVi),
    than: [
      `Căn cứ Giấy đề nghị tiếp khách đã được phê duyệt ngày ${thoiGian} của ${phong || tenDonVi}, nay bộ phận được giao tiếp khách đề nghị thanh toán chi phí tiếp khách với nội dung như sau:`,
      '1. Nội dung thanh toán: Tiếp khách cơ quan',
      `2. Số tiền đề nghị thanh toán: ${vnd.format(sotientt)} đồng`,
      `(Bằng chữ: ${docSoTien(sotientt)} đồng)`,
      `3. Hình thức thanh toán: ${dongHinhThucTt}.`,
      '4. Hồ sơ thanh toán đính kèm gồm:',
      '- Giấy đề nghị tiếp khách;',
      `- Hóa đơn mã ${gd.kyHieuHd ?? ''}, số ${gd.soHd ?? ''}, ngày ${thoiGian};`,
      `Kính đề nghị ${lanhDaoTt?.gioiTinh ?? 'Lãnh đạo'} xem xét, phê duyệt thanh toán theo quy định.`,
    ],
    chuKy: [[{ tieuDe: 'DUYỆT CỦA LÃNH ĐẠO', hoTen: hoTen(lanhDaoTt), chucDanh: lanhDaoTt?.chucDanh ?? null }],
      [{ tieuDe: 'KIỂM SOÁT', hoTen: hoTen(keToan), chucDanh: null }],
      [{ tieuDe: 'NGƯỜI ĐỀ NGHỊ', hoTen: oNguoiDeNghi.hoTen, chucDanh: null }]],
    thayThe: chung, thayCoDinh: dungThayCoDinh, hinhThucThanhToan: nhanThanhToan, taiKhoan: tk,
  }
}

// Mẫu Word gõ chữ Việt lẫn hai dạng: có chỗ ở dạng tổ hợp (NFD, dấu nằm sau nguyên âm)
// nên so khớp chuỗi NFC thường sẽ trượt. Câu mẫu được chuẩn hóa về NFC trước, rồi mỗi ký
// tự được dịch thành một nhóm khớp cả dạng có dấu lẫn dạng tách dấu, để câu mẫu khớp dù
// tệp Word lưu kiểu nào.
function escapeRegex(chuoi: string): string {
  return chuoi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mauChuoi(chuoi: string): RegExp {
  const phan = [...chuoi.normalize('NFC')].map(kyTu => {
    const goc = escapeRegex(kyTu)
    const nen = escapeRegex(kyTu.normalize('NFD').replace(/[̀-ͯ]/g, ''))
    // Ký tự không có dấu thì `nen` trùng `goc`; ký tự dấu tổ hợp lẻ thì `nen` rỗng.
    return !nen || nen === goc ? goc : `(?:${goc}|${nen}[\\u0300-\\u036f]*)`
  })
  return new RegExp(phan.join(''), 'g')
}

// Mẫu Word còn gõ cứng dữ liệu của người soạn mẫu — tên người đề nghị, tên trưởng
// phòng, tên phòng, tên đơn vị, lý do và thời hạn — ở những chỗ không có chỗ trống
// [[...]]. Phải thay bằng chuỗi thật để giấy in ra không mang tên người khác. Nếu sau
// này mẫu được sửa thành chỗ trống thì những mục dưới đây chỉ còn là phép thay vô hại.
function thayCoDinh(c: {
  phong: string; tenDonVi: string; diaDanh: string; ngay: string
  nguoiDeNghi: string; truongPhong: string | null
  lyDoTamUng: string; thoiHanThanhToan: string
  hinhThucThanhToan: string
}): ThayTheCoDinh[] {
  const ds: ThayTheCoDinh[] = [
    { mau: mauChuoi('Độc lập - Tự do - Tự do'), thay: 'Độc lập - Tự do - Hạnh phúc' },
    { mau: mauChuoi('P. HÀNH CHÍNH TỔ CHỨC'), thay: `P. ${(c.phong || c.tenDonVi).toLocaleUpperCase('vi')}` },
    { mau: mauChuoi('Phòng HCTC'), thay: c.phong || c.tenDonVi },
    // Tên đơn vị in ở đầu trang và trong dòng "Kính gửi" đều gõ cứng, phải theo cấu hình.
    { mau: mauChuoi('TRUNG TÂM ĐÀO TẠO'), thay: c.tenDonVi.toLocaleUpperCase('vi') },
    { mau: mauChuoi('Trung tâm Đào tạo'), thay: c.tenDonVi },
    // Địa danh in ở đầu dòng ngày tháng cũng gõ cứng "Hà Nội". Chỉ thay khi nó đứng ngay
    // trước chữ "ngày" của dòng đó, để không đụng vào chỗ khác có cùng hai chữ này.
    { mau: mauChuoi('Hà Nội, ngày'), thay: `${c.diaDanh}, ngày` },
    // Giấy thanh toán để trống ngày ở dòng "Hà Nội, ngày ... tháng [[thang]]": in theo
    // ngày phát sinh, giống mọi chỗ ngày khác trên giấy.
    { mau: /(ngày)\s+tháng/g, thay: `$1 ${c.ngay} tháng` },
    // Mẫu gõ "]]/ [[" giữa hai chỗ trống ngày; bỏ dấu cách để ngày in liền mạch.
    { mau: /\]\]\/\s+\[\[/g, thay: ']]/[[' },
    // Dòng "3. Hình thức thanh toán" trong mẫu gõ cứng "Hoàn tạm ứng". Thay bằng hình
    // thức thật của giao dịch, kèm số tài khoản nhận tiền khi chuyển khoản.
    { mau: mauChuoi('3. Hình thức thanh toán: Hoàn tạm ứng.'), thay: `3. Hình thức thanh toán: ${c.hinhThucThanhToan}.` },
  ]
  if (c.nguoiDeNghi) ds.push({ mau: mauChuoi('Phạm Văn Hiệp'), thay: c.nguoiDeNghi })
  if (c.lyDoTamUng) ds.push({ mau: mauChuoi('chi tiêu hành chính'), thay: c.lyDoTamUng })
  if (c.thoiHanThanhToan) ds.push({ mau: mauChuoi('Sau khi hoàn thành công việc'), thay: c.thoiHanThanhToan })
  // Trưởng phòng chưa cấu hình thì để trống ô ký, không giữ tên người soạn mẫu.
  ds.push({ mau: mauChuoi('Ngô Anh Phương'), thay: c.truongPhong ?? '' })
  return ds
}

export function tenTep(loai: LoaiGiay, gd: Pick<GiaoDichTinh, 'ngay' | 'soHd' | 'id'>): string {
  const dinhDanh = (gd.soHd || gd.id).replace(/[^\p{L}\p{N}._-]+/gu, '-')
  return `${TEN_GIAY[loai]} ${gd.ngay} ${dinhDanh}.docx`
}
