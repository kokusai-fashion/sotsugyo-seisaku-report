// パソコンで学生が試して見つかったことの直し（2026-10-25）。これだけを流すときは node scripts/e2e/run.mjs pcFixes1025
// - Tab：段落・タイトルでは書く欄から出ない（前は左の道具の「大見出し」に移り、続けて Enter で空の章が増えた）。表のタイトルの Tab は1つ目のマスへ
// - 図・表のタイトルに打った番号（「図１　デザイン画」）は、書き終えると外して知らせる（前は「図1.図1 デザイン画」と二重になった）
// - はじめての案内：氏名・サブタイトルが空のまま進むと「まだ入っていない項目があります」（前は「表紙ができました」）
// - 作品写真の空いた枠の要確認は「このままにする」にできる
// - Word の確認：表紙の学籍番号がログインしたアカウントと違えば赤く出す（偽物の Google でログイン）
// - 図を入れた直後：図が紙面に出るまで、タイトルの欄は見せずに「図を入れています…」（前は欄だけが先に出て、次の行に重なった）
// - 図の「上へ」「下へ」：すぐ上（下）が1枚だけの図なら、その横に並べる
// - パソコン：「（図1）。」の「）」と「。」の間に、右・左のキーで止まれる
// - 図をつかんで運ぶ（パソコン。mockups/v60）
// - パソコンの「拡大」の倍率（mockups/v59 案A）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'
import { fakeDrive, routeGoogle } from './fakeGoogle.mjs'
import { makeDocx, table } from './fixtures/docx.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/pc-fixes-1025'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const config = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))

async function open(browser, { tour = false, width = 1440, height = 900 } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  if (!tour) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  await stubConfig(page)
  await page.setViewport({ width, height })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  return { context, page, ready }
}

/** はじめての案内でコースを選び、「いいえ、ここから書き始める」を押す（学籍番号の段まで） */
async function startGuide(page, ready) {
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide.step-studentId')
  await ready()
}

const snap = (page) => page.evaluate(() => { const s = window.__editor.getSnapshot(); return { editingId: s.editingId, findings: s.findings.map((f) => f.ruleId) } })
const notice = (page) => page.evaluate(() => document.querySelector('.undo-area')?.textContent ?? '')
const editingWait = (page, id) => page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
const goTo = async (page, ready, id) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await wait(500)
  await ready()
}
const clickAt = async (page, selector, dx = null) => {
  const p = await page.evaluate((selector, dx) => {
    const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 0)
    const r = el.getBoundingClientRect()
    return { x: dx === null ? r.left + r.width / 2 : r.left + dx, y: r.top + r.height / 2 }
  }, selector, dx)
  await page.mouse.click(p.x, p.y)
  await wait(500)
}
const selectAll = async (page) => {
  await page.keyboard.down('Control')
  await page.keyboard.press('a')
  await page.keyboard.up('Control')
}

await withEdge(async (browser) => {
  // ---- はじめての案内：氏名・サブタイトルが空のまま Enter で進むと、「まだ入っていない項目があります」。Tab では次へ進まない ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await editingWait(page, 'basic:studentId')
    await page.keyboard.type('24AB001')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-name', { timeout: 20000 })
    await editingWait(page, 'basic:name')
    await page.keyboard.press('Tab')
    await wait(500)
    const afterTab = { step: await page.evaluate(() => document.querySelector('.guide')?.className ?? ''), editing: (await snap(page)).editingId, focus: await page.evaluate(() => document.activeElement?.classList.contains('overlay-editor')) }
    check('案内の氏名の段で Tab を押しても、書く欄にとどまる（次の段へ進まない・道具へ移らない）', afterTab.step.includes('step-name') && afterTab.editing === 'basic:name' && afterTab.focus, JSON.stringify(afterTab))
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-subtitle', { timeout: 20000 })
    await editingWait(page, 'basic:subtitleInput')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-done', { timeout: 20000 })
    await wait(400)
    const done = await page.evaluate(() => ({ h2: document.querySelector('.g-tip h2')?.textContent ?? '', missing: document.querySelector('.g-missing')?.textContent ?? '' }))
    await page.screenshot({ path: `${OUT}/1-guide-missing.png` })
    check(
      '氏名・サブタイトルが空のまま進むと、「表紙ができました」ではなく「まだ入っていない項目があります（氏名・サブタイトルが空です）」と出す',
      done.h2 === 'まだ入っていない項目があります' && done.missing.includes('氏名・サブタイトルが空です'),
      JSON.stringify(done),
    )
    await context.close()
  }

  // ---- 見本の原稿で：Tab・タイトルの番号・作品写真の空いた枠 ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()

    // 段落：Tab では書く欄から出ず、1字下げの知らせ（1回）。続けて Enter を押しても、大見出しは増えない
    await goTo(page, ready, 'p2')
    await clickAt(page, '.page-viewport.front [data-block-id="p2"]', 40)
    await editingWait(page, 'p2')
    await page.keyboard.press('End')
    const chaptersBefore = await page.evaluate(() => window.__editor.getSnapshot().report.body.length)
    await page.keyboard.press('Tab')
    await wait(400)
    const tab1 = { focus: await page.evaluate(() => document.activeElement?.classList.contains('overlay-editor')), editing: (await snap(page)).editingId, notice: await notice(page) }
    await page.screenshot({ path: `${OUT}/2-tab-paragraph.png` })
    check('段落で Tab を押しても、書く欄にとどまり、「1字下げは自動（Tab は押さなくて大丈夫）」と知らせる', tab1.focus && tab1.editing === 'p2' && tab1.notice.includes('Tab は押さなくて大丈夫です'), JSON.stringify(tab1))
    // 画面の下の知らせは、右下の「元に戻す・やり直す」の帯に重ならない（帯のすぐ上。mockups/v55 ① 案A）
    const overBar = await page.evaluate(() => {
      const t = document.querySelector('.undo-toast')?.getBoundingClientRect()
      const b = document.querySelector('.view-bar').getBoundingClientRect()
      return t ? { overlap: t.left < b.right && b.left < t.right && t.top < b.bottom && b.top < t.bottom, gap: Math.round(b.top - t.bottom) } : null
    })
    check('画面の下の知らせは、「元に戻す・やり直す」の帯に重ならず、そのすぐ上に出る', !!overBar && !overBar.overlap && overBar.gap >= 0 && overBar.gap <= 24, JSON.stringify(overBar))
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await wait(1200)
    await ready()
    const after = { chapters: await page.evaluate(() => window.__editor.getSnapshot().report.body.length), editing: (await snap(page)).editingId }
    check('段落で Tab のあとに Enter を押すと、段落が分かれるだけ（空の大見出しは増えない）', after.chapters === chaptersBefore && after.editing !== 'p2', JSON.stringify({ chaptersBefore, after }))
    const kindNow = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return s.report.body.flatMap((c) => c.blocks).find((b) => b.id === s.editingId)?.type })
    check('Enter のあとも、続けて段落を書いている（大見出しを書いていない）', kindNow === 'paragraph', String(kindNow))
    await page.keyboard.press('Escape')
    await wait(600)
    await ready()

    // 表のタイトル：Tab で1つ目のマスへ。打った字はマスに入る
    await goTo(page, ready, 't1')
    // 見本の表は中身のマスが埋まっているので、Tab は中身の行の1つ目へ（見出しの行はとばす。空いたマスがあれば、そこへ：依頼者の選択 2026-10-26）
    const firstCell = await page.evaluate(() => { const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 't1'); return { id: t.rows[1].cells[0].id, text: t.rows[1].cells[0].text } })
    await clickAt(page, '.page-viewport.front .table-caption')
    await editingWait(page, 't1')
    await selectAll(page)
    await page.keyboard.type('使った材料')
    await page.keyboard.press('Tab')
    await wait(500)
    const toCell = (await snap(page)).editingId
    await page.keyboard.type('名')
    await page.keyboard.press('Escape')
    await wait(800)
    await ready()
    const tableNow = await page.evaluate((cellId) => { const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 't1'); return { caption: t.caption, cell: t.rows.flatMap((r) => r.cells).find((c) => c.id === cellId)?.text } }, firstCell.id)
    await page.screenshot({ path: `${OUT}/3-tab-table-caption.png` })
    check(
      '表のタイトルで Tab を押すと、中身の行の1つ目のマスへ進み（見出しの行はとばす）、続けて打った字はマスに入る（タイトルに続けて入らない）',
      toCell === firstCell.id && tableNow.caption === '使った材料' && tableNow.cell === `${firstCell.text}名`,
      JSON.stringify({ toCell, firstCell, tableNow }),
    )

    // 図のタイトル：「図１　デザイン画」と打つと、番号を外して知らせる
    await goTo(page, ready, 'f1')
    await clickAt(page, '.page-viewport.front figure[data-figure-id="f1"] figcaption')
    await editingWait(page, 'f1')
    await selectAll(page)
    await page.keyboard.type('図１　デザイン画')
    await page.keyboard.press('Escape')
    await wait(1000)
    await ready()
    const fig = { caption: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'r1').figures[0].caption), notice: await notice(page), paper: await page.evaluate(() => [...document.querySelectorAll('.page-viewport.front figure[data-figure-id="f1"] figcaption')].find((e) => e.getBoundingClientRect().width > 0)?.textContent ?? '') }
    await page.screenshot({ path: `${OUT}/4-caption-number.png` })
    check(
      '図のタイトルに「図１　デザイン画」と打つと、書き終えたときに番号を外し（紙面は「図1.デザイン画」）、「図の番号は自動で付くので、打った「図１」を外しました」と知らせる',
      fig.caption === 'デザイン画' && fig.notice.includes('打った「図１」を外しました') && !fig.paper.includes('図1.図'),
      JSON.stringify(fig),
    )
    // 表のタイトルも（Enter で書き終える）
    await goTo(page, ready, 't1')
    await clickAt(page, '.page-viewport.front .table-caption')
    await editingWait(page, 't1')
    await selectAll(page)
    await page.keyboard.type('表1. 使用素材表')
    await page.keyboard.press('Enter')
    await wait(1000)
    await ready()
    await page.keyboard.press('Escape')
    await wait(500)
    const tbl = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 't1').caption)
    check('表のタイトルに「表1. 使用素材表」と打って Enter でも、番号を外す', tbl === '使用素材表', tbl)

    // 図・表のタイトルが空のときは、書く欄に薄い字（打ち始めると消える。mockups/v55 ③ 案A）
    const placeholderOf = () => page.evaluate(() => { const e = document.querySelector('.overlay-clip:not([hidden]) .overlay-editor'); return { empty: e?.hasAttribute('data-empty'), ph: e?.dataset.placeholder ?? '', after: e ? getComputedStyle(e, '::after').content : '' } })
    const emptyCaption = {}
    for (const [id, selector] of [['f1', '.page-viewport.front figure[data-figure-id="f1"] figcaption'], ['t1', '.page-viewport.front .table-caption']]) {
      await goTo(page, ready, id)
      await clickAt(page, selector)
      await editingWait(page, id)
      await selectAll(page)
      await page.keyboard.press('Backspace')
      await wait(300)
      const blank = await placeholderOf()
      await page.keyboard.type('名')
      await wait(300)
      const typed = await placeholderOf()
      emptyCaption[id] = { blank, typed }
      await page.keyboard.press('Escape')
      await wait(600)
      await ready()
    }
    check(
      '図・表のタイトルを空にすると、書く欄に「（図のタイトルを入力。例：デザイン画）」「（表のタイトルを入力。例：使用素材表）」の薄い字が出て、打つと消える',
      emptyCaption.f1.blank.empty && emptyCaption.f1.blank.after.includes('図のタイトルを入力') && !emptyCaption.f1.typed.empty && emptyCaption.f1.typed.after === 'none' &&
        emptyCaption.t1.blank.empty && emptyCaption.t1.blank.after.includes('表のタイトルを入力') && !emptyCaption.t1.typed.empty,
      JSON.stringify(emptyCaption),
    )

    // 作品写真：3枚を「4枚」の並べ方に入れると要確認。「このままにする」で消せる
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 4, imageIds: ['g-photo1', 'g-design', 'g-mood'] }] })))
    await wait(600)
    await ready()
    const slot = await page.evaluate(() => {
      const li = [...document.querySelectorAll('.side .issue')].find((e) => e.textContent.includes('空いている枠'))
      return { shown: !!li, keep: !!li?.querySelector('.keep') }
    })
    check('作品写真の「空いている枠がある」（4枚の配置に3枚）に、「このままにする」が出る', slot.shown && slot.keep, JSON.stringify(slot))
    await page.evaluate(() => [...document.querySelectorAll('.side .issue')].find((e) => e.textContent.includes('空いている枠')).querySelector('.keep').click())
    await wait(600)
    const acked = await page.evaluate(() => ({ still: [...document.querySelectorAll('.side .issue')].some((e) => e.textContent.includes('空いている枠')), ack: window.__editor.getSnapshot().report.acknowledged ?? [] }))
    await page.screenshot({ path: `${OUT}/5-photos-keep.png` })
    check('「このままにする」を押すと、空いている枠の要確認は確認済みになる', !acked.still && acked.ack.some((k) => k.startsWith('photos-empty-slot|')), JSON.stringify(acked))
    // 枚数を変えると、また知らせる
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 4, imageIds: ['g-photo1', 'g-design'] }] })))
    await wait(600)
    const again = await page.evaluate(() => [...document.querySelectorAll('.side .issue')].some((e) => e.textContent.includes('空いている枠')))
    check('写真の枚数が変わると、空いている枠の要確認がまた出る', again)
    await context.close()
  }

  // ---- 低い画面・小さい窓（mockups/v55 ② ④ 案A）----
  {
    // 1280×720：作品写真の並べ方のボタンは「1枚・左右・上下・4枚」
    const { context, page, ready } = await open(browser, { width: 1280, height: 720 })
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    const last = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.length - 1)
    await page.evaluate((p) => window.__editor.goToPage(p, 'none'), last)
    await ready()
    await page.evaluate(() => window.__editor.select({ kind: 'photos', page: 0 }))
    await wait(500)
    const labels = await page.evaluate(() => [...document.querySelectorAll('.palette .lay')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
    const wide = await page.evaluate(() => document.querySelector('.stage').classList.contains('narrow'))
    await page.screenshot({ path: `${OUT}/7-layouts-1280.png` })
    check('低い画面（1280×720）の並べ方のボタンは「1枚・左右・上下・4枚」（「2枚」が2つ並ばない）', labels.join(',') === '1枚,左右,上下,4枚', JSON.stringify(labels))
    check('1280×720 では、‹ › は紙面の横のまま（窓が小さいときの形にしない）', !wide)
    // 1100×700 に狭めると：‹ › を右下に移し、紙面を大きくする
    await page.setViewport({ width: 1100, height: 700 })
    await wait(800)
    await page.evaluate(() => window.__editor.goToPage(1, 'none'))
    await ready()
    const narrow = await page.evaluate(() => {
      const stage = document.querySelector('.stage')
      const s = stage.getBoundingClientRect()
      const paper = [...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container]')].find((e) => e.classList.contains('is-current')).getBoundingClientRect()
      const next = document.querySelector('.arrow.next').getBoundingClientRect()
      const bar = document.querySelector('.view-bar').getBoundingClientRect()
      return { narrow: stage.classList.contains('narrow'), paper: Math.round(paper.width), nextRight: Math.round(s.right - next.right), nextAboveBar: next.bottom <= bar.top }
    })
    await page.screenshot({ path: `${OUT}/8-narrow-1100.png` })
    check('窓が小さい（1100×700）ときは、‹ › を右下（「元に戻す」の帯の上）に移し、紙面の幅を 400px 以上にする（前は 266px）', narrow.narrow && narrow.paper >= 400 && narrow.nextRight < 60 && narrow.nextAboveBar, JSON.stringify(narrow))
    // 「拡大」：本文の幅を台に合わせて広げる（前は 412px → 416px で、ほとんど変わらなかった：PC の試し 2026-10-25）
    await page.evaluate(() => window.__editor.setView('zoom'))
    await wait(600)
    await ready()
    const zoomed = await page.evaluate(() => Math.round([...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container]')].find((e) => e.classList.contains('is-current')).getBoundingClientRect().width))
    check('窓が小さい（1100×700）ときも「拡大」で紙面が大きくなる（本文の幅を台に合わせる。紙面の幅 520px 以上）', zoomed >= 520, `${narrow.paper} → ${zoomed}`)
    await context.close()
  }

  // ---- 2回目の試し（2026-10-25）の直し：箇条書き・作品写真・薄い字のカーソル・Shift+Tab・作り直すの確認 ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    const blocksOf = () => page.evaluate(() => window.__editor.getSnapshot().report.body[0].blocks.map((b) => `${b.type[0]}:${b.title ?? (b.content ?? []).map((n) => n.text ?? '').join('')}`.slice(0, 16)))

    // 箇条書き：「1．ミシン」「2．アイロン」「3．ロックミシン」と1行ずつ打つと、見出しにならず段落のまま（前の行も段落に戻す。「。」は付けない）
    await goTo(page, ready, 'p2')
    await clickAt(page, '.page-viewport.front [data-block-id="p2"]', 40)
    await editingWait(page, 'p2')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await wait(300)
    for (const line of ['1．ミシン', '2．アイロン', '3．ロックミシン']) {
      await page.keyboard.type(line)
      await page.keyboard.press('Enter')
      await wait(600)
    }
    const listNotice = await notice(page)
    await page.keyboard.press('Escape')
    await wait(800)
    await ready()
    const list = await blocksOf()
    check(
      '箇条書きのつもりで「1．ミシン」「2．アイロン」「3．ロックミシン」と打つと、小見出しにならず段落のまま（「。」も付かない）。「番号の行が続いたので、見出しにせず箇条書き（段落）にしました」と出る',
      list.includes('p:1．ミシン') && list.includes('p:2．アイロン') && list.includes('p:3．ロックミシン') && !list.some((b) => b.startsWith('s:ミシン')) && listNotice.includes('箇条書き'),
      JSON.stringify({ list, listNotice }),
    )

    // 図のタイトルを空にして開くと、書く欄の中身は幅のない空白だけ（カーソルが番号のすぐ後ろ・薄い字の前に出る）。打った字に空白は入らない
    await goTo(page, ready, 'f1')
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.type === 'figureRow' && b.id === 'r1' ? { ...b, figures: b.figures.map((f) => ({ ...f, caption: '' })) } : b)) })) })))
    await wait(500)
    await ready()
    await clickAt(page, '.page-viewport.front figure[data-figure-id="f1"] figcaption')
    await editingWait(page, 'f1')
    const emptyHtml = await page.evaluate(() => document.querySelector('.overlay-clip:not([hidden]) .overlay-editor').innerHTML)
    await page.keyboard.type('デザイン画')
    await page.keyboard.press('Escape')
    await wait(800)
    await ready()
    const cap = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'r1').figures[0].caption)
    check('空の図のタイトルを開くと、書く欄には幅のない空白だけが入り（カーソルが番号のすぐ後ろに出る）、書き終えたタイトルに空白は入らない', emptyHtml === '​' && cap === 'デザイン画', JSON.stringify({ emptyHtml, cap }))

    // 表の1つ目のマスで Shift+Tab：表のタイトルへ戻る
    await goTo(page, ready, 't1')
    await clickAt(page, '.page-viewport.front .table-caption')
    await editingWait(page, 't1')
    await page.keyboard.press('Tab')
    await wait(400)
    const inCell = (await snap(page)).editingId
    await page.keyboard.down('Shift')
    await page.keyboard.press('Tab')
    await page.keyboard.up('Shift')
    await wait(400)
    const back = (await snap(page)).editingId
    check('表のタイトルから Tab で入った中身の行の1つ目のマスで Shift+Tab を押すと、表のタイトルへ戻る（前は書き終えていた）', inCell === 'm1:name' && back === 't1', JSON.stringify({ inCell, back }))
    await page.keyboard.press('Escape')
    await wait(500)

    // 作品写真：枠の少ない並べ方にすると、あふれた写真を次のページへ移す（隠さない）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 4, columns: 2, imageIds: ['g-photo1', 'g-design', 'g-mood'] }] })))
    await wait(500)
    await ready()
    await page.evaluate(() => window.__editor.setPhotoLayout(0, 2, 2))
    await wait(500)
    const spilled = { pages: await page.evaluate(() => window.__editor.getSnapshot().report.workPhotos.map((p) => `${p.layout}:${p.imageIds.filter(Boolean).length}`).join(',')), notice: await notice(page) }
    check('作品写真を枠の少ない並べ方（3枚→「2枚 左右」）にすると、あふれた1枚を次のページへ移し（ページを足す）、［戻す］つきで知らせる', spilled.pages === '2:2,1:1' && spilled.notice.includes('あふれた写真を次のページへ移しました') && spilled.notice.includes('戻す'), JSON.stringify(spilled))

    // 最初から作り直す：確認の窓が出ている間は、ボタンは「作り直しています…」にならない
    await page.evaluate(() => [...document.querySelectorAll('.side .menu-btn')][0]?.click())
    await page.waitForSelector('.side .head-menu [role="menuitem"]')
    await page.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].find((b) => b.textContent.includes('バックアップ')).click())
    await page.waitForSelector('.start-over-row button')
    await page.evaluate(() => document.querySelector('.start-over-row button').click())
    await page.waitForSelector('#ask-body', { timeout: 10000 })
    const during = await page.evaluate(() => document.querySelector('.start-over-row button').textContent)
    await page.evaluate(() => document.querySelector('[data-confirm="cancel"]').click())
    await wait(300)
    check('「最初から作り直す」の確認が出ている間は、ボタンは「最初から作り直す」のまま（「作り直しています…」にならない）', during.includes('最初から作り直す') && !during.includes('作り直しています'), during)
    await context.close()
  }

  // ---- パソコンの「拡大」の倍率（mockups/v59 案A）：拡大しているときだけ「－ 100% ＋」。1段ずつ変わり、この端末で覚えておく ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    await goTo(page, ready, 'p3')
    const zoomInfo = () => page.evaluate(() => ({ step: document.querySelector('.zoom-step b')?.textContent ?? null, s: Number(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--s')), minus: document.querySelector('.zoom-step button[aria-label="小さく"]')?.disabled ?? null, saved: localStorage.getItem('sotsugyo-seisaku-report-zoom-level') }))
    const fitView = await zoomInfo()
    await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes('拡大')).click())
    await wait(600)
    const z100 = await zoomInfo()
    await page.evaluate(() => document.querySelector('.zoom-step button[aria-label="大きく"]').click())
    await wait(300)
    await page.evaluate(() => document.querySelector('.zoom-step button[aria-label="大きく"]').click())
    await wait(600)
    const z150 = await zoomInfo()
    await page.screenshot({ path: `${OUT}/8b-zoom-150.png` })
    await page.evaluate(() => document.querySelector('.zoom-step button[aria-label="小さく"]').click())
    await wait(300)
    await page.evaluate(() => document.querySelector('.zoom-step button[aria-label="小さく"]').click())
    await wait(600)
    const back = await zoomInfo()
    check(
      '「拡大」していないときは倍率の段は出ず、拡大すると「100%」。「大きく」2回で「150%」（紙面は1.5倍・この端末で覚える）、「小さく」で100%に戻り、それより小さくはできない',
      fitView.step === null && z100.step === '100%' && z150.step === '150%' && Math.abs(z150.s / z100.s - 1.5) < 0.01 && z150.saved === '1.5' && back.step === '100%' && back.minus === true,
      JSON.stringify({ fitView, z100, z150, back }),
    )
    await context.close()
  }

  // ---- 図をつかんで運ぶ（パソコン。mockups/v60）：長押し・置ける所の印と線・置けない所のわけ・離すと動く・ただのクリック・Esc・横に並べる・「›」でめくる ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    const blocksOrder = () => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks.map((b) => b.id)))
    const rectOf = (sel) => page.evaluate((sel) => { const r = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).find((x) => x.width > 0); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null }, sel)
    const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
    const overlay = () => page.evaluate(() => ({ ghost: !!document.querySelector('.fd-ghost'), dim: !!document.querySelector('.fd-dim'), ticks: document.querySelectorAll('.fd-tick').length, line: document.querySelector('.fd-line .fd-label')?.textContent ?? null, vline: document.querySelector('.fd-vline.on .fd-label')?.textContent ?? null, tip: document.querySelector('.fd-tip')?.textContent ?? '' }))
    await goTo(page, ready, 'p8')
    // 1. 図3（袖の刺繍）を押したまま待つと、つかめる
    const img = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    await page.mouse.move(img.x, img.y)
    await page.mouse.down()
    await wait(650)
    const held = await overlay()
    // 2. 段落 p10 の下へ → 「ここに置く」の線
    const p10 = await rectOf(`${CUR} [data-block-id="p10"]`)
    await page.mouse.move(img.x, p10.bottom + 4, { steps: 8 })
    await wait(150)
    const near = await overlay()
    // 3. （図3）がある段落 p8 より上 → わけ（線は出さない）
    const p8 = await rectOf(`${CUR} [data-block-id="p8"]`)
    await page.mouse.move(img.x, p8.top - 10, { steps: 8 })
    await wait(150)
    const above = await overlay()
    // 4. 段落 p10 の下で離す → 図が動く
    await page.mouse.move(img.x, p10.bottom + 4, { steps: 8 })
    await wait(150)
    await page.mouse.up()
    await wait(700)
    await ready()
    const after = await blocksOrder()
    const moved = { order: after.slice(after.indexOf('p8'), after.indexOf('p8') + 5), selected: await page.evaluate(() => window.__editor.getSnapshot().selection?.id), gone: !(await overlay()).ghost }
    await page.screenshot({ path: `${OUT}/7-drag.png` })
    check(
      '図を押したまま待つとつかめ（写し・元の所の枠・置ける所の印）、段落の下では「ここに置く」、（図3）の段落より上では線を出さずにわけを出し、離すとその所へ動く（図は選んだまま）',
      held.ghost && held.dim && held.ticks >= 1 && near.line === 'ここに置く' && above.line === null && above.tip.includes('（図3）」がある段落より上には置けません') &&
        JSON.stringify(moved.order) === JSON.stringify(['p8', 'p9', 'p10', 'r3', 's6']) && moved.selected === 'f3' && moved.gone,
      JSON.stringify({ held, near, above, moved }),
    )
    // 5. ただ押して離す（クリック）と、今までどおり図を選ぶだけ（動かない）。押したまま動かすと、待たずにつかむ。Esc でやめる
    await page.evaluate(() => window.__editor.select(null))
    const img2 = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    await page.mouse.click(img2.x, img2.y)
    await wait(300)
    const clicked = { selected: await page.evaluate(() => window.__editor.getSnapshot().selection?.id), same: JSON.stringify(await blocksOrder()) === JSON.stringify(after), ghost: (await overlay()).ghost }
    await page.mouse.move(img2.x, img2.y)
    await page.mouse.down()
    await page.mouse.move(img2.x + 30, img2.y + 30, { steps: 4 })
    await wait(100)
    const quick = (await overlay()).ghost
    await page.keyboard.press('Escape')
    await wait(150)
    const escaped = (await overlay()).ghost
    await page.mouse.up()
    await wait(300)
    check(
      'ただクリックすると図を選ぶだけ（動かない・つかまない）。押したまま動かすと待たずにつかみ、Esc でやめると動かない',
      clicked.selected === 'f3' && clicked.same && !clicked.ghost && quick && !escaped && JSON.stringify(await blocksOrder()) === JSON.stringify(after),
      JSON.stringify({ clicked, quick, escaped }),
    )
    // 6. 1枚だけの図の横へ運ぶと「横に並べる」→ 離すと横に並ぶ。2章を「袖の刺繍」だけにし（図2枚が同じページに入るように）、
    //    段落 p8 にもう1枚の図のことを書いて、図3（p8 の下）・p9・もう1枚の図・p10 の順にする
    await page.evaluate(() =>
      window.__editor.update((r) => ({
        ...r,
        body: r.body.map((c) => {
          if (!c.blocks.some((b) => b.id === 'p8')) return c
          const get = (id) => c.blocks.find((b) => b.id === id)
          const p8 = get('p8')
          const r3 = get('r3')
          return {
            ...c,
            blocks: [
              get('s5'),
              { ...p8, content: [...p8.content, { type: 'text', text: '並べる図も示す' }, { type: 'ref', targetId: 'f-x', withParens: true }, { type: 'text', text: '。' }] },
              r3,
              get('p9'),
              { type: 'figureRow', id: 'r-x', figures: [{ id: 'f-x', imageId: r3.figures[0].imageId, caption: '並べる図' }] },
              get('p10'),
            ],
          }
        }),
      })),
    )
    await wait(500)
    await ready()
    await goTo(page, ready, 'f3')
    const fx = await rectOf(`${CUR} figure[data-figure-id="f-x"] img`)
    const f3 = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    let joined = null
    if (fx && f3) {
      await page.mouse.move(fx.x, fx.y)
      await page.mouse.down()
      await wait(600)
      await page.mouse.move(f3.right - 10, f3.y, { steps: 10 })
      await wait(150)
      const beside = await overlay()
      await page.mouse.up()
      await wait(700)
      await ready()
      joined = { beside: beside.vline, rows: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'figureRow' && b.figures.some((f) => f.id === 'f-x')).map((b) => b.figures.map((f) => f.id))) }
    }
    check('1枚だけの図の右へ運ぶと「横に並べる」が出て、離すと横に並ぶ（並びは本文で出てくる順）', !!joined && joined.beside === '横に並べる' && JSON.stringify(joined.rows) === JSON.stringify([['f3', 'f-x']]), JSON.stringify({ joined, fx: !!fx, f3: !!f3 }))
    // 7. 「›」の上で待つと、つかんだままめくれる（小見出しのまとまりが次のページまで続くよう、段落を足す）
    await page.evaluate(() =>
      window.__editor.update((r) => ({
        ...r,
        body: r.body.map((c) => {
          const i = c.blocks.findIndex((b) => b.id === 'p10')
          if (i < 0) return c
          const blocks = [...c.blocks]
          const long = '刺繍の糸は、照明の下での見え方を比べて選んだ。金の糸は光りすぎると波の形がつぶれて見えるため、つやを抑えたものと強いものを交互に使い、波の重なりが分かるようにした。'
          blocks.splice(i + 1, 0, ...['pa', 'pb', 'pc', 'pd', 'pe', 'pf', 'pg', 'ph'].map((id) => ({ type: 'paragraph', id, content: [{ type: 'text', text: long }] })))
          return { ...c, blocks }
        }),
      })),
    )
    await wait(500)
    await ready()
    await goTo(page, ready, 'f3')
    const startPage = await page.evaluate(() => window.__editor.getSnapshot().page)
    const lastPage = await page.evaluate(() => window.__editor.pageOfBlock('ph'))
    const f3b = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    const next = await rectOf('.stage .arrow.next')
    await page.mouse.move(f3b.x, f3b.y)
    await page.mouse.down()
    await wait(600)
    await page.mouse.move(next.x, next.y, { steps: 10 })
    await wait(250)
    const hint = await overlay()
    await wait(1400)
    await ready().catch(() => {})
    const turned = { page: await page.evaluate(() => window.__editor.getSnapshot().page), ghost: (await overlay()).ghost }
    const ph = await rectOf(`${CUR} [data-block-id="ph"]`)
    if (ph) await page.mouse.move(ph.x, ph.bottom + 3, { steps: 10 })
    await wait(200)
    const there = await overlay()
    await page.mouse.up()
    await wait(800)
    await ready()
    const final = await blocksOrder()
    check(
      '「›」の上で待つと「ここで少し待つと、次のページへ」と出て、つかんだまま次のページへめくれ、そこで離すとそのページの所へ動く',
      lastPage > startPage && hint.tip.includes('次のページへ') && turned.page === startPage + 1 && turned.ghost && !!ph && there.line === 'ここに置く' && final.indexOf('r3') === final.indexOf('ph') + 1,
      JSON.stringify({ startPage, lastPage, hint: hint.tip, turned, there, at: final.slice(final.indexOf('ph') - 1, final.indexOf('ph') + 3) }),
    )
    await context.close()
  }

  // ---- 3回目の試し（2026-10-26）の直し：つかんで運ぶ（ゆっくり押す・紙面の外・Esc・「動かしました［戻す］」）・表のタイトルから空いたマスへ・書いている欄の指摘・わけの番号 ----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
    const rectOf = (sel) => page.evaluate((sel) => { const r = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).find((x) => x.width > 0); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null }, sel)
    const order = () => page.evaluate(() => JSON.stringify(window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks.map((b) => b.id))))
    await goTo(page, ready, 'p8')
    const before = await order()
    // ゆっくり押して（0.65秒）、動かさずに離す（写真の下の方）→ 動かない
    let img = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    await page.mouse.move(img.x, img.bottom - 12)
    await page.mouse.down()
    await wait(650)
    await page.mouse.move(img.x + 4, img.bottom - 6, { steps: 2 })
    await wait(100)
    const slowLine = await page.evaluate(() => document.querySelector('.fd-line .fd-label')?.textContent ?? null)
    await page.mouse.up()
    await wait(600)
    await ready()
    const slow = { same: (await order()) === before, slowLine }
    // つかんで右の欄まで運んで離す → 動かない（「ここで離すと、やめます」）
    img = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    const side = await rectOf('.side')
    await page.mouse.move(img.x, img.y)
    await page.mouse.down()
    await wait(600)
    await page.mouse.move(side.x, img.y, { steps: 10 })
    await wait(150)
    const outTip = await page.evaluate(() => document.querySelector('.fd-tip')?.textContent ?? '')
    await page.mouse.up()
    await wait(600)
    await ready()
    const outside = { same: (await order()) === before, outTip }
    // つかんで段落の上へ運び、Esc でやめてから離す → 段落は書く状態にならない
    img = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    const p9 = await rectOf(`${CUR} [data-block-id="p9"]`)
    await page.mouse.move(img.x, img.y)
    await page.mouse.down()
    await wait(600)
    await page.mouse.move(p9.x, p9.y, { steps: 8 })
    await wait(100)
    await page.keyboard.press('Escape')
    await wait(100)
    await page.mouse.up()
    await wait(500)
    const esc = { editing: await page.evaluate(() => window.__editor.getSnapshot().editingId), same: (await order()) === before }
    // 運んで離すと「図を動かしました［戻す］」
    img = await rectOf(`${CUR} figure[data-figure-id="f3"] img`)
    const p10 = await rectOf(`${CUR} [data-block-id="p10"]`)
    await page.mouse.move(img.x, img.y)
    await page.mouse.down()
    await wait(600)
    await page.mouse.move(img.x, p10.bottom + 4, { steps: 10 })
    await wait(150)
    await page.mouse.up()
    await wait(700)
    await ready()
    const moved = { changed: (await order()) !== before, toast: await notice(page) }
    check(
      'つかんで運ぶ：ゆっくり押して離しても、図の上なら動かない（「元の所」）。紙面の外で離すと「ここで離すと、やめます」で動かない。Esc でやめて離しても段落は開かない。運ぶと「図を動かしました［戻す］」',
      slow.same && slow.slowLine === '元の所' && outside.same && outside.outTip.includes('ここで離すと、やめます') && esc.editing === null && esc.same && moved.changed && moved.toast.includes('図を動かしました') && moved.toast.includes('戻す'),
      JSON.stringify({ slow, outside, esc, moved }),
    )
    // 素材表：仮のタイトルは選んだ状態で開く（打つと置き換わる）。Enter で、空いている最初のマス（見出しの行はとばす）へ
    await goTo(page, ready, 'p2')
    await clickAt(page, `${CUR} [data-block-id="p2"]`, 40)
    await editingWait(page, 'p2')
    await page.evaluate(() => window.__editor.addTable('material'))
    await page.waitForFunction(() => /^t-/.test(window.__editor.getSnapshot().editingId ?? '') || window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 20000 })
    await wait(600)
    const tableId = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    await page.keyboard.type('主要素材')
    await page.keyboard.press('Enter')
    await wait(600)
    const tbl = await page.evaluate((tableId) => {
      const s = window.__editor.getSnapshot()
      const t = s.report.body.flatMap((c) => c.blocks).find((b) => b.id === tableId)
      return { caption: t?.caption, editing: s.editingId, firstBody: t?.rows[1]?.cells[0]?.id, kind: s.editingKind }
    }, tableId)
    check('素材表を入れてすぐ打つと仮のタイトルが置き換わり（「主要素材」）、Enter で空いている最初のマス（見出しの行の次）へ進む', tbl.caption === '主要素材' && tbl.kind === 'tableCell' && tbl.editing === tbl.firstBody, JSON.stringify(tbl))
    await page.keyboard.press('Escape')
    await wait(400)
    await ready()
    // 書いている欄の指摘は、書き終えるまで出さない（入れたばかりの空の図のタイトル）
    await goTo(page, ready, 'p8')
    await clickAt(page, `${CUR} [data-block-id="p8"]`, 40)
    await editingWait(page, 'p8')
    const btn = await page.evaluate(() => { const r = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('図を入れる')).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    void btn
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => void window.__editor.addFigure())])
    await chooser.accept([join(process.cwd(), 'docs', 'guide-images', 'sample', 'design.jpg')])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-') && !document.querySelector('.overlay-clip.waiting'), { timeout: 30000 })
    await ready()
    await wait(300)
    const newFig = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    const whileEditing = await page.evaluate((id) => window.__editor.getSnapshot().findings.filter((f) => f.blockId === id).map((f) => f.ruleId), newFig)
    await page.keyboard.press('Escape')
    await wait(500)
    await ready()
    const afterEditing = await page.evaluate((id) => window.__editor.getSnapshot().findings.filter((f) => f.blockId === id).map((f) => f.ruleId), newFig)
    check('入れたばかりの図のタイトルを書いている間は、その欄の指摘（タイトルが入力されていない）を出さず、書き終えると出る', whileEditing.length === 0 && afterEditing.includes('required-text'), JSON.stringify({ whileEditing, afterEditing }))
    // 「。」で終わる段落の終わりに打ち足す：書いている間は「文末に「。」」を出さず、書き終えると出る
    await goTo(page, ready, 'p7')
    await clickAt(page, `${CUR} [data-block-id="p7"]`, 40)
    await editingWait(page, 'p7')
    await page.keyboard.down('Control')
    await page.keyboard.press('End')
    await page.keyboard.up('Control')
    await page.keyboard.type('さらに')
    await wait(500)
    const endWhile = await page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'p7').map((f) => f.ruleId))
    await page.keyboard.press('Escape')
    await wait(500)
    await ready()
    const endAfter = await page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'p7').map((f) => f.ruleId))
    check('「。」で終わる段落に打ち足している間は「文末に「。」」を出さず、書き終えると出る', !endWhile.includes('sentence-end') && endAfter.includes('sentence-end'), JSON.stringify({ endWhile, endAfter }))
    // もとからある指摘は、書いている間も出す（直しに来たとき、右の一覧で目立つ）
    await clickAt(page, `${CUR} [data-block-id="p7"]`, 40)
    await editingWait(page, 'p7')
    await wait(400)
    const endReopen = await page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'p7').map((f) => f.ruleId))
    check('もとから「文末に「。」」がない段落を開くと、書いている間もその指摘を出す', endReopen.includes('sentence-end'), JSON.stringify(endReopen))
    await page.keyboard.press('Escape')
    await wait(400)
    await page.evaluate(() => window.__editor.undo())
    await ready()
    // 「上へ」が押せないわけは、実際の番号で（図1 のすぐ上は（図1）の段落）
    await goTo(page, ready, 'f1')
    await clickAt(page, `${CUR} figure[data-figure-id="f1"] img`)
    await page.waitForFunction(() => window.__editor.getSnapshot().selection?.id === 'f1', { timeout: 10000 })
    const upTitle = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('上へ'))?.title ?? '')
    const hint = await page.evaluate(() => document.querySelector('.palette .fig-drag-note')?.textContent ?? '')
    check('図の「上へ」が押せないわけは「（図1）」と実際の番号で書き、図の道具に「長押しで運べます」', upTitle.includes('（図1）') && hint.includes('長押しで') && hint.includes('運べます'), JSON.stringify({ upTitle, hint }))
    await context.close()
  }

  // ---- パソコン：「（図1）。」の「）」と「。」の間に、右・左のキーで止まれる（前は「）」の前から右で「。」の後ろへ飛んだ：依頼者の指摘 2026-10-25）----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    await goTo(page, ready, 'p3')
    await page.evaluate(() => window.__editor.openWhenReady('p3', 0))
    await editingWait(page, 'p3')
    await wait(600)
    const refAt = await page.evaluate(() => window.__editor.overlay.text.indexOf('（図1）'))
    const caretOf = () => page.evaluate(() => ({ at: window.__editor.overlay.selectionOffsets().start, inText: getSelection().anchorNode?.nodeType === Node.TEXT_NODE }))
    // 「1」の後ろ（「）」の前）から右 → 「）」と「。」の間。もう1つ右（「。」の後ろ）から左 → 同じ所
    await page.evaluate((at) => window.__editor.overlay.setCaret(at), refAt + 3)
    await wait(150)
    await page.keyboard.press('ArrowRight')
    await wait(150)
    const right = await caretOf()
    await page.keyboard.press('ArrowRight')
    await wait(150)
    await page.keyboard.press('ArrowLeft')
    await wait(150)
    const left = await caretOf()
    // そこで打つと、「）」と「。」の間に入る
    await page.keyboard.type('★')
    await wait(300)
    const typed = await page.evaluate(() => { const t = window.__editor.overlay.text; const i = t.indexOf('★'); return i < 0 ? '' : t.slice(i - 4, i + 2) })
    check(
      'パソコン：「（図1）。」で、「）」の前から右のキーで「）」と「。」の間に止まり、「。」の後ろから左でも同じ所に止まる。そこで打つと「（図1）★。」',
      refAt >= 0 && right.at === refAt + 4 && right.inText && left.at === refAt + 4 && typed === '（図1）★。',
      JSON.stringify({ refAt, right, left, typed }),
    )
    await context.close()
  }

  // ---- 図の「上へ」「下へ」：すぐ上（下）が1枚だけの図なら、その横に並べる（依頼者の要望 2026-10-25。前は止まり、「横に並べる」を別に押した）----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    // 見本の最初の図のすぐ下に、もう1枚の図（同じ写真）を1枚だけの段で置き、その図のことを同じ段落の終わりに書く
    const first = await page.evaluate(() => {
      let found = null
      window.__editor.update((r) => ({
        ...r,
        body: r.body.map((c) => {
          const i = c.blocks.findIndex((b) => b.type === 'figureRow' && b.figures.length === 1)
          if (found || i < 0) return c
          const row = c.blocks[i]
          const para = c.blocks.findLastIndex((b, k) => k < i && b.type === 'paragraph')
          found = row.figures[0].id
          const blocks = [...c.blocks]
          blocks.splice(i + 1, 0, { type: 'figureRow', id: 'r-join', figures: [{ id: 'f-join', imageId: row.figures[0].imageId, caption: '並べる図' }] })
          blocks[para] = { ...blocks[para], content: [...blocks[para].content, { type: 'text', text: '並べた図も示す' }, { type: 'ref', targetId: 'f-join', withParens: true }, { type: 'text', text: '。' }] }
          return { ...c, blocks }
        }),
      }))
      return found
    })
    await wait(500)
    await ready()
    await goTo(page, ready, 'f-join')
    await clickAt(page, '.page-viewport.front figure[data-figure-id="f-join"] img')
    await page.waitForFunction(() => window.__editor.getSnapshot().selection?.id === 'f-join', { timeout: 10000 })
    const upTitle = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('上へ'))?.title ?? '')
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('上へ')).click())
    await wait(600)
    await ready()
    const joined = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'figureRow' && b.figures.some((f) => f.id === 'f-join')).map((b) => b.figures.map((f) => f.id)))
    await page.screenshot({ path: `${OUT}/8-figure-up-join.png` })
    check(
      '1枚だけの図のすぐ上も1枚だけの図なら、「上へ」は「上の図の横に並べる」になり、押すと横に並ぶ（並びは本文で出てくる順）',
      upTitle.includes('上の図の横に並べる') && JSON.stringify(joined) === JSON.stringify([[first, 'f-join']]),
      JSON.stringify({ upTitle, joined, first }),
    )
    await context.close()
  }

  // ---- 図を入れた直後：図が紙面に出るまで、タイトルの欄は見せず（打った字は入る）、画面の下に「図を入れています…」（mockups/v58 案B）----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    await goTo(page, ready, 'p2')
    await clickAt(page, '.page-viewport.front [data-block-id="p2"]', 40)
    await editingWait(page, 'p2')
    // 図が紙面に出るまでのようすを、描くたびに記録する（タイトルを書いているか・欄を見せていないか・図が紙面にあるか・画面の下の知らせ）
    await page.evaluate(() => {
      window.__waitLog = []
      const tick = () => {
        const s = window.__editor.getSnapshot()
        const caption = !!s.editingId?.startsWith('f-')
        const clip = [...document.querySelectorAll('.overlay-clip')].find((c) => !c.hidden && !c.classList.contains('overlay-frozen'))
        window.__waitLog.push({
          caption,
          waiting: !!clip?.classList.contains('waiting'),
          onPaper: caption && !!document.querySelector(`.page-viewport.front figure[data-figure-id="${s.editingId}"]`),
          toast: document.querySelector('.undo-area')?.textContent ?? '',
          // 左の道具が、図の道具（差し替え・上へ・下へ…）に替わっているか
          figureTools: !!document.querySelector('.palette.compact'),
          // 「図・表は、入れたい所をクリックしてから押します」の一言（写真を取り込む間も出さない）
          hint: !!document.querySelector('.palette .ctx-note:not(.fig-drag-note)'),
        })
        if (window.__waitLog.length < 900) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const btn = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('図を入れる')).getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.mouse.click(btn.x, btn.y)])
    await chooser.accept([join(process.cwd(), 'docs', 'guide-images', 'sample', 'design.jpg')])
    // 待つ間に打った字も入る
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 20000 })
    await page.keyboard.type('デザイン画')
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-') && !document.querySelector('.overlay-clip.waiting'), { timeout: 30000 })
    await ready()
    await wait(300)
    const log = await page.evaluate(() => window.__waitLog)
    const before = log.filter((x) => x.caption && !x.onPaper)
    const after = log.filter((x) => x.caption && x.onPaper).at(-1)
    const typed = await page.evaluate(() => document.querySelector('.overlay-clip:not([hidden]) .overlay-editor')?.innerText.replaceAll('​', '') ?? '')
    await page.screenshot({ path: `${OUT}/9-figure-waiting.png` })
    check(
      '図を入れた直後、図が紙面に出るまでは、タイトルの欄を見せず、左の道具も図の道具に替えず、画面の下に「図を入れています…」を出す',
      before.length > 0 && before.every((x) => x.waiting && !x.figureTools) && before.some((x) => x.toast.includes('図を入れています…')) && !log.some((x) => x.hint),
      JSON.stringify({ frames: before.length, shown: before.filter((x) => !x.waiting).length, tools: before.filter((x) => x.figureTools).length, hint: log.filter((x) => x.hint).length, toast: before.at(-1)?.toast }),
    )
    check(
      '図が紙面に出たら、タイトルの欄と図の道具を見せ、「図を入れています…」は消える。待つ間に打った字も欄に入っている',
      !!after && !after.waiting && after.figureTools && !after.toast.includes('図を入れています') && typed === 'デザイン画',
      JSON.stringify({ after, typed }),
    )
    await context.close()
  }

  // ---- 画面の案内（指差し確認）の間の Ctrl+S：ブラウザの保存の画面を出さない ----
  {
    const { context, page, ready } = await open(browser, { tour: true })
    await startGuide(page, ready)
    // はじめての案内を最後まで進めて「本文へ進む」を押すと、画面の案内が始まる（「あとで」では始まらない）
    await editingWait(page, 'basic:studentId')
    await page.keyboard.type('24AB001')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-name', { timeout: 20000 })
    await editingWait(page, 'basic:name')
    await page.keyboard.type('文化　花子')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-subtitle', { timeout: 20000 })
    await editingWait(page, 'basic:subtitleInput')
    await page.keyboard.type('シンドバッド')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-done .g-actions .primary', { timeout: 20000 })
    await page.evaluate(() => document.querySelector('.guide.step-done .g-actions .primary').click())
    await page.waitForSelector('.tour .tour-tip', { timeout: 20000 }).catch(() => {})
    const tourOn = !!(await page.$('.tour .tour-tip'))
    const prevented = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    })
    check('画面の案内（指差し確認）の間に Ctrl+S を押しても、ブラウザの保存の画面を出さない', tourOn && prevented, JSON.stringify({ tourOn, prevented }))
    await context.close()
  }

  // ---- iPhone の Safari のまね（ことばの切れ目で折り返す CSS がない）：画面の文に、ことばの切れ目の幅のない空白が入る ----
  {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.evaluateOnNewDocument(() => {
      const supports = CSS.supports.bind(CSS)
      CSS.supports = (a, b) => (String(a).includes('auto-phrase') || String(b).includes('auto-phrase') ? false : b === undefined ? supports(a) : supports(a, b))
    })
    await stubConfig(page)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await wait(1500)
    const phrased = await page.evaluate(() => {
      const p = document.querySelector('.g-tip p')
      return { zwsp: (p?.textContent ?? '').includes('​'), wordBreak: getComputedStyle(p).wordBreak }
    })
    check('ことばの切れ目で折り返す CSS がないブラウザ（iPhone の Safari のまね）では、案内の文のことばの切れ目に幅のない空白が入る（BudouX）', phrased.zwsp, JSON.stringify(phrased))
    await context.close()
  }

  // ---- スマホ：Word の確認の窓の「やめる／読み込む」の段は、窓の下に止まる ----
  {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await stubConfig(page)
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.yes')
    await page.evaluate(() => document.querySelector('.g-word-opt.yes').click())
    await page.waitForSelector('.modal.word-mid')
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[0].click())])
    await chooser.accept(['scripts/e2e/fixtures/word-sample-body.docx'])
    await wait(300)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる')).click())
    await page.waitForSelector('.modal.word-modal', { timeout: 60000 })
    await wait(500)
    const sticky = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.modal.word-modal .row-buttons')].at(-1)
      const b = [...row.querySelectorAll('button')].find((x) => x.textContent.includes('読み込む')).getBoundingClientRect()
      return { position: getComputedStyle(row).position, visible: b.bottom <= innerHeight && b.top >= 0, bottom: Math.round(b.bottom), h: innerHeight }
    })
    await page.screenshot({ path: `${OUT}/9-phone-word-confirm.png` })
    check('スマホ：Word の確認の窓の「読み込む」の段は窓の下に止まり、下までずらさなくても見える（前は止まらなかった）', sticky.position === 'sticky' && sticky.visible, JSON.stringify(sticky))
    await context.close()
  }

  // ---- Word の確認：表紙の学籍番号が、ログインしたアカウントと違えば赤く出す ----
  {
    const drive = fakeDrive('00zz901@bunka-wu.ac.jp')
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await answerConfirms(page, () => true)
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done') } catch {} })
    await page.setViewport({ width: 1440, height: 900 })
    await routeGoogle(page, drive, config)
    await page.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 90000 })
    await page.waitForSelector('.login-over .login-btn', { timeout: 60000 })
    await page.waitForFunction(() => window.__editor?.getSnapshot()?.layout && !window.__editor.getSnapshot().rendering, { timeout: 90000 })
    await page.click('.login-btn')
    await page.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 60000 })
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.yes')
    await page.evaluate(() => document.querySelector('.g-word-opt.yes').click())
    await page.waitForSelector('.modal.word-mid')
    const coverDocx = join(tmpdir(), '卒制_表紙_学籍番号違い.docx')
    const course = config.courses.find((c) => !c.hidden)
    writeFileSync(
      coverDocx,
      makeDocx({
        body: table([
          ['２０２６年度'],
          ['卒 業 研 究'],
          ['', course.name, 'コース'],
          ['', '学籍番号　', '00ZZ0123'],
          ['', '氏　　名', '：', '文化　花子'],
        ]),
      }),
    )
    const choose = async (row, path) => {
      const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate((row) => document.querySelectorAll('.word-file .acts button:not(.link)')[row].click(), row)])
      await chooser.accept([path])
      await wait(200)
    }
    await choose(0, 'scripts/e2e/fixtures/word-sample-body.docx')
    await choose(1, coverDocx)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる')).click())
    await page.waitForSelector('.modal.word-modal, .word-error', { timeout: 60000 })
    await wait(300)
    const row = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.word-cover > div')].find((x) => x.querySelector('dt')?.textContent === '学籍番号')
      return { dd: d?.querySelector('dd')?.textContent ?? '', ng: !!d?.querySelector('dd')?.classList.contains('ng'), error: document.querySelector('.word-error')?.textContent ?? '' }
    })
    await page.screenshot({ path: `${OUT}/6-word-id-mismatch.png` })
    check(
      'Word の確認：表紙の学籍番号（00ZZ0123）がログインしたアカウント（00ZZ901）と違えば、赤く出して「ログインしたアカウントは 00ZZ901」と添える',
      row.ng && row.dd.includes('00ZZ0123') && row.dd.includes('ログインしたアカウントは 00ZZ901'),
      JSON.stringify(row),
    )
    // 読み込むと、すぐに「学籍番号を直す」の窓が出る（Word 用の文）。直すと、アカウントの学籍番号になる（依頼者の選択 2026-10-25）
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('読み込む')).click())
    await page.waitForSelector('.id-choices', { timeout: 30000 }).catch(() => {})
    const dialog = await page.evaluate(() => ({ text: document.querySelector('.id-compare')?.textContent ?? '', notMine: [...document.querySelectorAll('.id-choices button')].some((b) => b.textContent.includes('自分の原稿ではない')) }))
    await page.screenshot({ path: `${OUT}/6b-word-id-dialog.png` })
    await page.evaluate(() => [...document.querySelectorAll('.id-choices button')].find((b) => b.textContent.includes('に直す'))?.click())
    await wait(500)
    const fixedId = await page.evaluate(() => window.__editor.getSnapshot().report.basicInfo.studentId)
    check(
      'Word を読み込むと、すぐに「Word の表紙の学籍番号」とアカウントの違いの窓が出て（「自分の原稿ではない」はない）、「学籍番号を 00ZZ901 に直す」で直る',
      dialog.text.includes('Word の表紙の学籍番号') && !dialog.notMine && fixedId === '00ZZ901',
      JSON.stringify({ dialog, fixedId }),
    )
    await context.close()
  }

  // ---- 改ページ・章の終わりの直前の図は、下の空きに合わせて自動で大きくする（mockups/v61・v62 案B。依頼者の選択 2026-10-26）----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    // 依頼者の画面と同じ形：小見出し・段落・段落（図1を指す）・図・改ページ（mockups/v61 と同じ文）
    const body = (figures, extra = '') => {
      const t = (text) => ({ type: 'text', text })
      const ref = (targetId) => ({ type: 'ref', targetId, withParens: true })
      const p = (id, ...content) => ({ type: 'paragraph', id, content: content.map((c) => (typeof c === 'string' ? t(c) : c)) })
      return [
        {
          id: 'c1',
          title: '企画・立案',
          blocks: [
            { type: 'subheading', id: 's1', title: '担当衣装のキャラクター' },
            p('p1', '筆者が担当したのは、物語の主人公である船乗りシンドバッドの衣装である。シンドバッドは七つの航海を経て成長していく人物であり、場面ごとに異なる表情を見せる。本制作では、旅立ちの場面の若々しさと、帰還の場面の頼もしさの両方を、一着の衣装で表すことを目標とした。'),
            { type: 'subheading', id: 's2', title: 'デザイン説明' },
            p('p3', '中東の伝統的な装いをもとに、航海の力強さと冒険心を表すデザインを考えた', ref('f1'), ...(figures.length > 1 ? ['。完成した姿は', ref('f2'), 'のとおりである'] : []), `。キーワードは自由、勇気、海である。袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。配色は海の青と砂の金を軸とし、ズボンには生成りを合わせて全体を軽く見せた。${extra}`),
            { type: 'figureRow', id: 'r1', figures: figures.map(([id, imageId, caption]) => ({ id, imageId, caption })) },
            { type: 'pageBreak', id: 'pb1' },
            { type: 'subheading', id: 's3', title: '使用素材' },
            p('p5', '使用した素材は、次の表のとおりである。'),
          ],
        },
        { id: 'c2', title: '制作過程', blocks: [p('p6', 'デザイン画をもとにパターンを引き、シーチングで仮縫いをした。')] },
      ]
    }
    // 図の大きさ（mm）・図のまとまりのページと下端・段落 p3 の終わりのページ
    const figs = () =>
      page.evaluate(() => {
        const ed = window.__editor
        const imgs = [...document.querySelectorAll('.page-viewport.front figure[data-figure-id] img')].filter((i) => i.closest('[data-group-id="r1"]'))
        const group = document.querySelector('.page-viewport.front [data-group-id="r1"]')
        const pageEl = group?.closest('[data-vivliostyle-page-container]')
        const pr = pageEl?.getBoundingClientRect()
        return {
          sizes: imgs.map((i) => [parseFloat(i.style.width), parseFloat(i.style.height)]),
          groupPage: ed.pageOfBlock('f1'),
          textPage: ed.pageOfBlock('p3'),
          bottom: pr ? Math.round(((group.getBoundingClientRect().bottom - pr.top) / pr.height) * 297) : null,
        }
      })
    const setBody = async (b) => {
      await page.evaluate((b) => window.__editor.update((r) => ({ ...r, body: b })), b)
      await wait(800)
      await ready()
      await goTo(page, ready, 'p3')
    }
    await setBody(body([['f1', 'g-design', 'デザイン画']]))
    const tall = await figs()
    check('改ページの直前の縦長の図（ふだんは 6×8cm）は、下の空きに合わせて縦12cm（1.5倍）まで大きくなる', tall.sizes.length === 1 && tall.sizes[0][1] === 120 && tall.sizes[0][0] === 90 && tall.groupPage === tall.textPage, JSON.stringify(tall))
    // 上に文を書き足すと、空いた分まで小さくなる（ふだんの大きさより小さくはならない）。図は同じページのまま
    await setBody(body([['f1', 'g-design', 'デザイン画']], 'シルエットは、上半身に大きな量感を持たせ、足元に向かって細くなる形とした。両腕を広げた姿が、客席から大きく見えるようにするためである。袖には波の模様を金の糸で刺繍し、照明の下で光るようにした。帯の端には房を付け、歩くたびに揺れるようにした。帯の結び目は大きくしすぎないよう、何度も結び直して形を決めた。ズボンの裾にはゴムを入れ、動きやすさを保った。仮縫いでは、演者に実際に動いてもらい、袖の膨らみが動きの邪魔にならないかを確かめた。腕を大きく振っても肩が引きつれないよう、袖山の高さを少しずつ下げて調整した。最後に、照明の下で色の見え方を確かめ、帯の金の色味を少し落ち着かせた。'))
    const shrunk = await figs()
    check('図の上に文を書き足すと、空いた分まで小さくなり（8cm〜12cm）、同じページで改ページの前に収まる', shrunk.sizes[0][1] >= 80 && shrunk.sizes[0][1] < 120 && shrunk.groupPage === shrunk.textPage && shrunk.bottom <= 272, JSON.stringify(shrunk))
    // 横長の図1枚は、本文の幅（15cm）まで。横長の図2枚は、もう本文の幅いっぱいなので大きくならない
    await setBody(body([['f1', 'g-mood', 'イメージボード']]))
    const wide = await figs()
    check('横長の図1枚（ふだんは 8×6cm）は、横が本文の幅（15cm）いっぱいまで大きくなる', wide.sizes[0][0] > 140 && wide.sizes[0][0] <= 150 && wide.bottom <= 272, JSON.stringify(wide))
    await setBody(body([['f1', 'g-mood', 'イメージボード'], ['f2', 'g-process', '制作の様子']]))
    const pair = await figs()
    check('横長の図が2枚並ぶと、もう本文の幅いっぱいなので大きくならない（ふだんの 7.1×5.3cm のまま）', pair.sizes.length === 2 && pair.sizes.every(([w, h]) => w === 71 && h === 53.3), JSON.stringify(pair))
    await page.screenshot({ path: `${OUT}/10-figure-grow.png` })
    await context.close()
  }

  // ---- 漢字・かなと半角の英数字の間（「幅15cmの」）で、カーソルが余計に止まらない（前は「1」の前・「m」の後ろで → を2回押し、止まった所でカーソルの大きさも変わった。Android で依頼者が気づいた 2026-10-26）----
  {
    const { context, page, ready } = await open(browser)
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    await goTo(page, ready, 'p11')
    const text = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p11').content.map((n) => n.text ?? '').join(''))
    const start = text.indexOf('幅') + 1
    await page.evaluate((start) => window.__editor.openEditor('p11', start), start)
    await editingWait(page, 'p11')
    await wait(800)
    const caret = () => page.evaluate(() => window.__editor.getSnapshot().caret)
    const steps = [await caret()]
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight')
      await wait(150)
      steps.push(await caret())
    }
    const back = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowLeft')
      await wait(150)
      back.push(await caret())
    }
    const locked = await page.evaluate(() => [...document.querySelectorAll('.overlay-editor viv-ts-thin-sp')].filter((e) => e.getAttribute('contenteditable') === 'false').length)
    await page.keyboard.type('X')
    await wait(300)
    await page.keyboard.press('Backspace')
    await wait(200)
    await page.keyboard.press('Backspace')
    await wait(200)
    await page.keyboard.press('Escape')
    await wait(600)
    await ready()
    const saved = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p11').content.map((n) => n.text ?? '').join(''))
    check(
      '「幅15cmの」：→ でも ← でも1回で1字ずつ進み（「1」の前・「m」の後ろで止まらない）、すき間の所で打つ・消すも1回で効く',
      steps.join() === [0, 1, 2, 3, 4, 5, 6].map((d) => start + d).join() && back.join() === [5, 4, 3, 2, 1, 0].map((d) => start + d).join() && locked === 0 && saved === text.slice(0, start - 1) + text.slice(start),
      JSON.stringify({ start, steps, back, locked, saved: saved.slice(start - 3, start + 6) }),
    )
    await context.close()
  }

  // ---- 拡大しているときは、ページ送りの「‹ ›」を右下の帯の中に出し、紙面には浮かせない（200% で本文・写真に重なった。mockups/v63 ① 案A）----
  {
    const { context, page, ready } = await open(browser, { width: 1366, height: 768 })
    await startGuide(page, ready)
    await page.evaluate(() => document.querySelector('.g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(500)
    await ready()
    await goTo(page, ready, 'p8')
    const arrows = () =>
      page.evaluate(() => ({
        floating: [...document.querySelectorAll('.stage > .arrow')].map((a) => getComputedStyle(a).display !== 'none' && a.getBoundingClientRect().width > 0),
        bar: [...document.querySelectorAll('.view-bar .bar-arrow')].map((b) => b.getAttribute('aria-label')),
        page: window.__editor.getSnapshot().page,
      }))
    const fit = await arrows()
    await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom button')].find((b) => b.textContent.includes('拡大')).click())
    await wait(800)
    await ready()
    const zoomed = await arrows()
    await page.click('.view-bar .bar-arrow.next')
    await wait(600)
    await ready()
    const turned = await arrows()
    await page.screenshot({ path: `${OUT}/11-zoom-bar-arrows.png` })
    check(
      '拡大すると、紙面の「‹ ›」は隠れ、右下の帯（倍率の右）に「‹ ›」が出て、そこでページを送れる。1ページの表示では今までどおり紙面の横',
      fit.floating.every(Boolean) && fit.bar.length === 0 && zoomed.floating.every((v) => !v) && zoomed.bar.join() === '前のページ,次のページ' && turned.page === zoomed.page + 1,
      JSON.stringify({ fit, zoomed, turned }),
    )
    await context.close()
  }
})

console.log(`${results.filter(Boolean).length}/${results.length} 件 合格`)
if (!results.every(Boolean)) process.exitCode = 1
