// mockups/v72：「元に戻す」で戻した所を光らせるのが、少し大げさ（依頼者の指摘 2026-10-28）。光らせ方の案。
//   今：濃い黄色の地に、黄色とオレンジの枠。1.1秒そのままにして、0.4秒で消える
//   案A：うすい黄色の地だけ（枠なし）。すぐに消え始めて、1.2秒ほどでふっと消える
//   案B：地は塗らず、段落の左の余白に細い線だけ。1.2秒そのままにして、0.4秒で消える
//   案C：光らせない（ほかのページなら、そこへ移るだけ）
// 本物のツール（開発サーバー）を開き、段落に見本の光らせ方を当てて、時間をずらしながら撮る（動きは、止めた絵を並べた GIF）。
// 使い方：node scripts/mockup-v72-undo-flash.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335。GIF に ffmpeg を使う）
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v72/shots'
const FRAMES = join(OUT, 'frames')
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// どの案も、時間 t（秒）の様子を、止めたアニメーション（animation-delay を負に）で見せる
const CSS = `
  .page-viewport .mk-now { animation: mk-now 1.5s linear paused both; border-radius: calc(5px / var(--s)); }
  @keyframes mk-now {
    0%, 73.3% { background-color: #ffe7a1; box-shadow: 0 0 0 calc(5px / var(--s)) #ffe7a1, 0 0 0 calc(7px / var(--s)) #e0b23c; animation-timing-function: ease; }
    100% { background-color: rgba(255, 231, 161, 0); box-shadow: 0 0 0 calc(5px / var(--s)) rgba(255, 231, 161, 0), 0 0 0 calc(7px / var(--s)) rgba(224, 178, 60, 0); }
  }
  .page-viewport .mk-a { animation: mk-a 1.5s linear paused both; border-radius: calc(3px / var(--s)); }
  @keyframes mk-a {
    0%, 15% { background-color: rgba(255, 221, 120, 0.42); box-shadow: 0 0 0 calc(3px / var(--s)) rgba(255, 221, 120, 0.42); animation-timing-function: ease-out; }
    100% { background-color: rgba(255, 221, 120, 0); box-shadow: 0 0 0 calc(3px / var(--s)) rgba(255, 221, 120, 0); }
  }
  .page-viewport .mk-b { animation: mk-b 1.6s linear paused both; }
  @keyframes mk-b {
    0%, 75% { box-shadow: calc(-7px / var(--s)) 0 0 0 #fff, calc(-11px / var(--s)) 0 0 0 #e0a91a; animation-timing-function: ease; }
    100% { box-shadow: calc(-7px / var(--s)) 0 0 0 rgba(255, 255, 255, 0), calc(-11px / var(--s)) 0 0 0 rgba(224, 169, 26, 0); }
  }
`
const OPTIONS = ['now', 'a', 'b', 'c']
const DURATION = { now: 1.5, a: 1.5, b: 1.6, c: 0 }
// 1コマ 0.1秒。はじめに 0.6秒なにもなし → 光る（2秒） → 0.8秒なにもなし（くり返す）
const TIMES = [...Array(6).fill(null), ...Array.from({ length: 20 }, (_, i) => i / 10), ...Array(8).fill(null)]

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1.25 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
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
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p4'), 'none'))
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.mouse.move(5, 5)
  await sleep(400)
  const SEL = '.page-viewport.front p[data-block-id="p4"]'
  // 撮る所：紙の幅で、光らせる段落とその前後
  const clip = await page.evaluate((sel) => {
    const p = document.querySelector(sel).getBoundingClientRect()
    const sheet = document.querySelector(sel).closest('[data-vivliostyle-page-container]')?.getBoundingClientRect() ?? p
    return { x: Math.round(sheet.left), y: Math.round(p.top - 110), width: Math.round(sheet.width), height: Math.round(p.height + 200) }
  }, SEL)
  const at = (name, t) =>
    page.evaluate(
      (sel, name, t) => {
        const el = document.querySelector(sel)
        el.classList.remove('mk-now', 'mk-a', 'mk-b')
        el.style.animationDelay = ''
        if (t === null || name === 'c') return
        el.classList.add(`mk-${name}`)
        el.style.animationDelay = `${-t}s`
      },
      SEL,
      name,
      t,
    )
  for (const name of OPTIONS) {
    for (const [k, t] of TIMES.entries()) {
      await at(name, t !== null && t < DURATION[name] ? t : null)
      await page.screenshot({ path: join(FRAMES, `${name}-${String(k).padStart(2, '0')}.png`), clip, captureBeyondViewport: false })
    }
    // 止めた絵（光り始めて 0.2秒）
    await at(name, 0.2)
    await page.screenshot({ path: join(OUT, `${name}.png`), clip, captureBeyondViewport: false })
  }
  await at('now', null)
  // 画面全体（今の光らせ方。どこを撮ったか）
  await at('now', 0.2)
  await page.screenshot({ path: join(OUT, 'whole-now.png'), captureBeyondViewport: false })
  await context.close()

  // 並べた絵（止めた絵の見本と、GIF のコマ）
  const sheet = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`
  const cols = [
    { h: '今', t: '濃い黄色の地に、黄色とオレンジの枠。1.1秒そのままにして、0.4秒で消える' },
    { h: '案A（おすすめ）', t: 'うすい黄色の地だけ（枠なし）。すぐに消え始めて、1.2秒ほどでふっと消える' },
    { h: '案B', t: '地は塗らず、段落の左の余白に細い線だけ。1.2秒そのままにして、0.4秒で消える' },
    { h: '案C', t: '光らせない。ほかのページなら、そこへ移るだけ（どこが戻ったかは、自分で探す）' },
  ]
  const html = (srcs, title) => `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 18px 20px 20px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: 1400px; }
    h1 { font-size: 21px; margin: 0 0 4px; } .sub { margin: 0 0 12px; color: #4a5060; font-size: 14.5px; }
    .row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; align-items: start; }
    .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .col h2 { font-size: 17px; margin: 0 0 3px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; }
    .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; }
  </style><h1>${title}</h1><p class="sub">見本：削除した段落を「戻す」で戻したとき（段落「袖は風をはらむように…」）。図・表・表のマスも同じ光らせ方にします</p>
  <div class="row">${cols.map((c, i) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p><img src="${srcs[i]}"></div>`).join('')}</div>`
  await sheet.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await sheet.setContent(html(OPTIONS.map((n) => img(join(OUT, `${n}.png`))), '「元に戻す」で戻した所の光らせ方（光り始めて 0.2秒の様子）'), { waitUntil: 'load' })
  await sheet.screenshot({ path: 'mockups/v72/undo-flash.png', fullPage: true })
  for (const k of TIMES.keys()) {
    const n = String(k).padStart(2, '0')
    await sheet.setContent(html(OPTIONS.map((o) => img(join(FRAMES, `${o}-${n}.png`))), '「元に戻す」で戻した所の光らせ方（動き）'), { waitUntil: 'load' })
    await sheet.screenshot({ path: join(FRAMES, `sheet-${n}.png`), fullPage: true })
  }
  await sheet.close()
})

// GIF（1コマ 0.1秒）
const palette = join(FRAMES, 'palette.png')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', join(FRAMES, 'sheet-%02d.png'), '-vf', 'scale=1100:-1:flags=lanczos,palettegen=stats_mode=diff', palette])
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', join(FRAMES, 'sheet-%02d.png'), '-i', palette, '-lavfi', 'scale=1100:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', 'mockups/v72/undo-flash.gif'])
rmSync(FRAMES, { recursive: true, force: true })
console.log('できました：mockups/v72/undo-flash.png・undo-flash.gif')
