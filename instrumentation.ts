export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { napChungChiHeThong } = await import('./lib/kiem-tra/tls-he-thong')
  const kq = napChungChiHeThong()
  if (kq.nap && kq.them > 0) {
    console.info(`[ai-hoa-don] TLS: nạp ${kq.them} chứng chỉ Windows vào Node`)
  } else if (!kq.nap && kq.lyDo) {
    console.info(`[ai-hoa-don] TLS: ${kq.lyDo}`)
  }
}
