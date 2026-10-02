-- Giá trị nguồn cho cột Hoàn ứng/CQ trả thẳng và số tiền trên hai giấy đề
-- nghị. Dữ liệu lịch sử được giữ nguyên theo cách làm tròn cũ để số đã in
-- trước đây không tự thay đổi sau khi nâng cấp.
alter table giao_dich add column if not exists tien_duoc_thanh_toan bigint;
alter table giao_dich add column if not exists lam_tron_xuong_hang_nghin boolean;

update giao_dich
set tien_duoc_thanh_toan = greatest(0::bigint, tong_tien - tien_ruou_bia) / 1000 * 1000,
    lam_tron_xuong_hang_nghin = true
where hinh_thuc in ('Hoàn tạm ứng', 'Cơ quan trả thẳng')
  and tien_duoc_thanh_toan is null;

update giao_dich
set lam_tron_xuong_hang_nghin = false
where lam_tron_xuong_hang_nghin is null;

alter table giao_dich alter column lam_tron_xuong_hang_nghin set default false;
alter table giao_dich alter column lam_tron_xuong_hang_nghin set not null;

alter table giao_dich drop constraint if exists giao_dich_tien_duoc_thanh_toan_khong_am;
alter table giao_dich add constraint giao_dich_tien_duoc_thanh_toan_khong_am
  check (tien_duoc_thanh_toan is null or tien_duoc_thanh_toan >= 0);

comment on column giao_dich.tien_duoc_thanh_toan is
  'Tiền được hoàn/thanh toán; dùng cho cột tính toán và số tiền in trên giấy.';
comment on column giao_dich.lam_tron_xuong_hang_nghin is
  'Có làm tròn xuống hàng nghìn trước khi tính cột và in giấy.';
