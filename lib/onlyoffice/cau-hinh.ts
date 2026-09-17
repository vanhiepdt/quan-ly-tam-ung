import { kyJwt, kyUrl } from './jwt'
import type { TaiLieu } from './tai-lieu'
import type { Phien } from '@/lib/xac-thuc/phien'

export function diaChi() {
  const url = (value: string | undefined) => {
    if (!value) throw new Error('Chưa cấu hình địa chỉ OnlyOffice')
    const u = new URL(value)
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Địa chỉ phải là HTTP origin')
    return u.origin
  }
  return {
    public: url(process.env.ONLYOFFICE_PUBLIC_URL),
    internal: url(process.env.ONLYOFFICE_INTERNAL_URL),
    app: url(process.env.ONLYOFFICE_APP_URL),
  }
}
export function cauHinhEditor(t: TaiLieu, phien: Phien, title: string) {
  const urls = diaChi()
  if (!t.khoa) throw new Error('Chưa mở phiên')
  const edit = !phien.doi_mat_khau && (t.ten_mau ? phien.vai_tro === 'admin' : phien.vai_tro !== 'chi_doc')
  const fileToken = kyUrl({ purpose: 'file', id: t.id, key: t.khoa })
  // Callback dùng capability riêng, dài hơn URL tải; vẫn kiểm tra vai trò hiện tại trong DB.
  const callbackToken = kyUrl({ purpose: 'callback', id: t.id, key: t.khoa, user: phien.id, edit }, 7 * 86400)
  const config = {
    documentType: 'word', width: '100%', height: '800px',
    document: { fileType: 'docx', key: t.khoa, title,
      url: `${urls.app}/api/onlyoffice/tep/${t.id}?t=${fileToken}`,
      permissions: { edit, download: true, print: true, review: edit, comment: edit } },
    editorConfig: { mode: edit ? 'edit' : 'view', lang: 'vi',
      user: { id: phien.id, name: phien.ho_ten },
      callbackUrl: `${urls.app}/api/onlyoffice/goi-lai?t=${callbackToken}`,
      customization: { forcesave: true, autosave: true } },
  }
  return { script: `${urls.public}/web-apps/apps/api/documents/api.js`, config: { ...config, token: kyJwt(config) } }
}
export type CauHinhEditor = ReturnType<typeof cauHinhEditor>
