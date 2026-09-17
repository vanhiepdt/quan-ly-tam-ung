// Real DocumentServer fixture. Only owns a disposable container, never production data.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect } from '@playwright/test'

export async function realOnlyofficeFixture({ appPort }) {
  const token = randomBytes(8).toString('hex'), secret = randomBytes(32).toString('hex')
  const name = `finance-office-e2e-${token}`
  const command = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 })
  let containerId
  async function close() {
    if (!containerId) return
    const inspection = JSON.parse(command(['inspect', containerId]))[0]
    assert.equal(inspection.Config.Labels['finance.office.e2e'], token)
    command(['rm', '--force', '--volumes', containerId])
    containerId = undefined
    console.log('CLEANUP owned disposable DocumentServer removed')
  }
  try {
    containerId = execFileSync('docker', ['run', '--detach', '--name', name,
      '--label', `finance.office.e2e=${token}`, '--publish', '127.0.0.1::80',
      '--env', 'JWT_SECRET', '--env', 'JWT_ENABLED=true',
      '--env', 'ALLOW_PRIVATE_IP_ADDRESS=true', 'onlyoffice/documentserver:9.4'],
    { encoding: 'utf8', timeout: 120000, env: { ...process.env, JWT_SECRET: secret } }).trim()
    const inspection = JSON.parse(command(['inspect', containerId]))[0]
    const binding = inspection.NetworkSettings.Ports['80/tcp'][0]
    assert.equal(binding.HostIp, '127.0.0.1')
    const address = `http://127.0.0.1:${binding.HostPort}`
    await expect.poll(async () => {
      try { const r = await fetch(`${address}/healthcheck`, { signal: AbortSignal.timeout(3000) }); return r.ok && (await r.text()) === 'true' } catch { return false }
    }, { timeout: 240000, intervals: [2000] }).toBe(true)
    console.log('READY real DocumentServer 9.4 on disposable loopback port')
    return {
      env: { ONLYOFFICE_JWT_SECRET: secret, ONLYOFFICE_PUBLIC_URL: address,
        ONLYOFFICE_INTERNAL_URL: address, ONLYOFFICE_APP_URL: `http://host.docker.internal:${appPort}` },
      address, close,
      async run({ ctx, pool, origin, folder, id, admin, ok, readerContext }) {
        const { docZip } = await import(pathToFileURL(path.join(folder, 'lib/van-ban/zip.ts')).href)
        const page = await ctx.newPage()
        page.setDefaultTimeout(60000)
        const row = async target => (await pool.query('select * from tai_lieu where id=$1', [target])).rows[0]
        const content = async target => {
          const current = await row(target)
          const bytes = await readFile(path.join(folder, 'uploads', 'giay', `${current.tep}.docx`))
          return { current, bytes, text: docZip(bytes).find(e => e.ten === 'word/document.xml').duLieu.toString().replace(/<[^>]*>/g, '') }
        }
        async function open(p, url) {
          const navigation = await p.goto(url)
          assert.equal(navigation.status(), 200, `Editor page ${new URL(url).pathname}`)
          const button = p.getByRole('button', { name: 'Mở trình soạn thảo', exact: true }).first()
          await expect(button, `Editor button on ${p.url()}`).toBeVisible()
          const [res] = await Promise.all([
            p.waitForResponse(r => r.url() === `${origin}/api/onlyoffice/mo` && r.request().method() === 'POST'),
            button.click(),
          ])
          assert.equal(res.status(), 200)
          const data = await res.json()
          await expect(p.locator('p[role="status"]').filter({ hasText: 'Đang mở phiên bản' })).toBeVisible({ timeout: 120000 })
          return data
        }
        async function closeEditor(p, target) {
          await p.getByRole('button', { name: 'Đóng trình soạn thảo', exact: true }).click()
          await expect.poll(async () => (await row(target)).khoa, { timeout: 120000, intervals: [1000] }).toBe(null)
        }
        async function edit(p, target, marker) {
          const before = await row(target)
          const frame = p.frameLocator('iframe').first()
          await frame.locator('#id_main').click({ position: { x: 400, y: 300 } })
          await p.keyboard.press('Control+End')
          await p.keyboard.press('Enter')
          await p.keyboard.insertText(marker)
          await p.keyboard.press('Control+s')
          await expect.poll(async () => (await content(target)).text, { timeout: 120000, intervals: [1000] }).toContain(marker)
          assert.ok((await row(target)).phien_ban > before.phien_ban)
          assert.equal((await row(target)).khoa, before.khoa, 'force-save keeps active session key')
        }
        const url = `${origin}/giay/${id}`
        const first = await open(page, url)
        const target = (await pool.query('select id from tai_lieu where giao_dich_id=$1 and loai=$2', [id, 'tam_ung'])).rows[0].id
        const marker = `REAL-OFFICE-${token}`
        await edit(page, target, marker)
        await closeEditor(page, target)
        const saved = await content(target)
        const download = await ctx.request.get(`${origin}/giay/${id}/tam_ung`)
        assert.equal(download.status(), 200)
        assert.deepEqual(await download.body(), saved.bytes)
        const reopened = await open(page, url)
        assert.notEqual(reopened.config.document.key, first.config.document.key)
        assert.equal(reopened.phienBan, saved.current.phien_ban)
        await closeEditor(page, target)
        ok('real DocumentServer: keyboard edit, force-save, final callback, identical DOCX download and reopen')
        const template = 'Tam ung tien.docx'
        const original = await readFile(path.join(folder, 'Mau', template))
        await open(page, `${origin}/cai-dat/mau/${encodeURIComponent(template)}`)
        const templateId = (await pool.query('select id from tai_lieu where ten_mau=$1', [template])).rows[0].id
        await edit(page, templateId, `TEMPLATE-${token}`)
        await closeEditor(page, templateId)
        assert.deepEqual(await readFile(path.join(folder, 'Mau', template)), original)
        const templateDownload = await ctx.request.get(`${origin}/api/onlyoffice/mau?ten=${encodeURIComponent(template)}`)
        assert.equal(templateDownload.status(), 200)
        assert.deepEqual(await templateDownload.body(), (await content(templateId)).bytes)
        ok('real DocumentServer: administrator saves template without overwriting original')
        const reader = await readerContext.newPage()
        const beforeView = await row(target)
        const view = await open(reader, url)
        assert.equal(view.config.editorConfig.mode, 'view')
        assert.equal(view.config.document.permissions.edit, false)
        await reader.getByRole('button', { name: 'Đóng trình soạn thảo', exact: true }).click()
        await expect(reader.locator('iframe')).toHaveCount(0)
        assert.equal((await row(target)).phien_ban, beforeView.phien_ban)
        assert.deepEqual((await content(target)).bytes, saved.bytes)
        await reader.close()
        // A view-only session may not send status 4. It must not prevent the next editor session.
        const afterView = await open(page, url)
        assert.equal(afterView.config.editorConfig.mode, 'edit')
        await closeEditor(page, target)
        assert.equal((await row(target)).phien_ban, beforeView.phien_ban)
        await page.close()
        ok('real DocumentServer: read-only viewer preserves DOCX and version; administrator can reopen and close')
      },
    }
  } catch (error) { await close(); throw error }
}
