import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Thiếu DATABASE_URL trong .env.local.')
const pool = new pg.Pool({ connectionString: url })
const checksum = (text) => createHash('sha256').update(text).digest('hex')

try {
  await pool.query('select 1')
  await pool.query(`create table if not exists _lich_su_migration (
    ten text primary key,
    checksum text not null,
    da_chay_luc timestamptz not null default now()
  )`)

  const folder = path.join(process.cwd(), 'db', 'migrations')
  const files = (await readdir(folder)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort()
  for (const file of files) {
    const sql = await readFile(path.join(folder, file), 'utf8')
    const hash = checksum(sql)
    const { rows } = await pool.query('select checksum from _lich_su_migration where ten=$1', [file])
    if (rows[0]) {
      if (rows[0].checksum !== hash) throw new Error(`Migration ${file} đã chạy nhưng nội dung đã bị thay đổi. Hãy tạo migration mới thay vì sửa migration cũ.`)
      console.log(`Bỏ qua ${file} (đã chạy).`)
      continue
    }

    process.stdout.write(`Đang chạy ${file}... `)
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into _lich_su_migration (ten, checksum) values ($1,$2)', [file, hash])
      await client.query('commit')
      console.log('OK')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
  console.log('Đã chạy xong migration PostgreSQL.')
} catch (error) {
  console.error('\nKhông thể kết nối hoặc chạy migration PostgreSQL.')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await pool.end()
}
