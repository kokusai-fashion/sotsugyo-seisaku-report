// mockups/v82：紙面で文を選んで「コピー」を押したとき、コピーできたことを知らせる案（学生の試し 2026-10-31：押しても何も出ず、できたか不安）。
// 本物のツール（開発サーバー）を開き、文や知らせを差し込んで撮る（見た目の案。動きは作っていない）。
// 写真は captureBeyondViewport: false で撮る（撮るときに画面の大きさが変わると、ツールが選んだ所の帯を閉じるため）
// 使い方：node scripts/mockup-v82-copy.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
// Edge の番号は、読み込む前に決める（edge.mjs は読み込むときに番号を読む）
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v82/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
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
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
  await sleep(500)
  await ready()
  // p1 の2文目をなぞって選ぶ
  const pts = await page.evaluate(() => {
    const el = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current [data-block-id="p1"]')
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n)
    // 行ごとに字が分かれていても探せるよう、つないだ字で探し、その位置の1字の範囲を返す（last：探した語の最後の字）
    const all = nodes.map((n) => n.textContent).join('')
    const charRect = (k) => { let at = k; for (const n of nodes) { if (at < n.textContent.length) { const r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + 1); return r.getBoundingClientRect() } at -= n.textContent.length } return null }
    const find = (s, last = false) => { const i = all.indexOf(s); return i < 0 ? null : charRect(last ? i + s.length - 1 : i) }
    const a = find('シンドバッドは七つ')
    const b = find('見せる。', true)
    return { from: { x: a.left + 1, y: a.top + a.height / 2 }, to: { x: b.right + 28, y: b.top + b.height / 2 } }
  })
  await page.mouse.move(pts.from.x, pts.from.y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(pts.from.x + ((pts.to.x - pts.from.x) * i) / 12, pts.from.y + ((pts.to.y - pts.from.y) * i) / 12)
  await page.mouse.up()
  await sleep(600)
  await page.waitForFunction(() => !document.querySelector('.range-bar').hidden, { timeout: 10000 })
  const clip = await page.evaluate(() => {
    const b = document.querySelector('.range-bar').getBoundingClientRect()
    return { x: Math.max(0, b.left - 260), y: Math.max(0, b.top - 40), width: 860, height: 170 }
  })
  await page.screenshot({ path: join(OUT, '0-select.png'), clip, captureBeyondViewport: false })
  // 今：「コピー」を押す（見た目は何も変わらない）
  const copy = await page.evaluate(() => { const r = document.querySelector('.range-bar .copy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await page.mouse.click(copy.x, copy.y)
  await sleep(500)
  await page.mouse.move(1380, 760)
  await page.screenshot({ path: join(OUT, '1-now.png'), clip, captureBeyondViewport: false })
  // 案A：押した「コピー」が、少しの間「✓ コピーしました」になる
  const restore = await page.evaluate(() => {
    const b = document.querySelector('.range-bar .copy')
    const before = b.innerHTML
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>コピーしました</span>'
    b.style.color = '#1f7a4d'
    b.style.background = '#e7f4ec'
    // 今は押すと帯が消えるので、案では帯を出したままにする
    document.querySelector('.range-bar').hidden = false
    return before
  })
  await sleep(200)
  await page.screenshot({ path: join(OUT, 'A-button.png'), clip, captureBeyondViewport: false })
  await page.evaluate((before) => { const b = document.querySelector('.range-bar .copy'); b.innerHTML = before; b.style.color = ''; b.style.background = '' }, restore)
  // 案B：紙面の上に知らせ（ほかの知らせと同じ形・同じ所）
  await page.evaluate(() => window.__editor.showNotice('コピーしました。貼りたい所をクリックして、「貼り付け」か Ctrl+V で入れます'))
  await sleep(600)
  await page.screenshot({ path: join(OUT, 'B-notice.png'), captureBeyondViewport: false })
  await context.close()

  // 並べた絵
  const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
  const items = [
    ['0-select', '今（押す前）', '文をなぞって選ぶと、上に「コピー・切り取り・削除」の帯が出る'],
    ['1-now', '今（「コピー」を押したあと）', '見た目は何も変わらない（帯も選んだ色もそのまま）'],
    ['A-button', '案A　ボタンが「✓ コピーしました」に', '押した所が2秒ほど緑の「✓ コピーしました」になり、元に戻る'],
    ['B-notice', '案B　紙面の上に知らせ', 'ほかの知らせ（「改ページを消しました」など）と同じ形・同じ所で、貼り方も一緒に伝える（数秒で消える）'],
  ]
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 16px;color:#2b2b2b}
.row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card.wide{grid-column:1 / span 2}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>紙面で文を選んで「コピー」を押したときの知らせ方の案</h1>
<div class="row">${items.slice(0, 2).map(([f, t, d]) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`).join('')}</div>
<div class="row"><div class="card"><h2>${items[2][1]}</h2><p>${items[2][2]}</p><img src="${img(items[2][0])}"></div></div>
<div class="row"><div class="card wide"><h2>${items[3][1]}</h2><p>${items[3][2]}</p><img src="${img(items[3][0])}"></div></div>`
  const sheet = await browser.newPage()
  await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
  await sheet.setContent(html, { waitUntil: 'load' })
  const h = await sheet.evaluate(() => document.body.scrollHeight)
  await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
  await sheet.screenshot({ path: 'mockups/v82/v82-案.png', fullPage: true })
})
console.log('done')
