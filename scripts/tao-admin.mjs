import argon2 from 'argon2'
import pg from 'pg'

const { ADMIN_USERNAME: rawUsername, ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name = 'Quản trị viên', DATABASE_URL: url } = process.env
if (!url || !rawUsername || !password) {
  const thieu = [!url && 'DATABASE_URL', !rawUsername && 'ADMIN_USERNAME', !password && 'ADMIN_PASSWORD'].filter(Boolean).join(', ')
  throw new Error(`Thiếu ${thieu} trong .env.local. Đăng nhập bằng tên đăng nhập chứ không phải email, ví dụ thêm vào .env.local:\n  ADMIN_USERNAME=admin\n  ADMIN_PASSWORD=mat-khau-it-nhat-8-ky-tu`)
}
const username = rawUsername.trim().toLowerCase()
if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) throw new Error('ADMIN_USERNAME phải gồm 3–50 ký tự: chữ không dấu, số, dấu . _ -; bắt đầu bằng chữ hoặc số.')
if (password.length < 8 || password.length > 256) throw new Error('ADMIN_PASSWORD phải có từ 8 đến 256 ký tự.')
if (!name.trim() || name.trim().length > 120) throw new Error('ADMIN_NAME phải có từ 1 đến 120 ký tự.')
const hash = await argon2.hash(password, { type: argon2.argon2id })
const pool = new pg.Pool({ connectionString: url })
const client = await pool.connect()
try {
  await client.query('begin')
  await client.query('select pg_advisory_xact_lock(41004)')
  // Explicit provisioning tool only: matching is by username, never by email.
  const { rows } = await client.query(`insert into nguoi_dung (ten_dang_nhap,ho_ten,email,mat_khau_hash,vai_tro,dang_hoat_dong,doi_mat_khau)
    values ($1,$2,$3,$4,'admin',true,false)
    on conflict (ten_dang_nhap) do update set ho_ten=excluded.ho_ten,mat_khau_hash=excluded.mat_khau_hash,vai_tro='admin',dang_hoat_dong=true,doi_mat_khau=false
    returning id`, [username, name.trim(), email?.trim().toLowerCase() || null, hash])
  await client.query('delete from phien where nguoi_dung_id=$1', [rows[0].id])
  await client.query('commit')
  console.log('Đã tạo/cập nhật tài khoản quản trị và thu hồi các phiên đăng nhập cũ.')
} catch {
  await client.query('rollback')
  console.error('Không thể tạo tài khoản quản trị. Kiểm tra cấu hình và chạy migration trước khi thử lại.')
  process.exitCode = 1
} finally { client.release(); await pool.end() }
