// mockups/v64：「1ページ」と「拡大」の間の大きさにもしたい（依頼者の要望 2026-10-26。いまの「拡大」の 100% は本文の幅を画面に合わせた大きさで、
// 「1ページ」とは別の数え方）。倍率の数え方と、「－ ＋」を出す所の案。
// 本物のツール（開発サーバー）を開き、紙面を間の大きさにして、右下の帯に案ごとの部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v64-zoom-scale.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v64/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 紙面の大きさ（CSS の px）の 100% ＝ A4 の実寸（96dpi で 793.7px）。案C の数え方 */
const PAGE_W = 793.7

const CSS = `
  .mock-step { display: flex; align-items: center; gap: 1px; margin-left: 2px; padding-left: 4px; border-left: 1px solid var(--line); }
  .mock-step button { min-width: 28px; height: 28px; border: 0; border-radius: 7px; background: none; color: var(--accent); font-size: 16px; font-weight: 700; line-height: 1; }
  .mock-step button:disabled { color: #b5b7bc; }
  .mock-step b { min-width: 42px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ink); }
  .view-bar .zoom-step { display: none !important; }
`

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
      localStorage.setItem('sotsugyo-seisaku-report-zoom-level', '1')
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
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.mouse.move(5, 5)

  const viewBy = (label) => page.evaluate((label) => [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes(label)).click(), label)
  const scaleNow = () => page.evaluate(() => window.__editor.stage.scale)
  // 1ページ・拡大の大きさ（紙面の倍率）
  const fit = await scaleNow()
  await viewBy('拡大')
  await sleep(900)
  await ready()
  const zoom = await scaleNow()
  // 帯の部品（「－ n% ＋」）を差し込む
  const step = (label, minus = true) =>
    page.evaluate((label, minus) => {
      document.querySelector('.mock-step')?.remove()
      const m = document.createElement('div')
      m.className = 'mock-step'
      m.innerHTML = `<button ${minus ? '' : 'disabled'}>－</button><b>${label}</b><button>＋</button>`
      document.querySelector('.view-bar .zoom').after(m)
    }, label, minus)
  const barClip = async () => {
    // 「1ページ・見開き・拡大」から右の端まで（数字が大きく見えるように、元に戻す・やり直すは入れない）
    const r = await page.evaluate(() => { const b = document.querySelector('.view-bar').getBoundingClientRect(); const z = document.querySelector('.view-bar .zoom').getBoundingClientRect(); return { x: z.left - 6, y: b.top + 2, width: b.right - z.left + 4, height: b.height - 4 } })
    return r
  }
  const shotBar = async (name) => page.screenshot({ path: join(OUT, `${name}.png`), clip: await barClip(), captureBeyondViewport: false })

  // いま：拡大 100%
  await page.evaluate(() => document.querySelector('.mock-step')?.remove())
  await page.addStyleTag({ content: '.view-bar .zoom-step { display: flex !important; }' })
  await shotBar('now-zoom')
  // 間の大きさ（1ページと拡大の真ん中）にした紙面
  const mid = (fit + zoom) / 2
  await page.evaluate((s) => window.__editor.stage.setFreeZoom(s), mid)
  await sleep(900)
  await page.addStyleTag({ content: '.view-bar .zoom-step { display: none !important; }' })
  const pct = (s, base) => `${Math.round((s / base) * 100)}%`
  // 案A：拡大を 100% のまま、その下にも段（1ページ＝${pct(fit, zoom)}）
  await step(pct(mid, zoom))
  await page.screenshot({ path: join(OUT, 'mid-screen.png'), captureBeyondViewport: false })
  await shotBar('A-mid')
  // 案B：1ページを 100% に
  await step(pct(mid, fit))
  await shotBar('B-mid')
  // 案C：紙の実寸を 100% に（Word と同じ数え方）
  await step(`${Math.round(mid * 100)}%`)
  await shotBar('C-mid')
  // 1ページ・拡大のときの帯も（案ごと）
  await viewBy('1ページ')
  await sleep(900)
  await ready()
  await page.evaluate(() => document.querySelector('.mock-step')?.remove())
  await shotBar('now-fit')
  await step(pct(fit, zoom))
  await shotBar('A-fit')
  await step('100%', false)
  await shotBar('B-fit')
  await step(`${Math.round(fit * 100)}%`)
  await shotBar('C-fit')
  await page.screenshot({ path: join(OUT, 'fit-screen.png'), captureBeyondViewport: false })
  await viewBy('拡大')
  await sleep(900)
  await ready()
  await step('100%')
  await shotBar('A-zoom')
  await step(pct(zoom, fit))
  await shotBar('B-zoom')
  await step(`${Math.round(zoom * 100)}%`)
  await shotBar('C-zoom')
  await page.screenshot({ path: join(OUT, 'zoom-screen.png'), captureBeyondViewport: false })
  console.log(JSON.stringify({ fit, zoom, mid, A: [pct(fit, zoom), pct(mid, zoom), '100%'], B: ['100%', pct(mid, fit), pct(zoom, fit)], C: [fit, mid, zoom].map((s) => `${Math.round(s * 100)}%`) }))
  await context.close()
})
