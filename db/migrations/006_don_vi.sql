-- Migration 006: Bảng đơn vị
-- Tạo bảng đơn vị để quản lý danh sách các đơn vị được tiếp
-- Thêm cột don_vi_id vào bảng giao_dich

create table if not exists don_vi (
  id uuid primary key default gen_random_uuid(),
  ten text not null unique,
  ghi_chu text,
  dang_hoat_dong boolean not null default true,
  tao_luc timestamptz not null default now(),
  nguoi_tao uuid references nguoi_dung(id),
  sua_luc timestamptz not null default now(),
  nguoi_sua uuid references nguoi_dung(id)
);

-- Thêm cột don_vi_id vào bảng giao_dich
alter table giao_dich
  add column if not exists don_vi_id uuid references don_vi(id);

-- Index để tăng tốc truy vấn
create index if not exists idx_don_vi_dang_hoat_dong on don_vi(dang_hoat_dong, ten);
create index if not exists idx_giao_dich_don_vi on giao_dich(don_vi_id) where not da_xoa;

-- Index để tìm đơn vị tiếp xa nhất và đơn vị chưa tiếp trong năm
create index if not exists idx_giao_dich_don_vi_ngay on giao_dich(don_vi_id, ngay desc) where not da_xoa;

comment on table don_vi is 'Danh sách các đơn vị được tiếp';
comment on column don_vi.ten is 'Tên đơn vị';
comment on column giao_dich.don_vi_id is 'Đơn vị được tiếp trong giao dịch này';
