// mockups/v102（2026-11-04）：最終提出の許可が出る前の PDF に入れる「点検用」の印の見本（依頼者：許可制。許可のあとは印のない提出用 PDF）
//   本物の PDF（学生役の試しで出した PDF）を pdf.js で描き、その上に印を重ねて撮る。表紙と本文のページを並べる
//   使い方：node scripts/mockup-v102-check-mark.mjs <PDF>（Edge は 9336）
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v102'
const [pdfPath] = process.argv.slice(2)
const PAGES = (process.env.PAGES ?? '1,4').split(',').map(Number)
const SCALE = 1.0

// 印の形（ページの中の位置は PDF の pt。A4 = 595×842）
const MARKS = {
  A: {
    title: '案A　右下の余白に小さく（全ページ同じ）',
    note: '右下の余白に、灰色の小さな字で入ります。読むときの邪魔になりません。',
    every: `<div class="m a">点検用（教務課への提出には使えません）</div>`,
  },
  B: {
    title: '案B　右上に赤い枠で（全ページ同じ）',
    note: '右上の余白に、赤い枠の「点検用」が入ります。開いてすぐ分かります。',
    every: `<div class="m b">点検用</div>`,
  },
  C: {
    title: '案C　表紙に大きく＋本文は右上に小さく',
    note: '表紙には斜めに薄く大きな字。本文のページは右上に小さく入ります。',
    cover: `<div class="m c-big">点検用</div><div class="m b small">点検用</div>`,
    every: `<div class="m b small">点検用</div>`,
  },
}

const CSS = `
body{margin:0;background:#e9ecf1;font-family:"BIZ UDPGothic","Yu Gothic UI","Meiryo",sans-serif;color:#1c2333}
.wrap{padding:22px 28px 26px;display:inline-block}
h1{font-size:22px;margin:0 0 4px}
.note{font-size:15px;margin:0 0 6px;color:#333}
.file{font-size:14px;margin:0 0 14px;color:#444}
.file b{font-family:Consolas,"BIZ UDGothic",monospace;font-weight:600;background:#fff;border:1px solid #c9cfdb;border-radius:4px;padding:2px 6px}
.row{display:flex;gap:22px;align-items:flex-start}
.pg{position:relative;box-shadow:0 2px 10px rgba(20,30,60,.25);background:#fff}
.pg canvas{display:block}
.cap{font-size:13px;color:#555;margin-top:6px;text-align:center}
.m{position:absolute;font-family:"BIZ UDPGothic","Yu Gothic UI",sans-serif;white-space:nowrap}
.m.a{right:calc(28pt * var(--s));bottom:calc(18pt * var(--s));font-size:calc(7.5pt * var(--s));color:#8a8f99;letter-spacing:.04em}
.m.b{top:calc(22pt * var(--s));right:calc(28pt * var(--s));font-size:calc(10pt * var(--s));font-weight:700;color:#c62828;border:calc(1.2pt * var(--s)) solid #c62828;padding:calc(1.5pt * var(--s)) calc(6pt * var(--s));letter-spacing:.15em;background:#fff}
.m.b.small{font-size:calc(8.5pt * var(--s));padding:calc(1pt * var(--s)) calc(5pt * var(--s))}
.m.c-big{left:50%;top:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:calc(120pt * var(--s));font-weight:800;color:rgba(198,40,40,.13);letter-spacing:.1em}
`

const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body><div class="wrap" id="w"></div><script type="module">
import * as pdfjs from '/pdfjs/pdf.mjs'
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs'
const doc = await pdfjs.getDocument({ url: '/doc.pdf' }).promise
window.__pages = doc.numPages
window.__render = async (pages, scale) => {
  const out = []
  for (const n of pages) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: scale * 96 / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport, intent: 'print' }).promise
    out.push(canvas.toDataURL('image/png'))
  }
  return out
}
document.body.dataset.ready = 'true'
</script>`

const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
  if (path === '/doc.pdf') return res.writeHead(200, { 'Content-Type': 'application/pdf' }).end(readFileSync(pdfPath))
  if (path === '/pdfjs/pdf.mjs' || path === '/pdfjs/pdf.worker.mjs') return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(readFileSync(join('node_modules/pdfjs-dist/build', basename(path))))
  res.writeHead(404).end()
})
await new Promise((ok) => server.listen(0, 'localhost', ok))
const file = basename(pdfPath).replace(/\.pdf$/, '_点検用.pdf')

await withEdge(async (browser) => {
  const view = await browser.newPage()
  await view.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 })
  await view.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'networkidle0' })
  await view.waitForFunction(() => document.body.dataset.ready === 'true', { timeout: 120000 })
  console.log('pages', await view.evaluate(() => window.__pages))
  const images = await view.evaluate((p, s) => window.__render(p, s), PAGES, SCALE)
  for (const [key, mark] of Object.entries(MARKS)) {
    await view.evaluate(
      (key, mark, images, pages, file, scale) => {
        const w = document.getElementById('w')
        const px = scale * 96 / 72
        w.innerHTML = `<h1>${mark.title}</h1><p class="note">${mark.note}</p><p class="file">ファイル名：<b>${file}</b>（許可が出たあとは「_点検用」のない名前）</p><div class="row"></div>`
        const row = w.querySelector('.row')
        images.forEach((src, i) => {
          const box = document.createElement('div')
          box.innerHTML = `<div class="pg" style="--s:${px}"><img src="${src}" style="display:block">${(i === 0 && mark.cover) || mark.every}</div><div class="cap">${pages[i] === 1 ? '表紙' : `${pages[i]}ページ目`}</div>`
          row.append(box)
        })
      },
      key, mark, images, PAGES, file, SCALE,
    )
    await view.evaluate(() => Promise.all([...document.images].map((i) => i.decode())))
    const el = await view.$('#w')
    await el.screenshot({ path: `${OUT}/案${key}_点検用の印.png` })
    console.log('saved', key)
  }
})
server.close()
