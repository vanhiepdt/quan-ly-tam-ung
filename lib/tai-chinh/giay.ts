import { docSoTien } from './doc-so'
import { canTaiKhoanNhan, hinhThucThanhToanMacDinh, NHAN_HINH_THUC_THANH_TOAN, noiDungHinhThucTamUng } from './hinh-thuc'
import { HINH_THUC, type GiaoDichTinh, type TaiKhoanNhan } from './kieu'
import { dongTaiKhoan } from './tai-khoan'
import { lamTronXuongHangNghin, soTienThanhToan } from './tien-thanh-toan'
import type { ThayTheCoDinh } from '@/lib/van-ban/docx'
import { coPhuLucThanhToan } from './co-phu-luc'

export { lamTronXuongHangNghin, soTienThanhToan } from './tien-thanh-toan'

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
  // Tên / MST / địa chỉ người mua trên hóa đơn. Không in lên giấy đề nghị.
  tenMuaHangDonVi: string
  mstDonVi: string
  diaChiDonVi: string
  diaDanh: string
  lyDoTamUng: string
  thoiHanThanhToan: string
  // Người lấy hóa đơn dùng khi giao dịch chưa gắn người nào: tài khoản nhận tiền của họ
  // được in kèm khi thanh toán bằng chuyển khoản.
  nguoiLayHdMacDinhId: string | null
  // Trạng thái thanh toán phí lấy hóa đơn khi thêm giao dịch có hóa đơn.
  trangThaiTtPhiMacDinh: string
}

export const CAU_HINH_GIAY_MAC_DINH: CauHinhGiay = {
  nguoiDeNghiId: null, lanhDaoTiepKhachId: null, lanhDaoThanhToanId: null, truongPhongId: null, keToanKiemSoatId: null,
  tenDonVi: 'Trung tâm Đào tạo',
  tenMuaHangDonVi: 'Trung tâm Đào tạo Ngân hàng Chính sách xã hội',
  mstDonVi: '0100695387066',
  diaChiDonVi: 'Tầng 2, Khu nhà 3 tầng, số 169 phố Linh Đường, Phường Hoàng Liệt, TP Hà Nội, Việt Nam',
  diaDanh: 'Hà Nội',
  lyDoTamUng: 'Chi tiêu hành chính', thoiHanThanhToan: 'Sau khi hoàn thành công việc',
  nguoiLayHdMacDinhId: null,
  trangThaiTtPhiMacDinh: 'Không phát sinh',
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

// Mẫu tiếp khách + thanh toán đã là một tệp Word: chỉ mở/lưu tài liệu chính.
export function giayChinhChoHinhThuc(hinhThuc: string): LoaiGiay | null {
  return giayChoHinhThuc(hinhThuc).at(-1) ?? null
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

function ngayHaiChu(value: string): string {
  return value.length === 1 ? '0' + value : value
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
  // Tài khoản người lấy hóa đơn đang hoạt động, kèm liên kết cán bộ.
  // Giấy chỉ dùng tài khoản liên kết đúng người đề nghị đã chọn.
  taiKhoanTheoNguoiLayHd: Record<string, TaiKhoanNhan>
}

// Thiếu liên kết hoặc có nhiều tài khoản cùng cán bộ thì không tự đoán tài khoản nhận.
export type DuLieuGiay = Pick<GiaoDichTinh, 'ngay' | 'ngayDeNghi' | 'hinhThuc' | 'hinhThucThanhToan' | 'tamUngTuCq' | 'tongTien' | 'tienRuouBia' | 'tienDuocThanhToan' | 'lamTronXuongHangNghin' | 'donViTen' | 'nguoiLayHdId' | 'kyHieuHd' | 'soHd' | 'taiKhoanNhanGhiDe' | 'chiTietHoaDon'>

export function taiKhoanNhan(gd: DuLieuGiay, ctx: BoiCanhGiay): TaiKhoanNhan | null {
  const ds = Object.values(ctx.taiKhoanTheoNguoiLayHd).filter(tk => tk.canBoId === ctx.nguoiDeNghi.id)
  // Không tự lấy tài khoản của người khác hoặc đoán khi một cán bộ gắn nhiều tài khoản.
  return ds.length === 1 ? { ...ds[0], tenChuTk: ctx.nguoiDeNghi.hoTen } : null
}

// Giữ mã đã viết tắt; tên đầy đủ lấy chữ cái đầu từng từ.
export function vietTatPhong(ten: string): string {
  const goc = ten.normalize('NFC').trim().replace(/^(?:phòng\s+|p\.\s*)/iu, '')
  const tu = goc.match(/[\p{L}\p{N}]+/gu) ?? []
  if (!tu.length) return ''
  const ma = tu.length === 1 ? tu[0] : tu.map(t => t[0]).join('')
  return `PHÒNG ${ma.toLocaleUpperCase('vi')}`
}

export function dungGiay(loai: LoaiGiay, gd: DuLieuGiay, ctx: BoiCanhGiay): GiayDeNghi {
  const { cauHinh } = ctx
  const { ngay, thang, nam } = phanNgay(gd.ngay)
  const { ngay: ngayDeNghi, thang: thangDeNghi, nam: namDeNghi } = phanNgay(gd.ngayDeNghi ?? gd.ngay)
  const tenDonVi = cauHinh.tenDonVi
  const phong = ctx.nguoiDeNghi.phong ?? ''
  const phongHoa = vietTatPhong(phong)

  const lanhDaoTk = goiCanBo(ctx.canBo, cauHinh.lanhDaoTiepKhachId)
  const lanhDaoTt = goiCanBo(ctx.canBo, cauHinh.lanhDaoThanhToanId)
  const truongPhong = goiCanBo(ctx.canBo, cauHinh.truongPhongId)
  const keToan = goiCanBo(ctx.canBo, cauHinh.keToanKiemSoatId)

  const sotien = gd.tamUngTuCq
  const sotientt = soTienThanhToan(gd)
  // Hai giấy của cùng một giao dịch phải dùng cùng giá trị: người dùng sửa số
  // tiền được hoàn/thanh toán một lần, cả nhật ký và hai giấy cùng đổi.
  const kinhPhi = kinhPhiDuKien(sotientt)
  const donViTiepKhach = gd.donViTen ?? ''
  // Nhãn in ở dòng "Hình thức thanh toán". Dòng nào chưa có thì in theo mặc định của
  // hình thức giao dịch để giấy không bao giờ trống ô này.
  const hinhThucThanhToan = gd.hinhThucThanhToan ?? hinhThucThanhToanMacDinh(gd.hinhThuc)
  const nhanThanhToan = NHAN_HINH_THUC_THANH_TOAN[
    (hinhThucThanhToan ?? '') as keyof typeof NHAN_HINH_THUC_THANH_TOAN
  ] ?? gd.hinhThuc
  const tk = canTaiKhoanNhan(hinhThucThanhToan)
    ? gd.taiKhoanNhanGhiDe ?? taiKhoanNhan(gd, ctx)
    : null
  // Dòng "3. Hình thức thanh toán" của giấy thanh toán. Chuyển khoản thì số tài khoản
  // nhận tiền in ngay trên cùng dòng, vì mẫu Word chỉ có một dòng cho mục này.
  const dongHinhThucTt = tk ? `${nhanThanhToan} – ${dongTaiKhoan(tk)}` : nhanThanhToan
  const dungChuyenKhoan = canTaiKhoanNhan(hinhThucThanhToan)
  const noiDungTamUng = noiDungHinhThucTamUng(hinhThucThanhToan, tk ? dongTaiKhoan(tk) : null)
  const dungThayCoDinh = [
    ...thayCoDinh({
      phong, tenDonVi, diaDanh: cauHinh.diaDanh, nguoiDeNghi: ctx.nguoiDeNghi.hoTen,
      truongPhong: truongPhong?.hoTen ?? null,
      lyDoTamUng: cauHinh.lyDoTamUng, thoiHanThanhToan: cauHinh.thoiHanThanhToan,
      hinhThucThanhToan: dongHinhThucTt,
    }),
    // Mẫu đặt [[CK]] và [[TM]] cạnh nhau. Giữ đúng một chỗ trống được chọn để Word
    // không để lại khoảng trắng thừa trước dấu chấm khi phương thức còn lại rỗng.
    { mau: /\[\[CK\]\]\s+\[\[TM\]\]\./g, thay: `${dungChuyenKhoan ? '[[CK]]' : '[[TM]]'}.` },
  ]
  if (!coPhuLucThanhToan(gd)) {
    dungThayCoDinh.push({
      mau: mauChuoi('- Bảng kê chi tiết đề nghị thanh toán'), thay: '', xoaDoanNeuRong: true,
    })
  }

  const chung: Record<string, string> = {
    ngay, thang, nam, ngaytk: ngayHaiChu(ngay), thangtk: ngayHaiChu(thang), namtk: nam,
    ngaydntk: ngayHaiChu(ngayDeNghi), thangdntk: ngayHaiChu(thangDeNghi),
    // Mẫu dùng ngày đề nghị ở cả dòng hành chính và ngày phê duyệt. Dòng hành chính
    // giữ dạng văn xuôi; ngày trong nội dung dùng đủ hai chữ số.
    thangdntkVanXuoi: thangDeNghi, namdntk: namDeNghi,
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
    // Mẫu gộp có thêm trang phụ lục. Tên bên bán lấy từ snapshot hóa đơn; giao dịch
    // cũ không có snapshot thì để trống, tuyệt đối không lấy tên người đề nghị hay
    // đơn vị tiếp khách thay thế.
    benban: gd.chiTietHoaDon?.tenBanHang?.trim() ?? '',
    CK: noiDungTamUng.CK, TM: noiDungTamUng.TM,
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
  const dauTrangTamUng = ['NGÂN HÀNG CHÍNH SÁCH XÃ HỘI', tenDonVi.toLocaleUpperCase('vi'), phongHoa || tenDonVi.toLocaleUpperCase('vi')]
  const dauTrangPhong = [phongHoa || tenDonVi.toLocaleUpperCase('vi')]
  const dongNgayHoaDon = `${cauHinh.diaDanh}, ngày ${ngay} tháng ${thang} năm ${nam}`
  const dongNgayDeNghi = `${cauHinh.diaDanh}, ngày ${ngayDeNghi} tháng ${thangDeNghi} năm ${namDeNghi}`

  if (loai === LOAI_GIAY.TAM_UNG) {
    return {
      loai, tieuDe: TEN_GIAY[loai], tenDonVi, phong, ngayLap: gd.ngay, diaDanh: cauHinh.diaDanh,
      dongNgay: dongNgayHoaDon, dauTrang: dauTrangTamUng,
      kinhGui: dungKinhGui(lanhDaoTk, tenDonVi),
      than: [
        `Họ và tên: ${ctx.nguoiDeNghi.hoTen}`,
        `Đơn vị công tác: ${phong ? `${phong} - ${tenDonVi}` : tenDonVi}.`,
        `Lý do tạm ứng: ${cauHinh.lyDoTamUng}.`,
        `Số tiền đề nghị tạm ứng: ${vnd.format(sotien)} đ`,
        `Bằng chữ: ${docSoTien(sotien)}./`,
        `Hình thức tạm ứng: ${noiDungTamUng.noiDung}.`,
        `Thời hạn thanh toán: ${cauHinh.thoiHanThanhToan}.`,
      ],
      chuKy: [[{ tieuDe: 'DUYỆT CỦA LÃNH ĐẠO', hoTen: hoTen(lanhDaoTk), chucDanh: lanhDaoTk?.chucDanh ?? null }],
        [{ tieuDe: 'TRƯỞNG PHÒNG', hoTen: hoTen(truongPhong), chucDanh: null }],
        [{ tieuDe: 'NGƯỜI ĐỀ NGHỊ\nTẠM ỨNG', hoTen: oNguoiDeNghi.hoTen, chucDanh: null }]],
      thayThe: chung, thayCoDinh: dungThayCoDinh, hinhThucThanhToan: nhanThanhToan, taiKhoan: tk,
    }
  }

  const thoiGian = `${ngayHaiChu(ngay)}/${ngayHaiChu(thang)}/${nam}`
  const thoiGianDeNghi = `${ngayHaiChu(ngayDeNghi)}/${ngayHaiChu(thangDeNghi)}/${namDeNghi}`
  const canCu = [
    'Căn cứ văn bản 3358/NHCS-KTTC ngày 01/9/2016 của Tổng Giám đốc về việc Hướng dẫn thực hiện Quy chế quản lý tài chính trong hệ thống Ngân hàng Chính sách xã hội (NHCSXH) và văn bản số 5486/NHCS-KTTC ngày 09/6/2025 sửa đổi một số nội dung của văn bản 3358/NHCS-KTTC.',
  ]

  if (loai === LOAI_GIAY.TIEP_KHACH) {
    return {
      loai, tieuDe: TEN_GIAY[loai], tenDonVi, phong, ngayLap: gd.ngay, diaDanh: cauHinh.diaDanh,
      dongNgay: dongNgayDeNghi, dauTrang: dauTrangPhong,
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
    dongNgay: dongNgayHoaDon, dauTrang: dauTrangPhong,
    kinhGui: dungKinhGui(lanhDaoTt, tenDonVi),
    than: [
      `Căn cứ Giấy đề nghị tiếp khách đã được phê duyệt ngày ${thoiGianDeNghi} của ${phong || tenDonVi}, nay bộ phận được giao tiếp khách đề nghị thanh toán chi phí tiếp khách với nội dung như sau:`,
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
  phong: string; tenDonVi: string; diaDanh: string
  nguoiDeNghi: string; truongPhong: string | null
  lyDoTamUng: string; thoiHanThanhToan: string
  hinhThucThanhToan: string
}): ThayTheCoDinh[] {
  const ds: ThayTheCoDinh[] = [
    { mau: mauChuoi('Độc lập - Tự do - Tự do'), thay: 'Độc lập - Tự do - Hạnh phúc' },
    { mau: mauChuoi('P. HÀNH CHÍNH TỔ CHỨC'), thay: vietTatPhong(c.phong) || c.tenDonVi.toLocaleUpperCase('vi') },
    { mau: mauChuoi('Phòng HCTC'), thay: c.phong || c.tenDonVi },
    // Tên đơn vị in ở đầu trang và trong dòng "Kính gửi" đều gõ cứng, phải theo cấu hình.
    { mau: mauChuoi('TRUNG TÂM ĐÀO TẠO'), thay: c.tenDonVi.toLocaleUpperCase('vi') },
    { mau: mauChuoi('Trung tâm Đào tạo'), thay: c.tenDonVi },
    // Địa danh ở đầu dòng ngày tháng được gõ cứng trong mẫu. Chỉ thay phần địa danh,
    // để phép thay ngày ở ngay sau đó vẫn áp dụng được.
    { mau: mauChuoi('Hà Nội,'), thay: `${c.diaDanh},` },
    // Mẫu tiếp khách dùng chung chỗ trống tháng cho dòng hành chính và ngày phê duyệt.
    // Đổi riêng dòng hành chính sang tháng không đệm số 0.
    { mau: /\[\[ngaydntk\]\]\s+tháng\s*\[\[thangdntk\]\]\s+năm\s+\[\[namdntk\]\]/g, thay: '[[ngaydntk]] tháng [[thangdntkVanXuoi]] năm [[namdntk]]' },
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
