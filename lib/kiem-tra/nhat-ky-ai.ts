const DAI = 400

export function anChuoiNhatKy(raw: string, khoa?: string): string {
  let s = raw
  if (khoa && khoa.length >= 6) s = s.split(khoa).join('[khoa]')
  return s
    .replace(/\bsk-[A-Za-z0-9_\-]{8,}/g, '[khoa]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [khoa]')
    .replace(/\b(?:x-api-key|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '[khoa]')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g, '[anh]')
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, u => {
      try {
        const x = new URL(u)
        if (x.username || x.password) return `${x.protocol}//${x.host}${x.pathname}`
        return `${x.protocol}//${x.host}${x.pathname}`
      } catch {
        return '[url]'
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DAI)
}

export function dauKhoa(khoa: string): string {
  const s = khoa.trim()
  if (!s) return 'không'
  if (s.length < 8) return `có (${s.length} ký tự)`
  return `…${s.slice(-4)} (${s.length} ký tự)`
}

export function trichThongDiepLoiAi(body: unknown): string {
  if (typeof body === 'string') return body
  if (!body || typeof body !== 'object') return ''
  const o = body as Record<string, unknown>
  const err = o.error
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const parts = [e.message, e.code, e.type, e.status].filter(v => typeof v === 'string') as string[]
    if (parts.length) return parts.join(' · ')
  }
  if (typeof o.message === 'string') return o.message
  return ''
}

export function ghiNhatKyAi(nhatKy: string[], dong: string, khoa?: string): void {
  const sach = anChuoiNhatKy(dong, khoa)
  if (!sach) return
  nhatKy.push(sach)
  console.info(`[ai-hoa-don] ${sach}`)
}

export function moTaLoiMang(error: unknown): string {
  if (!(error instanceof Error)) return 'lỗi mạng'
  const parts = [error.name, error.message]
  const code = (error as NodeJS.ErrnoException).code
  if (typeof code === 'string') parts.push(code)
  const cause = error.cause
  if (cause instanceof Error) {
    parts.push(cause.message)
    const cc = (cause as NodeJS.ErrnoException).code
    if (typeof cc === 'string') parts.push(cc)
  } else if (cause && typeof cause === 'object') {
    const o = cause as { code?: unknown; message?: unknown }
    if (typeof o.code === 'string') parts.push(o.code)
    if (typeof o.message === 'string') parts.push(o.message)
  }
  return [...new Set(parts.filter(Boolean))].join(' — ')
}
