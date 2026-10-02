-- Giữ riêng số tiền trước khi làm tròn để có thể bỏ tích và khôi phục đúng số lẻ.
alter table giao_dich add column if not exists tien_duoc_thanh_toan_goc bigint;

-- Với dữ liệu đã tồn tại, phần lẻ đã bị loại ở các phiên bản trước nên chỉ có thể
-- dùng lại giá trị đang lưu. Từ giao dịch mới trở đi cột này là nguồn không làm tròn.
update giao_dich
set tien_duoc_thanh_toan_goc = tien_duoc_thanh_toan
where tien_duoc_thanh_toan_goc is null
  and tien_duoc_thanh_toan is not null;

alter table giao_dich drop constraint if exists giao_dich_tien_duoc_thanh_toan_goc_khong_am;
alter table giao_dich add constraint giao_dich_tien_duoc_thanh_toan_goc_khong_am
  check (tien_duoc_thanh_toan_goc is null or tien_duoc_thanh_toan_goc >= 0);

comment on column giao_dich.tien_duoc_thanh_toan_goc is
  'Số tiền nguồn trước khi làm tròn xuống hàng nghìn; dùng để khôi phục khi bỏ tích làm tròn.';
