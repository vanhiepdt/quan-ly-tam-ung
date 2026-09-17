import { HINH_THUC, TRANG_THAI, type GiaoDichTinh } from './kieu'
export function tinhChiSo(ds: readonly GiaoDichTinh[]) {
  const cuoi=ds.at(-1), tong=(f:(g:GiaoDichTinh)=>number)=>ds.reduce((s,g)=>s+f(g),0)
  const tongTamUng=tong(g=>g.tamUngTuCq), tamUngThem=tong(g=>g.hinhThuc===HINH_THUC.TAM_UNG_THEM?g.tamUngTuCq:0)
  const quyToiNhan=tongTamUng-tong(g=>g.giaoTienChiThuy), quyToiDaChi=tong(g=>g.trangThaiTtPhi===TRANG_THAI.PHI_DA_TRA?g.phiLayHd:0), quyToiNopTra=tong(g=>g.hoanUngTienMat), quyToiDu=quyToiNhan-quyToiDaChi-quyToiNopTra
  const thuyGoc=ds.find(g=>g.hinhThuc===HINH_THUC.GIAO_CHI_THUY)?.giaoTienChiThuy??0, thuyThem=tong(g=>g.giaoTienChiThuy)-thuyGoc, thuyDaHoan=tong(g=>g.hoanTamUng), thuyDu=thuyGoc+thuyThem-thuyDaHoan
  const tongBill=tong(g=>g.tongTien), tongRuouBia=tong(g=>g.tienRuouBia), cqTraThang=tong(g=>g.cqTraThang), tongChiThucTe=quyToiDaChi+thuyDaHoan
  const cho=(hinhThuc:string)=>tong(g=>g.trangThaiHd===TRANG_THAI.CHO_HD&&g.hinhThuc===hinhThuc?g.tongTien-g.tienRuouBia:0)
  const tonQuyCoQuan=quyToiDu+thuyDu
  return {tongTamUng,tamUngThem,tonQuyCoQuan,duNoLyThuyet:cuoi?.duLyThuyet??0,quyToiNhan,quyToiDaChi,quyToiNopTra,quyToiDu,thuyGoc,thuyThem,thuyDaHoan,thuyDu,tongBill,tongRuouBia,cqTraThang,tongChiThucTe,choHd:cho(HINH_THUC.HOAN_TAM_UNG),choCqTraThang:cho(HINH_THUC.CQ_TRA_THANG),duThucTe:cuoi?.duThucTe??0,duDangCam:cuoi?.duDangCam??0,canDoi:tonQuyCoQuan+tongChiThucTe+quyToiNopTra===tongTamUng}
}
