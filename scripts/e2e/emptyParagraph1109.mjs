// 作ったばかりの空の段落と、章の終わりの大きくした図（依頼者の選択 2026-11-09）。これだけを流すときは node scripts/e2e/run.mjs emptyParagraph1109
// - 「＋ 文章の続きを書く」・段落の終わりの Enter で作った段落に、何も書かずに離れたら、その段落を消す（「空の段落がある」も出ない）
// - 章の終わりの図の後ろが中身のない段落だけのあいだは、図を大きいままにする（押しても・離れても、図の大きさが変わらない）
// - 文字を打ち始めたら、図を元の大きさに戻し、画面の下に1回だけ知らせる
import { mkdirSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/emptyParagraph1109'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

/** 章の終わりに図のある本文（c1：中見出し・段落・図。c2：段落） */
const body = () => {
  const t = (text) => ({ type: 'text', text })
  const p = (id, text) => ({ type: 'paragraph', id, content: [t(text)] })
  return [
    {
      id: 'c1',
      title: '企画・立案',
      blocks: [
        { type: 'subheading', id: 's1', title: 'デザイン説明' },
        p('p1', '中東の伝統的な装いをもとに、航海の力強さと冒険心を表すデザインを考えた（図1）。袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。'),
        { type: 'figureRow', id: 'r1', figures: [{ id: 'f1', imageId: 'g-design', caption: 'デザイン画' }] },
      ],
    },
    { id: 'c2', title: '制作過程', blocks: [p('p6', 'デザイン画をもとにパターンを引き、シーチングで仮縫いをした。')] },
  ]
}

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
      localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 900 })
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
  await wait(500)
  await ready()
  // 本文を入れ替える前の本文（元に戻すと、ここへ戻るはず）
  const sampleBody = await page.evaluate(() => JSON.stringify(window.__editor.getSnapshot().report.body))
  await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body())
  await wait(800)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('f1'), 'none'))
  await wait(500)
  await ready()

  /** 図の大きさ（mm）・c1 の中身・「空の段落がある」の数・書いている欄・知らせ */
  const state = () =>
    page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const img = document.querySelector('.page-viewport.front [data-group-id="r1"] img')
      return {
        size: img ? [parseFloat(img.style.width), parseFloat(img.style.height)] : null,
        blocks: s.report.body[0].blocks.map((b) => (b.type === 'paragraph' ? `${b.id === 'p1' ? 'p1' : 'p'}:${b.content.map((n) => n.text ?? '').join('')}` : b.type)),
        empty: s.findings.filter((f) => f.title === '空の段落がある').length,
        editing: s.editingId,
        notice: document.querySelector('.undo-area')?.textContent ?? '',
        button: (() => { const b = document.querySelector('.continue-row'); return !!b && !b.hidden })(),
      }
    })
  const pressContinue = async () => {
    await page.waitForFunction(() => { const b = document.querySelector('.continue-row'); return b && !b.hidden }, { timeout: 10000 })
    const at = await page.evaluate(() => { const r = document.querySelector('.continue-row').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 } })
    await page.mouse.click(at.x, at.y)
    await page.waitForFunction(() => { const id = window.__editor.getSnapshot().editingId; return !!id && id !== 'p1' && id !== 'f1' }, { timeout: 10000 })
    await wait(1200)
    await ready()
  }
  /** 紙面の外（灰色の台）を押して離れる */
  const clickAway = async () => {
    const at = await page.evaluate(() => { const r = document.querySelector('.page-viewport.front').getBoundingClientRect(); return { x: r.left + 8, y: r.bottom - 8 } })
    await page.mouse.click(at.x, at.y)
    await wait(1200)
    await ready()
  }

  const start = await state()
  check('章の終わりの図は大きくなっていて、下に「＋ 文章の続きを書く」が出る', !!start.size && start.size[1] > 80 && start.button, JSON.stringify(start))

  // ---- 「＋ 文章の続きを書く」を押す：図は大きいまま ----
  await pressContinue()
  const opened = await state()
  const samePage = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return window.__editor.pageOfBlock(s.editingId) === window.__editor.pageOfBlock('f1') })
  check('押すと図の後ろに空の段落ができて書き始め、図の大きさは変わらない（段落は図と同じページ）', opened.blocks.at(-1) === 'p:' && JSON.stringify(opened.size) === JSON.stringify(start.size) && samePage, JSON.stringify({ opened, samePage }))
  await page.screenshot({ path: `${OUT}/1-opened.png` })

  // ---- 何も書かずに離れる：段落が消え、押す前と同じ ----
  await clickAway()
  const left = await state()
  check('何も書かずに離れると、作った段落は消え、図は大きいまま。「空の段落がある」も出ない', left.blocks.at(-1) === 'figureRow' && JSON.stringify(left.size) === JSON.stringify(start.size) && left.empty === 0 && left.button, JSON.stringify(left))
  // 元に戻すと、続きを書く前の操作（このテストで本文を入れ替えた）まで戻る。図の後ろに空の段落がある原稿には戻らない
  const undoState = await page.evaluate((sample) => { window.__editor.undo(); return JSON.stringify(window.__editor.getSnapshot().report.body) === sample }, sampleBody)
  await wait(800)
  await ready()
  check('そのあと「元に戻す」をしても、空の段落は戻ってこない（本文を入れ替える前に戻る）', undoState === true)
  await page.evaluate(() => window.__editor.redo?.())
  await wait(800)
  await ready()
  await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body())
  await wait(800)
  await ready()
  await page.screenshot({ path: `${OUT}/2-left.png` })

  // ---- 打ち始める：図が元の大きさに戻り、知らせが出る ----
  await pressContinue()
  await page.keyboard.type('完成した姿は次のとおりである')
  await wait(1500)
  await ready()
  const typed = await state()
  check(
    '文字を打ち始めると、図が元の大きさ（縦 8cm）に戻り、画面の下に「図を元の大きさに戻しました」と知らせる',
    !!typed.size && typed.size[1] === 80 && typed.notice.includes('図の後ろに文章を書き始めたので、図を元の大きさに戻しました'),
    JSON.stringify(typed),
  )
  await page.screenshot({ path: `${OUT}/3-typed.png` })
  await page.keyboard.press('Escape')
  await wait(1200)
  await ready()
  const written = await state()
  check('書いて閉じた段落は残る', written.blocks.at(-1).startsWith('p:完成した姿は'), JSON.stringify(written.blocks))

  // ---- 2回目は知らせない（1回だけ） ----
  await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body())
  await wait(1000)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('f1'), 'none'))
  await wait(500)
  await ready()
  await pressContinue()
  await page.keyboard.type('次')
  await wait(1500)
  await ready()
  const again = await state()
  check('2回目に打ち始めたときは知らせない（図は元の大きさに戻る）', !!again.size && again.size[1] === 80 && !again.notice.includes('図を元の大きさに戻しました'), JSON.stringify(again))
  await page.keyboard.press('Escape')
  await wait(800)
  await ready()

  // ---- 段落の終わりで Enter：何も書かずに離れたら消える ----
  await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body())
  await wait(1000)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
  await wait(500)
  await ready()
  const p1 = await page.evaluate(() => { const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="p1"]')].at(-1); const r = el.getBoundingClientRect(); return { x: r.right - 4, y: r.bottom - 6 } })
  await page.mouse.click(p1.x, p1.y)
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 10000 })
  await page.keyboard.down('Control')
  await page.keyboard.press('End')
  await page.keyboard.up('Control')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => { const id = window.__editor.getSnapshot().editingId; return !!id && id !== 'p1' }, { timeout: 10000 })
  await wait(800)
  const split = await state()
  check('段落の終わりで Enter を押すと、すぐ後ろに空の段落ができる', split.blocks[2] === 'p:' && split.blocks.length === 4, JSON.stringify(split.blocks))
  await clickAway()
  const leftSplit = await state()
  check('Enter で作った段落も、何も書かずに離れると消える（「空の段落がある」も出ない）', leftSplit.blocks.length === 3 && leftSplit.blocks[1].startsWith('p1:') && leftSplit.empty === 0, JSON.stringify(leftSplit))

  await context.close()
  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
