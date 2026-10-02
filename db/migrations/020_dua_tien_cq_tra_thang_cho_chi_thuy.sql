-- Theo dõi riêng khoản CQ trả thẳng được đưa cho Chị Thúy. Không dùng lại
-- giao_tien_chi_thuy vì cột đó thuộc nguồn tạm ứng.
alter table giao_dich
  add column if not exists dua_tien_cq_tra_thang_cho_chi_thuy bigint not null default 0;

alter table giao_dich
  drop constraint if exists giao_dich_dua_tien_cq_tra_thang_cho_chi_thuy_khong_am;
alter table giao_dich
  add constraint giao_dich_dua_tien_cq_tra_thang_cho_chi_thuy_khong_am
  check (dua_tien_cq_tra_thang_cho_chi_thuy >= 0);

insert into danh_muc (loai, gia_tri, thu_tu)
values ('hinh_thuc', 'Đưa tiền CQ trả thẳng cho Chị Thúy', 7)
on conflict (loai, gia_tri) do nothing;

comment on column giao_dich.dua_tien_cq_tra_thang_cho_chi_thuy is
  'Khoản tiền CQ trả thẳng được đưa cho Chị Thúy; trừ khỏi số dư CQ trả thẳng, không ảnh hưởng số dư tạm ứng.';
