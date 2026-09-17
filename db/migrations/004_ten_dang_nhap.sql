-- Forward-only account identity and audit safety migration.
create or replace function ghi_lich_su() returns trigger language plpgsql security definer set search_path = public as $$
declare
  cu jsonb;
  moi jsonb;
  ban_ghi jsonb;
  dinh_danh uuid;
begin
  if tg_op <> 'INSERT' then cu := to_jsonb(old) - 'mat_khau_hash' - 'token_hash'; end if;
  if tg_op <> 'DELETE' then moi := to_jsonb(new) - 'mat_khau_hash' - 'token_hash'; end if;
  ban_ghi := coalesce(moi, cu);
  -- cau_hinh has a text primary key, not an id column. Keep its key in JSON
  -- and use a stable, namespaced UUID in the existing audit schema.
  if tg_table_name = 'cau_hinh' then
    dinh_danh := md5('cau_hinh:' || (ban_ghi ->> 'khoa'))::uuid;
  else
    dinh_danh := (ban_ghi ->> 'id')::uuid;
  end if;
  insert into lich_su (bang, ban_ghi_id, hanh_dong, nguoi_thuc_hien, gia_tri_cu, gia_tri_moi)
  values (tg_table_name, dinh_danh, tg_op, nullif(current_setting('app.user_id', true), '')::uuid, cu, moi);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Remove credential material captured by the old trigger as well.
update lich_su set gia_tri_cu = gia_tri_cu - 'mat_khau_hash' - 'token_hash',
  gia_tri_moi = gia_tri_moi - 'mat_khau_hash' - 'token_hash'
where gia_tri_cu ?| array['mat_khau_hash','token_hash'] or gia_tri_moi ?| array['mat_khau_hash','token_hash'];

alter table nguoi_dung add column ten_dang_nhap text;
-- Never infer usernames from non-unique email local parts. UUID-backed values
-- are valid, deterministic and collision-free even for conflicting legacy emails.
update nguoi_dung set ten_dang_nhap = 'user_' || replace(id::text, '-', '');
alter table nguoi_dung alter column ten_dang_nhap set not null;
alter table nguoi_dung add constraint nguoi_dung_ten_dang_nhap_unique unique (ten_dang_nhap);
alter table nguoi_dung add constraint nguoi_dung_ten_dang_nhap_hop_le
  check (ten_dang_nhap ~ '^[a-z0-9][a-z0-9._-]{2,49}$');
alter table nguoi_dung alter column email drop not null;
-- No forced-change screen exists. Admins issue usable passwords directly.
alter table nguoi_dung alter column doi_mat_khau set default false;
update nguoi_dung set doi_mat_khau = false where doi_mat_khau;
