// 学生の試し 4回目の B（見た目が変わる直し。依頼者の選択 mockups/v77：① 案A・② 案A・③ 案A）。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030b
// ① Esc で閉じたあとは「図を入れる」「表を入れる」を押せない（書く欄を閉じたあとも入れられる形はやめた：依頼者の判断 2026-10-30）
// ② はじめての案内のコースを選ぶ画面に「バックアップから戻す」は出さない（同じく依頼者の判断 2026-10-30。メニューから戻す）
// ③ キーボードで移ったときの枠は、黄色の太い枠（3px）
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

async function open(browser, { sample = true } = {}) {
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
  if (sample) {
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(600)
    await ready()
  }
  return { context, page, ready }
}
const tool = (page, label) => page.evaluate((label) => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes(label)); return b ? { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' } : null }, label)

await withEdge(async (browser) => {
  // ---- ① Esc のあとは「図を入れる」「表を入れる」を押せない（入れたい所を押してから） ----
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p6', 6))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await wait(400)
    await page.keyboard.press('Escape')
    await wait(900)
    await ready()
    const after = { figure: await tool(page, '図を入れる'), table: await tool(page, '表を入れる'), notes: await page.evaluate(() => [...document.querySelectorAll('.palette .ctx-note')].map((n) => n.textContent).join(' ')) }
    check('Esc で閉じたあとは「図を入れる」「表を入れる」を押せず、「さっき書いていた所に入れます」も出ない', after.figure?.disabled && after.table?.disabled && !after.notes.includes('さっき') && after.notes.includes('入れたい所を'), JSON.stringify(after))

    // ③ キーボードで移ったときの枠（黄色の 3px）
    await page.evaluate(() => document.activeElement?.blur())
    await page.evaluate(() => document.querySelector('.side .export').focus({ focusVisible: true }))
    await wait(200)
    const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { color: cs.outlineColor, width: cs.outlineWidth, style: cs.outlineStyle } })
    check('キーボードで移ったときの枠は、黄色の太い枠（3px）', ring.color === 'rgb(242, 183, 5)' && ring.width === '3px' && ring.style === 'solid', JSON.stringify(ring))
    await context.close()
  }

  // ---- ② はじめての案内のコースを選ぶ画面に「バックアップから戻す」は出さない（メニューの「バックアップ・作り直す」から戻す） ----
  {
    const { context, page } = await open(browser, { sample: false })
    const text = await page.evaluate(() => document.querySelector('.guide')?.innerText ?? '')
    check('はじめての案内のコースを選ぶ画面に「バックアップから戻す」はない', !!text && !text.includes('バックアップ'), text.slice(0, 120))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
