// Isolated real-component browser tests. No Next server, credentials, or database.
// Run: node scripts/kiem-tra-ui.mjs (installed Edge required).
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const mock = `
window.calls = []; window.responses = []; window.preferenceCalls = []; window.qrCalls = []; window.editCalls = []; window.historyCalls = []; window.historyResponses = [];
async function answer(queue) { const r = queue.shift() ?? {}; if (r.delay) await new Promise(resolve => setTimeout(resolve, r.delay)); if (r.throw) throw Error('Simulated offline'); return r.result ?? r; }
export async function themGiaoDich(_, data) { window.calls.push(Object.fromEntries(data)); return answer(window.responses); }
export async function suaGiaoDich(_, data) { window.editCalls.push(Object.fromEntries(data)); return answer(window.responses); }
export async function xoaMemGiaoDich() { throw Error('Deletion forbidden in harness'); }
export async function luuTuyChonCot(data) { window.preferenceCalls.push(data); const result = await answer(window.responses); if (result.ok && location.pathname === '/ledger') sessionStorage.setItem('fixture-ledger-preferences', JSON.stringify(data)); return result; }
export async function layQrThanhToan(id) { window.qrCalls.push(id); return answer(window.responses); }
export async function layLichSuGiaoDich(id) { window.historyCalls.push(id); return answer(window.historyResponses); }
export async function xemGiayNhap() { return { loi: 'Harness' } }
export async function taiNguoiKyGiay() { return { canBo: [], macDinh: { nguoiDeNghiId: '', lanhDaoTiepKhachId: '', lanhDaoThanhToanId: '', truongPhongId: '', keToanKiemSoatId: '' }, taiKhoanTheoNguoiLayHd: {} } }
export async function docHoaDon() { return { loi: 'Harness' } }
export async function tinhTrangAiHoaDon() { return { muc: 'ok', nha: '', moHinh: '', docAnh: false, thongDiep: 'Harness AI' } }
export async function kiemTraTrungKyHieu(ky) {
  window.kyHieuCalls = window.kyHieuCalls || []; window.kyHieuCalls.push(ky);
  const r = window.kyHieuResponses && window.kyHieuResponses.length ? await answer(window.kyHieuResponses) : {};
  return r;
}
export async function themDonViNhanh(ten) {
  window.unitAdds = window.unitAdds || []; window.unitAdds.push(ten);
  const r = window.unitResponses && window.unitResponses.length ? await answer(window.unitResponses) : {};
  return r.id ? r : { id: 'fixture-unit-new', ten: String(ten).trim(), thanhCong: 'Đã thêm đơn vị.' };
}
`
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {FormGiaoDich} from './app/giao-dich/form';
import {TuyChonCot} from './app/cai-dat/tuy-chon-cot';
import {BangNhatKy} from './app/giao-dich/bang-nhat-ky';
import {ThanhToan} from './app/giao-dich/thanh-toan';
import {cotMacDinh, cotNhatKy} from './app/giao-dich/cot-nhat-ky';
const screen = location.pathname;
window.fixtureColumns = cotNhatKy;
const dong = (phan) => ({id:'r0', ngay:'2026-01-01', soThuTu:1, taoLuc:'2026-01-01T00:00:00.000Z', noiDung:'Tiếp khách',
  kyHieuHd:null, soHd:null, loaiHd:null, trangThaiHd:'Hợp lệ', hinhThuc:'Hoàn tạm ứng', tongTien:0, tienRuouBia:0,
  tamUngTuCq:0, giaoTienChiThuy:0, hoanUngTienMat:0, nguoiLayHdId:null, nguoiLayHdTen:null, phiLayHdGhiDe:null,
  trangThaiTtPhi:'Không phát sinh', ghiChu:null, donViId:null, donViTen:null, coHoaDon:false, coChuyenKhoan:false,
  hoanTamUng:0, cqTraThang:0, phiLayHd:0, duLyThuyet:0, duThucTe:0, duDangCam:0, ...phan});
window.fixtureRows = [
  dong({id:'r1', ngay:'2026-01-03', noiDung:'Tiếp đơn vị thử hai', donViId:'fixture-unit-2', donViTen:'Đơn vị thử hai', tongTien:2000000, hoanTamUng:2000000, duLyThuyet:2000000, soHd:'0000002', trangThaiTtPhi:'Chưa thanh toán'}),
  dong({id:'r2', ngay:'2026-01-01', noiDung:'Tiếp đơn vị thử nghiệm', donViId:'fixture-unit', donViTen:'Đơn vị thử nghiệm', tongTien:900000, hoanTamUng:900000, duLyThuyet:900000, soThuTu:2, kyHieuHd:'1C26MTT', soHd:'0000001', trangThaiHd:'Chờ HĐ', trangThaiTtPhi:'Đã thanh toán'}),
  dong({id:'r3', ngay:'2026-01-02', noiDung:'Tiếp đơn vị thử nghiệm', donViId:'fixture-unit', donViTen:'Đơn vị thử nghiệm', tongTien:1500000, hoanTamUng:1500000, duLyThuyet:1500000, soThuTu:3}),
];
const phuTro = {collectors:[{id:'fixture-collector',ten:'Người lấy HĐ thử'}], donVi:[{id:'fixture-unit',ten:'Đơn vị thử nghiệm'},{id:'fixture-unit-2',ten:'Đơn vị thử hai'}]};
// Chỉ ba hình thức đầu lập giấy đề nghị; hai dòng tiền nội bộ thì không.
window.fixturePaperRows = [
  dong({id:'p1', noiDung:'Tạm ứng thử', hinhThuc:'Tạm ứng thêm'}),
  dong({id:'p2', noiDung:'Tiếp khách thử', hinhThuc:'Hoàn tạm ứng'}),
  dong({id:'p3', noiDung:'Trả thẳng thử', hinhThuc:'Cơ quan trả thẳng'}),
  dong({id:'p4', noiDung:'Giao tiền thử', hinhThuc:'Giao tiền chị Thúy'}),
  dong({id:'p5', noiDung:'Nộp hoàn thử', hinhThuc:'Nộp hoàn CQ'}),
];
const ledgerPreferences = JSON.parse(sessionStorage.getItem('fixture-ledger-preferences') || 'null') ?? {...cotMacDinh(), an: location.search.includes('hidden') ? ['chungTu','tongTien'] : []};
createRoot(document.getElementById('root')).render(screen === '/settings' ? <TuyChonCot banDau={null} loiBanDau={null}/> : screen === '/ledger' ? <BangNhatKy rows={[]} coTheSua={false} banDau={ledgerPreferences} phuTro={phuTro}/> : screen === '/ledger-readonly' ? <BangNhatKy rows={window.fixtureRows} coTheSua={false} banDau={ledgerPreferences} phuTro={{...phuTro, vaiTro: 'chi_doc'}}/> : screen === '/ledger-edit' ? <BangNhatKy rows={window.fixtureRows} coTheSua={true} banDau={ledgerPreferences} phuTro={{...phuTro, vaiTro: location.search.includes('admin') ? 'admin' : 'nhap_lieu'}}/> : screen === '/ledger-paper' ? <BangNhatKy rows={window.fixturePaperRows} coTheSua={false} banDau={ledgerPreferences} phuTro={{...phuTro, vaiTro: 'chi_doc'}}/> : screen === '/payment' ? <table><tbody><tr><td><ThanhToan id="fixture"/></td></tr></tbody></table> : <FormGiaoDich collectors={[{id:'fixture-collector',ten:'Người lấy HĐ thử'}]} donVi={[{id:'fixture-unit-2',ten:'Đơn vị thử hai',so_lan:3,lan_cuoi:'01/01/2026'},{id:'fixture-unit',ten:'Đơn vị thử nghiệm'}]} nguoiLayHdMacDinhId="fixture-collector" trangThaiTtPhiMacDinh="Chưa thanh toán"/>);
`
// next/link kéo theo mã dùng chung của Next, thứ đọc process.env ở cấp module. Next tự thay
// biến này khi đóng gói, còn esbuild thì không, nên phải khai báo để trang thử không vỡ.
const bundle = await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'isolated-actions',setup(b){
 b.onResolve({filter:/^\.\/(actions|don-vi-actions|tuy-chon-actions|thanh-toan-actions|lich-su-actions|xem-giay-actions|doc-hoa-don-actions|trung-ky-hieu-actions)$|^\.\.\/giao-dich\/tuy-chon-actions$/},()=>({path:'mock',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:path.join(root,'node_modules/next/dist/client/components/unstable-rethrow.browser.js')}));
 b.onResolve({filter:/^(pg|argon2|server-only)$|\/db\/|\/xac-thuc\//},args=>{throw Error('Server import forbidden: '+args.path)});
}}]})
const server = createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html; charset=utf-8');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:'<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>')})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({channel:'msedge',headless:true})
const context = await browser.newContext({timezoneId:'Asia/Ho_Chi_Minh'})
const page = await context.newPage()
const errors=[]; page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort())
const queue = responses=>page.evaluate(r=>{window.responses=r},responses)
const DON_VI_LABEL='Đơn vị tiếp khách *'
const oDonVi = ()=>page.getByPlaceholder('Gõ tên đơn vị để tìm hoặc thêm mới')
const chonHinhThuc = type=>page.getByLabel('Hình thức giao dịch *').selectOption(type)
const openForm = async()=>{await page.goto(origin); await page.getByRole('button',{name:'+ Thêm giao dịch',exact:true}).click()}
try {
 await page.clock.install({time:new Date('2026-09-15T18:00:00Z')})
 await openForm()
 await expect(page.getByLabel('Ngày *',{exact:true})).toHaveValue('2026-09-16')
 // Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới có ô chọn đơn vị, và khi có thì Nội dung
 // do đơn vị quyết định nên bị khóa.
 for (const [type,expected] of [['Tạm ứng thêm','Phiếu chi CQ'],['Hoàn tạm ứng','Hóa đơn Giá trị gia tăng'],['Giao tiền chị Thúy','Giấy biên nhận'],['Cơ quan trả thẳng','Hóa đơn Giá trị gia tăng'],['Nộp hoàn CQ','Giấy nộp tiền']]) {
  await chonHinhThuc(type)
  await expect(page.getByLabel('Loại chứng từ *')).toHaveValue(expected)
  const coDonVi = type === 'Hoàn tạm ứng' || type === 'Cơ quan trả thẳng'
  if (coDonVi) await expect(page.getByLabel('Đọc từ hóa đơn')).toBeVisible()
  else await expect(page.getByLabel('Đọc từ hóa đơn')).toHaveCount(0)
  if (coDonVi) {
   // Mặc định là đơn vị chưa tiếp / ít lần nhất; fixture chỉ có một đơn vị.
   await expect(oDonVi()).toHaveValue('Đơn vị thử nghiệm')
   await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit')
   await expect(page.getByLabel('Nội dung *')).toHaveValue('Tiếp Đơn vị thử nghiệm')
   await expect(page.getByLabel('Nội dung *')).toHaveAttribute('readonly','')
   await expect(page.locator('[name="nguoi_lay_hd_id"]')).toHaveValue('fixture-collector')
   await expect(page.getByLabel('Trạng thái thanh toán phí')).toHaveValue('Chưa thanh toán')
  } else {
   await expect(page.getByLabel(DON_VI_LABEL)).toHaveCount(0)
   await expect(page.getByLabel('Nội dung *')).toHaveValue(type)
   await expect(page.getByLabel('Nội dung *')).toHaveAttribute('readonly','')
  }
  // Hình thức thanh toán in trên giấy: ba giá trị, nhưng mỗi hình thức giao dịch chỉ dùng
  // một phần. Hoàn tạm ứng máy tự điền nên không có gì để chọn; cơ quan trả thẳng và tạm
  // ứng thêm để người dùng chọn tiền mặt hay chuyển khoản; hai dòng tiền nội bộ không lập
  // giấy nên không có mục này.
  const oChonThanhToan = page.getByLabel('In trên giấy đề nghị *')
  if (type === 'Hoàn tạm ứng') {
   await expect(oChonThanhToan).toHaveCount(0)
   await expect(page.getByRole('heading',{name:'Hình thức thanh toán',exact:true})).toBeVisible()
   await expect(page.getByText('Máy tự điền theo hình thức giao dịch')).toBeVisible()
  } else if (type === 'Cơ quan trả thẳng' || type === 'Tạm ứng thêm') {
   await expect(oChonThanhToan.locator('option')).toHaveCount(2)
   await expect(oChonThanhToan).toHaveValue('tien_mat')
   // Chọn chuyển khoản thì form phải nói trước số tài khoản sẽ in; chưa cấu hình thì cảnh báo.
   await oChonThanhToan.selectOption('chuyen_khoan')
   await expect(page.getByText('Chưa có số tài khoản nhận tiền.')).toBeVisible()
   await oChonThanhToan.selectOption('tien_mat')
   await expect(page.getByText('Chưa có số tài khoản nhận tiền.')).toHaveCount(0)
  } else {
   await expect(page.getByRole('heading',{name:'Hình thức thanh toán',exact:true})).toHaveCount(0)
   await expect(oChonThanhToan).toHaveCount(0)
  }
  await queue([{loi:'Validation fixture'}]); await page.getByRole('button',{name:'Lưu giao dịch',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.calls.at(-1)?.loai_hd)).toBe(expected)
  await expect.poll(()=>page.evaluate(()=>window.calls.at(-1)?.don_vi_id)).toBe(coDonVi?'fixture-unit':undefined)
  await expect.poll(()=>page.evaluate(()=>window.calls.at(-1)?.hinh_thuc_thanh_toan))
   .toBe(type === 'Hoàn tạm ứng' ? 'hoan_tam_ung' : type === 'Cơ quan trả thẳng' || type === 'Tạm ứng thêm' ? 'tien_mat' : undefined)
  await expect(page.getByRole('button',{name:'Lưu giao dịch',exact:true})).toBeEnabled()
  await expect(page.getByLabel('Hình thức giao dịch *')).toHaveValue(type)
  await expect(page.getByLabel('Loại chứng từ *')).toHaveValue(expected)
  await expect(page.getByLabel('Nội dung *')).toHaveValue(coDonVi?'Tiếp Đơn vị thử nghiệm':type)
  if (coDonVi) await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit')
 }
 console.log('PASS local date before 07:00 Vietnam, unit-only transaction types, locked derived description, actual submitted document types and the three printed payment methods')
 await chonHinhThuc('Hoàn tạm ứng')
 await oDonVi().fill('thử')
 await expect(page.getByRole('option',{name:/Đơn vị thử nghiệm/})).toBeVisible()
 await oDonVi().fill('Đơn vị mới')
 await page.getByRole('button',{name:'Thêm “Đơn vị mới” vào danh sách'}).click()
 await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit-new')
 await expect(page.getByLabel('Nội dung *')).toHaveValue('Tiếp Đơn vị mới')
 await oDonVi().fill('Đơn vị thử nghiệm')
 await page.getByRole('option',{name:/Đơn vị thử nghiệm/}).click()
 await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit')
 console.log('PASS unit combobox search and quick-add')
 await page.evaluate(() => { window.kyHieuResponses = [{ canhBao: 'Ký hiệu HĐ 1C26MTT đã có trên giao dịch ngày 17/09/2026.' }] })
 await page.getByPlaceholder('VD: 1C26MTT').fill('1C26MTT')
 await page.getByPlaceholder('VD: 1C26MTT').blur()
 await expect(page.getByText('Ký hiệu HĐ 1C26MTT đã có trên giao dịch ngày 17/09/2026.')).toBeVisible()
 await expect.poll(() => page.evaluate(() => window.kyHieuCalls && window.kyHieuCalls.at(-1))).toBe('1C26MTT')
 console.log('PASS duplicate invoice-series warning after typing')
 await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit')
 await page.getByLabel('Tổng tiền (VND) *').fill('2000000')
 const warning = fingerprint=>({canhBao:{duLyThuyet:100,hoanTamUng:200,thieu:100,fingerprint}})
 await queue([warning('first')]); await page.getByRole('button',{name:'Lưu giao dịch',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Hoàn ứng vượt dư lý thuyết'})).toBeVisible()
 await page.getByRole('button',{name:'Quay lại chỉnh sửa'}).click()
 await expect(page.getByRole('dialog',{name:'Hoàn ứng vượt dư lý thuyết'})).toHaveCount(0)
 await page.getByLabel('Tổng tiền (VND) *').fill('2500000')
 await queue([warning('first'),warning('changed'),{thanhCong:'Đã thêm giao dịch.'}])
 await page.getByRole('button',{name:'Lưu giao dịch',exact:true}).click()
 await expect(page.getByRole('button',{name:'Tiếp tục lưu',exact:true})).toBeEnabled()
 await expect(page.locator('[name="don_vi_id"]')).toHaveValue('fixture-unit')
 await expect(page.getByLabel('Hình thức giao dịch *')).toHaveValue('Hoàn tạm ứng')
 await expect(page.getByLabel('Loại chứng từ *')).toHaveValue('Hóa đơn Giá trị gia tăng')
 expect(await page.evaluate(()=>window.calls.at(-1).fingerprint_hoan_tam_ung)).toBeUndefined()
 const original = await page.evaluate(()=>window.calls.at(-1))
 await page.getByRole('button',{name:'Tiếp tục lưu',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>window.calls.at(-1)?.fingerprint_hoan_tam_ung)).toBe('first')
 expect(await page.evaluate(()=>window.calls.at(-1))).toEqual({...original,xac_nhan_hoan_tam_ung:'1',fingerprint_hoan_tam_ung:'first'})
 await expect(page.getByRole('button',{name:'Tiếp tục lưu',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'Tiếp tục lưu',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>window.calls.at(-1)?.fingerprint_hoan_tam_ung)).toBe('changed')
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.getByRole('button',{name:'+ Thêm giao dịch',exact:true}).click()
 await expect(page.getByLabel(DON_VI_LABEL)).toHaveCount(0)
 await expect(page.getByLabel('Nội dung *')).toHaveValue('Tạm ứng thêm')
 await expect(page.getByLabel('Hình thức giao dịch *')).toHaveValue('Tạm ứng thêm')
 console.log('PASS warning cancel/edit/retry invalidates token; confirmation preserves original fields; stale fingerprint re-confirmation; success resets')
 await openForm(); await queue([{throw:true}]); await page.getByRole('button',{name:'Lưu giao dịch',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('Kiểm tra nhật ký')
 await expect(page.getByRole('button',{name:'Lưu giao dịch',exact:true})).toBeEnabled()
 await expect(page.getByLabel('Nội dung *')).toHaveValue('Tạm ứng thêm')
 await queue([warning('offline'),{throw:true}]); await page.getByRole('button',{name:'Lưu giao dịch',exact:true}).click(); await page.getByRole('button',{name:'Tiếp tục lưu',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Hoàn ứng vượt dư lý thuyết'})).toHaveCount(0)
 await expect(page.getByRole('alert')).toContainText('Kiểm tra nhật ký')
 console.log('PASS normal/confirmation request failure recoverable with retained fields')
 await page.goto(origin+'/settings'); await page.getByRole('button',{name:'Đưa cột Ngày sang phải',exact:true}).click(); await queue([{throw:true},{ok:true,thongBao:'Saved fixture'}]); await page.getByRole('button',{name:'Lưu tùy chọn',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('thử lại'); await page.getByRole('button',{name:'Lưu tùy chọn',exact:true}).click(); await expect(page.getByRole('status')).toContainText('Saved fixture')
 await expect.poll(()=>page.evaluate(()=>window.preferenceCalls.at(-1).thuTu[0])).toBe('noiDung')
 console.log('PASS settings reorder serializes and failed save retries')
 await page.goto(origin+'/ledger'); await expect(page.getByText('Chưa có giao dịch nào.')).toBeVisible()
 // Cột Thao tác luôn hiện vì nút Lịch sử chỉ đọc, kể cả với vai trò chỉ xem.
 await expect(page.getByRole('columnheader',{name:'Thao tác'})).toHaveCount(1)
 const orderDefault = (await page.evaluate(()=>window.fixtureColumns)).map(c=>c.id)
 // Hai khung "Bố cục nhật ký" và "Sắp xếp" đã bỏ; bố cục tự lưu nên không còn nút lưu riêng.
 await expect(page.getByText('Bố cục nhật ký')).toHaveCount(0)
 await expect(page.getByText('Sắp xếp')).toHaveCount(0)
 const width=page.getByRole('slider',{name:'Chiều rộng cột Ngày',exact:true}); await width.press('End'); await expect(width).toHaveAttribute('aria-valuenow','600')
 await expect.poll(()=>page.evaluate(()=>window.preferenceCalls.length)).toBe(1)
 expect(await page.evaluate(()=>window.preferenceCalls[0])).toEqual({an:[],rong:{ngay:600},thuTu:orderDefault})
 // Lưu hỏng thì hiện thông báo kèm nút thử lại; lưu lại thành công thì nút biến mất.
 await queue([{throw:true}]); await width.press('Home'); await expect(width).toHaveAttribute('aria-valuenow','90')
 await expect(page.getByRole('status')).toContainText('thử lại')
 await queue([{ok:true,thongBao:'Saved fixture'}]); await page.getByRole('button',{name:'Thử lại lưu bố cục',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Saved fixture')
 await expect(page.getByRole('button',{name:'Thử lại lưu bố cục',exact:true})).toHaveCount(0)
 console.log('PASS ledger read-only controls, empty state, keyboard resize auto-save, failure retry and removed layout/sort panels')
 // Native HTML drag/drop: mouse input, not dispatchEvent or direct React handlers.
 await page.evaluate(()=>sessionStorage.removeItem('fixture-ledger-preferences'))
 await page.goto(origin+'/ledger?hidden')
 await page.setViewportSize({width:1800,height:900})
 const columns = await page.evaluate(()=>window.fixtureColumns)
 const hidden = ['chungTu','tongTien']
 let order = columns.map(c=>c.id)
 const header = id=>page.getByRole('columnheader').filter({has:page.getByRole('slider',{name:`Chiều rộng cột ${columns.find(c=>c.id===id).ten}`,exact:true})})
 const visibleOrder = ()=>page.getByRole('columnheader').evaluateAll(nodes=>nodes.map(node=>node.querySelector('[role="slider"]').getAttribute('aria-label')))
 const expectedVisible = ()=>order.filter(id=>!hidden.includes(id)).map(id=>`Chiều rộng cột ${columns.find(c=>c.id===id).ten}`)
 const ghiNhanKeo = ()=>page.evaluate(()=>{window.nativeDrags=[]; for(const type of ['dragstart','drop','dragend']) document.addEventListener(type,event=>window.nativeDrags.push({type,trusted:event.isTrusted}),true)})
 const pointerDrag = async(source,target,after,checkInsertion=true)=>{
  // Một lời gọi CDP có thể không bao giờ trả về (ví dụ khi Chromium kẹt trong
  // phiên kéo thả), nên mỗi bước đều có trần thời gian để lỗi hiện ra thay vì treo.
  const buoc = async(ten,chay)=>{
   const ket = await Promise.race([chay().then(()=>'xong'),new Promise(r=>setTimeout(()=>r('treo'),10000))])
   if(ket==='treo') throw Error(`Thao tác kéo thả bị treo ở bước: ${ten}`)
  }
  await buoc('cuộn tới cột nguồn',()=>source.scrollIntoViewIfNeeded())
  const from=await source.boundingBox(), to=await target.boundingBox()
  expect(from).not.toBeNull(); expect(to).not.toBeNull()
  await buoc('di chuyển tới cột nguồn',()=>page.mouse.move(from.x+24,from.y+from.height/2))
  await buoc('nhấn giữ',()=>page.mouse.down())
  await buoc('bắt đầu kéo',()=>page.mouse.move(from.x+32,from.y+from.height/2,{steps:5}))
  await buoc('kéo tới cột đích',()=>page.mouse.move(to.x+to.width*(after?0.75:0.25),to.y+to.height/2,{steps:15}))
  // Chromium requires another movement to deliver dragover after dragenter.
  await buoc('nhích thêm một điểm ảnh',()=>page.mouse.move(to.x+to.width*(after?0.75:0.25)+1,to.y+to.height/2))
  if(checkInsertion) {
   await expect(source).toHaveAttribute('aria-grabbed','true')
   await expect(target).toHaveClass(new RegExp(after?'insert-after':'insert-before'))
  }
  await buoc('thả chuột',()=>page.mouse.up())
 }
 const nativeDrags = []
 for(const [source,target,after] of [['ngay','trangThai',true],['ngay','noiDung',false]]) {
  const count=await page.evaluate(()=>window.preferenceCalls.length)
  await queue([{ok:true,thongBao:'Saved drag fixture'}])
  await ghiNhanKeo()
  await pointerDrag(header(source),header(target),after)
  nativeDrags.push(...await page.evaluate(()=>window.nativeDrags))
  order=order.filter(id=>id!==source); order.splice(order.indexOf(target)+(after?1:0),0,source)
  await expect.poll(()=>page.evaluate(()=>window.preferenceCalls.length)).toBe(count+1)
  expect(await page.evaluate(()=>window.preferenceCalls.at(-1))).toEqual({an:hidden,rong:{},thuTu:order})
  await expect.poll(visibleOrder).toEqual(expectedVisible())
  await expect(page.locator('.insert-before, .insert-after, .is-dragging')).toHaveCount(0)
  // Chromium chỉ báo lại một phiên kéo bị chặn cho mỗi trạng thái trang, nên lần kéo thứ hai
  // trong cùng trạng thái sẽ không bao giờ được phát về. Nạp lại trang giữa hai lần kéo, nhờ
  // đó cũng kiểm tra luôn bố cục đã lưu có được khôi phục đúng sau khi tải lại.
  await page.reload()
  await expect.poll(visibleOrder).toEqual(expectedVisible())
 }
 expect(nativeDrags.filter(e=>e.type==='dragstart')).toHaveLength(2)
 expect(nativeDrags.filter(e=>e.type==='drop')).toHaveLength(2)
 expect(nativeDrags.every(e=>e.trusted)).toBe(true)
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('fixture-ledger-preferences')))).toEqual({an:hidden,rong:{},thuTu:order})
 console.log('PASS trusted native pointer column drags right/left, after/before insertion, hidden/read-only columns retained, exact save payload and mocked persistence after remount')
 await page.evaluate(()=>{
  window.externalDrags=[]
  const source=document.createElement('div'); source.id='external-drag'; source.draggable=true; source.textContent='External fixture'; source.style.cssText='position:fixed;left:20px;top:350px;width:160px;height:40px;background:#ddd'
  source.addEventListener('dragstart',event=>{window.externalDrags.push(event.isTrusted); event.dataTransfer.setData('application/x-ledger-column','ngay'); event.dataTransfer.setData('text/plain','ngay')})
  document.body.append(source)
 })
 await pointerDrag(page.locator('#external-drag'),header('trangThai'),true,false)
 expect(await page.evaluate(()=>window.externalDrags)).toEqual([true])
 expect(await page.evaluate(()=>window.preferenceCalls)).toEqual([])
 expect(await visibleOrder()).toEqual(expectedVisible())
 await expect(page.locator('.insert-before, .insert-after, .is-dragging')).toHaveCount(0)
 console.log('PASS native external mouse drag with forged column MIME ignored')
 // Separate adversarial synthetic drop: unlike native input this forces delivery
 // even though the external dragover was not accepted as a drop target.
 const forgedTransfer=await page.evaluateHandle(()=>{const data=new DataTransfer(); data.setData('application/x-ledger-column','ngay'); data.setData('text/plain','ngay'); return data})
 await header('trangThai').dispatchEvent('dragover',{dataTransfer:forgedTransfer,clientX:500})
 await header('trangThai').dispatchEvent('drop',{dataTransfer:forgedTransfer,clientX:500})
 await forgedTransfer.dispose()
 expect(await page.evaluate(()=>window.preferenceCalls)).toEqual([])
 expect(await visibleOrder()).toEqual(expectedVisible())
 await expect(page.locator('.insert-before, .insert-after, .is-dragging')).toHaveCount(0)
 console.log('PASS synthetic external drop with forged column MIME ignored (separate from native pointer tests)')
 await page.evaluate(()=>{document.getElementById('external-drag').remove(); window.resizeDragStarts=0; document.addEventListener('dragstart',()=>window.resizeDragStarts++)})
 const resizer=page.getByRole('slider',{name:'Chiều rộng cột Ngày',exact:true})
 const initialWidth=Number(await resizer.getAttribute('aria-valuenow'))
 const resizeBox=await resizer.boundingBox()
 await page.mouse.move(resizeBox.x+resizeBox.width/2,resizeBox.y+resizeBox.height/2)
 await page.mouse.down(); await page.mouse.move(resizeBox.x+resizeBox.width/2+65,resizeBox.y+resizeBox.height/2,{steps:12}); await page.mouse.up()
 await expect(resizer).toHaveAttribute('aria-valuenow',String(initialWidth+65))
 expect(await visibleOrder()).toEqual(expectedVisible())
 expect(await page.evaluate(()=>window.resizeDragStarts)).toBe(0)
 // Bố cục tự lưu khi thả chuột, không cần bấm nút lưu riêng.
 await expect.poll(()=>page.evaluate(()=>window.preferenceCalls.length)).toBe(1)
 expect(await page.evaluate(()=>window.preferenceCalls[0])).toEqual({an:hidden,rong:{ngay:initialWidth+65},thuTu:order})
 console.log('PASS native pointer resize changes only width, emits no HTML drag, auto-saves and retains saved order')
 // Nhật ký có dữ liệu: sắp xếp nhiều cột, hàng tổng và hộp thoại sửa giao dịch.
 await page.evaluate(()=>sessionStorage.removeItem('fixture-ledger-preferences'))
 await page.goto(origin+'/ledger-edit')
 const tenCot = ()=>page.getByRole('columnheader').evaluateAll(nodes=>nodes.map(n=>n.querySelector('[role="slider"]').getAttribute('aria-label').replace('Chiều rộng cột ','')))
 const oTheoCot = async(ten,hang)=>{const i=(await tenCot()).indexOf(ten); return page.locator('tbody tr').nth(hang).locator('td').nth(i)}
 const hangTong = async(ten)=>{const i=(await tenCot()).indexOf(ten); return page.locator('tfoot td').nth(i)}
 const cotTheoTen = ten=>page.getByRole('columnheader').filter({has:page.getByRole('slider',{name:`Chiều rộng cột ${ten}`,exact:true})})
 await expect(page.locator('tbody tr')).toHaveCount(3)
 await expect(await oTheoCot('Đơn vị tiếp khách',0)).toHaveText('Đơn vị thử hai')
 await expect(await hangTong('Tổng tiền')).toContainText('4.400.000')
 await expect(await hangTong('Dư lý thuyết')).toHaveText('')
 await expect(page.locator('tfoot td').first()).toHaveText('Tổng 3 dòng')
 await expect(page.getByText('3/3 dòng')).toBeVisible()
 await page.getByRole('button',{name:'Tổng tiền',exact:true}).click()
 await expect(cotTheoTen('Tổng tiền')).toHaveAttribute('aria-sort','ascending')
 await expect(await oTheoCot('Tổng tiền',0)).toContainText('900.000')
 await expect(await oTheoCot('Đơn vị tiếp khách',0)).toHaveText('Đơn vị thử nghiệm')
 await expect(page.getByText('1. Tổng tiền ↑')).toBeVisible()
 await page.getByRole('button',{name:'Đơn vị tiếp khách',exact:true}).click({modifiers:['Shift']})
 await expect(page.getByText('2. Đơn vị tiếp khách ↑')).toBeVisible()
 await expect(cotTheoTen('Đơn vị tiếp khách')).toHaveAttribute('aria-sort','ascending')
 await expect(await oTheoCot('Tổng tiền',0)).toContainText('900.000')
 await expect(await oTheoCot('Tổng tiền',1)).toContainText('1.500.000')
 await expect(await hangTong('Tổng tiền')).toContainText('4.400.000')
 await page.getByRole('button',{name:'Bỏ sắp xếp Tổng tiền',exact:true}).click()
 await page.getByRole('button',{name:'Bỏ sắp xếp Đơn vị tiếp khách',exact:true}).click()
 await expect(page.getByText('1. Tổng tiền ↑')).toHaveCount(0)
 await expect(cotTheoTen('Tổng tiền')).toHaveAttribute('aria-sort','none')
 await expect(await oTheoCot('Đơn vị tiếp khách',0)).toHaveText('Đơn vị thử hai')
 console.log('PASS ledger single/multi-column sort, per-column direction, sort chips and totals row over displayed rows')
 // Mỗi tiêu đề cột có hộp lọc riêng để tick chọn giá trị hiển thị.
 await page.getByRole('button',{name:'Lọc cột Đơn vị tiếp khách',exact:true}).click()
 const hopDonVi=page.getByRole('dialog',{name:'Lọc cột Đơn vị tiếp khách'})
 await expect(hopDonVi).toBeVisible()
 await expect(hopDonVi.getByRole('checkbox')).toHaveCount(2)
 await hopDonVi.getByRole('checkbox',{name:/Đơn vị thử hai/}).check()
 await expect(page.locator('tbody tr')).toHaveCount(1)
 await expect(page.getByText('1/3 dòng')).toBeVisible()
 await expect(await hangTong('Tổng tiền')).toContainText('2.000.000')
 await expect(page.getByRole('button',{name:'Bỏ lọc Đơn vị Đơn vị thử hai',exact:true})).toBeVisible()
 // Trong cùng một nhóm thì tick thêm là lấy hợp.
 await hopDonVi.getByRole('checkbox',{name:/Đơn vị thử nghiệm/}).check()
 await expect(page.locator('tbody tr')).toHaveCount(3)
 await expect(await hangTong('Tổng tiền')).toContainText('4.400.000')
 await page.keyboard.press('Escape')
 await expect(hopDonVi).toHaveCount(0)
 // Cột ghép nhiều trường tách thành nhiều nhóm lọc riêng.
 await page.getByRole('button',{name:'Lọc cột Trạng thái',exact:true}).click()
 const hopTrangThai=page.getByRole('dialog',{name:'Lọc cột Trạng thái'})
 await expect(hopTrangThai.getByRole('group')).toHaveCount(2)
 await hopTrangThai.getByRole('checkbox',{name:/^Hợp lệ/}).check()
 await expect(page.locator('tbody tr')).toHaveCount(2)
 await expect(await hangTong('Tổng tiền')).toContainText('3.500.000')
 await page.getByRole('button',{name:'Bỏ tất cả lọc',exact:true}).click()
 await expect(page.locator('tbody tr')).toHaveCount(3)
 // Lọc chéo hai cột ra rỗng thì bảng báo rõ và cho bỏ lọc ngay tại chỗ.
 await page.getByRole('button',{name:'Lọc cột Ngày',exact:true}).click()
 await page.getByRole('dialog',{name:'Lọc cột Ngày'}).getByRole('checkbox',{name:/2026-01-01/}).check()
 await expect(page.locator('tbody tr')).toHaveCount(1)
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Lọc cột Đơn vị tiếp khách',exact:true}).click()
 await page.getByRole('dialog',{name:'Lọc cột Đơn vị tiếp khách'}).getByRole('checkbox',{name:/Đơn vị thử hai/}).check()
 await expect(page.getByText('Không có dòng nào khớp bộ lọc.')).toBeVisible()
 await expect(page.locator('tfoot')).toHaveCount(0)
 await page.locator('tbody').getByRole('button',{name:'Bỏ tất cả lọc',exact:true}).click()
 await expect(page.locator('tbody tr')).toHaveCount(3)
 await expect(page.getByText('3/3 dòng')).toBeVisible()
 console.log('PASS per-column header filters tick values, AND across columns, OR within a facet, live totals and empty state')
 // Sắp xếp lại theo Tổng tiền tăng dần để dòng đầu là giao dịch có số hóa đơn.
 await page.getByRole('button',{name:'Tổng tiền',exact:true}).click()
 await expect(await oTheoCot('Chứng từ',0)).toContainText('0000001')
 await page.getByRole('button',{name:'Sửa',exact:true}).first().click()
 const sua = page.getByRole('dialog',{name:'Sửa giao dịch'})
 await expect(sua).toBeVisible()
 const chonTruong = sua.getByLabel('Trường cần sửa')
 // Vai trò nhập liệu chỉ thấy nhóm ngày, chứng từ, đơn vị, giấy đề nghị và ghi chú.
 await expect(chonTruong.locator('option')).toHaveCount(8)
 await expect(chonTruong.locator('optgroup')).toHaveCount(5)
 await expect(chonTruong.locator('option[value="ngay"]')).toHaveCount(1)
 await expect(chonTruong.locator('option[value="tong_tien"]')).toHaveCount(0)
 await expect(sua.locator('[name="gia_tri"]')).toHaveCount(1)
 await expect(sua.getByText('Mỗi lần lưu chỉ đổi được')).toBeVisible()
 // Hình thức thanh toán chỉ hiện những lựa chọn mà hình thức giao dịch dùng được: giao dịch
 // này là hoàn tạm ứng nên chỉ có một giá trị, in bằng nhãn tiếng Việt chứ không phải mã.
 await chonTruong.selectOption('hinh_thuc_thanh_toan')
 const oThanhToan = sua.locator('select[name="gia_tri"]')
 await expect(oThanhToan.locator('option')).toHaveCount(2)
 await expect(oThanhToan.locator('option[value="hoan_tam_ung"]')).toHaveText('Hoàn tạm ứng')
 await expect(oThanhToan.locator('option[value="chuyen_khoan"]')).toHaveCount(0)
 await expect(oThanhToan.locator('option[value="tien_mat"]')).toHaveCount(0)
 await chonTruong.selectOption('ngay')
 // Hộp thoại mở sẵn ở trường đầu tiên mà vai trò này được sửa, nay là ngày phát sinh.
 await expect(chonTruong).toHaveValue('ngay')
 await expect(sua.locator('input[name="gia_tri"]')).toHaveValue('2026-01-01')
 await chonTruong.selectOption('don_vi_id')
 // Đổi trường thì cảnh báo của trường cũ phải biến mất theo.
 await expect(sua.getByText('chuyển giao dịch tới cuối ngày mới')).toHaveCount(0)
 await expect(sua.locator('select[name="gia_tri"]')).toHaveValue('fixture-unit')
 await expect(sua.getByText('Giá trị hiện tại:')).toBeVisible()
 await sua.locator('select[name="gia_tri"]').selectOption('fixture-unit-2')
 await queue([{thanhCong:'Đã cập nhật đơn vị tiếp khách.'}])
 await sua.getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
 await expect(sua).toHaveCount(0)
 expect(await page.evaluate(()=>window.editCalls.at(-1))).toEqual({id:'r2',truong:'don_vi_id',gia_tri:'fixture-unit-2'})
 await page.getByRole('button',{name:'Sửa',exact:true}).first().click()
 await sua.getByLabel('Trường cần sửa').selectOption('so_hd')
 await expect(sua.locator('input[name="gia_tri"]')).toHaveValue('0000001')
 await queue([{loi:'Chỉ quản trị viên được sửa "Tổng tiền".'}])
 await sua.getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
 await expect(sua.getByRole('alert')).toContainText('quản trị viên')
 await sua.getByRole('button',{name:'Hủy',exact:true}).click()
 await expect(sua).toHaveCount(0)
 await page.goto(origin+'/ledger-edit?admin')
 await page.getByRole('button',{name:'Sửa',exact:true}).first().click()
 const chonTruongAdmin = page.getByRole('dialog',{name:'Sửa giao dịch'}).getByLabel('Trường cần sửa')
 await expect(chonTruongAdmin.locator('option[value="tong_tien"]')).toHaveCount(1)
 await expect(chonTruongAdmin.locator('option')).toHaveCount(13)
 await expect(chonTruongAdmin.locator('optgroup')).toHaveCount(6)
 await chonTruongAdmin.selectOption('tong_tien')
 const oTien = page.getByRole('dialog',{name:'Sửa giao dịch'}).locator('input[type="text"][inputmode="numeric"]')
 await expect(oTien).toHaveValue('2.000.000')
 await expect(page.getByRole('dialog',{name:'Sửa giao dịch'}).locator('input[name="gia_tri"]')).toHaveValue('2000000')
 await expect(page.getByRole('dialog',{name:'Sửa giao dịch'}).getByText('sẽ được tính lại')).toBeVisible()
 await oTien.fill('3500000')
 await queue([{thanhCong:'Đã cập nhật tổng tiền.'}])
 await page.getByRole('dialog',{name:'Sửa giao dịch'}).getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Sửa giao dịch'})).toHaveCount(0)
 expect(await page.evaluate(()=>window.editCalls.at(-1))).toEqual({id:'r1',truong:'tong_tien',gia_tri:'3500000'})
 console.log('PASS role-scoped edit fields, one field per save, unit edit rewrites description server-side and admin-only money edit')
 // Sửa ngày phát sinh: ô nhập là ô ngày của trình duyệt và có cảnh báo tính lại số dư.
 await page.goto(origin+'/ledger-edit')
 await page.getByRole('button',{name:'Sửa',exact:true}).first().click()
 const suaNgay = page.getByRole('dialog',{name:'Sửa giao dịch'})
 await suaNgay.getByLabel('Trường cần sửa').selectOption('ngay')
 const oNgay = suaNgay.locator('input[name="gia_tri"]')
 await expect(oNgay).toHaveAttribute('type','date')
 await expect(oNgay).toHaveValue('2026-01-03')
 await expect(suaNgay.getByText('chuyển giao dịch tới cuối ngày mới')).toBeVisible()
 // Chọn ngày thì không còn là sửa tiền, nên cảnh báo tính lại của nhóm tiền phải biến mất.
 await expect(suaNgay.getByText('Số dư lý thuyết, dư thực tế và đang cầm của mọi dòng sau giao dịch này')).toHaveCount(0)
 await oNgay.fill('2026-02-20')
 await queue([{thanhCong:'Đã chuyển giao dịch sang ngày 2026-02-20 và tính lại số dư.'}])
 await suaNgay.getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
 await expect(suaNgay).toHaveCount(0)
 expect(await page.evaluate(()=>window.editCalls.at(-1))).toEqual({id:'r1',truong:'ngay',gia_tri:'2026-02-20'})
 console.log('PASS date edit uses a real date input, warns about re-sequencing and submits the plain ISO date')
 // Xem lịch sử sửa: chỉ đọc, tải khi mở, hiện cột cũ → mới và người thực hiện.
 const mucLichSu = [
  {id:2,hanhDong:'UPDATE',tomTat:'Sửa giao dịch',nguoi:'Nguyễn Văn A',luc:'2026-03-01T10:00:00.000Z',thayDoi:[
   {cot:'don_vi_id',nhan:'Đơn vị tiếp khách',cu:'Phòng Kế hoạch',moi:'Phòng Tổ chức'},
   {cot:'noi_dung',nhan:'Nội dung',cu:'Tiếp Phòng Kế hoạch',moi:'Tiếp Phòng Tổ chức'}]},
  {id:1,hanhDong:'INSERT',tomTat:'Tạo giao dịch',nguoi:'Nguyễn Văn A',luc:'2026-01-03T03:00:00.000Z',thayDoi:[
   {cot:'ngay',nhan:'Ngày phát sinh',cu:'—',moi:'2026-01-03'}]},
 ]
 const ls = page.getByRole('dialog',{name:'Lịch sử sửa'})
 await page.evaluate(muc=>{window.historyResponses=[{muc},{muc}]},mucLichSu)
 await page.getByRole('button',{name:'Lịch sử',exact:true}).first().click()
 await expect(ls).toBeVisible()
 await expect.poll(()=>page.evaluate(()=>window.historyCalls.at(-1))).toBe('r1')
 await expect(ls.getByText('Nguyễn Văn A').first()).toBeVisible()
 await expect(ls.getByText('Sửa giao dịch')).toBeVisible()
 await expect(ls.getByText('Tạo giao dịch')).toBeVisible()
 await expect(ls.getByText('Phòng Kế hoạch',{exact:true})).toBeVisible()
 await expect(ls.getByText('Phòng Tổ chức',{exact:true})).toBeVisible()
 await expect(ls.getByText('Tiếp Phòng Kế hoạch',{exact:true})).toBeVisible()
 await expect(ls.getByText('Tiếp Phòng Tổ chức',{exact:true})).toBeVisible()
 // Mục tạo giao dịch chỉ hiện giá trị mới, không có mũi tên so sánh.
 await expect(ls.getByText('Ngày phát sinh')).toBeVisible()
 await expect(ls.getByText('2026-01-03',{exact:true})).toBeVisible()
 // Tiêu đề hộp thoại nhắc lại dòng đang xem để không nhầm giao dịch.
 await expect(ls.getByText('2026-01-03 · Tiếp đơn vị thử hai')).toBeVisible()
 // Nút Sửa/Xóa không nằm trong hộp thoại lịch sử: đây là màn hình chỉ đọc.
 await expect(ls.getByRole('button',{name:'Sửa',exact:true})).toHaveCount(0)
 await expect(ls.getByRole('button',{name:'Xóa',exact:true})).toHaveCount(0)
 await ls.getByRole('button',{name:'Tải lại',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>window.historyCalls.length)).toBe(2)
 await expect(ls.getByText('Sửa giao dịch')).toBeVisible()
 await page.keyboard.press('Escape')
 await expect(ls).toHaveCount(0)
 // Giao dịch chưa có thay đổi nào và lỗi tải đều có thông báo riêng, không hiện bảng rỗng.
 await page.evaluate(()=>{window.historyResponses=[{muc:[]}]})
 await page.getByRole('button',{name:'Lịch sử',exact:true}).first().click()
 await expect(ls.getByText('chưa có thay đổi nào được ghi lại')).toBeVisible()
 await ls.getByRole('button',{name:'Đóng',exact:true}).click()
 await expect(ls).toHaveCount(0)
 await page.evaluate(()=>{window.historyResponses=[{throw:true}]})
 await page.getByRole('button',{name:'Lịch sử',exact:true}).first().click()
 await expect(ls.getByRole('alert')).toContainText('Không tải được lịch sử sửa')
 await ls.getByRole('button',{name:'Đóng',exact:true}).click()
 await page.evaluate(()=>{window.historyResponses=[{muc:[],loi:'Phiên không hợp lệ. Vui lòng đăng nhập lại.'}]})
 await page.getByRole('button',{name:'Lịch sử',exact:true}).first().click()
 await expect(ls.getByRole('alert')).toContainText('Phiên không hợp lệ')
 await ls.getByRole('button',{name:'Đóng',exact:true}).click()
 await expect(ls).toHaveCount(0)
 console.log('PASS read-only history dialog loads on open, diffs old→new, reloads, closes on Escape and reports empty/error states')
 // Vai trò chỉ xem: không có nút sửa hay xóa, nhưng lịch sử vẫn xem được.
 await page.goto(origin+'/ledger-readonly')
 await expect(page.locator('tbody tr')).toHaveCount(3)
 await expect(page.getByRole('button',{name:'Sửa',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Xóa',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Thanh toán',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Lịch sử',exact:true})).toHaveCount(3)
 await page.evaluate(()=>{window.historyResponses=[{muc:[]}]})
 await page.getByRole('button',{name:'Lịch sử',exact:true}).nth(1).click()
 await expect.poll(()=>page.evaluate(()=>window.historyCalls.at(-1))).toBe('r2')
 await expect(page.getByRole('dialog',{name:'Lịch sử sửa'})).toBeVisible()
 await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog',{name:'Lịch sử sửa'})).toHaveCount(0)
 console.log('PASS read-only role keeps the history column and cannot reach edit, delete or payment controls')
 // Nút mở giấy đề nghị: chỉ hiện ở những hình thức có lập giấy, và trỏ đúng giao dịch.
 // Vai trò chỉ xem cũng mở được vì giấy chỉ là bản in của dữ liệu đã đọc.
 await page.goto(origin+'/ledger-paper')
 await expect(page.locator('tbody tr')).toHaveCount(5)
 const nutGiay = page.getByRole('link',{name:'Giấy',exact:true})
 await expect(nutGiay).toHaveCount(3)
 expect(await nutGiay.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))).toEqual(['/giay/p1','/giay/p2','/giay/p3'])
 await expect(page.getByRole('button',{name:'Sửa',exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Lịch sử',exact:true})).toHaveCount(5)
 console.log('PASS ledger offers the paper link only for transaction types that produce a document, pointing at that row, even read-only')
 await page.goto(origin+'/payment'); await queue([{throw:true}]); await page.getByRole('button',{name:'Thanh toán',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Vui lòng thử lại')
 const qr = {duLieu:{payload:'TEST-LOCAL-QR',tenChuTk:'FIXTURE OWNER',bin:'970000',soTaiKhoan:'000000',soTien:200,soHd:'TEST1',ngay:'16/09/2026',noiDung:'TEST1 20260916'}}
 await queue([qr]); await page.getByRole('button',{name:'Tải lại QR theo dữ liệu mới nhất'}).click(); await expect(page.getByRole('img')).toHaveAttribute('src',/^data:image\/png;base64,/); await expect(page.getByText('FIXTURE OWNER')).toBeVisible(); await page.getByRole('button',{name:'Đóng',exact:true}).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
 await queue([{delay:300,result:{loi:'STALE QR ERROR'}},qr]); await page.getByRole('button',{name:'Thanh toán',exact:true}).click(); await page.getByRole('button',{name:'Đóng',exact:true}).click(); await page.getByRole('button',{name:'Thanh toán',exact:true}).click(); await page.clock.runFor(500); await expect(page.getByText('FIXTURE OWNER')).toBeVisible(); await expect(page.getByText('STALE QR ERROR')).toHaveCount(0); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
 console.log('PASS payment portal, local QR, error retry, close/reopen stale-response guard and Escape')
 expect(errors).toEqual([])
 console.log('PASS no browser page errors; isolated mocks, no application HTTP endpoints or database')
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)) }
