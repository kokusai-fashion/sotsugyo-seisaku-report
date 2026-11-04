// mockups/v100（2026-11-04）：パソコンの左の道具「この段落」の「中見出しにする」に、小見出しも（依頼者：大・中・小で作り方をそろえたい）
//   今：短く「。」のない段落を書いているとき「中見出しにする」だけ
//   案A：「中見出しにする」「小見出しにする」の2つを並べる
//   案B：「見出しにする」1つ。押すと横に「中見出し」「小見出し」が出て、選ぶ
// 本物のツール（見本「シンドバッド」）で、Word から読み込んだような短い段落「パターンの工夫」を書いているところを撮り、道具だけ差し替える
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v100-make-heading.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v100'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

await withEdge(async (browser) => {
  // 前に撮ったときの保存（コースを選んだあと）が残らないよう、まっさらな窓で開く
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
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
  // 中見出し「ブラウス」（s4）のすぐ下に、短い段落「パターンの工夫」（Word から読み込んで、見出しにならなかった行のつもり）
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => ({ ...c, blocks: c.blocks.flatMap((b) => (b.id === 's4' ? [b, { type: 'paragraph', id: 'pm', content: [{ type: 'text', text: 'パターンの工夫' }] }] : [b])) })),
    })),
  )
  await sleep(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('pm'), 'none'))
  await sleep(800)
  await ready()
  // 段落の終わりを押して書く
  const end = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="pm"]')].find((e) => e.getBoundingClientRect().width > 0)
    const r = el.getBoundingClientRect()
    return { x: r.left + 120, y: r.top + r.height / 2 }
  })
  await page.mouse.click(end.x, end.y)
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'pm', { timeout: 20000 })
  await sleep(600)
  await page.keyboard.press('End')
  await sleep(400)

  // 撮る範囲：左の道具と、紙面の段落のまわり
  const clip = await page.evaluate(() => {
    const pal = document.querySelector('.palette').getBoundingClientRect()
    const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="pm"]')].find((e) => e.getBoundingClientRect().width > 0).getBoundingClientRect()
    const top = Math.max(0, Math.min(pal.top, el.top - 260))
    return { x: 0, y: top, width: Math.min(innerWidth, el.right + 40), height: Math.min(innerHeight - top, Math.max(pal.bottom, el.bottom + 260) - top) }
  })
  const shot = async (name) => {
    await sleep(200)
    await page.screenshot({ path: `${OUT}/${name}.png`, clip })
  }
  await shot('今_中見出しにするだけ')

  // 左の道具を、同じ位置に写した動かない写しに替えてから書き換える（ツールの画面は書き直されるので、じかに足したボタンが消えた）
  const freeze = () => {
    const pal = document.querySelector('.palette')
    const r = pal.getBoundingClientRect()
    const copy = pal.cloneNode(true)
    copy.dataset.mock = 'copy'
    Object.assign(copy.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: 'auto', maxHeight: 'none', margin: '0', zIndex: '40' })
    pal.parentElement.insertBefore(copy, pal.nextSibling)
    pal.style.visibility = 'hidden'
    const group = [...copy.querySelectorAll('.group.ctx')].find((g) => g.querySelector('.ctx-label')?.textContent === 'この段落')
    const sub = [...group.querySelectorAll('.tb')].find((b) => b.textContent.includes('にする'))
    const minorIcon = [...copy.querySelectorAll('.tb')].find((b) => b.textContent.trim().endsWith('小見出し'))?.querySelector('svg')
    const midIcon = [...copy.querySelectorAll('.tb')].find((b) => b.textContent.trim().endsWith('中見出し'))?.querySelector('svg')
    return { sub, minorIcon, midIcon }
  }
  const unfreeze = () => page.evaluate(() => {
    document.querySelectorAll('[data-mock]').forEach((e) => e.remove())
    document.querySelector('.palette').style.visibility = ''
  })

  await page.evaluate((freezeSrc) => {
    const { sub, minorIcon } = new Function(`return (${freezeSrc})()`)()
    const b = sub.cloneNode(true)
    b.querySelector('svg').replaceWith(minorIcon.cloneNode(true))
    b.querySelectorAll('.tb-line')[0].textContent = '小見出し'
    sub.after(b)
  }, freeze.toString())
  await shot('案A_中見出しにする・小見出しにする')
  await unfreeze()

  await page.evaluate((freezeSrc) => {
    const { sub, minorIcon, midIcon } = new Function(`return (${freezeSrc})()`)()
    sub.querySelectorAll('.tb-line')[0].textContent = '見出し'
    sub.style.background = '#e7ecf7'
    sub.style.boxShadow = 'inset 0 0 0 1.5px #2b3a67'
    sub.style.borderRadius = '8px'
    // 押すと右に出る小さな欄（中見出し・小見出し）
    const r = sub.getBoundingClientRect()
    const pop = document.createElement('div')
    pop.dataset.mock = 'b'
    pop.style.cssText = `position:fixed;left:${r.right + 8}px;top:${r.top - 4}px;z-index:50;display:flex;flex-direction:column;gap:4px;padding:6px;background:#fff;border:1px solid #c9cfdb;border-radius:8px;box-shadow:0 4px 14px rgba(20,30,60,.18)`
    for (const [label, icon] of [['中見出し', midIcon], ['小見出し', minorIcon]]) {
      const b = document.createElement('button')
      b.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;font:inherit;font-size:12px;color:#1c2333;background:#f4f6fa;border:1px solid #dce1ea;border-radius:6px;white-space:nowrap'
      const svg = icon.cloneNode(true)
      svg.setAttribute('width', '18')
      svg.setAttribute('height', '18')
      b.append(svg, document.createTextNode(label + 'にする'))
      pop.append(b)
    }
    document.body.append(pop)
  }, freeze.toString())
  await shot('案B_見出しにする・押すと中か小を選ぶ')
  await unfreeze()
  console.log('ok')
})
