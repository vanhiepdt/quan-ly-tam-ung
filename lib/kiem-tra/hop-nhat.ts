import type { DonViDoiChieu, DuLieuDocTuHoaDon, DongHang, KetQuaDocHoaDon, PhatHien, TrangThaiKiemTra } from './giao-dien'
import { doanCotTienHang, doanLoaiHoaDon, nhanLoaiHoaDon } from './loai-hoa-don'
import { giongChuoi, giongMst, giongTien, hienThiMst } from './so-sanh'
import { congTienRuouBia, tienRuouBiaCuaLop } from './ruou-bia'
import { chiTietHoaDonTuDeXuat, phanBoPhuLuc } from './phan-bo-phu-luc'
import { laSoTienHopLe } from './tien'

type Nguon = 'ai1' | 'ai2' | 'xml'
type Lop = { id: Nguon; nhan: string; doc: DuLieuDocTuHoaDon | null }

const NHAN: Record<string, string> = {
  kyHieuHd: 'ký hiệu hóa đơn',
  soHd: 'số hóa đơn',
  ngay: 'ngày lập',
  mstBanHang: 'MST người bán',
  tenBanHang: 'tên người bán',
  mstMuaHang: 'MST người mua',
  tenMuaHang: 'tên đơn vị mua hàng',
  diaChiMuaHang: 'địa chỉ người mua',
  tongTien: 'tổng tiền',
  tienThue: 'tiền thuế',
}

const TRUONG_DIEN = [
  'kyHieuHd', 'soHd', 'ngay', 'mstBanHang', 'tenBanHang',
  'mstMuaHang', 'tenMuaHang', 'diaChiMuaHang', 'tongTien', 'tienThue',
] as const

const TRUONG_TIEN = new Set<keyof DuLieuDocTuHoaDon>(['tongTien', 'tongCong', 'tienThue', 'tienRuouBia'])

function giaTri(doc: DuLieuDocTuHoaDon, khoa: keyof DuLieuDocTuHoaDon): unknown {
  return doc[khoa]
}

function coGiaTri(value: unknown): boolean {
  return value !== undefined && value !== ''
}

function coGiaTriTruong(khoa: keyof DuLieuDocTuHoaDon, value: unknown): boolean {
  return TRUONG_TIEN.has(khoa) ? laSoTienHopLe(value) : coGiaTri(value)
}

function soHdChuan(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const s = value.trim()
  if (!/^\d+$/.test(s)) return
  return s.replace(/^0+/, '') || '0'
}

function soHdCungGiaTri(a: unknown, b: unknown): boolean {
  const x = soHdChuan(a), y = soHdChuan(b)
  return x !== undefined && y !== undefined && x === y
}

function soHdUuTienSoKhong(...values: unknown[]): string | undefined {
  const dau = typeof values[0] === 'string' ? values[0].trim() : ''
  const goc = soHdChuan(dau)
  if (goc === undefined) return
  const ds = values.filter((value): value is string => typeof value === 'string' && soHdChuan(value.trim()) === goc)
  return ds.sort((a, b) => b.trim().length - a.trim().length)[0]?.trim()
}

function tenGanDung(a: string, b: string): boolean {
  const chuan = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const x = chuan(a), y = chuan(b)
  if (!x || !y) return true
  if (x === y) return true
  const ngan = x.length <= y.length ? x : y
  const dai = x.length <= y.length ? y : x
  return dai.startsWith(ngan) && ngan.length >= Math.min(24, Math.floor(dai.length * 0.7))
}

export { tenGanDung }

function chuanHoaDiaChi(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\bviet nam\b/g, ' ').replace(/\bthanh pho\b/g, 'tp').replace(/\bso\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function diaChiGanDung(a?: string, b?: string): boolean {
  const x = chuanHoaDiaChi(a ?? ''), y = chuanHoaDiaChi(b ?? '')
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

export function doiChieuNguoiMua(deXuat: DuLieuDocTuHoaDon, donVi: DonViDoiChieu): PhatHien[] {
  const phatHien: PhatHien[] = []
  const mstCauHinh = donVi.mst.replace(/[\s.\-]/g, '')
  const tenDonVi = donVi.ten.trim()
  const diaChiDonVi = donVi.diaChi.trim()

  if (!mstCauHinh) {
    if (deXuat.mstMuaHang) phatHien.push({
      muc: 'thong_tin', ma: 'mst_chua_cau_hinh', truong: 'mstMuaHang',
      thongDiep: `Hóa đơn ghi MST người mua ${hienThiMst(deXuat.mstMuaHang)}. Vào Cài đặt điền MST đơn vị để máy tự đối chiếu.`,
    })
  } else if (!deXuat.mstMuaHang) {
    phatHien.push({
      muc: 'canh_bao', ma: 'mst_mua_thieu', truong: 'mstMuaHang',
      thongDiep: `Không đọc được MST người mua trên hóa đơn. MST đơn vị phải là ${hienThiMst(mstCauHinh)}.`,
    })
  } else if (!giongMst(deXuat.mstMuaHang, mstCauHinh)) {
    phatHien.push({
      muc: 'loi', ma: 'mst_khong_khop', truong: 'mstMuaHang',
      thongDiep: `MST người mua trên hóa đơn (${hienThiMst(deXuat.mstMuaHang)}) khác MST đơn vị đã cấu hình (${hienThiMst(mstCauHinh)}).`,
    })
  }

  if (!tenDonVi) {
    if (deXuat.tenMuaHang) phatHien.push({
      muc: 'thong_tin', ma: 'ten_chua_cau_hinh', truong: 'tenMuaHang',
      thongDiep: `Hóa đơn ghi tên người mua “${deXuat.tenMuaHang}”. Vào Cài đặt điền tên đơn vị để máy tự đối chiếu.`,
    })
  } else if (!deXuat.tenMuaHang) {
    phatHien.push({
      muc: 'canh_bao', ma: 'ten_mua_thieu', truong: 'tenMuaHang',
      thongDiep: `Không đọc được tên đơn vị mua hàng. Tên đơn vị phải là “${tenDonVi}”.`,
    })
  } else if (!tenGanDung(deXuat.tenMuaHang, tenDonVi)) {
    phatHien.push({
      muc: 'canh_bao', ma: 'ten_mua_lech', truong: 'tenMuaHang',
      thongDiep: `Tên đơn vị mua hàng trên hóa đơn (“${deXuat.tenMuaHang}”) khác tên đã cấu hình (“${tenDonVi}”).`,
    })
  }

  if (!diaChiDonVi) {
    if (deXuat.diaChiMuaHang) phatHien.push({
      muc: 'thong_tin', ma: 'dia_chi_chua_cau_hinh', truong: 'diaChiMuaHang',
      thongDiep: `Hóa đơn ghi địa chỉ người mua “${deXuat.diaChiMuaHang}”. Vào Cài đặt điền địa chỉ đơn vị để máy tự đối chiếu.`,
    })
  } else if (!deXuat.diaChiMuaHang) {
    phatHien.push({
      muc: 'canh_bao', ma: 'dia_chi_mua_thieu', truong: 'diaChiMuaHang',
      thongDiep: `Không đọc được địa chỉ đơn vị mua hàng. Địa chỉ phải là “${diaChiDonVi}”.`,
    })
  } else if (!diaChiGanDung(deXuat.diaChiMuaHang, diaChiDonVi)) {
    phatHien.push({
      muc: 'canh_bao', ma: 'dia_chi_khong_khop', truong: 'diaChiMuaHang',
      thongDiep: `Địa chỉ đơn vị mua hàng trên hóa đơn (“${deXuat.diaChiMuaHang}”) khác địa chỉ đã cấu hình (“${diaChiDonVi}”).`,
    })
  }

  return phatHien
}

function giongTruong(khoa: keyof DuLieuDocTuHoaDon, a: DuLieuDocTuHoaDon, b: DuLieuDocTuHoaDon): boolean {
  const x = giaTri(a, khoa), y = giaTri(b, khoa)
  if (!coGiaTriTruong(khoa, x) || !coGiaTriTruong(khoa, y)) return true
  if (khoa === 'soHd' && soHdCungGiaTri(x, y)) return true
  if (khoa === 'mstBanHang' || khoa === 'mstMuaHang') return giongMst(String(x), String(y))
  if (khoa === 'tongTien' || khoa === 'tongCong' || khoa === 'tienThue' || khoa === 'tienRuouBia') return giongTien(Number(x), Number(y))
  if (khoa === 'tenMuaHang' || khoa === 'tenBanHang') return tenGanDung(String(x), String(y))
  if (khoa === 'diaChiMuaHang') return diaChiGanDung(String(x), String(y))
  return giongChuoi(String(x), String(y))
}

function canhBaoLech(khoa: string, lopA: string, lopB: string): PhatHien {
  return {
    muc: 'canh_bao', ma: 'ai_lech', truong: khoa,
    thongDiep: `${lopA} và ${lopB} đọc ${NHAN[khoa] ?? khoa} khác nhau. Hãy soát lại bản gốc.`,
  }
}

function cacLop(ai1: DuLieuDocTuHoaDon | null, ai2: DuLieuDocTuHoaDon | null, xml: DuLieuDocTuHoaDon | null): Lop[] {
  return [
    { id: 'ai1', nhan: 'AI 1', doc: ai1 },
    { id: 'ai2', nhan: 'AI 2', doc: ai2 },
    { id: 'xml', nhan: 'XML', doc: xml },
  ]
}

function chonGiaTri(
  khoa: (typeof TRUONG_DIEN)[number],
  lop: readonly Lop[],
): { giaTri: unknown; phat: PhatHien[] } {
  const co = lop.filter(l => l.doc && coGiaTriTruong(khoa, giaTri(l.doc, khoa))) as Array<Lop & { doc: DuLieuDocTuHoaDon }>
  if (!co.length) return { giaTri: undefined, phat: [] }
  const phat: PhatHien[] = []
  for (let i = 0; i < co.length; i++) {
    for (let j = i + 1; j < co.length; j++) {
      if (!giongTruong(khoa, co[i].doc, co[j].doc)) phat.push(canhBaoLech(khoa, co[i].nhan, co[j].nhan))
    }
  }
  const ai1 = co.find(l => l.id === 'ai1')
  const ai2 = co.find(l => l.id === 'ai2')
  const xml = co.find(l => l.id === 'xml')
  const xmlKhớpAi = xml && (ai1 && giongTruong(khoa, xml.doc, ai1.doc) || ai2 && giongTruong(khoa, xml.doc, ai2.doc))
  const uuTien = xmlKhớpAi ? xml : ai1 ?? xml ?? ai2
  const values = co.map(l => giaTri(l.doc, khoa))
  const giaTriChon = khoa === 'soHd' ? soHdUuTienSoKhong(giaTri(uuTien!.doc, khoa), ...values) ?? giaTri(uuTien!.doc, khoa) : giaTri(uuTien!.doc, khoa)
  return { giaTri: giaTriChon, phat }
}

function diemDongHang(dong: readonly DongHang[]): number {
  return dong.reduce((diem, d) => diem + 10 + (d.soLuong !== undefined ? 3 : 0) + (d.donGia !== undefined ? 2 : 0)
    + (d.tienThue !== undefined || d.thueSuat !== undefined ? 2 : 0) + (d.thanhTienSauThue !== undefined ? 2 : 0), 0)
}

function chonDongHang(lop: readonly Lop[]): { dong?: DongHang[]; nguon?: Nguon } {
  const coDong = lop.filter((l): l is Lop & { doc: DuLieuDocTuHoaDon & { dongHang: DongHang[] } } => Boolean(l.doc?.dongHang?.length))
  coDong.sort((a, b) => diemDongHang(b.doc.dongHang) - diemDongHang(a.doc.dongHang)
    || ['xml', 'ai1', 'ai2'].indexOf(a.id) - ['xml', 'ai1', 'ai2'].indexOf(b.id))
  return coDong[0] ? { dong: coDong[0].doc.dongHang, nguon: coDong[0].id } : {}
}

function canhBaoDongHang(lop: readonly Lop[], selected: Nguon | undefined): PhatHien[] {
  if (!selected || selected === 'xml') return []
  const chon = lop.find(l => l.id === selected)?.doc?.dongHang ?? []
  const phat: PhatHien[] = []
  for (const other of lop.filter(l => l.id !== selected)) {
    for (const dong of chon) {
      const ten = dong.ten.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const match = other.doc?.dongHang?.find(d => {
        const tenKhac = d.ten.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        return ten && tenKhac && (ten === tenKhac || ten.includes(tenKhac) || tenKhac.includes(ten))
      })
      if (match?.laRuouBia !== undefined && dong.laRuouBia !== undefined && match.laRuouBia !== dong.laRuouBia) {
        phat.push({ muc: 'canh_bao', ma: 'dong_hang_lech', truong: 'dongHang', thongDiep: `Hai nguồn xác định khoản không được thanh toán của dòng “${dong.ten}” khác nhau. Dùng kết quả đã chọn và soát lại.` })
      }
    }
  }
  return phat
}

function hopNhatNoiBo(ai1: DuLieuDocTuHoaDon | null, ai2: DuLieuDocTuHoaDon | null, xml: DuLieuDocTuHoaDon | null): KetQuaDocHoaDon {
  const lop = cacLop(ai1, ai2, xml)
  const phatHien: PhatHien[] = []
  if (!ai1) phatHien.push({ muc: 'canh_bao', ma: 'ai1_khong_chay', thongDiep: 'AI 1 không trả được kết quả.' })
  if (!ai2) phatHien.push({ muc: 'canh_bao', ma: 'ai2_khong_chay', thongDiep: 'AI 2 không trả được kết quả.' })
  const soNguon = lop.filter(l => l.doc).length
  if (soNguon === 1) phatHien.push({ muc: 'canh_bao', ma: 'mot_nguon', thongDiep: 'Chỉ một nguồn đọc được hóa đơn nên chưa có đối chiếu chéo đầy đủ.' })

  const deXuat: DuLieuDocTuHoaDon = {}
  for (const khoa of TRUONG_DIEN) {
    const result = chonGiaTri(khoa, lop)
    phatHien.push(...result.phat)
    if (coGiaTriTruong(khoa, result.giaTri)) (deXuat as Record<string, unknown>)[khoa] = result.giaTri
  }
  if (deXuat.tongTien !== undefined) deXuat.tongCong = deXuat.tongTien

  const { dong, nguon } = chonDongHang(lop)
  const docDongHang = nguon ? lop.find(l => l.id === nguon)?.doc : null
  const loaiHd = doanLoaiHoaDon({
    loaiHd: deXuat.loaiHd,
    loaiHdPhu: xml?.loaiHd ?? ai1?.loaiHd ?? ai2?.loaiHd,
    kyHieuHd: deXuat.kyHieuHd,
  })
  const cotTienHang = doanCotTienHang({
    cotTienHang: docDongHang?.cotTienHang,
    cotTienHangPhu: xml?.cotTienHang ?? ai1?.cotTienHang ?? ai2?.cotTienHang,
    dongHang: dong,
    loaiHd,
  })
  if (loaiHd) deXuat.loaiHd = loaiHd
  if (cotTienHang) deXuat.cotTienHang = cotTienHang
  const tenLoai = nhanLoaiHoaDon(loaiHd)
  if (tenLoai) phatHien.push({
    muc: 'thong_tin', ma: loaiHd === 'gtgt' ? 'loai_hd_gtgt' : 'loai_hd_ban_hang',
    thongDiep: `Nhận ${tenLoai}${cotTienHang === 'sau_thue' ? ', cột thành tiền đã gồm thuế GTGT' : cotTienHang === 'truoc_thue' ? ', cột thành tiền chưa gồm thuế GTGT' : ''}.`,
  })

  if (dong?.length) {
    const tinh = congTienRuouBia(dong, loaiHd, cotTienHang)
    deXuat.dongHang = tinh.dong
    deXuat.tienRuouBia = tinh.tien
    const baoCao = lop.map(l => ({ lop: l.nhan, tien: tienRuouBiaCuaLop(l.doc, loaiHd, cotTienHang) }))
      .filter(x => x.tien !== undefined)
    const tongRiengLech = lop.some(l => l.doc?.tienRuouBia !== undefined && !giongTien(l.doc.tienRuouBia, tinh.tien))
    if (tongRiengLech || baoCao.some(x => x.tien !== tinh.tien)) {
      phatHien.push({
        muc: 'canh_bao', ma: 'ruou_bia_lech', truong: 'tienRuouBia',
        thongDiep: `Tiền không được thanh toán được tính lại từ toàn bộ dòng hàng sau thuế là ${tinh.tien.toLocaleString('vi-VN')}đ; số riêng do nguồn đọc trả về đã được bỏ qua.`,
      })
    }
    const chiTiet = chiTietHoaDonTuDeXuat({ ...deXuat, dongHang: tinh.dong })
    if (chiTiet) {
      const phanBo = phanBoPhuLuc(chiTiet)
      if (phanBo.loi) {
        phatHien.push({ muc: 'loi', ma: 'phan_bo_buffet', truong: 'dongHang', thongDiep: phanBo.loi })
      } else {
        deXuat.tienRuouBia = phanBo.tongKhongDeNghi
      }
    }
  } else {
    const baoCao = lop.map(l => ({ lop: l.nhan, tien: tienRuouBiaCuaLop(l.doc, loaiHd, cotTienHang) }))
      .filter(x => x.tien !== undefined)
    if (baoCao.length) {
      const first = baoCao[0].tien!
      if (baoCao.some(x => !giongTien(x.tien, first))) phatHien.push({ muc: 'canh_bao', ma: 'ruou_bia_lech', truong: 'tienRuouBia', thongDiep: 'Hai nguồn đọc tiền không được thanh toán khác nhau. Đã ưu tiên AI 1; hãy soát lại hóa đơn.' })
      deXuat.tienRuouBia = first
    }
  }
  phatHien.push(...canhBaoDongHang(lop, nguon))

  if (deXuat.tienRuouBia !== undefined && deXuat.tongTien !== undefined && deXuat.tienRuouBia > deXuat.tongTien) {
    phatHien.push({ muc: 'loi', ma: 'ruou_bia_vuot_tong', truong: 'tienRuouBia', thongDiep: 'Tiền không được thanh toán lớn hơn tổng tiền. Không điền số này, hãy nhập tay.' })
    delete deXuat.tienRuouBia
  }

  let trangThai: TrangThaiKiemTra
  if (!soNguon) trangThai = 'loi_ky_thuat'
  else if (phatHien.some(p => p.muc === 'loi')) trangThai = 'khong_hop_le'
  else if (phatHien.some(p => p.muc === 'canh_bao')) trangThai = 'co_canh_bao'
  else trangThai = 'hop_le'
  return { trangThai, deXuat, ai1, ai2, xml, phatHien }
}

export function hopNhatHaiAi(ai1: DuLieuDocTuHoaDon | null, ai2: DuLieuDocTuHoaDon | null, xml: DuLieuDocTuHoaDon | null = null): KetQuaDocHoaDon {
  return hopNhatNoiBo(ai1, ai2, xml)
}

export function hopNhatHaiLop(ai1: DuLieuDocTuHoaDon | null, ai2: DuLieuDocTuHoaDon | null): KetQuaDocHoaDon {
  return hopNhatHaiAi(ai1, ai2)
}

export function ganTrangThai(ketQua: KetQuaDocHoaDon, them: PhatHien[]): KetQuaDocHoaDon {
  const phatHien = [...ketQua.phatHien, ...them]
  let trangThai = ketQua.trangThai
  if (phatHien.some(p => p.muc === 'loi')) trangThai = 'khong_hop_le'
  else if (trangThai === 'hop_le' && phatHien.some(p => p.muc === 'canh_bao')) trangThai = 'co_canh_bao'
  return { ...ketQua, phatHien, trangThai }
}
