// mockups/v69：余白を管理ページで設定する（依頼者 2026-10-27：データ提出になり綴じ代が要らないので、左右を同じに。余白を設定できるように）。
// ① 紙面：いま（左35・右25）／案1 左右30mm（1行の長さは今と同じ）／案2 左右25mm（1行が10mm長い。38字のまま字の間が広がる）
// ② 管理ページの「詳細設定」に足す欄：案A 数字を並べる／案B 紙の絵のまわりに数字。右の見本は、その余白で出す
// 見た目の案（動きは作っていない）。使い方：node scripts/mockup-v69-margins.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v69/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PT = 72 / 25.4
/** 38字ちょうどで1行が埋まる字間（src/layout/reportCss.ts と同じ式） */
const spacing = (widthMm) => Math.floor(((widthMm * PT - 38 * 11) / 38) * 1000) / 1000

// 見本の本文（架空）。38字×行で組む
const TEXT = [
  '　本制作では、卒業イベント「シンドバッド」において、筆者が担当した衣装の制作について述べる。物語の舞台となる中東の港町の装いをもとに、登場人物の性格が一目で伝わる衣装を目指した。',
  '　まず、物語の時代と地域の服飾について資料を集め、色と形の特徴を整理した。そのうえで、担当した人物の役割に合わせて、色の組み合わせと布の重なりを決めた。',
  '　次に、デザイン画をもとにトワルを組み、舞台での動きを確かめながら、袖の長さと裾の広がりを直した（図1）。',
]
function pageHtml({ left, right, label, note }) {
  const width = 210 - left - right
  return `<figure>
  <figcaption><b>${label}</b><span>${note}</span></figcaption>
  <div class="paper">
    <div class="area" style="left:${left}mm; width:${width}mm; letter-spacing:${spacing(width)}pt">
      <h1>Ⅰ．企画・立案</h1>
      <h2>ⅰ．担当衣装のキャラクター</h2>
      ${TEXT.map((t) => `<p>${t}</p>`).join('')}
      <div class="fig"></div>
      <p class="cap">図1．デザイン画</p>
      ${TEXT.slice(0, 2).map((t) => `<p>${t}</p>`).join('')}
    </div>
    <div class="guide" style="left:${left}mm; width:${width}mm"></div>
    <span class="dim l" style="width:${left}mm">左 ${left}mm</span>
    <span class="dim r" style="width:${right}mm">右 ${right}mm</span>
    <span class="dim w" style="left:${left}mm; width:${width}mm">1行 ${width}mm（38字）</span>
    <span class="no">1</span>
  </div>
</figure>`
}
const PAGES_HTML = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=BIZ+UDMincho&family=BIZ+UDPGothic:wght@400;700&display=swap" rel="stylesheet">
<style>
body { margin: 0; padding: 28px 30px 34px; background: #eef0f4; font-family: 'BIZ UDPGothic', sans-serif; display: flex; gap: 34px; }
figure { margin: 0; }
figcaption { display: grid; align-content: start; gap: 4px; min-height: 92px; margin: 0 0 12px; font-size: 19px; color: #3a4150; line-height: 1.5; }
figcaption b { font-size: 22px; color: #1e3a8a; }
figure:first-child figcaption b { color: #5b6170; }
.paper { position: relative; width: 210mm; height: 297mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.15); overflow: hidden; }
.area { position: absolute; top: 25mm; height: 247mm; font-family: 'BIZ UDMincho', serif; font-size: 11pt; line-height: 18.4pt; text-align: justify; text-justify: inter-character; line-break: strict; overflow: hidden; }
.area h1, .area h2 { font: inherit; margin: 0; }
.area p { margin: 0; }
.area .fig { width: 100mm; height: 62mm; margin: 4mm auto 1mm; outline: 1px dashed #b9b9b9; background: repeating-linear-gradient(45deg, #f6f6f6 0 8px, #efefef 8px 16px); }
.area .cap { text-align: center; }
.guide { position: absolute; top: 25mm; height: 247mm; outline: 1.5px dashed #d0453a; pointer-events: none; }
.dim { position: absolute; top: 9mm; text-align: center; font-size: 15px; color: #c0392b; font-weight: 700; }
.dim.l { left: 0; }
.dim.r { right: 0; }
.dim.w { top: 274mm; color: #1e3a8a; }
.no { position: absolute; left: 0; right: 0; top: 282mm; text-align: center; font-family: 'BIZ UDMincho', serif; font-size: 11pt; }
</style>
${pageHtml({ left: 35, right: 25, label: 'いま：左35mm・右25mm', note: '左は綴じ代の分だけ広い' })}
${pageHtml({ left: 30, right: 30, label: '案1：左右30mm', note: '1行の長さ・ページの区切りは今と同じ。<br>紙の真ん中に寄るだけ' })}
${pageHtml({ left: 25, right: 25, label: '案2：左右25mm', note: '1行が10mm長い。38字のまま字の間が広がる。<br>書いている学生のページの区切りが変わる' })}`

/** 管理ページの「詳細設定」に足す欄 */
const CARD_A = `<div class="card mock-margin"><h2 class="card-h">ページの余白</h2><div class="grid">
  <label class="lb">余白<small>本文・抄録・目次</small></label>
  <div class="ctl"><span class="range mrow"><span>上<input class="in num" value="25">mm</span><span>下<input class="in num" value="25">mm</span><span>左右<input class="in num" value="30">mm</span></span>
  <div class="hint">1ページ38字×38行のまま、字の間と行の間で合わせます。表紙と作品写真のページは変わりません</div></div>
</div></div>`
const CARD_B = `<div class="card mock-margin"><h2 class="card-h">ページの余白</h2><div class="grid">
  <label class="lb">余白<small>本文・抄録・目次</small></label>
  <div class="ctl"><div class="mpage">
    <span class="t">上<input class="in num" value="25">mm</span>
    <span class="s">左右<input class="in num" value="30">mm</span>
    <div class="sheet"><div class="txt">38字×38行</div></div>
    <span class="b">下<input class="in num" value="25">mm</span>
  </div>
  <div class="hint">1ページ38字×38行のまま、字の間と行の間で合わせます。表紙と作品写真のページは変わりません</div></div>
</div></div>`
const CARD_CSS = `
.mock-margin input.in.num { width: 66px !important; margin: 0 4px 0 6px; }
.mrow { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.mrow > span { white-space: nowrap; display: inline-flex; align-items: center; }
.mpage { display: grid; grid-template-columns: auto 150px; grid-template-rows: auto auto auto; gap: 6px 14px; align-items: center; justify-items: center; width: max-content; }
.mpage .t { grid-column: 2; grid-row: 1; }
.mpage .s { grid-column: 1; grid-row: 2; }
.mpage .sheet { grid-column: 2; grid-row: 2; position: relative; width: 120px; height: 170px; background: #fff; border: 1px solid #c9ced8; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.mpage .sheet .txt { position: absolute; left: 17px; right: 17px; top: 14px; bottom: 14px; border: 1.5px dashed #d0453a; display: grid; place-items: center; font-size: 12px; color: #6b7280; background: repeating-linear-gradient(#fff 0 6px, #eef0f4 6px 7px); }
.mpage .b { grid-column: 2; grid-row: 3; }
`

await withEdge(async (browser) => {
  // ① 紙面の3つ
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 30 * 2 + 794 * 3 + 34 * 2, height: 1260, deviceScaleFactor: 0.62 })
    await page.setContent(PAGES_HTML, { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.fonts.ready)
    await sleep(800)
    await page.screenshot({ path: join(OUT, 'pages.png'), fullPage: true })
    await page.close()
  }

  // ② 管理ページの「詳細設定」（右の見本は、本文の1ページ目を、左右30mmで）
  for (const [name, card] of [
    ['now-details', null],
    ['a-details', CARD_A],
    ['b-details', CARD_B],
  ]) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
    await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await page.evaluate(() => {
      localStorage.removeItem('sotsugyo-admin-mock')
      sessionStorage.removeItem('sotsugyo-admin-section')
      localStorage.setItem('sotsugyo-admin-preview-view', 'single')
    })
    await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.admin .side-nav button')
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
    await sleep(1500)
    await page.evaluate(() => [...document.querySelectorAll('.badge')].filter((b) => b.textContent.includes('試験用')).forEach((b) => b.remove()))
    // 見本を本文の1ページ目へ
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => document.querySelector('.stage .pv-turn[aria-label^="次"]')?.click())
      await sleep(400)
    }
    if (card) {
      await page.addStyleTag({ content: CARD_CSS })
      await page.evaluate((html) => {
        const cards = [...document.querySelectorAll('.content .card')]
        const amount = cards.find((c) => c.querySelector('.card-h')?.textContent.includes('分量'))
        amount.insertAdjacentHTML('beforebegin', html)
        amount.previousElementSibling.scrollIntoView({ block: 'start' })
        document.querySelector('.content').scrollBy(0, -16)
        // 見本の本文を、左右30mm に（1行の長さは同じ）。余白の線も引く
        const doc = document.querySelector('.stage iframe').contentDocument
        const style = doc.createElement('style')
        const pitch = (210 * 96) / 25.4 + 16
        style.textContent = `.flow { left: calc(${pitch * 2}px + 30mm) !important; }
          .mock-guide { position: absolute; top: 25mm; height: 247mm; width: 150mm; left: calc(${pitch * 2}px + 30mm); outline: 2px dashed #d0453a; pointer-events: none; z-index: 5; }
          .mock-dim { position: absolute; top: 10mm; font: 700 13pt 'BIZ UDPGothic', sans-serif; color: #c0392b; z-index: 5; width: 30mm; text-align: center; }`
        doc.head.append(style)
        const rail = doc.querySelector('.rail')
        rail.insertAdjacentHTML('beforeend', `<div class="mock-guide"></div><span class="mock-dim" style="left:${pitch * 2}px">30mm</span><span class="mock-dim" style="left:calc(${pitch * 2}px + 180mm)">30mm</span>`)
      }, card)
      await sleep(600)
    }
    await page.screenshot({ path: join(OUT, `${name}.png`) })
    await context.close()
  }
})
console.log(`${OUT} に撮りました`)
