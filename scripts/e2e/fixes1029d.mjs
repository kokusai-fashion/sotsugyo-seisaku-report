// 学生の試し 3回目（2026-10-29。Word・抄録・スマホ・うっかりの4人。poc-output/firsttime/r1029/まとめ3.md）の、見た目を変えない直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1029d
// - Ctrl+Enter → すぐ Ctrl+Z → すぐ打つ：字が消えない
// - Enter で分けて・Backspace でつないで、すぐ Ctrl+Z：書く欄を閉じず、続けて打った字が入る
// - 「小見出しにする」のあと、すぐ打った字が小見出しに入る
// - 「小見出し」のダブルクリックで1つだけ。表の大きさのます目のダブルクリックで、表のタイトルの書く欄が閉じない
// - 「2-1 〇〇」を Enter で小見出しにして、何も書かずに離れると、空の段落が残らない
// - 残ったまま保存した PDF の一言は、直すところとまだのところの両方を言う
// - はじめての案内で打ちかけのまま、ページの絵を押すと、案内が閉じてそのページへ移る
// - スマホ：「次のマス」で生地見本の空いたマスに入っても、写真の入れ方を知らせる。改ページを消した知らせは「上の「戻す」」
import { withEdge } from '../poc/edge.mjs'
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

async function open(browser, { phone = false, sample = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  if (sample) {
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await wait(600)
    await ready()
  }
  return { context, page, ready }
}
const blocksOf = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => [c.id, ...c.blocks.map((b) => (b.type === 'pageBreak' ? 'PB' : b.id))].join(' ')).join(' | '))
const textOf = (page, id) => page.evaluate((id) => { const r = window.__editor.getSnapshot().report; const b = r.body.flatMap((c) => c.blocks).find((x) => x.id === id); return b?.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b?.type === 'subheading' ? b.title : b?.type === 'table' ? b.caption : null }, id)
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
}
const blur = async (page) => {
  await page.evaluate(() => document.activeElement?.blur())
  await wait(600)
}
const toast = (page) => page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
const undoAll = async (page, ready, base) => {
  for (let i = 0; i < 8 && (await blocksOf(page)) !== base; i++) {
    await page.evaluate(() => window.__editor.undo())
    await wait(400)
  }
  await ready()
}

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)
    const base = await blocksOf(page)
    const p1 = await textOf(page, 'p1')

    // Ctrl+Enter → すぐ Ctrl+Z → すぐ打つ
    await editAt(page, ready, 'p1', await lengthOf(page, 'p1'))
    await page.keyboard.type('足した')
    await ctrl(page, 'Enter')
    await wait(150)
    await ctrl(page, 'KeyZ')
    await page.keyboard.type('あいう', { delay: 60 })
    await wait(1200)
    await ready()
    const quick = { text: await textOf(page, 'p1'), editing: (await page.evaluate(() => window.__editor.getSnapshot().editingId)) }
    await blur(page)
    check('段落に書き足して Ctrl+Enter → すぐ Ctrl+Z → すぐ打つ：打った字が消えずに、前の段落の終わりに入る', quick.editing === 'p1' && quick.text.endsWith('足したあいう'), JSON.stringify({ quick: { ...quick, text: quick.text.slice(-10) } }))
    await page.evaluate((p1) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p1' ? { ...b, content: [{ type: 'text', text: p1 }] } : b)) })) })), p1)
    await wait(600)
    await ready()

    // Enter で分けて、すぐ Ctrl+Z → 打つ
    await editAt(page, ready, 'p1', 10)
    await page.keyboard.press('Enter')
    await wait(150)
    await ctrl(page, 'KeyZ')
    await page.keyboard.type('X', { delay: 60 })
    await wait(1200)
    await ready()
    const split = { text: await textOf(page, 'p1'), editing: await page.evaluate(() => window.__editor.getSnapshot().editingId), blocks: (await blocksOf(page)).split(' | ')[0] }
    await blur(page)
    check('Enter で段落を分けて、すぐ Ctrl+Z → 打つ：分ける前の所で書き続け、打った字が入る', split.editing === 'p1' && split.text.startsWith(`${p1.slice(0, 10)}X`) && split.blocks === base.split(' | ')[0], JSON.stringify({ ...split, text: split.text.slice(0, 14) }))
    await page.evaluate((p1) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p1' ? { ...b, content: [{ type: 'text', text: p1 }] } : b)) })) })), p1)
    await wait(600)
    await ready()

    // 「小見出しにする」のあと、すぐ打つ
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [{ type: 'paragraph', id: 'px', content: [{ type: 'text', text: '2-1 パターンと仮縫い' }] }, ...c.blocks] } : c)) })))
    await wait(1000)
    await ready()
    await editAt(page, ready, 'px', 12)
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.replace(/\s/g, '').endsWith('小見出しにする'))?.click())
    await page.keyboard.type('の記録', { delay: 60 })
    await wait(1200)
    await ready()
    const conv = await page.evaluate(() => { const s = window.__editor.getSnapshot(); const c = s.report.body[1]; return { first: c.blocks[0]?.type, title: c.blocks[0]?.title, editing: s.editingKind } })
    await blur(page)
    check('「小見出しにする」のあと、すぐ打った字が、その小見出しの終わりに入る', conv.first === 'subheading' && conv.title === 'パターンと仮縫いの記録' && conv.editing === 'subheading', JSON.stringify(conv))

    // 「小見出し」のダブルクリック
    const subs = () => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'subheading').length)
    const before = await subs()
    await editAt(page, ready, 'p3', 2)
    const subTool = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.replace(/\s/g, '').endsWith('小見出し') && !x.textContent.includes('にする')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.click(subTool.x, subTool.y, { count: 2 })
    await wait(1200)
    await ready()
    const afterDbl = await subs()
    await blur(page)
    check('「小見出し」をダブルクリックしても、小見出しは1つだけ増える', afterDbl === before + 1, JSON.stringify({ before, afterDbl }))

    // 表の大きさのます目のダブルクリック
    await editAt(page, ready, 'p6', await lengthOf(page, 'p6'))
    const tableTool = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('表を入れる')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.move(tableTool.x, tableTool.y)
    await page.mouse.click(tableTool.x, tableTool.y)
    await page.waitForSelector('.table-menu .tgrid button', { timeout: 10000 })
    const cell = await page.evaluate(() => { const b = document.querySelectorAll('.table-menu .tgrid button')[7]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.move(cell.x, cell.y)
    await page.mouse.click(cell.x, cell.y, { count: 2 })
    await wait(800)
    await page.keyboard.type('表題', { delay: 60 })
    await wait(1200)
    await ready()
    const tbl = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return { kind: s.editingKind, id: s.editingId } })
    const caption = tbl.id ? await textOf(page, tbl.id) : null
    await page.keyboard.press('Escape')
    await wait(500)
    check('表の大きさのます目をダブルクリックしても、表のタイトルの書く欄は閉じず、打った字がタイトルに入る', tbl.kind === 'tableCaption' && caption === '表題', JSON.stringify({ tbl, caption }))

    // 「2-1 〇〇」を Enter で小見出しにして、何も書かずに離れる
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 2 ? { ...c, blocks: [{ type: 'paragraph', id: 'py', content: [{ type: 'text', text: '3-1 まとめの前に' }] }, ...c.blocks] } : c)) })))
    await wait(1000)
    await ready()
    await editAt(page, ready, 'py', 9)
    await page.keyboard.press('Enter')
    await wait(900)
    await page.keyboard.press('Escape')
    await wait(900)
    await ready()
    const heading = await page.evaluate(() => { const c = window.__editor.getSnapshot().report.body[2]; return c.blocks.slice(0, 2).map((b) => (b.type === 'paragraph' ? `p:${b.content.map((n) => n.text ?? '').join('')}` : b.type)) })
    check('「3-1 〇〇」を Enter で小見出しにして、何も書かずに離れると、後ろに空の段落が残らない', heading[0] === 'subheading' && heading[1] !== 'p:', JSON.stringify(heading))

    // 残ったまま保存した PDF の一言（直すところ・まだのところの両方）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '' }, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' && b.type === 'paragraph' ? { ...b, content: b.content.map((n, i, a) => (i === a.length - 1 && n.type === 'text' ? { ...n, text: n.text.replace(/。$/, '') } : n)) } : b)) })) })))
    await wait(1000)
    await ready()
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId: context.id })
    await page.evaluate(() => [...document.querySelectorAll('.side button')].find((b) => b.textContent.includes('PDFを書き出す'))?.click())
    await page.waitForSelector('.modal .pdf-start', { timeout: 20000 })
    await page.evaluate(() => document.querySelector('.modal .pdf-start').click())
    await page.waitForSelector('.modal .pdf-left-warn', { timeout: 120000 }).catch(() => {})
    const warn = await page.evaluate(() => ({ text: document.querySelector('.modal .pdf-left-warn')?.textContent ?? '', title: document.querySelector('.modal h2')?.textContent ?? '' }))
    check('残ったまま保存した PDF の一言は、保存したあとに出て、直すところとまだのところの両方を言う', /直すところが.+・まだのところが.+残ったまま保存しました/.test(warn.text) && !warn.title.includes('開いています'), JSON.stringify(warn))
    await context.close()
  }

  // ---- パソコン：はじめての案内で打ちかけのまま、ページの絵を押す ----
  {
    const { context, page, ready } = await open(browser, { sample: false })
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:studentId', { timeout: 20000 })
    await wait(500)
    await page.keyboard.type('24DC', { delay: 50 })
    await wait(300)
    const thumb = await page.evaluate(() => { const b = document.querySelectorAll('.thumb-list > button.t')[3]; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.click(thumb.x, thumb.y)
    await wait(1500)
    await ready()
    const after = await page.evaluate(() => ({ guide: !!document.querySelector('.guide'), page: window.__editor.getSnapshot().page }))
    check('はじめての案内で学籍番号を打ちかけのまま、ページの絵を押すと、案内が閉じてそのページへ移る（次の項目へ進まない）', !after.guide && after.page === 3, JSON.stringify(after))
    await context.close()
  }

  // ---- スマホ ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    // 素材表を入れて、「次のマス」で生地見本の空いたマスへ
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const len = await lengthOf(page, 'p6')
    await page.evaluate((len) => window.__editor.openEditor('p6', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await wait(600)
    await page.evaluate(() => window.__editor.addTable('material'))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
    await ready()
    await wait(600)
    // 中身の行の1つ目（名称）を押して書き、「次のマス」で 使用箇所 → 生地見本 へ
    const first = await page.evaluate(() => { const s = window.__editor.getSnapshot(); const t = s.report.body.flatMap((c) => c.blocks).find((b) => b.id === s.editingId); return t.rows[1].cells[0].id })
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(600)
    await ready()
    await page.evaluate((id) => window.__editor.openEditor(id, 0), first)
    await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, first)
    await wait(600)
    const swatchToast = await (async () => {
      for (let i = 0; i < 2; i++) {
        await page.waitForSelector('.direct-bar .db-next', { timeout: 10000 })
        await page.evaluate(() => document.querySelector('.direct-bar .db-next').click())
        await wait(900)
      }
      return await toast(page)
    })()
    check('スマホ：「次のマス」で生地見本の空いたマスに入っても、「生地見本の写真は、下の道具の「画像」から入れます」と知らせる', swatchToast.includes('生地見本の写真は') && swatchToast.includes('「画像」'), swatchToast)
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(600)
    await ready()

    // 改ページを消した知らせ（スマホは「上の「戻す」」）
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    const l1 = await lengthOf(page, 'p1')
    await page.evaluate((l1) => window.__editor.openEditor('p1', l1), l1)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 20000 })
    await wait(600)
    await page.evaluate(() => window.__editor.addPageBreak())
    await wait(1200)
    await ready()
    await page.keyboard.press('Backspace')
    await wait(900)
    const pbToast = await toast(page)
    check('スマホ：改ページを消した知らせは「改ページを消しました（上の「戻す」で戻せます）」', pbToast.includes('改ページを消しました') && pbToast.includes('上の「戻す」'), pbToast)
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
