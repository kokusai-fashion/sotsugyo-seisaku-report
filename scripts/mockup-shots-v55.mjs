// デザイン案 v55（パソコンでの試し 2026-10-24 の、見た目が変わるもの）の画像を撮る。
// 開発用のサーバー（http://localhost:5173）を開いておき、EDGE_PORT=9335 node scripts/mockup-shots-v55.mjs
// ① 画面の下の知らせが「元に戻す・やり直す」の帯に重なる ② 低い画面の並べ方のボタン ③ 図を入れた直後のタイトルの欄 ④ 小さい窓の紙面
import { mkdirSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v55/shots'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(browser, width, height, { scale = 1, panels = null } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument((panels) => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
      localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0')
      if (panels) localStorage.setItem('sotsugyo-seisaku-report-panels', panels)
    } catch {}
  }, panels ? JSON.stringify(panels) : null)
  await stubConfig(page)
  await page.setViewport({ width, height, deviceScaleFactor: scale })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide.step-studentId')
  await ready()
  await page.evaluate(() => document.querySelector('.g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(600)
  await ready()
  return { context, page, ready }
}

/** 案のための見た目を足す（id ごとに差し替える） */
const style = (page, css) =>
  page.evaluate((css) => {
    let el = document.getElementById('mock-style')
    if (!el) {
      el = document.createElement('style')
      el.id = 'mock-style'
      document.head.append(el)
    }
    el.textContent = css
  }, css)

const clip = async (page, file, region) => page.screenshot({ path: `${OUT}/${file}.png`, clip: region })

await withEdge(async (browser) => {
  // ---- ① 知らせと「元に戻す・やり直す」の帯 ----
  {
    const { context, page, ready } = await open(browser, 1440, 900)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p4'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.removeBlock('p4'))
    await wait(1500)
    await ready()
    // 残りの時間の線を止める（撮るたびに長さが変わらないように）
    const base = '.undo-toast { animation: none !important; } .undo-toast .undo-timer span { animation: none !important; transform: scaleX(0.7); }'
    const region = { x: 300, y: 560, width: 800, height: 340 }
    await style(page, base)
    await clip(page, '1-now', region)
    // 案A：帯のすぐ上
    await style(page, `${base} .stage .undo-area.on-stage { bottom: 66px; }`)
    await clip(page, '1-A', region)
    // 案B：帯の左に並べる
    const bar = await page.evaluate(() => { const r = document.querySelector('.view-bar').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); return { right: s.right - r.left } })
    await style(page, `${base} .stage .undo-area.on-stage { left: auto; right: ${Math.round(bar.right + 10)}px; transform: none; bottom: 16px; width: min(360px, calc(100% - ${Math.round(bar.right + 30)}px)); }`)
    await clip(page, '1-B', region)
    // 案C：紙面の上（画面の上）
    await style(page, `${base} .stage .undo-area.on-stage { bottom: auto; top: 14px; }`)
    await page.screenshot({ path: `${OUT}/1-C.png`, clip: { x: 300, y: 0, width: 800, height: 340 } })
    await context.close()
  }

  // ---- ② 低い画面（1280×720）の並べ方のボタン ----
  {
    const { context, page, ready } = await open(browser, 1280, 720, { scale: 2 })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 2, columns: 2, imageIds: ['g-photo1', 'g-design'] }] })))
    await wait(500)
    await ready()
    const last = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.length - 1)
    await page.evaluate((p) => window.__editor.goToPage(p, 'none'), last)
    await ready()
    await page.evaluate(() => window.__editor.select({ kind: 'photos', page: 0 }))
    await wait(500)
    const pal = await page.evaluate(() => { const r = document.querySelector('.palette').getBoundingClientRect(); return { x: Math.max(0, r.left - 14), y: Math.max(0, r.top - 10), width: r.width + 28, height: Math.min(720 - r.top + 10, r.height + 20) } })
    await style(page, '')
    await clip(page, '2-now', pal)
    // 案A：低い画面では「2枚」の代わりに「左右」「上下」と書く
    await style(page, '@media (max-height: 760px) { .app:not(.phone) .palette .lay:has(.lay-sub) .lay-n { display: none; } .app:not(.phone) .palette .lay .lay-sub { display: inline; font-size: 10.5px; color: inherit; } }')
    await clip(page, '2-A', pal)
    // 案B：絵を小さくして、「2枚」の下に小さく「左右」「上下」
    await style(page, '@media (max-height: 760px) { .app:not(.phone) .palette .lay .lay-sub { display: inline; } .app:not(.phone) .palette .lay { gap: 1px; padding: 3px 0; } .app:not(.phone) .palette .lay-grid { width: 11px; height: 15px; margin-bottom: 0; } }')
    await clip(page, '2-B', pal)
    await context.close()
  }

  // ---- ③ 図を入れた直後のタイトルの欄 ----
  {
    const { context, page, ready } = await open(browser, 1440, 900, { scale: 2 })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === 'figureRow' && b.id === 'r1' ? { ...b, figures: b.figures.map((f) => ({ ...f, caption: '' })) } : b)) })) })))
    await wait(500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('f1'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('f1', 0))
    await wait(800)
    const cap = await page.evaluate(() => { const r = document.querySelector('.overlay-clip:not([hidden]) .overlay-editor').getBoundingClientRect(); return { x: r.left + r.width / 2 - 260, y: r.top - 230, width: 520, height: 330 } })
    await style(page, '')
    await clip(page, '3-now', cap)
    // 案A：書く欄に薄い字（打つと消える）
    await page.evaluate(() => document.querySelector('.overlay-clip:not([hidden]) .overlay-editor').setAttribute('data-mock-ph', '（図のタイトルを入力。例：デザイン画）'))
    await style(page, '.overlay-editor[data-mock-ph]::after { content: attr(data-mock-ph); color: #b3a99b; pointer-events: none; }')
    await clip(page, '3-A', cap)
    await page.evaluate(() => document.querySelector('.overlay-clip:not([hidden]) .overlay-editor').removeAttribute('data-mock-ph'))
    // 案B：欄のすぐ下に吹き出し
    await style(page, '')
    await page.evaluate(() => {
      const ed = document.querySelector('.overlay-clip:not([hidden]) .overlay-editor').getBoundingClientRect()
      const tip = document.createElement('div')
      tip.id = 'mock-tip'
      tip.textContent = '図のタイトル（例：デザイン画）を入れて Enter'
      tip.style.cssText = `position:fixed;z-index:60;left:${ed.left + ed.width / 2}px;top:${ed.bottom + 10}px;transform:translateX(-50%);padding:7px 12px;border-radius:10px;background:#2f3e75;color:#fff;font:13px 'BIZ UDPGothic',sans-serif;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.2)`
      document.body.append(tip)
    })
    await clip(page, '3-B', cap)
    await context.close()
  }

  // ---- ④ 小さい窓（1100×700）の紙面 ----
  // 案A：狭いときは、‹ › を右下（見開き・拡大のときと同じ所）に移し、その分の余白を空けない／案B：ページの一覧と右の欄を細くする／案C：両方
  const NARROW = '.app:not(.phone) .stage:not(.zoomed):not(.spread) { --inset-side: 112px; } .app:not(.phone) .stage:not(.zoomed):not(.spread) .arrow.prev { left: auto; right: 87px; top: auto; bottom: 68px; translate: none; } .app:not(.phone) .stage:not(.zoomed):not(.spread) .arrow.next { left: auto; right: 31px; top: auto; bottom: 68px; translate: none; }'
  for (const [name, panels, css] of [
    ['4-now', null, ''],
    ['4-A', null, NARROW],
    ['4-B', { left: 96, right: 290 }, ''],
    ['4-C', { left: 96, right: 290 }, NARROW],
  ]) {
    const { context, page, ready } = await open(browser, 1100, 700, { panels })
    if (css) {
      await style(page, css)
      await page.evaluate(() => window.dispatchEvent(new Event('resize')))
      await wait(700)
    }
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    await wait(300)
    await clip(page, name, { x: 0, y: 0, width: 1100, height: 700 })
    const paper = await page.evaluate(() => Math.round([...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container]')].find((e) => e.classList.contains('is-current'))?.getBoundingClientRect().width ?? 0))
    console.log(name, '紙面の幅', paper)
    await context.close()
  }
})
console.log('撮りました')
