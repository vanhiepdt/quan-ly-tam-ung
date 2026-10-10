create table if not exists sao_luu_cau_hinh (
  id smallint primary key default 1 check (id = 1),
  bat_tu_dong boolean not null default true,
  gio_chay time without time zone not null default '17:00',
  sua_luc timestamptz not null default now()
);

insert into sao_luu_cau_hinh (id, bat_tu_dong, gio_chay)
values (1, true, '17:00')
on conflict (id) do nothing;

create table if not exists sao_luu_lan_chay (
  id uuid primary key default gen_random_uuid(),
  loai text not null check (loai in ('thu_cong', 'lich')),
  trang_thai text not null check (trang_thai in ('cho_xu_ly', 'dang_chay', 'thanh_cong', 'that_bai')),
  ngay_lich date,
  nguoi_yeu_cau uuid references nguoi_dung(id) on delete set null,
  tao_luc timestamptz not null default now(),
  bat_dau_luc timestamptz,
  ket_thuc_luc timestamptz,
  drive_file_id text,
  loi text,
  constraint sao_luu_ngay_lich_theo_loai check (
    (loai = 'lich' and ngay_lich is not null) or (loai = 'thu_cong' and ngay_lich is null)
  )
);

create unique index if not exists sao_luu_moi_ngay
  on sao_luu_lan_chay (ngay_lich) where loai = 'lich';
create index if not exists sao_luu_hang_cho
  on sao_luu_lan_chay (tao_luc) where trang_thai = 'cho_xu_ly';
create index if not exists sao_luu_dang_chay
  on sao_luu_lan_chay (tao_luc) where trang_thai = 'dang_chay';
