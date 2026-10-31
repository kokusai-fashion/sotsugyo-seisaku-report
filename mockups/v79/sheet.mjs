// mockups/v79 の写真を1枚に並べる（node mockups/v79/sheet.mjs）
import { readFileSync } from 'node:fs'
process.env.EDGE_PORT = '9336'
const { withEdge } = await import('../../scripts/poc/edge.mjs')
const img = (n) => `data:image/png;base64,${readFileSync(`mockups/v79/shots/${n}.png`).toString('base64')}`
const items = [
  ['0-now', '今', '章の説明の薄字だけ。小見出しのことは書いていない'],
  ['A-hint', '案A　薄字の頭に一文', '同じ薄字の色で「はじめに小見出し（ⅰ．）を付けてから書く。」'],
  ['B-line', '案B　目立つ色の一行を上に', 'スマホは「下の「追加」→「小見出し」」の言い方にする'],
  ['C-slot', '案C　小見出しの枠を最初から置く', '「ⅰ．」の枠をクリックして名前を打つだけ。Enter で下の薄字の段落に移って書ける'],
]
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 16px;color:#2b2b2b}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>本文のいちばん最初で、小見出しを付けることに気づけるようにする案（本文1ページ目の上の部分）</h1>
<div class="grid">${items.map(([f, t, d]) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`).join('')}</div>`
await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  const h = await page.evaluate(() => document.body.scrollHeight)
  await page.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
  await page.screenshot({ path: 'mockups/v79/v79-案.png', fullPage: true })
})
console.log('ok')
