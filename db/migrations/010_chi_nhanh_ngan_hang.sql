alter table nguoi_lay_hd add column if not exists chi_nhanh text;
comment on column nguoi_lay_hd.chi_nhanh is 'Chi nhánh mở tài khoản, in trên giấy chuyển khoản';
