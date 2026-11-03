// mockups/v96：スマホで書いている間のキーボードの上の道具（見出しを 大見出し・中見出し・小見出し の3つにしたとき。依頼者 2026-11-03：
// 図・表・見出し・改ページを「＋追加」の中に入れず、じかに押せるのが理想）。本物のツールに見本「シンドバッド」を入れ、道具の段を差し替えて撮る。
//   案1：1段に全部（戻す・やり直すは画面の上の帯だけにする）
//   案2：「見出し」を1つにまとめる（押すと、上に 大見出し・中見出し・小見出し が出る）
//   案3：2段にする（上：入れるもの／下：削除・戻す・やり直す・完了）
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v96-kbar.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v96'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const glyph = (t, size = 13) => `<svg viewBox="0 0 24 24"><text x="12" y="17" text-anchor="middle" font-family="serif" font-size="${size}" font-weight="700" fill="currentColor">${t}</text></svg>`
const FIG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>'
const TAB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 15h17M10 4.5v15"/></svg>'
const PB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="3.5" width="14" height="6" rx="1"/><rect x="5" y="14.5" width="14" height="6" rx="1"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/></svg>'
const DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>'
const UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-3"/></svg>'
const REDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5h-9a5 5 0 0 0 0 10h3"/></svg>'
const HEAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 6h14M5 12h10M5 18h6"/></svg>'
const b = (icon, label, cls = '') => `<button class="${cls}">${icon}<span>${label}</span></button>`
const done = '<button class="mk-done">完了</button>'

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
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
  await page.addStyleTag({ content: `.direct-bar .db-row button.mk-done { min-width: 62px; margin-left: auto; padding: 8px 12px; border-radius: 10px; background: #2f3e75; color: #fff; font-size: 14px; font-weight: 700; }
    .direct-bar .db-row.mk-tight { gap: 0; }
    .direct-bar .db-row.mk-tight button:not(.mk-done) { min-width: 0; flex: 1 1 0; padding: 2px 0; font-size: 10px; }
    .direct-bar .db-row.mk-tight button.mk-done { min-width: 48px; padding: 8px 6px; font-size: 13px; }
    .direct-bar .db-row button.mk-on { background: #e6e9f4; color: #2f3e75; }
    .direct-bar .mk-sub { display: flex; gap: 6px; justify-content: center; padding: 4px 0 6px; border-bottom: 1px solid #e3e0da; }
    .direct-bar .mk-sub button { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid #d9d6cf; border-radius: 999px; background: #fff; font: 13px 'BIZ UDPGothic', sans-serif; color: #24262b; }
    .direct-bar .mk-sub button svg { width: 18px; height: 18px; }
    .direct-bar .db-row.mk-second { border-top: 1px solid #e3e0da; padding-top: 2px; }` })

  const i = await page.evaluate(() => window.__editor.pageElements().findIndex((p) => p.querySelector('[data-figure-id="f2"]')))
  await page.evaluate((i) => window.__editor.goToPage(i, 'none'), i)
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.openEditor('p4', 5))
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/今.png` })
  const setBar = (html, extraClass = '', before = '') =>
    page.evaluate(
      (html, extraClass, before) => {
        const bar = document.querySelector('.direct-bar')
        bar.querySelectorAll('.mk-sub, .mk-second').forEach((e) => e.remove())
        const row = [...bar.querySelectorAll('.db-row')].pop()
        row.className = `db-row ${extraClass}`.trim()
        row.innerHTML = html
        if (before) row.insertAdjacentHTML('beforebegin', before)
      },
      html,
      extraClass,
      before,
    )
  // 案1：1段に全部（戻す・やり直すは上の帯だけ）
  await setBar([b(DEL, '削除', 'danger'), b(FIG, '図'), b(TAB, '表'), b(glyph('Ⅰ', 14), '大見出し'), b(glyph('ⅰ', 14), '中見出し'), b(glyph('(1)', 11), '小見出し'), b(PB, '改ページ'), done].join(''), 'mk-tight')
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案1_1段に全部.png` })
  // 案2：「見出し」を1つに（押したところ）
  await setBar(
    [b(DEL, '削除', 'danger'), b(UNDO, '戻す'), b(FIG, '図'), b(TAB, '表'), b(HEAD, '見出し', 'mk-on'), b(PB, '改ページ'), done].join(''),
    '',
    `<div class="mk-sub"><button>${glyph('Ⅰ', 14)}大見出し</button><button>${glyph('ⅰ', 14)}中見出し</button><button>${glyph('(1)', 11)}小見出し</button></div>`,
  )
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案2_見出しを1つに.png` })
  // 案3：2段
  await setBar(
    [b(DEL, '削除', 'danger'), b(UNDO, '戻す'), b(REDO, 'やり直す'), done].join(''),
    'mk-second',
    `<div class="db-row">${[b(FIG, '図'), b(TAB, '表'), b(glyph('Ⅰ', 14), '大見出し'), b(glyph('ⅰ', 14), '中見出し'), b(glyph('(1)', 11), '小見出し'), b(PB, '改ページ')].join('')}</div>`,
  )
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案3_2段.png` })
  await context.close()
})
console.log('done')
