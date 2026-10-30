// 学生の試し 5回目（2026-10-30。4回目の直しの確かめ・提出前チェック・貼り付けて書く・大きく直す。poc-output/firsttime/r1029/まとめ5.md）の A の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030c
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

async function open(browser, { sample = true, confirms = [] } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1366, height: 768 })
  await stubConfig(page)
  await answerConfirms(page, (text) => {
    confirms.push(text)
    return true
  })
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
  if (sample) {
    await page.evaluate(setupWriting)
    await wait(600)
    await ready()
  }
  return { context, page, ready }
}
const report = (page) => page.evaluate(() => window.__editor.getSnapshot().report)
const textOf = (page, id) => page.evaluate((id) => { const b = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((x) => x.id === id); return b?.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : b?.type === 'subheading' ? b.title : null }, id)
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
/** 書く欄に貼り付ける（ほかのアプリからコピーした中身。text/plain と、あれば text/html） */
const paste = (page, text, html = '') =>
  page.evaluate((text, html) => {
    const el = document.querySelector('.overlay-editor')
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    if (html) dt.setData('text/html', html)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text, html)
const settle = async (page, ready) => {
  await wait(1200)
  await ready()
}
const undo = async (page, ready) => {
  await page.evaluate(() => window.__editor.undo())
  await settle(page, ready)
}

await withEdge(async (browser) => {
  // ---- 欄を移りながら書いたあとの「元に戻す」 ----
  {
    const { context, page, ready } = await open(browser)
    const p1 = await textOf(page, 'p1')
    const p2 = await textOf(page, 'p2')
    await editAt(page, ready, 'p1', p1.length)
    await page.keyboard.type('Ｚ。')
    await page.keyboard.press('Escape')
    await settle(page, ready)
    await editAt(page, ready, 'p2', p2.length)
    await page.keyboard.type('Ｑ。')
    await page.keyboard.press('ArrowDown')
    await wait(800)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    await undo(page, ready)
    const after = { p1: (await textOf(page, 'p1')).slice(-4), p2: (await textOf(page, 'p2')).slice(-4) }
    check('↓ で次の段落へ移りながら書いて、元に戻す1回：移る前の段落の直し（Ｑ。）だけが戻り、その前の別の段落の直し（Ｚ。）は残る', after.p1.endsWith('Ｚ。') && !after.p2.includes('Ｑ'), JSON.stringify(after))

    // 表のマス：Tab で移りながら書く
    const cells = await page.evaluate(() => { const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table'); return t.rows[1].cells.map((c) => ({ id: c.id, text: c.text })) })
    await editAt(page, ready, cells[0].id, cells[0].text.length)
    await page.keyboard.type('Ａ')
    await page.keyboard.press('Tab')
    await wait(600)
    await page.keyboard.type('Ｂ')
    await page.keyboard.press('Escape')
    await settle(page, ready)
    await undo(page, ready)
    const cellTexts = await page.evaluate((ids) => { const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table'); return ids.map((id) => t.rows.flatMap((r) => r.cells).find((c) => c.id === id)?.text) }, cells.map((c) => c.id))
    check('表のマスを Tab で移りながら書いて、元に戻す1回：後のマス（Ｂ）だけが戻り、前のマス（Ａ）は残る', cellTexts[0].endsWith('Ａ') && !cellTexts[1].includes('Ｂ'), JSON.stringify(cellTexts))

    // やり直すものがないときの Ctrl+Y
    await editAt(page, ready, 'p1', 10)
    await page.keyboard.press('Enter')
    await wait(800)
    await ctrl(page, 'KeyZ')
    await wait(900)
    await page.keyboard.type('あ', { delay: 50 })
    await ctrl(page, 'KeyY')
    await wait(300)
    await page.keyboard.type('い', { delay: 50 })
    await settle(page, ready)
    const redoNone = { editing: await page.evaluate(() => window.__editor.getSnapshot().editingId), text: (await textOf(page, 'p1')).slice(8, 14) }
    await page.keyboard.press('Escape')
    await settle(page, ready)
    check('やり直すものがないのに Ctrl+Y を押しても、書く欄は閉じず、続けて打った字が入る', redoNone.editing === 'p1' && redoNone.text.includes('あい'), JSON.stringify(redoNone))
    await context.close()
  }

  // ---- 貼り付け ----
  {
    const { context, page, ready } = await open(browser)
    // 打ってから何段落かを貼り、元に戻す1回：貼ったものだけ戻る
    const p1 = await textOf(page, 'p1')
    await editAt(page, ready, 'p1', p1.length)
    await page.keyboard.type('ＸＹ')
    await paste(page, '一行目の文。\n二行目の文。')
    await settle(page, ready)
    const pasted = await textOf(page, 'p1')
    await page.keyboard.press('Escape')
    await settle(page, ready)
    await undo(page, ready)
    const back = await textOf(page, 'p1')
    check('打ってから何段落かを貼り、元に戻す1回：貼ったものだけが戻り、先に打った字（ＸＹ）は残る', pasted.endsWith('ＸＹ一行目の文。') && back.endsWith('ＸＹ') && !back.includes('一行目'), JSON.stringify({ pasted: pasted.slice(-10), back: back.slice(-6) }))
    await page.evaluate((p1) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.filter((b) => !(b.type === 'paragraph' && b.id !== 'p1' && b.content.map((n) => n.text ?? '').join('') === '二行目の文。')).map((b) => (b.id === 'p1' ? { ...b, content: [{ type: 'text', text: p1 }] } : b)) })) })), p1)
    await settle(page, ready)

    // 空の段落に、番号つきの箇条書き・PDF の折り返し・Word の行の区切りを貼る
    const addEmpty = async () => {
      const id = `pe${Date.now() % 100000}`
      await page.evaluate((id) => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [...c.blocks, { type: 'paragraph', id, content: [{ type: 'text', text: '' }] }] } : c)) })), id)
      await settle(page, ready)
      await editAt(page, ready, id, 0)
      return id
    }
    const subsBefore = (await report(page)).body.flatMap((c) => c.blocks).filter((b) => b.type === 'subheading').length
    await addEmpty()
    await paste(page, '1.\tミシン\n2.\tアイロン\n3.\tロックミシン')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const listAfter = await report(page)
    const subsAfter = listAfter.body.flatMap((c) => c.blocks).filter((b) => b.type === 'subheading').length
    const listTexts = listAfter.body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph').map((b) => b.content.map((n) => n.text ?? '').join('')).filter((t) => /^[123][.．]/.test(t))
    check('番号つきの箇条書き（1.⇥ミシン…）を貼ると、小見出しにならず、段落のまま並ぶ', subsAfter === subsBefore && listTexts.length === 3, JSON.stringify({ subsBefore, subsAfter, listTexts }))

    const pdfId = await addEmpty()
    await paste(page, '本制作では、旅立ちの場面の若々しさと帰還の場面の頼もしさの両方を、一着で見せることを目標と\nした。前半は袖を軽く、後半は肩に重ねる布で頼もしさを出すように工夫して制作を\n進めた。')
    await settle(page, ready)
    const toast = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const pdfText = await textOf(page, pdfId)
    check('PDF からコピーした文（行の終わりごとの改行）は、つないで1段落にする（「行の途中の改行をつなぎました」）', pdfText?.startsWith('本制作では') && pdfText.endsWith('制作を進めた。') && toast.includes('行の途中の改行をつなぎました'), JSON.stringify({ pdfText: pdfText?.slice(-12), toast }))

    const vtId = await addEmpty()
    await paste(page, '袖の刺繍は\u000B金の糸で縫った。 糸の​色は﻿金。')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const all = JSON.stringify((await report(page)).body)
    check('Word の行の区切り（U+000B）・ノーブレークスペース・ゼロ幅の字は、そのまま入らない（紙面に「☒」が出ない）', !/[\u000B ​﻿]/.test(all) && (await textOf(page, vtId)) === '袖の刺繍は', JSON.stringify({ first: await textOf(page, vtId) }))

    // 段落ごとコピーした（終わりに改行）ものを、空の段落に2回貼る：2つの段落になる
    const twoId = await addEmpty()
    await paste(page, '一つ目の段落である。\n')
    await settle(page, ready)
    await paste(page, '二つ目の段落である。\n')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const twoTexts = (await report(page)).body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph').map((b) => b.content.map((n) => n.text ?? '').join('')).filter((t) => /つ目の段落/.test(t))
    check('段落ごと（終わりの改行まで）コピーしたものを2回貼ると、2つの段落になる（つながらない）', JSON.stringify(twoTexts) === JSON.stringify(['一つ目の段落である。', '二つ目の段落である。']), JSON.stringify({ twoId, twoTexts }))

    // 見出しの欄に番号ごと貼る
    const subId = (await report(page)).body.flatMap((c) => c.blocks).find((b) => b.type === 'subheading').id
    await editAt(page, ready, subId, 0)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await paste(page, '2-1 パターンと仮縫い')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    check('見出しの欄に「2-1 〇〇」と番号ごと貼ると、番号を外して入れる', (await textOf(page, subId)) === 'パターンと仮縫い', await textOf(page, subId))

    // 書く欄を開かずに Ctrl+V（本文のページ）
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    await page.evaluate(() => document.activeElement?.blur())
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', '貼る文'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
    await wait(500)
    const noOpen = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    check('本文のページで、書く欄を開かずに Ctrl+V すると「入れたい所を押して、書く欄を開いてから貼り付けます」', noOpen.includes('書く欄を開いてから貼り付けます'), noOpen)
    await context.close()
  }

  // ---- 下書きの全部を、まっさらの原稿に貼る ----
  {
    const { context, page, ready } = await open(browser, { sample: false })
    const first = await page.evaluate(() => window.__editor.getSnapshot().report.body[0].blocks.find((b) => b.type === 'paragraph')?.id)
    await editAt(page, ready, first, 0)
    const titles = await page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => c.title))
    await paste(page, titles.map((t, i) => `${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][i]}．${t}\n${t}について書いた本文である。`).join('\n'))
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const after = await page.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => c.title))
    check('下書きの全部（ひな形と同じ大見出しつき）を、まっさらの原稿に貼っても、大見出しが二重にならない', JSON.stringify(after) === JSON.stringify(titles), JSON.stringify({ titles, after }))
    await context.close()
  }

  // ---- 大きく直す：空の大見出しを消す・指摘を押すと直す語を選ぶ ----
  {
    const confirms = []
    const { context, page, ready } = await open(browser, { confirms })
    const before = (await report(page)).body.length
    await editAt(page, ready, 'p3', 2)
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.replace(/\s/g, '').endsWith('大見出し'))?.click())
    await settle(page, ready)
    await page.keyboard.type('空の章')
    await wait(300)
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.replace(/\s/g, '') === '削除')?.click())
    await settle(page, ready)
    const afterDel = (await report(page)).body.length
    check('中身が空の大見出しを消すときは、確かめの窓を出さない（すぐ消えて「戻す」が出る）', afterDel === before && confirms.length === 0, JSON.stringify({ before, afterDel, confirms }))

    // です・ますの指摘を押すと、直す語を選んで開く
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p1' ? { ...b, content: [{ type: 'text', text: '衣装を作りました。' }] } : b)) })) })))
    await settle(page, ready)
    const finding = await page.evaluate(() => window.__editor.getSnapshot().findings.find((f) => f.ruleId === 'desu-masu' && f.blockId === 'p1'))
    await page.evaluate((f) => window.__editor.goToFinding(f), finding)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 20000 })
    await wait(500)
    const selected = await page.evaluate(() => getSelection()?.toString() ?? '')
    check('「です・ます」の指摘を押すと、段落が開き、直す語が選ばれている（打つと置き換わる）', !!finding && selected.length > 0 && '衣装を作りました。'.includes(selected) && selected.includes('まし'), JSON.stringify({ selected, start: finding?.start, end: finding?.end }))
    await page.keyboard.press('Escape')
    await settle(page, ready)

    // Esc のあと、ほかのページを見ているときは「図を入れる」を押せない
    await editAt(page, ready, 'p1', 3)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const sameEnabled = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる')); return !(b.disabled || b.getAttribute('aria-disabled') === 'true') })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const otherEnabled = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('図を入れる')); return !(b.disabled || b.getAttribute('aria-disabled') === 'true') })
    check('Esc のあとの「図を入れる」は、書いていた段落が見えているページでだけ押せる（ほかのページでは押せない）', sameEnabled && !otherEnabled, JSON.stringify({ sameEnabled, otherEnabled }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
