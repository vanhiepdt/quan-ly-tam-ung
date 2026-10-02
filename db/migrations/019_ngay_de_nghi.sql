-- Ngày in ở đầu Giấy đề nghị tiếp khách có thể khác ngày hóa đơn.
alter table giao_dich add column if not exists ngay_de_nghi date;

-- Dữ liệu cũ có hóa đơn thì dùng cùng ngày, trừ trường hợp cuối tuần đã có quy
-- ước mới: thứ bảy lùi một ngày, chủ nhật lùi hai ngày về thứ sáu.
update giao_dich
set ngay_de_nghi = case extract(isodow from ngay)::int
  when 6 then ngay - 1
  when 7 then ngay - 2
  else ngay
end
where ngay_de_nghi is null
  and hinh_thuc in ('Hoàn tạm ứng', 'Cơ quan trả thẳng');

comment on column giao_dich.ngay_de_nghi is
  'Ngày lập Giấy đề nghị tiếp khách; khác ngày hóa đơn khi người dùng sửa hoặc hóa đơn rơi vào cuối tuần.';
