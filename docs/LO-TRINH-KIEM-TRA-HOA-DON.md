# Đọc và đối chiếu hóa đơn

Nút **Đọc từ hóa đơn** trên form giao dịch nhận đúng hai loại tệp: PDF và XML. Hệ thống tự nhận diện loại tệp từ nội dung ở phía máy chủ, sau đó dùng hai cấu hình AI độc lập để đọc và đối chiếu. XML còn được parse trực tiếp trên máy để có một nguồn kiểm tra xác định. Kết quả chỉ là đề xuất; người dùng phải soát lại và bấm lưu.

QR của hóa đơn và OCR không còn là một phần của luồng này. QR/VietQR trong phần thanh toán là chức năng riêng, không dùng để đọc hóa đơn.

## Luồng hiện tại

1. Người dùng chọn hóa đơn PDF hoặc XML trong form **Thêm giao dịch**.
2. Server kiểm tra kích thước, magic bytes PDF hoặc cấu trúc XML; không tin phần mở rộng hay MIME do trình duyệt gửi.
3. Với PDF, server dựng trang đầu thành PNG rồi gửi ảnh cho AI 1 và AI 2. Chỉ nhà cung cấp/model có khả năng đọc ảnh mới được dùng cho PDF.
4. Với XML, server giữ nguyên văn bản để gửi cho cả hai AI và đồng thời trích dữ liệu cục bộ: người bán, người mua, số/ký hiệu, ngày, tổng tiền, thuế và dòng hàng.
5. Bộ hợp nhất so sánh AI 1, AI 2 và XML nếu có. Trường khớp được ưu tiên; trường lệch sinh cảnh báo để người dùng soát bản gốc.
6. Kết quả được điền vào form, không ghi thẳng vào database. File gốc được giữ cùng giao dịch chỉ sau khi giao dịch lưu thành công.

## Hai cấu hình AI

Vào **Cài đặt → Cài đặt AI** để chọn nhà cung cấp, model, URL API ngoài và khóa riêng cho AI 1 và AI 2. Hai lời gọi được thực hiện độc lập, không truyền kết quả của AI này cho AI kia. Nếu một AI lỗi, nguồn còn lại hoặc XML vẫn được dùng và giao diện hiện cảnh báo. Nếu cả hai AI chưa sẵn sàng, XML vẫn có thể đọc được; PDF cần ít nhất một model đọc ảnh.

Prompt yêu cầu mỗi AI trả JSON có các trường hóa đơn, bảng `dongHang`, loại hóa đơn và cột tiền hàng. Mỗi dòng hàng phải có cờ `laRuouBia`.

## Tính tiền bia/rượu

`tienRuouBia` là **tổng tiền sau thuế của tất cả dòng bia/rượu có trên hóa đơn**, không phải số tiền người dùng tự ước lượng và không phải tổng riêng mà AI trả về khi bảng dòng đã có.

- Hóa đơn bán hàng: lấy thành tiền của dòng bia/rượu.
- Hóa đơn GTGT, cột thành tiền đã gồm thuế: lấy thành tiền.
- Hóa đơn GTGT, cột thành tiền chưa gồm thuế: lấy thành tiền cộng tiền thuế; nếu không có tiền thuế thì dùng thuế suất để tính.
- Có bảng dòng hàng nhưng không có dòng bia/rượu: kết quả là `0`.
- Khi có bảng dòng hàng, hệ thống tính lại tổng từ từng dòng và cảnh báo nếu tổng riêng của AI khác kết quả tính lại.

XML được ưu tiên làm nguồn dòng hàng khi parse thành công. Nếu XML không có dòng hàng, hệ thống chọn bảng dòng từ AI 1 rồi AI 2 và vẫn cảnh báo khi hai nguồn đọc khác nhau.

## Định dạng XML và an toàn

Bộ đọc nhận các namespace phổ biến bằng cách dò tên thẻ cục bộ, không phụ thuộc prefix cụ thể. Các số tiền được chuẩn hóa về số nguyên đồng; ngày được chuẩn hóa về `yyyy-mm-dd`.

XML có `DOCTYPE` hoặc `ENTITY` bị từ chối. Bộ đọc không tải external entity, không gọi URL trong tệp và chỉ dùng nội dung XML như dữ liệu. Đây là yêu cầu bắt buộc để tránh XXE khi người dùng tải tệp lên.

## Tệp đính kèm

Trong **Hồ sơ tệp**, loại **Hóa đơn** nhận PDF và XML; các loại giấy đã ký vẫn chỉ nhận PDF, còn chứng từ chuyển khoản vẫn nhận ảnh/PDF theo nghiệp vụ hiện có. Server kiểm tra nội dung thật, giới hạn 10 MB, lưu bằng tên UUID ngoài web root và chỉ cho xem qua route đã kiểm tra quyền.

## Cảnh báo và trạng thái

Kết quả có các trạng thái:

- `hop_le`: các nguồn đọc được và không có cảnh báo.
- `co_canh_bao`: có nguồn thiếu hoặc các nguồn đọc lệch, nhưng vẫn có đề xuất để người dùng soát.
- `khong_hop_le`: dữ liệu mâu thuẫn nghiêm trọng, chẳng hạn tiền bia/rượu lớn hơn tổng tiền.
- `loi_ky_thuat`: không đọc được tệp hoặc không có nguồn nào trả dữ liệu.

Các cảnh báo không tự động ghi giao dịch. Người dùng cần kiểm tra file gốc, sửa form nếu cần, rồi mới lưu.

## Kiểm thử

Các kiểm thử hồi quy quan trọng nằm ở:

- `lib/kiem-tra/xml-hoa-don.test.ts`: namespace, hóa đơn GTGT trước thuế, dòng bia sau thuế và XML không có bia/rượu.
- `lib/kiem-tra/ai-hoa-don.test.ts`: JSON AI và quy tắc tính lại tiền bia/rượu.
- `lib/kiem-tra/hop-nhat.test.ts`: đối chiếu hai AI với XML.
- `lib/tep/kiem-tra.test.ts` và `lib/tep/luu.test.ts`: tự nhận PDF/XML và lưu XML.

Chạy:

```bash
npm run typecheck
npm test
npm run build
```
