-- Tùy chọn hiển thị riêng cho từng tài khoản; không thay đổi dữ liệu tài chính.
create table if not exists tuy_chon_cot_nhat_ky (
  nguoi_dung_id uuid primary key references nguoi_dung(id) on delete cascade,
  tuy_chon jsonb not null default '{"an":[],"rong":{}}'::jsonb,
  sua_luc timestamptz not null default now(),
  constraint tuy_chon_cot_la_object check (
    jsonb_typeof(tuy_chon) = 'object'
    and tuy_chon ? 'an' and jsonb_typeof(tuy_chon->'an') = 'array'
    and tuy_chon ? 'rong' and jsonb_typeof(tuy_chon->'rong') = 'object'
    and octet_length(tuy_chon::text) <= 8192
  )
);
