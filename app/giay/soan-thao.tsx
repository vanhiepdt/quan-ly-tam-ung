'use client'
import { useEffect, useId, useRef, useState } from 'react'
import type { CauHinhEditor } from '@/lib/onlyoffice/cau-hinh'

type Editor = { destroyEditor: () => void }
declare global {
  interface Window { DocsAPI?: { DocEditor: new (id: string, config: unknown) => Editor } }
}
let loading: Promise<void> | undefined
function loadScript(src: string) {
  if (window.DocsAPI) return Promise.resolve()
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    const timer = setTimeout(() => { script.remove(); loading = undefined; reject(new Error('Hết thời gian tải OnlyOffice')) }, 20000)
    script.onload = () => { clearTimeout(timer); resolve() }
    script.onerror = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Không tải được OnlyOffice')) }
    document.head.append(script)
  })
  return loading
}
export function SoanThao({ id, loai, mau }: { id?: string; loai?: string; mau?: string }) {
  const container = `onlyoffice-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const editor = useRef<Editor | null>(null)
  const [open, setOpen] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => {
    if (!open) return
    let disposed = false
    const controller = new AbortController()
    async function start() {
      try {
        setError(''); setNotice('Đang mở tài liệu…')
        const res = await fetch('/api/onlyoffice/mo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, loai, mau }), signal: controller.signal })
        const data = await res.json() as CauHinhEditor & { loi?: string; phienBan: number }
        if (!res.ok) throw new Error(data.loi || 'Không mở được tài liệu')
        await loadScript(data.script)
        if (disposed) return
        if (!window.DocsAPI) throw new Error('OnlyOffice chưa sẵn sàng')
        editor.current = new window.DocsAPI.DocEditor(container, { ...data.config, events: {
          onDocumentReady: () => setNotice(`Đang mở phiên bản ${data.phienBan}. Dùng nút Lưu trong editor; đóng tài liệu để kết thúc phiên.`),
          onError: () => setError('OnlyOffice báo lỗi. Chưa thể xác nhận bản sửa đã được lưu; hãy giữ editor mở và thử Lưu lại.'),
        } })
      } catch (e) { if (!disposed) { setError(e instanceof Error ? e.message : 'Không mở được tài liệu'); setNotice('') } }
    }
    void start()
    return () => { disposed = true; controller.abort(); editor.current?.destroyEditor(); editor.current = null }
  }, [open, id, loai, mau, container])
  return <div className="w-full space-y-3">
    <button type="button" className="btn btn-secondary" onClick={() => { setOpen(!open); setError(''); setNotice(open ? 'Đã đóng editor. Việc lưu cuối có thể cần vài giây; tải lại Word để kiểm tra bản đã lưu.' : '') }}>{open ? 'Đóng trình soạn thảo' : 'Mở trình soạn thảo'}</button>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="notice error">{error} Bạn vẫn có thể dùng liên kết tải Word.</p>}
    {open && <div className="h-[800px] w-full"><div id={container} /></div>}
  </div>
}
