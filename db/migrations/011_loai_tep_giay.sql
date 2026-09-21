-- Thêm loại tệp cho tờ trình đã ký và giấy đề nghị thanh toán đã ký (PDF).
-- ADD VALUE trong PostgreSQL 16 chạy được trong transaction của máy chạy migration;
-- không dùng giá trị mới trong cùng file này.
alter type loai_tep add value if not exists 'to_trinh_da_ky';
alter type loai_tep add value if not exists 'giay_de_nghi_da_ky';
comment on type loai_tep is 'hoa_don, chuyen_khoan, to_trinh_da_ky, giay_de_nghi_da_ky';
