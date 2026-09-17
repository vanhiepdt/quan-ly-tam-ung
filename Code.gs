/**
 * QUẢN LÝ TẠM ỨNG - TIẾP KHÁCH - HOÀN ỨNG HÓA ĐƠN
 * Apps Script cho workbook "QUAN LY TAM UNG - TIEP KHACH"
 *
 * Thiết kế: mọi công thức trong file đều TỰ CO GIÃN khi chèn/xóa dòng
 *   - Số dư lũy kế: SUM neo từ dòng đầu, ví dụ =SUM($P$7:$P9)-...
 *   - Dòng Tổng cộng: =SUM(I$7:INDEX(I:I,ROW()-1))
 *   - Tab Tổng quan: SUMIF/SUMIFS quét cả vùng $7:$1000
 * Nên script chỉ cần: chèn dòng đúng chỗ + rải công thức cho dòng mới.
 *
 * Menu: ⚙️ Quản lý tạm ứng
 */

// =================================================================== CẤU HÌNH
var CH = {
  SHEET_DATA: 'Nhật ký',
  SHEET_TONG_QUAN: 'Tổng quan',
  SHEET_DANH_MUC: 'Danh mục',

  // Nhãn dùng để dò vị trí (không hard-code số dòng)
  NHAN_TIEU_DE_DAU: 'Ngày tháng',
  NHAN_TONG_CONG: 'Tổng cộng',

  // Ô chứa tỷ lệ phí lấy hóa đơn ở tab Danh mục
  O_TY_LE_PHI: 'C14',
  TY_LE_PHI_MAC_DINH: 0.15,

  // Giá trị dropdown
  DS_TRANG_THAI_HD: ['Hợp lệ', 'Chờ HĐ', 'Không hợp lệ'],
  DS_HINH_THUC: ['Tạm ứng từ cơ quan', 'Tạm ứng thêm', 'Giao tiền chị Thúy',
                 'Hoàn tạm ứng', 'Cơ quan trả thẳng', 'Nộp hoàn CQ'],
  DS_TT_PHI: ['Đã thanh toán', 'Chưa thanh toán', 'Không phát sinh', 'Đã hoàn trả'],
  DS_LOAI_HD: ['Hóa đơn Giá trị gia tăng', 'Hóa đơn Bán hàng', 'Phiếu chi CQ',
               'Giấy biên nhận', 'Giấy nộp tiền', 'Khác'],

  HD_HOP_LE: 'Hợp lệ',
  HT_HOAN_TAM_UNG: 'Hoàn tạm ứng',
  HT_CQ_TRA_THANG: 'Cơ quan trả thẳng',
  PHI_DA_THANH_TOAN: 'Đã thanh toán',

  DONG_CUOI_VUNG: 1000,   // vùng dropdown quét tới dòng này

  // Giá trị mặc định cho dòng mới
  MAC_DINH: {
    DIEN_NGAY_HOM_NAY: true,
    LOAI_HD: 'Hóa đơn Giá trị gia tăng',
    TRANG_THAI_HD: 'Chờ HĐ',
    HINH_THUC: 'Hoàn tạm ứng',
    TT_PHI: 'Chưa thanh toán'
  }
};

// Cột trong tab Nhật ký
var C = {
  ngay: 'B', noiDung: 'C', kyHieu: 'D', soHD: 'E', loaiHD: 'F',
  trangThaiHD: 'G', hinhThuc: 'H', tienBill: 'I', ruouBia: 'J',
  hoanTU: 'K', cqTraThang: 'L', phiHD: 'M', nguoiLay: 'N', ttPhi: 'O',
  tuCQ: 'P', giaoThuy: 'Q', hoanCQ: 'R',
  duLyThuyet: 'S', duThucTe: 'T', duDangCam: 'U', ghiChu: 'V'
};

var COT_DAU = 2;    // B
var COT_CUOI = 22;  // V

// ====================================================================== MENU
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Quản lý tạm ứng')
    .addItem('➕ Thêm 1 dòng mới', 'themDongMoi')
    .addItem('🗑️ Xóa dòng đang chọn', 'xoaDongDangChon')
    .addSeparator()
    .addItem('🔧 Sửa toàn bộ công thức', 'suaToanBoCongThuc')
    .addItem('🔍 Kiểm tra & chẩn đoán', 'chanDoan')
    .addSeparator()
    .addItem('🔄 Dò lại dấu phân cách', 'doLaiDauPhanCach')
    .addToUi();
}

// ================================================= DÒ DẤU PHÂN CÁCH ĐỐI SỐ
/**
 * Sheets nhận "," (locale US) hoặc ";" (locale VN/EU) trong setFormula.
 * Ghi sai dấu -> ô báo #ERROR! (lỗi CÚ PHÁP, khác #REF!/#VALUE!).
 * Không có API đọc trực tiếp, nên thử ghi =SUM(1,2) vào sheet tạm.
 */
var _SEP_CACHE = null;

function laySep_() {
  if (_SEP_CACHE) return _SEP_CACHE;

  var props = PropertiesService.getDocumentProperties();
  var luu = props.getProperty('SEP');
  if (luu === ',' || luu === ';') { _SEP_CACHE = luu; return luu; }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetHienTai = ss.getActiveSheet();
  var tam = null;
  var sep = ',';
  try {
    tam = ss.insertSheet('__do_dau_phay__' + Date.now());
    tam.getRange('A1').setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    if (Number(tam.getRange('A1').getValue()) !== 3) sep = ';';
  } catch (e) {
    sep = ';';
  } finally {
    if (tam) { try { ss.deleteSheet(tam); } catch (e2) {} }
    try { ss.setActiveSheet(sheetHienTai); } catch (e3) {}
  }

  props.setProperty('SEP', sep);
  _SEP_CACHE = sep;
  return sep;
}

function doLaiDauPhanCach() {
  PropertiesService.getDocumentProperties().deleteProperty('SEP');
  _SEP_CACHE = null;
  var sep = laySep_();
  thongBao_('Đã dò lại: file này dùng dấu "' + sep + '" để phân cách đối số.');
}

/** Đổi placeholder ~ thành dấu phân cách thật của file */
function apSep_(matran, sep) {
  return matran.map(function (dong) {
    return dong.map(function (o) {
      return typeof o === 'string' ? o.replace(/~/g, sep) : o;
    });
  });
}

// ================================================================== BỐ CỤC
/**
 * Dò bố cục theo NHÃN, không hard-code số dòng.
 * Trả về {dongTieuDe, dongDau, dongTong, dongCuoiData, soDongData}
 */
function layBoCuc_(sheet) {
  var soDong = sheet.getLastRow();
  var giaTri = sheet.getRange(1, COT_DAU, Math.max(soDong, 1), 1).getDisplayValues();

  var dongTieuDe = 0, dongTong = 0;
  for (var i = 0; i < giaTri.length; i++) {
    var v = chuan_(giaTri[i][0]);
    if (!dongTieuDe && v === chuan_(CH.NHAN_TIEU_DE_DAU)) dongTieuDe = i + 1;
    if (!dongTong && v === chuan_(CH.NHAN_TONG_CONG)) dongTong = i + 1;
  }

  if (!dongTieuDe) throw new Error(
    'Không tìm thấy dòng tiêu đề (ô có chữ "' + CH.NHAN_TIEU_DE_DAU + '" ở cột B).');
  if (!dongTong) throw new Error(
    'Không tìm thấy dòng tổng (ô có chữ "' + CH.NHAN_TONG_CONG + '" ở cột B).');
  if (dongTong <= dongTieuDe + 1) throw new Error(
    'Bảng không còn dòng dữ liệu nào giữa tiêu đề và dòng Tổng cộng.');

  return {
    dongTieuDe: dongTieuDe,
    dongDau: dongTieuDe + 1,
    dongTong: dongTong,
    dongCuoiData: dongTong - 1,
    soDongData: dongTong - 1 - dongTieuDe
  };
}

function laySheetData_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CH.SHEET_DATA);
  if (!sheet) throw new Error('Không tìm thấy tab "' + CH.SHEET_DATA + '".');
  return sheet;
}

function layTyLePhi_() {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CH.SHEET_DANH_MUC);
    if (sh) {
      var v = Number(sh.getRange(CH.O_TY_LE_PHI).getValue());
      if (!isNaN(v) && v >= 0 && v < 1) return v;
    }
  } catch (e) {}
  return CH.TY_LE_PHI_MAC_DINH;
}

// ======================================================== SINH CÔNG THỨC
/** Công thức K, L, M, S, T, U cho một dòng (dùng ~ thay dấu phân cách) */
function congThucDong_(r, dongDau, tyLePhi) {
  var d = dongDau;
  var tienChiHoan = 'SUM($' + C.tienBill + r + ')-SUM($' + C.ruouBia + r + ')';

  return {
    K: '=IF(AND($' + C.trangThaiHD + r + '="' + CH.HD_HOP_LE + '"~$' +
       C.hinhThuc + r + '="' + CH.HT_HOAN_TAM_UNG + '")~' + tienChiHoan + '~0)',
    L: '=IF(AND($' + C.trangThaiHD + r + '="' + CH.HD_HOP_LE + '"~$' +
       C.hinhThuc + r + '="' + CH.HT_CQ_TRA_THANG + '")~' + tienChiHoan + '~0)',
    M: '=ROUND(SUM($' + C.hoanTU + r + ')*' + tyLePhi + '~0)',

    // Lũy kế bằng SUM neo dòng đầu -> chèn/xóa dòng giữa bảng không đứt chuỗi
    S: '=SUM($' + C.tuCQ + '$' + d + ':$' + C.tuCQ + r + ')' +
       '-SUM($' + C.hoanTU + '$' + d + ':$' + C.hoanTU + r + ')' +
       '-SUM($' + C.hoanCQ + '$' + d + ':$' + C.hoanCQ + r + ')',
    T: '=SUM($' + C.tuCQ + '$' + d + ':$' + C.tuCQ + r + ')' +
       '-SUM($' + C.giaoThuy + '$' + d + ':$' + C.giaoThuy + r + ')' +
       '-SUM($' + C.phiHD + '$' + d + ':$' + C.phiHD + r + ')' +
       '-SUM($' + C.hoanCQ + '$' + d + ':$' + C.hoanCQ + r + ')',
    U: '=SUM($' + C.tuCQ + '$' + d + ':$' + C.tuCQ + r + ')' +
       '-SUM($' + C.giaoThuy + '$' + d + ':$' + C.giaoThuy + r + ')' +
       '-SUMIF($' + C.ttPhi + '$' + d + ':$' + C.ttPhi + r + '~"' +
       CH.PHI_DA_THANH_TOAN + '"~$' + C.phiHD + '$' + d + ':$' + C.phiHD + r + ')' +
       '-SUM($' + C.hoanCQ + '$' + d + ':$' + C.hoanCQ + r + ')'
  };
}

/** Ghi lại K:M và S:U cho toàn bộ vùng dữ liệu */
function ghiCongThucVung_(sheet, dongDau, dongCuoi, sep, tyLePhi) {
  var ctKLM = [], ctSTU = [];
  for (var r = dongDau; r <= dongCuoi; r++) {
    var ct = congThucDong_(r, dongDau, tyLePhi);
    ctKLM.push([ct.K, ct.L, ct.M]);
    ctSTU.push([ct.S, ct.T, ct.U]);
  }
  var n = dongCuoi - dongDau + 1;
  sheet.getRange(dongDau, 11, n, 3).setFormulas(apSep_(ctKLM, sep));  // K:M
  sheet.getRange(dongDau, 19, n, 3).setFormulas(apSep_(ctSTU, sep));  // S:U
}

/** Ghi lại dòng Tổng cộng: SUM tự nới + S/T/U lấy dòng ngay trên */
function ghiDongTongCong_(sheet, dongTong, dongDau, sep) {
  var cotSum = ['I', 'J', 'K', 'L', 'M', 'P', 'Q', 'R'];
  cotSum.forEach(function (letter) {
    var ct = '=SUM(' + letter + '$' + dongDau + ':INDEX(' + letter + ':' + letter +
             '~ROW()-1))';
    sheet.getRange(letter + dongTong).setFormula(ct.replace(/~/g, sep));
  });

  ['S', 'T', 'U'].forEach(function (letter) {
    var ct = '=INDEX(' + letter + ':' + letter + '~ROW()-1)';
    sheet.getRange(letter + dongTong).setFormula(ct.replace(/~/g, sep));
  });
}

// ================================================================ DROPDOWN
function apDropdown_(sheet, dongDau) {
  var den = CH.DONG_CUOI_VUNG;
  var n = den - dongDau + 1;
  if (n <= 0) return;

  function dv(ds) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(ds, true)
      .setAllowInvalid(false)
      .build();
  }

  sheet.getRange(C.loaiHD + dongDau + ':' + C.loaiHD + den)
       .setDataValidation(dv(CH.DS_LOAI_HD));
  sheet.getRange(C.trangThaiHD + dongDau + ':' + C.trangThaiHD + den)
       .setDataValidation(dv(CH.DS_TRANG_THAI_HD));
  sheet.getRange(C.hinhThuc + dongDau + ':' + C.hinhThuc + den)
       .setDataValidation(dv(CH.DS_HINH_THUC));
  sheet.getRange(C.ttPhi + dongDau + ':' + C.ttPhi + den)
       .setDataValidation(dv(CH.DS_TT_PHI));
}

// ========================================================= THÊM 1 DÒNG MỚI
function themDongMoi() {
  var sheet = laySheetData_();
  var bc = layBoCuc_(sheet);
  var sep = laySep_();
  var tyLePhi = layTyLePhi_();

  var dongMoi = bc.dongTong;          // chèn ngay trước dòng Tổng cộng
  var dongMau = bc.dongCuoiData;      // lấy định dạng từ dòng dữ liệu cuối

  sheet.insertRowsBefore(dongMoi, 1);

  // Chèn TRÊN dòng Tổng cộng nên dòng mẫu (dữ liệu cuối) vẫn giữ nguyên số dòng.
  // Sao chép định dạng + dropdown từ dòng mẫu sang dòng mới.
  var nguon = sheet.getRange(dongMau, COT_DAU, 1, COT_CUOI - COT_DAU + 1);
  var dich = sheet.getRange(dongMoi, COT_DAU, 1, COT_CUOI - COT_DAU + 1);
  nguon.copyTo(dich, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  nguon.copyTo(dich, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);

  // Xóa nội dung các cột nhập tay, giữ nguyên định dạng
  ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'N', 'O', 'P', 'Q', 'R', 'V']
    .forEach(function (letter) {
      sheet.getRange(letter + dongMoi).clearContent();
    });

  dienMacDinh_(sheet, dongMoi);

  // Ghi lại công thức toàn vùng (rẻ, chắc chắn đúng vị trí)
  var dongTongMoi = bc.dongTong + 1;
  ghiCongThucVung_(sheet, bc.dongDau, dongTongMoi - 1, sep, tyLePhi);
  ghiDongTongCong_(sheet, dongTongMoi, bc.dongDau, sep);

  SpreadsheetApp.flush();
  sheet.setActiveRange(sheet.getRange(C.ngay + dongMoi));
  thongBao_('Đã thêm dòng ' + dongMoi + '. Nhập từ cột "Ngày tháng".');
}

function dienMacDinh_(sheet, dong) {
  var md = CH.MAC_DINH;

  if (md.DIEN_NGAY_HOM_NAY) {
    var homNay = new Date();
    homNay.setHours(0, 0, 0, 0);   // bỏ phần giờ, tránh ra số thập phân
    sheet.getRange(C.ngay + dong).setValue(homNay);
  }
  if (md.LOAI_HD) sheet.getRange(C.loaiHD + dong).setValue(md.LOAI_HD);
  if (md.TRANG_THAI_HD) sheet.getRange(C.trangThaiHD + dong).setValue(md.TRANG_THAI_HD);
  if (md.HINH_THUC) sheet.getRange(C.hinhThuc + dong).setValue(md.HINH_THUC);
  if (md.TT_PHI) sheet.getRange(C.ttPhi + dong).setValue(md.TT_PHI);

  // Các cột số để 0 cho gọn mắt
  ['I', 'J', 'P', 'Q', 'R'].forEach(function (letter) {
    sheet.getRange(letter + dong).setValue(0);
  });
}

// ====================================================== XÓA DÒNG ĐANG CHỌN
function xoaDongDangChon() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = laySheetData_();
  var ui = SpreadsheetApp.getUi();

  if (ss.getActiveSheet().getName() !== CH.SHEET_DATA) {
    thongBao_('Hãy mở tab "' + CH.SHEET_DATA + '" rồi chọn dòng cần xóa.');
    return;
  }

  var bc = layBoCuc_(sheet);
  var dong = sheet.getActiveRange().getRow();

  if (dong < bc.dongDau) {
    thongBao_('Dòng ' + dong + ' là phần tiêu đề, không xóa được.');
    return;
  }
  if (dong >= bc.dongTong) {
    thongBao_('Không xóa được dòng Tổng cộng (dòng ' + bc.dongTong + ').');
    return;
  }
  if (bc.soDongData <= 1) {
    thongBao_('Bảng chỉ còn 1 dòng dữ liệu, giữ lại để bảng không vỡ công thức.');
    return;
  }

  var noiDung = String(sheet.getRange(C.noiDung + dong).getDisplayValue() || '(trống)');
  var tra = ui.alert('Xóa dòng ' + dong + '?',
    'Nội dung: ' + noiDung + '\n\nXóa xong các số dư sẽ được tính lại.',
    ui.ButtonSet.YES_NO);
  if (tra !== ui.Button.YES) return;

  var sep = laySep_();
  var tyLePhi = layTyLePhi_();

  sheet.deleteRows(dong, 1);

  var dongTongMoi = bc.dongTong - 1;
  ghiCongThucVung_(sheet, bc.dongDau, dongTongMoi - 1, sep, tyLePhi);
  ghiDongTongCong_(sheet, dongTongMoi, bc.dongDau, sep);

  SpreadsheetApp.flush();
  thongBao_('Đã xóa dòng ' + dong + ' và tính lại số dư.');
}

// ================================================== SỬA TOÀN BỘ CÔNG THỨC
function suaToanBoCongThuc() {
  var sheet = laySheetData_();
  var bc = layBoCuc_(sheet);
  var sep = laySep_();
  var tyLePhi = layTyLePhi_();

  ghiCongThucVung_(sheet, bc.dongDau, bc.dongCuoiData, sep, tyLePhi);
  ghiDongTongCong_(sheet, bc.dongTong, bc.dongDau, sep);
  apDropdown_(sheet, bc.dongDau);

  SpreadsheetApp.flush();

  var loi = timOLoi_(sheet, bc);
  if (loi.length) {
    thongBao_('Đã ghi lại công thức nhưng còn ' + loi.length + ' ô lỗi: ' +
      loi.slice(0, 10).join(', ') + (loi.length > 10 ? '…' : '') +
      ' — bấm 🔍 Kiểm tra & chẩn đoán để xem chi tiết.');
  } else {
    thongBao_('Đã ghi lại toàn bộ công thức cho ' + bc.soDongData +
      ' dòng dữ liệu. Không còn ô lỗi.');
  }
}

// ==================================================== KIỂM TRA & CHẨN ĐOÁN
function chanDoan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = laySheetData_();
  var bc = layBoCuc_(sheet);

  var d = [];
  d.push('TAB DỮ LIỆU: ' + CH.SHEET_DATA);
  d.push('Dòng tiêu đề: ' + bc.dongTieuDe);
  d.push('Dữ liệu: dòng ' + bc.dongDau + ' → ' + bc.dongCuoiData +
         '  (' + bc.soDongData + ' dòng)');
  d.push('Dòng Tổng cộng: ' + bc.dongTong);
  d.push('Dấu phân cách đối số: "' + laySep_() + '"');
  d.push('Tỷ lệ phí lấy HĐ: ' + (layTyLePhi_() * 100).toFixed(1) + '%');

  var thieu = [CH.SHEET_TONG_QUAN, CH.SHEET_DANH_MUC].filter(function (n) {
    return !ss.getSheetByName(n);
  });
  d.push('Tab phụ: ' + (thieu.length ? 'THIẾU ' + thieu.join(', ') : 'đủ'));

  var loiData = timOLoi_(sheet, bc);
  d.push('');
  d.push('Ô lỗi trong tab ' + CH.SHEET_DATA + ': ' +
         (loiData.length ? loiData.join(', ') : 'không có'));

  var shTQ = ss.getSheetByName(CH.SHEET_TONG_QUAN);
  if (shTQ) {
    var loiTQ = timOLoiSheet_(shTQ);
    d.push('Ô lỗi trong tab ' + CH.SHEET_TONG_QUAN + ': ' +
           (loiTQ.length ? loiTQ.join(', ') : 'không có'));
  }

  SpreadsheetApp.getUi().alert('🔍 Chẩn đoán', d.join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function timOLoi_(sheet, bc) {
  var n = bc.dongTong - bc.dongDau + 1;
  var gt = sheet.getRange(bc.dongDau, COT_DAU, n, COT_CUOI - COT_DAU + 1)
                .getDisplayValues();
  var ra = [];
  for (var i = 0; i < gt.length; i++) {
    for (var j = 0; j < gt[i].length; j++) {
      if (String(gt[i][j]).charAt(0) === '#') {
        ra.push(chuCot_(COT_DAU + j) + (bc.dongDau + i));
      }
    }
  }
  return ra;
}

function timOLoiSheet_(sheet) {
  var soDong = sheet.getLastRow(), soCot = sheet.getLastColumn();
  if (!soDong || !soCot) return [];
  var gt = sheet.getRange(1, 1, soDong, soCot).getDisplayValues();
  var ra = [];
  for (var i = 0; i < gt.length; i++) {
    for (var j = 0; j < gt[i].length; j++) {
      if (String(gt[i][j]).charAt(0) === '#') ra.push(chuCot_(j + 1) + (i + 1));
    }
  }
  return ra;
}

// ================================================================== TIỆN ÍCH
/** So chuỗi tiếng Việt bỏ dấu, bỏ hoa/thường, gộp khoảng trắng */
function chuan_(v) {
  return String(v === null || v === undefined ? '' : v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Số cột -> chữ cái cột */
function chuCot_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

function thongBao_(msg) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, '⚙️ Quản lý tạm ứng', 8);
}
