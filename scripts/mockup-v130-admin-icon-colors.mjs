// 管理ページのアイコンの色の案（依頼者 2026-11-10：v129 の案C寄りで、別の色も見たい）
//   node scripts/mockup-v130-admin-icon.mjs → mockups/v130/v130-admin-icon-colors.png
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9373'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v130'
await withEdge(async (browser) => {
  const p = await browser.newPage()
  await p.setViewport({ width: 1244, height: 900, deviceScaleFactor: 2 })
  await p.goto(pathToFileURL(resolve(`${OUT}/icons.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${OUT}/v130-admin-icon-colors.png`, fullPage: true })
})
console.log(`${OUT}/v130-admin-icon-colors.png`)
