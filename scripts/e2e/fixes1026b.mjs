// 試し（2026-10-26b。パソコン・スマホの学生役）で見つかったことの直し。これだけを流すときは node scripts/e2e/run.mjs fixes1026b
// - パソコン：右下の帯の「‹ ›」は帯の左の端（「＋」を同じ所で2回押すと、2回目が「›」に当たってページがめくれた。mockups/v66 ② 案A）
// - パソコン：自分で入れた表（見出しが空）のタイトルで Enter → 見出しの行の空いたマスへ（前は見出しの行をとばした）
// - パソコン：入れたばかりの表を書いている間は、その表の空いたマスの指摘を出さない（表から出たら出す）
// - パソコン：段落の頭にカーソルを置いて「改ページ」→ その段落の前に入る（前は段落の後ろ）。マウスを重ねた印も段落の上
// - 読めない写真を何枚か選んだ：知らせは1回で、名前を全部出す
// - スマホ：ログインの窓に、Classroom・LINE などのアプリから開いたときの切り替え方（mockups/v66 ① 案B。パソコンには出さない）
// - スマホ：セルフチェックから指摘の箇所へ移って開いた欄にも「ここを押して、書きます」（iPhone はキーボードが出ないため）。枠は画面の外へ出さない
// - スマホ：図を長押ししてから指を動かしても、ページをめくらない（すばやく、はらえば、めくる）
// - スマホ：はじめての案内の光の枠は、行の字の全体を囲む（隣の字を半分に切らない）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { fakeDrive, routeGoogle } from './fakeGoogle.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/fixes-1026b'
mkdirSync(OUT, { recursive: true })
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const config = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))

async function open(browser, { phone = false, width = phone ? 390 : 1440, height = phone ? 844 : 900, tourDone = true, drive = null } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  if (tourDone) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height })
  if (drive) await routeGoogle(page, drive, config)
  else await stubConfig(page)
  await page.goto(drive ? `${APP}/` : `${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  if (!drive) await ready()
  return { context, page, ready }
}

/** はじめての案内を「あとで」で閉じて、見本の原稿を入れる */
async function sample(page, ready) {
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(600)
  await ready()
}
const goTo = async (page, ready, id) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await wait(500)
  await ready()
}
const editingWait = (page, id) => page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
const centerOf = (page, selector) =>
  page.evaluate((selector) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 0)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, selector)

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)
    await sample(page, ready)
    await goTo(page, ready, 'p3')

    // 右下の帯：「＋」を同じ所で2回押すと、2段大きくなる（ページはめくれない）。「‹ ›」は帯の左の端
    const plus = await centerOf(page, '.view-bar .zoom-step button:last-child')
    const page0 = await page.evaluate(() => window.__editor.getSnapshot().page)
    await page.mouse.click(plus.x, plus.y)
    await wait(900)
    await ready()
    const plus2 = await centerOf(page, '.view-bar .zoom-step button:last-child')
    await page.mouse.click(plus.x, plus.y)
    await wait(900)
    await ready()
    const bar = await page.evaluate(() => ({ level: window.__editor.getSnapshot().zoomLevel, page: window.__editor.getSnapshot().page, first: document.querySelector('.view-bar').firstElementChild?.className }))
    check(
      '右下の帯：100% で「＋」を押して 125% になっても「＋」は動かず、同じ所の2回目で 150% になる（「›」に当たってページがめくれない）。「‹ ›」は帯の左の端',
      Math.abs(plus2.x - plus.x) < 1 && Math.abs(bar.level - 1.5) < 0.01 && bar.page === page0 && bar.first === 'bar-nav',
      JSON.stringify({ plus, plus2, ...bar, page0 }),
    )
    await page.evaluate(() => window.__editor.setView('fit'))
    await wait(700)
    await ready()

    // 自分で入れた表：タイトルで Enter → 見出しの行の空いたマスへ。書いている間は、その表の空いたマスの指摘を出さない
    await goTo(page, ready, 'p2')
    const p2 = await centerOf(page, '.page-viewport.front [data-block-id="p2"]')
    await page.mouse.click(p2.x, p2.y)
    await editingWait(page, 'p2')
    await page.evaluate(() => window.__editor.addTable('blank', { columns: 3, rows: 3 }))
    const tableId = await page.waitForFunction(() => {
      const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table' && b.id !== 't1')
      return t && window.__editor.getSnapshot().editingId === t.id ? t.id : null
    }, { timeout: 20000 }).then((h) => h.jsonValue())
    await wait(1500)
    await ready()
    await page.keyboard.type('素材と使った所')
    await wait(800)
    const cellIds = await page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).rows.flatMap((r) => r.cells.map((c) => c.id)), tableId)
    const tableFindings = () => page.evaluate((ids) => window.__editor.getSnapshot().findings.filter((f) => ids.includes(f.blockId)).map((f) => f.ruleId), cellIds)
    const whileCaption = await tableFindings()
    await page.keyboard.press('Enter')
    await wait(700)
    const afterEnter = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    check(
      '自分で入れた表（見出しが空）：タイトルを書いて Enter → 見出しの行の1つ目のマスへ（見出しの行をとばさない）',
      afterEnter === cellIds[0],
      JSON.stringify({ afterEnter, first: cellIds[0], second: cellIds[3] }),
    )
    await page.keyboard.type('名称')
    await wait(800)
    const whileCell = await tableFindings()
    await page.keyboard.press('Escape')
    await wait(1200)
    await ready()
    const afterClose = await tableFindings()
    check(
      '入れたばかりの表のタイトル・マスを書いている間は、その表の「表の見出しが入力されていない」「表に空いているセルがある」を出さず、表から出たら出す',
      whileCaption.length === 0 && whileCell.length === 0 && afterClose.includes('required-text') && afterClose.includes('table-cell-empty'),
      JSON.stringify({ whileCaption, whileCell, afterClose }),
    )

    // 段落の頭にカーソル → 「改ページ」：その段落の前に入る。マウスを重ねた印も段落の上（見出しのすぐ下の段落なら見出しの前：fixes1029）
    await goTo(page, ready, 'p7')
    const p7 = await page.evaluate(() => { const r = [...document.querySelectorAll('.page-viewport.front [data-block-id="p7"]')].find((e) => e.getBoundingClientRect().width > 0).getBoundingClientRect(); return { x: r.left + 40, y: r.top + 8, top: r.top } })
    await page.mouse.click(p7.x, p7.y)
    await editingWait(page, 'p7')
    await page.keyboard.down('Control')
    await page.keyboard.press('Home')
    await page.keyboard.up('Control')
    await wait(300)
    const breakTool = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((e) => e.textContent.includes('改ページ')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.move(breakTool.x, breakTool.y)
    await wait(400)
    const marker = await page.evaluate(() => { const m = [...document.querySelectorAll('*')].find((e) => e.textContent === 'ここに入ります' && !e.hidden && e.getBoundingClientRect().height > 0); return m ? m.getBoundingClientRect().top : null })
    await page.mouse.click(breakTool.x, breakTool.y)
    await wait(1200)
    await ready()
    const order = await page.evaluate(() => { const blocks = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks); const i = blocks.findIndex((b) => b.id === 'p7'); return { before: blocks[i - 1]?.type, after: blocks[i + 1]?.type } })
    check(
      '段落の頭にカーソルを置いて「改ページ」：その段落の前に入る（段落は次のページへ）。マウスを重ねた「ここに入ります」の印も段落の上',
      order.before === 'pageBreak' && order.after !== 'pageBreak' && marker !== null && marker < p7.top + 4,
      JSON.stringify({ order, marker, top: p7.top }),
    )
    await page.keyboard.press('Escape')
    await wait(500)

    // 読めない写真を2枚まとめて選ぶ：知らせは1回で、2つの名前を出す
    const dir = join(tmpdir(), 'sotsugyo-bad-photos')
    mkdirSync(dir, { recursive: true })
    const bad = ['IMG_0001.jpg', 'IMG_0002.jpg'].map((n) => { const f = join(dir, n); writeFileSync(f, 'not an image'); return f })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 4, columns: 2, imageIds: ['g-photo1', '', '', ''] }] })))
    await wait(800)
    await ready()
    const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 15000 }), page.evaluate(() => { void window.__editor.addPhotos(0, 1) })])
    await chooser.accept(bad)
    await wait(2500)
    const alertText = await page.evaluate(() => document.querySelector('[role="alertdialog"], .modal, .ask')?.textContent ?? document.body.innerText)
    check('読めない写真を2枚まとめて選ぶと、知らせは1回で、2つの名前を出す', alertText.includes('IMG_0001.jpg') && alertText.includes('IMG_0002.jpg'), alertText.slice(0, 120))
    await context.close()
  }

  // ---- ログインの窓（偽物の Google）：スマホにだけ、アプリの中の画面からの切り替え方 ----
  for (const phone of [true, false]) {
    const { context, page } = await open(browser, { phone, drive: fakeDrive('00zz0123@bunka-wu.ac.jp') })
    await page.waitForSelector('.login-over .login-btn', { timeout: 90000 })
    const note = await page.evaluate(() => document.querySelector('.login-inapp')?.textContent ?? '')
    if (phone) {
      await page.screenshot({ path: `${OUT}/login-phone.png`, captureBeyondViewport: false })
      check('スマホのログインの窓：ボタンの下に「Classroom・LINE などから開いたとき」と、iPhone・Android の切り替え方が出る', note.includes('Classroom・LINE などから開いたとき') && note.includes('方位磁針') && note.includes('Chrome で開く'), note)
    } else check('パソコンのログインの窓には、アプリの中の画面からの切り替え方を出さない', note === '', note)
    await context.close()
  }

  // ---- スマホ ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await sample(page, ready)
    // セルフチェックから指摘の箇所へ（「。」がない段落）：欄が開き、キーボードが出ていなければ「ここを押して、書きます」
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' ? { ...b, content: [{ type: 'text', text: '二回目の仮縫いでは、舞台の上で動きやすさを確かめた' }] } : b)) })) })))
    await wait(800)
    await ready()
    await page.evaluate(() => { const f = window.__editor.getSnapshot().findings.find((f) => f.blockId === 'p7' && f.ruleId === 'sentence-end'); void window.__editor.goToFinding(f) })
    await page.waitForSelector('.tap-bubble', { timeout: 8000 }).catch(() => {})
    const hint = await page.evaluate(() => ({ text: document.querySelector('.tap-bubble')?.textContent ?? '', editing: window.__editor.getSnapshot().editingId }))
    await page.screenshot({ path: `${OUT}/jump-hint.png`, captureBeyondViewport: false })
    check('スマホ：セルフチェックから指摘の箇所へ移って開いた段落に、キーボードが出ていなければ「ここを押して、書きます」', hint.text === 'ここを押して、書きます' && hint.editing === 'p7', JSON.stringify(hint))
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(800)
    await ready()

    // 図を長押ししてから指を動かしても、ページをめくらない。すばやく左へはらえば、めくる
    await goTo(page, ready, 'f3')
    const cdp = await page.createCDPSession()
    const fig = await centerOf(page, '.page-viewport.front figure[data-figure-id="f3"] img')
    const before = await page.evaluate(() => window.__editor.getSnapshot().page)
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    await touch('touchStart', fig.x, fig.y)
    await wait(800)
    for (let k = 1; k <= 6; k++) {
      await touch('touchMove', fig.x - k * 25, fig.y)
      await wait(16)
    }
    await touch('touchEnd')
    await wait(900)
    const afterHold = await page.evaluate(() => window.__editor.getSnapshot().page)
    await page.evaluate(() => window.__editor.selectBlock?.(null))
    await touch('touchStart', 300, 420)
    for (let k = 1; k <= 6; k++) {
      await touch('touchMove', 300 - k * 30, 420)
      await wait(16)
    }
    await touch('touchEnd')
    await wait(1200)
    await ready()
    const afterSwipe = await page.evaluate(() => window.__editor.getSnapshot().page)
    check('スマホ：図を長押ししてから指を左へ動かしても、ページをめくらない。すばやく左へはらうと、次のページへ', afterHold === before && afterSwipe === before + 1, JSON.stringify({ before, afterHold, afterSwipe }))
    await context.close()
  }

  // ---- スマホ：はじめての案内の光の枠は、行の字の全体を囲む ----
  {
    const { context, page } = await open(browser, { phone: true, tourDone: false })
    await page.waitForSelector('.guide.step-course .g-spot', { timeout: 60000 })
    await wait(800)
    const spot = await page.evaluate(() => {
      const s = document.querySelector('.g-spot').getBoundingClientRect()
      const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="basic:course"]')].find((e) => e.getBoundingClientRect().width > 0)
      const range = document.createRange()
      range.selectNodeContents(el.parentElement)
      const line = range.getBoundingClientRect()
      return { spot: [s.left, s.right].map(Math.round), line: [line.left, line.right].map(Math.round), field: [el.getBoundingClientRect().left, el.getBoundingClientRect().right].map(Math.round) }
    })
    await page.screenshot({ path: `${OUT}/guide-course.png`, captureBeyondViewport: false })
    check('スマホ：はじめての案内（コースを選ぶ）の光の枠は、「（コースを選ぶ）コース」の行の字の全体を囲む（隣の「コ」を半分に切らない）', spot.spot[0] <= spot.line[0] && spot.spot[1] >= spot.line[1] && spot.spot[1] >= spot.field[1], JSON.stringify(spot))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
