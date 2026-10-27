// mockups/v70：ひな形の本文に、はじめから文を入れておく（依頼者 2026-10-27：案1。本文に字として入れておく所と、薄い字で書くことを示す所を使い分けたい）。
// ひな形を作る画面で、段落ごとに「ここに書くこと（薄い字）」か「本文に入る文（そのまま本文に）」かを切り替える方法の案と、学生の画面。
//   案A 段落の左の札を押して切り替える／案B 書いている段落の下の切り替えで／案C 書いている段落の左の道具（「この段落」）で
// 見た目の案（動きは作っていない）。使い方：node scripts/mockup-v70-template-text.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v70/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 先生が本文に入れておく文（架空） */
const TEXT = '本報告書は、2026年度の卒業制作において、筆者が担当した舞台衣装の制作についてまとめたものである。'
const TEXT_ID = 'mock-text'

/** 本文に入る文の札と字（どの案も同じ） */
const COMMON_CSS = `
  .tpl-mode .page-viewport section.body p[data-block-id="${TEXT_ID}"] { color: #1f2430 !important; }
  .tpl-mode .page-viewport section.body p[data-block-id="${TEXT_ID}"]:not(:empty)::before { content: '本文に入る文' !important; border-color: #a9bce6 !important; background: #e3eafa !important; color: #23408e !important; }
  .tpl-mode .overlay-editor[data-kind='paragraph'].mock-text { color: #1f2430 !important; }
  .tpl-editing-tag.mock-text { border-color: #a9bce6; background: #e3eafa; color: #23408e; }
  .tpl-points li.mock-new { color: #1e3a8a; }
  .tpl-points .k { font-weight: 700; }
  .tpl-points .k.g { color: #7a5600; }
  .tpl-points .k.b { color: #23408e; }
`

/** 案A：札を押して切り替える（札に ▾、押すと選ぶ窓） */
const CSS_A = `
  .tpl-mode .page-viewport section.body p[data-block-id]:not(:empty)::before { content: 'ここに書くこと ▾' !important; right: calc(100% + 3px / var(--s)) !important; padding: 0 calc(4px / var(--s)) !important; letter-spacing: 0 !important; }
  .tpl-mode .page-viewport section.body p[data-block-id="${TEXT_ID}"]:not(:empty)::before { content: '本文に入る文 ▾' !important; box-shadow: 0 0 0 calc(2px / var(--s)) #23408e; }
  .mock-menu { position: fixed; z-index: 60; width: 286px; padding: 6px; background: #fff; border: 1px solid #d8dbe2; border-radius: 10px; box-shadow: 0 10px 28px rgba(20, 25, 40, 0.2); font-family: 'BIZ UDPGothic', sans-serif; }
  .mock-menu .opt { display: grid; grid-template-columns: 22px 1fr; gap: 2px 6px; align-items: start; padding: 8px 10px; border-radius: 8px; color: #222; }
  .mock-menu .opt.on { background: #eef2fb; }
  .mock-menu .opt i { grid-row: 1 / 3; width: 14px; height: 14px; margin-top: 2px; border-radius: 50%; border: 2px solid #9aa1ad; box-sizing: border-box; }
  .mock-menu .opt.on i { border: 4.5px solid #23408e; }
  .mock-menu .opt b { font-size: 13.5px; }
  .mock-menu .opt b.g { color: #7a5600; }
  .mock-menu .opt b.bl { color: #23408e; }
  .mock-menu .opt small { font-size: 12px; color: #5b6170; line-height: 1.55; }
`

/** 案B：書いている段落の下に、切り替え */
const CSS_B = `
  .mock-switch { position: fixed; z-index: 60; display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; background: #fff; border: 1px solid #d8dbe2; border-radius: 9px; box-shadow: 0 6px 18px rgba(20, 25, 40, 0.16); font-family: 'BIZ UDPGothic', sans-serif; white-space: nowrap; }
  .mock-switch .l { font-size: 12px; color: #5b6170; margin-right: 4px; }
  .mock-switch span.b { display: inline-flex; flex-direction: column; align-items: center; padding: 4px 12px; border-radius: 6px; border: 1px solid #d8dbe2; font-size: 13px; font-weight: 700; color: #4a5060; line-height: 1.3; }
  .mock-switch span.b small { font-size: 10.5px; font-weight: 400; color: #6b7280; }
  .mock-switch span.b.on { background: #23408e; border-color: #23408e; color: #fff; }
  .mock-switch span.b.on small { color: #dfe6f7; }
`

/** 案C：書いている段落の左の道具（「この段落」）に、2つの切り替え */
const CSS_C = `
  .palette .mock-group .tb .mock-ic { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 5px; font: 700 15px/1 'BIZ UDMincho', serif; }
  .palette .mock-group .tb .mock-ic.g { color: #8d96b8; border: 1px dashed #b7bdd3; }
  .palette .mock-group .tb .mock-ic.b { color: #1f2430; border: 1px solid #1f2430; }
  .palette .mock-group .tb.on { background: #e3eafa; box-shadow: inset 0 0 0 1.5px #23408e; color: #23408e; }
  .palette .mock-group .ctx-note { margin-top: 2px; }
`

/** 右の欄の「このコースのひな形」の箇条（案ごとの、切り替え方の1行） */
const HOW = {
  a: '段落の左の札を押すと、<br>切り替えられます',
  b: '書いている段落の下で、<br>切り替えられます',
  c: '書いている段落の左の道具で、<br>切り替えられます',
}

await withEdge(async (browser) => {
  // ---- ひな形を作る画面（管理ページの見本のサーバーで） ----
  /** 管理ページから、ひな形を作る画面を開く。本文に入る文を1つ足した紙面にする */
  async function openTemplate() {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
    await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0', timeout: 180000 })
    await page.evaluate(() => {
      localStorage.removeItem('sotsugyo-admin-mock')
      localStorage.removeItem('sotsugyo-admin-year')
      sessionStorage.removeItem('sotsugyo-admin-section')
    })
    await page.reload({ waitUntil: 'networkidle0', timeout: 180000 })
    await page.waitForSelector('.admin .content')
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コース')).click())
    await page.waitForSelector('.course.open .tpl-line .tpl-open')
    await page.evaluate(() => document.querySelector('.course.open .tpl-open').click())
    await page.waitForSelector('.tpl-overlay iframe')
    await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 60000 })
    const frame = page.frames().find((f) => f.url().includes('template=1') && f.parentFrame() === page.mainFrame())
    const ready = () => frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning }, { timeout: 90000 })
    await frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && s.page === window.__editor.pageOfArea('body') }, { timeout: 90000 })
    // 大見出し「Ⅰ．」のすぐ下に、本文に入る文
    await frame.evaluate(
      (text, id) => {
        window.__editor.update((r) => ({
          ...r,
          body: r.body.map((c, i) => (i === 0 ? { ...c, blocks: [{ type: 'paragraph', id, content: [{ type: 'text', text }] }, ...c.blocks] } : c)),
        }))
      },
      TEXT,
      TEXT_ID,
    )
    await sleep(1200)
    await ready()
    await frame.addStyleTag({ content: COMMON_CSS })
    return { context, page, frame, ready }
  }

  /** 右の欄の箇条を、新しい言い方にする */
  const sidePoints = (frame, how) =>
    frame.evaluate((how) => {
      const ul = document.querySelector('.tpl-points')
      ul.innerHTML = `<li>学生と同じように、紙面に書きます</li>
        <li class="mock-new"><span class="k g">「ここに書くこと」</span>は、<br>学生には薄い字で出ます</li>
        <li class="mock-new"><span class="k b">「本文に入る文」</span>は、<br>そのまま学生の本文に入ります</li>
        <li class="mock-new">${how}</li>
        <li>表紙・作品写真は、ひな形に入りません</li>`
    }, how)

  /** 紙面の上のほう（本文に入る文のあたり）を大きく撮る */
  async function shootZoom(page, name) {
    const box = await page.evaluate(() => document.querySelector('.tpl-overlay iframe').getBoundingClientRect().toJSON())
    await page.screenshot({ path: join(OUT, `${name}-zoom.png`), clip: { x: box.x + 220, y: box.y + 66, width: 640, height: 300 }, captureBeyondViewport: false })
  }

  /** 本文に入る文を押して、書いている形にする */
  async function editText(frame, ready) {
    const p = await frame.$(`.page-viewport.front section.body p[data-block-id="${TEXT_ID}"]`)
    await p.click()
    await frame.waitForSelector('.overlay-editor[data-kind="paragraph"]')
    await sleep(900)
    await frame.evaluate(() => {
      document.querySelector('.overlay-editor[data-kind="paragraph"]').classList.add('mock-text')
      const tag = document.querySelector('.tpl-editing-tag')
      if (tag) {
        tag.classList.add('mock-text')
        tag.textContent = '本文に入る文'
      }
    })
  }

  // いま
  {
    const { context, page } = await openTemplate()
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, 'now.png') })
    await context.close()
  }

  // 案A：札を押して切り替える
  {
    const { context, page, frame } = await openTemplate()
    await frame.addStyleTag({ content: CSS_A })
    await sidePoints(frame, HOW.a)
    await frame.evaluate((id) => {
      const p = document.querySelector(`.page-viewport.front section.body p[data-block-id="${id}"]`)
      const r = p.getBoundingClientRect()
      const menu = document.createElement('div')
      menu.className = 'mock-menu'
      menu.style.left = `${r.left - 92}px`
      menu.style.top = `${r.bottom + 6}px`
      menu.innerHTML = `
        <div class="opt"><i></i><b class="g">ここに書くこと</b><small>学生には薄い字で出す説明。<br>学生が書き始めると消え、PDFには出ません</small></div>
        <div class="opt on"><i></i><b class="bl">本文に入る文</b><small>そのまま学生の本文に入ります。<br>学生が直したり消したりできます</small></div>`
      document.body.append(menu)
    }, TEXT_ID)
    await sleep(400)
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, 'a-main.png') })
    await shootZoom(page, 'a')
    await context.close()
  }

  // 案B：書いている段落の下の切り替え
  {
    const { context, page, frame, ready } = await openTemplate()
    await frame.addStyleTag({ content: CSS_B })
    await sidePoints(frame, HOW.b)
    await editText(frame, ready)
    await frame.evaluate(() => {
      const r = document.querySelector('.overlay-editor[data-kind="paragraph"]').getBoundingClientRect()
      const sw = document.createElement('div')
      sw.className = 'mock-switch'
      sw.innerHTML = `<span class="l">この段落は</span><span class="b">ここに書くこと<small>薄い字・PDFに出ない</small></span><span class="b on">本文に入る文<small>そのまま本文に</small></span>`
      document.body.append(sw)
      sw.style.left = `${r.left}px`
      sw.style.top = `${r.bottom + 8}px`
    })
    await sleep(400)
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, 'b-main.png') })
    await shootZoom(page, 'b')
    await context.close()
  }

  // 案C：書いている段落の左の道具に、2つの切り替え
  {
    const { context, page, frame, ready } = await openTemplate()
    await frame.addStyleTag({ content: CSS_C })
    await sidePoints(frame, HOW.c)
    await editText(frame, ready)
    // 書いている段落の道具（「この段落」の囲み）に、切り替えの2つを足す
    await frame.evaluate(() => {
      const group = [...document.querySelectorAll('.palette .group')].find((g) => g.textContent.includes('この段落'))
      group.classList.add('mock-group')
      group.querySelector('.ctx-label').insertAdjacentHTML(
        'afterend',
        `<button class="tb"><span class="mock-ic g">あ</span><span><span class="tb-line">ここに</span><span class="tb-line">書くこと</span></span></button>
         <button class="tb on"><span class="mock-ic b">あ</span><span><span class="tb-line">本文に</span><span class="tb-line">入る文</span></span></button>`,
      )
    })
    await sleep(400)
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, 'c-main.png') })
    const box = await page.evaluate(() => document.querySelector('.tpl-overlay iframe').getBoundingClientRect().toJSON())
    await page.screenshot({ path: join(OUT, 'c-zoom.png'), clip: { x: box.x + 150, y: box.y + 66, width: 700, height: 560 }, captureBeyondViewport: false })
    await context.close()
  }

  // ---- 学生の画面（このひな形で書き始めたところ） ----
  {
    // ひな形を作る画面の本文を、学生の原稿の形にする（本文に入る文は字のまま、ほかの段落の字は薄い字の説明）
    const { context: tc, frame } = await openTemplate()
    const body = await frame.evaluate((id) => {
      const text = (b) => b.content.map((x) => x.text ?? '').join('')
      return window.__editor.report.body.map((c) => ({
        ...c,
        blocks: c.blocks.map((b) => (b.type !== 'paragraph' || b.id === id ? b : { ...b, content: [{ type: 'text', text: '' }], ...(text(b) ? { hint: text(b) } : {}) })),
      }))
    }, TEXT_ID)
    await tc.close()

    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('sotsugyo-seisaku-report-tour', 'done')
      } catch {}
    })
    await stubConfig(page)
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
    const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
    await ready()
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate((body) => window.__editor.update((r) => ({ ...r, body })), body)
    await sleep(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('body'), 'none'))
    await sleep(900)
    await ready()
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, 'student.png') })
    const paper = await page.evaluate(() =>
      [...document.querySelectorAll('[data-vivliostyle-page-container]')]
        .map((e) => e.getBoundingClientRect().toJSON())
        .filter((r) => r.width > 0 && r.left >= 0 && r.left < innerWidth)
        .sort((a, b) => b.width - a.width)[0],
    )
    await page.screenshot({ path: join(OUT, 'student-zoom.png'), clip: { x: paper.x, y: paper.y + 50, width: paper.width, height: 300 }, captureBeyondViewport: false })
    await context.close()
  }
})
console.log(`${OUT} に撮りました`)
