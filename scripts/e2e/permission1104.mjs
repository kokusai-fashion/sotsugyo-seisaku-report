// 先生の許可の仕組み（学生の側。依頼者の選択 2026-11-04。docs/設計_許可の仕組み.md・mockups/v105・v108）：
// - 抄録の許可を使うコース：許可の前は「先生の許可を待っています」（学生のボタンはない）。「確かめ直す」はログインしていなければ知らせる。
//   許可が出たら「先生の許可が出ました（日付・先生）」と「抄録を書き始める」
// - 最終提出の許可を使うコース：許可の前の PDF は「〜_点検用.pdf」で、窓に赤い知らせ。作るときだけ、全ページに「点検用」の印を置く（終わったら外す）。
//   許可のあとは緑の知らせ・印のないファイル名。許可のあとに書き換えたら一言
// - 右の欄（スマホはメニュー）の「点検の予定と記録」：回ごとの先生と済み・次はここ・予定、許可の状態
// - 許可を使わないコースは今のまま
// 窓口の答え（点検表の自分の行）は、この端末に覚えた答えとして入れて確かめる（?nodrive。窓口とのやりとりは drive.mjs）
// これだけを流すときは node scripts/e2e/run.mjs permission1104
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/permission1104'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const fixture = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))
const withPermission = (permission) => fixture.courses.map((c, i) => (i === 0 ? { ...c, permission } : c))
const ROUNDS = [
  { label: '1回目', teacher: '山本', state: 'done' },
  { label: '2回目', teacher: '中村', state: 'done' },
  { label: '抄録', teacher: '小川', state: 'plan' },
  { label: '4回目', teacher: '山本', state: 'plan' },
]
const KEY = `sotsugyo-seisaku-report-check-status:${fixture.fiscalYear}:00ZZ0123`

async function open(browser, { permission, row, phone = false }) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(
    (key, row) => {
      try {
        for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
        if (row !== undefined) localStorage.setItem(key, JSON.stringify({ row, at: new Date().toISOString() }))
      } catch {}
    },
    KEY,
    row,
  )
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1366, height: 900 })
  await stubConfig(page, permission ? { courses: withPermission(permission) } : {})
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
  await page.evaluate(setupWriting)
  await wait(600)
  // 学籍番号を入れ、抄録はまだ書き始めていない形にする
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123' }, abstract: { ...r.abstract, started: false } })))
  await wait(1200)
  await ready()
  return { context, page, ready }
}
const toAbstract = async (page, ready) => {
  await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf('abstract'), 'none'))
  await wait(600)
  await ready()
}
const lock = (page) => page.evaluate(() => { const el = document.querySelector('.page-viewport.front .abstract-lock'); return el ? { cls: el.className, text: el.textContent, start: !!el.querySelector('[data-abstract-start]'), recheck: !!el.querySelector('[data-abstract-recheck]') } : null })
/** 紙面の部品を、マウスで押す（紙面は、押した点から何を押したかを決める） */
const pressOnPaper = async (page, selector) => {
  const p = await page.evaluate((sel) => { const r = document.querySelector(`.page-viewport.front [data-vivliostyle-page-container].is-current ${sel}`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, selector)
  await page.mouse.click(p.x, p.y)
}
const openPdf = async (page) => {
  await page.evaluate(() => document.querySelector('.side button.export')?.click())
  await page.waitForSelector('.modal .pdf-file', { timeout: 30000 })
  await wait(300)
  return page.evaluate(() => ({ file: document.querySelector('.modal .pdf-file .fn')?.textContent ?? '', perm: document.querySelector('.modal .pdf-perm')?.className ?? '', permText: document.querySelector('.modal .pdf-perm')?.textContent ?? '', edited: document.querySelector('.modal .pdf-edited')?.textContent ?? '' }))
}
const closeModal = async (page) => {
  await page.keyboard.press('Escape')
  await wait(400)
}

await withEdge(async (browser) => {
  // ---- 許可を使わないコース：今のまま ----
  {
    const { context, page, ready } = await open(browser, { permission: undefined })
    await toAbstract(page, ready)
    const l = await lock(page)
    const pdf = await openPdf(page)
    const card = await page.evaluate(() => !!document.querySelector('.side .check-card'))
    check('許可を使わないコース：抄録は今までどおり「先生の許可が出た」のボタン。PDF に許可の知らせも「_点検用」もない。点検の予定と記録も出ない', !!l && l.start && l.text.includes('先生の許可が出た') && !pdf.perm && !pdf.file.includes('点検用') && !card, JSON.stringify({ l, pdf, card }))
    await context.close()
  }

  // ---- 許可を使うコース・許可の前 ----
  {
    const { context, page, ready } = await open(browser, { permission: { abstract: true, final: true }, row: { rounds: ROUNDS, abstractOk: null, finalOk: null } })
    await toAbstract(page, ready)
    const l = await lock(page)
    await page.screenshot({ path: `${OUT}/1-abstract-waiting.png` })
    check('抄録の許可の前：「先生の許可を待っています」と「許可が出たか、確かめ直す」。学生が押して書き始めるボタンはない', !!l && l.cls.includes('waiting') && l.text.includes('先生の許可を待っています') && l.recheck && !l.start, JSON.stringify(l))
    await pressOnPaper(page, '[data-abstract-recheck]')
    await wait(500)
    const notice = await page.evaluate(() => document.querySelector('.undo-area .undo-toast')?.textContent ?? '')
    const startedAfter = await page.evaluate(() => window.__editor.getSnapshot().report.abstract.started)
    check('「確かめ直す」：ログインしていなければ、ログインを頼む知らせ（抄録は書き始めない）', startedAfter === false && notice.includes('ログイン'), JSON.stringify({ startedAfter, notice: notice.slice(0, 60) }))
    // パソコンの右の欄では、はじめは1行にたたんである（次の回と先生。mockups/v110 案C）。押して開いてから中身を見る
    const folded = await page.evaluate(() => {
      const c = document.querySelector('.side .check-card')
      return c ? { folded: c.classList.contains('folded'), rows: c.querySelectorAll('tr').length, sum: c.querySelector('.cc-sum')?.textContent ?? '', expanded: c.querySelector('.cc-toggle')?.getAttribute('aria-expanded') } : null
    })
    check('右の欄の「点検の予定と記録」は、はじめは1行（「次は 抄録・小川先生」）。表は出ていない', !!folded && folded.folded && folded.rows === 0 && folded.sum === '次は 抄録・小川先生' && folded.expanded === 'false', JSON.stringify(folded))
    await page.evaluate(() => document.querySelector('.side .check-card .cc-toggle').click())
    await wait(300)
    const card = await page.evaluate(() => {
      const c = document.querySelector('.side .check-card')
      return c ? { rows: [...c.querySelectorAll('tr')].map((tr) => tr.textContent), perm: c.querySelector('.perm')?.textContent ?? '' } : null
    })
    check(
      '右の欄に「点検の予定と記録」：回ごとの先生、済み・次はここ・予定、許可は「まだです」',
      !!card && card.rows.join('|') === '1回目山本先生✓ 済み|2回目中村先生✓ 済み|抄録小川先生次はここ|4回目山本先生予定' && card.perm.includes('抄録を書く許可：まだです') && card.perm.includes('最終提出の許可：まだです'),
      JSON.stringify(card),
    )
    const pdf = await openPdf(page)
    await page.screenshot({ path: `${OUT}/2-pdf-before.png` })
    check('最終提出の許可の前：PDF の窓に赤い知らせ（点検用）、ファイル名は「〜_点検用.pdf」', pdf.perm.includes('wait') && pdf.permText.includes('最終提出の許可は、まだ出ていません') && pdf.file.endsWith('_点検用.pdf'), JSON.stringify(pdf))
    // 作る：作っている間だけ、各ページに「点検用」の印を置く（終わったら外す）
    await page.evaluate(() => {
      window.__marks = 0
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.classList.contains('check-mark')) window.__marks++
      }).observe(document.body, { childList: true, subtree: true })
    })
    await page.evaluate(() => document.querySelector('.modal .pdf-start')?.click())
    await page.waitForFunction(() => document.querySelector('.modal .pdf-open, .modal .pdf-save'), { timeout: 180000 })
    await wait(300)
    const built = await page.evaluate(() => ({ marks: window.__marks, left: document.querySelectorAll('.check-mark').length, file: document.querySelector('.modal .pdf-file .fn')?.textContent ?? '' }))
    check('点検用の PDF を作ると、PDF に入れる各ページに「点検用」の印を置いて撮り、終わったら外す（ファイル名も「_点検用」）', built.marks >= 3 && built.left === 0 && built.file.endsWith('_点検用.pdf'), JSON.stringify(built))
    await closeModal(page)
    await context.close()
  }

  // ---- 許可が出たあと ----
  {
    const row = { rounds: ROUNDS, abstractOk: { at: '2026-12-15T10:00:00+09:00', by: '小川' }, finalOk: { at: '2026-01-13T10:00:00+09:00', by: '山本' } }
    const { context, page, ready } = await open(browser, { permission: { abstract: true, final: true }, row })
    await toAbstract(page, ready)
    const l = await lock(page)
    await page.screenshot({ path: `${OUT}/3-abstract-granted.png` })
    check('抄録の許可のあと：「先生の許可が出ました（12/15　小川先生）」と「抄録を書き始める」', !!l && l.cls.includes('granted') && l.text.includes('先生の許可が出ました（12/15　小川先生）') && l.start && l.text.includes('抄録を書き始める'), JSON.stringify(l))
    await pressOnPaper(page, '[data-abstract-start]')
    await wait(800)
    await ready()
    check('「抄録を書き始める」で、抄録を書き始める', (await page.evaluate(() => window.__editor.getSnapshot().report.abstract.started)) !== false)
    // 書き換えた（原稿の更新日時は、許可（2026-01-13）よりあと）
    const pdf = await openPdf(page)
    await page.screenshot({ path: `${OUT}/4-pdf-granted.png` })
    check(
      '最終提出の許可のあと：緑の知らせ（日付・先生）、ファイル名に「_点検用」は付かない。許可のあとに書き換えたら一言',
      pdf.perm.includes('ok') && pdf.permText.includes('最終提出の許可が出ています（1/13　山本先生）') && !pdf.file.includes('点検用') && pdf.edited.includes('許可のあとに書き換えました'),
      JSON.stringify(pdf),
    )
    await closeModal(page)
    await context.close()
  }

  // ---- スマホ：抄録の帯・メニューの中の「点検の予定と記録」 ----
  {
    const { context, page, ready } = await open(browser, { permission: { abstract: true }, row: { rounds: ROUNDS, abstractOk: null, finalOk: null }, phone: true })
    await toAbstract(page, ready)
    await wait(600)
    const band = await page.evaluate(() => { const b = document.querySelector('.page-band'); return b ? { text: b.textContent, button: b.querySelector('button')?.textContent ?? '' } : null })
    await page.screenshot({ path: `${OUT}/5-phone-band.png` })
    check('スマホ：抄録の帯は「抄録は、先生の許可が出てから書きます」と「許可が出たか、確かめ直す」', !!band && band.text.includes('先生の許可が出てから') && band.button === '許可が出たか、確かめ直す', JSON.stringify(band))
    await page.evaluate(() => document.querySelector('button[aria-label^="メニュー"]')?.click())
    await page.waitForSelector('.sheet-body', { timeout: 10000 })
    await wait(400)
    const card = await page.evaluate(() => document.querySelector('.sheet-body .check-card')?.textContent ?? '')
    await page.screenshot({ path: `${OUT}/6-phone-menu.png` })
    check('スマホ：メニューの中に「点検の予定と記録」（最終提出の許可を使わないコースは、その行を出さない）', card.includes('点検の予定と記録') && card.includes('次はここ') && card.includes('抄録を書く許可：まだです') && !card.includes('最終提出'), card)
    await context.close()
  }

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
