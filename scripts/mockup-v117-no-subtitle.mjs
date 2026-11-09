// サブタイトルを使わないコース（依頼者の選択 2026-11-09）の見本の写真：管理ページの欄（管理者・先生、使う・使わない）と、学生の表紙・抄録（使う・使わない）。
// 使い方：node scripts/e2e/run.mjs のあと（dist-e2e がある）node scripts/mockup-v117-no-subtitle.mjs → mockups/v117/
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'
import { serveBuilt } from './e2e/serveBuilt.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { answerConfirms } from './e2e/confirmUi.mjs'

const PORT = 4181
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v117'
mkdirSync(OUT, { recursive: true })
const FILM = 'film-stage-costume'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fixture = JSON.parse(readFileSync(new URL('./e2e/config-fixture.json', import.meta.url), 'utf8'))
const sample = JSON.parse(readFileSync(new URL('../../見本の原稿_シンドバッド.json', import.meta.url), 'utf8'))
const SAMPLE_ABSTRACT = (sample.report ?? sample).abstract
const server = await serveBuilt('dist-e2e', PORT)

/** 管理ページのコースの「サブタイトル」の欄（カードの中の1行）を写す */
async function adminRow(browser, teacher) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('dialog', (d) => void d.accept())
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })
  await page.goto(`${APP}/admin.html${teacher ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    for (const key of ['sotsugyo-admin-mock', 'sotsugyo-admin-mock-order', 'sotsugyo-admin-mock-checksheets']) localStorage.removeItem(key)
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定')).click())
  await wait(400)
  await page.evaluate((id) => {
    const c = document.querySelector(`.course[data-course-id="${id}"]`)
    if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
  }, FILM)
  const sel = `#c-${FILM}-subtitle-use`
  await page.waitForSelector(sel)
  const who = teacher ? 'teacher' : 'admin'
  /** スイッチのある行（見出しと中身）を囲む四角 */
  const rowBox = () =>
    page.evaluate((sel) => {
      const row = document.querySelector(sel).closest('.set-row')
      row.scrollIntoView({ block: 'center' })
      const r = row.getBoundingClientRect()
      return { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 }
    }, sel)
  await wait(300)
  await page.screenshot({ path: `${OUT}/${who}-on.png`, clip: await rowBox() })
  await page.evaluate((sel) => document.querySelector(sel).click(), sel)
  await wait(300)
  await page.screenshot({ path: `${OUT}/${who}-off.png`, clip: await rowBox() })
  await context.close()
}

/** 学生の表紙と抄録を写す。noSubtitle：1つ目のコースのサブタイトルを使わない */
async function studentPages(browser, noSubtitle) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 2 })
  await stubConfig(page, noSubtitle ? { courses: fixture.courses.map((c, i) => (i === 0 ? { ...c, noSubtitle: true } : c)) } : {})
  await answerConfirms(page, () => true)
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
  // 抄録は、見本の原稿（シンドバッド）の抄録を書き終えた形にする（依頼者 2026-11-09「抄録の文章を書いたものを見たい」）
  await page.evaluate(
    (sub, abstract) =>
      window.__editor.update((r) => ({
        ...r,
        basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ', subtitleInput: sub },
        abstract,
      })),
    noSubtitle ? '' : 'アラビアンナイト',
    SAMPLE_ABSTRACT,
  )
  await wait(1200)
  await ready()
  // 表紙（上の6割）と、抄録（上のほう）を、別々に写す（高さは A4 の紙の高さから）
  const tag = noSubtitle ? 'off' : 'on'
  const part = async (kind, ratio) => {
    await page.evaluate((kind) => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf(kind), 'none'), kind)
    await wait(800)
    await ready()
    const r = await page.evaluate((kind) => {
      const b = document.querySelector(`.page-viewport.front section.${kind}`).getBoundingClientRect()
      return { x: b.left, y: b.top, width: b.width, height: b.height }
    }, kind)
    await page.screenshot({ path: `${OUT}/student-${kind}-${tag}.png`, clip: { ...r, height: r.width * 1.414 * ratio } })
  }
  await part('cover', 0.62)
  // 表紙の全体（紙1枚。依頼者 2026-11-09「全画面を見せて」）
  const paper = await page.evaluate(() => {
    const b = document.querySelector('.page-viewport.front').getBoundingClientRect()
    return { x: b.left, y: b.top, width: b.width, height: b.height }
  })
  await page.screenshot({ path: `${OUT}/student-cover-full-${tag}.png`, clip: paper })
  await part('abstract', 0.22)
  // 抄録の全体（紙1枚）
  await page.screenshot({ path: `${OUT}/student-abstract-full-${tag}.png`, clip: paper })
  await context.close()
}

try {
  await withEdge(async (browser) => {
    await adminRow(browser, false)
    await adminRow(browser, true)
    await studentPages(browser, false)
    await studentPages(browser, true)
    // 1枚にまとめる
    // 白紙のページからは file: の画像を読めないので、中に埋め込む
    const img = (name) => `data:image/png;base64,${readFileSync(`${OUT}/${name}.png`).toString('base64')}`
    const page = await browser.newPage()
    await page.setViewport({ width: 1240, height: 800, deviceScaleFactor: 1 })
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>
      body{font-family:"Yu Gothic UI","Meiryo",sans-serif;margin:0;padding:28px 32px;background:#f4f3ef;color:#2b2b2b;width:1176px}
      h1{font-size:22px;margin:0 0 6px} p.lead{margin:0 0 20px;font-size:14px;color:#555}
      h2{font-size:16px;margin:22px 0 10px;border-left:5px solid #2f4a7a;padding-left:10px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      figure{margin:0;background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px}
      figcaption{font-size:14px;font-weight:bold;margin-bottom:8px}
      figure img{width:100%;display:block;border-radius:4px}
      </style>
      <h1>サブタイトルを使わないコース（見本）</h1>
      <p class="lead">管理ページのコースの「サブタイトル」に、使う・使わないのスイッチを付けました。管理者もコースの先生も切り替えられます。</p>
      <h2>管理ページ（管理者の画面）</h2>
      <div class="grid"><figure><figcaption>使う（今までどおり）</figcaption><img src="${img('admin-on')}"></figure><figure><figcaption>使わない</figcaption><img src="${img('admin-off')}"></figure></div>
      <h2>管理ページ（コースの先生の画面）</h2>
      <div class="grid"><figure><figcaption>使う（形式は見えるだけ）</figcaption><img src="${img('teacher-on')}"></figure><figure><figcaption>使わない</figcaption><img src="${img('teacher-off')}"></figure></div>
      <h2>学生の表紙（上の6割）</h2>
      <div class="grid"><figure><figcaption>使う（今までどおり）</figcaption><img src="${img('student-cover-on')}"></figure><figure><figcaption>使わない：サブタイトルの行と下線が出ない</figcaption><img src="${img('student-cover-off')}"></figure></div>
      <h2>学生の抄録（上のほう）</h2>
      <div class="grid"><figure><figcaption>使う（今までどおり）</figcaption><img src="${img('student-abstract-on')}"></figure><figure><figcaption>使わない：サブタイトルの行は空けたまま（本文の位置は変わらない）</figcaption><img src="${img('student-abstract-off')}"></figure></div>`,
      { waitUntil: 'load' },
    )
    await wait(500)
    await page.screenshot({ path: `${OUT}/まとめ.png`, fullPage: true })
  })
} finally {
  server.close()
}
console.log(`できました：${OUT}/まとめ.png`)
