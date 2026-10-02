-- Lưu người đề nghị theo đúng thông tin giấy đề nghị tại thời điểm tạo giao dịch.
-- Không dùng nguoi_tao làm nguồn chính vì người nhập liệu có thể lập giấy cho cán bộ khác.
alter table giao_dich add column if not exists nguoi_de_nghi_id uuid references can_bo(id) on delete set null;

create index if not exists idx_giao_dich_nguoi_de_nghi
  on giao_dich(nguoi_de_nghi_id)
  where nguoi_de_nghi_id is not null;

-- Dữ liệu cũ chưa có lựa chọn riêng: giữ tên đang hiển thị bằng cách liên kết cán bộ
-- của tài khoản đã tạo giao dịch khi có thể.
update giao_dich g
set nguoi_de_nghi_id = cb.id
from can_bo cb
where g.nguoi_de_nghi_id is null
  and cb.nguoi_dung_id = g.nguoi_tao;

comment on column giao_dich.nguoi_de_nghi_id is
  'Cán bộ được chọn trong Thông tin giấy đề nghị; null là dữ liệu cũ hoặc tài khoản chưa gắn cán bộ';
