// Simulated DocumentServer transport; real application HTTP, PostgreSQL and files.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHmac, createHash, randomBytes } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect } from '@playwright/test'

export async function onlyofficeFixture() {
  let content = Buffer.alloc(0)
  const secret = randomBytes(32).toString('hex')
  const server = createServer((req, res) => {
    if (req.url !== '/cache/edited.docx') { res.writeHead(404).end(); return }
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    res.end(content)
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = `http://127.0.0.1:${server.address().port}`
  const sign = body => {
    const data = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(body)).toString('base64url')}`
    return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`
  }
  return {
    env: { ONLYOFFICE_JWT_SECRET: secret, ONLYOFFICE_PUBLIC_URL: address, ONLYOFFICE_INTERNAL_URL: address },
    close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }),
    async run({ ctx, pool, origin, folder, id, admin, ok }) {
      const { docZip, ghiZip } = await import(pathToFileURL(path.join(folder, 'lib/van-ban/zip.ts')).href)
      const open = async () => {
        const res = await ctx.request.post(`${origin}/api/onlyoffice/mo`, { headers: { origin }, data: { id, loai: 'tam_ung' } })
        assert.equal(res.status(), 200, `open document: ${await res.text()}`)
        return res.json()
      }
      const first = await open(), config = first.config
      assert.equal(first.phienBan, 1)
      const originalRes = await fetch(config.document.url)
      assert.equal(originalRes.status, 200)
      const original = Buffer.from(await originalRes.arrayBuffer())
      content = ghiZip(docZip(original).map(m => m.ten === 'word/document.xml'
        ? { ...m, duLieu: Buffer.from(m.duLieu.toString().replace('</w:body>', '<w:p><w:r><w:t>ONLYOFFICE-E2E-SAVED</w:t></w:r></w:p></w:body>')) } : m))
      assert.notDeepEqual(content, original)
      const current = (await pool.query('select * from tai_lieu where giao_dich_id=$1 and loai=$2', [id, 'tam_ung'])).rows[0]
      const dir = path.join(folder, 'uploads', 'giay')
      const filesBefore = await readdir(dir)
      const callback = () => fetch(config.editorConfig.callbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sign({ key: config.document.key, status: 2, url: `${address}/cache/edited.docx` }) }), signal: AbortSignal.timeout(60000) })
      const blocker = await pool.connect()
      let pending, settled = false
      try {
        await blocker.query('begin')
        await blocker.query('lock table tai_lieu_phien_ban in share mode')
        pending = callback().then(res => { settled = true; return res })
        await expect.poll(async () => (await pool.query("select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'insert into tai_lieu_phien_ban%'")).rows[0].n, { timeout: 30000 }).toBe(1)
        assert.equal(settled, false, 'callback must wait for persistence')
        const before = (await pool.query('select phien_ban,tep from tai_lieu where id=$1', [current.id])).rows[0]
        assert.equal(before.phien_ban, 1)
        assert.equal(before.tep, current.tep)
        const newFiles = (await readdir(dir)).filter(f => !filesBefore.includes(f))
        assert.equal(newFiles.length, 1)
        assert.deepEqual(await readFile(path.join(dir, newFiles[0])), content)
      } finally {
        await blocker.query('rollback')
        blocker.release()
        if (pending) await pending
      }
      const response = await pending
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { error: 0 })
      const saved = (await pool.query('select * from tai_lieu where id=$1', [current.id])).rows[0]
      assert.equal(saved.phien_ban, 2)
      assert.equal(saved.khoa, null)
      assert.notEqual(saved.tep, current.tep)
      assert.deepEqual(await readFile(path.join(dir, `${saved.tep}.docx`)), content)
      assert.deepEqual(await readFile(path.join(dir, `${current.tep}.docx`)), original)
      const versions = (await pool.query('select * from tai_lieu_phien_ban where tai_lieu_id=$1 order by phien_ban', [current.id])).rows
      assert.equal(versions.length, 2)
      assert.equal(versions[1].nguoi_luu, admin)
      assert.equal(versions[1].sha256, createHash('sha256').update(content).digest('hex'))
      const repeat = await callback()
      assert.equal(repeat.status, 200)
      assert.deepEqual(await repeat.json(), { error: 0 })
      assert.equal((await pool.query('select count(*)::int n from tai_lieu_phien_ban where tai_lieu_id=$1', [current.id])).rows[0].n, 2)
      const reopened = await open()
      assert.equal(reopened.phienBan, 2)
      assert.notEqual(reopened.config.document.key, config.document.key)
      const file = await fetch(reopened.config.document.url)
      assert.equal(file.status, 200)
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), content)
      const download = await ctx.request.get(`${origin}/giay/${id}/tam_ung`)
      assert.equal(download.status(), 200)
      assert.deepEqual(await download.body(), content)
      const unsigned = await fetch(config.editorConfig.callbackUrl, { method: 'POST', body: '{"token":"invalid"}' })
      assert.equal(unsigned.status, 403)
      ok('OnlyOffice simulated transport: authenticated open, signed fetch, callback waits for DB commit, immutable versions and reopen persist edits')
    },
  }
}
