import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../../proxy'

describe('proxy route gate', () => {
  it('redirects unauthenticated navigation to login with return path', () => {
    const response = proxy(new NextRequest('http://localhost/giao-dich'))
    const location = new URL(response.headers.get('location')!)
    expect(response.status).toBe(307)
    expect(location.pathname).toBe('/dang-nhap')
    expect(location.searchParams.get('quay_lai')).toBe('/giao-dich')
  })
  it.each(['/dang-nhap', '/api/tep/abc'])('leaves %s to its own handler', path => {
    expect(proxy(new NextRequest(`http://localhost${path}`)).headers.get('x-middleware-next')).toBe('1')
  })
  it('lets the page verify a supplied session cookie', () => {
    const request = new NextRequest('http://localhost/giao-dich', { headers: { cookie: 'phien=synthetic-test-token' } })
    expect(proxy(request).headers.get('x-middleware-next')).toBe('1')
  })
})
