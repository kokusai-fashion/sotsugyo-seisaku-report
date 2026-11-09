// 管理ページのアイコンの見本（依頼者 2026-11-10「管理ページをスマホのホーム画面に置いたときのアイコンを用意して」）
//   node scripts/mockup-v129-admin-icon.mjs → mockups/v129/v129-admin-icon.png
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9372'
const { withEdge } = await import('./poc/edge.mjs')

const OUT = 'mockups/v129'
await withEdge(async (browser) => {
  const p = await browser.newPage()
  await p.setViewport({ width: 1244, height: 900, deviceScaleFactor: 2 })
  await p.goto(pathToFileURL(resolve(`${OUT}/icons.html`)).href, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 500))
  await p.screenshot({ path: `${OUT}/v129-admin-icon.png`, fullPage: true })
})
console.log(`${OUT}/v129-admin-icon.png`)
