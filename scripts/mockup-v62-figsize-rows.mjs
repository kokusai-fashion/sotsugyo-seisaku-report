// mockups/v62：案B（改ページの前の図だけ、自動で大きく。mockups/v61）で、図が横並びの2枚・横長のときにどうなるか（依頼者の質問 2026-10-26）。
// 本物のツール（開発サーバー）で、図の形を変えた3つのページを作り、いまの紙面と、図を大きくした紙面を撮る。
// 大きくした図は、撮る前に紙面の図の大きさを書き換えた絵（見た目の案。組み方は作っていない）。
// 大きくする決まり（案）：まとまりの図を同じ倍率で、空いた分だけ（1行分は残す）。横は本文の幅（15cm）まで、縦は12cmまで。小さくはしない
// 使い方：node scripts/mockup-v62-figsize-rows.mjs（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v62/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
const LINE_MM = 6.4
const TEXT_W = 150
const GAP_MM = 8
const MAX_H = 120

// 図の形ごとのページ（[図の ID, 画像, タイトル]）
const CASES = [
  { key: 'pair-tall', figures: [['f1', 'g-design', 'デザイン画'], ['f2', 'g-photo1', '完成した衣装']] },
  { key: 'one-wide', figures: [['f1', 'g-mood', 'イメージボード']] },
  { key: 'pair-wide', figures: [['f1', 'g-mood', 'イメージボード'], ['f2', 'g-process', '制作の様子']] },
]

// 依頼者の画面と同じ形の本文（架空の学生の見本の原稿の文）。図の参照は、図の数だけ
function body(figures) {
  const t = (text) => ({ type: 'text', text })
  const ref = (targetId) => ({ type: 'ref', targetId, withParens: true })
  const p = (id, ...content) => ({ type: 'paragraph', id, content: content.map((c) => (typeof c === 'string' ? t(c) : c)) })
  const sub = (id, title) => ({ type: 'subheading', id, title })
  const refs = figures.length > 1 ? ['。完成した姿は', ref('f2'), 'のとおりである'] : []
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
          ...refs,
          '。キーワードは自由、勇気、海である。袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。配色は海の青と砂の金を軸とし、ズボンには生成りを合わせて全体を軽く見せた。シルエットは、上半身に大きな量感を持たせ、足元に向かって細くなる形とした。',
        ),
        { type: 'figureRow', id: 'r1', figures: figures.map(([id, imageId, caption]) => ({ id, imageId, caption })) },
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
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done')
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
  await page.mouse.move(5, 5)
  // 紙面の写真に、右下の帯（元に戻す・1ページ・見開き・拡大）が重ならないように
  await page.addStyleTag({ content: '.view-bar { visibility: hidden !important; }' })

  // 紙面の寸法（mm）：図たちの大きさ（style の mm）・図のまとまりの上下・本文の下の端（272mm）までの空き
  const measure = () =>
    page.evaluate((CUR) => {
      const pageEl = document.querySelector(CUR)
      const pr = pageEl.getBoundingClientRect()
      const mm = pr.height / 297
      const figs = [...pageEl.querySelectorAll('figure[data-figure-id]')]
      const imgs = figs.map((f) => f.querySelector('img'))
      const top = Math.min(...imgs.map((i) => i.getBoundingClientRect().top))
      const bottom = Math.max(...figs.map((f) => f.getBoundingClientRect().bottom))
      return {
        sizes: imgs.map((i) => [parseFloat(i.style.width), parseFloat(i.style.height)]),
        blockH: (bottom - top) / mm,
        gap: 272 - (bottom - pr.top) / mm,
      }
    }, CUR)
  const pageClip = () =>
    page.evaluate((CUR) => {
      const r = document.querySelector(CUR).getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height }
    }, CUR)

  const results = {}
  for (const c of CASES) {
    await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), body(c.figures))
    await sleep(800)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await sleep(600)
    await ready()
    const m0 = await measure()
    await page.screenshot({ path: `${OUT}/${c.key}-now.png`, clip: await pageClip(), captureBeyondViewport: false })
    // 同じ倍率で大きくする：空いた分（1行分は残す）・横は本文の幅まで・縦は12cmまで。小さくはしない
    const sumW = m0.sizes.reduce((a, [w]) => a + w, 0) + GAP_MM * (m0.sizes.length - 1)
    const maxH = Math.max(...m0.sizes.map(([, h]) => h))
    const scale = Math.max(1, Math.min((m0.blockH + m0.gap - LINE_MM) / m0.blockH, (TEXT_W - GAP_MM * (m0.sizes.length - 1)) / (sumW - GAP_MM * (m0.sizes.length - 1)), MAX_H / maxH))
    await page.evaluate((CUR, scale) => {
      for (const img of document.querySelectorAll(`${CUR} figure[data-figure-id] img`)) {
        img.style.width = `${parseFloat(img.style.width) * scale}mm`
        img.style.height = `${parseFloat(img.style.height) * scale}mm`
      }
    }, CUR, scale)
    await sleep(300)
    const m1 = await measure()
    await page.screenshot({ path: `${OUT}/${c.key}-B.png`, clip: await pageClip(), captureBeyondViewport: false })
    results[c.key] = { scale: Math.round(scale * 100) / 100, before: m0.sizes, after: m1.sizes.map(([w, h]) => [Math.round(w), Math.round(h)]), gapBefore: Math.round(m0.gap), gapAfter: Math.round(m1.gap) }
    // 次のページを作る前に、書き換えた図を元に戻す（組み直しで戻るが、念のため）
    await page.evaluate(() => window.__editor.goToPage(0, 'none'))
    await sleep(300)
  }
  console.log(JSON.stringify(results, null, 1))
  await context.close()

  // 見本の1枚の絵
  const sheet = await browser.newPage()
  await sheet.setViewport({ width: 1536, height: 900, deviceScaleFactor: 1 })
  await sheet.goto(`file:///${resolve('mockups/v62/index.html').replace(/\\/g, '/')}`, { waitUntil: 'load' })
  await sleep(400)
  await sheet.screenshot({ path: 'mockups/v62/v62.png', fullPage: true })
  console.log('ok')
})
