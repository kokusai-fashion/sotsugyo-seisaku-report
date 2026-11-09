// 点検表のアイコンの案（依頼者 2026-11-10「点検表専用のアイコンも作る」）
//   node scripts/mockup-v131-admin-icon.mjs → mockups/v131/v131-check-icon.png
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9378'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v131'
await withEdge(async (browser) => {
  const p = await browser.newPage()
  await p.setViewport({ width: 1244, height: 900, deviceScaleFactor: 2 })
  await p.goto(pathToFileURL(resolve(`${OUT}/icons.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${OUT}/v131-check-icon.png`, fullPage: true })
})
console.log(`${OUT}/v131-check-icon.png`)
