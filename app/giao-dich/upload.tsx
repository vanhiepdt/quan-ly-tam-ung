'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LOAI_TEP, LOAI_TEP_CHI_PDF, NHAN_LOAI_TEP, type LoaiTep } from '@/lib/tep/loai'

export function TaiTep({ giaoDichId, loaiMacDinh = 'hoa_don' }: { giaoDichId: string; loaiMacDinh?: LoaiTep }) {
  const [message, setMessage] = useState('')
  const [loai, setLoai] = useState<LoaiTep>(loaiMacDinh)
  const [dangTai, setDangTai] = useState(false)
  const router = useRouter()
  const chiPdf = LOAI_TEP_CHI_PDF.has(loai)
  return <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
    e.preventDefault()
    if (dangTai) return
    setDangTai(true)
    const form = e.currentTarget
    const data = new FormData(form)
    try {
      const r = await fetch(`/api/giao-dich/${giaoDichId}/tep`, { method: 'POST', body: data })
      const json = await r.json().catch(() => ({})) as { loi?: string }
      setMessage(r.ok ? 'Đã tải tệp lên.' : (json.loi ?? 'Tải tệp thất bại.'))
      if (r.ok) { form.reset(); setLoai(loaiMacDinh); router.refresh() }
    } catch {
      setMessage('Không gửi được tệp. Kiểm tra kết nối rồi thử lại.')
    } finally { setDangTai(false) }
  }}>
    <label className="field min-w-48 flex-1">Tệp
      <input name="tep" type="file" required disabled={dangTai}
        accept={chiPdf ? '.pdf,application/pdf' : '.pdf,.xml,.jpg,.jpeg,.png,.webp'} />
    </label>
    <label className="field min-w-56">Loại
      <select name="loai" value={loai} disabled={dangTai} onChange={e => setLoai(e.target.value as LoaiTep)}>
        {LOAI_TEP.map(l => <option key={l} value={l}>{NHAN_LOAI_TEP[l]}</option>)}
      </select>
    </label>
    <button className="btn btn-primary" disabled={dangTai}>{dangTai ? 'Đang tải…' : 'Tải lên'}</button>
    {message && <span className="text-sm text-slate-600" role="status">{message}</span>}
  </form>
}
