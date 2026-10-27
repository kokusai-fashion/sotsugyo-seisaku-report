// 管理ページをスマホで開いたとき（mockups/v68 案C。依頼者の指摘 2026-10-27）。これだけを流すときは node scripts/e2e/run.mjs adminPhone
// - はじめに区切りの一覧。押すと中身、「‹ 管理ページの一覧」で一覧へ戻る
// - どの区切りも、横にはみ出さない（前は、パソコンの3列のままで、画面の2〜3倍の幅に広がっていた）
// - 見本は「見本を見る」で画面いっぱいに開き、「‹ 見本を閉じる」で閉じる
// - 保存のボタンは画面の下。変更があれば、画面の下の帯（変更を見る・保存）
// - パソコンの幅では、いままでどおり左の見出し・中身・見本の3列
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(browser, { phone = true, as = '' } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => d.accept())
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.removeItem('sotsugyo-admin-mock')
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.goto(`${APP}/admin.html${as ? `?as=${as}` : ''}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
  await wait(600)
  return { context, page }
}
const visible = (page, selector) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }, selector)
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const tap = async (page, selector, text) => {
  const p = await page.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find((x) => (!t || x.textContent.includes(t)) && x.getBoundingClientRect().width > 0); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, selector, text)
  if (!p) throw new Error(`見つからない：${selector} ${text ?? ''}`)
  await page.touchscreen.tap(p.x, p.y)
  await wait(700)
}

await withEdge(async (browser) => {
  // ---- 管理者：一覧 → 区切り → 一覧。どの区切りも横にはみ出さない ----
  {
    const { context, page } = await open(browser)
    const first = { list: await visible(page, '.side-nav'), work: await visible(page, '.work'), over: await overflow(page), bottom: await page.evaluate(() => { const g = document.querySelector('.admin-header .save-group'); const r = g?.getBoundingClientRect(); return r ? Math.round(innerHeight - r.bottom) : null }) }
    check('スマホ：開くと区切りの一覧（中身は出さない）。横にはみ出さず、保存のボタンは画面の下', first.list && !first.work && first.over <= 0 && first.bottom === 0, JSON.stringify(first))
    const titles = await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].map((b) => b.querySelector('.nt b').firstChild.textContent.trim()))
    const over = []
    for (const t of titles) {
      if (!(await visible(page, '.side-nav'))) await tap(page, '.phone-back')
      await tap(page, '.side-nav button', t)
      const state = { t, list: await visible(page, '.side-nav'), back: await visible(page, '.phone-back'), head: await page.evaluate(() => document.querySelector('.content .sec-h')?.textContent ?? ''), over: await overflow(page) }
      if (state.list || !state.back || state.over > 0) over.push(state)
    }
    check(`スマホ：一覧で区切り（${titles.length}つ）を押すと、その中身と「‹ 管理ページの一覧」が出て、どれも横にはみ出さない`, titles.length === 7 && over.length === 0, JSON.stringify(over))
    await tap(page, '.phone-back')
    check('スマホ：「‹ 管理ページの一覧」で一覧へ戻る', (await visible(page, '.side-nav')) && !(await visible(page, '.work')))

    // 見本：コースで「見本を見る」→ 画面いっぱい → 閉じる
    await tap(page, '.side-nav button', 'コース')
    const before = await visible(page, '.stage')
    await tap(page, '.pv-show')
    await wait(800)
    const pv = await page.evaluate(() => { const r = document.querySelector('.stage').getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), W: innerWidth, H: innerHeight } })
    // 見本の見せ方（依頼者 2026-10-27：スマホでは1ページごと。学生の執筆ページと同じく切り替えられる）
    const label = () => page.evaluate(() => document.querySelector('.stage .pv-label')?.textContent.replace(/\s+/g, '') ?? '')
    const pressed = () => page.evaluate(() => [...document.querySelectorAll('.stage .pv-view button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim()).join())
    const view = { first: await label(), on: await pressed() }
    await tap(page, '.stage .pv-turn[aria-label^="次"]')
    view.next = await label()
    await tap(page, '.stage .pv-view button', '見開き')
    view.spread = await label()
    view.spreadOn = await pressed()
    // 紙の並び（iframe の中）の右の端が、iframe の幅に収まっているか
    view.over = await page.evaluate(() => { const f = document.querySelector('.stage iframe'); const s = f.contentDocument.querySelector('.strip'); return Math.round(s.getBoundingClientRect().right - f.clientWidth) })
    await tap(page, '.stage .pv-view button', '1ページ')
    check('スマホ：見本ははじめ1ページずつ（表紙→抄録）。「見開き」に切り替えられ、見開きでも画面からはみ出さない', view.first.startsWith('表紙1/') && view.on === '1ページ' && view.next.startsWith('抄録2/') && view.spread.startsWith('表紙・抄録') && view.spreadOn === '見開き' && view.over <= 0, JSON.stringify(view))
    await tap(page, '.pv-close')
    check('スマホ：見本はふだん出さず、「見本を見る」で画面いっぱいに開き、「‹ 見本を閉じる」で閉じる', !before && pv.x === 0 && pv.w === pv.W && pv.h === pv.H && !(await visible(page, '.stage')), JSON.stringify(pv))

    // 変更：お知らせに書くと、画面の下に帯（変更を見る・保存）。見出しの保存のボタンは隠す
    const ta = await page.$('textarea.in.notice')
    await ta.tap()
    await page.keyboard.type('中間発表には下書きを持ってきてください')
    // 書き終えてから（書いている間は、下の帯を隠す：mockups/v71 ③）
    await page.evaluate(() => document.activeElement.blur())
    await wait(600)
    const bar = await page.evaluate(() => { const b = document.querySelector('.dirty-bar'); const r = b?.getBoundingClientRect(); return { bar: !!b && Math.round(innerHeight - r.bottom) === 0, group: getComputedStyle(document.querySelector('.admin-header .save-group')).display, over: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
    check('スマホ：変更があると、画面の下の帯（変更を見る・保存）が出て、見出しの保存のボタンは隠れる', bar.bar && bar.group === 'none' && bar.over <= 0, JSON.stringify(bar))
    await context.close()
  }

  // ---- 先生：一覧は3つと「先生ができること」 ----
  {
    const { context, page } = await open(browser, { as: 'teacher' })
    const t = await page.evaluate(() => ({ items: document.querySelectorAll('.side-nav button').length, can: !!document.querySelector('.side-nav .can-do'), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
    check('スマホ（先生）：一覧は3つと「先生ができること」。横にはみ出さない', t.items === 3 && t.can && t.over <= 0, JSON.stringify(t))
    await context.close()
  }

  // ---- パソコン：いままでどおり3列 ----
  {
    const { context, page } = await open(browser, { phone: false })
    const pc = await page.evaluate(() => ({ nav: document.querySelector('.side-nav').getBoundingClientRect().width, stage: document.querySelector('.stage')?.getBoundingClientRect().width ?? 0, back: !!document.querySelector('.phone-back'), pv: !!document.querySelector('.pv-show'), headSave: getComputedStyle(document.querySelector('.admin-header .save-group')).display }))
    check('パソコン：いままでどおり、左の見出し・中身・見本の3列（「‹ 管理ページの一覧」「見本を見る」は出さない。保存のボタンは見出しの中）', pc.nav > 150 && pc.stage > 300 && !pc.back && !pc.pv && pc.headSave === 'contents', JSON.stringify(pc))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
