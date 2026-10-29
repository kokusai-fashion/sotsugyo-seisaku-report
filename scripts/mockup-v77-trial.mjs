// mockups/v77：学生の試し 4回目（2026-10-30。poc-output/firsttime/r1029/まとめ4.md の B）の、見た目が変わる直しの案。
// 本物のツール（開発サーバー）を開き、CSS や部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v77-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）。SHEET_ONLY=1 で並べた絵だけ作り直す
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v77/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

async function open(browser, { width = 1366, height = 768, phone = false, sample = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
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
    await sleep(600)
    await ready()
  }
  return { context, page, ready }
}
const rect = (page, sel, pad = 0) => page.evaluate((sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), width: Math.min(innerWidth - Math.max(0, r.left - pad), r.width + pad * 2), height: Math.min(innerHeight - Math.max(0, r.top - pad), r.height + pad * 2) } }, sel, pad)
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}), captureBeyondViewport: false })
const ONLY = process.env.ONLY?.split(',')
const item = async (name, fn) => {
  if (ONLY && !ONLY.includes(name)) return
  try {
    await fn()
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}
// 左の道具と紙面の左半分
const leftArea = (page) => page.evaluate(() => { const p = document.querySelector('.palette').getBoundingClientRect(); return { x: 0, y: 0, width: Math.min(innerWidth, p.right + 520), height: innerHeight } })

if (!process.env.SHEET_ONLY) await withEdge(async (browser) => {
  // ===== ① キーボードで図・表を入れる =====
  await item('keyboard', async () => {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const len = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p6').content.map((n) => n.text ?? '').join('').length)
    await page.evaluate((len) => window.__editor.openEditor('p6', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6')
    await sleep(600)
    // 今：Tab で道具へ出られない（「1字下げは自動」の知らせ）
    await page.keyboard.press('Tab')
    await sleep(500)
    await shot(page, '1-kb-now-tab', await leftArea(page))
    // 案B：Tab の知らせに「道具へは F6」。F6 で道具へ移り、「図を入れる」にフォーカス（書く欄は開いたまま）
    await page.evaluate(() => {
      const t = document.querySelector('.undo-toast .msg, .undo-toast span') ?? document.querySelector('.undo-toast')
      if (t) t.firstChild.textContent = '1字下げは自動で付きます。図・表を入れるときは F6 で左の道具へ（書いている所に入ります）'
      const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる'))
      b.style.outline = '3px solid #2f3e75'
      b.style.outlineOffset = '2px'
    })
    await sleep(300)
    await shot(page, '1-kb-b', await leftArea(page))
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる'))
      b.style.outline = ''
      const t = document.querySelector('.undo-toast')
      if (t) t.style.display = 'none'
    })
    // 今：Esc で閉じると「図を入れる」「表を入れる」は薄く、押せない
    await page.keyboard.press('Escape')
    await sleep(900)
    await ready()
    await shot(page, '1-kb-now-esc', await leftArea(page))
    // 案A：Esc のあとも押せる。さっき書いていた所に入れる（道具の上に一言）
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('.palette .tb.why-off, .palette .tb:disabled')) {
        if (!/図を入れる|表を入れる/.test(b.textContent)) continue
        b.classList.remove('why-off')
        b.disabled = false
        b.removeAttribute('aria-disabled')
      }
      const fig = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる'))
      const note = document.createElement('div')
      note.style.cssText = 'margin:4px 6px 6px;padding:5px 6px;border-radius:6px;background:#eef1f8;color:#2f3e75;font-size:11px;line-height:1.45;'
      note.innerHTML = '<span style="display:inline-block">さっき</span><span style="display:inline-block">書いて</span><span style="display:inline-block">いた所に</span><span style="display:inline-block">入れます</span>'
      fig.parentElement.insertBefore(note, fig)
      fig.style.outline = '3px solid #2f3e75'
      fig.style.outlineOffset = '2px'
    })
    await sleep(300)
    await shot(page, '1-kb-a', await leftArea(page))
    await context.close()
  })

  // ===== ② はじめての案内から、バックアップで戻す =====
  await item('backup', async () => {
    const { context, page } = await open(browser, { sample: false })
    await sleep(800)
    const tip = await rect(page, '.guide .g-tip', 16)
    await shot(page, '2-bk-now', tip)
    // 案A：コースを選ぶ画面のいちばん下に、小さな字のリンク
    await page.evaluate(() => {
      const t = document.querySelector('.guide .g-tip')
      const p = document.createElement('p')
      p.style.cssText = 'margin:12px 0 0;padding-top:10px;border-top:1px solid #e3e0da;font-size:12.5px;color:#5c606b;'
      p.innerHTML = '前に保存したバックアップファイルがあるとき（別のパソコン・作り直したあと）：<button style="border:0;background:none;padding:0;color:#2f3e75;text-decoration:underline;font-size:12.5px;cursor:pointer;">バックアップから戻す</button>'
      t.append(p)
    })
    await sleep(300)
    await shot(page, '2-bk-a', await rect(page, '.guide .g-tip', 16))
    await page.evaluate(() => document.querySelector('.guide .g-tip > p:last-child')?.remove())
    // 案B：次の「Word で書き始めていますか？」に、3つめの選びとして
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await sleep(500)
    await page.evaluate(() => {
      const opts = document.querySelector('.guide .g-opts')
      const no = opts.querySelector('.g-word-opt.no')
      const b = no.cloneNode(true)
      b.className = 'g-word-opt no'
      b.querySelector('span').innerHTML = '前のバックアップファイルから戻す<small>別のパソコンで書いていた・作り直したあとなど</small>'
      opts.append(b)
    })
    await sleep(300)
    await shot(page, '2-bk-b', await rect(page, '.guide .g-tip', 16))
    await context.close()
  })

  // ===== ③ フォーカスの枠 =====
  await item('focus', async () => {
    const { context, page, ready } = await open(browser)
    // 「PDFを書き出す」にキーボードで移る
    await page.evaluate(() => document.querySelector('.side .export').focus({ focusVisible: true }))
    await sleep(400)
    const foot = await rect(page, '.side .side-foot', 8)
    await shot(page, '3-fc-now-pdf', foot)
    // 紙面の段落（道具の「＋」で拡大）
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    await page.evaluate(() => document.querySelector('.side .export').focus({ focusVisible: true }))
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom-step button')].pop()?.click())
      await sleep(300)
    }
    await ready()
    await page.evaluate(() => { const el = [...document.querySelectorAll('.page-viewport.front [data-paper-key^="b:p"]')].find((e) => e.getBoundingClientRect().width > 0 && !e.closest('[inert]') && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0); el?.focus({ focusVisible: true }); el?.scrollIntoView({ block: 'center' }) })
    await sleep(500)
    const para = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: Math.max(0, r.left - 30), y: Math.max(0, r.top - 30), width: Math.min(760, r.width + 60), height: Math.min(260, r.height + 60) } })
    await shot(page, '3-fc-now-paper', para)
    // 案A：黄色の太い枠（3px）と白い縁
    const style = (css) => page.evaluate((css) => { let s = document.getElementById('mock-focus'); if (!s) { s = document.createElement('style'); s.id = 'mock-focus'; document.head.append(s) } s.textContent = css }, css)
    await style(`.side .export:focus-visible { outline: 3px solid #f2b705 !important; outline-offset: 2px !important; box-shadow: 0 0 0 2px #fff; }
      .page-viewport [data-paper-key]:focus-visible:not(.is-selected, figure > *, .page-break, [data-photo-slot]):not(.m1):not(.m2) { outline: max(3px, calc(3px / var(--s))) solid #f2b705 !important; outline-offset: max(3px, calc(3px / var(--s))) !important; box-shadow: 0 0 0 max(3px, calc(3px / var(--s))) #fff; }`)
    await page.evaluate(() => { const el = [...document.querySelectorAll('.page-viewport.front [data-paper-key^="b:p"]')].find((e) => e.getBoundingClientRect().width > 0 && !e.closest('[inert]') && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0); el?.focus({ focusVisible: true }) })
    await sleep(300)
    await shot(page, '3-fc-a-paper', para)
    await page.evaluate(() => document.querySelector('.side .export').focus({ focusVisible: true }))
    await sleep(300)
    await shot(page, '3-fc-a-pdf', foot)
    // 案B：紺の太い枠（3px）と白い縁（紺のボタンは、白い縁の外に紺の枠）
    await style(`.side .export:focus-visible { outline: 3px solid #2f3e75 !important; outline-offset: 3px !important; box-shadow: 0 0 0 3px #fff; }
      .page-viewport [data-paper-key]:focus-visible:not(.is-selected, figure > *, .page-break, [data-photo-slot]):not(.m1):not(.m2) { outline: max(3px, calc(3px / var(--s))) solid #2f3e75 !important; outline-offset: max(3px, calc(3px / var(--s))) !important; box-shadow: 0 0 0 max(3px, calc(3px / var(--s))) #fff; }`)
    await sleep(300)
    await shot(page, '3-fc-b-pdf', foot)
    await page.evaluate(() => { const el = [...document.querySelectorAll('.page-viewport.front [data-paper-key^="b:p"]')].find((e) => e.getBoundingClientRect().width > 0 && !e.closest('[inert]') && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0); el?.focus({ focusVisible: true }) })
    await sleep(300)
    await shot(page, '3-fc-b-paper', para)
    await context.close()
  })
})

// ---- 並べた絵 ----
await sleep(1500)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const has = (p) => { try { readFileSync(join(OUT, `${p}.png`)); return true } catch { return false } }
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const sheet = async (file, title, sub, cols, width = 1700) => {
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: ${width - 44}px; }
      h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; line-height: 1.6; }
      .row { display: grid; grid-template-columns: repeat(${cols.length}, 1fr); gap: 16px; align-items: start; }
      .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; min-height: 44px; }
      .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 6px; }
    </style><h1>${title}</h1><p class="sub">${sub}</p><div class="row">${cols.map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p>${c.imgs.filter(has).map((s) => `<img src="${img(s)}">`).join('')}</div>`).join('')}</div>`
    await page.setViewport({ width, height: 800 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: `mockups/v77/${file}.png`, fullPage: true })
  }
  await sheet('1-keyboard', '① キーボードだけで図・表を入れる', '書いている間は Tab で道具へ出られず（「1字下げは自動」の知らせ）、Esc で閉じると「図を入れる」「表を入れる」が押せない。キーボードだけでは、ここだけマウスが要った（画面を拡大して使う学生の役。重さ「高」）。', [
    { h: '今', t: 'Tab は書く欄の中にとどまる。Esc で閉じると、2つは薄く押せない', imgs: ['1-kb-now-tab', '1-kb-now-esc'] },
    { h: '案A（おすすめ）', t: 'Esc で閉じたあとも押せる。さっき書いていた所に入れる（道具の上に「さっき書いていた所に入れます」）。マウスでも同じ', imgs: ['1-kb-a'] },
    { h: '案B', t: '書いている間に F6 で道具へ移る（書く欄は開いたまま）。Tab の知らせに「図・表を入れるときは F6」', imgs: ['1-kb-b'] },
  ], 1900)
  await sheet('2-backup', '② はじめての案内から、バックアップファイルで戻す', '「最初から作り直す」のあとや別のパソコンで初めて開くと、コースを選ぶ案内が画面をふさぎ、「メニュー」のバックアップから戻すまで3回押す必要がある（何日もかけて書く学生の役）。', [
    { h: '今', t: 'コースを選ぶ・「いいえ」・「あとで入力する」のあとで、メニューから', imgs: ['2-bk-now'] },
    { h: '案A（おすすめ）', t: 'コースを選ぶ画面のいちばん下に、小さな字の「バックアップから戻す」', imgs: ['2-bk-a'] },
    { h: '案B', t: '次の「Word で書き始めていますか？」に、3つめの選び「前のバックアップファイルから戻す」', imgs: ['2-bk-b'] },
  ], 1700)
  await sheet('3-focus', '③ キーボードで移ったときの枠', '紺色のボタン（PDFを書き出す・本文へ進む）では、枠が細く見分けにくい。道具の「＋」で拡大した紙面では、欄の枠が細くなる（画面を拡大して使う学生の役）。', [
    { h: '今', t: '細い枠（ボタンは黒い線・紙面は紺の線）', imgs: ['3-fc-now-pdf', '3-fc-now-paper'] },
    { h: '案A（おすすめ）', t: '黄色の太い枠（3px）と白い縁。紺のボタンの上でも、紙面の上でも目立つ', imgs: ['3-fc-a-pdf', '3-fc-a-paper'] },
    { h: '案B', t: '紺の太い枠（3px）と白い縁（いまの色のまま太く）', imgs: ['3-fc-b-pdf', '3-fc-b-paper'] },
  ], 1500)
})
console.log('できました：mockups/v77/')
