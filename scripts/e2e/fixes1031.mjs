// 学生の試し（2026-10-31。録画つきの学生役 2回目。poc-output/trial-1031b/journal.md）の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1031
import { resolve } from 'node:path'
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
  await page.setViewport({ width: 1366, height: 768 })
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

await withEdge(async (browser) => {
  // 段落に「（図4）」まで打って Enter → 空の段落で「図を入れる」：先に打った「（図4）」が、入れた図へのリンクになる
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p16'), 'none'))
    await ready()
    const end = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p16').content.map((n) => n.text ?? '').join('').length)
    await page.evaluate((end) => window.__editor.openEditor('p16', end), end)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p16', { timeout: 20000 })
    await wait(300)
    await page.keyboard.type('完成した衣装を示す（図4）。')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return s.editingKind === 'paragraph' && s.editingId !== 'p16' }, { timeout: 20000 })
    await wait(300)
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => void window.__editor.addFigure())])
    await chooser.accept([resolve('docs/guide-images/sample/photo-1.jpg')])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'figureCaption', { timeout: 30000 })
    await page.keyboard.type('完成した衣装')
    await page.keyboard.press('Escape')
    await ready()
    await wait(800)
    const got = await page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const blocks = s.report.body.flatMap((c) => c.blocks)
      const p16 = blocks.find((b) => b.id === 'p16')
      const row = blocks.find((b) => b.type === 'figureRow' && b.figures.some((f) => f.caption === '完成した衣装'))
      return {
        text: p16.content.map((n) => (n.type === 'ref' ? `[ref:${n.targetId === row?.figures[0].id ? 'new' : n.targetId}]` : n.text)).join(''),
        next: blocks[blocks.indexOf(p16) + 1]?.id === row?.id,
        typed: s.findings.filter((f) => f.title.includes('手で書いている') || f.title.includes('図がない')).map((f) => f.title),
      }
    })
    check(
      '「（図4）」まで打って Enter → 空の段落で「図を入れる」：先に打った「（図4）」が入れた図につながり、「図の番号を手で書いている」が出ない',
      got.text === '制作を通して、舞台衣装は客席からの見え方と演者の動きやすさの両方を考える必要があることを学んだ。この経験を、今後の衣装制作に生かしたい。完成した衣装を示す[ref:new]。' && got.next && got.typed.length === 0,
      JSON.stringify(got),
    )
    await context.close()
  }

  // 段落の終わりで Enter → 空の段落で「大見出し」：空の段落を前の章に残さない（小見出しと同じ）。画面は新しい章のページへ
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p5b'), 'none'))
    await ready()
    const end = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p5b').content.map((n) => n.text ?? '').join('').length)
    await page.evaluate((end) => window.__editor.openEditor('p5b', end), end)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p5b', { timeout: 20000 })
    await wait(300)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return s.editingKind === 'paragraph' && s.editingId !== 'p5b' }, { timeout: 20000 })
    await wait(300)
    await page.evaluate(() => window.__editor.addChapter())
    // 組み直して、新しい章のページへ移るのを待ってから打つ（人が見出しを打ち始めるまでの間）
    await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); const c = s.report.body.find((x) => x.title === ''); return s.editingKind === 'chapter' && c && s.page === window.__editor.pageOfBlock(c.id) }, { timeout: 20000 })
    await page.keyboard.type('新しい章')
    await page.keyboard.press('Escape')
    await ready()
    await wait(800)
    const got = await page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const i = s.report.body.findIndex((c) => c.title === '新しい章')
      return {
        tail: s.report.body[i - 1]?.blocks.at(-1)?.id,
        page: s.page,
        chapterPage: window.__editor.pageOfBlock(s.report.body[i].id),
        undo: null,
      }
    })
    // 元に戻すと、空の段落も戻る（章を作る前に戻る）
    await page.keyboard.down('Control')
    await page.keyboard.press('z')
    await page.keyboard.up('Control')
    await ready()
    await wait(500)
    got.undo = await page.evaluate(() => window.__editor.getSnapshot().report.body.some((c) => c.title === '新しい章'))
    check(
      '段落の終わりで Enter → 空の段落で「大見出し」：前の章の最後に空の段落が残らず、画面は新しい章のページ',
      got.tail === 'p5b' && got.page === got.chapterPage,
      JSON.stringify(got),
    )
    await context.close()
  }

  // 段落の終わりで Delete：次の段落をつなげる（抄録・本文）。カーソルはつないだ所で、続けて打てる。次が図・表のときは何もしない
  {
    const { context, page, ready } = await open(browser)
    const paraText = (id) => page.evaluate((id) => { const r = window.__editor.getSnapshot().report; const p = [...r.abstract.paragraphs, ...r.body.flatMap((c) => c.blocks)].find((b) => b.id === id); return p ? p.content.map((n) => n.text ?? '').join('') : null }, id)
    const deleteAtEnd = async (id) => {
      await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
      await ready()
      await page.evaluate((id) => window.__editor.openEditor(id, 0), id)
      await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
      await wait(300)
      // 段落の終わりへ（「（図1）」も字として数えるので、Ctrl+End で）
      await page.keyboard.down('Control')
      await page.keyboard.press('End')
      await page.keyboard.up('Control')
      await page.keyboard.press('Delete')
      await wait(1200)
      await page.keyboard.type('★')
      await page.keyboard.press('Escape')
      await ready()
      await wait(500)
    }
    const [a1, a2, p1, p2, p3] = await Promise.all(['a1', 'a2', 'p1', 'p2', 'p3'].map(paraText))
    await deleteAtEnd('a1')
    const abs = { a1: await paraText('a1'), a2: await paraText('a2') }
    await deleteAtEnd('p1')
    const body = { p1: await paraText('p1'), p2: await paraText('p2') }
    // 次が図のまとまり（p3 のすぐ後ろは図1）：何もしない（字は消えない。段落の終わりに打った「★」には、書き終えると「。」が付く）
    await deleteAtEnd('p3')
    const fig = { p3: await paraText('p3'), r1: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).some((b) => b.id === 'r1')) }
    check('抄録：段落の終わりで Delete → 次の段落がつながり、つないだ所から打てる', abs.a1 === `${a1}★${a2}` && abs.a2 === null, JSON.stringify(abs))
    check('本文：段落の終わりで Delete → 次の段落がつながり、つないだ所から打てる', body.p1 === `${p1}★${p2}` && body.p2 === null, JSON.stringify(body))
    check('本文：次が図のときは、Delete を押してもつながず、図も消えない', fig.p3 === `${p3}★。` && fig.r1, JSON.stringify(fig))
    await context.close()
  }

  // 紙面で文をなぞって選び、帯の「コピー」：少しの間「✓ コピーしました」になり、元に戻る（mockups/v82 案A）。抄録の行数は上限なし（1ページに収める）
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'none'))
    await ready()
    const pts = await page.evaluate(() => {
      const el = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current [data-block-id="p1"]')
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes = []
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n)
      const all = nodes.map((n) => n.textContent).join('')
      const charRect = (k) => { let at = k; for (const n of nodes) { if (at < n.textContent.length) { const r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + 1); return r.getBoundingClientRect() } at -= n.textContent.length } return null }
      const a = charRect(all.indexOf('物語'))
      const b = charRect(all.indexOf('衣装である') + 4)
      return { from: { x: a.left + 1, y: a.top + a.height / 2 }, to: { x: b.right - 1, y: b.top + b.height / 2 } }
    })
    await page.mouse.move(pts.from.x, pts.from.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(pts.from.x + ((pts.to.x - pts.from.x) * i) / 10, pts.from.y + ((pts.to.y - pts.from.y) * i) / 10)
    await page.mouse.up()
    await page.waitForFunction(() => !document.querySelector('.range-bar').hidden, { timeout: 10000 })
    const btn = await page.evaluate(() => { const r = document.querySelector('.range-bar .copy').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.click(btn.x, btn.y)
    await wait(300)
    const during = await page.evaluate(() => { const b = document.querySelector('.range-bar .copy'); return { text: b.textContent, done: b.classList.contains('done'), palette: [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.includes('コピー'))?.textContent ?? null } })
    await wait(2200)
    const after = await page.evaluate(() => { const b = document.querySelector('.range-bar .copy'); return { text: b.textContent, done: b.classList.contains('done') } })
    check('帯の「コピー」を押すと、少しの間「✓ コピーしました」になり、元の「コピー」に戻る', during.text === 'コピーしました' && during.done && after.text === 'コピー' && !after.done, JSON.stringify({ during, after }))
    // 左の道具の「選んだ文」の「コピー」も、押した所が「コピーしました」になる
    const tool = await page.evaluate(() => { const b = [...document.querySelectorAll('.palette .tb')].find((x) => x.textContent.trim() === 'コピー'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    let toolDuring = null
    if (tool) {
      await page.mouse.click(tool.x, tool.y)
      await wait(300)
      toolDuring = await page.evaluate(() => ({ palette: [...document.querySelectorAll('.palette .tb.done')].map((x) => x.textContent), bar: document.querySelector('.range-bar .copy').textContent }))
    }
    check('左の道具の「コピー」も「コピーしました」になる（帯も同じ）', !!toolDuring && toolDuring.palette.join('') === 'コピーしました' && toolDuring.bar === 'コピーしました', JSON.stringify(toolDuring))
    // 抄録の行数：上限（前の 23行）はなく、1ページに収まっていれば直すところにしない。右の欄は「〇字・〇行」
    const abs = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return { lines: s.layout.abstractLines, pages: s.layout.abstractPages, findings: s.findings.filter((f) => f.ruleId.startsWith('abstract-')).map((f) => f.ruleId) } })
    check('抄録の行数の決まり：上限の指摘はなく、見本の抄録は直すところなし', abs.pages === 1 && abs.findings.length === 0, JSON.stringify(abs))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
