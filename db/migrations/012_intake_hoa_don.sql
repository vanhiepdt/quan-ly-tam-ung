-- Intake hoa don tu Telegram va agent scan Windows.
-- Day la hang doi nhap lieu, khong phai nguon du lieu tai chinh. Chi khi
-- intake duoc duyet/tu luu thanh cong moi tao giao_dich va tep_dinh_kem.
create table if not exists intake_hoa_don (
  id uuid primary key default gen_random_uuid(),
  nguon text not null check (nguon in ('telegram', 'scan')),
  trang_thai text not null default 'cho_phan_hoi'
    check (trang_thai in ('cho_phan_hoi', 'dang_xu_ly', 'da_luu', 'huy', 'tu_luu_het_han', 'loi')),
  chat_telegram_id text,
  user_telegram_id text,
  message_id text,
  idempotency_key text not null,
  nguoi_dung_id uuid references nguoi_dung(id),
  tep_tam_duong_dan text,
  tep_tam_ten_goc text,
  tep_tam_kich_thuoc bigint,
  tep_tam_mime text,
  de_xuat jsonb not null default '{}'::jsonb,
  mac_dinh_snapshot jsonb not null default '{}'::jsonb,
  het_han timestamptz not null,
  giao_dich_id uuid references giao_dich(id),
  loi text,
  tao_luc timestamptz not null default now(),
  sua_luc timestamptz not null default now(),
  unique (nguon, idempotency_key)
);

create index if not exists intake_hoa_don_het_han
  on intake_hoa_don (trang_thai, het_han)
  where trang_thai = 'cho_phan_hoi';
create index if not exists intake_hoa_don_chat
  on intake_hoa_don (chat_telegram_id, tao_luc desc);
create index if not exists intake_hoa_don_giao_dich
  on intake_hoa_don (giao_dich_id)
  where giao_dich_id is not null;

comment on table intake_hoa_don is 'Hang doi hoa don tu Telegram/agent truoc khi tao giao_dich';
comment on column intake_hoa_don.de_xuat is 'De xuat hoa don va thay doi trong cuoc hoi thoai, khong phai du lieu giao_dich';
comment on column intake_hoa_don.mac_dinh_snapshot is 'Anh chup cau hinh mac dinh tai luc nhan tep';
comment on column intake_hoa_don.idempotency_key is 'Ma Telegram message hoac ma file agent de retry khong tao trung';
