create table if not exists hoi_nghi (
  id uuid primary key default gen_random_uuid(),
  ten text not null,
  ngay date not null,
  ghi_chu text,
  loai_giao_dich text not null check (loai_giao_dich in ('Hoàn tạm ứng', 'Cơ quan trả thẳng')),
  nguon_phi text not null check (nguon_phi in ('quy_chi_thuy', 'so_du')),
  da_xoa boolean not null default false,
  tao_luc timestamptz not null default now(),
  nguoi_tao uuid references nguoi_dung(id),
  sua_luc timestamptz not null default now(),
  nguoi_sua uuid references nguoi_dung(id)
);

alter table giao_dich add column if not exists hoi_nghi_id uuid references hoi_nghi(id) on delete set null;
create index if not exists giao_dich_hoi_nghi on giao_dich(hoi_nghi_id) where hoi_nghi_id is not null and not da_xoa;

create table if not exists tep_hoi_nghi (
  id uuid primary key default gen_random_uuid(),
  hoi_nghi_id uuid not null references hoi_nghi(id) on delete cascade,
  giao_dich_id uuid references giao_dich(id) on delete set null,
  loai text not null check (loai in ('de_nghi_don_vi','to_trinh_to_chuc','du_toan','hoa_don','to_trinh_quyet_toan','bao_cao','khac')),
  ten_loai text,
  duong_dan text not null,
  ten_goc text not null,
  kich_thuoc bigint not null,
  mime text not null,
  nguoi_tai_len uuid references nguoi_dung(id),
  tao_luc timestamptz not null default now()
);
create index if not exists tep_hoi_nghi_theo_hoi_nghi on tep_hoi_nghi(hoi_nghi_id, tao_luc);
