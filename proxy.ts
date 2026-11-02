import { NextResponse, type NextRequest } from 'next/server'
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/dang-nhap') || path.startsWith('/api/')) return NextResponse.next()
  // Trang chủ, chính sách bảo mật và điều khoản phải mở công khai cho Google OAuth.
  if (path === '/' || path === '/chinh-sach-bao-mat' || path === '/dieu-khoan') return NextResponse.next()
  if (request.cookies.has('phien')) return NextResponse.next()
  const url = request.nextUrl.clone(); url.pathname='/dang-nhap'; url.searchParams.set('quay_lai',path)
  return NextResponse.redirect(url)
}
export const config={ matcher:['/((?!_next/static|_next/image|favicon.ico).*)'] }
