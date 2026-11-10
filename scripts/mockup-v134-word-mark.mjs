// 「Word で書き始めた人へ」の右上：QR の代わりに、Word からツールへ移る絵の案（依頼者 2026-11-10）
//   node scripts/mockup-v134-word-mark.mjs → mockups/v134/v134-word-mark.png
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9378'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v134'
await withEdge(async (browser) => {
  const p = await browser.newPage()
  await p.setViewport({ width: 920, height: 900, deviceScaleFactor: 2 })
  await p.goto(pathToFileURL(resolve(`${OUT}/index.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${OUT}/v134-word-mark.png`, fullPage: true })
})
console.log(`${OUT}/v134-word-mark.png`)
