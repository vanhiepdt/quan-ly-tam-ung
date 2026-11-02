import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Chính sách bảo mật · Quản lý tạm ứng & hóa đơn' }

// Trang công khai, dùng cho mục "Application privacy policy link" của Google OAuth.
export default function ChinhSachBaoMat() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12">
    <article className="card mx-auto max-w-3xl space-y-4 p-7 text-slate-700 sm:p-10 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">
      <h1 className="text-2xl font-bold text-slate-950">Chính sách bảo mật</h1>
      <p>Ứng dụng <strong>Quản lý tạm ứng &amp; hóa đơn</strong> (hc.ttdt.site) là công cụ nội bộ, chỉ người được quản trị viên cấp tài khoản mới đăng nhập được.</p>
      <h2>Dữ liệu Google được dùng</h2>
      <p>Khi quản trị viên kết nối Google Drive để sao lưu, ứng dụng chỉ xin các quyền:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li><code>openid</code>, <code>email</code>: xác nhận tài khoản Google đã kết nối.</li>
        <li><code>drive.file</code>: tạo thư mục “Sao lưu Quản lý tạm ứng” và tải bản sao lưu vào đó. Ứng dụng không đọc, sửa hay xóa bất kỳ tệp nào khác trong Drive.</li>
      </ul>
      <h2>Lưu trữ và bảo vệ</h2>
      <p>Refresh token của Google được mã hóa AES-256-GCM và chỉ lưu trên máy chủ của ứng dụng. Dữ liệu không được bán, chia sẻ với bên thứ ba hay dùng cho quảng cáo.</p>
      <h2>Thu hồi quyền</h2>
      <p>Quản trị viên có thể bấm <strong>Ngắt kết nối</strong> trong Cài đặt → Sao lưu dữ liệu, hoặc thu hồi quyền tại <a className="text-indigo-700 underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</p>
      <h2>Liên hệ</h2>
      <p>Mọi câu hỏi về dữ liệu, vui lòng liên hệ quản trị viên của ứng dụng qua email hỗ trợ được hiển thị trên màn hình cấp quyền Google.</p>
      <p className="pt-4"><Link className="text-indigo-700 underline" href="/">← Trang chủ</Link></p>
    </article>
  </main>
}
