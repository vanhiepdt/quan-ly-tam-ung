import { FormDangNhap } from './form'

export default function DangNhap() {
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-indigo-50 via-slate-50 to-white px-4 py-12"><section className="w-full max-w-md p-7 sm:p-10 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight card"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">₫</span><p className="eyebrow mb-2 text-xs font-bold tracking-widest text-indigo-700" >QUẢN LÝ TÀI CHÍNH</p><h1>Đăng nhập an toàn</h1><p className="text-slate-500">Sử dụng tài khoản do quản trị viên cấp để tiếp tục.</p><FormDangNhap /></section></main>
}
