// mockups/v67：箇条書きの道具を用意するとしたら（依頼者の質問 2026-10-27）。
// 本物のツール（開発サーバー）の紙面と左の道具に、箇条書きの見た目を足して撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v67-list.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v67/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ITEMS = ['袖：風をはらむように大きく膨らませ、肘から下は細くして、腕を動かしやすくした', '帯：幅の広い布を腰に二重に巻く', '刺繍：波の模様を金の糸で入れる']

const CSS = `
  .mock-list { margin: 0; }
  .mock-li { text-indent: 0 !important; position: relative; margin: 0; }
  .mock-li .mk { position: absolute; left: 0; top: 0; }
  .mock-li.bullet { padding-left: 1em; }
  .mock-li.number { padding-left: 1.25em; }
  .mock-li.indent.bullet { padding-left: 2em; }
  .mock-li.indent.bullet .mk { left: 1em; }
  .mock-li.indent.number { padding-left: 2.25em; }
  .mock-li.indent.number .mk { left: 1em; }
  .mock-hl { outline: 2px dashed #d03b3b; outline-offset: 3px; border-radius: 2px; }
  .mock-tb { position: relative; }
  .mock-tb.on { background: var(--accent-soft, #e8ecf7); }
  .mock-menu { position: fixed; z-index: 500; writing-mode: horizontal-tb; background: #fff; border: 1px solid #d8dbe2; border-radius: 10px; box-shadow: 0 10px 28px rgba(20, 25, 40, 0.18); padding: 6px; display: flex !important; flex-direction: column; gap: 2px; width: 236px; grid-template-columns: none !important; }
  .mock-menu button { all: unset; box-sizing: border-box; cursor: default; width: 100%; white-space: nowrap; display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 6px; text-align: left; border: 0; background: none; padding: 8px 8px; border-radius: 7px; font-size: 13px; color: #222; }
  .mock-menu button.on { background: #eef1f8; font-weight: 700; }
  .mock-menu button b { font-family: 'BIZ UDMincho', serif; font-size: 15px; text-align: center; font-weight: 400; }
  .mock-menu small { grid-column: 1 / 3; color: #6b6f78; font-size: 11.5px; padding: 4px 8px 2px; line-height: 1.6; }
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
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
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
  // いま：段落の頭に「・」を手で打った（ふつうの段落と同じく1字下げ。2行目は行の頭まで戻る）
  await page.evaluate((items) => {
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => {
        const at = c.blocks.findIndex((b) => b.id === 'p4')
        if (at < 0) return c
        const lines = items.map((t, i) => ({ type: 'paragraph', id: `li${i}`, content: [{ type: 'text', text: `・${t}` }] }))
        return { ...c, blocks: [...c.blocks.slice(0, at + 1), ...lines, ...c.blocks.slice(at + 1)] }
      }),
    }))
  }, ITEMS)
  await sleep(1500)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('li0'), 'none'))
  await sleep(700)
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.mouse.move(5, 5)

  // 紙面の切り抜き（p4 から 図の上まで）
  const clip = async () =>
    page.evaluate(() => {
      const first = [...document.querySelectorAll('.page-viewport.front [data-block-id="p4"]')].find((e) => e.getBoundingClientRect().width > 0).closest('p')
      const page = first.closest('[data-vivliostyle-page-container]').getBoundingClientRect()
      const r = first.getBoundingClientRect()
      const last = [...document.querySelectorAll('.page-viewport.front p[data-block-id^="li"], .page-viewport.front .mock-list')].filter((e) => e.getBoundingClientRect().height > 0).at(-1).getBoundingClientRect()
      return { x: page.left + 30, y: r.top - 14, width: page.width - 60, height: last.bottom - r.top + 70 }
    })
  const shotPaper = async (name) => {
    await sleep(250)
    await page.screenshot({ path: join(OUT, `${name}.png`), clip: await clip(), captureBeyondViewport: false })
  }
  await shotPaper('paper-now')

  // 案：箇条書きの項目（1字下げなし。記号の後ろにそろえて折り返す）。種類ごとに組み替えて撮る
  const asList = (kind, indent) =>
    page.evaluate(
      (items, kind, indent) => {
        document.querySelector('.mock-list')?.remove()
        const ps = [...document.querySelectorAll('.page-viewport.front p[data-block-id^="li"]')]
        ps.forEach((p) => (p.style.display = 'none'))
        const list = document.createElement('div')
        list.className = 'mock-list'
        const marks = kind === 'bullet' ? ['・', '・', '・'] : ['①', '②', '③']
        items.forEach((t, i) => {
          const p = document.createElement('p')
          p.className = `mock-li ${kind === 'bullet' ? 'bullet' : 'number'}${indent ? ' indent' : ''}`
          p.innerHTML = `<span class="mk">${marks[i]}</span>${t}`
          list.append(p)
        })
        ps[0].before(list)
      },
      ITEMS,
      kind,
      indent,
    )
  await asList('bullet', false)
  await shotPaper('paper-bullet')
  await asList('number', false)
  await shotPaper('paper-number')
  await asList('bullet', true)
  await shotPaper('paper-bullet-indent')

  // 左の道具：「改ページ」の下に「箇条書き」。押すと種類を選ぶ（・／①）
  await page.evaluate(() => {
    const brk = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('改ページ'))
    const tb = brk.cloneNode(true)
    tb.classList.add('mock-tb', 'on')
    tb.querySelector('svg')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="5" cy="7" r="1.3" fill="currentColor"/><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="5" cy="17" r="1.3" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11"/></svg>' }).firstChild)
    const label = [...tb.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.includes('改ページ'))
    if (label) label.textContent = '箇条書き'
    brk.after(tb)
    const menu = document.createElement('div')
    menu.className = 'mock-menu'
    menu.innerHTML = '<button class="on"><b>・</b>箇条書き</button><button><b>①</b>番号付き</button><button><b>✕</b>ふつうの段落に戻す</button><small>Enter で次の項目。空の項目で Enter を押すと、ふつうの段落に戻ります</small>'
    document.body.append(menu)
    const r = tb.getBoundingClientRect()
    Object.assign(menu.style, { left: `${r.right + 10}px`, top: `${r.top - 4}px` })
  })
  await asList('bullet', false)
  await sleep(300)
  await page.screenshot({ path: join(OUT, 'palette-menu.png'), captureBeyondViewport: false })
  await context.close()
})
console.log('mockups/v67/shots に撮りました')
