import { timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { layPhien } from '@/lib/xac-thuc/phien'
import { hoanTatKetNoiGoogleDrive, redirectUriGoogleDrive } from '@/lib/sao-luu/google-drive'
import { COOKIE } from '../connect/route'

export const runtime = 'nodejs'

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function GET(request: NextRequest) {
  let status = 'loi'
  const phien = await layPhien()
  const cookie = request.cookies.get(COOKIE)?.value ?? ''
  const [savedState, verifier, adminId, extra] = cookie.split('.')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const code = request.nextUrl.searchParams.get('code') ?? ''
  if (phien?.vai_tro === 'admin' && phien.id === adminId && !extra && savedState && verifier && state && safeEqual(state, savedState)) {
    if (request.nextUrl.searchParams.get('error') === 'access_denied') status = 'tu_choi'
    else if (code) {
      try { await hoanTatKetNoiGoogleDrive(code, verifier); revalidatePath('/cai-dat'); status = 'da_ket_noi' }
      catch { status = 'loi' }
    }
  } else status = 'phien_het_han'
  const response = NextResponse.redirect(new URL('/cai-dat?drive=' + status, redirectUriGoogleDrive()), { status: 303 })
  response.cookies.set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
