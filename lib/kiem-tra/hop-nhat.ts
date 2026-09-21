import type { DonViDoiChieu, DuLieuDocTuHoaDon, KetQuaDocHoaDon, PhatHien, TrangThaiKiemTra } from './giao-dien'
import { TRUONG_KHOA_QR } from './giao-dien'
import { doanCotTienHang, doanLoaiHoaDon, nhanLoaiHoaDon } from './loai-hoa-don'
import { giongChuoi, giongMst, giongTien, hienThiMst } from './qr-hoa-don'
import { congTienRuouBia, ganCoRuouBiaTuAi, tienRuouBiaCuaLop } from './ruou-bia'

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

const KHOA_QR = new Set<string>(TRUONG_KHOA_QR)

function giaTri(doc: DuLieuDocTuHoaDon, khoa: keyof DuLieuDocTuHoaDon): unknown {
  return doc[khoa]
}

function coGiaTri(value: unknown): boolean {
  return value !== undefined && value !== ''
}

function giongTruong(khoa: keyof DuLieuDocTuHoaDon, a?: DuLieuDocTuHoaDon, b?: DuLieuDocTuHoaDon): boolean {
  if (!a || !b) return true
  const x = giaTri(a, khoa), y = giaTri(b, khoa)
  if (!coGiaTri(x) || !coGiaTri(y)) return true
  if (khoa === 'mstBanHang' || khoa === 'mstMuaHang') return giongMst(String(x), String(y))
  if (khoa === 'tongTien' || khoa === 'tongCong' || khoa === 'tienThue' || khoa === 'tienRuouBia') {
    return giongTien(Number(x), Number(y))
  }
  if (khoa === 'tenMuaHang' || khoa === 'tenBanHang') return tenGanDung(String(x), String(y))
  if (khoa === 'diaChiMuaHang') return diaChiGanDung(String(x), String(y))
  return giongChuoi(String(x), String(y))
}

function canhBaoLech(ma: string, khoa: string, thongDiep: string): PhatHien {
  return { muc: 'canh_bao', ma, truong: khoa, thongDiep }
}

function chonGiaTri(
  khoa: (typeof TRUONG_DIEN)[number],
  qr: DuLieuDocTuHoaDon | null,
  ocr: DuLieuDocTuHoaDon | null,
  ai: DuLieuDocTuHoaDon | null,
): { giaTri: unknown; phat: PhatHien[] } {
  const vQr = qr ? giaTri(qr, khoa) : undefined
  const vOcr = ocr ? giaTri(ocr, khoa) : undefined
  const vAi = ai ? giaTri(ai, khoa) : undefined
  const phat: PhatHien[] = []
  const nhan = NHAN[khoa] ?? khoa

  if (KHOA_QR.has(khoa) && coGiaTri(vQr)) {
    if (qr && ai && coGiaTri(vAi) && !giongTruong(khoa, qr, ai)) {
      phat.push(canhBaoLech('ai_lech_qr', khoa, `AI đọc ${nhan} khác QR. Giữ giá trị QR.`))
    }
    if (qr && ocr && coGiaTri(vOcr) && !giongTruong(khoa, qr, ocr)) {
      phat.push(canhBaoLech('ocr_lech_qr', khoa, `OCR đọc ${nhan} khác QR. Giữ giá trị QR.`))
    }
    return { giaTri: vQr, phat }
  }

  if (coGiaTri(vOcr) && coGiaTri(vAi)) {
    if (ocr && ai && !giongTruong(khoa, ocr, ai)) {
      phat.push(canhBaoLech('ocr_lech_ai', khoa, `OCR và AI đọc ${nhan} khác nhau. Giữ chữ trên trang hóa đơn.`))
    }
    return { giaTri: vOcr, phat }
  }
  if (coGiaTri(vOcr)) {
    if (ai) {
      phat.push(canhBaoLech('ai_thieu_truong', khoa, `AI không đọc được ${nhan}. Lấy từ chữ trên hóa đơn (OCR).`))
    }
    return { giaTri: vOcr, phat }
  }
  if (coGiaTri(vAi)) {
    if (ocr) {
      phat.push(canhBaoLech('ocr_thieu_truong', khoa, `OCR không đọc được ${nhan}. Lấy từ AI.`))
    }
    return { giaTri: vAi, phat }
  }
  if (coGiaTri(vQr)) return { giaTri: vQr, phat }
  return { giaTri: undefined, phat }
}

function boDau(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function tenGanDung(a?: string, b?: string): boolean {
  const x = boDau(a ?? ''), y = boDau(b ?? '')
  if (!x || !y) return true
  if (x === y) return true
  const ngan = x.length <= y.length ? x : y
  const dai = x.length <= y.length ? y : x
  // Tên ngắn chỉ được coi là khớp khi chiếm phần lớn tên dài, tránh “Trung tâm Đào tạo”
  // nuốt hết “Trung tâm Đào tạo Ngân hàng Chính sách xã hội”.
  return dai.startsWith(ngan) && ngan.length >= Math.min(24, Math.floor(dai.length * 0.7))
}

function chuanHoaDiaChi(value: string): string {
  return boDau(value)
    .replace(/\bviet nam\b/g, ' ')
    .replace(/\bthanh pho\b/g, 'tp')
    .replace(/\bso\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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
      thongDiep: `Không đọc được tên đơn vị mua hàng. Tên đơn vị phải là “${tenDonVi}” (hoa/thường chữ đầu không ảnh hưởng).`,
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

function hopDongHang(
  ocr: DuLieuDocTuHoaDon | null,
  ai: DuLieuDocTuHoaDon | null,
): DuLieuDocTuHoaDon['dongHang'] {
  const ocrDong = ocr?.dongHang ?? []
  const aiDong = ai?.dongHang ?? []
  if (ocrDong.length) return ocrDong
  if (aiDong.length) return aiDong
}

// QR khóa số in trên mã. OCR đọc chữ trang. AI đối chiếu. Người mua lấy từ OCR∩AI.
export function hopNhatBaLop(
  qr: DuLieuDocTuHoaDon | null,
  ocr: DuLieuDocTuHoaDon | null,
  ai: DuLieuDocTuHoaDon | null,
): KetQuaDocHoaDon {
  const phatHien: PhatHien[] = []
  const soNguon = [qr, ocr, ai].filter(Boolean).length
  if (!qr) phatHien.push({
    muc: 'canh_bao', ma: 'qr_khong_doc_duoc',
    thongDiep: 'Không đọc được QR hóa đơn điện tử. Đối chiếu bằng OCR và AI, hãy soát kỹ hơn.',
  })
  if (!ocr) phatHien.push({
    muc: 'canh_bao', ma: 'ocr_khong_doc_duoc',
    thongDiep: 'Không đọc được chữ trên trang hóa đơn (OCR). Đối chiếu bằng QR và AI.',
  })
  if (!ai) phatHien.push({
    muc: 'canh_bao', ma: 'ai_khong_chay',
    thongDiep: 'Lớp AI không chạy được. Đối chiếu bằng QR và OCR (có thể thiếu tiền rượu bia).',
  })
  if (soNguon === 1) phatHien.push({
    muc: 'canh_bao', ma: 'mot_nguon',
    thongDiep: 'Chỉ một lớp đọc được hóa đơn nên không đối chiếu chéo được. Hãy soát kỹ hơn.',
  })

  const deXuat: DuLieuDocTuHoaDon = {}
  for (const khoa of TRUONG_DIEN) {
    const { giaTri: value, phat } = chonGiaTri(khoa, qr, ocr, ai)
    phatHien.push(...phat)
    if (coGiaTri(value)) (deXuat as Record<string, unknown>)[khoa] = value
  }
  if (deXuat.tongTien !== undefined) deXuat.tongCong = deXuat.tongTien

  let dongHang = hopDongHang(ocr, ai)
  if (dongHang?.length && ai?.dongHang?.length) dongHang = ganCoRuouBiaTuAi(dongHang, ai.dongHang)
  const loaiHd = doanLoaiHoaDon({
    loaiHd: ocr?.loaiHd, loaiHdPhu: ai?.loaiHd,
    kyHieuHd: deXuat.kyHieuHd ?? qr?.kyHieuHd ?? ocr?.kyHieuHd ?? ai?.kyHieuHd,
  })
  const cotTienHang = doanCotTienHang({
    cotTienHang: ocr?.cotTienHang, cotTienHangPhu: ai?.cotTienHang,
    dongHang, loaiHd,
  })
  if (loaiHd) deXuat.loaiHd = loaiHd
  if (cotTienHang) deXuat.cotTienHang = cotTienHang
  const tenLoai = nhanLoaiHoaDon(loaiHd)
  if (tenLoai) {
    phatHien.push({
      muc: 'thong_tin', ma: loaiHd === 'gtgt' ? 'loai_hd_gtgt' : 'loai_hd_ban_hang',
      thongDiep: `Nhận ${tenLoai}${cotTienHang === 'sau_thue' ? ', cột thành tiền đã gồm thuế GTGT' : cotTienHang === 'truoc_thue' ? ', cột thành tiền chưa gồm thuế GTGT' : ''}.`,
    })
  }

  let tienDong: number | undefined
  if (dongHang?.length) {
    const { tien, dong } = congTienRuouBia(dongHang, loaiHd, cotTienHang)
    deXuat.dongHang = dong
    tienDong = tien
  }

  // AI kiểm rượu bia: khóa JSON, không thì cộng dòng AI, không thì cộng dòng đã gắn (danh mục).
  // Không bịa số khi AI không chạy — bảng đối chiếu hiện “không đọc được”.
  const tienAi = tienRuouBiaCuaLop(ai, loaiHd, cotTienHang)
  if (tienAi !== undefined && tienDong !== undefined && !giongTien(tienAi, tienDong)) {
    phatHien.push({
      muc: 'canh_bao', ma: 'ruou_bia_lech', truong: 'tienRuouBia',
      thongDiep: `AI ghi tiền rượu bia ${tienAi.toLocaleString('vi-VN')}đ, cộng dòng hàng được ${tienDong.toLocaleString('vi-VN')}đ. Lấy số AI.`,
    })
  }
  if (tienAi !== undefined) deXuat.tienRuouBia = tienAi
  else if (ocr?.tienRuouBia !== undefined) deXuat.tienRuouBia = ocr.tienRuouBia
  else if (ai && tienDong !== undefined && deXuat.dongHang?.some(d => d.laRuouBia)) {
    deXuat.tienRuouBia = tienDong
  }

  if (deXuat.tienRuouBia !== undefined && deXuat.tongTien !== undefined && deXuat.tienRuouBia > deXuat.tongTien) {
    phatHien.push({
      muc: 'loi', ma: 'ruou_bia_vuot_tong', truong: 'tienRuouBia',
      thongDiep: 'Tiền rượu bia lớn hơn tổng tiền. Không điền số rượu bia, hãy nhập tay.',
    })
    delete deXuat.tienRuouBia
  }

  const aiKetQua = ai && tienAi !== undefined && ai.tienRuouBia === undefined
    ? { ...ai, tienRuouBia: tienAi }
    : ai

  let trangThai: TrangThaiKiemTra
  if (!qr && !ocr && !ai) trangThai = 'loi_ky_thuat'
  else if (phatHien.some(p => p.muc === 'loi')) trangThai = 'khong_hop_le'
  else if (phatHien.some(p => p.muc === 'canh_bao')) trangThai = 'co_canh_bao'
  else trangThai = 'hop_le'

  return { trangThai, deXuat, qr, ocr, ai: aiKetQua, phatHien }
}

export function hopNhatHaiLop(qr: DuLieuDocTuHoaDon | null, ai: DuLieuDocTuHoaDon | null): KetQuaDocHoaDon {
  return hopNhatBaLop(qr, null, ai)
}

export function ganTrangThai(ketQua: KetQuaDocHoaDon, them: PhatHien[]): KetQuaDocHoaDon {
  const phatHien = [...ketQua.phatHien, ...them]
  let trangThai = ketQua.trangThai
  if (phatHien.some(p => p.muc === 'loi')) trangThai = 'khong_hop_le'
  else if (trangThai === 'hop_le' && phatHien.some(p => p.muc === 'canh_bao')) trangThai = 'co_canh_bao'
  return { ...ketQua, phatHien, trangThai }
}
