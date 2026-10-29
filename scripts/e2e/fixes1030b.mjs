// 学生の試し 4回目の B（見た目が変わる直し。依頼者の選択 mockups/v77：① 案A・② 案A・③ 案A）。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030b
// ① Esc で閉じたあとも「図を入れる」「表を入れる」を押せる（さっき書いていた所に入れる。道具の上に「さっき書いていた所に入れます」）
// ② はじめての案内のコースを選ぶ画面の「バックアップから戻す」で、バックアップファイルから戻せる（戻したら案内を閉じる）
// ③ キーボードで移ったときの枠は、黄色の太い枠（3px）
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, { sample = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1366, height: 768 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  if (sample) {
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(600)
    await ready()
  }
  return { context, page, ready }
}
const tool = (page, label) => page.evaluate((label) => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes(label)); return b ? { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' } : null }, label)

const DOWNLOADS = mkdtempSync(join(tmpdir(), 'sotsugyo-e2e-backup-'))

await withEdge(async (browser) => {
  // ---- ① Esc のあとも、さっき書いていた所に図・表を入れる ----
  let backupFile = null
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p6', 6))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await wait(400)
    await page.keyboard.press('Escape')
    await wait(900)
    await ready()
    const after = { figure: await tool(page, '図を入れる'), table: await tool(page, '表を入れる'), note: await page.evaluate(() => document.querySelector('.palette .ctx-note.resume')?.textContent ?? '') }
    check('Esc で閉じたあとも「図を入れる」「表を入れる」を押せて、道具の上に「さっき書いていた所に入れます」', after.figure && !after.figure.disabled && after.table && !after.table.disabled && after.note === 'さっき書いていた所に入れます', JSON.stringify(after))
    // 表を入れる → いつもの大きさ（Enter）：p6 のすぐ下に表が入り、表のタイトルを書き始める
    const before = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => b.id))
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('表を入れる')).click())
    await page.waitForSelector('.table-menu .tgrid button', { timeout: 10000 })
    await page.keyboard.press('Enter')
    await wait(1500)
    await ready()
    const placed = await page.evaluate((before) => {
      const s = window.__editor.getSnapshot()
      const ids = s.report.body.flatMap((c) => c.blocks).map((b) => b.id)
      const added = ids.find((id) => !before.includes(id))
      return { added, after: ids[ids.indexOf(added) - 1], kind: s.editingKind, ref: s.report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p6')?.content.some((n) => n.type === 'ref') }
    }, before)
    check('そのまま「表を入れる」→ Enter で、さっき書いていた段落のすぐ下に表が入り（本文に（表n）も入る）、表のタイトルを書き始める', !!placed.added && placed.after === 'p6' && placed.kind === 'tableCaption' && placed.ref, JSON.stringify(placed))
    await page.keyboard.press('Escape')
    await wait(600)
    await ready()

    // ③ キーボードで移ったときの枠（黄色の 3px）
    await page.evaluate(() => document.activeElement?.blur())
    await page.evaluate(() => document.querySelector('.side .export').focus({ focusVisible: true }))
    await wait(200)
    const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { color: cs.outlineColor, width: cs.outlineWidth, style: cs.outlineStyle } })
    check('キーボードで移ったときの枠は、黄色の太い枠（3px）', ring.color === 'rgb(242, 183, 5)' && ring.width === '3px' && ring.style === 'solid', JSON.stringify(ring))

    // ② のためにバックアップファイルを保存しておく
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS, browserContextId: context.id })
    await page.evaluate(() => document.querySelector('.side .menu-btn').click())
    await page.waitForSelector('[role=menuitem]', { timeout: 10000 })
    await page.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].find((b) => b.textContent.includes('バックアップ'))?.click())
    await page.waitForSelector('.backup-modal .backup-save', { timeout: 10000 })
    await page.waitForFunction(() => !document.querySelector('.backup-modal .busy-line'), { timeout: 10000 })
    await page.evaluate(() => document.querySelector('.backup-modal .backup-save').click())
    for (let i = 0; i < 80 && !backupFile; i++) {
      const files = existsSync(DOWNLOADS) ? readdirSync(DOWNLOADS).filter((f) => f.endsWith('.json')).map((f) => join(DOWNLOADS, f)).filter((f) => statSync(f).size > 0) : []
      backupFile = files[0] ?? null
      await wait(250)
    }
    await context.close()
  }

  // ---- ② はじめての案内のコースを選ぶ画面から、バックアップファイルで戻す ----
  {
    const { context, page, ready } = await open(browser, { sample: false })
    const link = await page.evaluate(() => [...document.querySelectorAll('.guide .g-backup button')].map((b) => b.textContent))
    let restored = null
    if (backupFile) {
      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(() => document.querySelector('.guide .g-backup button').click())])
      await chooser.accept([backupFile])
      await page.waitForFunction(() => !document.querySelector('.guide'), { timeout: 30000 }).catch(() => {})
      await wait(800)
      await ready()
      restored = await page.evaluate(() => ({ guide: !!document.querySelector('.guide'), p6: window.__editor.getSnapshot().report.body.some((c) => c.blocks.some((b) => b.id === 'p6')), toast: document.querySelector('.undo-toast')?.textContent ?? '' }))
    }
    check('コースを選ぶ画面の「バックアップから戻す」でバックアップファイルを選ぶと、原稿が戻り、案内が閉じる', link.join() === 'バックアップから戻す' && !!backupFile && !!restored && !restored.guide && restored.p6 && restored.toast.includes('バックアップファイルから戻しました'), JSON.stringify({ link, backupFile: !!backupFile, restored }))
    await context.close()
  }
})
rmSync(DOWNLOADS, { recursive: true, force: true })

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
