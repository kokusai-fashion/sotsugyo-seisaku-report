// スマホで拡大しているときのページ送り（依頼者 2026-11-03：拡大中は送れず、気づきにくかった。mockups/v98 ② 案A）：
// - 拡大中も下の真ん中に「◀ 本文3ページ 6/11 ▶ ｜ 全体」。どれも 44px 以上で、画面の幅に入る
// - 「▶」で送ると、拡大のまま、次のページの上を見せる
// - 左にはらっても、拡大のまま次のページへ（上下にはらうと紙面が動くだけ）
// - 「全体」でページ全体に戻る（ページ送りはそのまま、「全体」は消える）。書いている間はページ送りを出さない
// これだけを流すときは node scripts/e2e/run.mjs zoomPager
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await wait(500)
  await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(800)
  await ready()
  const state = () =>
    page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const pager = document.querySelector('.pager')
      const buttons = pager ? [...pager.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label'), text: b.textContent.trim(), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) } }) : []
      return { page: s.page, zoomed: s.zoomed, editing: s.editingId, top: Math.round(document.querySelector('.page-scroller').scrollTop), pager: !!pager, buttons }
    })

  const start = await page.evaluate(() => window.__editor.pageOfBlock('p3'))
  await page.evaluate((i) => window.__editor.goToPage(i, 'none'), start)
  await ready()
  await page.evaluate(() => window.__editor.setZoom(true))
  await wait(800)
  const zoomed = await state()
  await page.screenshot({ path: 'poc-output/zoom-pager.png' })
  check(
    '拡大中も、下にページ送り「◀ ▶」と「全体」が出る（どれも高さ 44px 以上で、画面の幅に入る）',
    zoomed.zoomed && zoomed.pager && zoomed.buttons.map((b) => b.name).join() === '前のページ,次のページ,ページ全体に戻す' && zoomed.buttons.every((b) => b.h >= 44 && b.left >= 0 && b.right <= 390),
    JSON.stringify(zoomed.buttons),
  )

  // 「▶」：拡大のまま、次のページの上
  await page.evaluate(() => { document.querySelector('.page-scroller').scrollTop = 300 })
  await page.tap('.pager button[aria-label="次のページ"]')
  await wait(300)
  await ready()
  const turned = await state()
  check('「▶」で送ると、拡大のまま次のページの上を見せる', turned.page === start + 1 && turned.zoomed && turned.top === 0, JSON.stringify(turned))

  // 左にはらう：拡大のまま次のページ。上へはらうと紙面が動くだけ
  await page.touchscreen.touchStart(320, 420)
  await page.touchscreen.touchMove(220, 424)
  await page.touchscreen.touchMove(90, 428)
  await page.touchscreen.touchEnd()
  await wait(300)
  await ready()
  const swiped = await state()
  check('拡大中に左にはらうと、拡大のまま次のページへ', swiped.page === start + 2 && swiped.zoomed, JSON.stringify(swiped))
  await page.touchscreen.touchStart(200, 600)
  await page.touchscreen.touchMove(203, 450)
  await page.touchscreen.touchMove(206, 300)
  await page.touchscreen.touchEnd()
  await wait(600)
  await ready()
  const vertical = await state()
  check('拡大中に上へはらっても、ページは送らない（紙面が動く）', vertical.page === start + 2 && vertical.zoomed, JSON.stringify(vertical))

  // 下に赤い帯（直すところ）が出ているときも、「全体」はページ送りの中（前は帯の分だけボタンだけが上にずれ、表の上に浮いた：学生の試し 8回目 2026-11-04）
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p3' ? { ...b, content: [...b.content, { type: 'text', text: '制作はとても楽しかったです。' }] } : b)) })) })))
  await page.waitForSelector('.err-strip', { timeout: 30000 })
  await wait(600)
  await ready()
  const inPill = await page.evaluate(() => {
    const p = document.querySelector('.pager')?.getBoundingClientRect()
    const u = document.querySelector('.pager button.unzoom')?.getBoundingClientRect()
    return p && u ? { inside: u.top >= p.top - 1 && u.bottom <= p.bottom + 1 && u.right <= p.right + 1, pager: Math.round(p.top), unzoom: Math.round(u.top) } : { inside: false }
  })
  check('下に赤い帯が出ているときも、「全体」はページ送りの中にある', inPill.inside, JSON.stringify(inPill))

  // 「全体」
  await page.tap('.pager button.unzoom')
  await wait(500)
  const whole = await state()
  check('「全体」でページ全体に戻る（ページ送りは出たまま、「全体」は消える）', !whole.zoomed && whole.pager && whole.buttons.length === 2 && whole.page === start + 2, JSON.stringify(whole))

  // 書いている間はページ送りを出さない
  await page.evaluate(() => window.__editor.openEditor('p4', 0))
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p4', { timeout: 20000 })
  await wait(500)
  const writing = await state()
  check('書いている間は、ページ送りを出さない（下に書く道具が出る）', writing.editing === 'p4' && !writing.pager, JSON.stringify({ editing: writing.editing, pager: writing.pager }))

  await context.close()
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
