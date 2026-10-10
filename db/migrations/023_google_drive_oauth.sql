-- Quyền OAuth của chính chủ Drive cá nhân. Token mã hóa bằng khóa chỉ có trên VPS.
create table if not exists sao_luu_drive_ket_noi (
  id smallint primary key default 1 check (id = 1),
  email text not null,
  refresh_token_ma_hoa text not null,
  folder_id text not null,
  ket_noi_luc timestamptz not null default now(),
  cap_nhat_luc timestamptz not null default now()
);
