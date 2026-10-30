// 学生の試し 7回目（2026-10-30。6回目の直しの確かめ・パソコンでふつうに書く・iPhone でふつうに書く。poc-output/firsttime/r1029/まとめ7.md）の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030f
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, { phone = false, mac = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  if (phone) await page.setUserAgent(IPHONE)
  if (mac) {
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: MAC, platform: 'MacIntel' })
  }
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 })
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
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(300)
}
const settle = async (page, ready) => {
  await wait(1200)
  await ready()
}
const blocks = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => ({ id: b.id, type: b.type, text: b.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b.type === 'subheading' ? b.title : '' })))
const tool = (page, label) => page.evaluate((label) => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes(label)), label)
const clickTool = (page, label) => page.evaluate((label) => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes(label))?.click(), label)
const toolOn = (page, label) => page.evaluate((label) => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes(label)); return !!b && !b.disabled }, label)

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)
    // 図のタイトルで Enter → そのまま「小見出し」：図のすぐ下に入る（本文のいちばん後ろへ行かない）
    await editAt(page, ready, 'f1', 5)
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await settle(page, ready)
    await clickTool(page, '小見出し')
    await settle(page, ready)
    const list = await blocks(page)
    const r1 = list.findIndex((b) => b.id === 'r1')
    const editing = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    check('図のタイトルで Enter のまま「小見出し」を押すと、小見出しは図のすぐ下に入る（空の段落は残らない）', list[r1 + 1]?.type === 'subheading' && list[r1 + 1]?.id === editing && list[r1 + 2]?.id === 'p4', JSON.stringify(list.slice(r1, r1 + 3)))
    await page.keyboard.type('配色')
    await page.keyboard.press('Escape')
    await settle(page, ready)

    // 書いている間の左の「元に戻す」は、打った字から1つずつ戻す。「やり直す」も押せる
    const p2 = (await blocks(page)).find((b) => b.id === 'p2').text
    await editAt(page, ready, 'p2', p2.length)
    await page.keyboard.type('一つ目。')
    await page.keyboard.press('Space')
    await page.keyboard.press('Backspace')
    await wait(400)
    await page.keyboard.type('二つ目。')
    await wait(300)
    await clickTool(page, '元に戻す')
    await wait(500)
    const afterUndo = await page.evaluate(() => ({ editing: window.__editor.getSnapshot().editingId, text: document.querySelector('.overlay-editor')?.textContent ?? '' }))
    const redoOn = await toolOn(page, 'やり直す')
    await clickTool(page, 'やり直す')
    await wait(500)
    const afterRedo = await page.evaluate(() => document.querySelector('.overlay-editor')?.textContent ?? '')
    check('書いている間に左の「元に戻す」を押すと、打った字から戻る（段落ごと消えない）。「やり直す」も押せて、戻る', afterUndo.editing === 'p2' && afterUndo.text.includes('一つ目') && !afterUndo.text.includes('二つ目') && redoOn && afterRedo.includes('二つ目'), JSON.stringify({ afterUndo: afterUndo.text.slice(-12), redoOn, afterRedo: afterRedo.slice(-12) }))
    await page.keyboard.press('Escape')
    await settle(page, ready)

    // 小見出しの頭で書いている間に「改ページ」：入れた所だけを言う
    await editAt(page, ready, 's3', 0)
    await clickTool(page, '改ページ')
    await settle(page, ready)
    const toast = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    check('小見出しの頭を書いている間に「改ページ」を押すと、「〜の前に、改ページを入れました」とだけ言う', /の前に、改ページを入れました/.test(toast) && !toast.includes('ほかの所に入れるときは'), toast)
    await page.keyboard.press('Escape')
    await settle(page, ready)

    // 拡大しているとき、見えている所の外の欄を書き始めると、見える所まで紙面が動く
    await page.evaluate(() => window.__editor.setView('zoom'))
    await settle(page, ready)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p5b'), 'none'))
    await ready()
    await page.evaluate(() => { const s = document.querySelector('.stage'); s.scrollTop = 0 })
    await wait(300)
    const hiddenBefore = await page.evaluate(() => { const e = [...document.querySelectorAll('.page-viewport.front [data-block-id="p5b"]')].find((x) => x.getBoundingClientRect().width > 0); const s = document.querySelector('.stage').getBoundingClientRect(); const r = e?.getBoundingClientRect(); return !!r && (r.top >= s.bottom || r.bottom <= s.top) })
    await page.evaluate(() => window.__editor.openEditor('p5b', 0))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p5b', { timeout: 20000 })
    await wait(600)
    const shown = await page.evaluate(() => { const r = document.querySelector('.overlay-editor').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); return r.top < s.bottom && r.bottom > s.top })
    check('拡大しているとき、画面の外にある欄を書き始めると、その欄が見える所まで紙面が動く', !hiddenBefore || shown, JSON.stringify({ hiddenBefore, shown }))
    await page.keyboard.press('Escape')
    await context.close()
  }

  // ---- Mac：使い方の文のキーの書き方 ----
  {
    const { context, page } = await open(browser, { mac: true })
    await page.evaluate(() => document.querySelector('.side .menu-btn').click())
    await page.waitForSelector('[role=menuitem]', { timeout: 10000 })
    await page.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].find((b) => b.textContent.includes('使い方'))?.click())
    await page.waitForSelector('.help-search input', { timeout: 10000 })
    await page.type('.help-search input', '段落をまたいで')
    await wait(600)
    const text = await page.evaluate(() => document.querySelector('.help-results, .help-body')?.innerText ?? '')
    check('Mac の使い方では、キーの書き方が ⌘+C・delete（Ctrl+C・Delete ではない）', text.includes('⌘+C') && !text.includes('Ctrl+C'), text.slice(0, 160))
    await context.close()
  }

  // ---- スマホ：PDF の窓を開いたまま「戻る」 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    const href = page.url()
    await page.evaluate(() => document.querySelector('.p-nav .nav-pdf').click())
    await page.waitForSelector('.modal', { timeout: 30000 })
    await wait(600)
    await page.evaluate(() => history.back())
    await wait(800)
    const after = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), editor: !!window.__editor }))
    check('スマホ：PDF の窓を開いたまま「戻る」を押すと、窓が閉じるだけで、ツールからは出ない', !after.modal && after.editor && page.url() === href, JSON.stringify(after))
    await ready()
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
