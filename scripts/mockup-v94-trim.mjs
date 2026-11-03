// mockups/v94：作品写真と本文の図のトリミング（写る範囲を決める。依頼者 2026-11-03：「拡大」はトリミングのこと）。
// 本物のツール（自動テスト用にまとめた版）に見本「シンドバッド」を入れ、図・写真を選んで、案の部品を差し込んで撮る（見た目の案。動きは作っていない）。
//   案1：紙面の上で切る（選んだ図の上に枠とつまみ。辺・角をつまんで切り、中をつかんで動かす。下に「決める」「やめる」）
//   案2：トリミングの窓（大きな写真の上で枠を動かす。本文の図は形を選べる：元の形・縦長・正方形・横長。作品写真は枠の形が決まっている）
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v94-trim.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v94'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CSS = `
.tr-dim { position: fixed; z-index: 40; pointer-events: none; }
.tr-frame { position: fixed; z-index: 41; border: 2px solid #fff; outline: 1px solid rgba(0,0,0,.35); box-shadow: 0 0 0 9999px rgba(20,22,30,.5); }
.tr-frame i { position: absolute; width: 12px; height: 12px; background: #fff; border: 1px solid #2f3e75; border-radius: 2px; }
.tr-frame b { position: absolute; background: #fff; border: 1px solid #2f3e75; border-radius: 2px; }
.tr-bar { position: fixed; z-index: 42; display: flex; gap: 6px; align-items: center; padding: 5px 6px; border-radius: 10px; background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.22); font: 13px 'BIZ UDPGothic', sans-serif; }
.tr-bar button { font: inherit; border: 1px solid #d9d6cf; background: #fff; border-radius: 7px; padding: 5px 12px; }
.tr-bar .primary { background: #2f3e75; border-color: #2f3e75; color: #fff; font-weight: 700; }
.tr-tip { position: fixed; z-index: 42; padding: 3px 8px; border-radius: 6px; background: rgba(36,38,43,.86); color: #fff; font: 12px 'BIZ UDPGothic', sans-serif; }
.mz { margin: 4px 2px 2px; padding: 5px 0 3px; border-top: 1px solid rgba(47,62,117,.18); display: grid; justify-items: center; }
.mz button { font: 10.5px/1.3 'BIZ UDPGothic', sans-serif; border: 1px solid #c9cde0; border-radius: 6px; background: #fff; color: #2f3e75; padding: 4px 6px; }
.mz button.on { background: #2f3e75; color: #fff; border-color: #2f3e75; }
.mzc-back { position: fixed; inset: 0; z-index: 60; background: rgba(20,22,30,.45); display: grid; place-items: center; font-family: 'BIZ UDPGothic', sans-serif; }
.mzc { width: 760px; background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.3); padding: 18px 22px 16px; display: grid; gap: 12px; color: #24262b; }
.mzc h2 { margin: 0; font-size: 17px; }
.mzc p { margin: 0; font-size: 13px; color: #6b6f78; }
.mzc .mzc-stage { position: relative; height: 380px; background: #1f2128; border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
.mzc .mzc-stage img { height: 380px !important; width: auto !important; max-width: none !important; display: block; opacity: .45; }
.mzc .frame { position: absolute; border: 2px solid #fff; background-repeat: no-repeat; }
.mzc .frame i { position: absolute; width: 14px; height: 14px; background: #fff; border-radius: 3px; }
.mzc .shapes { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.mzc .shapes button { font: inherit; border: 1px solid #d9d6cf; background: #fff; border-radius: 999px; padding: 5px 12px; }
.mzc .shapes button.on { background: #e6e9f4; border-color: #2f3e75; color: #2f3e75; font-weight: 700; }
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

  // 本文の図（図4 袖の刺繍：横長）を選ぶ
  await page.evaluate(() => { const i = window.__editor.pageElements().findIndex((p) => p.querySelector('[data-figure-id="f4"]')); return window.__editor.goToPage(i, 'none') })
  await sleep(700)
  await ready()
  await page.evaluate(() => window.__editor.select({ kind: 'figure', id: 'f4' }))
  await sleep(600)
  const box = await page.evaluate(() => { const r = document.querySelector('.page-viewport.front [data-figure-id="f4"] img').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })

  // ---- 案1：紙面の上で切る ----
  await page.evaluate((b) => {
    const ctx = document.querySelector('.palette .group.ctx')
    const d = document.createElement('div')
    d.className = 'mz'
    d.innerHTML = '<button class="on">トリミング</button>'
    ctx?.append(d)
    // 枠：横長の写真の、左の 30% と右の 15% を切った所（縦長に近い形）
    const f = { x: b.x + b.w * 0.3, y: b.y + 4, w: b.w * 0.55, h: b.h - 8 }
    const frame = document.createElement('div')
    frame.className = 'tr-frame'
    Object.assign(frame.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` })
    for (const [cx, cy] of [[-7, -7], [f.w - 5, -7], [-7, f.h - 5], [f.w - 5, f.h - 5]]) {
      const i = document.createElement('i')
      Object.assign(i.style, { left: `${cx}px`, top: `${cy}px` })
      frame.append(i)
    }
    for (const [cx, cy, w, h] of [[f.w / 2 - 10, -4, 20, 6], [f.w / 2 - 10, f.h - 2, 20, 6], [-4, f.h / 2 - 10, 6, 20], [f.w - 2, f.h / 2 - 10, 6, 20]]) {
      const e = document.createElement('b')
      Object.assign(e.style, { left: `${cx}px`, top: `${cy}px`, width: `${w}px`, height: `${h}px` })
      frame.append(e)
    }
    document.body.append(frame)
    const tip = document.createElement('div')
    tip.className = 'tr-tip'
    tip.textContent = '辺・角をつまんで切る／中をつかんで動かす'
    document.body.append(tip)
    tip.style.left = `${f.x + f.w / 2 - tip.getBoundingClientRect().width / 2}px`
    tip.style.top = `${f.y - 30}px`
    const bar = document.createElement('div')
    bar.className = 'tr-bar'
    bar.innerHTML = '<button>元の形に戻す</button><button>やめる</button><button class="primary">決める</button>'
    document.body.append(bar)
    bar.style.left = `${b.x + b.w / 2 - bar.getBoundingClientRect().width / 2}px`
    bar.style.top = `${b.y + b.h + 30}px`
  }, box)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/案1_紙面の上で切る（本文の図）.png` })
  await page.evaluate(() => document.querySelectorAll('.tr-frame, .tr-tip, .tr-bar').forEach((e) => e.remove()))

  // ---- 案2：トリミングの窓（本文の図。形を選べる） ----
  await page.evaluate(() => {
    const btn = document.querySelector('.mz button')
    if (btn) btn.textContent = 'トリミング'
    const src = document.querySelector('.page-viewport.front [data-figure-id="f4"] img').src
    const back = document.createElement('div')
    back.className = 'mzc-back'
    back.innerHTML = `<div class="mzc"><h2>トリミング（図4）</h2><p>白い枠の中が、紙面に入ります。枠をつかんで動かし、角のつまみで大きさを変えます。</p>
      <div class="shapes">形：<button>元の形</button><button class="on">縦長</button><button>正方形</button><button>横長</button><button>自由</button></div>
      <div class="mzc-stage"><img src="${src}"><div class="frame"></div></div>
      <div class="btns"><button>元の形に戻す</button><span style="flex:1"></span><button>やめる</button><button class="primary">これで決める</button></div></div>`
    document.body.append(back)
    const img = back.querySelector('img')
    const place = () => {
      const s = back.querySelector('.mzc-stage').getBoundingClientRect()
      const r = img.getBoundingClientRect()
      const f = back.querySelector('.frame')
      const h = r.height * 0.92
      const w = h * 0.75
      const x = r.left - s.left + r.width * 0.36
      const y = r.top - s.top + r.height * 0.04
      Object.assign(f.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, backgroundImage: `url(${src})`, backgroundSize: `${r.width}px ${r.height}px`, backgroundPosition: `${-r.width * 0.36}px ${-r.height * 0.04}px` })
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
  await page.screenshot({ path: `${OUT}/案2_トリミングの窓（本文の図）.png` })
  await context.close()
})
console.log('done')
