import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Chỉ gọi sau khi runner đã xác minh danh tính PostgreSQL dùng một lần.
export async function lapGiayE2E({ page, pool, origin, folder, openForm, docZip, ok }) {
  await page.goto(`${origin}/giao-dich`)
  let dialog = await openForm('Tạm ứng thêm', 'E2E checkbox paper')
  await dialog.getByLabel('Tạm ứng từ cơ quan (VND)').fill('250000')
  await dialog.getByLabel('Tự lập giấy khi lưu giao dịch').check()
  await expect(dialog.locator('[aria-label="Xem trước thông tin lập giấy"]')).toContainText('250.000')
  await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const gd = (await pool.query('select id from giao_dich where noi_dung=$1', ['E2E checkbox paper'])).rows[0]
  const link = page.getByRole('link', { name: 'Mở giấy của giao dịch vừa lưu' })
  await expect(link).toHaveAttribute('href', `/giay/${gd.id}`)
  const docs = (await pool.query('select * from tai_lieu where giao_dich_id=$1', [gd.id])).rows
  assert.equal(docs.length, 1)
  const versions = (await pool.query('select * from tai_lieu_phien_ban where tai_lieu_id=$1', [docs[0].id])).rows
  assert.equal(versions.length, 1)
  const bytes = await readFile(path.join(folder, 'uploads', 'giay', `${docs[0].tep}.docx`))
  const text = docZip(bytes).find(e => e.ten === 'word/document.xml').duLieu.toString().replace(/<[^>]*>/g, '')
  assert.ok(text.includes('250.000'))
  await link.click()
  const download = await page.request.get(`${origin}/giay/${gd.id}/tam_ung`)
  assert.equal(download.status(), 200)
  assert.deepEqual(await download.body(), bytes)
  ok('paper checkbox preview creates committed DOCX version with the new transaction and returns its link')

  await pool.query(`create function e2e_reject_second_paper() returns trigger language plpgsql as $$
    begin if NEW.loai='thanh_toan' then raise exception 'Synthetic paper persistence failure'; end if; return NEW; end $$;
    create trigger e2e_reject_second_paper before insert on tai_lieu for each row execute function e2e_reject_second_paper()`)
  try {
    await page.goto(`${origin}/giao-dich`)
    dialog = await openForm('Cơ quan trả thẳng', '')
    await dialog.getByLabel('Tổng tiền (VND)', { exact: false }).fill('300000')
    await dialog.locator('[name="so_hd"]').fill('E2E-SAVEPOINT')
    await dialog.getByLabel('Tự lập giấy khi lưu giao dịch').check()
    await dialog.getByRole('button', { name: 'Lưu giao dịch', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('p[role="alert"]')).toContainText('Không thêm lại giao dịch')
    const rows = (await pool.query('select id from giao_dich where so_hd=$1', ['E2E-SAVEPOINT'])).rows
    assert.equal(rows.length, 1)
    assert.equal((await pool.query('select count(*)::int n from tai_lieu where giao_dich_id=$1', [rows[0].id])).rows[0].n, 0)
    assert.equal((await pool.query('select count(*)::int n from tai_lieu_phien_ban p left join tai_lieu t on t.id=p.tai_lieu_id where t.id is null')).rows[0].n, 0)
    await expect(page.getByRole('link', { name: 'Mở giấy của giao dịch vừa lưu' })).toHaveAttribute('href', `/giay/${rows[0].id}`)
    ok('real SAVEPOINT rolls back both papers on second-paper failure while committing exactly one financial transaction')
  } finally {
    await pool.query('drop trigger e2e_reject_second_paper on tai_lieu; drop function e2e_reject_second_paper()')
  }
}
