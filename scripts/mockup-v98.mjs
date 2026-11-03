// mockups/v98（2026-11-03 夜）：
//   ① 小見出し（（1））を入れたときの、本文と目次（本物のツールで見本「シンドバッド」に小見出しを2つ入れて撮る）
//   ② スマホで拡大しているときのページ送り（依頼者 2026-11-03：拡大中はページを送れず、気づきにくい）
//      今：拡大中は「◀ ▶」を出さず、右下に「ページ全体に戻す」だけ
//      案A：下の真ん中に1つにまとめる（◀ 3/12 ▶ ｜ 全体）
//      案B：左下に「◀ 3/12 ▶」、右下に「全体に戻す」
//      案C：ページの下の端まで動かすと「次のページへ」（「ページ全体に戻す」は今のまま）
//   ③ パソコンの低い画面（1280×586）で作品写真を選んだとき、「トリミング」が増えて、左の道具の「やり直す」が隠れる
//      今／案A：「この写真」の道具を、絵と名前を横に並べた1行ずつにする（fit-1 の「元に戻す・やり直す」と同じ形）
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v98.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v98'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

async function open(browser, phone, size) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else {
    await page.setViewport({ ...size, deviceScaleFactor: 1 })
  }
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
  // 小見出しを2つ：ブラウス（s4）のすぐ下に「パターン」、p6（袖の刺繍）の前に「刺繍」
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => ({
        ...c,
        blocks: c.blocks.flatMap((b) =>
          b.id === 's4' ? [b, { type: 'subheading', id: 'm1', title: 'パターン', level: 3 }] : b.id === 'p6' ? [{ type: 'subheading', id: 'm2', title: '刺繍', level: 3 }, b] : [b],
        ),
      })),
    })),
  )
  await sleep(800)
  await ready()
  return { context, page, ready }
}

await withEdge(async (browser) => {
  // ---- ① 本文と目次（パソコン） ----
  if (!process.env.ONLY || process.env.ONLY === '1') {
    const { context, page, ready } = await open(browser, false, { width: 1440, height: 1000 })
    const shotPage = async (index, file) => {
      await page.evaluate((i) => window.__editor.goToPage(i, 'none'), index)
      await sleep(600)
      await ready()
      const clip = await page.evaluate((i) => { const r = window.__editor.pageElements()[i].getBoundingClientRect(); return { x: r.left, y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, innerHeight - Math.max(0, r.top)) } }, index)
      await page.screenshot({ path: `${OUT}/${file}`, clip })
    }
    const body = await page.evaluate(() => window.__editor.pageOfBlock('m1'))
    await shotPage(body, '①小見出し_本文.png')
    const toc = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.indexOf('toc'))
    await shotPage(toc, '①小見出し_目次.png')
    await context.close()
  }

  // ---- ② スマホの拡大中のページ送り ----
  if (!process.env.ONLY || process.env.ONLY === '2') {
    const { context, page, ready } = await open(browser, true)
    const at = await page.evaluate(() => window.__editor.pageOfBlock('p5'))
    await page.evaluate((i) => window.__editor.goToPage(i, 'none'), at)
    await sleep(600)
    await ready()
    const pagerHtml = await page.evaluate(() => document.querySelector('.pager')?.outerHTML ?? '')
    await page.screenshot({ path: `${OUT}/②スマホ_ページ全体（今）.png` })
    await page.evaluate(() => window.__editor.setZoom(true))
    await sleep(900)
    await page.screenshot({ path: `${OUT}/②スマホ_拡大中（今）.png` })
    await page.addStyleTag({
      content: `.mk { position: fixed; z-index: 12; }
        .mk-a { left: 50%; bottom: calc(62px + 12px); transform: translateX(-50%); display: flex; align-items: center; gap: 2px; padding: 3px; background: rgba(255,255,255,.95); border: 1px solid #d9d6cf; border-radius: 999px; box-shadow: 0 2px 10px rgba(0,0,0,.14); font: 12px 'BIZ UDPGothic', sans-serif; white-space: nowrap; }
        .mk-a .pager { position: static; transform: none; border: 0; box-shadow: none; padding: 0; background: none; }
        .mk-a .sep { width: 1px; height: 22px; background: #d9d6cf; margin: 0 4px; }
        .mk-a .all { display: flex; align-items: center; gap: 4px; padding: 8px 10px 8px 6px; border: 0; background: none; color: #24262b; font: inherit; }
        .mk-a .all svg, .mk-b-all svg { width: 16px; height: 16px; }
        .mk-b-pager .pager { left: 12px; transform: none; }
        .mk-b-all { right: 12px; bottom: calc(62px + 12px); display: flex; align-items: center; gap: 5px; padding: 8px 12px; border: 1px solid #d9d6cf; border-radius: 999px; background: rgba(255,255,255,.95); box-shadow: 0 2px 10px rgba(0,0,0,.14); font: 12px 'BIZ UDPGothic', sans-serif; color: #24262b; }
        .mk-c { left: 50%; bottom: calc(62px + 70px); transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 999px; background: #2f3e75; color: #fff; font: 700 13px 'BIZ UDPGothic', sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.2); }
        .mk-c svg { width: 16px; height: 16px; }`,
    })
    const fitIcon = await page.evaluate(() => document.querySelector('.unzoom svg')?.outerHTML ?? '')
    // 案A：下の真ん中に1つ
    await page.evaluate((pager, fit) => {
      document.querySelector('.unzoom').style.display = 'none'
      const d = document.createElement('div')
      d.className = 'mk mk-a'
      d.innerHTML = `${pager}<span class="sep"></span><button class="all">${fit}全体</button>`
      document.body.append(d)
    }, pagerHtml, fitIcon)
    await sleep(200)
    await page.screenshot({ path: `${OUT}/②スマホ_案A_下の真ん中に1つ.png` })
    // 案B：左下に ◀ ▶、右下に「全体に戻す」
    await page.evaluate((pager, fit) => {
      document.querySelectorAll('.mk').forEach((e) => e.remove())
      const p = document.createElement('div')
      p.className = 'mk mk-b-pager'
      p.innerHTML = pager
      const all = document.createElement('button')
      all.className = 'mk mk-b-all'
      all.innerHTML = `${fit}全体に戻す`
      document.body.append(p, all)
    }, pagerHtml, fitIcon)
    await sleep(200)
    await page.screenshot({ path: `${OUT}/②スマホ_案B_左に送る・右に戻す.png` })
    // 案C：ページの下の端まで動かすと「次のページへ」
    await page.evaluate((fit) => {
      document.querySelectorAll('.mk').forEach((e) => e.remove())
      document.querySelector('.unzoom').style.display = ''
      const s = document.querySelector('.page-scroller')
      s.scrollTop = s.scrollHeight
      const c = document.createElement('button')
      c.className = 'mk mk-c'
      c.innerHTML = '次のページへ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
      document.body.append(c)
    }, fitIcon)
    await sleep(400)
    await page.screenshot({ path: `${OUT}/②スマホ_案C_下の端で次のページへ.png` })
    await context.close()
  }

  // ---- ③ パソコンの低い画面で作品写真を選んだとき ----
  if (!process.env.ONLY || process.env.ONLY === '3') {
    const { context, page, ready } = await open(browser, false, { width: 1280, height: 586 })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: r.workPhotos.map((p, i) => (i === 0 ? { ...p, layout: 4, columns: 2, imageIds: [p.imageIds[0], p.imageIds[0], '', ''] } : p)) })))
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf('photos'), 'none'))
    await sleep(600)
    await ready()
    const photoAt = await page.evaluate(() => { const r = document.querySelector('.page-viewport.front [data-photo-slot="0"] img').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.click(photoAt.x, photoAt.y)
    await sleep(700)
    const clip = await page.evaluate(() => { const r = document.querySelector('.palette').getBoundingClientRect(); return { x: Math.max(0, r.left - 20), y: 0, width: 760, height: innerHeight } })
    await page.screenshot({ path: `${OUT}/③PC低い画面_今.png`, clip })
    const fits = () =>
      page.evaluate(() => {
        const p = document.querySelector('.palette')
        const r = p.getBoundingClientRect()
        return { scrolls: p.scrollHeight > p.clientHeight + 1, hidden: [...p.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().bottom > r.bottom + 1).map((b) => b.textContent.trim()) }
      })
    // 案A：絵と名前を横に並べた1行ずつ
    const a = await page.addStyleTag({
      content: `.palette .group.ctx:has(.photo-sw) .tb { flex-direction: row; justify-content: flex-start; gap: 3px; padding: 6px 3px; font-size: 10px; letter-spacing: 0; white-space: nowrap; }
        .palette .group.ctx:has(.photo-sw) .tb svg { width: 14px; height: 14px; flex: none; }`,
    })
    await sleep(800)
    console.log('案A：', JSON.stringify(await fits()))
    await page.screenshot({ path: `${OUT}/③PC低い画面_案A_写真の道具を1行ずつ.png`, clip })
    // 案B：今の形のまま、3つの道具の上下のすき間と絵を少し小さく
    await a.evaluate((e) => e.remove())
    await page.addStyleTag({
      content: `.palette .group.ctx:has(.photo-sw) .tb { padding-block: 2px; gap: 0; }
        .palette .group.ctx:has(.photo-sw) .tb svg { width: 17px; height: 17px; }`,
    })
    await sleep(800)
    console.log('案B：', JSON.stringify(await fits()))
    await page.screenshot({ path: `${OUT}/③PC低い画面_案B_すき間を詰める.png`, clip })
    await context.close()
  }
})
console.log('done')
