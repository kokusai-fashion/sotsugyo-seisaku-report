// mockups/v68：管理ページをスマホで開いたときの並べ方（依頼者の指摘 2026-10-27：スマホでは見え方が良くない）。
// いまはパソコンの3列（左の見出し・中身・見本）のままで、画面の2〜3倍の幅に広がり、横にはみ出していた。
// 本物の管理ページ（開発サーバー・試験用サーバー）に、スマホ用の並べ方を足して撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v68-admin-phone.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v68/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/** どちらの案にも共通：1列にし、見本は「見本を見る」で開き、保存のボタンは画面の下に */
const COMMON = `
  html, body, #root { height: auto !important; }
  .admin { height: auto !important; min-height: 100vh; display: block !important; }
  .admin-header { position: sticky; top: 0; z-index: 30; height: auto !important; flex-wrap: wrap; white-space: normal !important; padding: 10px 14px !important; gap: 8px 10px !important; }
  .admin-header .title { flex: 1 1 auto; font-size: 15.5px !important; }
  .admin-header .spacer { display: none; }
  .admin-header .sel { order: 3; flex: 1 1 auto; min-width: 0; }
  .admin-header .badge { order: 4; }
  .admin-main { display: block !important; }
  .work { display: block !important; }
  .content { overflow: visible !important; padding: 16px 14px 110px !important; border-right: 0 !important; }
  .stage, .form-resize { display: none !important; }
  .grid { grid-template-columns: minmax(0, 1fr) !important; gap: 4px 0 !important; }
  .grid > .lb { padding-top: 10px !important; }
  .card { padding: 14px 14px 16px !important; }
  .mock-bottom { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; align-items: center; gap: 10px; padding: 10px 14px 14px; background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(20, 25, 40, 0.06); }
  .mock-bottom .save-state { flex: 1; font-size: 13.5px; line-height: 1.5; }
  .mock-pv { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; }
  .mock-me { margin: 18px 2px 0; display: grid; gap: 2px; font-size: 13px; color: var(--muted); line-height: 1.6; }
`
/** 案A：区切りを、見出しの下の横並びのタブにする（横に送れる） */
const TABS = `
  .side-nav { position: sticky; top: var(--mock-head, 100px); z-index: 20; display: block !important; overflow-x: auto !important; overflow-y: hidden; padding: 8px 12px !important; border-right: 0 !important; border-bottom: 1px solid var(--line); scrollbar-width: none; }
  .side-nav ul { display: flex !important; gap: 6px !important; width: max-content; }
  .side-nav li.sep { margin: 0 0 0 6px !important; padding: 0 0 0 12px !important; border-top: 0 !important; border-left: 1px solid var(--line); }
  .side-nav button { white-space: nowrap; padding: 6px 13px !important; border-radius: 999px !important; border: 1px solid var(--line) !important; background: #fff; }
  .side-nav button > svg, .side-nav .nt small, .side-nav .me, .side-nav .can-do { display: none !important; }
  .side-nav .nt b { font-size: 14px !important; }
  .side-nav button.on { background: var(--accent) !important; border-color: var(--accent) !important; }
  .side-nav button.on::before { display: none; }
  .side-nav button.on .nt b { color: #fff !important; }
`
/** 案C：はじめに区切りの一覧（いまの左の見出しを、画面の幅いっぱいに）。押すと中身、「‹ 一覧」で戻る */
const LIST = `
  .side-nav { display: flex !important; border-right: 0 !important; padding: 12px 10px 24px !important; min-height: calc(100vh - var(--mock-head, 100px)); }
  .side-nav button { padding: 12px 14px !important; }
  .side-nav button::after { content: '›'; margin-left: auto; align-self: center; color: #9aa1ad; font-size: 22px; line-height: 1; }
  .side-nav button.on { background: none !important; }
  .side-nav button.on::before { display: none; }
  .side-nav button.on > svg, .side-nav button.on .nt b { color: inherit !important; }
  .side-nav .nt b { font-size: 16px !important; }
  .side-nav .nt small { font-size: 13.5px !important; }
  .mock-back { display: flex; align-items: center; gap: 4px; margin: -4px 0 -6px; padding: 0; border: 0; background: none; color: var(--accent); font-size: 15px; }
  .mock-back b { font-size: 22px; line-height: 1; margin-top: -2px; }
`

await withEdge(async (browser) => {
  const open = async () => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('dialog', (d) => d.accept())
    await page.setUserAgent(IPHONE)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await page.evaluate(() => {
      localStorage.removeItem('sotsugyo-admin-mock')
      sessionStorage.removeItem('sotsugyo-admin-section')
    })
    await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.admin .content')
    await sleep(800)
    // 「試験用サーバー」の印は本物の管理ページにはない
    await page.evaluate(() => [...document.querySelectorAll('.badge')].filter((b) => b.textContent.includes('試験用')).forEach((b) => b.remove()))
    return { context, page }
  }
  const nav = async (page, title) => {
    await page.evaluate((t) => [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('.nt b')?.firstChild?.textContent.trim() === t).click(), title)
    await sleep(1200)
  }
  /** 保存のボタンを画面の下へ、見本は「見本を見る」、ログイン中の表示は中身の下へ */
  const common = async (page, extra) => {
    await page.addStyleTag({ content: COMMON + extra })
    await page.evaluate(() => {
      document.querySelector('.mock-bottom')?.remove()
      const bar = document.createElement('div')
      bar.className = 'mock-bottom'
      const header = document.querySelector('.admin-header')
      bar.append(header.querySelector('.save-state').cloneNode(true), header.querySelector('.btn:not(.help)').cloneNode(true))
      header.querySelector('.save-state').style.display = 'none'
      ;[...header.querySelectorAll('.btn')].filter((b) => /保存|公開/.test(b.textContent)).forEach((b) => (b.style.display = 'none'))
      document.body.append(bar)
      document.documentElement.style.setProperty('--mock-head', `${header.getBoundingClientRect().height}px`)
    })
  }
  const addPreviewButton = (page) =>
    page.evaluate(() => {
      document.querySelector('.mock-pv')?.remove()
      if (!document.querySelector('.stage')) return
      const lead = document.querySelector('.content .sec-lead') ?? document.querySelector('.content .sec-h')
      const b = document.createElement('button')
      b.className = 'btn sub mock-pv'
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>見本を見る（表紙・抄録・ひな形）'
      lead.after(b)
    })
  const shot = async (page, name, full = false) => {
    await page.evaluate(() => window.scrollTo(0, 0))
    await sleep(300)
    await page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    if (full) await page.screenshot({ path: join(OUT, `${name}-full.png`), fullPage: true })
  }

  // いま
  {
    const { context, page } = await open()
    await shot(page, 'now-year')
    await context.close()
  }

  // 案A：上に横並びのタブ
  {
    const { context, page } = await open()
    await common(page, TABS)
    await addPreviewButton(page)
    await shot(page, 'a-year', true)
    await nav(page, 'コース')
    await addPreviewButton(page)
    await shot(page, 'a-course', true)
    await nav(page, '書き方のチェック')
    await shot(page, 'a-words')
    await nav(page, '先生の登録')
    await page.evaluate(() => document.querySelector('.side-nav').scrollTo({ left: 400 }))
    await shot(page, 'a-members')
    await context.close()
  }

  // 案C：はじめに一覧
  {
    const { context, page } = await open()
    await common(page, LIST)
    // 一覧の画面：中身を隠す。ログイン中の表示は一覧の下のまま
    await page.addStyleTag({ content: '.mock-listview .work { display: none !important; } .mock-listview .mock-bottom { display: none; }' })
    await page.evaluate(() => document.body.classList.add('mock-listview'))
    await shot(page, 'c-list')
    // 区切りを押したあと：一覧を隠し、「‹ 一覧」を出す
    await page.evaluate(() => document.body.classList.remove('mock-listview'))
    await page.addStyleTag({ content: '.mock-section .side-nav { display: none !important; }' })
    await page.evaluate(() => document.body.classList.add('mock-section'))
    const back = () =>
      page.evaluate(() => {
        document.querySelector('.mock-back')?.remove()
        const b = document.createElement('button')
        b.className = 'mock-back'
        b.innerHTML = '<b>‹</b>管理ページの一覧'
        document.querySelector('.content').prepend(b)
      })
    await back()
    await addPreviewButton(page)
    await shot(page, 'c-year', true)
    await nav(page, 'コース')
    await back()
    await addPreviewButton(page)
    await shot(page, 'c-course', true)
    await context.close()
  }
})
console.log('mockups/v68/shots に撮りました')
