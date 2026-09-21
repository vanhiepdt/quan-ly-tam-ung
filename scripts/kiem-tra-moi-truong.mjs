// Read-only preflight for manual local testing. Never print credentials or run migrations.
import pg from 'pg'

async function main() {
  for (const key of ['DATABASE_URL', 'ONLYOFFICE_JWT_SECRET', 'ONLYOFFICE_PUBLIC_URL', 'ONLYOFFICE_INTERNAL_URL', 'ONLYOFFICE_APP_URL']) {
    if (!process.env[key]?.trim()) throw new Error(`Thieu ${key} trong cau hinh.`)
  }
  if (process.env.ONLYOFFICE_JWT_SECRET.length < 32) throw new Error('ONLYOFFICE_JWT_SECRET can it nhat 32 ky tu.')
  for (const key of ['ONLYOFFICE_PUBLIC_URL', 'ONLYOFFICE_INTERNAL_URL', 'ONLYOFFICE_APP_URL']) {
    let url
    try { url = new URL(process.env[key]) } catch { throw new Error(`${key} khong phai URL hop le.`) }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${key} khong hop le.`)
  }
  if (new URL(process.env.ONLYOFFICE_APP_URL).port !== '3000') {
    throw new Error('Launcher local dung cong 3000. Kiem tra ONLYOFFICE_APP_URL truoc khi tiep tuc.')
  }
  for (const key of ['ONLYOFFICE_PUBLIC_URL', 'ONLYOFFICE_INTERNAL_URL']) {
    try {
      const response = await fetch(`${process.env[key].replace(/\/$/, '')}/healthcheck`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok || (await response.text()).trim() !== 'true') throw new Error()
    } catch { throw new Error(`DocumentServer chua san sang qua ${key}. Kiem tra Docker va cong 8081.`) }
  }
  console.log('OK DocumentServer healthcheck (public + internal).')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 })
  try {
    const { rows } = await pool.query("select to_regclass('public.giao_dich') as giao_dich, to_regclass('public.tai_lieu') as tai_lieu, to_regclass('public.tai_lieu_phien') as tai_lieu_phien, to_regclass('public.tai_lieu_phien_ban') as tai_lieu_phien_ban")
    if (Object.values(rows[0]).some(value => !value)) {
      throw new Error('Thieu bang ung dung/OnlyOffice. Sao luu DB va uploads; nho quan tri kiem tra migration 009. Script KHONG tu chay migration.')
    }
  } catch (error) {
    if (error.message.startsWith('Thieu bang')) throw error
    throw new Error('Khong ket noi/truy van duoc PostgreSQL. Kiem tra dich vu DB va DATABASE_URL (khong chia se mat khau).')
  } finally { await pool.end() }
  console.log('OK PostgreSQL va cac bang tai lieu. Khong thay doi du lieu.')
  console.log('Day la kiem tra moi truong; van can dang nhap va mo editor de kiem tra toan bo luong.')
}
main().catch(error => { console.error(`[LOI] ${error.message}`); process.exitCode = 1 })
