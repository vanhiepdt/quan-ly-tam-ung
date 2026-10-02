-- Cho phép mỗi giao dịch có hóa đơn chọn rõ có tính phí lấy hóa đơn hay không.
-- Dữ liệu cũ được suy ra để không làm thay đổi số dư đang có:
--   * Hoàn tạm ứng: vẫn tính phí như trước.
--   * Cơ quan trả thẳng: chỉ bật nếu đã có phí ghi đè hoặc trạng thái thanh toán phí.
--   * Các hình thức nội bộ: không phát sinh phí.
alter table giao_dich add column if not exists co_tinh_phi_lay_hd boolean;

update giao_dich
set co_tinh_phi_lay_hd = case
  when hinh_thuc = 'Hoàn tạm ứng' then true
  when phi_lay_hd_ghi_de is not null or trang_thai_tt_phi <> 'Không phát sinh' then true
  else false
end
where co_tinh_phi_lay_hd is null;

alter table giao_dich alter column co_tinh_phi_lay_hd set default false;
alter table giao_dich alter column co_tinh_phi_lay_hd set not null;

comment on column giao_dich.co_tinh_phi_lay_hd is
  'Có tính phí lấy hóa đơn theo tỷ lệ hoặc phí ghi đè; false là không phát sinh phí.';
