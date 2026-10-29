// 学生の試し 2回目（2026-10-29。スマホ・仕上げ・Word・1回目の確かめの4人。poc-output/firsttime/r1029/まとめ2.md）の、見た目を変えない直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1029b
// - 行の右端にぶら下げた「。」のすぐ右を押すと、「。」の後ろから書ける
// - Ctrl+Enter のすぐあとに Ctrl+Z：書く欄を閉じず、押す前に書いていた所で書き続ける
// - Ctrl+Enter を2回：改ページは1つ（「もう新しいページの頭です」）
// - 改ページのすぐ後ろの段落の頭で Backspace：改ページを消す（空の段落なら段落も消して、前の段落の終わりへ。前の段落の字は消えない）
// - 段落の途中で Ctrl+Enter：カーソルの所で分けて、後ろを次のページから
// - 表のマスで Ctrl+Enter：「表の中では改ページできません」
// - 「：」で終えた段落は、Esc でも「。」を付けない（指摘もしない）
// - 書いている途中で窓を狭くして（スマホの並べ方に）も、同じ欄で書き続けられる
// - スマホ：書いている間に「追加」→「改ページ」：改ページの後ろの新しい段落で書き続ける
// - 学籍番号を全角で打っている間は、全角・形の指摘を出さない。空の表紙の項目を開いても、表紙は「まだ」のまま
// - 「段落の終わりに「。」を付けました」は、ほかの欄を書き始めたら消える
// - 素材表の生地見本の空いたマスを書き始めると、写真の入れ方を知らせる
// - Word：読み取れなかったところを「つぎにすること」に残す。表紙が空なら「確かめた」で済みにしない。はじめての案内の間は「つぎにすること」を出さない
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withEdge } from '../poc/edge.mjs'
import { makeDocx, p as wp } from './fixtures/docx.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(browser, { phone = false, confirm = () => true, viewport = null } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(viewport ?? (phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 }))
  await stubConfig(page)
  await answerConfirms(page, confirm)
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
const snap = (page) => page.evaluate(() => { const s = window.__editor.getSnapshot(); return { editingId: s.editingId, editingKind: s.editingKind } })
const blocksOf = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => [c.id, ...c.blocks.map((b) => (b.type === 'pageBreak' ? 'PB' : b.id))].join(' ')).join(' | '))
const textOf = (page, id) => page.evaluate((id) => { const r = window.__editor.getSnapshot().report; const b = [...r.body.flatMap((c) => c.blocks), ...r.abstract.paragraphs].find((x) => x.id === id); return b?.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b?.type === 'subheading' ? b.title : (r.body.find((c) => c.id === id)?.title ?? null) }, id)
const lengthOf = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content.map((n) => n.text ?? '（図1）').join('').length, id)
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(300)
}
const ctrl = async (page, key) => {
  await page.keyboard.down('Control')
  await page.keyboard.press(key)
  await page.keyboard.up('Control')
  await wait(900)
}
const blur = async (page) => {
  await page.evaluate(() => document.activeElement?.blur())
  await wait(600)
}
const toast = (page) => page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
/** 書く欄の中のカーソルの位置（字の数） */
const caretOf = (page) => page.evaluate(() => { const s = getSelection(); const ed = document.querySelector('.overlay-editor'); if (!s.rangeCount || !ed) return -1; const pre = document.createRange(); pre.selectNodeContents(ed); pre.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset); return pre.toString().replace(/\n/g, '').length })

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)
    const base = await blocksOf(page)
    const p1 = await textOf(page, 'p1')

    // 行の右端にぶら下げた「。」のすぐ右を押す（抄録の最後の段落。仕上げる学生の試しと同じ文）
    const A4 = '本番では、照明の下で袖の刺繍が光り、主人公の動きを大きく見せることができた。一方で、帯の結び目が大きく、場面転換の早替えに時間がかかるという課題が残った。今後は、見た目の美しさだけでなく、着脱のしやすさも初めから考えたデザインを心がけたい。'
    await page.evaluate((A4) => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: true, paragraphs: [...r.abstract.paragraphs.slice(0, 3), { type: 'paragraph', id: 'a4', content: [{ type: 'text', text: A4 }] }] } })), A4)
    await wait(800)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('a4'), 'none'))
    await ready()
    await wait(500)
    const hang = await page.evaluate(() => {
      const p = [...document.querySelectorAll('.page-viewport.front p')].find((p) => p.getBoundingClientRect().width > 0 && p.innerText.includes('本番では'))
      const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let last = null
      while (w.nextNode()) if (w.currentNode.textContent.trim()) last = w.currentNode
      const rg = document.createRange()
      rg.setStart(last, last.textContent.length - 1)
      rg.setEnd(last, last.textContent.length)
      const r = rg.getBoundingClientRect()
      return { x: r.right + 4, y: r.top + r.height / 2, width: r.width }
    })
    await page.mouse.click(hang.x, hang.y)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'a4', { timeout: 20000 }).catch(() => {})
    await wait(500)
    const hangCaret = await caretOf(page)
    await page.keyboard.type('X')
    await wait(400)
    await blur(page)
    const hangText = await textOf(page, 'a4')
    check('行の右端にぶら下げた「。」のすぐ右を押すと、「。」の後ろから書ける', hangCaret === A4.length && hangText.endsWith('心がけたい。X'), JSON.stringify({ width: hang.width, hangCaret, total: A4.length, end: hangText.slice(-8) }))
    await page.evaluate(() => window.__editor.undo())
    await wait(300)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // Ctrl+Enter のすぐあとに Ctrl+Z
    const len1 = await lengthOf(page, 'p1')
    await editAt(page, ready, 'p1', len1)
    await ctrl(page, 'Enter')
    const afterBreak = await blocksOf(page)
    await ctrl(page, 'KeyZ')
    await ready()
    await wait(600)
    const undoSnap = await snap(page)
    await page.keyboard.type('続き')
    await wait(500)
    const undoTyped = await textOf(page, 'p1')
    await blur(page)
    check(
      'Ctrl+Enter のすぐあとに Ctrl+Z：改ページが消え、書く欄は閉じずに押す前の段落の終わりで書き続ける（打った字が入る）',
      afterBreak !== base && (await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'pageBreak').length)) === (base.match(/PB/g) ?? []).length && undoSnap.editingId === 'p1' && undoTyped === `${p1}続き`,
      JSON.stringify({ undoSnap, end: undoTyped?.slice(-6) }),
    )
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // Ctrl+Enter を2回
    await editAt(page, ready, 'p1', len1)
    await ctrl(page, 'Enter')
    await ctrl(page, 'Enter')
    const twice = { blocks: await blocksOf(page), toast: await toast(page), ...(await snap(page)) }
    check('Ctrl+Enter を2回：改ページは1つだけ（白紙のページを作らない）。2回目は「もう新しいページの頭です」', /p1 PB p-\S+ p2/.test(twice.blocks) && !/PB p-\S+ PB/.test(twice.blocks) && twice.toast.includes('もう新しいページの頭'), JSON.stringify({ blocks: twice.blocks.split(' | ')[0], toast: twice.toast }))

    // そのまま Backspace：改ページと空の段落を消して、p1 の終わりへ（p1 の字は消えない）
    await page.keyboard.press('Backspace')
    await wait(900)
    await ready()
    const bs = { blocks: await blocksOf(page), ...(await snap(page)), toast: await toast(page) }
    await page.keyboard.press('Backspace')
    await wait(400)
    const bsText = await textOf(page, 'p1')
    await blur(page)
    check(
      '改ページのすぐ後ろの空の段落で Backspace：改ページと空の段落を消し、前の段落の終わりへ（知らせ「改ページを削除しました」。もう一度押すと前の段落の最後の字が消えるだけ）',
      bs.blocks === base && bs.editingId === 'p1' && bs.toast.includes('改ページ') && bsText === p1.slice(0, -1),
      JSON.stringify({ blocks: bs.blocks.split(' | ')[0], editing: bs.editingId, toast: bs.toast, end: bsText.slice(-6) }),
    )
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    check('（もとに戻した）', (await blocksOf(page)) === base && (await textOf(page, 'p1')) === p1, (await blocksOf(page)).split(' | ')[0])

    // 字のある段落の頭で改ページ → Backspace で消す
    await editAt(page, ready, 'p2', 0)
    await ctrl(page, 'Enter')
    const headBreak = await blocksOf(page)
    await page.keyboard.press('Backspace')
    await wait(900)
    await ready()
    const headBs = { blocks: await blocksOf(page), ...(await snap(page)) }
    await blur(page)
    check('字のある段落の頭で Ctrl+Enter → Backspace：改ページだけ消え、同じ段落の頭で書き続ける', headBreak.includes('p1 PB p2') && headBs.blocks === base && headBs.editingId === 'p2', JSON.stringify({ headBreak: headBreak.split(' | ')[0], headBs }))

    // 段落の途中で Ctrl+Enter
    await editAt(page, ready, 'p1', 10)
    await ctrl(page, 'Enter')
    await ready()
    const mid = { blocks: await blocksOf(page), ...(await snap(page)) }
    const midFirst = await textOf(page, 'p1')
    const midRest = mid.editingId ? await textOf(page, mid.editingId) : null
    const midCaret = await caretOf(page)
    await ctrl(page, 'KeyZ')
    await ready()
    await wait(500)
    const midUndo = { blocks: await blocksOf(page), ...(await snap(page)), text: await textOf(page, 'p1'), caret: await caretOf(page) }
    await blur(page)
    check(
      '段落の途中で Ctrl+Enter：カーソルの所で段落を分け、後ろの部分を次のページから（その頭で書き続ける。「。」は付けない）。Ctrl+Z で1つの段落に戻り、同じ所で書き続ける',
      /p1 PB p-\S+ p2/.test(mid.blocks) && midFirst === p1.slice(0, 10) && midRest === p1.slice(10) && midCaret === 0 && midUndo.blocks === base && midUndo.text === p1 && midUndo.editingId === 'p1' && midUndo.caret === 10,
      JSON.stringify({ blocks: mid.blocks.split(' | ')[0], midFirst, midRest: midRest?.slice(0, 8), midCaret, midUndo: { ...midUndo, blocks: midUndo.blocks.split(' | ')[0], text: midUndo.text.slice(0, 8) } }),
    )

    // 表のマスで Ctrl+Enter
    const cell = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')?.rows[1]?.cells[0]?.id ?? null)
    if (cell) {
      await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table').id), 'none'), cell)
      await ready()
      await page.evaluate((id) => window.__editor.openEditor(id, 0), cell)
      await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, cell)
      await wait(300)
      await ctrl(page, 'Enter')
      const cellToast = await toast(page)
      check('表のマスで Ctrl+Enter：「表の中では改ページできません」と知らせる（改ページは入らない）', cellToast.includes('表の中では改ページできません') && (await blocksOf(page)) === base, cellToast)
      await page.keyboard.press('Escape')
      await wait(400)
      await ready()
    } else check('表のマスで Ctrl+Enter（見本に表がない）', false)

    // 「：」で終えた段落は Esc でも「。」を付けない
    const lenNow = await lengthOf(page, 'p2')
    await editAt(page, ready, 'p2', lenNow)
    await page.keyboard.type('使った材料は次のとおり：')
    await page.keyboard.press('Escape')
    await wait(900)
    const colon = await textOf(page, 'p2')
    const colonFinding = await page.evaluate(() => window.__editor.getSnapshot().findings.some((f) => f.blockId === 'p2' && f.ruleId === 'sentence-end'))
    check('「：」で終えた段落は、Esc で書き終えても「。」を付けず、「文末に「。」」の指摘も出さない', colon.endsWith('次のとおり：') && !colonFinding, JSON.stringify({ end: colon.slice(-8), colonFinding }))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 書いている途中で窓を狭くする（スマホの並べ方になる）→ 広げる
    await editAt(page, ready, 'p1', len1)
    await page.keyboard.type('あ')
    await page.setViewport({ width: 900, height: 768 })
    await wait(1500)
    await ready()
    await wait(800)
    const narrow = await snap(page)
    await page.keyboard.type('い')
    await wait(500)
    await page.setViewport({ width: 1366, height: 768 })
    await wait(1500)
    await ready()
    await wait(800)
    const wide = await snap(page)
    await page.keyboard.type('う')
    await wait(500)
    const resized = await textOf(page, 'p1')
    await blur(page)
    check('書いている途中で窓を狭くしても・広げても、同じ欄で書き続けられる（打った字が消えない）', narrow.editingId === 'p1' && wide.editingId === 'p1' && resized === `${p1}あいう`, JSON.stringify({ narrow, wide, end: resized.slice(-6) }))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 学籍番号を全角で打っている間
    await editAt(page, ready, 'basic:studentId', 0)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    const cdp = await page.createCDPSession()
    await cdp.send('Input.insertText', { text: '２３ｂｋ０４' })
    await wait(800)
    const idTyping = await page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'basic:studentId').map((f) => f.ruleId))
    await page.keyboard.press('Escape')
    await wait(600)
    check('学籍番号を全角で打っている間は、全角の数字・英字・形の指摘を出さない', idTyping.length === 0, JSON.stringify({ idTyping }))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    // 空の表紙の項目を開いただけでは、表紙は済まない
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, name: '' } })))
    await wait(600)
    await editAt(page, ready, 'basic:name', 0)
    await wait(400)
    const coverOpen = await page.evaluate(() => [...document.querySelectorAll('.side .check-prog li')].find((x) => x.querySelector('.l')?.textContent === '表紙')?.querySelector('.v')?.textContent ?? '')
    await page.keyboard.press('Escape')
    await wait(400)
    check('空の表紙の項目（氏名）を開いても、表紙は「氏名がまだ」のまま', coverOpen.includes('氏名がまだ'), coverOpen)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 「段落の終わりに「。」を付けました」は、ほかの欄を書き始めたら消える
    await editAt(page, ready, 'p2', await lengthOf(page, 'p2'))
    await page.keyboard.type('書き足した')
    await page.keyboard.press('Escape')
    await wait(900)
    const periodToast = await toast(page)
    await editAt(page, ready, 'p3', 0)
    await wait(400)
    const periodGone = await toast(page)
    await blur(page)
    check('「段落の終わりに「。」を付けました」は、ほかの欄を書き始めたら消える', periodToast.includes('「。」を付けました') && !periodGone.includes('「。」を付けました'), JSON.stringify({ periodToast, periodGone }))
    await page.evaluate(() => window.__editor.undo())
    await wait(300)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 素材表の生地見本の空いたマス
    await editAt(page, ready, 'p6', await lengthOf(page, 'p6'))
    await page.evaluate(() => window.__editor.addTable('material'))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
    await ready()
    await wait(500)
    await page.keyboard.press('Escape')
    await wait(500)
    const swatchCell = await page.evaluate(() => {
      const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'table').at(-1)
      const col = t.rows[0].cells.findIndex((c) => c.text.includes('見本'))
      return col >= 0 ? t.rows[1].cells[col].id : null
    })
    let swatchToast = ''
    if (swatchCell) {
      await page.evaluate((id) => window.__editor.openEditor(id, 0), swatchCell)
      await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, swatchCell)
      await wait(400)
      swatchToast = await toast(page)
      await page.keyboard.press('Escape')
      await wait(400)
    }
    check('素材表の生地見本の空いたマスを書き始めると、「生地見本の写真は、左の道具の「画像を入れる」から入れます」', swatchToast.includes('生地見本の写真は') && swatchToast.includes('画像を入れる'), JSON.stringify({ swatchCell, swatchToast }))
    await context.close()
  }

  // ---- Word：読み取れなかったところ・空の表紙・はじめての案内 ----
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2word-'))
    const body = path.join(dir, '04_本文.docx')
    fs.writeFileSync(body, makeDocx({ body: [wp('Ⅰ．企画・立案'), wp('　Word で書いた段落である。', '<w:r><w:commentReference w:id="0"/></w:r>')].join('') }))
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done') } catch {} })
    await page.setViewport({ width: 1366, height: 768 })
    await stubConfig(page)
    await answerConfirms(page, () => true)
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
    const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
    await ready()
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt')
    await page.evaluate(() => document.querySelector('.g-word-opt:not(.no)').click())
    await page.waitForSelector('.word-file .acts button:not(.link)', { timeout: 20000 })
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[0].click())])
    await chooser.accept([body])
    await page.waitForFunction(() => document.querySelector('.word-file.picked'), { timeout: 20000 })
    await wait(500)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる'))?.click())
    await page.waitForFunction(() => [...document.querySelectorAll('.modal .row-buttons button')].some((b) => b.textContent.includes('読み込む') && !b.disabled), { timeout: 60000 })
    const confirmText = await page.evaluate(() => document.querySelector('.modal .word-warn')?.textContent ?? '')
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('読み込む')).click())
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 60000 })
    await ready()
    await wait(800)
    // 表紙が空なので、はじめての案内（学籍番号）が出る。その間は「つぎにすること」を出さない
    const during = await page.evaluate(() => ({ guide: !!document.querySelector('.guide'), todo: !!document.querySelector('.side .word-todo') }))
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
    await page.waitForSelector('.side .word-todo', { timeout: 20000 })
    await wait(500)
    check('Word を読み込んだあと、はじめての案内が出ている間は「つぎにすること」を出さない（案内を閉じると出る）', during.guide && !during.todo, JSON.stringify(during))
    const problems = await page.evaluate(() => { const li = [...document.querySelectorAll('.side .word-todo > ul > li')].find((x) => x.textContent.includes('読み取れなかったところ')); if (!li) return null; li.querySelector('summary')?.click(); return li.textContent })
    await wait(300)
    check('確かめる窓の「うまく読み取れなかったところ」（コメント）を、「つぎにすること」の「読み取れなかったところを直す」に残す', confirmText.includes('コメント（1件）') && !!problems && problems.includes('コメント（1件）は写していません'), JSON.stringify({ confirm: confirmText.slice(0, 60), problems }))
    // 表紙が空のまま「表紙へ」→「確かめた」は出ない
    await page.evaluate(() => [...document.querySelectorAll('.side .word-todo .go')].find((b) => b.textContent.includes('表紙へ'))?.click())
    await wait(1200)
    await ready()
    const coverItem = await page.evaluate(() => { const li = [...document.querySelectorAll('.side .word-todo > ul > li')].find((x) => x.textContent.includes('表紙を確かめる')); return { text: li?.textContent ?? '', ok: !!li?.querySelector('.cover-ok'), done: !!li?.classList.contains('done') } })
    check('表紙が空のまま「表紙へ」：「確かめた」は出さず、「学籍番号・氏名・サブタイトルが空です」', !coverItem.ok && !coverItem.done && coverItem.text.includes('が空です'), JSON.stringify(coverItem))
    await context.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }

  // ---- スマホ：書いている間に「追加」→「改ページ」 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    const len = await lengthOf(page, 'p1')
    await page.evaluate((len) => window.__editor.openEditor('p1', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 20000 })
    await wait(800)
    await page.evaluate(() => window.__editor.addPageBreak())
    await wait(1200)
    await ready()
    await wait(600)
    const after = { blocks: await blocksOf(page), ...(await snap(page)) }
    const cdp = await page.createCDPSession()
    await cdp.send('Input.insertText', { text: '新しいページ' })
    await wait(800)
    const typed = after.editingId ? await textOf(page, after.editingId) : null
    check('スマホ：段落を書いている間に「追加」→「改ページ」：改ページの後ろの新しい段落で書き続ける', /p1 PB p-\S+ p2/.test(after.blocks) && after.editingId !== 'p1' && typed === '新しいページ', JSON.stringify({ blocks: after.blocks.split(' | ')[0], editing: after.editingId, typed }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
