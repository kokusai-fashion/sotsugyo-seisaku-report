// 点検表のアイコンの色の案・その2（依頼者 2026-11-10「他の色も出してください」）
//   node scripts/mockup-v132-admin-icon.mjs → mockups/v132/v132-check-icon-colors.png
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9379'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v132'
await withEdge(async (browser) => {
  const p = await browser.newPage()
  await p.setViewport({ width: 1244, height: 900, deviceScaleFactor: 2 })
  await p.goto(pathToFileURL(resolve(`${OUT}/icons.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${OUT}/v132-check-icon-colors.png`, fullPage: true })
})
console.log(`${OUT}/v132-check-icon-colors.png`)
