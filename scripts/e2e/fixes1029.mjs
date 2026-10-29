// 学生の試し 1回目（2026-10-29。パソコン・スマホ・Word・うっかりの4人。poc-output/firsttime/r1029/）の、見た目を変えない直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1029
// - 素材表を入れて、選ばれたタイトルのまま Enter：タイトルは消えず、1つ目のマスへ
// - 空にした小見出しを Backspace で消すと、上の図のタイトルではなく、その前の段落へ移る
// - 「改ページ」をダブルクリックしても、改ページは1つ（白紙のページを作らない）
// - 見出しを書いているとき・見出しのすぐ下の段落の頭で改ページ：見出しの前に入る。大見出し（章の頭）には入れない
// - Ctrl+Enter のあとも書き続ける（段落の終わりなら、改ページの後ろの新しい段落で）
// - 学籍番号を全角で打っても、半角・大文字にそろえる
// - 図を含めて範囲を消すと、知らせに「（図1も）」
// - 前の欄の「1行目だけを貼り付けました」は、ほかの欄を書き始めたら消す
// - セルフチェックの「表紙」が「表／紙」に割れない
// - 「つぎにすること」の × は、まだの項目があれば確かめてから閉じる
// - スマホ：書いている間の「戻す」2回 →「やり直す」2回で、書いた文が全部戻る
// - Esc（パソコン）・「完了」（スマホ）で書き終えたときも、段落の終わりに「。」を付ける（元に戻すと「。」だけ外れる。依頼者の選択 2026-10-29）
// - 学籍番号の形を、年度の設定がなければアカウントと同じ形で確かめる（依頼者の選択 2026-10-29）
// - mockups/v73 の見た目の直し（依頼者の選択「おすすめで」。① 参考文献は保留）：② 知らせは紙面の台の上の真ん中 ③ スマホの「削除」は帯の左の端
//   ④ はじめの1回だけ「字が小さいときは…」 ⑤ 押せない「図を入れる」を押すと吹き出しでわけ ⑥「6ページ（5ページ以上）」 ⑦ 作品写真の空の枠に大きな「＋ 写真を選ぶ」
//   ⑧ Word：替わる表紙の項目を赤で・メニューに残す ⑨ スマホの並べ方をマウスで使うとき、Ctrl＋ホイールで紙面を広げる
import { fileURLToPath } from 'node:url'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const FIX = new URL('./fixtures/', import.meta.url)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(browser, { phone = false, sample = true, confirm = () => true, zoomTip = false, viewport = null } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument((zoomTip) => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); if (!zoomTip) localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }, zoomTip)
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(viewport ?? (phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 }))
  await stubConfig(page)
  await answerConfirms(page, confirm)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  if (sample) {
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
  return { context, page, ready }
}
const snap = (page) => page.evaluate(() => { const s = window.__editor.getSnapshot(); return { editingId: s.editingId, editingKind: s.editingKind } })
const blocksOf = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => [c.id, ...c.blocks.map((b) => (b.type === 'pageBreak' ? 'PB' : b.id))].join(' ')).join(' | '))
const textOf = (page, id) => page.evaluate((id) => { const r = window.__editor.getSnapshot().report; const b = r.body.flatMap((c) => c.blocks).find((x) => x.id === id); return b?.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b?.type === 'subheading' ? b.title : (r.body.find((c) => c.id === id)?.title ?? null) }, id)
const lengthOf = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content.map((n) => n.text ?? '（図1）').join('').length, id)
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(300)
}
const ctrlEnter = async (page) => {
  await page.keyboard.down('Control')
  await page.keyboard.press('Enter')
  await page.keyboard.up('Control')
  await wait(900)
}
const toast = (page) => page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)

    // 素材表：選ばれたタイトルのまま Enter
    await editAt(page, ready, 'p6', await lengthOf(page, 'p6'))
    await page.evaluate(() => window.__editor.addTable('material'))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
    await ready()
    await wait(500)
    const table = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return { id: s.editingId, selected: String(getSelection()) } })
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCell', { timeout: 20000 }).catch(() => {})
    const caption = await page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id)?.caption, table.id)
    check('素材表を入れて、選ばれたタイトル「使用素材表」のまま Enter：タイトルは消えず、マスへ移る', caption === '使用素材表' && (await snap(page)).editingKind === 'tableCell', JSON.stringify({ ...table, caption, now: await snap(page) }))
    await page.keyboard.press('Escape')
    await wait(500)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 空にした小見出し（すぐ上が図2）を Backspace で消す
    const f2 = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'r2').figures[0].caption)
    await editAt(page, ready, 's3', 0)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    await wait(300)
    await page.keyboard.press('Backspace')
    await wait(900)
    const back = { ...(await snap(page)), sub: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).some((b) => b.id === 's3')), caption: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'r2').figures[0].caption) }
    check('空にした小見出しを Backspace で消すと、すぐ上の図のタイトルではなく、その前の段落へ移る（図のタイトルはそのまま）', !back.sub && back.editingId === 'p4b' && back.caption === f2, JSON.stringify(back))
    await page.keyboard.press('Escape')
    await wait(400)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 「改ページ」をダブルクリック
    const breaks = async () => (await blocksOf(page)).split(' ').filter((x) => x === 'PB').length
    const before = await breaks()
    await editAt(page, ready, 'p1', await lengthOf(page, 'p1'))
    const tool = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('改ページ')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.click(tool.x, tool.y, { clickCount: 1 })
    await page.mouse.click(tool.x, tool.y, { clickCount: 2 })
    await wait(1000)
    await ready()
    check('「改ページ」をダブルクリックしても、改ページは1つだけ入る（白紙のページを作らない）', (await breaks()) === before + 1, JSON.stringify({ before, after: await breaks() }))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 見出しの前に入れる
    const base = await blocksOf(page)
    await editAt(page, ready, 's2', 2)
    await ctrlEnter(page)
    const sub = { blocks: await blocksOf(page), ...(await snap(page)) }
    await page.keyboard.press('Escape')
    await wait(300)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    await editAt(page, ready, 'p3', 0)
    await page.keyboard.press('Home')
    await page.evaluate(() => window.__editor.addPageBreak())
    await wait(900)
    const underSub = await blocksOf(page)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    check(
      '小見出しを書いているとき・小見出しのすぐ下の段落の頭で改ページ：小見出しの前に入る（Ctrl+Enter のあとも同じ小見出しを書き続ける）',
      sub.blocks.includes('p2 PB s2') && sub.editingId === 's2' && underSub.includes('p2 PB s2 p3') && (await blocksOf(page)) === base,
      JSON.stringify({ sub, underSub }),
    )
    const chapters = await page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => c.id))
    await editAt(page, ready, chapters[1], 0)
    await ctrlEnter(page)
    const chapterBreak = await blocksOf(page)
    await page.keyboard.press('Escape')
    await wait(300)
    await ready()
    await editAt(page, ready, chapters[0], 0)
    await ctrlEnter(page)
    const firstChapter = { blocks: await blocksOf(page), toast: await toast(page) }
    await page.keyboard.press('Escape')
    await wait(400)
    // 2章目からも入れない（どの章も新しいページから始まる。前の章の終わりに入れても紙面は変わらなかった：学生の試し 2回目 2026-10-29）
    check(
      '大見出しで改ページ：どの章でも入れず、「章（大見出し）は、もともと新しいページから始まります」',
      chapterBreak === base && firstChapter.blocks === base && firstChapter.toast.includes('もともと新しいページから'),
      JSON.stringify({ chapterBreak: chapterBreak.split(' | ').slice(0, 2), firstChapter }),
    )

    // Ctrl+Enter を段落の終わりで：改ページの後ろの新しい段落で書き続ける
    await editAt(page, ready, 'p1', await lengthOf(page, 'p1'))
    await ctrlEnter(page)
    await page.keyboard.type('次のページ')
    await wait(600)
    const cont = { blocks: await blocksOf(page), ...(await snap(page)) }
    const contText = cont.editingId ? await textOf(page, cont.editingId) : null
    check('段落の終わりで Ctrl+Enter：改ページの後ろの新しい段落で書き続け、打った字が入る', /p1 PB p-\S+ p2/.test(cont.blocks) && contText === '次のページ', JSON.stringify({ blocks: cont.blocks.split(' | ')[0], editing: cont.editingId, contText }))
    await page.keyboard.press('Escape')
    await wait(400)
    await page.evaluate(() => window.__editor.undo())
    await wait(300)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // Esc で書き終えたときも「。」
    await editAt(page, ready, 'p2', await lengthOf(page, 'p2'))
    await page.keyboard.type('さらに書き足した')
    await page.keyboard.press('Escape')
    await wait(900)
    const escText = await textOf(page, 'p2')
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    const escUndo = await textOf(page, 'p2')
    check('Esc で書き終えたときも、段落の終わりに「。」を付ける（元に戻すと「。」だけ外れる）', escText.endsWith('さらに書き足した。') && escUndo.endsWith('さらに書き足した'), JSON.stringify({ escText: escText.slice(-12), escUndo: escUndo.slice(-12) }))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 学籍番号を全角で
    await editAt(page, ready, 'basic:studentId', 0)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    const cdp = await page.createCDPSession()
    await cdp.send('Input.insertText', { text: '２３ｂｋ０４５６' })
    await page.keyboard.press('Enter')
    await wait(800)
    const id = await page.evaluate(() => window.__editor.getSnapshot().report.basicInfo.studentId)
    check('学籍番号を全角で「２３ｂｋ０４５６」と打っても、書き終えると「23BK0456」', id === '23BK0456', id)
    // 形の違う学籍番号は「学籍番号の形式を確認する」（年度の設定に形がなくても）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: 'あ' } })))
    await wait(900)
    const idFormat = await page.evaluate(() => window.__editor.getSnapshot().findings.some((f) => f.ruleId === 'student-id-format'))
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '23BK0456' } })))
    await wait(900)
    const idOk = !(await page.evaluate(() => window.__editor.getSnapshot().findings.some((f) => f.ruleId === 'student-id-format')))
    check('形の違う学籍番号（「あ」）には「学籍番号の形式を確認する」を出す（23BK0456 には出さない）', idFormat && idOk, JSON.stringify({ idFormat, idOk }))
    await page.keyboard.press('Escape').catch(() => {})
    await wait(300)

    // 図を含めて範囲を消す
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    const ends = await page.evaluate(() => {
      const a = document.querySelector('.page-viewport.front [data-block-id="p3"]').getBoundingClientRect()
      const b = document.querySelector('.page-viewport.front [data-block-id="p4"]').getBoundingClientRect()
      return { x1: a.left + 6, y1: a.top + 6, x2: b.left + 40, y2: b.top + 6 }
    })
    await page.mouse.move(ends.x1, ends.y1)
    await page.mouse.down()
    await page.mouse.move(ends.x2, ends.y2, { steps: 12 })
    await page.mouse.up()
    await wait(500)
    await page.keyboard.press('Backspace')
    await wait(900)
    const rangeNote = await toast(page)
    check('図を含めて範囲を消すと、知らせに「（図1も）」と出る', rangeNote.includes('選んだ文を削除しました（図1も）'), rangeNote)
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()

    // 前の欄の「1行目だけを貼り付けました」
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    await editAt(page, ready, 'f1', 0)
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', '一行目\n二行目')
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await wait(600)
    const pasted = await toast(page)
    await editAt(page, ready, 'p4', 0)
    await wait(400)
    const moved = await toast(page)
    check('前の欄の「1行目だけを貼り付けました」は、ほかの欄を書き始めたら消える', pasted.includes('1行目だけを貼り付けました') && !moved.includes('1行目だけ'), JSON.stringify({ pasted, moved }))
    await page.keyboard.press('Escape')
    await wait(300)
    await context.close()
  }

  // ---- パソコン：右の欄の「表紙」・「つぎにすること」の × ----
  {
    let asked = ''
    const { context, page, ready } = await open(browser, { sample: false, confirm: (text) => { if (!text.includes('まだ確かめていない項目')) return true; asked = text; return false } })
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await wait(800)
    const cover = await page.evaluate(() => { const li = [...document.querySelectorAll('.side .check-prog li')].find((x) => x.querySelector('.l')?.textContent === '表紙'); const l = li?.querySelector('.l'); return l ? { lines: l.getClientRects().length, h: Math.round(l.getBoundingClientRect().height), v: li.querySelector('.v').textContent } : null })
    check('セルフチェックの「表紙」は1行のまま（「表／紙」に割れない）', !!cover && cover.h < 26 && cover.v.includes('がまだ'), JSON.stringify(cover))

    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ9999' } })))
    await wait(500)
    // Word を読み込む →「つぎにすること」の ×（やめる → 閉じない）
    if (!(await page.$('.side .head-menu'))) await page.click('.side .menu-btn')
    await page.waitForSelector('.side .head-menu [role="menuitem"]')
    await page.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].find((b) => b.textContent.includes('Word で書いた分を読み込む')).click())
    await page.waitForSelector('.word-file .acts button:not(.link)', { timeout: 20000 })
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[0].click())])
    await chooser.accept([fileURLToPath(new URL('word-sample-body.docx', FIX))])
    await wait(500)
    // 表紙の Word も（表紙の項目が、いまの値から替わることを出す）
    const [coverChooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[1].click())])
    await coverChooser.accept([fileURLToPath(new URL('word-sample-cover.docx', FIX))])
    await page.waitForFunction(() => document.querySelector('.word-file.picked'), { timeout: 20000 })
    await wait(800)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる'))?.click())
    await page.waitForFunction(() => [...document.querySelectorAll('.modal .row-buttons button')].some((b) => b.textContent.includes('読み込む') && !b.disabled), { timeout: 60000 }).catch(async (e) => {
      console.log('word:', JSON.stringify(await page.evaluate(() => ({ buttons: [...document.querySelectorAll('.modal .row-buttons button')].map((b) => `${b.textContent}${b.disabled ? '(off)' : ''}`), text: document.querySelector('.modal')?.innerText.slice(-400), err: document.querySelector('.word-error, .word-file small.err')?.textContent ?? '' }))))
      throw e
    })
    const sticky = await page.evaluate(() => getComputedStyle(document.querySelector('.modal.word-modal > .row-buttons:last-child')).position)
    const was = await page.evaluate(() => document.querySelector('.word-cover small.was')?.textContent ?? '')
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('読み込む')).click())
    await page.waitForFunction(() => !document.querySelector('.modal') && !!document.querySelector('.side .word-todo'), { timeout: 60000 })
    await ready()
    await page.evaluate(() => document.querySelector('.side .word-todo .x.close').click())
    await wait(800)
    const kept = !!(await page.$('.side .word-todo'))
    // 「つぎにすること」が出ている間も、メニューに「Word で書いた分を読み込む」を残す
    await page.click('.side .menu-btn')
    await page.waitForSelector('.side .head-menu [role="menuitem"]')
    const menuWord = await page.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].some((b) => b.textContent.includes('Word で書いた分を読み込む')))
    await page.keyboard.press('Escape')
    await wait(300)
    check('Word の確かめる窓：読み込むと替わる表紙の項目に「今は「00ZZ9999」。読み込むと替わります」。「つぎにすること」が出ている間も、メニューに「Word で書いた分を読み込む」がある', was.includes('今は「00ZZ9999」') && menuWord, JSON.stringify({ was, menuWord }))
    check('「つぎにすること」の ×：まだの項目があれば確かめ、「やめる」なら閉じない。Word の確かめる窓のボタンの段は、窓の下に止まる', kept && /まだ確かめていない項目が\d+つあります/.test(asked) && sticky === 'sticky', JSON.stringify({ kept, asked: asked.slice(0, 40), sticky }))
    await context.close()
  }

  // ---- 見た目の直し（mockups/v73。パソコン 1366×768） ----
  {
    const { context, page, ready } = await open(browser, { zoomTip: true })
    await page.mouse.move(5, 5)
    // ④ はじめの1回だけ、表示の帯の上に「字が小さいときは…」。× で閉じると、もう出ない
    await wait(500)
    const tip = await page.evaluate(() => document.querySelector('.view-bar .zoom-tip')?.textContent ?? '')
    await page.evaluate(() => document.querySelector('.view-bar .zoom-tip button').click())
    await wait(300)
    const tipGone = { now: !!(await page.$('.zoom-tip')), saved: await page.evaluate(() => localStorage.getItem('sotsugyo-seisaku-report-zoom-tip')) }
    check('ノートパソコンの画面で、はじめの1回だけ「字が小さいときは「＋」か、…Ctrl を押しながらホイールを…」。× で閉じると、もう出ない', tip.includes('字が小さいときは') && tip.includes('Ctrl') && !tipGone.now && tipGone.saved === 'done', JSON.stringify({ tip, tipGone }))
    // ⑤ 押せない「図を入れる」を押すと、横に吹き出しでわけ
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    const fig = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right } })
    await page.mouse.click(fig.x, fig.y)
    await wait(300)
    const bubble = await page.evaluate(() => { const b = document.querySelector('.why-bubble'); return b ? { text: b.textContent, left: Math.round(b.getBoundingClientRect().left) } : null })
    check('押せない「図を入れる」を押すと、ボタンの右に「図・表は、紙面の入れたい所（段落の中）をクリックしてから押します」', !!bubble && bubble.text.includes('クリックしてから押します') && bubble.left >= fig.right, JSON.stringify({ bubble, right: fig.right }))
    await page.mouse.click(5, 300)
    await wait(300)
    // ⑥ 本文のページの言い方
    const pages = await page.evaluate(() => [...document.querySelectorAll('.side .check-prog li')].find((li) => li.querySelector('.l')?.textContent === '本文のページ')?.querySelector('.v')?.textContent ?? '')
    check('右の欄の本文のページは「6ページ（5ページ以上）」の言い方', /^\d+ページ（5ページ以上）$/.test(pages), pages)
    // ② 画面の下の知らせは、紙面の台の上の真ん中
    await page.evaluate(() => window.__editor.removeBlock('p3'))
    await wait(900)
    const toastPos = await page.evaluate(() => { const t = document.querySelector('.stage .undo-area.on-stage .undo-toast')?.getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); return t ? { top: Math.round(t.top - s.top), center: Math.round(t.left + t.width / 2 - (s.left + s.width / 2)) } : null })
    check('「段落を削除しました［戻す］」は、紙面の台の上の真ん中に出る（最後の行に重ならない）', !!toastPos && toastPos.top < 40 && Math.abs(toastPos.center) < 4, JSON.stringify(toastPos))
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    // ⑦ 作品写真の空の枠
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: r.workPhotos.map((p) => ({ ...p, imageIds: p.imageIds.map(() => '') })) })))
    await wait(1200)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    const slot = await page.evaluate(() => { const e = document.querySelector('.page-viewport.front [data-photo-slot]:empty'); return e ? getComputedStyle(e, '::before').content : null })
    check('作品写真の空の枠に、大きな「＋ 写真を選ぶ（ここをクリック）」', !!slot && slot.includes('写真を選ぶ') && slot.includes('ここをクリック'), slot)
    await context.close()
  }

  // ---- スマホの並べ方をマウスで使う（窓の幅 900px）：Ctrl＋ホイールで紙面を広げる ----
  {
    const { context, page, ready } = await open(browser, { viewport: { width: 900, height: 800 } })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    const phoneLayout = await page.evaluate(() => !!document.querySelector('.app.phone'))
    const before = await page.evaluate(() => window.__editor.getSnapshot().zoomed)
    const prevented = await page.evaluate(() => { const el = document.querySelector('.page-viewport.front'); const r = el.getBoundingClientRect(); return !el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })) })
    await wait(800)
    const after = await page.evaluate(() => window.__editor.getSnapshot().zoomed)
    check('窓が狭くスマホの並べ方になっても、マウスなら Ctrl＋ホイールで紙面が広がる（ブラウザの拡大ではなく）', phoneLayout && !before && prevented && after, JSON.stringify({ phoneLayout, before, prevented, after }))
    await context.close()
  }

  // ---- スマホ：書いている間の「戻す」「やり直す」 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    const len = await lengthOf(page, 'p1')
    await page.evaluate((len) => window.__editor.openEditor('p1', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 20000 })
    await wait(800)
    const original = await textOf(page, 'p1')
    const cdp = await page.createCDPSession()
    await cdp.send('Input.insertText', { text: '一つ目の文を足した。' })
    await wait(1500)
    await cdp.send('Input.insertText', { text: '二つ目の文。' })
    await wait(1500)
    const typed = await textOf(page, 'p1')
    const tapBar = async (name) => {
      const p = await page.evaluate((name) => { const b = [...document.querySelectorAll('.direct-bar button')].find((x) => x.textContent.includes(name)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, name)
      if (!p) throw new Error(`見つからない：${name}`)
      await page.touchscreen.tap(p.x, p.y)
      await wait(700)
    }
    const order = await page.evaluate(() => { const row = [...document.querySelectorAll('.direct-bar .db-row')].find((r) => !r.classList.contains('db-add') && !r.classList.contains('db-table')); const del = [...row.querySelectorAll('button')].find((b) => b.textContent.includes('削除')); const undo = [...row.querySelectorAll('button')].find((b) => b.textContent.includes('戻す')); const done = row.querySelector('.db-done'); return { del: Math.round(del.getBoundingClientRect().left), undo: Math.round(undo.getBoundingClientRect().left), gap: Math.round(done.getBoundingClientRect().left - del.getBoundingClientRect().right) } })
    check('スマホ：書いている間の「削除」は、帯の左の端（「完了」から離す）', order.del < order.undo && order.gap > 100, JSON.stringify(order))
    await tapBar('戻す')
    await tapBar('戻す')
    const undone = await textOf(page, 'p1')
    await tapBar('やり直す')
    await tapBar('やり直す')
    const redone = await textOf(page, 'p1')
    // 「完了」で書き終えたときも「。」
    await cdp.send('Input.insertText', { text: 'もう一文' })
    await wait(800)
    await tapBar('完了')
    await wait(900)
    const done = await textOf(page, 'p1')
    check('スマホ：「完了」で書き終えたときも、段落の終わりに「。」を付ける', done.endsWith('もう一文。'), done.slice(-10))
    check('スマホ：書いている間の「戻す」2回で書いた文が戻り、「やり直す」2回で全部もとに戻る', typed === `${original}一つ目の文を足した。二つ目の文。` && undone === original && redone === typed, JSON.stringify({ original: original.slice(-10), typed: typed.slice(-16), undone: undone.slice(-10), redone: redone.slice(-16) }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
