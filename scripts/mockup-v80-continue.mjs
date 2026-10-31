// mockups/v80：図・表・見出しの下の「＋ ここに続きを書く」を、紙面になじむ見た目にする案（依頼者から：存在感が強い。2026-10-31）。
// 本物のツール（開発サーバー）を開き、CSS を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v80-continue.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
// Edge の番号は、読み込む前に決める（edge.mjs は読み込むときに番号を読む。前は 9333 になり、通しテストの Edge を閉じていた）
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v80/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 案ごとの見た目（.continue-row に重ねる CSS）。どれも、押せる範囲（行の高さ）は今のまま */
const LOOKS = {
  now: '',
  // 案A：枠も地もなし。紙面の薄字（ひな形の説明）と同じ色の、ふつうの太さの字だけ。マウスを重ねると下線
  A: `.continue-row { border: 0; background: transparent; color: #5f6b95; font-weight: 400; padding: 0 2px; }
      .continue-row svg { width: 13px; height: 13px; }
      .continue-row:hover { background: transparent; text-decoration: underline; }`,
  // 案B：細い線の区切りに、小さな「＋ 続きを書く」の札（左寄せ）
  B: `.continue-row { border: 0; background: linear-gradient(#d3d8e8, #d3d8e8) left center / 100% 1px no-repeat; color: #5f6b95; font-weight: 500; padding: 0; gap: 0; }
      .continue-row svg { display: none; }
      .continue-row span { background: #fff; border: 1px solid #c9cfe3; border-radius: 999px; padding: 3px 12px 3px 10px; font-size: 12px; }
      .continue-row span::before { content: '＋ '; }`,
  // 案C：今の形のまま、ずっと控えめに（細い点線・地なし・ふつうの太さ・字を薄く）
  C: `.continue-row { border: 1px dashed #cdd2e3; background: transparent; color: #6b7699; font-weight: 400; }
      .continue-row svg { width: 13px; height: 13px; }`,
}

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
  await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1.5 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  // 1章を「デザイン画」の図で終わらせる（章の最後の図で、下が空いているので、選ばなくても「＋ ここに続きを書く」が出る）
  await page.evaluate(() =>
    window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i ? c : { ...c, blocks: c.blocks.slice(0, c.blocks.findIndex((b) => b.id === 'r1') + 1) })) })),
  )
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await sleep(500)
  await ready()
  await page.mouse.move(1400, 790)
  await page.waitForFunction(() => { const b = document.querySelector('.continue-row'); return b && !b.hidden }, { timeout: 15000 })
  // 図の下の部分と「＋ ここに続きを書く」を撮る
  const clip = await page.evaluate(() => {
    const b = document.querySelector('.continue-row').getBoundingClientRect()
    return { x: Math.max(0, b.left - 70), y: Math.max(0, b.top - 330), width: b.width + 140, height: 400 }
  })
  for (const [name, css] of Object.entries(LOOKS)) {
    const tag = css ? await page.addStyleTag({ content: css }) : null
    await sleep(200)
    await page.screenshot({ path: join(OUT, `${name}.png`), clip })
    // マウスを重ねたとき
    if (name !== 'now') {
      const r = await page.evaluate(() => { const b = document.querySelector('.continue-row').getBoundingClientRect(); return { x: b.left + 60, y: b.top + b.height / 2 } })
      await page.mouse.move(r.x, r.y)
      await sleep(250)
      await page.screenshot({ path: join(OUT, `${name}-hover.png`), clip: { ...clip, y: clip.y + 280, height: 120 } })
      await page.mouse.move(1400, 790)
    }
    if (tag) await tag.evaluate((el) => el.remove())
  }
  await context.close()
  await sheet(browser)
})
console.log('done')

/** 並べた絵（同じ Edge で描く。Edge を起動し直すと、まれにつながらないため） */
async function sheet(browser) {
const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
const items = [
  ['now', '今', '点線の枠・薄い青の地・太字の青い字。本文の幅いっぱい'],
  ['A', '案A　字だけ', '枠も地もなし。紙面の薄字と同じ色、ふつうの太さ。マウスを重ねると下線'],
  ['B', '案B　細い線と小さな札', '区切りの細い線に「＋ ここに続きを書く」の小さな札'],
  ['C', '案C　今の形を控えめに', '細く薄い点線、地なし、ふつうの太さ'],
]
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 16px;color:#2b2b2b}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
.card .hover{margin-top:8px;font-size:13px;color:#777}
</style><h1>図・表・見出しの下の「＋ ここに続きを書く」の見え方の案（押せる範囲・出る場所は今のまま）</h1>
<div class="grid">${items.map(([f, t, d]) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}">${f === 'now' ? '' : `<div class="hover">マウスを重ねたとき</div><img src="${img(`${f}-hover`)}">`}</div>`).join('')}</div>`
  const page = await browser.newPage()
  await page.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  const h = await page.evaluate(() => document.body.scrollHeight)
  await page.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
  await page.screenshot({ path: 'mockups/v80/v80-案.png', fullPage: true })
}
