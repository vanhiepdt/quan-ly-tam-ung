-- Phụ lục có tệp, phiên OnlyOffice và lịch sử lưu riêng, không ghi đè giấy thanh toán.
alter table tai_lieu drop constraint if exists tai_lieu_loai_check;
alter table tai_lieu add constraint tai_lieu_loai_check
  check (loai in ('tam_ung', 'tiep_khach', 'thanh_toan', 'phu_luc'));
