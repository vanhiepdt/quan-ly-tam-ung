-- Giao dịch cũ giữ nguyên cách tính phí theo Tổng tiền.
alter table giao_dich add column if not exists co_so_tinh_phi_lay_hd text not null default 'tong_tien';

alter table giao_dich add constraint giao_dich_co_so_tinh_phi_lay_hd_hop_le
  check (co_so_tinh_phi_lay_hd in ('tong_tien', 'tien_duoc_thanh_toan'));

alter table giao_dich add constraint giao_dich_co_so_tinh_phi_lay_hd_dung_hinh_thuc
  check (co_so_tinh_phi_lay_hd = 'tong_tien' or hinh_thuc in ('Hoàn tạm ứng', 'Cơ quan trả thẳng'));

comment on column giao_dich.co_so_tinh_phi_lay_hd is
  'Cơ sở tính phí hóa đơn theo tỷ lệ: tổng tiền hoặc tiền được hoàn/thanh toán; phí ghi đè vẫn được ưu tiên.';
