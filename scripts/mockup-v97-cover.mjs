// mockups/v97：表紙の見出しを「卒業制作報告書」（7字）にしたときの見た目の案（先生方の希望 2026-11-03。今は「卒 業 制 作」48pt・字の間に半角の空き）。
// 本物のツールに見本「シンドバッド」を入れ、表紙の見出しの字・大きさ・字の間を差し替えて撮る（見た目の案）。
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v97-cover.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v97'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VARIANTS = [
  { name: '今_卒業制作', text: '卒 業 制 作', size: '48pt' },
  { name: '案A_48pt・間を空けない', text: '卒業制作報告書', size: '48pt' },
  { name: '案B_40pt・間を空ける', text: '卒 業 制 作 報 告 書', size: '40pt' },
  { name: '案C_36pt・間を空ける', text: '卒 業 制 作 報 告 書', size: '36pt' },
  { name: '案D_報告書を小さく', html: '卒 業 制 作<span style="font-size:30pt;margin-left:3mm">報告書</span>', size: '48pt' },
]

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })
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
  await page.evaluate(setupSinbad, sinbadSample())
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(0, 'none'))
  await sleep(800)
  await ready()
  for (const v of VARIANTS) {
    const clip = await page.evaluate((v) => {
      const h = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current .cover .heading')
      if (v.html) h.innerHTML = v.html
      else h.textContent = v.text
      h.style.fontSize = v.size
      // 表紙の見出しは中央に置く（.el.center：左右の中央）
      const r = h.closest('[data-vivliostyle-page-container]').getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height * 0.4 }
    }, v)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/${v.name}.png`, clip, captureBeyondViewport: false })
  }
  await context.close()
})
console.log('done')
