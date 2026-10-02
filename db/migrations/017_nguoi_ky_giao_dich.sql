-- Chốt toàn bộ người ký theo giao dịch để giấy đã lập không đổi theo Cài đặt chung
-- về sau. Cờ riêng giúp phân biệt giao dịch cũ (chỉ có người đề nghị) với lựa chọn
-- mới, kể cả khi người dùng chủ động để trống một vai trò không bắt buộc.
alter table giao_dich add column if not exists lanh_dao_tiep_khach_id uuid references can_bo(id) on delete set null;
alter table giao_dich add column if not exists lanh_dao_thanh_toan_id uuid references can_bo(id) on delete set null;
alter table giao_dich add column if not exists truong_phong_id uuid references can_bo(id) on delete set null;
alter table giao_dich add column if not exists ke_toan_kiem_soat_id uuid references can_bo(id) on delete set null;
alter table giao_dich add column if not exists thong_tin_giay_da_chot boolean not null default false;

create index if not exists idx_giao_dich_lanh_dao_tiep_khach
  on giao_dich(lanh_dao_tiep_khach_id) where lanh_dao_tiep_khach_id is not null;
create index if not exists idx_giao_dich_lanh_dao_thanh_toan
  on giao_dich(lanh_dao_thanh_toan_id) where lanh_dao_thanh_toan_id is not null;
create index if not exists idx_giao_dich_truong_phong
  on giao_dich(truong_phong_id) where truong_phong_id is not null;
create index if not exists idx_giao_dich_ke_toan_kiem_soat
  on giao_dich(ke_toan_kiem_soat_id) where ke_toan_kiem_soat_id is not null;

comment on column giao_dich.lanh_dao_tiep_khach_id is
  'Lãnh đạo duyệt giấy tiếp khách đã chốt theo giao dịch.';
comment on column giao_dich.lanh_dao_thanh_toan_id is
  'Lãnh đạo duyệt giấy thanh toán đã chốt theo giao dịch.';
comment on column giao_dich.truong_phong_id is
  'Trưởng phòng ký giấy đã chốt theo giao dịch.';
comment on column giao_dich.ke_toan_kiem_soat_id is
  'Kế toán kiểm soát ký giấy đã chốt theo giao dịch.';
comment on column giao_dich.thong_tin_giay_da_chot is
  'Đã lưu đủ lựa chọn Thông tin giấy đề nghị; false là dữ liệu cũ dùng cấu hình chung cho các vai trò chưa lưu.';
