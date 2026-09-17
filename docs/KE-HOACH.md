# Kế hoạch xây dựng web quản lý tạm ứng & hóa đơn tiếp khách

Tài liệu gốc của dự án. Đọc file này trước, rồi tới:

- [THIET-KE-DU-LIEU.md](THIET-KE-DU-LIEU.md) — bảng dữ liệu, RLS, và bộ tính số dư
- [BAO-MAT-VA-PHAN-QUYEN.md](BAO-MAT-VA-PHAN-QUYEN.md) — đăng nhập, 3 vai trò, lưu file
- [LO-TRINH-KIEM-TRA-HOA-DON.md](LO-TRINH-KIEM-TRA-HOA-DON.md) — chỗ cắm cho phần kiểm tra hóa đơn sau này

---

## 1. Vấn đề đang giải quyết

Bản Google Sheets hiện tại đặt công thức ngay trong bảng. Ô `S9` phải biết `S8` nằm ở đâu, nên chèn hoặc xóa một dòng là chuỗi số dư đứt, sinh `#REF!` và số sai. Đã thử vá bằng Apps Script hai lần, vẫn lỗi. Nguyên nhân không nằm ở công thức viết sai mà ở chỗ **số liệu và cách tính bị trộn vào nhau**.

Web app đảo lại nguyên tắc đó:

> Cơ sở dữ liệu chỉ lưu **số thô người dùng gõ vào**. Toàn bộ giá trị suy ra (hoàn tạm ứng, cơ quan trả thẳng, phí lấy HĐ, 3 cột số dư lũy kế, 20 chỉ số) được tính lại từ đầu mỗi lần đọc, bằng một hàm thuần duy nhất.

Hệ quả: không có ô nào trỏ tới ô nào, nên `#REF!` và lệch dòng là chuyện không thể xảy ra về mặt cấu trúc, không phải nhờ cẩn thận.

## 2. Quyết định đã chốt

| Việc | Chọn | Lý do |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server Component đọc dữ liệu, Server Action ghi dữ liệu, kiểm quyền chạy ở server |
| Giao diện | Tailwind CSS + shadcn/ui | Component có sẵn, sửa được tận gốc, không bị khóa vào theme của ai |
| Database | PostgreSQL 16 tự cài trên VPS | Bạn đã chốt: SQL chạy ngay trên server, không qua nhà cung cấp nào |
| Truy cập database | Driver `pg` + SQL viết tay; migration là file `.sql` đánh số | Ít tầng trung gian, SQL trong tài liệu này chạy được nguyên văn |
| Đăng nhập | Tự làm: mật khẩu băm Argon2id, session lưu trong bảng `phien` | Session nằm trong database nên thu hồi được tức thì |
| Lưu file | Ổ đĩa VPS, ngoài web root, phục vụ qua route đã kiểm quyền | File không bao giờ chạm được bằng đường dẫn trực tiếp |
| Hosting | Chính VPS đó: Node 22 chạy dưới systemd, Caddy đứng trước | Caddy tự xin và tự gia hạn chứng chỉ HTTPS |
| Sao lưu | `pg_dump` + `rsync` ra máy khác mỗi đêm | Bạn đã chốt: tự động hằng ngày ra chỗ khác |
| Kiểu tiền | `BIGINT`, đơn vị đồng | Số nguyên, không bao giờ sai số thập phân như `FLOAT` |
| Dữ liệu ban đầu | Bảng trắng | Bạn đã chốt: không cần công cụ nhập lại từ sheet cũ |
| Vai trò | admin / nhập liệu / chỉ đọc | Chỉ đọc **có** thấy số tiền |
| Tạo tài khoản | Admin tạo sẵn rồi gửi cho từng người | Tắt hẳn tự đăng ký |
| Lưu vết | Có, bằng trigger Postgres | Ghi ở tầng database nên code app không thể bỏ qua |
| Xóa giao dịch | Xóa mềm (`da_xoa`) | Có tiền thì phải xóa được mà vẫn tra lại được |
| Phí lấy HĐ | Tỷ lệ chung, ghi đè theo từng người, vẫn sửa tay được từng dòng | Thêm người lấy phí khác mức thì chỉ cần vào trang admin, không phải sửa code |
| QR chuyển tiền | Số tài khoản lưu sẵn theo từng người lấy HĐ | Bấm là ra QR đúng số tiền và nội dung, không gõ lại, không sợ sai số tài khoản |
| File hóa đơn | Thư mục `/var/du-lieu/hoa-don` trên VPS | Cùng máy với database nên chương trình kiểm tra sau này đọc file trực tiếp, không qua mạng |
| Kiểm tra hóa đơn | Lần này chỉ để sẵn chỗ | Có cột trạng thái, cột kết quả, nút bấm để mờ; viết phần kiểm tra sau là cắm vào chạy |

### Vì sao không dùng float cho tiền

`0.1 + 0.2 !== 0.3` trong mọi ngôn ngữ dùng IEEE 754. Với tiền Việt không có xu, `BIGINT` đồng là đúng và đơn giản nhất. Trong TypeScript dùng `number` bình thường: số nguyên tới 9.007.199.254.740.991 vẫn chính xác tuyệt đối, thừa sức cho quy mô tiền tỷ.

## 3. Quy mô và chi phí

Dưới 20 người dùng, dưới 100 giao dịch một tháng, tức khoảng 1.200 dòng một năm. Quy mô này nhỏ tới mức không cần bàn về hiệu năng:

| Tài nguyên | Dự án cần | Ghi chú |
|---|---|---|
| RAM | Postgres 512 MB + Node 512 MB | VPS 2 GB là thoải mái, 1 GB vẫn chạy được |
| Dung lượng database | dưới 50 MB sau 5 năm | Không đáng kể |
| Dung lượng file hóa đơn | ~200 KB một PDF, ~5 GB cho 25.000 file | Tùy ổ đĩa VPS, xem cảnh báo dưới |
| CPU | gần như rảnh | 1 vCPU đủ |
| Băng thông | rất nhỏ | Chỉ vài người xem file |

Vì tự cài trên VPS, không còn hạn mức gói miễn phí nào để lo. Đổi lại, ba việc trước đây nhà cung cấp làm hộ thì giờ mình phải làm:

- **Vá bảo mật hệ điều hành.** Bật `unattended-upgrades` cho Ubuntu/Debian là đủ cho quy mô này.
- **Sao lưu.** Không ai làm hộ nữa. Chi tiết ở [mục 6, chặng 7](#chặng-7--vận-hành-và-siết-bảo-mật).
- **Theo dõi ổ đĩa.** Ổ đầy thì Postgres dừng ghi, và đây là cách hỏng đau nhất vì nó xảy ra âm thầm. Đặt cảnh báo ở mức 80%.

Về dung lượng file: ảnh chụp hóa đơn bằng điện thoại nặng 4–8 MB một tấm, nhanh hết ổ hơn PDF nhiều. Cách xử lý ở [BAO-MAT-VA-PHAN-QUYEN.md](BAO-MAT-VA-PHAN-QUYEN.md#5-tải-file-lên).

## 4. Bốn màn hình chính

**Bảng điều khiển** — 20 chỉ số chia 5 nhóm (Tạm ứng từ cơ quan, Quỹ phí hóa đơn, Quỹ chị Thúy, Chi tiếp khách, Chờ xử lý), kèm banner đối soát xanh/vàng ở trên cùng. Số liệu tính từ dữ liệu thô, không lưu ở đâu.

**Danh sách giao dịch** — lọc theo trạng thái HĐ đỏ, hình thức thanh toán, người lấy HĐ, khoảng ngày; tìm theo nội dung; hiển thị luôn 3 cột số dư lũy kế. Mỗi dòng có ô tích xanh khi đã có file hóa đơn và khi đã có ảnh chuyển khoản.

**Form nhập / sửa** — dropdown lấy từ bảng danh mục, ô tiền tự chấm phẩy nghìn khi gõ, kiểm tra chéo trước khi lưu.

**Trang admin** — quản lý người dùng và vai trò, quản lý người lấy HĐ (tỷ lệ phí và số tài khoản), sửa cấu hình chung, xem lịch sử thay đổi.

## 5. Cấu trúc thư mục

```
app/
  (auth)/dang-nhap/page.tsx
  (app)/
    layout.tsx                    # kiểm tra session + vai trò, dựng khung trang
    page.tsx                      # bảng điều khiển
    giao-dich/
      page.tsx                    # danh sách + bộ lọc
      [id]/page.tsx               # chi tiết, file đính kèm, QR
      actions.ts                  # Server Action: thêm / sửa / xóa mềm
    admin/
      nguoi-dung/page.tsx
      nguoi-lay-hd/page.tsx
      cau-hinh/page.tsx
      lich-su/page.tsx
  api/
    tep/[id]/route.ts             # kiểm quyền rồi tự đọc file từ ổ đĩa và trả về
    xuat-excel/route.ts           # xuất .xlsx để nộp cơ quan
lib/
  tai-chinh/
    tinh-toan.ts                  # ⭐ bộ tính: dữ liệu thô -> giá trị suy ra
    tinh-toan.test.ts             # test đối chiếu số của bảng Excel cũ
    chi-so.ts                     # 20 chỉ số của bảng điều khiển
    chi-so.test.ts
    kieu.ts                       # type dùng chung
  kiem-tra/                       # chỗ cắm cho phần kiểm tra hóa đơn
    giao-dien.ts                  # interface KiemTraHoaDon
    khong-lam-gi.ts               # bản rỗng dùng cho lần này
  qr/
    vietqr.ts                     # sinh payload EMVCo + CRC
    vietqr.test.ts
    ngan-hang.json                # danh sách mã BIN ngân hàng
  db/
    pool.ts                       # connection pool PostgreSQL phía server
    truy-van.ts                   # truy vấn có tham số, không nối chuỗi SQL
  xac-thuc/
    phien.ts                      # layPhien(), layVaiTro(), cookie HttpOnly
    bao-ve.ts                     # batBuocDangNhap(), batBuocVaiTro()
    mat-khau.ts                   # Argon2id: băm và kiểm tra mật khẩu
  xac-thuc/
    phien.ts                      # layPhien(), layVaiTro()
    bao-ve.ts                     # batBuocDangNhap(), batBuocVaiTro()
  validation/
    giao-dich.ts                  # schema Zod, dùng chung form và server
components/
  ui/                             # shadcn
  the-chi-so.tsx
  bang-giao-dich.tsx
  form-giao-dich.tsx
  o-tien.tsx                      # input tiền có chấm phẩy nghìn
  hop-thoai-qr.tsx
  vung-tai-file.tsx
db/
  migrations/                     # SQL có đánh số, chạy tuần tự bằng node-pg-migrate
  seed.sql                        # danh mục + admin đầu tiên
ops/
  backup.sh                       # pg_dump + sao lưu thư mục file ra máy khác
  tam-ung.service                 # systemd giữ Next.js luôn chạy
docs/                             # 4 file .md này
```

### Ba quy tắc giữ cho dự án dễ bảo trì

1. **Chỉ một chỗ tính toán.** Mọi giá trị suy ra đi qua `lib/tai-chinh/tinh-toan.ts`. Không component nào, không route nào được tự cộng trừ tiền. Đây là quy tắc quan trọng nhất trong dự án; phá nó là quay về đúng cái bệnh của bảng Excel.
2. **Không tin dữ liệu từ client.** Mọi Server Action bắt đầu bằng kiểm tra session và vai trò ở server. PostgreSQL constraints và quyền của role ứng dụng là lớp chặn thứ hai, không phải lớp duy nhất. Mỗi request đặt `SET LOCAL app.user_id` trong transaction để trigger audit biết ai thao tác.
3. **Một schema Zod dùng cho cả hai đầu.** Form và server cùng import `lib/validation/giao-dich.ts`, nên không bao giờ có chuyện form cho qua mà server chặn hoặc ngược lại.

## 6. Các chặng làm

Ước lượng là ước lượng, không phải cam kết. Mỗi chặng chạy được và kiểm tra được trước khi sang chặng sau.

### Chặng 0 — Dựng nền (khoảng 1 buổi)

Tạo project Next.js + Tailwind + shadcn, cài PostgreSQL trên Linux VPS, tạo database và role ứng dụng không có quyền superuser, cấu hình pool bằng biến môi trường. Cho Node chạy dưới systemd, đặt Caddy/nginx phía trước và bật HTTPS cho domain.

**Xong khi:** truy cập được URL thật trên internet và request tới database thành công bằng role ứng dụng.

### Chặng 1 — Dữ liệu và đăng nhập (khoảng 1 ngày)

Chạy các migration SQL để dựng bảng, constraint, role database, trigger lưu vết, seed danh mục và tài khoản admin đầu tiên. Trang đăng nhập dùng email + mật khẩu băm Argon2id; admin là người duy nhất tạo tài khoản, không có route tự đăng ký. Session là token ngẫu nhiên lưu dạng hash trong bảng `phien`, gửi qua cookie `HttpOnly; Secure; SameSite=Lax`.

**Xong khi:** đăng nhập bằng tài khoản admin vào được; mở URL nội bộ khi chưa đăng nhập bị đẩy về trang đăng nhập; role ứng dụng không thể đọc trực tiếp database từ internet; token cũ bị thu hồi sau khi logout.

### Chặng 2 — Bộ tính và CRUD (khoảng 2 ngày)

Đây là phần lõi, làm cẩn thận nhất.

Viết `tinh-toan.ts` trước, kèm test, **trước khi** viết giao diện. Test dùng đúng 7 dòng dữ liệu mẫu của bảng Excel làm chuẩn đối chiếu: 20.000.000 tạm ứng, 15.000.000 giao chị Thúy, ba hóa đơn 5.647.000 / 3.599.000 / 1.472.000, phí 15%. Kỳ vọng đã tính tay: tồn quỹ 10.754.000 + đã chi 9.246.000 + đã nộp trả 0 = 20.000.000.

Sau đó mới làm danh sách giao dịch, form thêm/sửa, xóa mềm.

**Xong khi:** test bộ tính xanh; thêm một giao dịch vào giữa bảng (ngày ở giữa) thì mọi số dư phía sau tự đúng; xóa một dòng cũng vậy.

### Chặng 3 — Bảng điều khiển (khoảng 1 ngày)

20 thẻ chỉ số, banner đối soát, biểu đồ số dư theo thời gian nếu còn thời gian. Bộ lọc và tìm kiếm cho danh sách giao dịch.

**Xong khi:** tổng trên bảng điều khiển khớp với tổng cộng của danh sách; banner đối soát báo xanh với dữ liệu mẫu, và báo vàng khi cố tình sửa lệch một số.

### Chặng 4 — File và QR (khoảng 1,5 ngày)

Tải file lên (PDF, XML, JPG, PNG), xem file trong khung nhúng, ô tích xanh khi đã có file. Sinh QR VietQR từ số tài khoản của người lấy HĐ, kèm đúng số tiền phí và nội dung chuyển khoản. Tải ảnh chuyển khoản lên, ô tích xanh thứ hai.

**Xong khi:** quét được QR bằng app ngân hàng thật và app điền đúng số tiền, đúng số tài khoản, đúng nội dung — xem cảnh báo ở [mục 8](#8-rủi-ro-đã-biết); mở file hóa đơn bằng link trực tiếp mà không đăng nhập thì bị chặn.

### Chặng 5 — Admin và lưu vết (khoảng 1 ngày)

Trang tạo người dùng, đặt vai trò, vô hiệu hóa tài khoản. Trang quản lý người lấy HĐ với tỷ lệ phí và tài khoản ngân hàng. Trang cấu hình chung. Trang xem lịch sử thay đổi có lọc theo người và theo giao dịch.

**Xong khi:** admin tạo được tài khoản mới và người đó đăng nhập được; sửa một giao dịch rồi thấy đúng giá trị cũ và mới trong lịch sử; tài khoản chỉ đọc bấm nút Sửa thì không có nút để bấm, và gọi thẳng Server Action cũng bị chặn.

### Chặng 6 — Xuất Excel và bàn giao (khoảng 1 buổi)

Xuất .xlsx đúng khuôn để in nộp cơ quan, tái sử dụng logic từ [build_workbook.py](../build_workbook.py) nhưng viết lại bằng `exceljs`. Viết hướng dẫn sử dụng cho người dùng cuối.

**Xong khi:** file xuất ra mở được bằng Excel, số khớp với web.

### Chặng 7 — Vận hành và siết bảo mật (khoảng 1 ngày)

Chặn số lần đăng nhập sai, thêm security header, xác thực loại file thật bằng magic bytes chứ không tin phần mở rộng, kiểm tra role ứng dụng không có quyền superuser và database chỉ lắng nghe localhost/private network. Thiết lập systemd, firewall chỉ mở 80/443/SSH, cảnh báo ổ đĩa, và cron sao lưu `pg_dump` cùng thư mục file sang máy off-box; thử khôi phục trên database tạm.

**Xong khi:** kiểm thử khôi phục thành công; file backup không nằm trong web root; không có secret database trong bundle client; checklist trong [BAO-MAT-VA-PHAN-QUYEN.md](BAO-MAT-VA-PHAN-QUYEN.md#8-checklist-trước-khi-cho-người-thật-dùng) tích đủ.

## 7. Chuẩn bị sẵn cho phần kiểm tra hóa đơn

Bạn đã nói định làm tiếp phần tự nhập liệu từ hóa đơn và kiểm tra hóa đơn đúng/sai. Lần này chưa làm, nhưng có ba thứ đặt sẵn để sau này gắn vào là chạy, không phải sửa lại bảng dữ liệu:

1. Cột `trang_thai_kiem_tra` và `ket_qua_kiem_tra` (kiểu `JSONB`) trong bảng `giao_dich`.
2. Interface `KiemTraHoaDon` trong `lib/kiem-tra/giao-dien.ts`, lần này dùng bản rỗng.
3. Nút "Kiểm tra hóa đơn" ở trang chi tiết, để mờ kèm chú thích "sắp có".

Chi tiết ở [LO-TRINH-KIEM-TRA-HOA-DON.md](LO-TRINH-KIEM-TRA-HOA-DON.md).

## 8. Rủi ro đã biết

**QR ngân hàng cần thử bằng app thật.** Tôi sinh payload theo chuẩn EMVCo của VietQR và tự tính CRC, không gọi dịch vụ bên thứ ba nào — nghĩa là số tài khoản của bạn không đi ra ngoài. Nhưng chuẩn này có vài chi tiết mà tài liệu công khai không nói rõ hết, nên **phải quét thử bằng app ngân hàng thật với số tiền nhỏ trước khi cho người khác dùng.** Đây là chỗ tôi không thể tự kiểm tra được.

**VPS là trách nhiệm vận hành của mình.** Không có dịch vụ bên ngoài tự lo database, file và backup. Vì vậy phải có systemd, cảnh báo service, cảnh báo ổ đĩa, `pg_dump` + backup file hằng ngày và thử khôi phục định kỳ.

**Dung lượng ổ đĩa.** Ảnh chụp điện thoại có thể nặng 4–8 MB/tấm. Nén ảnh ở trình duyệt, giới hạn 10 MB/file, ưu tiên PDF/XML và cảnh báo khi ổ đĩa vượt 80%.

**Hai người sửa cùng một giao dịch.** Với 20 người thì khả năng thấp nhưng không bằng không. Xử lý bằng optimistic locking: form gửi kèm `updated_at` đã đọc, server so lại, lệch thì báo "dòng này vừa được người khác sửa, tải lại trang" chứ không ghi đè im lặng.

**Số dư phụ thuộc thứ tự giao dịch.** Hai giao dịch cùng ngày thì cộng dồn theo thứ tự nào? Giải bằng cột `so_thu_tu` cho phép sắp tay, mặc định theo thời điểm tạo. Chi tiết ở [THIET-KE-DU-LIEU.md](THIET-KE-DU-LIEU.md#4-thứ-tự-giao-dịch).

## 9. Bảng Excel cũ thì sao

Giữ lại, đổi vai:

- [QUAN LY TAM UNG - TIEP KHACH.xlsx](../QUAN%20LY%20TAM%20UNG%20-%20TIEP%20KHACH.xlsx) — làm khuôn mẫu cho chức năng xuất Excel ở chặng 6, không dùng để nhập liệu nữa.
- [build_workbook.py](../build_workbook.py) — tham chiếu khi viết phần xuất file.
- [Code.gs](../Code.gs) và [Code.gs.bak-layout-cu](../Code.gs.bak-layout-cu) — không cần nữa sau khi web chạy, nhưng đừng xóa cho tới lúc đó.

Số liệu mẫu trong bảng Excel thành fixture cho test ở chặng 2. Nhờ vậy web và Excel chắc chắn cho ra cùng một con số, và nếu sau này ai sửa bộ tính làm sai lệch thì test đỏ ngay.

## 10. Việc còn treo

Lỗi bạn vừa gặp trên Google Sheets tôi vẫn chưa biết là lỗi gì — bạn chưa gửi ảnh hay chữ trong ô báo lỗi. Sau khi chuyển sang web thì lỗi đó không còn ý nghĩa vì cấu trúc gây ra nó không còn tồn tại. Nhưng nếu bạn vẫn cần bảng Sheets chạy được trong thời gian làm web, gửi tôi ảnh chụp để xử lý riêng.
