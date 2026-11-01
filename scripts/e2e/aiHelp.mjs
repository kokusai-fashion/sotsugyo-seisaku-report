// 使い方を AI に聞く（依頼者の選択 2026-11-01：mockups/v86 案A・B。スマホはメニューの中）。
// 年度の設定の「AI に聞くのリンク」（aiHelpUrl）があるときだけ出す。これだけを流すときは node scripts/e2e/run.mjs aiHelp
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const AI = 'https://notebook.google.com/notebook/e2e-ai-help'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, viewport, overrides) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport(viewport)
  await stubConfig(page, overrides)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForFunction(() => !!window.__editor?.getSnapshot()?.layout, { timeout: 120000 })
  if (await page.$('.guide.step-course .g-opts button')) {
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
  }
  await wait(800)
  return { context, page }
}

/** PC：メニューの中の「使い方を AI に聞く」と、使い方の欄の上の「使い方を AI に聞く」 */
async function pcLinks(page) {
  await page.click('.side .menu-btn')
  await page.waitForSelector('.head-menu .hm-help')
  const menu = await page.evaluate(() => {
    const a = document.querySelector('.head-menu .hm-ai')
    const items = [...document.querySelectorAll('.head-menu [role="menuitem"]')].map((x) => x.textContent.trim())
    return { href: a?.getAttribute('href') ?? null, target: a?.getAttribute('target') ?? null, items, title: document.querySelector('.side .menu-btn').getAttribute('title') }
  })
  await page.click('.head-menu .hm-help')
  await page.waitForSelector('.help .help-note')
  const help = await page.evaluate(() => {
    const a = document.querySelector('.help .help-ai')
    return { href: a?.getAttribute('href') ?? null, target: a?.getAttribute('target') ?? null, text: a?.textContent ?? '', afterNote: a?.previousElementSibling?.className ?? '' }
  })
  return { menu, help }
}

await withEdge(async (browser) => {
  // ---- リンクがないとき：出さない ----
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 }, {})
    const { menu, help } = await pcLinks(page)
    check('リンクがないとき：メニューにも使い方にも出さない', menu.href === null && help.href === null && !menu.title.includes('AI'), JSON.stringify({ menu, help }))
    await context.close()
  }
  // ---- パソコン：メニューの「使い方」の下（案B）と、使い方の言葉で探す欄の下（案A） ----
  {
    const { context, page } = await open(browser, { width: 1440, height: 900 }, { aiHelpUrl: AI })
    const { menu, help } = await pcLinks(page)
    check('パソコン：メニューの「使い方」のすぐ下に「使い方を AI に聞く」（新しいタブ）', menu.href === AI && menu.target === '_blank' && menu.items[0] === '使い方' && menu.items[1] === '使い方を AI に聞く' && menu.title.startsWith('使い方・AI に聞く'), JSON.stringify(menu))
    check('パソコン：使い方の欄の、言葉で探す欄の説明のすぐ下に「使い方を AI に聞く」（新しいタブ）', help.href === AI && help.target === '_blank' && help.text.startsWith('使い方を AI に聞く') && help.afterNote === 'help-note', JSON.stringify(help))
    await context.close()
  }
  // ---- スマホ：メニューの中 ----
  {
    const { context, page } = await open(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { aiHelpUrl: AI })
    await page.evaluate(() => [...document.querySelectorAll('button.icon-btn')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('メニュー'))?.click())
    await page.waitForSelector('.sheet .links', { timeout: 20000 })
    const phone = await page.evaluate(() => {
      const a = document.querySelector('.sheet .ai-btn')
      const r = a?.getBoundingClientRect()
      return { href: a?.getAttribute('href') ?? null, target: a?.getAttribute('target') ?? null, text: a?.textContent ?? '', fits: !!r && r.left >= 0 && r.right <= innerWidth }
    })
    check('スマホ：メニューの中に「使い方を AI に聞く」（新しいタブ・画面の幅に収まる）', phone.href === AI && phone.target === '_blank' && phone.text === '使い方を AI に聞く' && phone.fits, JSON.stringify(phone))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
