// mockups/v108（2026-11-04）：「先生の許可」を使うコースの、学生の側の表示の見本（依頼者：抄録は先生の許可のあとに書く・提出は許可のあとに出す）
//   ① 抄録のページ：今（許可を使わないコース）／許可を待っている／許可が出た
//   ② PDF の窓：最終提出の許可の前（点検用）／許可のあと（提出用）／許可のあとに書き換えた
//   本物のツール（見本の原稿なし）で撮り、案内・窓の中身だけを差し替える。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v108-student-permission.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v108'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

// 紙面の中の部品は、組んだときの見た目を写して出している（documentCss の決まりは、差し替えた部品には効かない）ので、ここで同じ見た目を付ける
const CSS = `
.abstract-lock b.mk{display:block;font-size:11pt;margin-bottom:2mm}
.abstract-lock span.mk{display:block;font-size:9pt;color:#6b7290;margin-bottom:6mm}
.abstract-lock .mk-start{display:inline-block;margin:0;padding:3mm 8mm;border-radius:2.5mm;background:#2f3e75;color:#fff;font-size:10.5pt;font-weight:700}
.abstract-lock .mk-wait{display:inline-block!important;margin:0 0 3mm!important;padding:2.5mm 7mm;border-radius:2.5mm;background:#e9ebf2;color:#4a5170!important;font-size:10.5pt!important;font-weight:700}
.abstract-lock .mk-recheck{display:block;margin:0!important;color:#2f3e75!important;font-size:9pt!important;text-decoration:underline;cursor:pointer}
.abstract-lock b.mk-ok{color:#1e6b34}
.mk-perm{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;align-items:start;padding:11px 14px;border-radius:12px;margin:2px 0 12px;font-size:13.5px;line-height:1.7}
.mk-perm.wait{background:#fdf4f3;border:1px solid #f0cdc8}
.mk-perm.ok{background:#eff7f0;border:1px solid #c7e3cb}
.mk-perm .mark{grid-row:span 2;align-self:center;display:block;width:max-content;min-width:max-content;box-sizing:content-box;font-weight:700;letter-spacing:.12em;font-size:12px;height:1.6em;line-height:1.6em;padding:1px 6px 1px calc(6px + .12em);border:1.5px solid #c62828;border-radius:0;color:#c62828;background:#fff;white-space:nowrap}
.mk-perm .okmark{grid-row:span 2;align-self:center;width:26px;height:26px;border-radius:50%;background:#2e7d32;color:#fff;display:grid;place-items:center;font-weight:700}
.mk-perm b{font-size:14px}
.mk-perm p{margin:0;color:#3c4253}
.mk-edited{margin:-4px 0 12px;font-size:12.5px;color:#7a5200;background:#fff7e0;border-radius:8px;padding:6px 12px;line-height:1.6}
`

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.5 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await sleep(1200)
  await ready()
  await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  await sleep(500)
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', subtitleInput: 'シンドバッド' } })))
  await sleep(900)
  await ready()
  await page.addStyleTag({ content: CSS })
  return { context, page, ready }
}

const LOCK = {
  今: null,
  待っている: `<b class="mk">抄録は、先生の許可が出てから書きます。</b><span class="mk">このコースでは、先生が点検表で許可すると、ここで書けるようになります（それまで、このページは PDF には入りません）。</span><span class="mk-wait">先生の許可を待っています</span><span class="mk-recheck">許可が出たか、確かめ直す</span>`,
  許可が出た: `<b class="mk mk-ok">先生の許可が出ました（12/15　小川先生）</b><span class="mk">下のボタンを押すと、抄録を書き始められます。</span><span class="mk-start">抄録を書き始める</span>`,
}

const PERM = {
  許可の前: {
    box: `<div class="mk-perm wait"><span class="mark">点検用</span><b>最終提出の許可は、まだ出ていません</b><p>この PDF は点検用です。各ページの右上に「点検用」の印が入ります。途中の点検には、このまま使えます。教務課へは、先生の許可のあとに作る PDF を出します。</p></div>`,
    file: '00ZZ0123_文化花子_点検用.pdf',
  },
  許可のあと: {
    box: `<div class="mk-perm ok"><span class="okmark">✓</span><b>最終提出の許可が出ています（1/13　山本先生）</b><p>印のない、提出用の PDF を作ります。教務課の提出フォームから、この PDF を出してください。</p></div>`,
    file: '00ZZ0123_文化花子.pdf',
  },
  許可のあとに書き換えた: {
    box: `<div class="mk-perm ok"><span class="okmark">✓</span><b>最終提出の許可が出ています（1/13　山本先生）</b><p>印のない、提出用の PDF を作ります。教務課の提出フォームから、この PDF を出してください。</p></div><p class="mk-edited">許可のあとに書き換えました（1/14）。先生の点検表にも、書き換えたことが出ます。</p>`,
    file: '00ZZ0123_文化花子.pdf',
  },
}

await withEdge(async (browser) => {
  // ① 抄録のページ
  const { context, page, ready } = await open(browser)
  await page.evaluate(() => window.__editor.goToPage(1, 'none'))
  await sleep(900)
  await ready()
  for (const [key, html] of Object.entries(LOCK)) {
    if (html) await page.evaluate((html) => document.querySelectorAll('.abstract-lock').forEach((el) => (el.innerHTML = html)), html)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/①抄録のページ_${key}.png` })
  }

  // ② PDF の窓（直すところ・まだのところのない形にして、許可の知らせを足す）
  for (const [key, v] of Object.entries(PERM)) {
    await page.evaluate(() => document.querySelector('.side button.export')?.click())
    await page.waitForSelector('.modal .pdf-file', { timeout: 30000 })
    await sleep(500)
    await page.evaluate((v) => {
      const modal = document.querySelector('.modal')
      const file = modal.querySelector('.pdf-file')
      file.querySelector('.fn').textContent = v.file
      const head = modal.querySelector('header')
      ;[...modal.children].filter((el) => el !== head).forEach((el) => el.remove())
      const lead = document.createElement('p')
      lead.className = 'lead'
      lead.textContent = '直すところ・まだのところはありません。'
      const perm = document.createElement('div')
      perm.innerHTML = v.box
      const rows = document.createElement('div')
      rows.className = 'row-buttons'
      rows.innerHTML = `<button class="link pdf-fallback">うまくいかないとき：印刷の画面から保存</button><span class="spacer"></span><button>やめる</button><button class="primary pdf-start">PDF を保存する</button>`
      modal.append(lead, ...perm.childNodes, file, rows)
    }, v)
    await sleep(300)
    // 「点検用」の字が枠のまん中にあるか（字の形の左右・上下の余白を測る）
    const gaps = await page.evaluate(() => {
      const mark = document.querySelector('.mk-perm .mark')
      if (!mark) return null
      const box = mark.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(mark)
      const rects = [...range.getClientRects()]
      // 最後の字のうしろの字間は字の形ではないので、字の形の右端は「字の箱の右端 − 字間」
      const ls = parseFloat(getComputedStyle(mark).letterSpacing) || 0
      const left = Math.min(...rects.map((r) => r.left)) - box.left
      const right = box.right - (Math.max(...rects.map((r) => r.right)) - ls)
      const top = Math.min(...rects.map((r) => r.top)) - box.top
      const bottom = box.bottom - Math.max(...rects.map((r) => r.bottom))
      return { left: left.toFixed(1), right: right.toFixed(1), top: top.toFixed(1), bottom: bottom.toFixed(1) }
    })
    if (gaps) console.log(key, 'mark gaps', JSON.stringify(gaps))
    await page.screenshot({ path: `${OUT}/②PDFの窓_${key}.png` })
    await page.keyboard.press('Escape')
    await sleep(400)
    await page.evaluate(() => document.querySelector('.modal .close, .modal button[aria-label="閉じる"]')?.click())
    await sleep(400)
  }
  await context.close()
  console.log('ok')
})
