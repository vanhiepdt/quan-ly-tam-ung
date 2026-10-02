import { HINH_THUC, TRANG_THAI, type GiaoDichTho, type GiaoDichTinh, type ThamSoTinh } from './kieu'
import { coTinhPhiMacDinh } from './hinh-thuc'
import { soTienThanhToan } from './tien-thanh-toan'
export type { GiaoDichTho, GiaoDichTinh } from './kieu'
export function tinhToan(ds: readonly GiaoDichTho[], thamSo: ThamSoTinh = { tyLePhiChung: 0.15, tyLeTheoNguoi: {} }): GiaoDichTinh[] {
  const daSap = [...ds].sort((a,b) => a.ngay.localeCompare(b.ngay) || a.soThuTu-b.soThuTu || a.taoLuc.localeCompare(b.taoLuc) || a.id.localeCompare(b.id))
  let lyThuyet=0, thucTe=0, dangCam=0, duTienCqTraThang=0
  return daSap.map(gd => {
    const hopLe=gd.trangThaiHd===TRANG_THAI.HOP_LE, tienRong=soTienThanhToan(gd)
    const hoanTamUng=hopLe&&gd.hinhThuc===HINH_THUC.HOAN_TAM_UNG?tienRong:0
    const cqTraThang=hopLe&&gd.hinhThuc===HINH_THUC.CQ_TRA_THANG?tienRong:0
    const chiThucTe=gd.chiThucTe === true
    const laHoanTamUngChiThucTe=hopLe&&chiThucTe&&gd.hinhThuc===HINH_THUC.HOAN_TAM_UNG
    const tongTienChiThucTeHoanUng=laHoanTamUngChiThucTe?gd.tongTien:0
    const thayDoiTienCqTraThang=hopLe&&gd.hinhThuc===HINH_THUC.CQ_TRA_THANG
      ? (chiThucTe ? -gd.tienRuouBia : cqTraThang)
      : 0
    const duaTienCqTraThangChoChiThuy=gd.hinhThuc===HINH_THUC.DUA_TIEN_CQ_TRA_THANG_CHO_CHI_THUY
      ? gd.duaTienCqTraThangChoChiThuy ?? 0
      : 0
    const tyLe=gd.nguoiLayHdId ? thamSo.tyLeTheoNguoi[gd.nguoiLayHdId] ?? thamSo.tyLePhiChung : thamSo.tyLePhiChung
    const coTinhPhi=gd.coTinhPhi ?? coTinhPhiMacDinh(gd.hinhThuc, gd.trangThaiTtPhi, chiThucTe)
    const coHoaDonTinhPhi=gd.hinhThuc===HINH_THUC.HOAN_TAM_UNG || gd.hinhThuc===HINH_THUC.CQ_TRA_THANG
    // Phí lấy HĐ tính theo toàn bộ cột Tổng tiền. Số tiền được hoàn/thanh toán
    // có thể đã loại rượu bia hoặc làm tròn nên không được dùng làm cơ sở phí.
    const phiLayHd=coTinhPhi && coHoaDonTinhPhi ? gd.phiLayHdGhiDe ?? Math.round(gd.tongTien*tyLe) : 0
    const phiDaTra=gd.trangThaiTtPhi===TRANG_THAI.PHI_DA_TRA?phiLayHd:0
    lyThuyet+=gd.tamUngTuCq-hoanTamUng-gd.hoanUngTienMat
    // Cộng dồn riêng mỗi số dư từ dòng trước, giữ nguyên chênh lệch phí đã có.
    // Chi thực tế hoàn tạm ứng trừ toàn bộ Tổng tiền; phí HĐ được cộng lại vào
    // phần phát sinh đang cầm của dòng này, không gán lại số dư đang cầm.
    // Các giao dịch khác vẫn chỉ trừ phí đã trả khỏi tiền đang cầm.
    // Tiền hoàn sửa tay/làm tròn chỉ dùng cho dư lý thuyết ở trên.
    const phatSinhThucTe=gd.tamUngTuCq-gd.giaoTienChiThuy-phiLayHd-gd.hoanUngTienMat-tongTienChiThucTeHoanUng
    const phiCongLaiDangCam=laHoanTamUngChiThucTe?phiLayHd:phiLayHd-phiDaTra
    thucTe+=phatSinhThucTe
    dangCam+=phatSinhThucTe+phiCongLaiDangCam
    duTienCqTraThang+=thayDoiTienCqTraThang-duaTienCqTraThangChoChiThuy
    const tongTienDuaChiThuy=gd.giaoTienChiThuy+duaTienCqTraThangChoChiThuy
    const duHiepDangCam=duTienCqTraThang+dangCam
    return {...gd,duaTienCqTraThangChoChiThuy,hoanTamUng,cqTraThang,phiLayHd,duTienCqTraThang,tongTienDuaChiThuy,duLyThuyet:lyThuyet,duThucTe:thucTe,duDangCam:dangCam,duHiepDangCam}
  })
}
