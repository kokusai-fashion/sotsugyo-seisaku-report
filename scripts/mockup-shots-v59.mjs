// mockups/v59：パソコンの「拡大」の倍率を変えられるようにする案（依頼者の要望 2026-10-25：拡大の倍率をいじれない）。
// 本物のツール（開発サーバー）を開き、右下の「表示の大きさ」の所に案ごとの部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-shots-v59.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v59/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CSS = `
  .mock-zoom { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; padding-left: 6px; border-left: 1px solid var(--line, #ddd); }
  .mock-zoom button { min-width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; font-size: 18px; font-weight: 700; color: var(--accent, #27367a); }
  .mock-zoom button:hover { background: #eef1fa; }
  .mock-zoom b { min-width: 46px; text-align: center; font-size: 13.5px; font-variant-numeric: tabular-nums; }
  .mock-pop { position: absolute; right: 0; bottom: calc(100% + 10px); display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(20, 20, 30, .18); }
  .mock-pop button { border: 0; border-radius: 8px; padding: 7px 18px; background: transparent; font-size: 13.5px; text-align: left; white-space: nowrap; }
  .mock-pop button.on { background: #e7ebf8; color: var(--accent, #27367a); font-weight: 700; }
  .mock-slider { display: inline-flex; align-items: center; gap: 8px; margin-left: 6px; padding-left: 8px; border-left: 1px solid var(--line, #ddd); font-size: 13px; }
  .mock-slider input { width: 120px; accent-color: var(--accent, #27367a); }
  .mock-tip { position: absolute; right: 8px; bottom: calc(100% + 10px); padding: 7px 12px; border-radius: 9px; background: #2b2e36; color: #fff; font-size: 12.5px; white-space: nowrap; }
`

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
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
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await sleep(500)
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes('拡大')).click())
  await sleep(900)
  await ready()
  await page.mouse.move(5, 5)

  const bar = async () => {
    const r = await page.evaluate(() => {
      const b = document.querySelector('.view-bar').getBoundingClientRect()
      return { x: b.left, y: b.top, w: b.width, h: b.height }
    })
    return r
  }
  const clipAround = async (extraTop = 150) => {
    const b = await bar()
    return { x: Math.max(0, b.x - 420), y: Math.max(0, b.y - extraTop), width: Math.min(1440, b.x + b.w + 20) - Math.max(0, b.x - 420), height: Math.min(900, b.y + b.h + 16) - Math.max(0, b.y - extraTop) }
  }
  const reset = () => page.evaluate(() => document.querySelectorAll('.mock-zoom, .mock-pop, .mock-slider, .mock-tip').forEach((e) => e.remove()))

  // いま
  await page.screenshot({ path: `${OUT}/0-now.png`, clip: await clipAround() })
  await page.screenshot({ path: `${OUT}/0-now-full.png` })

  // 案A：拡大しているときだけ、「拡大」の右に「－ 125% ＋」
  await page.evaluate(() => {
    const z = document.querySelector('.view-bar .zoom')
    const m = document.createElement('div')
    m.className = 'mock-zoom'
    m.innerHTML = '<button title="小さく">－</button><b>125%</b><button title="大きく">＋</button>'
    z.after(m)
  })
  await page.screenshot({ path: `${OUT}/A-buttons.png`, clip: await clipAround() })
  await reset()

  // 案B：「拡大」を押すと、倍率を選ぶ小さな窓（100%〜200%）
  await page.evaluate(() => {
    // 「拡大」のボタンの上に、画面に固定して出す（帯の置き方は変えない）
    const z = [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes('拡大')).getBoundingClientRect()
    const p = document.createElement('div')
    p.className = 'mock-pop'
    p.style.cssText = `position: fixed; right: ${innerWidth - z.right}px; bottom: ${innerHeight - z.top + 8}px; z-index: 50`
    p.innerHTML = ['幅に合わせる', '125%', '150%', '175%', '200%'].map((t, i) => `<button class="${i === 1 ? 'on' : ''}">${t}</button>`).join('')
    document.body.append(p)
  })
  await page.screenshot({ path: `${OUT}/B-menu.png`, clip: await clipAround(330) })
  await reset()

  // 案C：拡大しているときだけ、つまみ（スライダー）
  await page.evaluate(() => {
    const z = document.querySelector('.view-bar .zoom')
    const m = document.createElement('label')
    m.className = 'mock-slider'
    m.innerHTML = '<input type="range" min="100" max="200" step="5" value="125"><span>125%</span>'
    z.after(m)
  })
  await page.screenshot({ path: `${OUT}/C-slider.png`, clip: await clipAround() })
  await reset()

  // 大きくしたときの見え方（150%。拡大の倍率をそのまま 1.5 倍にした絵。横にもスクロールする）
  await page.evaluate(() => {
    const st = window.__editor.stage
    st.setFreeZoom(st.scale * 1.5)
  })
  await sleep(900)
  await page.evaluate(() => {
    const z = document.querySelector('.view-bar .zoom')
    const m = document.createElement('div')
    m.className = 'mock-zoom'
    m.innerHTML = '<button>－</button><b>150%</b><button>＋</button>'
    z.after(m)
  })
  await page.screenshot({ path: `${OUT}/D-150-full.png` })
  await context.close()
  console.log('ok')
})
