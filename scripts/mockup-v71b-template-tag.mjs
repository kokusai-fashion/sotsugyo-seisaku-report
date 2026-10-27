// mockups/v71 ④ の続き：ひな形を作る画面で、左の道具が「ここに書くこと」の札に重なる（札の左が欠ける）。
// 前の見本の案B（段落の上）は、上の見出しの字に重なったため、作り直した。
//   案A 札を短く「説明」「本文」／案C（おすすめ）札は今のまま、ひな形を作る画面だけ、札を紙の外まで出し（ページの枠で切らない）、左の道具とページを戻す矢印を少し左へ寄せる
// （札が欠けるのは、紙の外にはみ出した所をページの枠［data-vivliostyle-bleed-box］が切っていたため）
// 1366×768 と 1280×720 で撮る。使い方：node scripts/mockup-v71b-template-tag.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v71/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TAG = '.tpl-mode .page-viewport section.body p[data-block-id]:not(:empty)::before'
const CSS = {
  now: '',
  a: `${TAG} { content: '説明' !important; } .tpl-mode .page-viewport section.body p[data-block-id][data-prefilled]:not(:empty)::before { content: '本文' !important; }`,
  c: `.tpl-mode :is([data-vivliostyle-bleed-box], [data-vivliostyle-outer-zoom-box]) { overflow: visible !important; } .tpl-mode .palette { left: calc(50% - var(--page-w) / 2 - 104px - 30px) !important; } .tpl-mode .arrow.prev { left: calc(50% - var(--page-w) / 2 - 104px - 64px - 30px) !important; }`,
}

if (!process.env.SHEET_ONLY)
  await withEdge(async (browser) => {
    for (const [width, height] of [
      [1366, 768],
      [1280, 720],
    ])
      for (const [name, css] of Object.entries(CSS)) {
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        await page.setViewport({ width, height, deviceScaleFactor: 1.5 })
        await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0', timeout: 180000 })
        await page.evaluate(() => {
          localStorage.removeItem('sotsugyo-admin-mock')
          sessionStorage.removeItem('sotsugyo-admin-section')
        })
        await page.reload({ waitUntil: 'networkidle0' })
        await page.waitForSelector('.side-nav')
        await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コース')).click())
        await page.waitForSelector('.course.open .tpl-open')
        await page.evaluate(() => document.querySelector('.course.open .tpl-open').click())
        await page.waitForSelector('.tpl-overlay iframe')
        await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 60000 })
        const frame = page.frames().find((f) => f.url().includes('template=1') && f.parentFrame() === page.mainFrame())
        await frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && s.page === window.__editor.pageOfArea('body') }, { timeout: 90000 })
        await sleep(800)
        // 2つ目の段落を「本文に入る文」に（両方の札を見せる）
        await frame.evaluate(() => {
          window.__editor.update((r) => ({
            ...r,
            body: r.body.map((c, i) => (i === 0 ? { ...c, blocks: c.blocks.map((b, j) => (j === 1 && b.type === 'paragraph' ? { ...b, prefilled: true } : b)) } : c)),
          }))
        })
        await sleep(1200)
        if (css) await frame.addStyleTag({ content: css })
        // 段落を押して、左の道具を「この段落」の形にする
        const p = await frame.$('.page-viewport.front section.body p[data-block-id]:not(:empty)')
        await p.click()
        await frame.waitForSelector('.overlay-editor[data-kind="paragraph"]')
        await sleep(800)
        if (name === 'a') await frame.evaluate(() => document.querySelector('.tpl-editing-tag') && (document.querySelector('.tpl-editing-tag').textContent = '説明'))
        await page.mouse.move(5, 5)
        const clip = width === 1366 ? { x: 120, y: 70, width: 620, height: 420 } : { x: 110, y: 66, width: 590, height: 400 }
        await page.screenshot({ path: join(OUT, `4b-${width}-${name}.png`), clip, captureBeyondViewport: false })
        await context.close()
      }
  })

await sleep(3000)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, p)).toString('base64')}`
  const cols = [
    { h: '今', t: '左の道具が札に重なり、「に書くこと」と欠ける', key: 'now' },
    { h: '案A', t: '札を短く「説明」「本文」にして、紙の余白に収める（道具の名前・右の欄の言葉とは違う言い方になる）', key: 'a' },
    { h: '案C（おすすめ）', t: '札は今のまま。ひな形を作る画面だけ、札を紙の外まで出し、左の道具とページを戻す矢印を少し左へ寄せる', key: 'c' },
  ]
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: 1656px; }
    h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; }
    .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
    .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 6px; color: #4a5060; line-height: 1.6; min-height: 45px; }
    .col small { display: block; margin-top: 10px; font-size: 13px; color: #6a7080; }
    .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 4px; }
  </style><h1>④ ひな形を作る画面：段落の左の札（作り直した案）</h1><p class="sub">前の案B（段落の上）は、上の見出しの字に重なったので、やめました。黄色の札＝ここに書くこと、青い札＝本文に入る文</p>
  <div class="row">${cols
    .map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p><small>1366×768</small><img src="${img(`4b-1366-${c.key}.png`)}"><small>1280×720（ノートパソコン）</small><img src="${img(`4b-1280-${c.key}.png`)}"></div>`)
    .join('')}</div>`
  await page.setViewport({ width: 1700, height: 800 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: 'mockups/v71/4b-template-tag.png', fullPage: true })
})
console.log('できました：mockups/v71/4b-template-tag.png')
