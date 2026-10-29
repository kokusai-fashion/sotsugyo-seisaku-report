// mockups/v74/9-ack：C の説明の絵（赤いエラーに出る「このままにする（確認済み）」）。開発サーバー http://localhost:5173、Edge 9335
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v74/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done') } catch {} })
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 })
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
  // 段落の終わりの「。」を外す（赤いエラー「文末に「。」を付ける」）
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' && b.type === 'paragraph' ? { ...b, content: b.content.map((n, i, a) => (i === a.length - 1 && n.type === 'text' ? { ...n, text: n.text.replace(/。$/, '') } : n)) } : b)) })) })))
  await sleep(1500)
  await ready()
  await page.mouse.move(5, 5)
  const side = await page.evaluate(() => { const r = document.querySelector('.side').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })
  // 「このままにする（確認済み）」に赤い丸
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('.side button, .side a')].find((b) => b.textContent.includes('このままにする'))
    link?.scrollIntoView({ block: 'center' })
    if (link) { link.style.setProperty('box-shadow', '0 0 0 3px #e0262f', 'important'); link.style.setProperty('border-radius', '4px', 'important') }
  })
  await sleep(300)
  await page.screenshot({ path: join(OUT, '9-ack-before.png'), clip: side })
  await page.evaluate(() => [...document.querySelectorAll('.side button, .side a')].find((b) => b.textContent.includes('このままにする'))?.click())
  await sleep(1200)
  await page.evaluate(() => { const el = [...document.querySelectorAll('.side *')].find((x) => x.textContent.trim().startsWith('確認済み') && x.childElementCount < 3); el?.scrollIntoView({ block: 'center' }); if (el) el.style.setProperty('box-shadow', '0 0 0 3px #e0262f', 'important') })
  await sleep(300)
  await page.screenshot({ path: join(OUT, '9-ack-after.png'), clip: side })
  await context.close()

  const sheet = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: 1056px; }
    h1 { font-size: 22px; margin: 0 0 6px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; line-height: 1.7; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .col { background: #fff; border-radius: 12px; padding: 12px; }
    .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; min-height: 46px; }
    .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; }
  </style><h1>C の説明：赤いエラーにも出る「このままにする（確認済み）」</h1>
  <p class="sub">右の欄の「直すところ」の赤い ✕ の指摘は「エラー：直してから出す」です。ところが、手順書にない補助のチェック4つ（文末の「。」・「。」が続く・絵文字・同じ図を2回指す）だけは、赤くても下に「このままにする（確認済み）」が出て、押すと消せます。<br>先生向けの使い方には「エラーは、学生が『このままにする』で消せません」と書いてあり、合っていません。</p>
  <div class="row"><div class="col"><h2>押す前</h2><p>赤い ✕「文末に「。」を付ける」の下に、下線の「このままにする（確認済み）」</p><img src="${img('9-ack-before')}"></div>
  <div class="col"><h2>押したあと</h2><p>「いま直すところはありません」になり、「確認済み 1件」の中に入る（「。」は付いていないまま）</p><img src="${img('9-ack-after')}"></div></div>`
  await sheet.setViewport({ width: 1100, height: 800 })
  await sheet.setContent(html, { waitUntil: 'load' })
  await sheet.screenshot({ path: 'mockups/v74/9-ack.png', fullPage: true })
})
console.log('できました：mockups/v74/9-ack.png')
