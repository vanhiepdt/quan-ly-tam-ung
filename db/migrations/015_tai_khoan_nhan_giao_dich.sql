-- Snapshot tài khoản nhận tiền khi người dùng chọn "Dùng tài khoản khác" trên giấy.
-- Để trống toàn bộ các cột nghĩa là giấy dùng tài khoản mặc định đã lưu.
alter table giao_dich add column if not exists tai_khoan_nhan_so text;
alter table giao_dich add column if not exists tai_khoan_nhan_ngan_hang text;
alter table giao_dich add column if not exists tai_khoan_nhan_chi_nhanh text;
alter table giao_dich add column if not exists tai_khoan_nhan_ten_chu_tk text;

alter table giao_dich drop constraint if exists giao_dich_tai_khoan_nhan_so_hop_le;
alter table giao_dich add constraint giao_dich_tai_khoan_nhan_so_hop_le
  check (tai_khoan_nhan_so is null or tai_khoan_nhan_so ~ '^[0-9]{1,19}$');

comment on column giao_dich.tai_khoan_nhan_so is 'Số tài khoản ghi đè trên giấy; null là dùng tài khoản mặc định.';
comment on column giao_dich.tai_khoan_nhan_ngan_hang is 'Tên ngân hàng của tài khoản ghi đè trên giấy.';
comment on column giao_dich.tai_khoan_nhan_chi_nhanh is 'Chi nhánh của tài khoản ghi đè trên giấy.';
comment on column giao_dich.tai_khoan_nhan_ten_chu_tk is 'Tên chủ tài khoản ghi đè trên giấy.';
