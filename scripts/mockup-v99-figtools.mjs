// mockups/v99：スマホで並んだ図を押したときの道具（「トリミング」が増えて7つ：差し替え・トリミング・もう1枚・上へ・下へ・並びから外す・削除）。
// 360px・390px の画面で、帯が画面の幅に入らず、左右の端（「差し替え」「削除」）が切れる。
//   今：1列のまま（はみ出す）
//   案A：入りきらないときだけ2段にする
//   案B：帯の中を左右にすべらせて見る（端に「›」）
//   案C：「差し替え」「トリミング」を「写真」1つにまとめる（押すと上に 差し替え・トリミング）
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v99-figtools.mjs（Edge は 9335。自動テストを流している間は動かさない）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v99'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await withEdge(async (browser) => {
  for (const width of [360, 390]) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(() => {
      try {
        for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
      } catch {}
    })
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
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
    await page.evaluate(setupWriting)
    await sleep(600)
    await ready()
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'r1' ? { ...b, figures: [...b.figures, { id: 'f1b', imageId: 'g-mood', caption: '後ろ' }] } : b)) })) })))
    await sleep(400)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.select({ kind: 'figure', id: 'f1b' }))
    await sleep(500)
    const measure = () => page.evaluate(() => { const g = document.querySelector('.sel-bar .group.ctx').getBoundingClientRect(); return { left: Math.round(g.left), right: Math.round(g.right), w: innerWidth } })
    console.log(width, '今', JSON.stringify(await measure()))
    await page.screenshot({ path: `${OUT}/${width}_今.png` })

    // 案A：2段
    const a = await page.addStyleTag({ content: `.app.phone .sel-bar .group.ctx { flex-wrap: wrap; justify-content: center; max-width: 100%; row-gap: 2px; }` })
    await sleep(300)
    console.log(width, '案A', JSON.stringify(await measure()))
    await page.screenshot({ path: `${OUT}/${width}_案A_2段.png` })
    await a.evaluate((e) => e.remove())

    // 案B：左右にすべらせる
    const b = await page.addStyleTag({
      content: `.app.phone .sel-bar { justify-content: flex-start; }
        .app.phone .sel-bar .group.ctx { max-width: 100%; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(to right, #000 85%, transparent); mask-image: linear-gradient(to right, #000 85%, transparent); }
        .app.phone .sel-bar .group.ctx > * { flex: none; }
        .mk-more { position: fixed; z-index: 12; right: 12px; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #2f3e75; color: #fff; font: 700 14px sans-serif; }`,
    })
    await page.evaluate(() => {
      const g = document.querySelector('.sel-bar .group.ctx').getBoundingClientRect()
      const m = document.createElement('div')
      m.className = 'mk-more'
      m.textContent = '›'
      m.style.top = `${g.top + g.height / 2 - 11}px`
      document.body.append(m)
    })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/${width}_案B_すべらせる.png` })
    await b.evaluate((e) => e.remove())
    await page.evaluate(() => document.querySelector('.mk-more')?.remove())

    // 案C：「写真」1つにまとめる（押したところ）
    await page.evaluate(() => {
      const tbs = [...document.querySelectorAll('.sel-bar .tb')]
      const replace = tbs.find((t) => t.textContent.includes('差し替え'))
      const trim = tbs.find((t) => t.textContent.includes('トリミング'))
      const icon = replace.querySelector('svg').outerHTML
      replace.dataset.mk = '1'
      replace.querySelector('span').textContent = '写真'
      replace.style.background = '#e6e9f4'
      replace.style.color = '#2f3e75'
      trim.style.display = 'none'
      const sub = document.createElement('div')
      sub.className = 'mk-sub'
      sub.innerHTML = `<button>${icon}差し替え</button><button>${trim.querySelector('svg').outerHTML}トリミング</button>`
      document.body.append(sub)
      const r = replace.getBoundingClientRect()
      sub.style.cssText = `position: fixed; z-index: 13; left: ${Math.max(8, r.left - 10)}px; top: ${r.top - 58}px; display: flex; gap: 6px; padding: 5px; background: #fff; border: 1px solid #d9d6cf; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.14);`
      sub.querySelectorAll('button').forEach((x) => { x.style.cssText = 'display: flex; align-items: center; gap: 4px; min-height: 40px; padding: 0 10px; border: 0; border-radius: 10px; background: none; font: 12px "BIZ UDPGothic", sans-serif; color: #24262b;' })
      sub.querySelectorAll('svg').forEach((x) => { x.style.cssText = 'width: 18px; height: 18px;' })
    })
    await sleep(300)
    console.log(width, '案C', JSON.stringify(await measure()))
    await page.screenshot({ path: `${OUT}/${width}_案C_写真にまとめる.png` })
    await context.close()
  }
})
console.log('done')
