// スマホ：直すところ（× エラー）の知らせ（mockups/v88 案1。依頼者 2026-11-02：スマホで書く学生は、下の「チェック」の小さな赤い数と
// 紙面の赤い線に気づきにくい。画面に同時に出す知らせは1つだけ）。
// これだけを流すときは node scripts/e2e/run.mjs phoneErrorStrip
// ・書いていない間：エラーがあるあいだ、下のタブの上に帯「直すところが n か所　チェックで見る ›」。押すとチェックの欄。
//   下の「チェック」には赤い数を出さない。帯の分だけ紙面の枠が低くなり、ページ送りは帯の上
// ・書いている間：帯は隠し（場所は取ったまま）、キーボードの上の道具に、その段落の直すところを1行（打つ手を止めてから）。直すと消える
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

/** 帯・1行・下の「チェック」・ページ送りの様子 */
const state = (page) =>
  page.evaluate(() => {
    const strip = document.querySelector('.err-strip')
    const pager = document.querySelector('.pager')?.getBoundingClientRect()
    const stripRect = strip?.getBoundingClientRect()
    const nav = document.querySelector('.p-nav').getBoundingClientRect()
    return {
      strip: strip ? { text: strip.querySelector('b')?.textContent ?? '', go: strip.querySelector('.go')?.textContent ?? '', hidden: getComputedStyle(strip).visibility === 'hidden', top: stripRect.top, bottom: stripRect.bottom } : null,
      issue: document.querySelector('.direct-bar .db-issue')?.textContent ?? null,
      redBadge: !!document.querySelector('.p-nav .badge:not(.warn-dot)'),
      navTop: nav.top,
      pagerBottom: pager ? pager.bottom : null,
      stageH: document.querySelector('.stage').getBoundingClientRect().height,
      editing: window.__editor.getSnapshot().editingId,
    }
  })
const textOf = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content.map((n) => n.text ?? '').join(''), id)

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setUserAgent(IPHONE)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !s.pageChecksPending && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(800)
  await ready()

  // 本文の最初の段落で試す
  const id = await page.evaluate(() => window.__editor.getSnapshot().report.body[0].blocks.find((b) => b.type === 'paragraph').id)
  const original = await textOf(page, id)
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await wait(400)
  const clean = await state(page)
  check('直すところがない原稿では、帯も、下の「チェック」の赤い数も出ない', !clean.strip && !clean.redBadge, JSON.stringify(clean))

  // ---- 書いている間：です・ます調の文を書き足す ----
  await page.evaluate((id, len) => window.__editor.openEditor(id, len), id, original.length)
  await page.waitForFunction((id) => { const s = window.__editor.getSnapshot(); return s.editingId === id && s.onPaper }, { timeout: 20000 }, id)
  await wait(500)
  await page.keyboard.type('この色は好きです。', { delay: 60 })
  await wait(250)
  const typing = await state(page)
  check('打っている途中は、キーボードの上の1行を出さない（手を止めてから）', typing.issue === null, JSON.stringify(typing))
  await wait(1700)
  const paused = await state(page)
  check('手を止めると、キーボードの上の道具に、書いている段落の直すところが1行で出る（「直すところ：」と、直し方の題）', !!paused.issue && paused.issue.includes('直すところ：') && paused.issue.includes('である'), JSON.stringify(paused))
  check('書いている間は、帯を出さない（書き始める前に直すところがなかったので、帯の場所もない）', !paused.strip || paused.strip.hidden, JSON.stringify(paused.strip))

  // ---- 「完了」→ 帯 ----
  await page.evaluate(() => document.querySelector('.direct-bar .db-done').click())
  await page.waitForFunction(() => !window.__editor.getSnapshot().editingId, { timeout: 20000 })
  await ready()
  await wait(600)
  const done = await state(page)
  const errorCount = Number(/^直すところが ([0-9]+)か所$/.exec(done.strip?.text ?? '')?.[1] ?? 0)
  check('「完了」のあと、下のタブの上に帯「直すところが n か所」と「チェックで見る ›」が出る', !!done.strip && !done.strip.hidden && errorCount > 0 && done.strip.go === 'チェックで見る ›', JSON.stringify(done.strip))
  check('帯は下のタブのすぐ上。下の「チェック」に赤い数は出ない', !!done.strip && Math.abs(done.strip.bottom - done.navTop) < 2 && !done.redBadge, JSON.stringify(done))
  check('ページ送りは帯の上に上がり、帯に重ならない。紙面の枠は帯の分だけ低くなる', done.pagerBottom !== null && done.pagerBottom <= done.strip.top && done.stageH < clean.stageH - 30, JSON.stringify({ pager: done.pagerBottom, strip: done.strip?.top, stage: [clean.stageH, done.stageH] }))

  // ---- 帯を押す → チェックの欄 ----
  await page.evaluate(() => document.querySelector('.err-strip').click())
  await page.waitForSelector('.sheet .issue.error', { timeout: 10000 })
  const sheet = await page.evaluate(() => ({ title: document.querySelector('.sheet h2, .sheet .sheet-title')?.textContent ?? '', errors: document.querySelectorAll('.sheet .issue.error').length }))
  check('帯を押すと、チェックの欄が開き、帯と同じ数のエラーが並ぶ', sheet.title.includes('セルフチェック') && sheet.errors === errorCount, JSON.stringify(sheet))
  await page.evaluate(() => document.querySelector('.sheet .sheet-close').click())
  await wait(400)

  // ---- 直すところのある段落を書く → 1行がすぐ出て、直すと消える ----
  await page.evaluate((id, len) => window.__editor.openEditor(id, len), id, original.length + 'この色は好きです。'.length)
  await page.waitForFunction((id) => { const s = window.__editor.getSnapshot(); return s.editingId === id && s.onPaper }, { timeout: 20000 }, id)
  await wait(600)
  const reopen = await state(page)
  check('直すところのある段落を書き始めると、1行がすぐ出る。帯は場所を取ったまま隠れる（紙面の大きさは変えない）', !!reopen.issue && !!reopen.strip && reopen.strip.hidden && Math.abs(reopen.stageH - done.stageH) < 2, JSON.stringify(reopen))
  for (let i = 0; i < 'この色は好きです。'.length; i++) await page.keyboard.press('Backspace')
  await wait(1800)
  const fixed = await state(page)
  check('直すと、キーボードの上の1行は消える', fixed.issue === null && (await textOf(page, id)) === original, JSON.stringify(fixed))
  await page.evaluate(() => document.querySelector('.direct-bar .db-done').click())
  await page.waitForFunction(() => !window.__editor.getSnapshot().editingId, { timeout: 20000 })
  await ready()
  await wait(600)
  const gone = await state(page)
  check('直すところがなくなって「完了」を押すと、帯は消え、紙面の枠も元の高さに戻る', !gone.strip && !gone.redBadge && Math.abs(gone.stageH - clean.stageH) < 2, JSON.stringify(gone))

  // ---- 10か所以上でも「か所」 ----
  await page.evaluate((id) => {
    const text = Array.from({ length: 12 }, (_, i) => `${i + 1}つ目の文です。`).join('')
    window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, content: [{ type: 'text', text }] } : b)) })) }))
  }, id)
  await wait(800)
  await ready()
  await wait(400)
  const many = await state(page)
  const manyCount = Number(/^直すところが ([0-9]+)か所$/.exec(many.strip?.text ?? '')?.[1] ?? 0)
  check('10か所以上でも「直すところが 12か所」のように数える（「12つ」にしない）', manyCount >= 10, JSON.stringify(many.strip))
  // 横向き（高さの低い画面）では、帯の行を作らず、紙面の左に小さく浮かせる（紙面を細くしない）
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await wait(800)
  await ready()
  const land = await page.evaluate(() => {
    const strip = document.querySelector('.err-strip').getBoundingClientRect()
    const pageRect = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current').getBoundingClientRect()
    const nav = document.querySelector('.p-nav').getBoundingClientRect()
    return { fixed: getComputedStyle(document.querySelector('.err-strip')).position === 'fixed', stripRight: strip.right, stripBottom: strip.bottom, pageLeft: pageRect.left, pageW: pageRect.width, navTop: nav.top, scrollX: document.documentElement.scrollWidth > innerWidth }
  })
  check('横向きでは、帯は紙面の左に浮かせて出し（紙面に重ねない・下のタブの上）、紙面は細くならない', land.fixed && land.stripRight <= land.pageLeft && land.stripBottom <= land.navTop && land.pageW >= 140 && !land.scrollX, JSON.stringify(land))
  // ついでに（同じ日のスマホの直し）：メニューの下の文字のリンクは、どれも絵つき・左寄せで、1つずつの行にそろう
  // （「困ったとき・おかしいときは、ここから知らせる」だけが中央寄せで、下の行に重なって見えた：試している学生のスクリーンショット 2026-11-02）
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await wait(600)
  await page.evaluate(() => document.querySelector('.p-top .icon-btn[aria-label^="メニュー"]').click())
  await page.waitForSelector('.sheet .feedback-menu-link')
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet .sheet-body .word-link')].map((e) => { const b = e.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 10), left: Math.round(b.left), top: b.top, bottom: b.bottom, icon: !!e.querySelector('svg') } }),
  )
  const aligned = links.length >= 3 && links.every((l) => l.left === links[0].left && l.icon) && links.every((l, i) => i === 0 || l.top >= links[i - 1].bottom)
  check('メニューの下の文字のリンク（Word・困ったとき・読み込み直す）は、どれも絵つきで左にそろい、行が重ならない', aligned, JSON.stringify(links))
  await context.close()
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
