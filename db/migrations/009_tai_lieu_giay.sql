-- Tệp DOCX bất biến; PostgreSQL chỉ công bố phiên bản sau khi ghi tệp thành công.
create table if not exists tai_lieu (
  id uuid primary key default gen_random_uuid(),
  giao_dich_id uuid references giao_dich(id),
  loai text check (loai in ('tam_ung','tiep_khach','thanh_toan')),
  ten_mau text unique,
  phien_ban integer not null default 1 check (phien_ban > 0),
  tep uuid not null,
  khoa text,
  nguoi_tao uuid not null references nguoi_dung(id),
  sua_luc timestamptz not null default now(),
  check ((giao_dich_id is not null and loai is not null and ten_mau is null)
      or (giao_dich_id is null and loai is null and ten_mau is not null)),
  unique(giao_dich_id, loai)
);
create table if not exists tai_lieu_phien_ban (
  tai_lieu_id uuid not null references tai_lieu(id),
  phien_ban integer not null,
  tep uuid not null unique,
  sha256 text not null,
  nguoi_luu uuid not null references nguoi_dung(id),
  tao_luc timestamptz not null default now(),
  primary key(tai_lieu_id, phien_ban)
);
create table if not exists tai_lieu_phien (
  khoa text primary key,
  tai_lieu_id uuid not null references tai_lieu(id),
  tep_ban_dau uuid not null,
  da_dong boolean not null default false,
  tao_luc timestamptz not null default now()
);
comment on table tai_lieu is 'Giấy và mẫu Word; mẫu sửa trực tuyến thay thế logic, không ghi đè tệp gốc trong Mau';
comment on table tai_lieu_phien_ban is 'Lịch sử tệp bất biến, gồm bản gốc của mẫu trước khi sửa';
comment on table tai_lieu_phien is 'Khóa OnlyOffice giữ nguyên khi force-save, đổi sau callback đóng phiên';
