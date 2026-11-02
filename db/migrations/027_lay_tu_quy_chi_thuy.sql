-- Nguồn bù cho Tiền không được thanh toán của giao dịch Chi thực tế.
-- false (mặc định, giữ cách tính cũ): CQ trả thẳng trừ ở Dư tiền CQ trả thẳng,
-- Hoàn tạm ứng trừ vào Dư TƯ thực tế. true: lấy từ quỹ chị Thúy.
alter table giao_dich
  add column if not exists lay_tu_quy_chi_thuy boolean not null default false;

alter table giao_dich
  add constraint giao_dich_lay_tu_quy_chi_thuy_can_chi_thuc_te
  check (not lay_tu_quy_chi_thuy or chi_thuc_te);

comment on column giao_dich.lay_tu_quy_chi_thuy is
  'Chi thực tế: Tiền không được thanh toán lấy từ quỹ chị Thúy thay vì trừ ở Dư tiền CQ trả thẳng / Dư TƯ thực tế.';
