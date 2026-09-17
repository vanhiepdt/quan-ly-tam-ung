import { Pool, type PoolClient } from 'pg'

const databaseUrl = process.env.DATABASE_URL

// Không ném lỗi lúc import: Next.js còn cần build khi máy chưa cấu hình database.
// Lỗi kết nối sẽ xuất hiện tại truy vấn và được route/action hiển thị an toàn.
export const db = new Pool(databaseUrl ? {
  connectionString: databaseUrl,
  max: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
} : { max: 10 })

export async function trongTransaction<T>(userId: string, fn: (client: PoolClient) => Promise<T>) {
  const client = await db.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('app.user_id', $1, true)`, [userId])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
