// mockups/v65：右下の帯で「元に戻す」「やり直す」が表示の道具（1ページ・見開き・拡大・－ ％ ＋・‹ ›）とくっついていて、
// 表示を元に戻すボタンと勘違いしないか（依頼者の心配 2026-10-26）。分け方の案。
// 本物のツール（開発サーバー）を開き、帯の部品を並べ替えて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v65-undo-bar.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v65/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CSS = `
  /* 案A：帯を2つに分ける（左：元に戻す・やり直す、右：表示。右の帯の始めに「表示」） */
  .view-bar.mock-split { background: none; border: 0; box-shadow: none; padding: 0; gap: 12px; }
  .mock-split .undo-redo, .mock-split .mock-view { display: flex; align-items: center; gap: 2px; padding: 3px; background: rgba(255, 255, 255, 0.92); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--float-shadow); }
  .mock-split .undo-redo { border-right: 1px solid var(--line); margin-right: 0; padding-right: 3px; }
  .mock-label { align-self: stretch; display: grid; place-items: center; padding: 0 8px 0 8px; margin-right: 2px; border-right: 1px solid var(--line); font-size: 11.5px; font-weight: 700; color: #6b6f78; }
  /* 案C：帯は1つのまま、表示の道具の前に「表示」 */
  .mock-one .undo-redo { border-right: 2px solid #c9ccd3; padding-right: 6px; margin-right: 4px; }
  /* 案B：元に戻す・やり直すを、左の道具のいちばん下へ */
  .mock-pal { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
  .mock-pal .tb { flex-direction: column !important; width: 100% !important; padding: 6px 0 !important; gap: 3px !important; font-size: 11px !important; }
`

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1.5 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
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
  await ready()
  // 1段大きく（125%）した表示で撮る（帯に「－ 125% ＋」と「‹ ›」が出る）
  await page.evaluate(() => window.__editor.zoomStep(1))
  await sleep(900)
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.mouse.move(5, 5)
  await sleep(300)

  const bottomClip = async () => {
    return page.evaluate((() => { const b = document.querySelector('.view-bar').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); const x = Math.max(s.left, b.left - 60); return { x, y: b.top - 22, width: s.right - x - 12, height: b.height + 40 } }))
  }
  const shot = async (name) => {
    await page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    await page.screenshot({ path: join(OUT, `${name}-bar.png`), clip: await bottomClip(), captureBeyondViewport: false })
  }

  await shot('now')

  // 案A：2つに分ける
  await page.evaluate(() => {
    const bar = document.querySelector('.view-bar')
    const undo = bar.querySelector('.undo-redo')
    const rest = document.createElement('div')
    rest.className = 'mock-view'
    rest.innerHTML = '<span class="mock-label">表示</span>'
    while (undo.nextSibling) rest.append(undo.nextSibling)
    bar.append(rest)
    bar.classList.add('mock-split')
  })
  await sleep(200)
  await shot('A-split')
  await context.close()

  // 案B・C は、ページを開き直して撮る（React の部品を並べ替えたので）
  const again = await browser.createBrowserContext()
  const p2 = await again.newPage()
  await p2.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
    } catch {}
  })
  await stubConfig(p2)
  await p2.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1.5 })
  await p2.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
  const ready2 = () => p2.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready2()
  await p2.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await p2.evaluate(() => document.querySelector('.g-opts button').click())
  await p2.waitForSelector('.guide.step-word .g-word-opt.no')
  await p2.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await p2.waitForSelector('.guide .g-later')
  await p2.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready2()
  await p2.evaluate(setupWriting)
  await sleep(600)
  await ready2()
  await p2.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await ready2()
  await p2.evaluate(() => window.__editor.zoomStep(1))
  await sleep(900)
  await ready2()
  await p2.addStyleTag({ content: CSS })
  await p2.mouse.move(5, 5)
  await sleep(300)
  const shot2 = async (name) => {
    await p2.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    const r = await p2.evaluate((() => { const b = document.querySelector('.view-bar').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); const x = Math.max(s.left, b.left - 60); return { x, y: b.top - 22, width: s.right - x - 12, height: b.height + 40 } }))
    await p2.screenshot({ path: join(OUT, `${name}-bar.png`), clip: r, captureBeyondViewport: false })
  }
  // 案C：1つの帯のまま、表示の道具の前に「表示」
  await p2.evaluate(() => {
    const bar = document.querySelector('.view-bar')
    bar.classList.add('mock-one')
    const label = document.createElement('span')
    label.className = 'mock-label'
    label.textContent = '表示'
    bar.querySelector('.undo-redo').after(label)
  })
  await sleep(200)
  await shot2('C-label')
  // 案B：元に戻す・やり直すを、左の道具のいちばん下へ（帯は表示だけ）
  await p2.evaluate(() => {
    const bar = document.querySelector('.view-bar')
    bar.classList.remove('mock-one')
    bar.querySelector('.mock-label')?.remove()
    const undo = bar.querySelector('.undo-redo')
    const group = document.createElement('div')
    group.className = 'mock-pal'
    for (const b of undo.querySelectorAll('.tb')) group.append(b)
    undo.remove()
    const pal = document.querySelector('.palette')
    ;(pal.querySelector('.palette-inner') ?? pal).append(group)
  })
  await sleep(300)
  await p2.screenshot({ path: join(OUT, 'B-palette.png'), captureBeyondViewport: false })
  const pr = await p2.evaluate(() => { const r = document.querySelector('.palette').getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: r.width + 16, height: Math.min(innerHeight, r.bottom + 8) - Math.max(0, r.top - 8) } })
  await p2.screenshot({ path: join(OUT, 'B-palette-crop.png'), clip: pr, captureBeyondViewport: false })
  const r = await p2.evaluate((() => { const b = document.querySelector('.view-bar').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); const x = Math.max(s.left, b.left - 60); return { x, y: b.top - 22, width: s.right - x - 12, height: b.height + 40 } }))
  await p2.screenshot({ path: join(OUT, 'B-palette-bar.png'), clip: r, captureBeyondViewport: false })
  console.log('palette height', pr.height)
  await again.close()
  console.log('ok')
})
