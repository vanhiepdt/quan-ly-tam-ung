create extension if not exists pgcrypto;

do $$ begin create type vai_tro as enum ('admin','nhap_lieu','chi_doc'); exception when duplicate_object then null; end $$;
do $$ begin create type loai_tep as enum ('hoa_don','chuyen_khoan'); exception when duplicate_object then null; end $$;

create table if not exists nguoi_dung (
 id uuid primary key default gen_random_uuid(), mat_khau_hash text not null,
 ho_ten text not null, email text not null unique, vai_tro vai_tro not null default 'chi_doc',
 dang_hoat_dong boolean not null default true, doi_mat_khau boolean not null default true,
 tao_luc timestamptz not null default now()
);
create table if not exists phien (
 id uuid primary key default gen_random_uuid(), nguoi_dung_id uuid not null references nguoi_dung(id) on delete cascade,
 token_hash text not null unique, het_luc timestamptz not null, tao_luc timestamptz not null default now()
);
create table if not exists nguoi_lay_hd (
 id uuid primary key default gen_random_uuid(), ten text not null, ty_le_phi numeric(5,4),
 ngan_hang_bin text, so_tai_khoan text, ten_chu_tk text, ghi_chu text,
 dang_hoat_dong boolean not null default true, tao_luc timestamptz not null default now()
);
create table if not exists giao_dich (
 id uuid primary key default gen_random_uuid(), ngay date not null, so_thu_tu int not null default 0,
 noi_dung text not null, ky_hieu_hd text, so_hd text, loai_hd text,
 trang_thai_hd text not null, hinh_thuc text not null,
 tong_tien bigint not null default 0, tien_ruou_bia bigint not null default 0,
 tam_ung_tu_cq bigint not null default 0, giao_tien_chi_thuy bigint not null default 0,
 hoan_ung_tien_mat bigint not null default 0, nguoi_lay_hd_id uuid references nguoi_lay_hd(id) on delete set null,
 phi_lay_hd_ghi_de bigint, trang_thai_tt_phi text not null default 'Không phát sinh', ghi_chu text,
 trang_thai_kiem_tra text not null default 'chua_kiem_tra', ket_qua_kiem_tra jsonb,
 da_xoa boolean not null default false, tao_luc timestamptz not null default now(),
 nguoi_tao uuid references nguoi_dung(id), sua_luc timestamptz not null default now(), nguoi_sua uuid references nguoi_dung(id),
 constraint tien_khong_am check (tong_tien >= 0 and tien_ruou_bia >= 0 and tam_ung_tu_cq >= 0 and giao_tien_chi_thuy >= 0 and hoan_ung_tien_mat >= 0 and (phi_lay_hd_ghi_de is null or phi_lay_hd_ghi_de >= 0)),
 constraint ruou_bia_khong_vuot_tong check (tien_ruou_bia <= tong_tien)
);
create table if not exists tep_dinh_kem (
 id uuid primary key default gen_random_uuid(), giao_dich_id uuid not null references giao_dich(id) on delete cascade,
 loai loai_tep not null, duong_dan text not null, ten_goc text not null, kich_thuoc bigint not null, mime text not null,
 nguoi_tai_len uuid references nguoi_dung(id), tao_luc timestamptz not null default now()
);
create table if not exists lich_su (
 id bigserial primary key, bang text not null, ban_ghi_id uuid not null, hanh_dong text not null,
 nguoi_thuc_hien uuid, gia_tri_cu jsonb, gia_tri_moi jsonb, tao_luc timestamptz not null default now()
);
create index if not exists gd_thu_tu on giao_dich(ngay, so_thu_tu, tao_luc) where not da_xoa;
