// mockups/v63：試し（2026-10-26）で残した3つの見た目の案。
// ① パソコンの拡大 200% で、ページ送りの「‹ ›」が本文・写真に重なる
// ② スマホの横向きでキーボードが出ると、紙面がほとんど見えない
// ③ iPhone で写真を選んだあと、キーボードが自動では出ない（タイトルの欄を押すまで書けない）
// 本物のツール（開発サーバー）を開き、案ごとの部品を差し込んで撮る（見た目の案。動きは作っていない）。
// キーボードは出せないので、②は画面の高さを低くして撮り、見本の HTML でキーボードの絵を下に置く。
// 使い方：node scripts/mockup-v63-remaining.mjs [pc|land|ios …]（開発サーバーが http://localhost:5173 で動いていること。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v63/shots'
mkdirSync(OUT, { recursive: true })
const ONLY = process.argv.slice(2)
const want = (k) => !ONLY.length || ONLY.includes(k)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IMAGE = resolve('docs/guide-images/sample/process.jpg')
/** ① は右下（書いている所・写真・「‹ ›」・右下の帯）だけを切り出す */
const CLIP = { x: 560, y: 470, width: 450, height: 298 }

const CSS = `
  /* ① 案A：拡大しているときは、「‹ ›」を右下の帯に入れる（紙面の上に浮かせない） */
  .mock-nav { display: inline-flex; align-items: center; gap: 2px; margin-left: 6px; padding-left: 8px; border-left: 1px solid var(--line, #ddd); }
  .mock-nav button { width: 34px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--accent, #27367a); font-size: 20px; font-weight: 700; }
  .mock-nav button:hover { background: #eef1fa; }
  .mock-hide-arrows .stage .arrow { display: none !important; }
  /* ① 案B：書いている間・マウスが離れている間は、「‹ ›」を小さく薄く */
  .mock-faint .stage .arrow { opacity: 0.18; scale: 0.8; }
  /* ② 横向き：上の帯を隠す・縦向きの案内 */
  .mock-no-top .p-top { display: none !important; }
  .mock-no-top .stage { grid-row: 1 / span 2 !important; }
  .mock-tip { position: fixed; left: 50%; top: 8px; translate: -50% 0; z-index: 90; padding: 6px 14px; border-radius: 99px; background: #2b2e36; color: #fff; font-size: 13px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
  /* ③ iPhone：タイトルの欄を押すよう案内する吹き出し・枠 */
  .mock-bubble { position: fixed; z-index: 90; padding: 9px 14px; border-radius: 12px; background: #27367a; color: #fff; font-size: 14px; font-weight: 700; line-height: 1.4; box-shadow: 0 6px 18px rgba(20, 30, 80, 0.3); white-space: nowrap; }
  .mock-bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; translate: -50% 0; border: 8px solid transparent; border-bottom: 0; border-top-color: #27367a; }
  .mock-ring { position: fixed; z-index: 89; border: 3px solid #d99a00; border-radius: 8px; box-shadow: 0 0 0 6px rgba(217, 154, 0, 0.22); pointer-events: none; }
  .mock-bar-note { position: fixed; left: 0; right: 0; z-index: 90; padding: 8px 12px; background: #fff7e0; color: #6b4e00; font-size: 13.5px; text-align: center; border-top: 1px solid #ecd9a0; }
`

/** 学生用ツールを開き、コースを選んで、見本の原稿にする */
async function openSample(browser, viewport, phone = false) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument((phone) => {
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
      localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done')
      localStorage.setItem('sotsugyo-seisaku-report-knob-hint', 'done')
      if (!phone) localStorage.setItem('sotsugyo-seisaku-report-zoom-level', '2')
    } catch {}
  }, phone)
  await stubConfig(page)
  if (phone) await page.setUserAgent(UA_IPHONE)
  await page.setViewport(viewport)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 90000 })
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
  await page.addStyleTag({ content: CSS })
  return { context, page, ready }
}

const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false, ...(clip ? { clip } : {}) })

await withEdge(async (browser) => {
  // ① パソコン（1366×768）・拡大 200%：書いている段落の下の写真の所
  if (want('pc')) {
    const { context, page, ready } = await openSample(browser, { width: 1366, height: 768, deviceScaleFactor: 1.5 })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p8'), 'none'))
    await ready()
    await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes('拡大')).click())
    await sleep(900)
    await ready()
    // 写真（図3）の上の端が、画面の下の方に来るまで送る（試しの写真 p4-f01-z200 と同じ所）
    await page.evaluate(() => {
      const img = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current figure[data-figure-id="f3"] img')
      const scroller = img.closest('.stage-scroll, .scroller') ?? document.scrollingElement
      img.scrollIntoView({ block: 'start' })
      const r = img.getBoundingClientRect()
      const box = document.querySelector('.stage').getBoundingClientRect()
      const st = [...document.querySelectorAll('.stage *')].find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible')
      if (st) st.scrollTop -= box.bottom - r.top - 170
    })
    await sleep(500)
    await page.mouse.move(700, 300)
    await shot(page, '1-now', CLIP)
    // 案A：「‹ ›」を右下の帯へ
    await page.evaluate(() => {
      document.body.classList.add('mock-hide-arrows')
      const bar = document.querySelector('.view-bar')
      const m = document.createElement('div')
      m.className = 'mock-nav'
      m.innerHTML = '<button title="前のページ">‹</button><button title="次のページ">›</button>'
      bar.append(m)
    })
    await sleep(200)
    await shot(page, '1-A-bar', CLIP)
    await page.evaluate(() => {
      document.body.classList.remove('mock-hide-arrows')
      document.querySelector('.mock-nav')?.remove()
      document.body.classList.add('mock-faint')
    })
    await sleep(200)
    await shot(page, '1-B-faint', CLIP)
    await context.close()
  }

  /** 段落を指で押して紙面で書き始め、「図を入れる」で写真を選ぶ（タイトルを書く欄が開くまで待つ） */
  const insertFigure = async (page, ready, kb) => {
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p2'), 'none'))
    await ready()
    await sleep(400)
    const at = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="p2"]')].find((e) => e.getBoundingClientRect().width > 0)
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width * 0.6, y: r.bottom - 4 }
    })
    await page.touchscreen.tap(at.x, at.y)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p2', { timeout: 20000 })
    if (kb) await keyboard(page, kb)
    await sleep(600)
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => void window.__editor.addFigure())])
    await chooser.accept([IMAGE])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'figureCaption' && !document.querySelector('.overlay-clip.waiting'), { timeout: 30000 })
    await ready()
    await sleep(1200)
  }
  /** キーボードを仮に出す（iPhone と同じく、見えている所（visualViewport）が低くなる。scripts/e2e/phoneDirect.mjs と同じ） */
  const keyboard = (page, kb) =>
    page.evaluate((kb) => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => window.innerHeight - kb })
      window.visualViewport.dispatchEvent(new Event('resize'))
    }, kb)
  /** 写真のためだけの、仮のキーボードの絵 */
  const fakeKeyboard = (page, kb) =>
    page.evaluate((kb) => {
      document.querySelector('#fake-kb')?.remove()
      const k = document.createElement('div')
      k.id = 'fake-kb'
      k.textContent = 'キーボード'
      Object.assign(k.style, { position: 'fixed', left: '0', right: '0', bottom: '0', height: `${kb}px`, zIndex: '200', pointerEvents: 'none', background: '#d3d6dc', color: '#6b6f78', display: 'grid', placeItems: 'center', font: '15px sans-serif' })
      document.body.append(k)
    }, kb)

  // ② スマホの横向き（844×390）。キーボードは 190px
  if (want('land')) {
    const KB = 190
    const { context, page, ready } = await openSample(browser, { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true)
    await insertFigure(page, ready, KB)
    await page.keyboard.type('糸')
    await sleep(500)
    await fakeKeyboard(page, KB)
    await shot(page, '2-now')
    // 案A：書いている間（横向き）は、上の帯を隠す
    const top = await page.evaluate(() => document.querySelector('.p-top').getBoundingClientRect().height)
    await page.evaluate(() => document.body.classList.add('mock-no-top'))
    await sleep(300)
    // 帯の分だけ紙面が上へ広がる（書いている行の位置は変えない）
    await page.evaluate((top) => { const sc = document.querySelector('.stage .page-scroller'); if (sc) sc.scrollTop -= top }, top)
    await sleep(500)
    await shot(page, '2-A-notop')
    // 案B：案A＋はじめて横向きで書いたとき、上に「縦向きにすると…」を1回だけ
    await page.evaluate(() => {
      const t = document.createElement('div')
      t.className = 'mock-tip'
      t.textContent = '縦向きにすると、紙面を広く見ながら書けます'
      document.body.append(t)
    })
    await sleep(200)
    await shot(page, '2-B-tip')
    await context.close()
  }

  // ③ iPhone（390×844）：写真を選んだあと、タイトルの欄は開いているが、キーボードが出ていない
  if (want('ios')) {
    const { context, page, ready } = await openSample(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true)
    await insertFigure(page, ready, 0)
    await shot(page, '3-now')
    const box = await page.evaluate(() => {
      const r = document.querySelector('.overlay-editor').getBoundingClientRect()
      // 書いている間の道具の帯（戻す・やり直す・完了）の上の端
      const tops = [...document.querySelectorAll('.db-row')].map((e) => e.getBoundingClientRect()).filter((x) => x.height > 0).map((x) => x.top)
      const bar = tops.length ? { top: Math.min(...tops) } : null
      return { left: r.left, top: r.top, width: r.width, height: r.height, bar: bar ? bar.top : innerHeight - 60 }
    })
    // 案A：キーボードが出ていないときだけ、タイトルの欄に吹き出し「ここを押して、タイトルを書きます」
    await page.evaluate((b) => {
      const ring = document.createElement('div')
      ring.className = 'mock-ring'
      Object.assign(ring.style, { left: `${b.left - 6}px`, top: `${b.top - 4}px`, width: `${b.width + 12}px`, height: `${b.height + 8}px` })
      const bub = document.createElement('div')
      bub.className = 'mock-bubble'
      bub.textContent = 'ここを押して、タイトルを書きます'
      document.body.append(ring, bub)
      const w = bub.getBoundingClientRect().width
      Object.assign(bub.style, { left: `${Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2))}px`, top: `${b.top - 54}px` })
    }, box)
    await sleep(200)
    await shot(page, '3-A-bubble')
    // 案B：枠だけにして、画面の下（道具の上）に「タイトルの欄を押すと、キーボードが出ます」
    await page.evaluate((b) => {
      document.querySelector('.mock-bubble')?.remove()
      const note = document.createElement('div')
      note.className = 'mock-bar-note'
      note.textContent = 'タイトルの欄を押すと、キーボードが出ます'
      document.body.append(note)
      note.style.top = `${b.bar - note.getBoundingClientRect().height}px`
    }, box)
    await sleep(200)
    await shot(page, '3-B-note')
    await context.close()
  }
  console.log('ok')
})
