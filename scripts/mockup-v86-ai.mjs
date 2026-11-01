// mockups/v86：ツールから「使い方を AI に聞く」（NotebookLM のチャットを新しいタブで開く）の置き場所の案（依頼者 2026-11-01）。
// まとめた版を開いて、画面に案を重ねて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v86-ai.mjs <まとめた版のフォルダ>（ポート 4234。Edge は 9339）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9339'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const server = await serveBuilt(process.argv[2] ?? 'dist-e2e', 4234)
const APP = 'http://localhost:4234'
const OUT = 'mockups/v86/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** AI の印（きらめき）と、新しいタブの印 */
const SPARK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>'
const OUTLINK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'

const CSS = `
.mk-mark { outline: 2px solid #c98a2b !important; outline-offset: 2px; border-radius: 8px; }
.mk-ai { display: flex; gap: 10px; align-items: center; margin: 10px 0 2px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #f6f4fb; color: var(--ink); text-decoration: none; }
.mk-ai .ic { color: #6a4fc1; display: flex; }
.mk-ai .tx { flex: 1; line-height: 1.5; }
.mk-ai b { display: block; font-size: 14px; }
.mk-ai small { display: block; font-size: 12px; color: var(--muted); }
.mk-ai .go { color: var(--muted); display: flex; }
.mk-menu-ai { display: flex !important; align-items: center; gap: 8px; }
.mk-menu-ai .go { margin-left: auto; color: var(--muted); display: flex; }
.mk-side-ai { display: flex; justify-content: center; align-items: center; gap: 5px; margin: 0 0 4px; font-size: 12px; color: var(--accent); text-decoration: underline; }
`

try {
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
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.addStyleTag({ content: CSS })
    await page.mouse.move(1420, 790)
    const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    const clear = () => page.evaluate(() => { for (const el of document.querySelectorAll('.mk-temp')) el.remove() })

    // 案A：使い方の欄の上（言葉で探す欄の下）
    await page.click('.menu-btn')
    await page.waitForSelector('.head-menu .hm-help')
    await page.click('.head-menu .hm-help')
    await page.waitForSelector('.help .help-note')
    await page.evaluate(({ SPARK, OUTLINK }) => {
      const a = document.createElement('a')
      a.className = 'mk-temp mk-ai mk-mark'
      a.innerHTML = `<span class="ic">${SPARK}</span><span class="tx"><b>使い方を AI に聞く</b><small>見つからないときは、ふだんの言葉で聞けます（新しいタブで開きます）</small></span><span class="go">${OUTLINK}</span>`
      document.querySelector('.help .help-note').after(a)
      document.activeElement?.blur()
    }, { SPARK, OUTLINK })
    await sleep(300)
    await shot('1-help')
    await clear()
    await page.click('.help-close')
    await sleep(300)

    // 案B：メニューの「使い方」のすぐ下
    await page.click('.menu-btn')
    await page.waitForSelector('.head-menu .hm-help')
    await page.evaluate(({ SPARK, OUTLINK }) => {
      const item = document.createElement('a')
      item.className = 'mk-temp mk-menu-ai mk-mark'
      item.setAttribute('role', 'menuitem')
      item.innerHTML = `${SPARK}使い方を AI に聞く<span class="go">${OUTLINK}</span>`
      document.querySelector('.head-menu .hm-help').after(item)
      document.activeElement?.blur()
    }, { SPARK, OUTLINK })
    await sleep(300)
    await shot('2-menu')
    await clear()
    await page.keyboard.press('Escape')
    await page.evaluate(() => document.activeElement?.blur())
    await page.mouse.click(1300, 680)
    await sleep(200)

    // 案C：右の欄のいちばん下（「困ったとき・おかしいときは、ここから知らせる」の上）
    await page.evaluate(({ SPARK, OUTLINK }) => {
      const a = document.createElement('a')
      a.className = 'mk-temp mk-side-ai mk-mark'
      a.innerHTML = `${SPARK}使い方が分からないときは、AI に聞く${OUTLINK}`
      document.querySelector('.feedback-link').before(a)
    }, { SPARK, OUTLINK })
    await sleep(300)
    await shot('3-side')
    await context.close()

    // 並べた絵
    const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
    const card = (f, t, d) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`
    const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 6px;color:#2b2b2b} .lead{margin:0 0 16px;color:#555;font-size:14px;line-height:1.7}
.row{display:flex;gap:18px;align-items:flex-start}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:18px;flex:1}
.card h2{font-size:18px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:13.5px;margin:0 0 8px;color:#555;line-height:1.6}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>「使い方を AI に聞く」の置き場所（v86 の案）</h1>
<p class="lead">押すと、AI（Gemini Notebook）のチャットが新しいタブで開きます。だいだいの枠は、案の場所を示すためのもの（実際には出ません）。スマホは、どの案でもメニューの中に置きます。</p>
<div class="row">${card('1-help', '案A　使い方の欄の上', '使い方を開いたとき、言葉で探す欄のすぐ下に出す。探して見つからないときに、そのまま聞ける')}${card('2-menu', '案B　メニューの「使い方」の下', '右上の「メニュー」の中に置く。ふだんは目立たない')}</div>
<div class="row">${card('3-side', '案C　右の欄のいちばん下', '「困ったとき・おかしいときは、ここから知らせる」の上に、いつも小さく出す')}<div class="card" style="visibility:hidden"></div></div>`
    const sheet = await browser.newPage()
    await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
    await sheet.setContent(html, { waitUntil: 'load' })
    const h = await sheet.evaluate(() => document.body.scrollHeight)
    await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
    await sheet.screenshot({ path: 'mockups/v86/v86-案.png', fullPage: true })
  })
} finally {
  server.close()
}
console.log('done')
