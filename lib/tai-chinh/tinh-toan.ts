import { HINH_THUC, TRANG_THAI, type GiaoDichTho, type GiaoDichTinh, type ThamSoTinh } from './kieu'
export type { GiaoDichTho, GiaoDichTinh } from './kieu'
export function tinhToan(ds: readonly GiaoDichTho[], thamSo: ThamSoTinh = { tyLePhiChung: 0.15, tyLeTheoNguoi: {} }): GiaoDichTinh[] {
  const daSap = [...ds].sort((a,b) => a.ngay.localeCompare(b.ngay) || a.soThuTu-b.soThuTu || a.taoLuc.localeCompare(b.taoLuc) || a.id.localeCompare(b.id))
  let lyThuyet=0, thucTe=0, dangCam=0
  return daSap.map(gd => {
    const hopLe=gd.trangThaiHd===TRANG_THAI.HOP_LE, tienRong=gd.tongTien-gd.tienRuouBia
    const hoanTamUng=hopLe&&gd.hinhThuc===HINH_THUC.HOAN_TAM_UNG?tienRong:0
    const cqTraThang=hopLe&&gd.hinhThuc===HINH_THUC.CQ_TRA_THANG?tienRong:0
    const tyLe=gd.nguoiLayHdId ? thamSo.tyLeTheoNguoi[gd.nguoiLayHdId] ?? thamSo.tyLePhiChung : thamSo.tyLePhiChung
    const phiLayHd=gd.phiLayHdGhiDe ?? Math.round(hoanTamUng*tyLe)
    const phiDaTra=gd.trangThaiTtPhi===TRANG_THAI.PHI_DA_TRA?phiLayHd:0
    lyThuyet+=gd.tamUngTuCq-hoanTamUng-gd.hoanUngTienMat
    thucTe+=gd.tamUngTuCq-gd.giaoTienChiThuy-phiLayHd-gd.hoanUngTienMat
    dangCam+=gd.tamUngTuCq-gd.giaoTienChiThuy-phiDaTra-gd.hoanUngTienMat
    return {...gd,hoanTamUng,cqTraThang,phiLayHd,duLyThuyet:lyThuyet,duThucTe:thucTe,duDangCam:dangCam}
  })
}
