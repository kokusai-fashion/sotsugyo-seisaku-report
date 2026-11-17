// デザイン案 v136：古いブラウザで開いたときの知らせ（依頼者 2026-11-17）。mockups/v136/message.js を案ごとに撮る（ツール本体は変えない）。
//   node scripts/mockup-v136-old-browser.mjs → mockups/v136/screens/*.png と mockups/v136/v136-old-browser.png
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9382'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v136'
mkdirSync(`${OUT}/screens`, { recursive: true })
const screen = pathToFileURL(resolve(`${OUT}/screen.html`)).href
await withEdge(async (browser) => {
  const page = await browser.newPage()
  for (const v of ['a', 'b', 'c']) {
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
    await page.goto(`${screen}?v=${v}&p=mac`, { waitUntil: 'load' })
    await page.screenshot({ path: `${OUT}/screens/pc-${v}.png`, clip: { x: 300, y: 0, width: 680, height: 560 } })
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${screen}?v=${v}&p=iphone`, { waitUntil: 'load' })
    await page.screenshot({ path: `${OUT}/screens/phone-${v}.png` })
  }
  const p = await browser.newPage()
  await p.setViewport({ width: 1080, height: 900, deviceScaleFactor: 1.5 })
  await p.goto(pathToFileURL(resolve(`${OUT}/index.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: `${OUT}/v136-old-browser.png`, fullPage: true })
})
console.log(`${OUT}/v136-old-browser.png`)
