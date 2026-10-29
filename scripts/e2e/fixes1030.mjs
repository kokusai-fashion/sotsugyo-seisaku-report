// 学生の試し 4回目（2026-10-30。3回目の直しの確かめ・iPad・画面の拡大とキーボード・何日もかけて書く。poc-output/firsttime/r1029/まとめ4.md）の A の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, { device = 'pc', sample = true, context: given } = {}) {
  const context = given ?? (await browser.createBrowserContext())
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  if (device === 'phone') await page.setUserAgent(IPHONE)
  await page.setViewport(device === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : device === 'zoom200' ? { width: 683, height: 384, deviceScaleFactor: 2 } : { width: 1366, height: 768 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  if (given) return { context, page, ready }
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
const blocks = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => ({ id: b.id, type: b.type, text: b.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b.type === 'subheading' ? b.title : '' })))
const textOf = async (page, id) => (await blocks(page)).find((b) => b.id === id)?.text ?? null
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(300)
}
const ctrl = async (page, key, shift = false) => {
  await page.keyboard.down('Control')
  if (shift) await page.keyboard.down('Shift')
  await page.keyboard.press(key)
  if (shift) await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
}
const center = (page, find) => page.evaluate((find) => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.replace(/\s/g, '') === find || x.textContent.replace(/\s/g, '').endsWith(find)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, find)
const editing = (page) => page.evaluate(() => { const s = window.__editor.getSnapshot(); return { id: s.editingId, kind: s.editingKind } })
const toast = (page) => page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
const addHeadingParagraph = async (page, ready, id, text) => {
  await page.evaluate((id, text) => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [{ type: 'paragraph', id, content: [{ type: 'text', text }] }, ...c.blocks] } : c)) })), id, text)
  await wait(1000)
  await ready()
}

await withEdge(async (browser) => {
  // ---- パソコン：ダブルクリック・元に戻す・やり直す ----
  {
    const { context, page, ready } = await open(browser)
    // A1：表の「削除」のダブルクリック
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('t1'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.select({ kind: 'table', id: 't1' }))
    await wait(500)
    const del = await center(page, '削除')
    await page.mouse.click(del.x, del.y, { count: 2 })
    await wait(1500)
    await ready()
    const tableGone = !(await blocks(page)).some((b) => b.id === 't1')
    check('表を選んで左の道具の「削除」をダブルクリックしても、2回目が「元に戻す」に当たらず、表は消えたまま', tableGone, await toast(page))
    await page.evaluate(() => window.__editor.undo())
    await wait(800)
    await ready()

    // A2：「小見出しにする」のダブルクリック → 続けて打つ
    await addHeadingParagraph(page, ready, 'px', '2-1 パターンと仮縫い')
    await editAt(page, ready, 'px', 12)
    const conv = await center(page, '小見出しにする')
    await page.mouse.click(conv.x, conv.y, { count: 2 })
    await page.keyboard.type('の記録', { delay: 60 })
    await wait(1200)
    await ready()
    const dbl = await page.evaluate(() => { const s = window.__editor.getSnapshot(); const c = s.report.body[1]; return { first: c.blocks[0]?.type, title: c.blocks[0]?.title, kind: s.editingKind } })
    await page.keyboard.press('Escape')
    await wait(600)
    check('「小見出しにする」をダブルクリックしても、書く欄は閉じず、続けて打った字が小見出しに入る', dbl.first === 'subheading' && dbl.title === 'パターンと仮縫いの記録' && dbl.kind === 'subheading', JSON.stringify(dbl))

    // A3：「小見出しにする」→ Ctrl+Z → 打つ
    await addHeadingParagraph(page, ready, 'py', '2-2 裁断の工夫')
    await editAt(page, ready, 'py', 9)
    const conv2 = await center(page, '小見出しにする')
    await page.mouse.click(conv2.x, conv2.y)
    await wait(1200)
    await ready()
    await ctrl(page, 'KeyZ')
    await page.keyboard.type('X', { delay: 60 })
    await wait(1200)
    await ready()
    const back = { text: await textOf(page, 'py'), ...(await editing(page)) }
    await page.keyboard.press('Escape')
    await wait(600)
    check('「小見出しにする」のすぐあとに Ctrl+Z → 打つと、段落に戻り、打った字がその段落に入る', back.id === 'py' && back.text === '2-2 裁断の工夫X', JSON.stringify(back))

    // A4：Ctrl+Enter → Ctrl+Z を2回 → 打つ
    const p1 = await textOf(page, 'p1')
    await editAt(page, ready, 'p1', p1.length)
    await page.keyboard.type('あ')
    await ctrl(page, 'Enter')
    await wait(700)
    await ctrl(page, 'KeyZ')
    await wait(700)
    await ctrl(page, 'KeyZ')
    await page.keyboard.type('いう', { delay: 60 })
    await wait(1200)
    await ready()
    const twice = { text: (await textOf(page, 'p1')).slice(-6), ...(await editing(page)) }
    await page.keyboard.press('Escape')
    await wait(600)
    check('段落に書き足して Ctrl+Enter → Ctrl+Z を2回 → 打つと、書く欄は開いたままで、打った字が段落の終わりに入る', twice.id === 'p1' && twice.text.endsWith('いう') && !twice.text.includes('あ'), JSON.stringify(twice))
    await page.evaluate((p1) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p1' ? { ...b, content: [{ type: 'text', text: p1 }] } : b)) })) })), p1)
    await wait(800)
    await ready()

    // A5：Enter → Ctrl+Z → Ctrl+Y（書いている間）
    const before = (await blocks(page)).length
    await editAt(page, ready, 'p1', 10)
    await page.keyboard.press('Enter')
    await wait(800)
    await ctrl(page, 'KeyZ')
    await wait(900)
    const undone = (await blocks(page)).length
    await ctrl(page, 'KeyY')
    await wait(1200)
    await ready()
    const redone = { count: (await blocks(page)).length, ...(await editing(page)) }
    await page.keyboard.press('Escape')
    await wait(600)
    check('書いている間に Enter → Ctrl+Z → Ctrl+Y で、段落の分け目がやり直され、書く欄は開いたまま', undone === before && redone.count === before + 1 && !!redone.id, JSON.stringify({ before, undone, redone }))
    await page.evaluate(() => window.__editor.undo())
    await wait(800)
    await ready()

    // A22：書いていないときの「改ページ」は、どこに入ったかを知らせる
    await page.evaluate(() => window.__editor.select({ kind: 'table', id: 't1' }))
    await wait(300)
    await page.evaluate(() => window.__editor.select(null))
    await wait(300)
    const pb = await center(page, '改ページ')
    await page.mouse.click(pb.x, pb.y)
    await wait(800)
    const pbToast = await toast(page)
    check('書いていないときに「改ページ」を押すと、「◯◯の後ろに、改ページを入れました」と知らせる', pbToast.includes('の後ろに、改ページを入れました'), pbToast)
    await page.evaluate(() => window.__editor.undo())
    await wait(800)
    await ready()

    // A20：表の大きさのメニューで、いちばん下から ↓ で「素材表」、Enter で入る
    const tablesBefore = (await blocks(page)).filter((b) => b.type === 'table').length
    await editAt(page, ready, 'p6', (await textOf(page, 'p6')).length)
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('表を入れる'))?.click())
    await page.waitForSelector('.table-menu .tgrid button', { timeout: 10000 })
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown')
    const mat = await page.evaluate(() => !!document.querySelector('.table-menu > button.kb-on'))
    await page.keyboard.press('Enter')
    await wait(1500)
    await ready()
    const added = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'table').map((b) => b.rows[0].cells.map((c) => c.text).join('|')))
    check('表の大きさのメニューで、いちばん下の行から ↓ で「素材表」が選ばれ、Enter で素材表が入る', mat && added.length === tablesBefore + 1 && added.some((h) => h.includes('生地見本')), JSON.stringify({ mat, added }))
    await page.keyboard.press('Escape')
    await wait(500)

    // A18：F6 で右の欄へ
    await page.evaluate(() => document.activeElement?.blur())
    let inSide = false
    for (let i = 0; i < 4 && !inSide; i++) {
      await page.keyboard.press('F6')
      await wait(200)
      inSide = await page.evaluate(() => !!document.activeElement?.closest('aside.side'))
    }
    check('F6 を押すと、ページの一覧・道具・紙面・右の欄を順に移り、4回以内に右の欄へ届く', inSide)

    // A19：拡大した紙面を ↓ で動かす
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => [...document.querySelectorAll('.view-bar .zoom-step button')].pop()?.click())
      await wait(300)
    }
    await ready()
    await page.evaluate(() => document.activeElement?.blur())
    const top0 = await page.evaluate(() => document.querySelector('.page-scroller').scrollTop)
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await wait(300)
    const top1 = await page.evaluate(() => document.querySelector('.page-scroller').scrollTop)
    check('道具の「＋」で拡大した紙面を、↓ で下へ動かせる', top1 > top0, JSON.stringify({ top0, top1 }))
    await context.close()
  }

  // ---- パソコン：「つぎにすること」は、確かめている途中の1つだけに「確かめた」 ----
  {
    const { context, page, ready } = await open(browser)
    // 表紙を埋めておく（空の項目があると「確かめた」を出さないため）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '24DC1234', name: '文化　花子', subtitleInput: 'ドレス' } })))
    await wait(1200)
    await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-word-todo', JSON.stringify({ at: new Date().toISOString(), snapshotAt: null, figuresSeen: 0, coverSeen: false, coverChecked: false, pagesSeen: true, pagesChecked: false, doing: 'pages' })))
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await page.waitForSelector('.side .word-todo', { timeout: 20000 })
    await page.evaluate(() => [...document.querySelectorAll('.side .word-todo .go')].find((b) => b.textContent === '表紙へ')?.click())
    await wait(1000)
    await ready()
    const todo = await page.evaluate(() => [...document.querySelectorAll('.side .word-todo > ul > li')].map((li) => ({ name: li.querySelector('b')?.textContent, button: li.querySelector('button.go')?.textContent ?? '', note: !!li.querySelector(':scope > div > small') })))
    const confirms = todo.filter((t) => t.button === '確かめた')
    check('「本文へ」のあと「表紙へ」を押すと、「確かめた」と説明は表紙の1つだけ（図と改ページは「本文へ」に戻る）', confirms.length === 1 && confirms[0].name === '表紙を確かめる' && todo.find((t) => t.name?.includes('改ページ'))?.button === '本文へ', JSON.stringify(todo))
    await context.close()
  }

  // ---- 何日もかけて書く：開いたときの原稿を控えに残す・タブの書けない窓が自分で消える ----
  {
    const { context, page, ready } = await open(browser)
    await wait(1500)
    // 次の日：開き直して、最初に図を消す
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    const figureId = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'figureRow')?.figures[0]?.id ?? null)
    await page.evaluate((id) => window.__editor.select({ kind: 'figure', id }), figureId)
    await page.evaluate(() => window.__editor.removeSelected())
    await wait(2500)
    const kept = await page.evaluate(async (figureId) => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('sotsugyo-seisaku-report'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
      const all = await new Promise((res) => { const q = db.transaction('snapshots', 'readonly').objectStore('snapshots').getAll(); q.onsuccess = () => res(q.result) })
      return all.filter((s) => !s.keep).map((s) => JSON.stringify(s.report).includes(figureId))
    }, figureId)
    check('開き直してすぐ図を消しても、開いたときの原稿（図のある原稿）が自動の控えに残る', !!figureId && kept.includes(true), JSON.stringify({ figureId, kept }))

    // 2つめのタブ：書けない窓 → 前のタブを閉じると、自分で読み込み直して書けるようになる
    const second = await open(browser, { context })
    const locked = await second.page.waitForSelector('.tab-locked', { timeout: 30000 }).then(() => true, () => false)
    const reloaded = second.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).then(() => true, () => false)
    await page.close()
    const didReload = await reloaded
    await second.page.waitForFunction(() => window.__editor?.getSnapshot()?.layout && !document.querySelector('.loading'), { timeout: 60000 }).catch(() => {})
    await wait(800)
    const freed = !(await second.page.$('.tab-locked'))
    check('2つめのタブの「別のタブで開いています」は、前のタブを閉じると、自分で読み込み直して消える', locked && didReload && freed, JSON.stringify({ locked, didReload, freed }))
    await context.close()
  }

  // ---- スマホ：「追加」→「小見出し」をすばやく2回 ----
  {
    const { context, page, ready } = await open(browser, { device: 'phone' })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p3', 4))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p3', { timeout: 20000 })
    await wait(800)
    const subsBefore = (await blocks(page)).filter((b) => b.type === 'subheading').length
    await page.evaluate(() => [...document.querySelectorAll('.direct-bar button')].find((b) => b.textContent.includes('追加'))?.click())
    await page.waitForSelector('.direct-bar .db-add button', { timeout: 10000 })
    const sub = await page.evaluate(() => { const b = [...document.querySelectorAll('.direct-bar .db-add button')].find((x) => x.textContent.includes('小見出し')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.touchscreen.tap(sub.x, sub.y)
    await wait(120)
    await page.touchscreen.tap(sub.x, sub.y)
    await wait(300)
    await page.keyboard.type('帯の工夫', { delay: 60 })
    await wait(1500)
    await ready()
    const after = await blocks(page)
    const now = await editing(page)
    const added = after.filter((b) => b.type === 'subheading')
    check('スマホ：「追加」→「小見出し」をすばやく2回押しても、小見出しは1つだけで、打った字は新しい小見出しに入る（ほかの見出しに入らない）', added.length === subsBefore + 1 && now.kind === 'subheading' && added.filter((b) => b.text.includes('帯の工夫')).length === 1 && added.find((b) => b.id === now.id)?.text === '帯の工夫', JSON.stringify({ now, added: added.map((b) => b.text) }))
    await context.close()
  }

  // ---- 150%・200%（スマホの形のパソコン）：はじめての案内の表紙の欄に、打った字が入る。Esc で案内を閉じる ----
  {
    const { context, page, ready } = await open(browser, { device: 'zoom200', sample: false })
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:studentId', { timeout: 20000 }).catch(() => {})
    await wait(500)
    await page.keyboard.type('24DC1234', { delay: 40 })
    await page.keyboard.press('Enter')
    await wait(1200)
    const id = await page.evaluate(() => window.__editor.getSnapshot().report.basicInfo.studentId)
    const tip = await page.evaluate(() => document.querySelector('.guide .g-tip')?.textContent ?? '')
    check('200%（スマホの形のパソコン）でも、はじめての案内の学籍番号の欄が開き、打った字が入る（言葉は「Enter で次へ」）', id === '24DC1234' && !tip.includes('タップ'), JSON.stringify({ id, tip: tip.slice(0, 60) }))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:name', { timeout: 20000 }).catch(() => {})
    await wait(400)
    await page.keyboard.press('Escape')
    await wait(1200)
    await ready()
    const guide = await page.evaluate(() => ({ guide: !!document.querySelector('.guide'), name: window.__editor.getSnapshot().report.basicInfo.name }))
    check('表紙の案内で Esc を押すと、次の欄へ進まずに案内を閉じる', !guide.guide, JSON.stringify(guide))
    await context.close()
  }

  // ---- パソコン：「表紙ができました」の窓 ----
  {
    const { context, page, ready } = await open(browser, { sample: false })
    for (const [field, text] of [['basic:studentId', '24DC1234'], ['basic:name', '文化　花子'], ['basic:subtitleInput', 'ドレス']]) {
      await page.waitForFunction((f) => window.__editor.getSnapshot().editingId === f, { timeout: 20000 }, field).catch(() => {})
      await wait(300)
      await page.keyboard.type(text, { delay: 30 })
      await page.keyboard.press('Enter')
      await wait(800)
    }
    await page.waitForSelector('.guide.step-done', { timeout: 20000 }).catch(() => {})
    await wait(500)
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    await page.keyboard.press('Escape')
    await wait(800)
    const closed = !(await page.$('.guide'))
    check('「表紙ができました」では「本文へ進む」にフォーカスが入り、Esc で閉じる', focused === '本文へ進む' && closed, JSON.stringify({ focused, closed }))
    await ready()
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
