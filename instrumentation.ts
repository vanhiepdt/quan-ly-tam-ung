// Các worker chạy trong process Node của Next. Mỗi process chỉ đăng ký một interval;
// khóa PostgreSQL bảo vệ trường hợp có nhiều instance.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return
  const globalState = globalThis as typeof globalThis & {
    __intakeWorkerTimer?: ReturnType<typeof setInterval>
    __backupWorkerTimer?: ReturnType<typeof setInterval>
  }
  if (!globalState.__intakeWorkerTimer) {
    const { chayWorkerIntake } = await import('@/lib/intake/worker')
    const timer = setInterval(() => { void chayWorkerIntake().catch(() => undefined) }, 30_000)
    timer.unref?.()
    globalState.__intakeWorkerTimer = timer
  }
  if (!globalState.__backupWorkerTimer) {
    const { chayWorkerSaoLuu } = await import('@/lib/sao-luu/worker')
    const timer = setInterval(() => { void chayWorkerSaoLuu().catch(error => console.error('Worker sao lưu lỗi', error)) }, 30_000)
    timer.unref?.()
    globalState.__backupWorkerTimer = timer
  }
}
