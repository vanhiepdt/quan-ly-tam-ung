-- Giao dịch cũ giữ nguyên cách tính vì mặc định không chọn Chi thực tế.
alter table giao_dich
  add column if not exists chi_thuc_te boolean not null default false;

alter table giao_dich
  add constraint giao_dich_chi_thuc_te_dung_hinh_thuc
  check (not chi_thuc_te or hinh_thuc in ('Hoàn tạm ứng', 'Cơ quan trả thẳng'));

comment on column giao_dich.chi_thuc_te is
  'Chi thực tế: hoàn tạm ứng cộng tiền không được thanh toán vào dư TƯ thực tế; CQ trả thẳng trừ khoản này khỏi dư tiền CQ trả thẳng.';
