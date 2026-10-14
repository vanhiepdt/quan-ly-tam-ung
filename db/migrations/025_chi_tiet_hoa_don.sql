alter table giao_dich
  add column if not exists chi_tiet_hoa_don jsonb;

comment on column giao_dich.chi_tiet_hoa_don is
  'Snapshot các dòng hóa đơn dùng để lập phụ lục; NULL với giao dịch cũ hoặc nhập không có chi tiết.';
