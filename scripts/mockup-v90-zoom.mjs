// mockups/v90：作品写真と本文の図の写真を拡大して、見せたい所（中心など）を大きくする案（依頼者 2026-11-03 の会議のあと）。
// 今は作品写真の位置をつかんでずらせるだけ。本文の図は、写真を切らずに全体を入れている。
// 本物のツール（自動テスト用にまとめた版）に見本「シンドバッド」を入れ、写真・図を選んで、案の道具を差し込んで撮る（見た目の案。動きは作っていない）。
//   案A：左の道具に「拡大」の －・＋（つかんでずらすのは今のまま）
//   案B：選んだ写真の上に －・＋ を出す（写真のすぐそば。つかんでずらすのは今のまま）
//   案C：「写る範囲を決める」の窓（大きな写真の上で枠を動かし、つまみで大きさを変える）
// 使い方：node -e "import('./scripts/e2e/serveBuilt.mjs').then(m=>m.serveBuilt('dist-e2e',4180))" で出してから、
//         APP_URL=http://localhost:4180 node scripts/mockup-v90-zoom.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v90'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CSS = `
.mz { margin: 4px 2px 2px; padding: 5px 0 3px; border-top: 1px solid rgba(47,62,117,.18); display: grid; gap: 3px; justify-items: center; font-family: 'BIZ UDPGothic', sans-serif; }
.mz .l { font-size: 10px; color: #2f3e75; font-weight: 700; }
.mz .r { display: flex; align-items: center; gap: 2px; }
.mz button { width: 22px; height: 22px; border: 1px solid #c9cde0; border-radius: 6px; background: #fff; color: #2f3e75; font-size: 14px; line-height: 1; padding: 0; }
.mz .l b { font-size: 10px; color: #24262b; }
.mz .r { gap: 6px; }
.mz button { width: 28px; }
.mz small { font-size: 9px; color: #6b6f78; text-align: center; line-height: 1.35; }
.mzb { position: fixed; z-index: 50; display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 999px; background: rgba(36,38,43,.86); color: #fff; font-family: 'BIZ UDPGothic', sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.mzb button { width: 28px; height: 28px; border: 0; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 17px; line-height: 1; padding: 0; }
.mzb b { font-size: 12px; min-width: 38px; text-align: center; }
.mzb .reset { width: auto; height: 26px; border-radius: 999px; padding: 0 10px; font-size: 11.5px; }
.mzb-tip { position: fixed; z-index: 50; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,.95); color: #24262b; font: 11px 'BIZ UDPGothic', sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.mzc-back { position: fixed; inset: 0; z-index: 60; background: rgba(20,22,30,.45); display: grid; place-items: center; font-family: 'BIZ UDPGothic', sans-serif; }
.mzc { width: 720px; background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.3); padding: 18px 22px 16px; display: grid; gap: 12px; color: #24262b; }
.mzc h2 { margin: 0; font-size: 17px; }
.mzc p { margin: 0; font-size: 13px; color: #6b6f78; }
.mzc .mzc-stage { position: relative; height: 400px; background: #1f2128; border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
.mzc .mzc-stage img { height: 400px !important; width: auto !important; max-width: none !important; display: block; opacity: .5; }
.mzc .frame { position: absolute; border: 2px solid #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,.45); background-repeat: no-repeat; }
.mzc .frame i { position: absolute; width: 14px; height: 14px; background: #fff; border-radius: 3px; }
.mzc .row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.mzc input[type=range] { flex: 1; }
.mzc .btns { display: flex; justify-content: flex-end; gap: 8px; }
.mzc .btns button { font: inherit; font-size: 14px; border: 1px solid #dedbd5; background: #fff; border-radius: 8px; padding: 7px 16px; }
.mzc .btns .primary { background: #2f3e75; border-color: #2f3e75; color: #fff; font-weight: 700; }
`

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
  await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 2 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupSinbad, sinbadSample())
  await sleep(800)
  await ready()
  await page.addStyleTag({ content: CSS })

  const clear = () => page.evaluate(() => document.querySelectorAll('.mz, .mzb, .mzb-tip, .mzc-back').forEach((e) => e.remove()))
  /** 選んだもの（写真・図）の img に、拡大した見た目を付ける */
  const zoomLook = (selector) => page.evaluate((selector) => {
    const img = document.querySelector(`.page-viewport.front ${selector}`)
    if (!img) return null
    img.style.transform = 'scale(1.6)'
    img.style.transformOrigin = '50% 40%'
    img.parentElement.style.overflow = 'hidden'
    const r = img.parentElement.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }, selector)

  // ---- 作品写真 ----
  const photosPage = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.indexOf('photos'))
  await page.evaluate((p) => window.__editor.goToPage(p, 'none'), photosPage)
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'photos', page: 0, index: 0 }))
  await sleep(600)
  const photoBox = await zoomLook('[data-photo-slot="0"] img')
  // 案A
  await page.evaluate(() => {
    const ctx = document.querySelector('.palette .group.ctx')
    const d = document.createElement('div')
    d.className = 'mz'
    d.innerHTML = '<span class="l">拡大 <b>160%</b></span><span class="r"><button>－</button><button>＋</button></span><small>写真をつかんで<br>ずらす</small>'
    ctx.append(d)
  })
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案A_作品写真.png` })
  await clear()
  // 案B
  await page.evaluate((b) => {
    const bar = document.createElement('div')
    bar.className = 'mzb'
    bar.innerHTML = '<button>－</button><b>160%</b><button>＋</button><button class="reset">元の大きさ</button>'
    document.body.append(bar)
    const r = bar.getBoundingClientRect()
    bar.style.left = `${b.x + b.w / 2 - r.width / 2}px`
    bar.style.top = `${b.y + b.h - r.height - 12}px`
    const tip = document.createElement('div')
    tip.className = 'mzb-tip'
    tip.textContent = 'つかんでずらすと、写る所が動きます'
    document.body.append(tip)
    const t = tip.getBoundingClientRect()
    tip.style.left = `${b.x + b.w / 2 - t.width / 2}px`
    tip.style.top = `${b.y + 12}px`
  }, photoBox)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案B_作品写真.png` })
  await clear()
  // 案C
  await page.evaluate(() => {
    const ctx = document.querySelector('.palette .group.ctx')
    const d = document.createElement('div')
    d.className = 'mz'
    d.innerHTML = '<button style="width:auto;height:auto;padding:4px 6px;font-size:10.5px;line-height:1.3">写る範囲を<br>決める</button>'
    ctx.append(d)
    const src = document.querySelector('.page-viewport.front [data-photo-slot="0"] img').src
    const back = document.createElement('div')
    back.className = 'mzc-back'
    back.innerHTML = `<div class="mzc"><h2>写る範囲を決める（1枚目の写真）</h2><p>白い枠の中が、紙面に入ります。枠をつかんで動かし、角のつまみで大きさを変えます。</p>
      <div class="mzc-stage"><img src="${src}"><div class="frame"></div></div>
      <div class="row">小さく<input type="range" value="60">大きく</div>
      <div class="btns"><button>全体に戻す</button><span style="flex:1"></span><button>やめる</button><button class="primary">これで決める</button></div></div>`
    document.body.append(back)
    const img = back.querySelector('img')
    const place = () => {
      const s = back.querySelector('.mzc-stage').getBoundingClientRect()
      const r = img.getBoundingClientRect()
      const f = back.querySelector('.frame')
      const h = r.height * 0.62
      const w = h * 0.72
      const x = r.left - s.left + r.width * 0.22
      const y = r.top - s.top + r.height * 0.16
      Object.assign(f.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, backgroundImage: `url(${src})`, backgroundSize: `${r.width}px ${r.height}px`, backgroundPosition: `${-r.width * 0.22}px ${-r.height * 0.16}px` })
      for (const [cx, cy] of [[-8, -8], [w - 6, -8], [-8, h - 6], [w - 6, h - 6]]) {
        const i = document.createElement('i')
        Object.assign(i.style, { left: `${cx}px`, top: `${cy}px` })
        f.append(i)
      }
    }
    if (img.complete) place()
    else img.onload = place
  })
  await sleep(800)
  await page.screenshot({ path: `${OUT}/案C_作品写真.png` })
  await clear()

  // ---- 本文の図（図2 ブラウス前） ----
  await page.evaluate(() => { const pages = window.__editor.pageElements(); const i = pages.findIndex((p) => p.querySelector('[data-figure-id="f2"]')); return window.__editor.goToPage(i, 'none') })
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'figure', id: 'f2' }))
  await sleep(600)
  const figBox = await zoomLook('[data-figure-id="f2"] img')
  console.log('figure box', figBox)
  await page.evaluate(() => {
    const ctx = document.querySelector('.palette .group.ctx')
    const d = document.createElement('div')
    d.className = 'mz'
    d.innerHTML = '<span class="l">拡大 <b>160%</b></span><span class="r"><button>－</button><button>＋</button></span><small>写真をつかんで<br>ずらす</small>'
    ctx?.append(d)
  })
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案A_本文の図.png` })
  await clear()
  if (figBox) {
    await page.evaluate((b) => {
      const bar = document.createElement('div')
      bar.className = 'mzb'
      bar.innerHTML = '<button>－</button><b>160%</b><button>＋</button><button class="reset">元の大きさ</button>'
      document.body.append(bar)
      const r = bar.getBoundingClientRect()
      bar.style.left = `${b.x + b.w / 2 - r.width / 2}px`
      bar.style.top = `${b.y + b.h - r.height - 8}px`
    }, figBox)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案B_本文の図.png` })
  }
  await context.close()
})
console.log('done')
