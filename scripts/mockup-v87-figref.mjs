// mockups/v87：本文に手で打った「（図8）」（まだ図がなく赤い）から、その図を入れられるようにする案（依頼者の案 2026-11-02：
// 学生役の録画で、学生が「（図〇）」を手で打っていた。ひな形の薄い字も「文中に「（図1）」と書く」）。
// 本物のツール（自動テスト用にまとめた版）に見本「シンドバッド」を入れ、ターバンの図を外して「（図8）」を打った字にし、ボタンを差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：PORT=4241 node scripts/e2e/serveBuilt.mjs で出してから、APP_URL=http://localhost:4241 node scripts/mockup-v87-figref.mjs（Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4241'
const OUT = 'mockups/v87/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  // 靴の図（r7・図8。いちばん後ろなので、ほかの図の番号は変わらない）を外し、本文の「（図8）」を、手で打った字にする（まだ図がない状態）
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => ({
        ...c,
        blocks: c.blocks
          .filter((b) => b.id !== 'r7')
          .map((b) => {
            if (b.id !== 'p10') return b
            const text = b.content.map((x) => (x.type === 'ref' && x.targetId === 'f8' ? '（図8）' : (x.text ?? ''))).join('')
            return { ...b, content: [{ type: 'text', text }] }
          }),
      })),
    })),
  )
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p10'), 'none'))
  await sleep(600)
  await ready()

  /** 見ているページの p10 の中の「（図8）」の位置 */
  const refRect = () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="p10"]')].find((e) => e.getBoundingClientRect().width > 0)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes = []
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n)
      const all = nodes.map((n) => n.textContent).join('')
      const i = all.indexOf('（図8）')
      const rectAt = (k) => { let at = k; for (const n of nodes) { if (at < n.textContent.length) { const r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + 1); return r.getBoundingClientRect() } at -= n.textContent.length } return null }
      const a = rectAt(i)
      const b = rectAt(i + 4)
      const p = el.getBoundingClientRect()
      return { x: a.left, y: a.top, right: b.right, bottom: b.bottom, h: a.height, para: { x: p.left, y: p.top, w: p.width, h: p.height } }
    })
  let ref = await refRect()
  const paperClip = (r) => ({ x: Math.max(0, r.para.x - 18), y: Math.max(0, r.para.y - 60), width: r.para.w + 36, height: r.para.h + 76 })
  await page.mouse.move(1400, 790)
  await page.screenshot({ path: join(OUT, '0-now-paper.png'), clip: paperClip(ref), captureBeyondViewport: false })
  // 右の欄の「「（図8）」の図がない」
  const issueClip = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.issue')].find((e) => e.textContent.includes('（図8）'))
    li.scrollIntoView({ block: 'center' })
    const r = li.getBoundingClientRect()
    return { x: r.left - 10, y: r.top + 6, width: r.width + 20, height: r.height + 2 }
  })
  await sleep(300)
  await page.screenshot({ path: join(OUT, '0-now-issue.png'), clip: issueClip, captureBeyondViewport: false })

  // ---- 案A：赤い「（図8）」の所に文字カーソルがあるとき、すぐ上に「図を入れる」（「貼り付け」と同じ出方） ----
  await page.mouse.click(ref.x + (ref.right - ref.x) * 0.5, ref.y + ref.h / 2)
  await sleep(900)
  ref = await refRect()
  await page.evaluate((ref) => {
    const icon = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('図を入れる') && b.querySelector('svg'))?.querySelector('svg')?.outerHTML ?? ''
    const chip = document.createElement('button')
    chip.className = 'range-chip mock-figref'
    chip.innerHTML = `${icon}<span>図8を入れる</span>`
    chip.style.position = 'fixed'
    chip.style.top = `${ref.y - 44}px`
    chip.style.zIndex = '50'
    document.body.appendChild(chip)
    // 紙面の右の端からはみ出さないよう、左へ寄せる
    chip.style.left = `${Math.min(ref.x - 6, ref.para.x + ref.para.w + 20 - chip.offsetWidth)}px`
  }, ref)
  await page.mouse.move(1400, 790)
  await sleep(300)
  await page.screenshot({ path: join(OUT, 'A-chip.png'), clip: paperClip(ref), captureBeyondViewport: false })
  await page.evaluate(() => document.querySelector('.mock-figref')?.remove())
  await page.keyboard.press('Escape')
  await sleep(600)
  await ready()

  // ---- 案C：右の欄の指摘に「図を入れる」 ----
  const issueClip2 = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.issue')].find((e) => e.textContent.includes('（図8）'))
    const icon = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('図を入れる') && b.querySelector('svg'))?.querySelector('svg')?.outerHTML ?? ''
    const b = document.createElement('button')
    b.className = 'keep mock-figref'
    b.innerHTML = `${icon}<span>図8を入れる</span>`
    b.style.cssText = 'display:inline-flex;align-items:center;gap:5px;color:var(--accent);font-weight:700'
    b.querySelector('svg')?.setAttribute('style', 'width:16px;height:16px')
    li.appendChild(b)
    li.scrollIntoView({ block: 'center' })
    const r = li.getBoundingClientRect()
    return { x: r.left - 10, y: r.top + 6, width: r.width + 20, height: r.height + 2 }
  })
  await sleep(300)
  await page.screenshot({ path: join(OUT, 'C-issue.png'), clip: issueClip2, captureBeyondViewport: false })
  await context.close()

  // 並べた絵
  const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 6px;color:#2b2b2b}
.lead{font-size:15px;color:#555;margin:0 0 16px}
.row{display:grid;grid-template-columns:1.35fr 1fr;gap:18px;margin-bottom:18px;align-items:start}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555;line-height:1.6}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>本文に手で打った「（図〇）」から、図を入れる案</h1>
<p class="lead">例：靴の段落に「（図8）」を打ったが、まだ図を入れていない。押したあとは、どの案も、今の「図を入れる」と同じ（写真を選ぶ → その段落の下に図8が入り、打った「（図8）」につながって赤が消える）。</p>
<div class="row"><div class="card"><h2>今（紙面）</h2><p>打った「（図8）」は赤くなる。図を入れるには、段落をクリックしてから、左の道具の「図を入れる」を押す</p><img src="${img('0-now-paper')}"></div>
<div class="card"><h2>今（右の欄）</h2><p>「（図8）の図がない」のエラー。押すとその場所へ移る</p><img src="${img('0-now-issue')}"></div></div>
<div class="row"><div class="card"><h2>案A　赤い「（図8）」の所に「図8を入れる」</h2><p>赤い「（図8）」をクリックして、文字カーソルがその中（すぐ前後）にあるときだけ、すぐ上に出す（文を選んだときの「コピー」、書く欄の「貼り付け」と同じ出方）。字を打ち始めると消える。スマホは、タップしたときに同じ所に出す</p><img src="${img('A-chip')}"></div>
<div class="card"><h2>案C　右の欄のエラーに「図8を入れる」</h2><p>チェックの欄から直す人向け。押すと、その段落の下に図8を入れる（紙面には何も出さない）</p><img src="${img('C-issue')}"></div></div>
<div class="row"><div class="card"><h2>案B（おすすめ）　案Aと案Cの両方</h2><p>紙面で書いている人も、チェックの欄から直す人も、同じ「図8を入れる」で入れられる。どちらも、赤い「（図〇）」があるときだけ出るので、ふだんの画面は変わらない</p></div></div>`
  const sheet = await browser.newPage()
  await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
  await sheet.setContent(html, { waitUntil: 'load' })
  const h = await sheet.evaluate(() => document.body.scrollHeight)
  await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
  await sheet.screenshot({ path: 'mockups/v87/v87-案.png', fullPage: true })
})
console.log('done')
