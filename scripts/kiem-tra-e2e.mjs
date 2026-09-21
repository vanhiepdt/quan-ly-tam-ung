// Real authenticated E2E. Never loads .env files or connects to the application's DB.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import net from 'node:net'
import pg from 'pg'
import { chromium, expect } from '@playwright/test'
import { onlyofficeFixture } from './onlyoffice-e2e.mjs'
import { lapGiayE2E } from './lap-giay-e2e.mjs'
import { realOnlyofficeFixture } from './onlyoffice-real-e2e.mjs'
const realOffice = process.argv.includes('--real-office')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const token = randomBytes(6).toString('hex')
const name = `finance-e2e-${token}`, database = `e2e_${token}`, user = `e2e_${token}`
const password = randomBytes(24).toString('hex')
const checks = [], external = []
let folder, server, browser, pool, containerId, office, serverLog = ''
const ok = label => { checks.push(label); console.log(`PASS ${label}`) }
const command = (exe, args, opts = {}) => execFileSync(exe, args, { encoding: 'utf8', timeout: 120000, ...opts })
async function freePort(preferred) {
  const listen = port => new Promise((resolve, reject) => {
    const s = net.createServer(); s.once('error', reject)
    s.listen(port, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) })
  })
  try { return await listen(preferred) } catch { return listen(0) }
}
function waitOutput(child, pattern, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Readiness deadline exceeded')), timeout)
    function done(error) { clearTimeout(timer); child.off('exit', exit); child.stdout.off('data', data); child.stderr.off('data', data); error ? reject(error) : resolve() }
    function data(chunk) { if (pattern.test(chunk.toString())) done() }
    function exit(code) { done(new Error(`Process exited before readiness: ${code}`)) }
    child.stdout.on('data', data); child.stderr.on('data', data); child.once('exit', exit)
  })
}
try {
  command('docker', ['info', '--format', '{{.ServerVersion}}'])
  const dbPort = await freePort(55436), appPort = await freePort(3101)
  assert.notEqual(appPort, 3100)
  // Keep the dependency junction on the same Windows drive (Next webpack cannot resolve cross-drive entries).
  folder = await mkdtemp(path.join(process.platform === 'win32' ? path.dirname(root) : tmpdir(), 'finance-e2e-'))
  // Explicit source allowlist; never copy personal files, uploads, .next or .env*.
  for (const source of ['app', 'lib', 'types', 'db', 'Mau', 'proxy.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'next.config.ts']) {
    await cp(path.join(root, source), path.join(folder, source), { recursive: true, filter: sourcePath => !path.basename(sourcePath).startsWith('.env') })
  }
  for (const source of ['chay-migration.mjs', 'tao-admin.mjs']) await cp(path.join(root, 'scripts', source), path.join(folder, 'scripts', source))
  await symlink(path.join(root, 'node_modules'), path.join(folder, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|HOME|LOCALAPPDATA|APPDATA)$/i.test(key)))
  Object.assign(env, { DATABASE_URL: `postgresql://${user}:${password}@127.0.0.1:${dbPort}/${database}`, ADMIN_USERNAME: 'e2e_admin', ADMIN_PASSWORD: 'Synthetic-E2E-Password-2026', ADMIN_NAME: 'Synthetic E2E Admin', NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', WATCHPACK_POLLING: 'true' })
  office = realOffice ? await realOnlyofficeFixture({ appPort }) : await onlyofficeFixture()
  Object.assign(env, { ONLYOFFICE_APP_URL: `http://127.0.0.1:${appPort}` }, office.env)
  containerId = command('docker', ['run', '--detach', '--rm', '--name', name, '--label', `finance.e2e=${token}`, '--tmpfs', '/var/lib/postgresql/data:rw', '--publish', `127.0.0.1:${dbPort}:5432`, '--env', `POSTGRES_DB=${database}`, '--env', `POSTGRES_USER=${user}`, '--env', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine']).trim()
  const logs = spawn('docker', ['logs', '--follow', containerId], { stdio: ['ignore', 'pipe', 'pipe'] })
  try { await waitOutput(logs, /database system is ready to accept connections/, 60000) } finally { logs.kill() }
  pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 30000 })
  // PostgreSQL bootstrap may announce readiness for its private Unix-socket phase first.
  await expect.poll(async () => { try { await pool.query('select 1'); return true } catch { return false } }, { timeout: 30000, intervals: [250, 500, 1000] }).toBe(true)
  const parsed = new URL(env.DATABASE_URL)
  assert.equal(parsed.hostname, '127.0.0.1'); assert.equal(parsed.port, String(dbPort))
  const identity = (await pool.query('select current_database() db, current_user usr, inet_server_port() port, host(inet_server_addr()) host')).rows[0]
  assert.equal(identity.db, database); assert.equal(identity.usr, user); assert.equal(identity.port, 5432)
  assert.ok(net.isIP(identity.host), 'SQL server host must be a concrete container IP')
  const inspection = JSON.parse(command('docker', ['inspect', containerId]))[0]
  assert.equal(inspection.Config.Labels['finance.e2e'], token)
  assert.ok(Object.values(inspection.NetworkSettings.Networks).some(network => network.IPAddress === identity.host || network.GlobalIPv6Address === identity.host), 'SQL server address must match owned disposable container')
  assert.equal(inspection.HostConfig.PortBindings['5432/tcp'][0].HostPort, String(dbPort))
  assert.equal(inspection.HostConfig.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1')
  assert.equal(inspection.Mounts.filter(m => m.Type !== 'tmpfs').length, 0)
  ok('isolated disposable PostgreSQL identity/loopback/tmpfs verified before writes')
  for (const script of ['chay-migration.mjs', 'tao-admin.mjs']) command(process.execPath, [path.join(folder, 'scripts', script)], { cwd: folder, env })
  ok('real migrations and synthetic administrator provisioning')
  const next = path.join(folder, 'node_modules/next/dist/bin/next')
  if (realOffice) {
    // Only the identity-verified disposable loopback DB has no TLS. Never change application TLS defaults.
    assert.equal((await pool.query('show ssl')).rows[0].ssl, 'off')
    const tlsProbe = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000 })
    try { await assert.rejects(tlsProbe.connect(), /does not support SSL/) } finally { await tlsProbe.end() }
    env.DATABASE_URL += '?sslmode=disable'
    env.NODE_ENV = 'production'
    command(process.execPath, [next, 'build', '--webpack'], { cwd: folder, env, timeout: 240000 })
    console.log('READY isolated production build')
  }
  server = spawn(process.execPath, [next, ...(realOffice ? ['start'] : ['dev', '--webpack']), '--hostname', realOffice ? '0.0.0.0' : '127.0.0.1', '--port', String(appPort)], { cwd: folder, env, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', b => { serverLog += b.toString() }); server.stderr.on('data', b => { serverLog += b.toString() })
  await waitOutput(server, /Ready in/, 90000)
  const origin = `http://${realOffice ? 'localhost' : '127.0.0.1'}:${appPort}`
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  async function context() {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
    await c.route('**/*', route => { const url = route.request().url(); if (url.startsWith(origin + '/') || (realOffice && url.startsWith(office.address + '/')) || url.startsWith('data:')) return route.continue(); external.push(url); return route.abort() })
    await c.routeWebSocket(/.*/, ws => { if (ws.url().startsWith(`ws://127.0.0.1:${appPort}/`) || (realOffice && ws.url().startsWith(office.address.replace('http:', 'ws:') + '/'))) ws.connectToServer(); else { external.push(ws.url()); ws.close() } })
    return c
  }
  const ctx = await context(), page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  // Bắt lại request server action thật của admin để dùng làm đối chứng ở ca giả mạo vai trò.
  const adminActions = []
  page.on('request', request => {
    if (request.method() !== 'POST' || !request.headers()['next-action']) return
    adminActions.push({ url: request.url(), headers: request.headers(), body: request.postData() ?? '' })
  })
  async function login(p, username, pass) {
    await p.goto(origin + '/dang-nhap', { timeout: 120000 })
    await p.locator('input[name="ten_dang_nhap"]').fill(username)
    await p.locator('input[type="password"]').fill(pass)
    await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    try { await p.waitForURL('**/dashboard', { timeout: 30000 }) } catch (error) {
      console.error('LOGIN diagnostic', JSON.stringify({ path: new URL(p.url()).pathname,
        notice: await p.locator('p.notice.error').allTextContents(),
        sessions: (await pool.query('select count(*)::int n from phien')).rows[0].n,
        cookies: (await p.context().cookies()).map(c => ({ name: c.name, secure: c.secure, domain: c.domain })) }))
      throw error
    }
  }
  await login(page, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)
  const admin = (await pool.query('select id from nguoi_dung where ten_dang_nhap=$1', [env.ADMIN_USERNAME])).rows[0].id
  assert.equal((await pool.query('select count(*)::int n from phien where nguoi_dung_id=$1', [admin])).rows[0].n, 1)
  ok('real browser password login creates persisted authenticated session')
  for (const template of ['Tam ung tien.docx', 'tiep khach va thanh toan.docx']) {
    const templateResponse = await page.goto(`${origin}/cai-dat/mau/${encodeURIComponent(template)}`)
    assert.equal(templateResponse.status(), 200, 'encoded template page available after administrator login')
    await expect(page.getByRole('heading', { name: `Mẫu giấy: ${template}`, exact: true })).toBeVisible()
  }
  assert.equal((await ctx.request.get(`${origin}/cai-dat/mau/unknown.docx`)).status(), 404)
  ok('encoded template routes resolve both known filenames and reject unknown templates')
  await page.goto(origin + '/admin')
  const unitForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Thêm đơn vị', exact: true }) })
  for (const ten of ['E2E Synthetic Unit', 'E2E Synthetic Unit Two']) {
    await unitForm.locator('[name="ten"]').fill(ten)
    await unitForm.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click()
    await expect.poll(async () => (await pool.query('select count(*)::int n from don_vi where ten=$1', [ten])).rows[0].n).toBe(1)
  }
  await expect(unitForm.getByRole('status')).toBeVisible()
  const unit = (await pool.query('select id from don_vi where ten=$1', ['E2E Synthetic Unit'])).rows[0].id
  const unit2 = (await pool.query('select id from don_vi where ten=$1', ['E2E Synthetic Unit Two'])).rows[0].id
  const payee = page.locator('form').filter({ has: page.getByRole('button', { name: 'Thêm người lấy HĐ', exact: true }) })
  for (const [key, value] of Object.entries({ ten: 'E2E Synthetic Payee', ty_le_phi: '10', chi_nhanh: 'Chi nhánh E2E', so_tai_khoan: '000000000001', ten_chu_tk: 'SYNTHETIC TEST ONLY' })) await payee.locator(`[name="${key}"]`).fill(value)
  await payee.locator('[name=ngan_hang_bin]').selectOption('970415')
  const payeeCount = (await pool.query('select count(*)::int n from nguoi_lay_hd')).rows[0].n
  await payee.getByRole('button', { name: 'Test QR', exact: true }).click()
  await expect(payee.getByAltText('QR thử tài khoản người lấy hóa đơn')).toBeVisible()
  assert.equal((await pool.query('select count(*)::int n from nguoi_lay_hd')).rows[0].n, payeeCount)
  await payee.locator('[name=ngan_hang_bin]').selectOption('970436')
  await expect(payee.getByAltText('QR thử tài khoản người lấy hóa đơn')).toHaveCount(0)
  await payee.locator('[name=ngan_hang_bin]').selectOption('970415')
  await payee.getByRole('button', { name: 'Thêm người lấy HĐ', exact: true }).click()
  await expect(payee.getByRole('status')).toBeVisible()
  const collector = (await pool.query('select id,ty_le_phi from nguoi_lay_hd where ten=$1', ['E2E Synthetic Payee'])).rows[0]
  assert.equal(Number(collector.ty_le_phi), 0.1)
  // Người lấy HĐ thứ hai để kiểm tra việc tra tên khóa ngoại trong lịch sử sửa.
  for (const [key, value] of Object.entries({ ten: 'E2E Synthetic Payee Two', ty_le_phi: '20', chi_nhanh: 'Chi nhánh E2E', so_tai_khoan: '000000000002', ten_chu_tk: 'SYNTHETIC TEST ONLY' })) await payee.locator(`[name="${key}"]`).fill(value)
  await payee.getByRole('button', { name: 'Thêm người lấy HĐ', exact: true }).click()
  await expect.poll(async () => (await pool.query('select count(*)::int n from nguoi_lay_hd where ten=$1', ['E2E Synthetic Payee Two'])).rows[0].n).toBe(1)
  const collector2 = (await pool.query('select id from nguoi_lay_hd where ten=$1', ['E2E Synthetic Payee Two'])).rows[0]
  ok('real unit/payee forms persist synthetic records and fee rate')
  await page.goto(origin + '/giao-dich')
  // Chỉ Hoàn tạm ứng và Cơ quan trả thẳng mới gắn đơn vị tiếp khách; khi đó Nội dung do
  // máy chủ sinh từ tên đơn vị và bị khóa. Ba hình thức nội bộ khóa Nội dung = tên hình thức.
  const CO_DON_VI = ['Hoàn tạm ứng', 'Cơ quan trả thẳng']
  async function openForm(hinhThuc, content) {
    await page.getByRole('button', { name: '+ Thêm giao dịch', exact: true }).click()
    const d = page.getByRole('dialog', { name: 'Thêm giao dịch', exact: true })
    await d.locator('[name="ngay"]').fill('2026-09-16')
    if (hinhThuc !== 'Tạm ứng thêm') await d.locator('[name="hinh_thuc"]').selectOption(hinhThuc)
    if (CO_DON_VI.includes(hinhThuc)) {
      const o = d.getByPlaceholder('Gõ tên đơn vị để tìm hoặc thêm mới')
      await o.fill('E2E Synthetic Unit')
      await expect(d.locator('[name="don_vi_id"]')).toHaveValue(unit)
      const noiDung = d.locator('[name="noi_dung"]')
      await expect(noiDung).toHaveValue('Tiếp E2E Synthetic Unit')
      await expect(noiDung).toHaveAttribute('readonly', '')
    } else {
      await expect(d.locator('[name="don_vi_id"]')).toHaveCount(0)
      await expect(d.locator('[name="noi_dung"]')).toHaveValue(hinhThuc)
      await expect(d.locator('[name="noi_dung"]')).toHaveAttribute('readonly', '')
      if (content) await d.locator('[name="ghi_chu"]').fill(content)
    }
    return d
  }
  let dialog = await openForm('Tạm ứng thêm', 'E2E advance')
  await dialog.getByLabel('Tạm ứng từ cơ quan (VND)').fill('100000')
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const advance = (await pool.query('select * from giao_dich where ghi_chu=$1', ['E2E advance'])).rows[0]
  assert.equal(advance.tam_ung_tu_cq, '100000'); assert.equal(advance.phi_lay_hd_ghi_de, null)
  assert.equal(advance.nguoi_lay_hd_id, null); assert.equal(advance.trang_thai_tt_phi, 'Không phát sinh'); assert.equal(advance.trang_thai_hd, 'Không có')
  assert.equal(advance.don_vi_id, null)
  assert.equal(advance.noi_dung, 'Tạm ứng thêm')
  ok('advance form inserts successfully with null/hidden-field defaults and no unit attached')
  dialog = await openForm('Hoàn tạm ứng', 'E2E overbalance')
  await dialog.getByLabel('Tổng tiền (VND)', { exact: false }).fill('200000')
  await dialog.locator('[name="so_hd"]').fill('E2E01')
  await dialog.locator('[name="nguoi_lay_hd_id"]').selectOption(collector.id)
  await dialog.locator('[name="trang_thai_tt_phi"]').selectOption('Chưa thanh toán')
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
  const warning = page.getByRole('dialog', { name: 'Hoàn ứng vượt dư lý thuyết' })
  await expect(warning).toBeVisible()
  const countRefund = async () => (await pool.query('select count(*)::int n from giao_dich where so_hd=$1', ['E2E01'])).rows[0].n
  assert.equal(await countRefund(), 0)
  await warning.getByRole('button', { name: 'Quay lại chỉnh sửa' }).click()
  assert.equal(await countRefund(), 0)
  await expect(dialog.locator('[name="hinh_thuc"]')).toHaveValue('Hoàn tạm ứng')
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
  await expect(warning).toBeVisible()
  await warning.getByRole('button', { name: 'Tiếp tục lưu' }).click()
  await expect(dialog).toHaveCount(0)
  assert.equal(await countRefund(), 1)
  ok('overbalance warning performs no insert; cancel preserves form; reconfirm inserts exactly once')
  const refund = (await pool.query('select * from giao_dich where so_hd=$1', ['E2E01'])).rows[0]
  // Nội dung không lấy từ client mà do máy chủ sinh lại từ tên đơn vị.
  assert.equal(refund.noi_dung, 'Tiếp E2E Synthetic Unit'); assert.equal(refund.don_vi_id, unit)
  const auditBeforeQr = (await pool.query('select count(*)::int n from lich_su')).rows[0].n
  await page.getByRole('row').filter({ hasText: 'E2E01' }).getByRole('button', { name: 'Thanh toán', exact: true }).click()
  const qr = page.getByRole('dialog', { name: 'Thanh toán phí lấy HĐ' })
  await expect(qr.getByRole('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(qr).toContainText('20.000 đồng')
  await expect(qr).toContainText('TT HD E2E01 20260916')
  await qr.getByRole('button', { name: 'Tải lại QR theo dữ liệu mới nhất' }).click()
  await expect(qr.getByRole('img')).toBeVisible()
  assert.deepEqual((await pool.query('select * from giao_dich where id=$1', [refund.id])).rows[0], refund)
  assert.equal((await pool.query('select count(*)::int n from lich_su')).rows[0].n, auditBeforeQr)
  await qr.getByRole('button', { name: 'Đóng', exact: true }).click()
  ok('local QR uses computed fee/memo; open/reload causes no paid status, row or audit mutation')
  // Ca 1: sửa đơn vị tiếp khách của một giao dịch thật. Nội dung phải được máy chủ sinh
  // lại theo tên đơn vị mới, và lịch sử phải ghi một dòng UPDATE giữ nguyên giá trị cũ.
  await page.getByRole('row').filter({ hasText: 'E2E01' }).getByRole('button', { name: 'Sửa', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Sửa giao dịch' })
  await expect(edit).toBeVisible()
  // Mỗi lần lưu chỉ đổi được một trường, nên ô giá trị phải là ô đơn vị chứ không phải ô tiền.
  await edit.locator('[name="truong"]').selectOption('don_vi_id')
  await expect(edit.locator('[name="gia_tri"]')).toHaveValue(unit)
  await edit.locator('[name="gia_tri"]').selectOption(unit2)
  await edit.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await expect.poll(async () => (await pool.query('select don_vi_id from giao_dich where so_hd=$1', ['E2E01'])).rows[0].don_vi_id).toBe(unit2)
  const afterEdit = (await pool.query('select don_vi_id,noi_dung,nguoi_sua from giao_dich where so_hd=$1', ['E2E01'])).rows[0]
  assert.equal(afterEdit.noi_dung, 'Tiếp E2E Synthetic Unit Two')
  assert.equal(afterEdit.nguoi_sua, admin)
  const unitAudit = (await pool.query("select nguoi_thuc_hien,gia_tri_cu,gia_tri_moi from lich_su where bang='giao_dich' and hanh_dong='UPDATE' order by id desc limit 1")).rows[0]
  assert.equal(unitAudit.nguoi_thuc_hien, admin)
  assert.equal(unitAudit.gia_tri_cu.don_vi_id, unit)
  assert.equal(unitAudit.gia_tri_cu.noi_dung, 'Tiếp E2E Synthetic Unit')
  assert.equal(unitAudit.gia_tri_moi.don_vi_id, unit2)
  assert.equal(unitAudit.gia_tri_moi.noi_dung, 'Tiếp E2E Synthetic Unit Two')
  ok('ledger unit edit rewrites description server-side and records an UPDATE audit row with the previous unit')
  // Ca 3: đổi người lấy hóa đơn, trường chỉ quản trị viên thấy.
  await page.getByRole('row').filter({ hasText: 'E2E01' }).getByRole('button', { name: 'Sửa', exact: true }).click()
  const editPayee = page.getByRole('dialog', { name: 'Sửa giao dịch' })
  await editPayee.locator('[name="truong"]').selectOption('nguoi_lay_hd_id')
  await expect(editPayee.locator('[name="gia_tri"]')).toHaveValue(collector.id)
  await editPayee.locator('[name="gia_tri"]').selectOption(collector2.id)
  await editPayee.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(editPayee).toHaveCount(0)
  await expect.poll(async () => (await pool.query('select nguoi_lay_hd_id from giao_dich where so_hd=$1', ['E2E01'])).rows[0].nguoi_lay_hd_id).toBe(collector2.id)
  ok('admin-only payee edit persists the new foreign key and leaves the old payee untouched')
  // Ca 4: sửa ngày phát sinh. Số thứ tự chỉ có nghĩa trong một ngày, nên giao dịch chuyển
  // ngày phải được đánh số lại ở cuối ngày mới, đúng như khi thêm mới.
  // Giao dịch tạm ứng không có số hóa đơn nên tra theo số hóa đơn hoặc nội dung.
  const ngayVaSo = async nhan => (await pool.query(
    "select to_char(ngay,'YYYY-MM-DD') ngay, so_thu_tu from giao_dich where coalesce(so_hd, noi_dung)=$1", [nhan])).rows[0]
  assert.deepEqual(await ngayVaSo('E2E01'), { ngay: '2026-09-16', so_thu_tu: 2 })
  assert.deepEqual(await ngayVaSo('E2E advance'), { ngay: '2026-09-16', so_thu_tu: 1 })
  await page.getByRole('row').filter({ hasText: 'E2E01' }).getByRole('button', { name: 'Sửa', exact: true }).click()
  const editNgay = page.getByRole('dialog', { name: 'Sửa giao dịch' })
  await editNgay.locator('[name="truong"]').selectOption('ngay')
  const oNgay = editNgay.locator('[name="gia_tri"]')
  await expect(oNgay).toHaveAttribute('type', 'date')
  await expect(oNgay).toHaveValue('2026-09-16')
  await oNgay.fill('2026-09-20')
  await editNgay.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(editNgay).toHaveCount(0)
  await expect.poll(async () => (await ngayVaSo('E2E01')).ngay).toBe('2026-09-20')
  assert.deepEqual(await ngayVaSo('E2E01'), { ngay: '2026-09-20', so_thu_tu: 1 })
  const ngayAudit = (await pool.query("select gia_tri_cu,gia_tri_moi from lich_su where bang='giao_dich' and hanh_dong='UPDATE' order by id desc limit 1")).rows[0]
  assert.equal(ngayAudit.gia_tri_cu.ngay, '2026-09-16')
  assert.equal(ngayAudit.gia_tri_moi.ngay, '2026-09-20')
  assert.equal(ngayAudit.gia_tri_cu.so_thu_tu, 2)
  assert.equal(ngayAudit.gia_tri_moi.so_thu_tu, 1)
  // Giao dịch tạo trước nhưng chuyển ngày sau phải nằm dưới giao dịch đã ở ngày đó.
  await page.getByRole('row').filter({ hasText: 'E2E advance' }).getByRole('button', { name: 'Sửa', exact: true }).click()
  const editAdvance = page.getByRole('dialog', { name: 'Sửa giao dịch' })
  await editAdvance.locator('[name="truong"]').selectOption('ngay')
  await editAdvance.locator('[name="gia_tri"]').fill('2026-09-20')
  await editAdvance.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(editAdvance).toHaveCount(0)
  await expect.poll(async () => (await ngayVaSo('E2E advance')).so_thu_tu).toBe(2)
  assert.deepEqual(await ngayVaSo('E2E advance'), { ngay: '2026-09-20', so_thu_tu: 2 })
  const trongNgay = (await pool.query(
    "select coalesce(so_hd, noi_dung) ten, so_thu_tu from giao_dich where ngay='2026-09-20' and not da_xoa order by so_thu_tu")).rows
  assert.deepEqual(trongNgay, [{ ten: 'E2E01', so_thu_tu: 1 }, { ten: 'E2E advance', so_thu_tu: 2 }])
  ok('date edit re-sequences so_thu_tu inside the destination day and records old/new date plus sequence in the audit row')
  // Ca 5: xem lịch sử sửa. Dữ liệu do trigger ghi, giao diện chỉ đọc và tra tên thay vì uuid.
  await page.getByRole('row').filter({ hasText: 'E2E01' }).getByRole('button', { name: 'Lịch sử', exact: true }).click()
  const history = page.getByRole('dialog', { name: 'Lịch sử sửa' })
  await expect(history).toBeVisible()
  await expect(history).toContainText('Tạo giao dịch')
  await expect(history).toContainText('Sửa giao dịch')
  await expect(history).toContainText('Synthetic E2E Admin')
  await expect(history).toContainText('Ngày phát sinh')
  await expect(history).toContainText('Số thứ tự trong ngày')
  await expect(history).toContainText('2026-09-16')
  await expect(history).toContainText('2026-09-20')
  // Khóa ngoại phải được tra sang tên đọc được, không hiện uuid trần.
  await expect(history).toContainText('E2E Synthetic Unit Two')
  await expect(history).toContainText('E2E Synthetic Payee Two')
  await expect(history).not.toContainText(unit)
  await expect(history).not.toContainText(unit2)
  await expect(history).not.toContainText(collector.id)
  await expect(history).not.toContainText(collector2.id)
  // Lịch sử là màn hình chỉ đọc, và tải lại phải đọc đúng bản ghi đang xem.
  await expect(history.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0)
  await expect(history.getByRole('button', { name: 'Xóa', exact: true })).toHaveCount(0)
  const soMucLichSu = await history.locator('ol > li').count()
  assert.ok(soMucLichSu >= 4, `expected insert + unit + payee + date edits, got ${soMucLichSu}`)
  await history.getByRole('button', { name: 'Tải lại' }).click()
  await expect.poll(() => history.locator('ol > li').count()).toBe(soMucLichSu)
  await history.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(history).toHaveCount(0)
  ok('read-only history dialog shows real audit rows, resolves foreign keys to names, reloads and closes')
  await page.goto(origin + '/cai-dat')
  const checkbox = page.getByRole('checkbox').first()
  await checkbox.uncheck()
  await page.getByRole('slider', { name: 'Chiều rộng cột Nội dung', exact: true }).fill('320')
  await page.getByRole('button', { name: 'Đưa cột Nội dung sang trái', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu tùy chọn', exact: true }).click()
  await expect(page.getByRole('status')).toBeVisible()
  const prefs = (await pool.query('select tuy_chon from tuy_chon_cot_nhat_ky where nguoi_dung_id=$1', [admin])).rows[0].tuy_chon
  assert.deepEqual(prefs.an, ['ngay']); assert.equal(prefs.rong.noiDung, 320); assert.equal(prefs.thuTu[0], 'noiDung')
  await page.reload(); await expect(page.getByRole('checkbox', { name: 'Ngày', exact: true })).not.toBeChecked()
  await expect(page.getByRole('slider', { name: 'Chiều rộng cột Nội dung', exact: true })).toHaveValue('320')
  await expect(page.getByRole('checkbox').first()).toHaveAccessibleName('Nội dung')
  ok('column preferences persist in PostgreSQL and survive full browser reload')
  for (const route of ['/dashboard', '/admin', '/cai-dat', '/giao-dich']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(origin + route)
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, mainMin: getComputedStyle(document.querySelector('main')).minWidth }))
      assert.ok(layout.scroll <= width + 1, `${route} horizontal body overflow at ${width}: ${layout.scroll}`)
    }
  }
  await page.goto(origin + '/admin')
  const columns = await page.locator('form').filter({ has: page.getByRole('button', { name: 'Thêm đơn vị', exact: true }) }).evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  assert.equal(columns, 2)
  await page.setViewportSize({ width: 390, height: 900 })
  assert.equal(await page.locator('form').filter({ has: page.getByRole('button', { name: 'Thêm đơn vị', exact: true }) }).evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1)
  ok('compiled Tailwind authenticated pages fit 390/1440px; admin form changes 1/2 columns')
  const audits = (await pool.query("select bang,nguoi_thuc_hien,hanh_dong,gia_tri_cu,gia_tri_moi from lich_su where bang in ('giao_dich','don_vi','nguoi_lay_hd')")).rows
  // Hai giao dịch chèn mới cộng bốn dòng cập nhật: sửa đơn vị, sửa người lấy HĐ và hai lần sửa ngày.
  assert.equal(audits.filter(row => row.bang === 'giao_dich').length, 6)
  assert.equal(audits.filter(row => row.bang === 'giao_dich' && row.hanh_dong === 'INSERT').length, 2)
  assert.equal(audits.filter(row => row.bang === 'giao_dich' && row.hanh_dong === 'UPDATE').length, 4)
  assert.equal(audits.filter(row => row.bang === 'nguoi_lay_hd').length, 2)
  assert.ok(audits.every(row => row.nguoi_thuc_hien === admin && row.gia_tri_moi?.id))
  // Chỉ dòng INSERT mới không có giá trị cũ; dòng UPDATE phải giữ được ảnh chụp trước khi sửa.
  assert.ok(audits.filter(row => row.hanh_dong === 'INSERT').every(row => row.gia_tri_cu === null))
  assert.ok(audits.filter(row => row.hanh_dong === 'UPDATE').every(row => row.gia_tri_cu?.id))
  assert.equal((await pool.query('select nguoi_tao from don_vi where id=$1', [unit])).rows[0].nguoi_tao, admin)
  assert.equal(audits.filter(row => row.bang === 'don_vi').length, 2)
  ok('SQL transaction/payee/unit audit actors and unit creator identify authenticated administrator')
  // A separate synthetic read-only identity, never a bypass of application authorization.
  await pool.query("insert into nguoi_dung(ten_dang_nhap,ho_ten,mat_khau_hash,vai_tro,doi_mat_khau) select 'e2e_reader','Synthetic reader',mat_khau_hash,'chi_doc',false from nguoi_dung where id=$1", [admin])
  const readerContext = await context(), reader = await readerContext.newPage()
  await login(reader, 'e2e_reader', env.ADMIN_PASSWORD)
  await reader.goto(origin + '/giao-dich')
  await expect(reader.getByRole('button', { name: '+ Thêm giao dịch', exact: true })).toHaveCount(0)
  await expect(reader.getByRole('button', { name: 'Thanh toán', exact: true })).toHaveCount(0)
  await expect(reader.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0)
  await expect(reader.getByRole('button', { name: 'Xóa', exact: true })).toHaveCount(0)
  // Lịch sử là dữ liệu chỉ đọc nên vai trò chi_doc vẫn xem được, dù không sửa được gì.
  const readerHistory = reader.getByRole('dialog', { name: 'Lịch sử sửa' })
  await reader.getByRole('button', { name: 'Lịch sử', exact: true }).first().click()
  await expect(readerHistory).toBeVisible()
  await expect(readerHistory).toContainText('Tạo giao dịch')
  await expect(readerHistory.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0)
  await readerHistory.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(readerHistory).toHaveCount(0)
  await reader.goto(origin + '/admin'); await reader.waitForURL('**/dashboard')
  ok('read-only real login cannot see mutation/payment controls, can still read history, and cannot access admin page')
  // Ca 2: giả mạo vai trò khi gọi thẳng server action. Dùng lại đúng request "Thêm đơn vị"
  // đã bắt được từ phiên admin, thêm một trường vai_tro=admin vào body, rồi gửi bằng cookie
  // của tài khoản chi_doc. Quyền phải được đọc từ phiên máy chủ, không phải từ body.
  const captured = adminActions.find(action => action.body.includes('E2E Synthetic Unit Two'))
  assert.ok(captured, 'expected to capture the real admin add-unit server action request')
  function chenTruong(body, contentType, ten, giaTri) {
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '')
    const boundary = match?.[1] ?? match?.[2]?.trim()
    assert.ok(boundary, 'multipart boundary must be present to append a forged field')
    const ket = `--${boundary}--`
    const phan = `--${boundary}\r\nContent-Disposition: form-data; name="${ten}"\r\n\r\n${giaTri}\r\n`
    assert.ok(body.includes(ket), 'multipart body must end with the closing boundary')
    return body.replace(ket, phan + ket)
  }
  const gui = (target, body) => target.request.post(captured.url, {
    headers: { 'next-action': captured.headers['next-action'], 'content-type': captured.headers['content-type'] },
    data: body, failOnStatusCode: false,
  })
  const demDonVi = async () => (await pool.query('select count(*)::int n from don_vi')).rows[0].n
  const demLichSu = async () => (await pool.query('select count(*)::int n from lich_su')).rows[0].n
  const soDonVi = await demDonVi(), soLichSu = await demLichSu()
  const forged = await gui(readerContext, chenTruong(captured.body, captured.headers['content-type'], 'vai_tro', 'admin'))
  assert.notEqual(forged.status(), 200, `forged chi_doc action call must not succeed (got ${forged.status()})`)
  // Thông báo thành công của action không được xuất hiện trong phản hồi, kể cả ở dạng payload RSC.
  assert.ok(!(await forged.text()).includes('Đã thêm đơn vị'), 'forged chi_doc action call must not report success')
  assert.equal(await demDonVi(), soDonVi, 'forged chi_doc action call must not insert a unit')
  assert.equal(await demLichSu(), soLichSu, 'forged chi_doc action call must not write audit rows')
  // Đối chứng: đúng request đó, không thêm trường giả, gửi bằng phiên admin thì phải chèn được,
  // chứng minh việc bị chặn ở trên là do vai trò chứ không phải do request hỏng.
  const bodyAdmin = captured.body.replace('E2E Synthetic Unit Two', 'E2E Synthetic Unit Three')
  assert.notEqual(bodyAdmin, captured.body, 'control request must target a different unit name')
  const control = await gui(ctx, bodyAdmin)
  assert.equal(control.status(), 200, `admin control call must succeed (got ${control.status()})`)
  await expect.poll(demDonVi).toBe(soDonVi + 1)
  assert.equal((await pool.query('select count(*)::int n from don_vi where ten=$1', ['E2E Synthetic Unit Three'])).rows[0].n, 1)
  ok('forged vai_tro field on a real server-action request is ignored; identical request succeeds for the admin session')
  // Giấy đề nghị: cấu hình lưu ở /cai-dat, mẫu Word thật trong Mau/, dữ liệu thật từ cơ sở
  // dữ liệu. Đây là chỗ duy nhất chạm tới cả ba thứ đó cùng lúc, nên nó bắt được cả lỗi
  // đường dẫn HTTP, lỗi mẫu không tìm thấy trên đĩa lẫn lỗi cấu hình không tới được giấy.
  await page.goto(origin + '/cai-dat')
  const formGiay = page.locator('form').filter({ has: page.getByRole('button', { name: 'Lưu thông tin giấy', exact: true }) })
  for (const [key, value] of Object.entries({ ten_don_vi: 'Trung tâm Tin học E2E', dia_danh: 'Đà Nẵng', ly_do_tam_ung: 'Công tác phí E2E', thoi_han_thanh_toan: 'Trong 30 ngày' })) await formGiay.locator(`[name="${key}"]`).fill(value)
  await formGiay.locator('[name="nguoi_lay_hd_mac_dinh"]').selectOption(collector.id)
  await formGiay.locator('[name="trang_thai_tt_phi_mac_dinh"]').selectOption('Chưa thanh toán')
  await formGiay.getByRole('button', { name: 'Lưu thông tin giấy', exact: true }).click()
  await expect(formGiay.getByRole('status')).toBeVisible()
  await expect(formGiay.locator('[name="nguoi_lay_hd_mac_dinh"]')).toHaveValue(collector.id)
  await expect(formGiay.locator('[name="trang_thai_tt_phi_mac_dinh"]')).toHaveValue('Chưa thanh toán')
  const cauHinhGiay = Object.fromEntries((await pool.query("select khoa, gia_tri from cau_hinh where khoa like 'giay\\_%'")).rows.map(r => [r.khoa, r.gia_tri]))
  assert.equal(cauHinhGiay.giay_ten_don_vi, 'Trung tâm Tin học E2E')
  assert.equal(cauHinhGiay.giay_dia_danh, 'Đà Nẵng')
  assert.equal(cauHinhGiay.giay_ly_do_tam_ung, 'Công tác phí E2E')
  assert.equal(cauHinhGiay.giay_thoi_han_thanh_toan, 'Trong 30 ngày')
  assert.equal(cauHinhGiay.giay_nguoi_lay_hd_mac_dinh, collector.id)
  assert.equal(cauHinhGiay.giay_trang_thai_tt_phi_mac_dinh, 'Chưa thanh toán')
  // Chưa chọn người ký nào nhưng khóa vẫn phải ghi đủ năm vai trò, nếu không thì lần lưu
  // sau sẽ làm rơi mất vai trò đã đặt trước đó.
  assert.deepEqual(Object.keys(cauHinhGiay.giay_nguoi_ky_mac_dinh).sort(), ['keToanKiemSoatId', 'lanhDaoThanhToanId', 'lanhDaoTiepKhachId', 'nguoiDeNghiId', 'truongPhongId'])
  assert.ok(Object.values(cauHinhGiay.giay_nguoi_ky_mac_dinh).every(v => v === null))
  await page.reload()
  await expect(page.locator('[name="ten_don_vi"]')).toHaveValue('Trung tâm Tin học E2E')
  await expect(page.locator('[name="nguoi_lay_hd_mac_dinh"]')).toHaveValue(collector.id)
  await expect(page.locator('[name="trang_thai_tt_phi_mac_dinh"]')).toHaveValue('Chưa thanh toán')
  ok('paper settings persist in PostgreSQL, survive reload and keep every configured value')
  // Liên kết tài khoản nhận tiền với cán bộ đề nghị, không dùng người mặc định để đoán.
  const adminId = (await pool.query("select id from nguoi_dung where ten_dang_nhap='e2e_admin'")).rows[0].id
  const requesterId = (await pool.query("insert into can_bo (ho_ten,nguoi_dung_id) values ('Synthetic E2E Admin',$1) returning id", [adminId])).rows[0].id
  await pool.query('update nguoi_lay_hd set can_bo_id=$1 where id=$2', [requesterId, collector.id])
  // Giao dịch cơ quan trả thẳng bằng chuyển khoản: giấy phải in kèm tài khoản nhận tiền.
  await page.goto(origin + '/giao-dich')
  const dialogTraThang = await openForm('Cơ quan trả thẳng', '')
  await expect(dialogTraThang.locator('[name="nguoi_lay_hd_id"]')).toHaveValue(collector.id)
  await expect(dialogTraThang.getByLabel('Trạng thái thanh toán phí')).toHaveValue('Chưa thanh toán')
  await dialogTraThang.getByLabel('Tổng tiền (VND)', { exact: false }).fill('1700000')
  await dialogTraThang.locator('[name="so_hd"]').fill('E2E02')
  await dialogTraThang.locator('[name="nguoi_lay_hd_id"]').selectOption(collector.id)
  await dialogTraThang.getByLabel('In trên giấy đề nghị *').selectOption('chuyen_khoan')
  await dialogTraThang.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
  await expect(dialogTraThang).toHaveCount(0)
  const traThang = (await pool.query('select * from giao_dich where so_hd=$1', ['E2E02'])).rows[0]
  assert.equal(traThang.hinh_thuc, 'Cơ quan trả thẳng'); assert.equal(traThang.hinh_thuc_thanh_toan, 'chuyen_khoan')
  assert.equal(traThang.nguoi_lay_hd_id, collector.id)
  // Đọc tệp .docx thật bằng chính bộ đọc ZIP của ứng dụng, rồi gộp text từng đoạn như Word.
  const { docZip } = await import(pathToFileURL(path.join(folder, 'lib/van-ban/zip.ts')).href)
  const boThe = xml => [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
    .map(p => [...p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(r => r[1]).join('')).join('\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
  async function taiGiay(id, loai) {
    const res = await ctx.request.get(`${origin}/giay/${id}/${loai}`)
    const buf = Buffer.from(await res.body())
    return { status: res.status(), ten: res.headers()['content-disposition'] ?? '', chu: boThe(docZip(buf).find(m => m.ten === 'word/document.xml')?.duLieu.toString('utf8') ?? '') }
  }
  const giayThanhToan = await taiGiay(traThang.id, 'thanh_toan')
  assert.equal(giayThanhToan.status, 200)
  // Tên tệp có dấu tiếng Việt nên phải nằm ở dạng RFC 5987 mới tải về đúng tên.
  assert.ok(giayThanhToan.ten.includes(`filename*=UTF-8''${encodeURIComponent('Giấy đề nghị thanh toán 2026-09-16 E2E02.docx')}`), `tên tệp sai: ${giayThanhToan.ten}`)
  assert.ok(giayThanhToan.chu.includes('TRUNG TÂM TIN HỌC E2E'), 'giấy phải in tên đơn vị theo cấu hình')
  assert.ok(giayThanhToan.chu.includes('Đà Nẵng, ngày 16 tháng 9 năm 2026'), 'địa danh và ngày phải theo dữ liệu thật')
  assert.ok(giayThanhToan.chu.includes('2. Số tiền đề nghị thanh toán: 1.700.000 đồng'), 'số thanh toán phải bằng tổng tiền trừ rượu bia')
  assert.ok(giayThanhToan.chu.includes('3. Hình thức thanh toán: Chuyển khoản – Số tài khoản: 000000000001 – Ngân hàng: Ngân hàng TMCP Công thương Việt Nam – Chi nhánh: Chi nhánh E2E – Chủ tài khoản: Synthetic E2E Admin.'), 'chuyển khoản phải in kèm tài khoản của người lấy hóa đơn')
  assert.ok(giayThanhToan.chu.includes('số E2E02, ngày 16/9/2026'), 'phải in số và ngày hóa đơn thật')
  assert.ok(!giayThanhToan.chu.includes('[['), 'không được còn chỗ trống nào chưa điền')
  const giayTiepKhach = await taiGiay(traThang.id, 'tiep_khach')
  assert.equal(giayTiepKhach.status, 200)
  assert.ok(giayTiepKhach.chu.includes('Kinh phí dự kiến: 2.000.000đ'), 'kinh phí dự kiến phải làm tròn lên hàng 500.000')
  assert.ok(giayTiepKhach.chu.includes('(Bằng chữ: Hai triệu đồng)'), 'kinh phí phải có phần đọc số')
  assert.ok(!giayTiepKhach.chu.includes('[['))
  // Giấy tạm ứng của giao dịch tạm ứng: số tiền lấy từ cơ quan, hai ô vuông theo hình thức.
  const giayTamUng = await taiGiay(advance.id, 'tam_ung')
  assert.equal(giayTamUng.status, 200)
  assert.ok(giayTamUng.chu.includes('Số tiền đề nghị tạm ứng: 100.000 đ'), 'số tạm ứng phải lấy từ cơ quan')
  assert.ok(giayTamUng.chu.includes('Lý do tạm ứng: Công tác phí E2E.'), 'lý do tạm ứng phải theo cấu hình')
  assert.ok(giayTamUng.chu.includes('Hình thức tạm ứng: ☐ Chuyển khoản ☒ Tiền mặt.'), 'hai ô vuông phải theo hình thức thanh toán')
  assert.ok(giayTamUng.chu.includes('Đà Nẵng, ngày 20 tháng 9 năm 2026'), 'ngày trên giấy phải theo ngày phát sinh sau khi sửa')
  assert.ok(!giayTamUng.chu.includes('[['))
  // Hình thức nội bộ và giấy không thuộc hình thức đó đều không sinh ra tệp.
  assert.equal((await ctx.request.get(`${origin}/giay/${advance.id}/thanh_toan`)).status(), 404)
  // Người chưa đăng nhập bị hàng rào chuyển hướng về trang đăng nhập trước khi tới được tệp.
  const anon = await browser.newContext()
  const anonRes = await anon.request.get(`${origin}/giay/${advance.id}/tam_ung`, { maxRedirects: 0 })
  assert.equal(anonRes.status(), 307)
  assert.ok((anonRes.headers()['location'] ?? '').includes('/dang-nhap'), 'phải chuyển hướng về trang đăng nhập')
  assert.ok(!String(anonRes.headers()['content-type'] ?? '').includes('wordprocessingml'), 'không được trả tệp Word cho người chưa đăng nhập')
  await anon.close()
  ok('real Word templates download as filled .docx with configured values, and a wrong paper or an anonymous caller is refused')
  // Trang giấy chỉ mời tải tệp Word, không mô phỏng trang in bằng HTML.
  await page.goto(`${origin}/giay/${traThang.id}`)
  await expect(page.getByRole('heading', { name: 'Giấy đề nghị tiếp khách', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Giấy đề nghị thanh toán', exact: true })).toBeVisible()
  await expect(page.locator('.giay-a4')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /In.*PDF/ })).toHaveCount(0)
  const taiThanhToan = page.getByRole('link', { name: 'Tải .docx — Giấy đề nghị thanh toán', exact: true })
  await expect(taiThanhToan).toHaveAttribute('href', `/giay/${traThang.id}/thanh_toan`)
  const choTai = page.waitForEvent('download')
  await taiThanhToan.click()
  const download = await choTai
  assert.equal(await download.failure(), null)
  assert.ok(download.suggestedFilename().endsWith('.docx'))
  const stream = await download.createReadStream()
  assert.ok(stream)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const downloaded = Buffer.concat(chunks)
  assert.ok(downloaded.length > 0)
  assert.ok(docZip(downloaded).some(m => m.ten === 'word/document.xml'))
  await page.goto(`${origin}/giay/${advance.id}`)
  await expect(page.getByRole('link', { name: 'Tải .docx — Giấy đề nghị tạm ứng', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tải .docx — Giấy đề nghị thanh toán', exact: true })).toHaveCount(0)
  ok('paper page downloads a nonempty valid DOCX through the browser and no longer offers HTML printing')
  await lapGiayE2E({ page, pool, origin, folder, openForm, docZip, ok, realOffice })
  await office.run({ ctx, pool, origin, folder, id: advance.id, admin, ok, readerContext })
  assert.deepEqual(external, [])
  ok('no browser external network/payment calls attempted')
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2))
} catch (error) {
  console.error(error)
  console.error('Isolated Next log (synthetic environment only):\n' + serverLog.slice(-12000))
  process.exitCode = 1
} finally {
  await office?.close().catch(() => {})
  await browser?.close().catch(() => {})
  if (server?.pid && server.exitCode === null) {
    try { if (process.platform === 'win32') command('taskkill', ['/PID', String(server.pid), '/T', '/F']); else server.kill('SIGTERM') } catch { /* process already exited */ }
  }
  await pool?.end().catch(() => {})
  if (containerId) { try { command('docker', ['rm', '--force', containerId]); console.log('CLEANUP owned disposable PostgreSQL removed') } catch (error) { console.error('Cleanup container failed', error); process.exitCode = 1 } }
  if (folder) {
    // Remove junction first so recursive cleanup cannot traverse shared dependencies.
    await rm(path.join(folder, 'node_modules'), { force: true, recursive: true }).catch(() => {})
    await rm(folder, { force: true, recursive: true, maxRetries: 6, retryDelay: 500 }).catch(error => { console.error('Cleanup isolated source failed', error); process.exitCode = 1 })
    console.log('CLEANUP owned isolated source directory removed')
  }
}
