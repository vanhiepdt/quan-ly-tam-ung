import Link from 'next/link'

export default function Home() {
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-indigo-50 via-slate-50 to-white px-4 py-12">
    <section className="card w-full max-w-2xl p-7 sm:p-12">
      <span className="mb-6 grid size-12 place-items-center rounded-xl bg-indigo-600 text-2xl font-bold text-white">₫</span>
      <p className="mb-3 text-xs font-bold tracking-widest text-indigo-700">QUẢN LÝ TÀI CHÍNH</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Quản lý tạm ứng & hóa đơn</h1>
      <p className="my-5 text-base leading-relaxed text-slate-600">Theo dõi giao dịch, đối soát quỹ và quản lý hóa đơn trong cùng một nơi.</p>
      <Link className="btn btn-primary" href="/dang-nhap">Đăng nhập →</Link>
    </section>
  </main>
}
