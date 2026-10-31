// mockups/v83：表（図）がページの下まで来て、下に「＋ ここに続きを書く」を出す空きがないときの案（学生の試し 3回目・4回目 2026-10-31）。
// 本物のツール（開発サーバー）を開き、行を置き直したり、道具にボタンを足したりして撮る（見た目の案。動きは作っていない）。
// 写真は captureBeyondViewport: false で撮る（撮るときに画面の大きさが変わると、ツールが組み直すため）
// 使い方：node scripts/mockup-v83-continue-room.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
// Edge の番号は、読み込む前に決める（edge.mjs は読み込むときに番号を読む）
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v83/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  // 1章の最後を素材表にし（表の下の段落を消す）、表の前に段落を足して、表をページの下まで下げる（学生の試しと同じ形）
  const fit = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    const done = () => new Promise((r) => { const tick = () => { const s = window.__editor.getSnapshot(); if (s.layout && !s.rendering) r(); else setTimeout(tick, 100) }; setTimeout(tick, 300) })
    const extra = '照明の色温度によって、布の色の見え方が変わる。舞台の照明の下で、同じ布を何度も見比べて決めた。'
    for (let n = 0; n < 12; n++) {
      window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i ? c : { ...c, blocks: c.blocks.filter((b) => b.id !== 'p5b').flatMap((b) => (b.id === 'p5' ? [{ type: 'paragraph', id: `px${n}`, content: [{ type: 'text', text: extra }] }, b] : [b])) })) }))
      await done()
      await wait(200)
      const view = window.__editor.renderer.pageView
      const table = [...document.querySelectorAll('.data-table[data-table-id="t1"]')]
      const pages = new Set(table.map((t) => view.pageIndexOf(t)))
      if (pages.size > 1) return { split: true, n }
      const t = table.at(-1)
      const pg = view.pages()[view.pageIndexOf(t)]
      const room = pg.getBoundingClientRect().bottom - t.getBoundingClientRect().bottom
      if (room < pg.getBoundingClientRect().height * 0.16) return { room, n, page: view.pageIndexOf(t) }
    }
    return { n: 'max' }
  })
  console.log('fit', JSON.stringify(fit))
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('t1'), 'none'))
  await sleep(500)
  await ready()
  // 表のマスを押して選ぶ（今は、下に空きがないので「＋ ここに続きを書く」が出ない）
  const cell = await page.evaluate(() => { const c = [...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container].is-current .data-table[data-table-id="t1"] td')].at(-1); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await page.mouse.click(cell.x, cell.y)
  await sleep(1200)
  await page.mouse.move(1400, 790)
  const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
  await shot('0-now')
  // 案A：表のすぐ下（本文の下の余白）に出す
  await page.evaluate(() => {
    const e = window.__editor
    const view = e.renderer.pageView
    const t = [...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container].is-current .data-table[data-table-id="t1"]')].at(-1)
    e.continueRow.show({ objectId: 't1', element: t, page: view.pages()[view.pageIndexOf(t)] })
    // 下の余白では、ページ番号に重ならないよう、字の分の長さにする（左寄せ）
    Object.assign(e.continueRow.element.style, { width: 'auto', top: `${parseFloat(e.continueRow.element.style.top) - 6}px` })
  })
  await sleep(300)
  await shot('A-margin')
  await page.evaluate(() => { window.__editor.continueRow.element.hidden = true })
  // 案B：左の道具の「表」の所に「表の後ろに続きを書く」
  await page.evaluate(() => {
    const group = document.querySelector('.palette .group.ctx')
    const b = document.createElement('button')
    b.className = 'tb mock-continue'
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span><span class="tb-line">表の後ろに</span><span class="tb-line">続きを書く</span></span>'
    b.style.cssText = 'outline: 2px solid #c98a2b; outline-offset: -2px; border-radius: 8px;'
    group?.querySelector('.ctx-label')?.after(b)
  })
  await sleep(300)
  await shot('B-palette')
  await context.close()

  // 並べた絵
  const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
  const items = [
    ['0-now', '今', '表がページの下まで来ると、表を選んでも「＋ ここに続きを書く」が出ない（下に空きがないため）'],
    ['A-margin', '案A　表のすぐ下（紙面の下の余白）に出す', '本文の範囲の外でも、表のすぐ下の余白に出す（ページ番号に重ならない長さ。紙面だけで PDF には出ない）。押すと表の後ろに段落ができ、次のページで続きを書く'],
    ['B-palette', '案B　左の道具に「表の後ろに続きを書く」', '表（マス・生地の写真）を選んでいるとき、左の道具のいちばん上に出す（だいだいの枠は、案の場所を示すためのもの）'],
  ]
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 16px;color:#2b2b2b}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:18px}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>表がページの下まで来たときの「＋ ここに続きを書く」の案</h1>
${items.map(([f, t, d]) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`).join('')}`
  const sheet = await browser.newPage()
  await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
  await sheet.setContent(html, { waitUntil: 'load' })
  const h = await sheet.evaluate(() => document.body.scrollHeight)
  await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
  await sheet.screenshot({ path: 'mockups/v83/v83-案.png', fullPage: true })
})
console.log('done')
