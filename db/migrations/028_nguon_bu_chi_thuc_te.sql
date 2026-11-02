-- Nguồn bù Tiền không được thanh toán của giao dịch Chi thực tế, thay cờ đúng/sai ở 027.
-- so_du (mặc định, cách tính cũ): CQ trả thẳng trừ ở Dư tiền CQ trả thẳng, Hoàn tạm ứng
-- trừ vào Dư TƯ thực tế. quy_chi_thuy: ghi vào cột Lấy quỹ chị Thúy. tu_chiu: không trừ vào đâu.
alter table giao_dich
  add column if not exists nguon_bu_chi_thuc_te text not null default 'so_du';

update giao_dich set nguon_bu_chi_thuc_te = 'quy_chi_thuy' where lay_tu_quy_chi_thuy;

alter table giao_dich
  add constraint giao_dich_nguon_bu_chi_thuc_te_hop_le
  check (nguon_bu_chi_thuc_te in ('so_du', 'quy_chi_thuy', 'tu_chiu'));

alter table giao_dich
  add constraint giao_dich_nguon_bu_can_chi_thuc_te
  check (nguon_bu_chi_thuc_te = 'so_du' or chi_thuc_te);

alter table giao_dich drop column if exists lay_tu_quy_chi_thuy;

comment on column giao_dich.nguon_bu_chi_thuc_te is
  'Chi thực tế: nguồn bù Tiền không được thanh toán — so_du (trừ ở số dư), quy_chi_thuy (lấy quỹ chị Thúy), tu_chiu (không trừ vào đâu).';
