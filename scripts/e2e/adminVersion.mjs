// 管理ページの「新しい版があります［新しくする］」（依頼者の判断 2026-10-27。学生のツールと同じ形）。これだけを流すときは node scripts/e2e/run.mjs adminVersion
// - 公開中の版が同じなら出さない。違えば、見出しの下の真ん中に出す（スマホは画面の下、保存のボタンの帯の上）
// - 保存していない変更があるときは、「新しくする」で消えることを確かめる。やめればそのまま、進めば開き直す（ブラウザの「離れますか？」は出さない）
// - × で閉じる
// 試験用サーバーは、localStorage の sotsugyo-admin-mock-version で「新しい版が公開された」ことにする（src/admin/mockServer.ts）
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const VERSION_KEY = 'sotsugyo-admin-mock-version'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(browser, { phone = false, newer = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  const dialogs = []
  page.on('dialog', (d) => {
    dialogs.push(d.type())
    void d.accept()
  })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(
    (key, newer) => {
      localStorage.removeItem('sotsugyo-admin-mock')
      sessionStorage.removeItem('sotsugyo-admin-section')
      if (newer) localStorage.setItem(key, 'newer-build')
      else localStorage.removeItem(key)
    },
    VERSION_KEY,
    newer,
  )
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
  await wait(1200)
  return { context, page, dialogs }
}
const banner = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('.new-version')
    if (!b) return null
    const r = b.getBoundingClientRect()
    const head = document.querySelector('.admin-header')?.getBoundingClientRect()
    const save = document.querySelector('.admin-header .save-group')?.getBoundingClientRect()
    return { text: b.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), W: innerWidth, H: innerHeight, headBottom: head ? Math.round(head.bottom) : null, saveTop: save ? Math.round(save.top) : null }
  })
const clickText = (page, selector, text) =>
  page.evaluate(
    (s, t) => {
      const e = [...document.querySelectorAll(s)].find((x) => x.textContent.includes(t))
      if (!e) return false
      e.click()
      return true
    },
    selector,
    text,
  )

await withEdge(async (browser) => {
  // ---- 同じ版：出さない ----
  {
    const { context, page } = await open(browser)
    check('公開中の版が同じなら、「新しい版があります」は出さない', (await banner(page)) === null)
    await context.close()
  }

  // ---- 新しい版：見出しの下の真ん中に出る。変更があれば確かめてから開き直す ----
  {
    const { context, page, dialogs } = await open(browser, { newer: true })
    const b = await banner(page)
    check('新しい版が公開されていれば、見出しの下の真ん中に「新しい版があります［新しくする］」を出す', !!b && b.text.includes('新しい版があります') && b.text.includes('新しくする') && b.top >= b.headBottom && Math.abs(b.left + b.right - b.W) <= 2, JSON.stringify(b))

    // 変更する（題目）→「新しくする」→ 確かめる窓 →「やめる」
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.click('#y-commonTitle', { clickCount: 3 })
    await page.keyboard.type('試しの題目')
    await wait(400)
    await page.evaluate(() => (window.__beforeReload = true))
    await clickText(page, '.new-version .nv-reload', '新しくする')
    await page.waitForSelector('.confirm-modal', { timeout: 5000 })
    const ask = await page.evaluate(() => document.querySelector('.confirm-modal')?.textContent ?? '')
    await clickText(page, '.confirm-modal .row-buttons .btn', 'やめる')
    await wait(500)
    const after = await page.evaluate(() => ({ marker: window.__beforeReload === true, title: document.querySelector('#y-commonTitle')?.value ?? '', button: document.querySelector('.new-version .nv-reload')?.textContent ?? '' }))
    check('保存していない変更があると、「新しくする」で消えることを確かめる。「やめる」なら、そのまま（ボタンも元に戻る）', ask.includes('保存していない変更があります') && after.marker && after.title.includes('試しの題目') && after.button.includes('新しくする'), JSON.stringify({ ask: ask.slice(0, 60), ...after }))

    // もう一度 → 進める：開き直す（ブラウザの「離れますか？」は出さない）
    await clickText(page, '.new-version .nv-reload', '新しくする')
    await page.waitForSelector('.confirm-modal', { timeout: 5000 })
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }), page.click('.confirm-modal [data-confirm="ok"]')])
    await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
    await wait(800)
    const reloaded = await page.evaluate(() => ({ marker: window.__beforeReload === true, title: document.querySelector('#y-commonTitle')?.value ?? '' }))
    check('進めると、管理ページを開き直す（変更は消え、ブラウザの「このサイトを離れますか？」は出さない）', !reloaded.marker && !reloaded.title.includes('試しの題目') && !dialogs.includes('beforeunload'), JSON.stringify({ ...reloaded, dialogs }))

    // × で閉じる
    await page.click('.new-version .nv-close')
    await wait(300)
    check('× で閉じる', (await banner(page)) === null)
    await page.evaluate((key) => localStorage.removeItem(key), VERSION_KEY)
    await context.close()
  }

  // ---- スマホ：画面の下、保存のボタンの帯の上 ----
  {
    const { context, page } = await open(browser, { phone: true, newer: true })
    const b = await banner(page)
    check('スマホ：画面の下の、保存のボタンの帯の上に出す（見出しに重ねない）', !!b && b.bottom <= b.saveTop && b.top > b.headBottom && b.left >= 0 && b.right <= b.W, JSON.stringify(b))
    await page.evaluate((key) => localStorage.removeItem(key), VERSION_KEY)
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
