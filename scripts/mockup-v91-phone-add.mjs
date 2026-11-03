// mockups/v91：スマホの録画（2026-11-03）で迷った2つの見た目の案。
// ① 下の「追加」の中に「図」「表」がなく、図を選んで「追加」を押した学生が迷った（案A：「追加」の中に「図」「表」を足す。入る所は、見出しと同じ「最後に触ったところの後ろ」）
// ② 書いている間のキーボードの上の道具で、「追加」のつもりで隣の「表」を押した（案A：「追加」の前を空けて仕切る／案B：「追加」を左はしへ）
// 本物のツール（自動テスト用にまとめた版）に見本「シンドバッド」を入れ、案の部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v91-phone-add.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v91'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const FIG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>'
const TAB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 15h17M10 4.5v15"/></svg>'

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
  await sleep(500)
  await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  await ready()
  await page.evaluate(setupSinbad, sinbadSample())
  await sleep(800)
  await ready()

  // ---- ① 下の「追加」 ----
  await page.evaluate(() => { const i = window.__editor.pageElements().findIndex((p) => p.querySelector('[data-figure-id="f3"]')); return window.__editor.goToPage(i, 'none') })
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'figure', id: 'f3' }))
  await sleep(500)
  await page.evaluate(() => document.querySelector('.p-nav button.add')?.click())
  await sleep(900)
  await page.screenshot({ path: `${OUT}/①今_下の追加.png` })
  await page.evaluate(
    (FIG, TAB) => {
      const grid = document.querySelector('.add-grid')
      if (!grid) return
      const make = (label, svg) => {
        const b = grid.querySelector('.tb').cloneNode(true)
        b.querySelector('svg').outerHTML = svg
        b.querySelector('span').textContent = label
        return b
      }
      grid.append(make('図', FIG), make('表', TAB))
      const hints = document.querySelectorAll('.sheet-hint')
      if (hints[0]) hints[0].textContent = '本文の、最後に触ったところの後ろに入ります（図を選んでいれば、その図の後ろ。大見出しは、その章のいちばん後ろに新しい章を足します）。'
      if (hints[1]) hints[1].remove()
    },
    FIG,
    TAB,
  )
  await sleep(300)
  await page.screenshot({ path: `${OUT}/①案A_追加に図と表.png` })
  await page.keyboard.press('Escape')
  await sleep(600)
  await page.evaluate(() => document.querySelector('.sheet-back, .sheet .x, .p-sheet .close')?.click())
  await sleep(600)

  // ---- ② キーボードの上の道具 ----
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p4'), 'none'))
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.openEditor('p4', 5))
  await sleep(1500)
  const bar = await page.evaluate(() => !!document.querySelector('.direct-bar .db-row'))
  console.log('keyboard bar', bar)
  await page.screenshot({ path: `${OUT}/②今_キーボードの上.png` })
  const addButton = () => [...document.querySelectorAll('.direct-bar .db-row button')].find((b) => b.getAttribute('aria-label')?.startsWith('追加'))
  await page.evaluate(`(${addButton})()?.setAttribute('style', 'margin-left:14px;border-left:1px solid #d9d6cf;border-radius:0 8px 8px 0;padding-left:12px')`)
  await sleep(200)
  await page.screenshot({ path: `${OUT}/②案A_追加の前を仕切る.png` })
  await page.evaluate(`(() => { const b = (${addButton})(); if (!b) return; b.removeAttribute('style'); const row = b.parentElement; row.prepend(b); b.setAttribute('style', 'margin-right:10px;border-right:1px solid #d9d6cf;border-radius:8px 0 0 8px;padding-right:10px') })()`)
  await sleep(200)
  await page.screenshot({ path: `${OUT}/②案B_追加を左はしへ.png` })
  await context.close()
})
console.log('done')
