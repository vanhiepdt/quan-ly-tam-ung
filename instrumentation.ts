// Worker timeout chạy trong process Node của Next. Mỗi process chỉ đăng ký một
// interval; việc claim intake bằng SKIP LOCKED bảo vệ trường hợp có nhiều instance.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return
  const globalState = globalThis as typeof globalThis & { __intakeWorkerTimer?: ReturnType<typeof setInterval> }
  if (globalState.__intakeWorkerTimer) return
  const { chayWorkerIntake } = await import('@/lib/intake/worker')
  const timer = setInterval(() => { void chayWorkerIntake().catch(() => undefined) }, 30_000)
  timer.unref?.()
  globalState.__intakeWorkerTimer = timer
}
