// mockups/v95：横長の写真と縦長の写真を横に並べたときの大きさ（依頼者 2026-11-03：高さをそろえるので、縦長の図が小さくなるのが気になる）。
// 紙面の本文の幅（150mm）の中で、4つの並べ方を描いて比べる（見た目の案。ツールの組版ではなく、寸法を計算して描く）。
//   今：高さをそろえる（layout/bodyHtml.ts の rowSizes。1枚の幅は 72mm まで）
//   案1：見た目の大きさ（面積）をそろえる。下をそろえ、タイトルの行をそろえる
//   案2：幅をそろえる
//   案3：形の違う2枚は横に並べず、1枚ずつにする
// 使い方：node scripts/mockup-v95-mixed.mjs（Edge は 9335）
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v95'
mkdirSync(OUT, { recursive: true })
const TRIAL = resolve('public/trial').replace(/\\/g, '/')
const TEXT_W = 150
const GAP = 8
const PAIR_MAX = 72
const L = { src: `file:///${TRIAL}/w-sleeve.jpg`, r: 4 / 3, cap: '図4　袖の刺繍' }
const P = { src: `file:///${TRIAL}/w-pants.jpg`, r: 3 / 4, cap: '図5　ズボン' }

const round = (n) => Math.round(n * 10) / 10
// 今
const hNow = Math.min(PAIR_MAX, (TEXT_W - GAP) / (L.r + P.r), PAIR_MAX / Math.max(L.r, P.r))
const now = [{ ...L, w: L.r * hNow, h: hNow }, { ...P, w: P.r * hNow, h: hNow }]
// 案1：面積をそろえる（1枚の幅・高さは 72mm まで）
let s = Math.min((TEXT_W - GAP) / (Math.sqrt(L.r) + Math.sqrt(P.r)), PAIR_MAX / Math.sqrt(Math.max(L.r, 1 / P.r)))
const area = [{ ...L, w: Math.sqrt(L.r) * s, h: s / Math.sqrt(L.r) }, { ...P, w: Math.sqrt(P.r) * s, h: s / Math.sqrt(P.r) }]
// 案2：幅をそろえる（高さは 80mm まで）
const wEq = Math.min((TEXT_W - GAP) / 2, 80 * P.r, PAIR_MAX)
const width = [{ ...L, w: wEq, h: wEq / L.r }, { ...P, w: wEq, h: wEq / P.r }]
// 案3：1枚ずつ（1枚の図と同じ：長い辺 80mm まで）
const single = [{ ...L, w: 80, h: 80 / L.r }, { ...P, w: 80 * P.r, h: 80 }]

const fig = (f) => `<figure style="width:${round(f.w)}mm"><img src="${f.src}" style="width:${round(f.w)}mm;height:${round(f.h)}mm"><figcaption>${f.cap}</figcaption><small>${round(f.w)}×${round(f.h)}mm</small></figure>`
const row = (figs, cls = '') => `<div class="row ${cls}">${figs.map(fig).join('')}</div>`
const panel = (title, note, body) => `<section><h2>${title}</h2><p class="note">${note}</p><div class="page"><p class="t">　袖は肩から大きく膨らませ、袖口に刺繍を入れた（図4）。ズボンは裾に向かって細くなる形にした（図5）。</p>${body}<p class="t">　次の段落の文が、ここから続く。</p></div></section>`

let html2 = null
const html = `<!doctype html><meta charset="utf-8"><style>
body { margin: 0; padding: 8mm; background: #ece9e3; font-family: 'BIZ UDPGothic', sans-serif; color: #24262b; display: grid; grid-template-columns: repeat(4, 172mm); gap: 6mm; width: max-content; }
section h2 { margin: 0 0 1mm; font-size: 15pt; }
.note { margin: 0 0 3mm; font-size: 10.5pt; color: #555; min-height: 3em; line-height: 1.45; }
.page { background: #fff; padding: 8mm 11mm; box-shadow: 0 2px 8px rgba(0,0,0,.12); width: ${TEXT_W}mm; }
.t { font-family: 'BIZ UDMincho', serif; font-size: 11pt; line-height: 1.7; margin: 0 0 4mm; }
.row { display: flex; justify-content: center; align-items: flex-end; gap: ${GAP}mm; margin: 0 0 4mm; }
.row.mid { align-items: center; }
figure { margin: 0; display: grid; justify-items: center; gap: 1mm; }
figure img { object-fit: cover; display: block; }
figcaption { font-family: 'BIZ UDMincho', serif; font-size: 10pt; }
small { font-size: 8.5pt; color: #b0413e; }
</style>
${panel('今：高さをそろえる', '2枚の高さを同じにする。縦長の図は幅が狭くなり、小さく見える。', row(now))}
${panel('案1：見た目の大きさをそろえる', '2枚の面積を同じにする（縦長は縦に長く、横長は横に長く）。下とタイトルの行はそろえる。', row(area))}
${panel('案2：幅をそろえる', '2枚の幅を同じにする。縦長の図がいちばん大きくなり、横長の図は低くなる。', row(width))}
${panel('案3：形の違う2枚は並べない', '横長と縦長は、横に並べずに1枚ずつ置く。どちらも大きいが、紙面を多く使う。', row([single[0]]) + row([single[1]]))}
`
if (process.env.ALIGN) html2 = `<!doctype html>` + html.split('</style>')[0].replace('<!doctype html>', '').replace('repeat(4, 172mm)', 'repeat(2, 172mm)') + '</style>' + panel('案1：下そろえ', '写真の下とタイトルの行をそろえる。横長の写真の上が空く。', row(area)) + panel('案1：上下中央そろえ', '写真の上下の真ん中をそろえる。タイトルの高さが2枚で違う。', row(area, 'mid'))
const file = resolve('mockups/v95/_mixed.html')
writeFileSync(file, html2 ?? html)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 2800, height: 1200, deviceScaleFactor: 1 })
  await page.goto(`file:///${file.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 800))
  const box = await page.evaluate(() => { const r = document.body.getBoundingClientRect(); return { x: 0, y: 0, width: Math.ceil(r.width), height: Math.ceil(document.body.scrollHeight) } })
  await page.setViewport({ width: box.width, height: box.height, deviceScaleFactor: 1 })
  await page.screenshot({ path: join(OUT, process.env.ALIGN ? '比較_案1の下そろえと中央そろえ.png' : '比較_横長と縦長の並べ方.png'), fullPage: true })
})
rmSync(file)
console.log({ now: now.map((f) => [round(f.w), round(f.h)]), area: area.map((f) => [round(f.w), round(f.h)]), width: width.map((f) => [round(f.w), round(f.h)]) })
