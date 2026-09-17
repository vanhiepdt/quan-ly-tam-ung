'use client'
import { useActionState } from 'react'
import { dangNhap } from './actions'

const initial: { loi?: string } = {}
export function FormDangNhap() {
  const [state, action, pending] = useActionState(dangNhap, initial)
  return <form action={action} className="mt-6 grid gap-4">
    <label className="field">Tên đăng nhập<input name="ten_dang_nhap" type="text" required minLength={3} maxLength={50} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Nhập tên đăng nhập" /></label>
    <label className="field">Mật khẩu<input name="password" type="password" required autoComplete="current-password" /></label>
    {state.loi && <p className="notice error">{state.loi}</p>}
    <button disabled={pending} type="submit" className="btn btn-primary">{pending ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
  </form>
}
