// 学生の試し（2026-10-31。録画つきの学生役 2回目。poc-output/trial-1031b/journal.md）の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1031
import { resolve } from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1366, height: 768 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
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
  await wait(600)
  await ready()
  return { context, page, ready }
}

await withEdge(async (browser) => {
  // 段落に「（図4）」まで打って Enter → 空の段落で「図を入れる」：先に打った「（図4）」が、入れた図へのリンクになる
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p16'), 'none'))
    await ready()
    const end = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p16').content.map((n) => n.text ?? '').join('').length)
    await page.evaluate((end) => window.__editor.openEditor('p16', end), end)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p16', { timeout: 20000 })
    await wait(300)
    await page.keyboard.type('完成した衣装を示す（図4）。')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return s.editingKind === 'paragraph' && s.editingId !== 'p16' }, { timeout: 20000 })
    await wait(300)
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => void window.__editor.addFigure())])
    await chooser.accept([resolve('docs/guide-images/sample/photo-1.jpg')])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'figureCaption', { timeout: 30000 })
    await page.keyboard.type('完成した衣装')
    await page.keyboard.press('Escape')
    await ready()
    await wait(800)
    const got = await page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const blocks = s.report.body.flatMap((c) => c.blocks)
      const p16 = blocks.find((b) => b.id === 'p16')
      const row = blocks.find((b) => b.type === 'figureRow' && b.figures.some((f) => f.caption === '完成した衣装'))
      return {
        text: p16.content.map((n) => (n.type === 'ref' ? `[ref:${n.targetId === row?.figures[0].id ? 'new' : n.targetId}]` : n.text)).join(''),
        next: blocks[blocks.indexOf(p16) + 1]?.id === row?.id,
        typed: s.findings.filter((f) => f.title.includes('手で書いている') || f.title.includes('図がない')).map((f) => f.title),
      }
    })
    check(
      '「（図4）」まで打って Enter → 空の段落で「図を入れる」：先に打った「（図4）」が入れた図につながり、「図の番号を手で書いている」が出ない',
      got.text === '制作を通して、舞台衣装は客席からの見え方と演者の動きやすさの両方を考える必要があることを学んだ。この経験を、今後の衣装制作に生かしたい。完成した衣装を示す[ref:new]。' && got.next && got.typed.length === 0,
      JSON.stringify(got),
    )
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
