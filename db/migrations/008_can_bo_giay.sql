-- Migration 008: Cán bộ, hình thức thanh toán và cấu hình giấy đề nghị
--
-- Bốn nhóm thay đổi phục vụ việc in giấy đề nghị:
--   1. Bảng can_bo giữ giới tính, chức danh, phòng của người ký trên giấy. Tài khoản
--      đăng nhập gắn với một cán bộ để biết phòng của người đề nghị.
--   2. Cột giao_dich.hinh_thuc_thanh_toan in dòng "Hình thức thanh toán": tiền mặt,
--      chuyển khoản, hoặc hoàn tạm ứng.
--   3. Bảng nguoi_lay_hd thêm tên ngân hàng và liên kết tới cán bộ, vì người lấy hóa
--      đơn cũng là người trong cơ quan và tài khoản của họ vừa nhận tiền thanh toán
--      vừa dùng để trả phí lấy hóa đơn.
--   4. Các khóa cấu hình cho những chữ in giống nhau ở mọi giấy (tên đơn vị, địa
--      danh, lý do tạm ứng, thời hạn thanh toán), người ký mặc định từng vai trò, và
--      người lấy hóa đơn mặc định để lấy tài khoản nhận tiền.

create table if not exists can_bo (
  id uuid primary key default gen_random_uuid(),
  ho_ten text not null,
  gioi_tinh text,
  chuc_danh text,
  phong text,
  -- Lãnh đạo vừa là người ký duyệt vừa không thuộc phòng nào; giấy in phần sau
  -- chức danh là tên đơn vị nên phòng phải rỗng.
  la_lanh_dao boolean not null default false,
  dang_hoat_dong boolean not null default true,
  -- Tài khoản đăng nhập gắn với cán bộ này; mỗi tài khoản gắn tối đa một cán bộ.
  nguoi_dung_id uuid references nguoi_dung(id),
  tao_luc timestamptz not null default now(),
  nguoi_tao uuid references nguoi_dung(id),
  sua_luc timestamptz not null default now(),
  nguoi_sua uuid references nguoi_dung(id),
  constraint can_bo_gioi_tinh_hop_le check (gioi_tinh is null or gioi_tinh in ('Ông', 'Bà')),
  constraint can_bo_lanh_dao_khong_phong check (not la_lanh_dao or phong is null)
);

create unique index if not exists idx_can_bo_nguoi_dung on can_bo(nguoi_dung_id) where nguoi_dung_id is not null;
create index if not exists idx_can_bo_dang_hoat_dong on can_bo(dang_hoat_dong, ho_ten);

drop trigger if exists ls_can_bo on can_bo;
create trigger ls_can_bo after insert or update or delete on can_bo for each row execute function ghi_lich_su();

alter table giao_dich add column if not exists hinh_thuc_thanh_toan text;

alter table giao_dich drop constraint if exists giao_dich_hinh_thuc_thanh_toan_hop_le;
alter table giao_dich add constraint giao_dich_hinh_thuc_thanh_toan_hop_le
  check (hinh_thuc_thanh_toan is null or hinh_thuc_thanh_toan in ('tien_mat', 'chuyen_khoan', 'hoan_tam_ung'));

-- Người lấy hóa đơn cũng là cán bộ trong cơ quan: tên ngân hàng in trên giấy, và liên
-- kết tới can_bo để biết phòng, chức danh của người đó.
alter table nguoi_lay_hd add column if not exists ten_ngan_hang text;
alter table nguoi_lay_hd add column if not exists can_bo_id uuid references can_bo(id);
create index if not exists idx_nguoi_lay_hd_can_bo on nguoi_lay_hd(can_bo_id) where can_bo_id is not null;

insert into cau_hinh (khoa, gia_tri, mo_ta) values
  ('giay_ten_don_vi', '"Trung tâm Đào tạo"', 'Tên đơn vị in ở đầu giấy đề nghị'),
  ('giay_dia_danh', '"Hà Nội"', 'Địa danh in ở dòng ngày tháng của giấy đề nghị'),
  ('giay_ly_do_tam_ung', '"Chi tiêu hành chính"', 'Lý do tạm ứng in trên giấy đề nghị tạm ứng'),
  ('giay_thoi_han_thanh_toan', '"Sau khi hoàn thành công việc"', 'Thời hạn thanh toán in trên giấy đề nghị tạm ứng'),
  ('giay_nguoi_ky_mac_dinh', '{}', 'Cán bộ mặc định cho từng vai trò ký trên giấy đề nghị'),
  ('giay_nguoi_lay_hd_mac_dinh', '""', 'Người lấy hóa đơn mặc định, lấy tài khoản nhận tiền khi giao dịch chưa gắn người nào')
on conflict (khoa) do nothing;

comment on table can_bo is 'Cán bộ dùng để in giấy đề nghị: giới tính, chức danh, phòng';
comment on column can_bo.la_lanh_dao is 'Lãnh đạo là người ký duyệt và không thuộc phòng nào';
comment on column can_bo.nguoi_dung_id is 'Tài khoản đăng nhập của cán bộ này, để suy ra phòng của người đề nghị';
comment on column giao_dich.hinh_thuc_thanh_toan is 'Tiền mặt, chuyển khoản hoặc hoàn tạm ứng, in ở dòng Hình thức thanh toán';
comment on column nguoi_lay_hd.ten_ngan_hang is 'Tên ngân hàng in kèm số tài khoản nhận tiền trên giấy thanh toán';
comment on column nguoi_lay_hd.can_bo_id is 'Cán bộ trong cơ quan ứng với người lấy hóa đơn này';
