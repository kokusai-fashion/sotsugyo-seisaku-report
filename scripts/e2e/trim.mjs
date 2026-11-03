// トリミングの窓（依頼者の選択 2026-11-03、mockups/v94 案2）：本文の図は形を選んで範囲を決め、作品写真は枠の形のまま大きさと位置を決める。
// これだけを流すときは node scripts/e2e/run.mjs trim
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

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1440, height: 900 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(600)
  await ready()
  const settle = async () => {
    await wait(1200)
    await ready()
  }
  const clickTool = (label) => page.evaluate((label) => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.replace(/\s/g, '') === label)?.click(), label)
  const figureOf = (id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures : [])).find((f) => f.id === id), id)

  // ---- 本文の図：縦長にする ----
  await page.evaluate(() => { const i = window.__editor.pageElements().findIndex((p) => p.querySelector('[data-figure-id="f1"]')); return window.__editor.goToPage(i, 'none') })
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'figure', id: 'f1' }))
  await wait(400)
  const toolShown = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].some((b) => b.textContent.includes('トリミング')))
  check('図を選ぶと、道具に「トリミング」が出る', toolShown)
  await clickTool('トリミング')
  await page.waitForSelector('.trim-modal .trim-frame', { timeout: 10000 }).catch(() => {})
  const opened = await page.evaluate(() => ({ title: document.querySelector('.trim-modal h2')?.textContent, shapes: [...document.querySelectorAll('.trim-shapes button')].map((b) => b.textContent), on: document.querySelector('.trim-shapes button.on')?.textContent }))
  check('「トリミング」で窓が開き、形（元の形・縦長・正方形・横長・自由）を選べる。はじめは「元の形」', opened.title?.startsWith('トリミング（図') && opened.shapes.join() === '元の形,縦長,正方形,横長,自由' && opened.on === '元の形', JSON.stringify(opened))
  await page.evaluate(() => [...document.querySelectorAll('.trim-shapes button')].find((b) => b.textContent === '縦長').click())
  await wait(200)
  const frame = await page.evaluate(() => { const r = document.querySelector('.trim-frame').getBoundingClientRect(); return { w: r.width, h: r.height } })
  check('「縦長」を押すと、枠が縦長（3:4）になる', Math.abs(frame.w / frame.h - 0.75) < 0.02, JSON.stringify(frame))
  await page.evaluate(() => document.querySelector('.trim-apply').click())
  await settle()
  const cropped = await figureOf('f1')
  const modalGone = await page.evaluate(() => !document.querySelector('.trim-modal'))
  const box = await page.evaluate(() => { const e = document.querySelector('.page-viewport.front [data-figure-id="f1"] .fig-crop'); return e ? { w: parseFloat(e.style.width), h: parseFloat(e.style.height) } : null })
  check('「これで決める」で、図の範囲が原稿に入り、紙面の図が縦長になる（図は切り抜いて出す）', !!cropped?.crop && !!box && Math.abs(box.w / box.h - 0.75) < 0.02 && modalGone, JSON.stringify({ crop: cropped?.crop, box }))
  await page.evaluate(() => window.__editor.undo())
  await settle()
  check('元に戻すと、トリミングする前（写真の全体）に戻る', !(await figureOf('f1'))?.crop)

  // ---- 作品写真：枠を小さくして大きく写す ----
  const photosPage = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.indexOf('photos'))
  await page.evaluate((p) => window.__editor.goToPage(p, 'none'), photosPage)
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'photos', page: 0, index: 0 }))
  await wait(400)
  await clickTool('トリミング')
  await page.waitForSelector('.trim-modal .trim-frame', { timeout: 10000 }).catch(() => {})
  const photoDialog = await page.evaluate(() => ({ shapes: document.querySelectorAll('.trim-shapes').length, title: document.querySelector('.trim-modal h2')?.textContent }))
  check('作品写真の「トリミング」：枠の形は選ばない（紙面の枠の形のまま）', photoDialog.shapes === 0 && photoDialog.title === 'トリミング（1枚目の写真）', JSON.stringify(photoDialog))
  // 右下のつまみを、左上へ大きく動かす（枠を小さくする＝大きく写す）
  const handle = await page.evaluate(() => { const r = document.querySelector('.trim-handle.se').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x - 80, handle.y - 80, { steps: 6 })
  await page.mouse.up()
  await wait(200)
  await page.evaluate(() => document.querySelector('.trim-apply').click())
  await settle()
  const photo = await page.evaluate(() => ({ position: window.__editor.getSnapshot().report.workPhotos[0].positions?.[0], style: document.querySelector('.page-viewport.front [data-photo-slot="0"] img')?.getAttribute('style') ?? '' }))
  check('枠を小さくして決めると、写真が大きく写る（倍率が原稿に入り、紙面の写真が大きくなる）', (photo.position?.zoom ?? 1) > 1.1 && /transform:scale\(/.test(photo.style), JSON.stringify(photo))

  await context.close()
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
