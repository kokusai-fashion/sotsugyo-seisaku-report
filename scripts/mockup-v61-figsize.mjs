// mockups/v61：改ページの前の図の下に空きが残るとき、図の大きさをどうするかの案（依頼者の相談 2026-10-26：昨年度までは図を大きくして、ページの見え方のバランスをとっていた）。
// 本物のツール（開発サーバー）で、依頼者の画面と同じ形のページ（小見出し・段落・デザイン画・改ページ）を作り、紙面を撮る。
// 案B・C の「大きくした図」は、撮る前に紙面の図の大きさを書き換えた絵（見た目の案。組み方は作っていない）。
// 使い方：node scripts/mockup-v61-figsize.mjs [measure]（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v61/shots'
const MEASURE = process.argv[2] === 'measure'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'

// 案C の道具（図を選んだときの左の道具に「大きさ」の切り替え）
const CSS = `
  .mock-size { display: flex; flex-direction: column; gap: 4px; margin: 6px 4px 2px; }
  .mock-size .lbl { font-size: 12px; color: #666; text-align: center; }
  .mock-size .seg { display: flex; flex-direction: column; border: 1px solid #c9cfe3; border-radius: 9px; overflow: hidden; }
  .mock-size .seg button { flex: 1; border: 0; padding: 6px 0; background: #fff; font-size: 12.5px; color: #333; }
  .mock-size .seg button.on { background: #27367a; color: #fff; font-weight: 700; }
`

// 依頼者の画面と同じ形の本文（架空の学生の見本の原稿の文）
function body() {
  const t = (text) => ({ type: 'text', text })
  const ref = (targetId) => ({ type: 'ref', targetId, withParens: true })
  const p = (id, ...content) => ({ type: 'paragraph', id, content: content.map((c) => (typeof c === 'string' ? t(c) : c)) })
  const sub = (id, title) => ({ type: 'subheading', id, title })
  return [
    {
      id: 'c1',
      title: '企画・立案',
      blocks: [
        sub('s1', '担当衣装のキャラクター'),
        p('p1', '筆者が担当したのは、物語の主人公である船乗りシンドバッドの衣装である。シンドバッドは七つの航海を経て成長していく人物であり、場面ごとに異なる表情を見せる。本制作では、旅立ちの場面の若々しさと、帰還の場面の頼もしさの両方を、一着の衣装で表すことを目標とした。'),
        sub('s2', 'デザイン説明'),
        p(
          'p3',
          '中東の伝統的な装いをもとに、航海の力強さと冒険心を表すデザインを考えた',
          ref('f1'),
          '。キーワードは自由、勇気、海である。袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。配色は海の青と砂の金を軸とし、ズボンには生成りを合わせて全体を軽く見せた。シルエットは、上半身に大きな量感を持たせ、足元に向かって細くなる形とした。両腕を広げた姿が、客席から大きく見えるようにするためである。袖には波の模様を金の糸で刺繍し、照明の下で光るようにした。',
        ),
        { type: 'figureRow', id: 'r1', figures: [{ id: 'f1', imageId: 'g-design', caption: 'デザイン画' }] },
        { type: 'pageBreak', id: 'pb1' },
        sub('s3', '使用素材'),
        p('p5', '使用した素材は、次の表のとおりである。'),
      ],
    },
    { id: 'c2', title: '制作過程', blocks: [p('p6', 'デザイン画をもとにパターンを引き、シーチングで仮縫いをした。')] },
    { id: 'c3', title: 'まとめ', blocks: [p('p7', '本制作では、主人公の成長を一着の衣装で表すことを目指した。')] },
  ]
}

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
    } catch {}
  })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body())
  await sleep(800)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
  await sleep(600)
  await ready()
  await page.mouse.move(5, 5)
  // 紙面の写真に、右下の帯（元に戻す・1ページ・見開き・拡大）が重ならないように
  await page.addStyleTag({ content: '.view-bar { visibility: hidden !important; }' })

  // 紙面の寸法（mm）：図の上下・タイトルの下・本文の下の端（272mm）
  const measure = () =>
    page.evaluate((CUR) => {
      const pageEl = document.querySelector(CUR)
      const pr = pageEl.getBoundingClientRect()
      const mm = pr.height / 297
      const fig = pageEl.querySelector('figure[data-figure-id="f1"]')
      const img = fig.querySelector('img')
      const ir = img.getBoundingClientRect()
      const row = fig.closest('[data-block-id]') ?? fig
      const rr = row.getBoundingClientRect()
      return { imgW: ir.width / mm, imgH: ir.height / mm, rowBottom: (rr.bottom - pr.top) / mm, gap: 272 - (rr.bottom - pr.top) / mm, html: row.outerHTML.slice(0, 600) }
    }, CUR)
  const m0 = await measure()
  console.log(JSON.stringify(m0, null, 1))
  if (MEASURE) return

  const pageClip = () =>
    page.evaluate((CUR) => {
      const r = document.querySelector(CUR).getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height }
    }, CUR)

  // いま
  await page.screenshot({ path: `${OUT}/A-now.png`, clip: await pageClip() })

  // 図を大きくする（空いた分だけ。1行分の空きは残す。いちばん大きくて1.5倍・本文の幅まで）
  const LINE_MM = 6.4
  const scale = Math.min(1.5, (m0.imgH + m0.gap - LINE_MM) / m0.imgH, 150 / m0.imgW)
  // 紙面の図の大きさは mm で書いてある（style="width: 60mm; height: 80mm"）
  await page.evaluate((CUR, scale) => {
    const img = document.querySelector(`${CUR} figure[data-figure-id="f1"] img`)
    img.style.width = `${parseFloat(img.style.width) * scale}mm`
    img.style.height = `${parseFloat(img.style.height) * scale}mm`
  }, CUR, scale)
  await sleep(300)
  const m1 = await measure()
  console.log('scale', scale.toFixed(2), JSON.stringify({ imgH: m1.imgH, gap: m1.gap }))
  await page.screenshot({ path: `${OUT}/B-auto.png`, clip: await pageClip() })

  // 案C：図を選んだときの左の道具に「大きさ：標準｜大きく」（大きくした紙面で）
  await page.addStyleTag({ content: CSS })
  const box = await page.evaluate((CUR) => {
    const r = document.querySelector(`${CUR} figure[data-figure-id="f1"] img`).getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, CUR)
  await page.mouse.click(box.x, box.y)
  await page.waitForFunction(() => window.__editor.getSnapshot().selection?.id === 'f1', { timeout: 10000 })
  await page.mouse.move(5, 5)
  await sleep(600)
  // マウスを動かすと道具が描き直されて、差し込んだ部品が消えるので、動かしたあとに差し込んで、すぐ撮る
  const sizeBox = await page.evaluate(() => {
    // 図の道具のまとまりは2つある（見えているものと、幅を測るもの）。どちらにも差し込む
    for (const group of document.querySelectorAll('.palette .group.ctx')) {
      const del = [...group.querySelectorAll('.tb')].find((b) => b.textContent.includes('削除'))
      if (!del) continue
      const m = document.createElement('div')
      m.className = 'mock-size'
      m.innerHTML = '<div class="lbl">大きさ</div><div class="seg"><button>標準</button><button class="on">大きく</button></div>'
      del.before(m)
    }
    return [...document.querySelectorAll('.mock-size')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.height)] })
  })
  await sleep(100)
  console.log('size control', JSON.stringify(sizeBox), await page.evaluate(() => {
    const m = document.querySelector('.mock-size')
    const g = m.closest('.group.ctx')
    const cs = getComputedStyle(g)
    const del = m.nextElementSibling
    return JSON.stringify({ parent: m.parentElement.className, display: cs.display, grid: cs.gridTemplateRows, overflow: cs.overflow, h: g.getBoundingClientRect().height, delTop: del.getBoundingClientRect().top, delPos: getComputedStyle(del).position, mPos: getComputedStyle(m).position, mVis: getComputedStyle(m).visibility, mDisp: getComputedStyle(m).display })
  }))
  const palClip = await page.evaluate(() => {
    const r = document.querySelector('.palette .group.ctx').getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, innerHeight - r.top) }
  })
  await page.screenshot({ path: `${OUT}/C-tools.png`, clip: palClip, captureBeyondViewport: false })
  await page.screenshot({ path: `${OUT}/C-screen.png`, captureBeyondViewport: false })
  await context.close()

  // 見本の1枚の絵
  const sheet = await browser.newPage()
  await sheet.setViewport({ width: 1536, height: 900, deviceScaleFactor: 1 })
  await sheet.goto(`file:///${resolve('mockups/v61/index.html').replace(/\\/g, '/')}`, { waitUntil: 'load' })
  await sleep(400)
  await sheet.screenshot({ path: 'mockups/v61/v61.png', fullPage: true })
  console.log('ok')
})
