import { TarArchive } from 'archiver'
import { taiLenGoogleDrive } from './google-drive'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readdir, rm, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { db } from '@/lib/db/pool'
import { GOC_TEP } from '@/lib/tep/luu'
import { docCauHinhSaoLuu, KHOA_MUI_GIO_SAO_LUU, tachNgayGio, type LoaiSaoLuu } from './cau-hinh'

type Job = { id: string; loai: LoaiSaoLuu; ngayLich: string | null }

const DEFAULT_BACKUP_DIR = '/var/lib/tam-ung/backup'

function backupDir() { return process.env.BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR }

function thongBaoLoi(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Lỗi không xác định.'
  return text.replace(/[\r\n]+/g, ' ').slice(0, 500)
}

function thongTinKetNoi() {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) throw new Error('Thiếu DATABASE_URL trên máy chủ.')
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('DATABASE_URL không hợp lệ.') }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!database || !url.hostname) throw new Error('DATABASE_URL thiếu tên database hoặc máy chủ.')
  return {
    host: url.hostname, port: url.port || '5432', user: decodeURIComponent(url.username), database,
    password: decodeURIComponent(url.password),
  }
}

function chayLenh(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', code => code === 0
      ? resolve()
      : reject(new Error(command + ' thất bại (mã ' + (code ?? 'không xác định') + '): ' + stderr.trim().slice(0, 300))))
  })
}

function taoTarGzip(outputPath: string, databaseDump: string, attachments: string, manifest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath, { mode: 0o600 })
    const archive = new TarArchive({ gzip: true, gzipOptions: { level: 9 } })
    let settled = false
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error) } }
    output.once('error', fail)
    archive.once('error', fail)
    output.once('close', () => { if (!settled) { settled = true; resolve() } })
    archive.pipe(output)
    archive.file(databaseDump, { name: 'database.dump' })
    archive.append(manifest, { name: 'manifest.txt' })
    archive.directory(attachments, 'tep')
    void archive.finalize().catch(fail)
  })
}

async function donDep(dir: string) {
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 14)
  const tuoi = Number.isFinite(keepDays) && keepDays >= 1 ? keepDays : 14
  const moc = Date.now() - tuoi * 24 * 60 * 60 * 1000
  for (const name of await readdir(dir)) {
    if (!/^tam-ung-\d{8}-\d{6}\.tar\.gz$/.test(name)) continue
    const file = path.join(dir, name)
    const info = await stat(file).catch(() => null)
    if (info?.isFile() && info.mtimeMs < moc) await unlink(file).catch(() => undefined)
  }
}

export async function thucHienSaoLuu(): Promise<{ file: string; driveFileId: string }> {
  const dir = backupDir()
  await mkdir(dir, { recursive: true })
  await mkdir(GOC_TEP, { recursive: true })
  const connection = thongTinKetNoi()
  const runId = tachNgayGio()
  const id = runId.ngay.replaceAll('-', '') + '-' + runId.gio.replace(':', '') + '00'
  const work = await mkdtemp(path.join(dir, '.run-' + id + '-'))
  const archiveName = 'tam-ung-' + id + '.tar.gz'
  const archivePath = path.join(dir, archiveName)
  try {
    const dumpPath = path.join(work, 'database.dump')
    const env = { ...process.env, PGPASSWORD: connection.password, PGSSLMODE: process.env.DATABASE_SSL === 'true' ? 'require' : 'disable' }
    await chayLenh('pg_dump', [
      '--format=custom', '--no-owner', '--no-privileges', '--host', connection.host, '--port', connection.port,
      '--username', connection.user, '--dbname', connection.database, '--file', dumpPath,
    ], env)
    const manifest = [
      'backup_id=' + id,
      'created_at=' + new Date().toISOString(),
      'database=' + connection.database,
      'attachments=tep/',
      'source=quan-ly-tam-ung',
    ].join('\n') + '\n'
    await taoTarGzip(archivePath, dumpPath, GOC_TEP, manifest)
    const driveFileId = await taiLenGoogleDrive(archivePath, archiveName)
    await donDep(dir)
    return { file: archiveName, driveFileId }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function nhanViec(): Promise<Job | null> {
  const config = await docCauHinhSaoLuu()
  const now = tachNgayGio(new Date(), KHOA_MUI_GIO_SAO_LUU)
  const client = await db.connect()
  try {
    await client.query('begin')
    const { rows: lock } = await client.query<{ ok: boolean }>(
      "select pg_try_advisory_xact_lock(hashtext('quan-ly-tam-ung-backup')) as ok")
    if (!lock[0]?.ok) { await client.query('rollback'); return null }
    const { rows: pending } = await client.query<Job>(
      "select id, loai, ngay_lich as \"ngayLich\" from sao_luu_lan_chay where trang_thai='cho_xu_ly' order by tao_luc limit 1 for update skip locked")
    if (pending[0]) {
      await client.query("update sao_luu_lan_chay set trang_thai='dang_chay', bat_dau_luc=now() where id=$1", [pending[0].id])
      await client.query('commit')
      return pending[0]
    }
    if (config.batTuDong && now.gio >= config.gioChay) {
      const { rows } = await client.query<Job>(
        "insert into sao_luu_lan_chay (loai, trang_thai, ngay_lich) values ('lich','dang_chay',$1) on conflict (ngay_lich) where loai='lich' do nothing returning id, loai, ngay_lich as \"ngayLich\"", [now.ngay])
      if (rows[0]) {
        await client.query('update sao_luu_lan_chay set bat_dau_luc=now() where id=$1', [rows[0].id])
        await client.query('commit')
        return rows[0]
      }
    }
    await client.query('commit')
    return null
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally { client.release() }
}

export async function chayWorkerSaoLuu() {
  const job = await nhanViec()
  if (!job) return
  try {
    const result = await thucHienSaoLuu()
    await db.query("update sao_luu_lan_chay set trang_thai='thanh_cong', ket_thuc_luc=now(), drive_file_id=$1 where id=$2", [result.driveFileId, job.id])
  } catch (error) {
    const message = thongBaoLoi(error)
    await db.query("update sao_luu_lan_chay set trang_thai='that_bai', ket_thuc_luc=now(), loi=$1 where id=$2", [message, job.id])
    console.error('Sao lưu thất bại', message)
  }
}
