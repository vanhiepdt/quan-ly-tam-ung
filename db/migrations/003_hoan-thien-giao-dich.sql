alter table giao_dich add column if not exists xoa_luc timestamptz;
alter table giao_dich add column if not exists nguoi_xoa uuid references nguoi_dung(id);

create index if not exists gd_thu_tu_day_du on giao_dich (ngay, so_thu_tu, tao_luc, id) where not da_xoa;
create index if not exists gd_nguoi_lay on giao_dich (nguoi_lay_hd_id) where not da_xoa;
create index if not exists gd_loc on giao_dich (trang_thai_hd, hinh_thuc, trang_thai_tt_phi) where not da_xoa;
create index if not exists tep_theo_gd on tep_dinh_kem (giao_dich_id, loai);
create unique index if not exists gd_khong_trung_hd on giao_dich (ky_hieu_hd, so_hd)
  where not da_xoa and ky_hieu_hd is not null and ky_hieu_hd <> '' and so_hd is not null and so_hd <> '';

drop trigger if exists ls_cau_hinh on cau_hinh;
create trigger ls_cau_hinh after insert or update or delete on cau_hinh for each row execute function ghi_lich_su();
