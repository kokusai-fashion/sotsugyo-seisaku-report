// 「使い方を AI に聞く」（mockups/v86 案A・B）の出来上がりを撮る（確かめ用）。
// 使い方：node scripts/shots-ai-help.mjs <まとめた版のフォルダ>（ポート 4235。Edge は 9340）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9340'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const server = await serveBuilt(process.argv[2] ?? 'dist-e2e', 4235)
const OUT = 'mockups/v86/done'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

try {
  await withEdge(async (browser) => {
    const shoot = async (viewport, phone) => {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      await page.evaluateOnNewDocument(TIPS_DONE)
      await page.setViewport(viewport)
      await stubConfig(page, { aiHelpUrl: 'https://gemini.google.com/gem/example' })
      await page.goto('http://localhost:4235/?nodrive', { waitUntil: 'networkidle0', timeout: 90000 })
      await page.waitForFunction(() => !!window.__editor?.getSnapshot()?.layout, { timeout: 120000 })
      await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
      await page.evaluate(() => document.querySelector('.g-opts button').click())
      await page.waitForSelector('.guide.step-word .g-word-opt.no')
      await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
      await page.waitForSelector('.guide .g-later')
      await page.evaluate(() => document.querySelector('.guide .g-later').click())
      await sleep(1000)
      return { context, page }
    }
    {
      const { context, page } = await shoot({ width: 1440, height: 810, deviceScaleFactor: 1.25 })
      await page.click('.side .menu-btn')
      await page.waitForSelector('.head-menu .hm-ai')
      await page.mouse.move(1200, 700)
      await sleep(300)
      await page.screenshot({ path: `${OUT}/pc-menu.png` })
      if (!(await page.$('.head-menu .hm-help'))) await page.click('.side .menu-btn')
      await page.waitForSelector('.head-menu .hm-help')
      await page.click('.head-menu .hm-help')
      await page.waitForSelector('.help .help-ai')
      await page.evaluate(() => document.activeElement?.blur())
      await sleep(300)
      await page.screenshot({ path: `${OUT}/pc-help.png`, clip: { x: 1040, y: 0, width: 400, height: 420 } })
      await context.close()
    }
    {
      const { context, page } = await shoot({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
      await page.evaluate(() => [...document.querySelectorAll('button.icon-btn')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('メニュー'))?.click())
      await page.waitForSelector('.sheet .ai-btn')
      await sleep(500)
      await page.screenshot({ path: `${OUT}/phone-menu.png` })
      await context.close()
    }
  })
} finally {
  server.close()
}
console.log('done')
