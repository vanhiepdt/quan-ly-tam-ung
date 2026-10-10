import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { layPhien } from '@/lib/xac-thuc/phien'
import { batDauUyQuyenGoogleDrive, redirectUriGoogleDrive } from '@/lib/sao-luu/google-drive'

export const runtime = 'nodejs'
export const COOKIE = '__Host-backup-google-state'

export async function POST(request: NextRequest) {
  const phien = await layPhien()
  if (phien?.vai_tro !== 'admin') return new Response('Không có quyền.', { status: 403 })
  const expectedOrigin = new URL(redirectUriGoogleDrive()).origin
  if (request.headers.get('origin') !== expectedOrigin) return new Response('Yêu cầu không cùng nguồn.', { status: 403 })
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  try {
    const url = await batDauUyQuyenGoogleDrive(state, verifier)
    const response = NextResponse.redirect(url, { status: 303 })
    response.cookies.set(COOKIE, `${state}.${verifier}.${phien.id}`, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
    })
    return response
  } catch {
    const url = new URL('/cai-dat?drive=chua_cau_hinh', expectedOrigin)
    return NextResponse.redirect(url, { status: 303 })
  }
}
