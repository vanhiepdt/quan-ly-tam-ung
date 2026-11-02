import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Điều khoản sử dụng · Quản lý tạm ứng & hóa đơn' }

// Trang công khai, dùng cho mục "Application terms of service link" của Google OAuth.
export default function DieuKhoan() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12">
    <article className="card mx-auto max-w-3xl space-y-4 p-7 text-slate-700 sm:p-10 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">
      <h1 className="text-2xl font-bold text-slate-950">Điều khoản sử dụng</h1>
      <p>Ứng dụng <strong>Quản lý tạm ứng &amp; hóa đơn</strong> (hc.ttdt.site) phục vụ việc theo dõi tạm ứng, tiếp khách và hoàn ứng hóa đơn trong nội bộ đơn vị.</p>
      <h2>Tài khoản</h2>
      <p>Chỉ người được quản trị viên cấp tài khoản mới được sử dụng. Người dùng tự bảo quản mật khẩu và chịu trách nhiệm về dữ liệu mình nhập.</p>
      <h2>Sao lưu Google Drive</h2>
      <p>Tính năng sao lưu chỉ ghi vào thư mục do ứng dụng tạo trong Google Drive của tài khoản quản trị đã kết nối. Quản trị viên có thể ngắt kết nối bất cứ lúc nào.</p>
      <h2>Giới hạn</h2>
      <p>Ứng dụng được cung cấp theo hiện trạng cho mục đích nội bộ. Người dùng nên kiểm tra lại số liệu trước khi lập chứng từ chính thức.</p>
      <p className="pt-4"><Link className="text-indigo-700 underline" href="/">← Trang chủ</Link></p>
    </article>
  </main>
}
