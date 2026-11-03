// 録画（2026-11-03。シンドバッドの見本でパソコン・スマホ4本）で見つかったことの直し：
// ① 句読点・括弧のまとまり（contenteditable="false"）を押して、選んでいた範囲が消えたとき、押した点の近くにカーソルを置き直す
// ② 頭に「。」の付いた文を、文の終わりのあとに貼ったら、その「。」を外す（「学んだ。。客席から」と見えていた）
// ④ 手で書いた「（図n）」の「図nを入れる」：段落の後ろに図(n-1) があれば、その後ろに入れて、書いた番号のままにする
// ⑤ 「本文中に「図n」…を入れる」を押すと、図ではなく、図のすぐ前の段落の終わりへ移る
// ⑦ 段落を3回続けて押すと、段落の字を全部選ぶ
// これだけを流すときは node scripts/e2e/run.mjs fixes1103
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1440, height: 810 })
  await stubConfig(page)
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
  await ready()
  return { context, page, ready }
}
const settle = async (page, ready) => {
  await wait(1200)
  await ready()
}
const setText = (page, id, text) => page.evaluate((id, text) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, content: [{ type: 'text', text }] } : b)) })) })), id, text)
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(400)
}
const offsets = (page) => page.evaluate(() => window.__editor.overlay.selectionOffsets())
const overlayText = (page) => page.evaluate(() => window.__editor.overlay.text)
const figureOrder = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures.map((f) => f.id) : [])))

await withEdge(async (browser) => {
  const { context, page, ready } = await open(browser)

  // ---- ① まとまりを押して、選んでいた範囲が消えた ----
  await editAt(page, ready, 'p3', 3)
  const lockCase = await page.evaluate(() => {
    const o = window.__editor.overlay
    const lock = [...o.element.querySelectorAll('[contenteditable="false"]')].find((e) => e.textContent === '（' && e.closest('.fig-ref'))
    if (!lock) return null
    const r = lock.getBoundingClientRect()
    // ブラウザが選んでいた範囲を消した状態（Word から読み込んだ段落で、境目を押したときに起きた）を作って、まとまりの左半分を押す
    getSelection().removeAllRanges()
    lock.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + 1, clientY: r.top + r.height / 2, button: 0, detail: 1 }))
    return { at: o.text.indexOf('（図1）') }
  })
  await wait(300)
  const afterLock = await page.evaluate(() => ({ s: window.__editor.overlay.selectionOffsets(), focused: document.activeElement === window.__editor.overlay.element, anchor: !!getSelection().anchorNode }))
  check('① 括弧のまとまりを押して選ぶ範囲が消えても、押した側（「（」の前）にカーソルを置き直す', !!lockCase && afterLock.anchor && afterLock.focused && afterLock.s.start === lockCase.at && afterLock.s.end === lockCase.at, JSON.stringify({ lockCase, afterLock }))
  await page.keyboard.press('Escape')
  await settle(page, ready)

  // ---- ⑦ 3回続けて押す ----
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), 'p3')
  await ready()
  const pt = await page.evaluate(() => { const r = window.__editor.renderer.pageView.fragments('p3')[0].getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + 8 } })
  await page.mouse.click(pt.x, pt.y, { count: 1 })
  await page.mouse.click(pt.x, pt.y, { count: 2 })
  await page.mouse.click(pt.x, pt.y, { count: 3 })
  await wait(800)
  const triple = await page.evaluate(() => ({ editing: window.__editor.getSnapshot().editingId, s: window.__editor.overlay.selectionOffsets(), len: window.__editor.overlay.text.length }))
  check('⑦ 段落を3回続けて押すと、段落の字を全部選ぶ（「、」の手前で止まらない）', triple.editing === 'p3' && triple.s.start === 0 && triple.s.end === triple.len && triple.len > 20, JSON.stringify(triple))
  await page.keyboard.press('Escape')
  await settle(page, ready)

  // ---- ② 頭に「。」の付いた文を貼る ----
  const before = '本制作報告書は、衣装の制作をまとめたものである。全体を見て声をかけ合うことの大切さを学んだ。'
  await page.evaluate((t) => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: true, paragraphs: [{ id: 'a1', type: 'paragraph', content: [{ type: 'text', text: t }] }] } })), before)
  await settle(page, ready)
  await editAt(page, ready, 'a1', before.length)
  const paste = (text) =>
    page.evaluate((text) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      window.__editor.overlay.element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, text)
  await paste('。客席から見える美しさを学んだ。')
  await wait(800)
  let shown = await overlayText(page)
  check('② 文の終わりのあとに「。客席から…」を貼ると、頭の「。」を外して入れる（「。。」と見えない）', shown === `${before}客席から見える美しさを学んだ。`, shown)
  // 文の途中に貼ったときは、前の文を終える「。」なので、そのまま
  await page.keyboard.type('声をかけ合う')
  await paste('。次に布を選んだ。')
  await wait(800)
  shown = await overlayText(page)
  check('② 文の途中のあとに貼った「。」は、そのまま（前の文を終える）', shown.endsWith('声をかけ合う。次に布を選んだ。'), shown)
  await page.keyboard.press('Escape')
  await settle(page, ready)

  // ---- ④ 「（図n）」の「図nを入れる」の番号と、入れる所 ----
  // p6（図はまだない）に「（図4）」と書く。段落の下に入れると図3（後ろの f3 が図4）になってしまう。図3（f3）は p6 より後ろにある
  const p6 = 'デザイン画をもとにパターンを引き、袖の形を整えた（図4）。'
  await setText(page, 'p6', p6)
  await settle(page, ready)
  await editAt(page, ready, 'p6', p6.indexOf('（図4）') + 2)
  await wait(500)
  const chipLabel = await page.evaluate(() => { const c = document.querySelector('.figure-chip'); return c && !c.hidden ? c.textContent.trim() : null })
  check('④ 後ろに図3があるとき、手で書いた「（図4）」には「図4を入れる」と出す（前は「図3を入れる」）', chipLabel === '図4を入れる', String(chipLabel))
  const pngPath = join(tmpdir(), 'sotsugyo-e2e-1103.png')
  const png = await page.evaluate(async () => {
    const c = new OffscreenCanvas(600, 800)
    const g = c.getContext('2d')
    g.fillStyle = '#d9c4e8'
    g.fillRect(0, 0, 600, 800)
    const blob = await c.convertToBlob({ type: 'image/png' })
    return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))
  })
  writeFileSync(pngPath, Buffer.from(png, 'base64'))
  const chipAt = await page.evaluate(() => { const r = document.querySelector('.figure-chip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  const figsBefore = await figureOrder(page)
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.mouse.click(chipAt.x, chipAt.y)])
  await chooser.accept([pngPath])
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
  await page.keyboard.type('袖')
  await page.keyboard.press('Escape')
  await settle(page, ready)
  const figsAfter = await figureOrder(page)
  const added = figsAfter.find((x) => !figsBefore.includes(x))
  const blocks = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => b.type === 'figureRow' ? b.figures.map((f) => f.id).join('+') : b.id))
  const p6Refs = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p6').content.filter((n) => n.type === 'ref').map((n) => n.targetId))
  check('④ 入れた図は図3（f3）の行のすぐ後ろに入り、図4になる。書いた「（図4）」がその図につながる', !!added && figsAfter.indexOf(added) === 3 && blocks[blocks.indexOf('f3') + 1] === added && p6Refs.join() === added, JSON.stringify({ added, figsAfter, p6Refs }))

  // ---- ⑤ 本文から参照していない図の指摘を押す ----
  const p8 = '袖には、海の波を表す模様を金の糸で刺繍した。'
  await setText(page, 'p8', p8)
  await settle(page, ready)
  const issue = await page.evaluate(() => {
    const li = [...document.querySelectorAll('.issue')].find((e) => /本文中に「図3」/.test(e.textContent))
    if (!li) return null
    li.scrollIntoView({ block: 'center' })
    const r = li.querySelector('.ttl').getBoundingClientRect()
    return { x: r.left + 20, y: r.top + r.height / 2 }
  })
  if (issue) await page.mouse.click(issue.x, issue.y)
  await page.waitForFunction(() => !!window.__editor.getSnapshot().editingId, { timeout: 20000 }).catch(() => {})
  await wait(800)
  const jumped = await page.evaluate(() => ({ editing: window.__editor.getSnapshot().editingId, s: window.__editor.overlay.selectionOffsets(), len: window.__editor.overlay.text.length }))
  check('⑤ 「本文中に「図3」…を入れる」を押すと、図のすぐ前の段落（p8）の終わりへ移って開く', !!issue && jumped.editing === 'p8' && jumped.s.start === jumped.len, JSON.stringify({ issue, jumped }))
  await page.keyboard.press('Escape')
  await settle(page, ready)

  // ---- 会議のあと：まだ何も書いていない章は PDF に入れない（目次からも外し、ページ番号を詰める） ----
  const exportFacts = () =>
    page.evaluate(async () => {
      const { pages, release } = await window.__editor.pdfPages()
      const texts = pages.filter((p) => !p.classList.contains('print-skip')).map((p) => p.textContent ?? '')
      // 章の見出し「Ⅲ．まとめ」で見る（抄録の「まとめたものである」は数えない）
      const out = { n: texts.length, toc: texts.find((t) => t.includes('目次')) ?? '', matome: texts.some((t) => /[ⅠⅡⅢⅣⅤ]．\s*まとめ/.test(t) && !t.includes('目次')), paperDuring: !!document.querySelector('.export-paper') }
      release()
      return { ...out, paperAfter: !!document.querySelector('.export-paper') }
    })
  const full = await exportFacts()
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => (c.id === 'c3' ? { ...c, blocks: [{ type: 'paragraph', id: 'p14', content: [{ type: 'text', text: '' }], hint: '制作を通して学んだことを書く。' }] } : c)) })))
  await settle(page, ready)
  const cut = await exportFacts()
  const screenHas = await page.evaluate(() => window.__editor.pageElements().some((p) => (p.textContent ?? '').includes('まとめ') && !(p.textContent ?? '').includes('目次')))
  check(
    '会議のあと：まだ何も書いていない章（まとめ）は PDF に入れず、目次にも出さない（画面の紙面には残る。組み直しに使った所は、終わったら消す）',
    full.matome && full.toc.includes('まとめ') && !cut.matome && !cut.toc.includes('まとめ') && cut.toc.includes('制作過程') && cut.n === full.n - 1 && screenHas && cut.paperDuring && !cut.paperAfter,
    JSON.stringify({ full: { n: full.n, matome: full.matome }, cut: { n: cut.n, matome: cut.matome, toc: cut.toc.slice(0, 60) }, screenHas }),
  )
  // 「PDFを書き出す」の窓に、入らない章の名前を出す（提出のときに、書き忘れた章に気づけるように）
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('PDFを書き出す'))?.click())
  await page.waitForSelector('.pdf-not-started', { timeout: 10000 }).catch(() => {})
  const note = await page.evaluate(() => document.querySelector('.pdf-not-started')?.textContent ?? '')
  check('「PDFを書き出す」の窓に「まだ何も書いていない章（Ⅲ．まとめ）は、このPDFには入りません」と出す', note.includes('Ⅲ．まとめ') && note.includes('入りません'), note)
  // そのまま作る：画面に出さない所で組み直したページで、PDF が最後までできる（ページの数は、まとめを除いた数）
  await page.click('.modal .pdf-start')
  await page.waitForSelector('.modal .pdf-open', { timeout: 120000 }).catch(() => {})
  const built = await page.evaluate(() => ({ thumbs: document.querySelectorAll('.modal .pdf-thumbs img').length, open: !!document.querySelector('.modal .pdf-open'), paper: !!document.querySelector('.export-paper') }))
  check('書いていない章を除いて組み直したページで、PDF が最後までできる（ページの数も合う。組み直しに使った所は消える）', built.open && built.thumbs === cut.n && !built.paper, JSON.stringify({ built, n: cut.n }))
  await page.keyboard.press('Escape')
  await settle(page, ready)

  await context.close()
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
