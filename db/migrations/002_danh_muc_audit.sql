do $$ begin create type loai_danh_muc as enum ('trang_thai_hd','hinh_thuc','tt_phi','loai_hd'); exception when duplicate_object then null; end $$;

create table if not exists danh_muc (
  id uuid primary key default gen_random_uuid(), loai loai_danh_muc not null,
  gia_tri text not null, thu_tu int not null default 0, dang_hoat_dong boolean not null default true,
  unique (loai, gia_tri)
);
create table if not exists cau_hinh (
  khoa text primary key, gia_tri jsonb not null, mo_ta text, sua_luc timestamptz not null default now()
);

insert into danh_muc (loai, gia_tri, thu_tu) values
 ('trang_thai_hd','Hợp lệ',1), ('trang_thai_hd','Chờ HĐ',2), ('trang_thai_hd','Không hợp lệ',3),
 ('hinh_thuc','Tạm ứng từ cơ quan',1), ('hinh_thuc','Tạm ứng thêm',2), ('hinh_thuc','Giao tiền chị Thúy',3),
 ('hinh_thuc','Hoàn tạm ứng',4), ('hinh_thuc','Cơ quan trả thẳng',5), ('hinh_thuc','Nộp hoàn CQ',6),
 ('tt_phi','Đã thanh toán',1), ('tt_phi','Chưa thanh toán',2), ('tt_phi','Không phát sinh',3), ('tt_phi','Đã hoàn trả',4),
 ('loai_hd','Hóa đơn Giá trị gia tăng',1), ('loai_hd','Hóa đơn Bán hàng',2), ('loai_hd','Phiếu chi CQ',3), ('loai_hd','Giấy biên nhận',4), ('loai_hd','Giấy nộp tiền',5), ('loai_hd','Khác',6)
on conflict (loai, gia_tri) do nothing;
insert into cau_hinh (khoa, gia_tri, mo_ta) values
 ('ty_le_phi_chung','0.15','Tỷ lệ phí lấy hóa đơn chung'),
 ('noi_dung_ck_mau','"Phi lay HD {so_hd}"','Mẫu nội dung chuyển khoản QR'),
 ('gioi_han_tep_mb','10','Giới hạn dung lượng một file MB')
on conflict (khoa) do nothing;

create or replace function ghi_lich_su() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lich_su (bang, ban_ghi_id, hanh_dong, nguoi_thuc_hien, gia_tri_cu, gia_tri_moi)
  values (tg_table_name, coalesce(new.id, old.id), tg_op,
    nullif(current_setting('app.user_id', true), '')::uuid,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists ls_giao_dich on giao_dich;
create trigger ls_giao_dich after insert or update or delete on giao_dich for each row execute function ghi_lich_su();
drop trigger if exists ls_nguoi_lay_hd on nguoi_lay_hd;
create trigger ls_nguoi_lay_hd after insert or update or delete on nguoi_lay_hd for each row execute function ghi_lich_su();
drop trigger if exists ls_nguoi_dung on nguoi_dung;
create trigger ls_nguoi_dung after insert or update or delete on nguoi_dung for each row execute function ghi_lich_su();
