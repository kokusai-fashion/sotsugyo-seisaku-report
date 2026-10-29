// mockups/v66：試し（2026-10-26b）で見つかったことのうち、見た目が変わるものの案。
// ① スマホのログインの窓に、Classroom などのアプリから開いたときの切り替えの案内を出すか（アプリの中でログインに失敗しても、案内はログインしたあとのヘルプにしかなかった）
// ② 右下の帯：「＋」を押して拡大すると帯の右に「‹ ›」が出て、「＋」が左へずれ、同じ所の2回目で「›」（ページ送り）に当たった
// ③ 画面の案内（パソコン 7段）に、左の道具の下へ移した「元に戻す」と、右下の「－ ％ ＋」の紹介がない
// 本物のツール（開発サーバー）を開き、部品を足し・並べ替えて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v66-trial-fixes.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'
import { fakeDrive, routeGoogle } from './e2e/fakeGoogle.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v66/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const config = JSON.parse(readFileSync('scripts/e2e/config-fixture.json', 'utf8'))
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const COMPASS =
  '<svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-3px" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" fill="currentColor"/></svg>'

const ready = (page) =>
  page.waitForFunction(() => {
    const s = window.__editor?.getSnapshot()
    return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading')
  }, { timeout: 120000 })
const noHmr = (page) =>
  page.evaluateOnNewDocument(() => {
    const Real = window.WebSocket
    window.WebSocket = function (url, protocols) {
      if (String(protocols).includes('vite-hmr')) return { readyState: 0, addEventListener() {}, removeEventListener() {}, send() {}, close() {} }
      return new Real(url, protocols)
    }
  })

const MOCK_CSS = `
  .mock-inapp { margin: 14px 0 0; padding: 10px 12px; border-radius: 10px; background: #eef1f8; color: #2f3a56; font-size: 12.5px; line-height: 1.75; }
  .mock-inapp b { display: block; font-size: 13px; margin-bottom: 2px; }
  .mock-inapp span { display: block; }
  .mock-guide { position: fixed; left: 0; right: 0; border-top: 2px dashed #d03b3b; pointer-events: none; z-index: 999; }
  .mock-vline { position: fixed; top: 0; bottom: 0; border-left: 2px dashed #d03b3b; pointer-events: none; z-index: 999; }
  .view-bar .bar-nav.mock-ghost { visibility: hidden; }
`

await withEdge(async (browser) => {
  // ---- ① スマホのログインの窓 ----
  if (!process.env.TOUR_ONLY) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await noHmr(page)
    await page.setUserAgent(IPHONE_UA)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await routeGoogle(page, fakeDrive('00zz0123@bunka-wu.ac.jp'), config)
    await page.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 90000 })
    await page.waitForSelector('.login-over .login-btn', { timeout: 90000 })
    await page.addStyleTag({ content: MOCK_CSS })
    await sleep(600)
    const card = async () => page.evaluate(() => { const r = document.querySelector('.login-card').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top - 16), width: 390, height: r.height + 32 } })
    const shot = async (name) => page.screenshot({ path: join(OUT, `${name}.png`), clip: await card(), captureBeyondViewport: false })
    await shot('login-now')
    const original = await page.evaluate(() => document.querySelector('.login-card').innerHTML)
    const lines = `<span>${COMPASS} iPhone：右下の方位磁針のボタン</span><span>⋮ Android：右上の「⋮」→「Chrome で開く」</span>`
    // 案A：失敗したときだけ（赤い枠の中に1段足す）
    await page.evaluate((lines) => {
      const lead = document.querySelector('.login-card .login-lead')
      const err = document.createElement('div')
      err.className = 'login-err'
      err.innerHTML = 'ログインの窓が閉じられました。Google の画面にエラー（例：「エラー 400: admin_policy_enforced」）が出ていたら、その文字を控えてください<small>ログインの窓が開かないときは、ブラウザのポップアップを許可してください</small>' +
        `<small style="margin-top:6px;color:#3f4249">Classroom・LINE などのアプリから開いたときは、Safari・Chrome に切り替えてから、もう一度：</small><small style="color:#3f4249">${lines.replace(/<span>/g, '').replace(/<\/span>/g, '<br>')}</small>`
      lead.replaceWith(err)
      document.querySelector('.login-card .login-btn').lastChild.textContent = 'もう一度ログインする'
    }, lines)
    await sleep(200)
    await shot('login-a-error')
    // 案B：スマホでは、はじめから小さな囲みを出す（失敗したときも出たまま）
    await page.evaluate((html) => { document.querySelector('.login-card').innerHTML = html }, original)
    await page.evaluate((lines) => {
      const box = document.createElement('div')
      box.className = 'mock-inapp'
      box.innerHTML = `<b>Classroom・LINE などから開いたとき</b>Safari・Chrome に切り替えてから、ログインします。${lines}`
      document.querySelector('.login-card .login-btn').after(box)
    }, lines)
    await sleep(200)
    await shot('login-b-always')
    await context.close()
  }

  // ---- ② ③ パソコン ----
  if (!process.env.TOUR_ONLY) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await noHmr(page)
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
  await ready(page)
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready(page)
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready(page)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await ready(page)
  await page.addStyleTag({ content: MOCK_CSS })
  await page.mouse.move(5, 5)

  // ② 帯：100% と 125% を、同じ切り抜きで撮る（赤い点線は、100% のときの「＋」の位置）
  const barClip = async () => page.evaluate(() => { const s = document.querySelector('.stage').getBoundingClientRect(); return { x: s.right - 640, y: s.bottom - 76, width: 628, height: 70 } })
  const plusX = () => page.evaluate(() => { const b = [...document.querySelectorAll('.view-bar .zoom-step button')].at(-1).getBoundingClientRect(); return b.left + b.width / 2 })
  const markPlus = (x) => page.evaluate((x) => { document.querySelector('.mock-vline')?.remove(); const l = document.createElement('div'); l.className = 'mock-vline'; l.style.left = `${x - 1}px`; document.body.append(l) }, x)
  const setLevel = async (zoom) => {
    if (zoom) await page.evaluate(() => window.__editor.zoomStep(1))
    else await page.evaluate(() => window.__editor.setView('fit'))
    await sleep(900)
    await ready(page)
  }
  const barShot = async (name) => {
    await sleep(250)
    await page.screenshot({ path: join(OUT, `${name}.png`), clip: await barClip(), captureBeyondViewport: false })
  }
  // いま
  await setLevel(false)
  const x100 = await plusX()
  await markPlus(x100)
  await barShot('bar-now-100')
  await setLevel(true)
  await barShot('bar-now-125')
  // 案A：「‹ ›」を帯の左の端に出す
  const moveNavLeft = () => page.evaluate(() => { const bar = document.querySelector('.view-bar'); const nav = bar.querySelector('.bar-nav'); if (nav) bar.prepend(nav) })
  await setLevel(false)
  await barShot('bar-a-100')
  await setLevel(true)
  await moveNavLeft()
  await barShot('bar-a-125')
  // 案B：「‹ ›」の場所をいつもとっておく（100% では見えない・押せない）
  await setLevel(true)
  const ghost = await page.evaluate(() => document.querySelector('.view-bar .bar-nav').outerHTML)
  await setLevel(false)
  await page.evaluate((html) => { const bar = document.querySelector('.view-bar'); bar.insertAdjacentHTML('beforeend', html); bar.lastElementChild.classList.add('mock-ghost') }, ghost)
  await markPlus(await plusX())
  await barShot('bar-b-100')
  await page.evaluate(() => document.querySelector('.mock-ghost')?.remove())
  await setLevel(true)
  await barShot('bar-b-125')
  await page.evaluate(() => document.querySelector('.mock-vline')?.remove())
  await setLevel(false)

  // ③ 画面の案内（はじめて開いた人：表紙の案内を「あとで」で閉じると始まる）
  await context.close()
  }
  const tourContext = await browser.createBrowserContext()
  const tp = await tourContext.newPage()
  await noHmr(tp)
  await stubConfig(tp)
  await tp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  await tp.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
  await ready(tp)
  await tp.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await tp.evaluate(() => document.querySelector('.g-opts button').click())
  await tp.waitForSelector('.guide.step-word .g-word-opt.no')
  await tp.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await tp.waitForSelector('.guide .g-later')
  await tp.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready(tp)
  await tp.evaluate(setupWriting)
  await sleep(600)
  await ready(tp)
  // 使い方の「画面の案内をもう一度見る」→「いま見る」
  await tp.click('.side .menu-btn')
  await tp.waitForSelector('.side .head-menu')
  await tp.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].find((b) => b.textContent.includes('使い方')).click())
  await tp.waitForSelector('.help-list [data-topic="tour"]')
  await tp.evaluate(() => document.querySelector('.help-list [data-topic="tour"]').click())
  await tp.waitForSelector('.help-action')
  await tp.click('.help-action')
  await tp.waitForSelector('.tour-tip', { timeout: 30000 })
  await sleep(700)
  const page2 = tp
  const next = async () => {
    await page2.evaluate(() => [...document.querySelectorAll('.tour-tip button')].find((b) => b.textContent.includes('次へ')).click())
    await sleep(700)
  }
  const tourShot = async (name) => {
    await page2.mouse.move(5, 5)
    await sleep(200)
    await page2.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
  }
    await next()
  await tourShot('tour-now-2')
  // 案A・B 共通：「道具」の文に「元に戻す」を足す
  await page2.evaluate(() => {
    const p = [...document.querySelectorAll('.tour-tip p, .tour-tip div')].find((e) => e.childElementCount === 0 && e.textContent.includes('図・表は'))
    p.textContent = '図・表は、文中をクリックしてから、ここで入れます。いちばん下の「元に戻す」で、ひとつ前に戻せます。'
  })
  await tourShot('tour-ab-2')
  // 案B：「表示」の段を足す（右下の帯に光を当てる）
  await page2.evaluate(() => {
    const bar = document.querySelector('.view-bar').getBoundingClientRect()
    const spot = document.querySelector('.tour-spot')
    Object.assign(spot.style, { transition: 'none', left: `${bar.left - 6}px`, top: `${bar.top - 6}px`, width: `${bar.width + 12}px`, height: `${bar.height + 12}px` })
    const tip = document.querySelector('.tour-tip')
    const title = [...tip.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.trim() === '道具')
    title.textContent = '表示'
    const p = [...tip.querySelectorAll('*')].find((e) => e.childElementCount === 0 && e.textContent.includes('図・表は'))
    p.textContent = '1ページ・見開き・拡大と、「－ ％ ＋」で、表示の大きさを変えます。'
    const count = [...tip.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /^\s*2\s*\/\s*7\s*$/.test(e.textContent))
    if (count) count.textContent = '3 / 8'
    tip.dataset.side = 'above'
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    tip.style.transform = `translate(${Math.round(bar.right - w)}px, ${Math.round(bar.top - h - 18)}px)`
    tip.style.left = '0px'
    tip.style.top = '0px'
    tip.style.setProperty('--ax', `${w - 120}px`)
  })
  await tourShot('tour-b-view')
  await tourContext.close()
})
console.log('mockups/v66/shots に撮りました')
