// 見出しを 大見出し（Ⅰ．）・中見出し（ⅰ．）・小見出し（（1））の3つにした（依頼者の選択 2026-11-03）：
// パソコンの左の道具の「小見出し」で、書いている段落の後ろに小見出しが入り、紙面と目次に「（1）」で出る（目次では中見出しより下げる）。
// 小見出しは中見出しごとに（1）から振り直す。削除の知らせは「小見出し」。「（1）パターン」「①仮縫い」と打っても、「小見出しにする」でも小見出しになる
// これだけを流すときは node scripts/e2e/run.mjs headings3
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
const TIPS_DONE = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

await withEdge(async (browser) => {
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
  const settle = async () => {
    await wait(1200)
    await ready()
  }
  const blocks = () => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => ({ id: b.id, type: b.type, level: b.level, title: b.title })))
  const editAt = async (id) => {
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
    await ready()
    await page.evaluate((id) => window.__editor.openEditor(id, 0), id)
    await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
    await wait(400)
  }
  // 道具の名前（見出しの道具は、絵の字「Ⅰ」「ⅰ」「(1)」を除いて比べる）
  const clickTool = (label) => page.evaluate((label) => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.replace(/\s/g, '').endsWith(label))?.click(), label)

  // ---- 左の道具：大見出し・中見出し・小見出し の順 ----
  await editAt('p4')
  const tools = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].map((b) => b.textContent.replace(/\s/g, '')).filter((t) => t.endsWith('見出し')).map((t) => t.slice(-4)))
  check('左の道具に「大見出し」「中見出し」「小見出し」が大きい順に並ぶ', tools.join() === '大見出し,中見出し,小見出し', tools.join())

  // ---- 小見出しを2つ足す（書いている段落の後ろ） ----
  await clickTool('小見出し')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'subheading', { timeout: 20000 })
  await page.keyboard.type('型紙', { delay: 20 })
  await page.evaluate(() => window.__editor.finishEditing())
  await settle()
  await editAt('p4b')
  await clickTool('小見出し')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'subheading', { timeout: 20000 })
  await page.keyboard.type('縫製', { delay: 20 })
  await page.evaluate(() => window.__editor.finishEditing())
  await settle()
  const all = await blocks()
  const i = all.findIndex((b) => b.id === 'p4')
  const added = all.filter((b) => b.type === 'subheading' && b.level === 3)
  check('「小見出し」で、書いている段落のすぐ後ろに小見出し（level 3）が入り、打った名前になる', all[i + 1]?.type === 'subheading' && all[i + 1].level === 3 && all[i + 1].title === '型紙' && added.map((b) => b.title).join() === '型紙,縫製', JSON.stringify(added))

  // ---- 紙面：（1）（2）。中見出しの後ろでは（1）から ----
  const paper = await page.evaluate(() => [...document.querySelectorAll('.page-viewport.front h2.subheading.minor')].map((h) => h.textContent.trim()))
  check('紙面の小見出しは「（1）型紙」「（2）縫製」と出る（h2.subheading.minor）', paper.join('|') === '（1）型紙|（2）縫製', paper.join('|'))

  // ---- 目次：（1）で、中見出しより下げる ----
  await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf('toc'), 'none'))
  await ready()
  await wait(400)
  const toc = await page.evaluate(() => {
    const minors = [...document.querySelectorAll('.page-viewport.front .toc .toc-sub.minor')]
    const sub = document.querySelector('.page-viewport.front .toc .toc-sub:not(.minor)')
    const left = (e) => (e ? e.querySelector('span').getBoundingClientRect().left : null)
    return { texts: minors.map((m) => m.textContent.trim()), minorLeft: left(minors[0]), subLeft: left(sub) }
  })
  check('目次に「（1）型紙」「（2）縫製」が出て、中見出しより右に下がる', toc.texts.join('|') === '（1）型紙|（2）縫製' && toc.minorLeft !== null && toc.subLeft !== null && toc.minorLeft > toc.subLeft + 10, JSON.stringify(toc))

  // ---- 削除の知らせは「小見出し」 ----
  const minorId = added[0].id
  await editAt(minorId)
  await page.evaluate((id) => window.__editor.removeBlock(id), minorId)
  await wait(600)
  const notice = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
  check('小見出しを削除すると、知らせは「小見出しを削除しました」', notice.includes('小見出しを削除しました'), notice)

  // ---- 打って小見出しにする・「小見出しにする」（大・中・小で作り方をそろえる：依頼者の選択 2026-11-04、mockups/v100 案A） ----
  const toast = () => page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
  const newParagraph = async () => {
    const id = `pn${Date.now() % 100000}`
    await page.evaluate((id) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => (c.blocks.some((b) => b.id === 'p4b') ? { ...c, blocks: c.blocks.flatMap((b) => (b.id === 'p4b' ? [b, { type: 'paragraph', id, content: [{ type: 'text', text: '' }] }] : [b])) } : c)) })), id)
    await settle()
    await editAt(id)
    return id
  }
  const minor = async (title) => (await blocks()).find((b) => b.type === 'subheading' && b.level === 3 && b.title === title)
  await newParagraph()
  await page.keyboard.type('（1）パターン', { delay: 20 })
  await page.keyboard.press('Enter')
  await wait(500)
  const typedToast = await toast()
  await page.keyboard.type('型紙を作り直した。', { delay: 20 })
  await page.keyboard.press('Escape')
  await settle()
  check('段落に「（1）パターン」と打って Enter：小見出し「パターン」になり、「小見出し「（n）パターン」にしました」と出る', !!(await minor('パターン')) && /小見出し「（\d）パターン」にしました/.test(typedToast), typedToast)
  await newParagraph()
  await page.keyboard.type('①仮縫い', { delay: 20 })
  await page.keyboard.press('Escape')
  await settle()
  check('「①仮縫い」と打って書き終える（Esc）：小見出し「仮縫い」になる', !!(await minor('仮縫い')))
  await newParagraph()
  await page.keyboard.type('仕上げ', { delay: 20 })
  await wait(400)
  const convertTools = await page.evaluate(() => [...document.querySelectorAll('.palette .group.ctx .tb')].map((b) => b.textContent.replace(/\s/g, '')).filter((t) => t.endsWith('にする')).map((t) => t.replace(/^.*?(中|小)/, '$1')))
  await clickTool('小見出しにする')
  await settle()
  const convertToast = await toast()
  check('短い段落を書いているとき「この段落」に「中見出しにする」「小見出しにする」が並び、「小見出しにする」で小見出しになる', convertTools.join() === '中見出しにする,小見出しにする' && !!(await minor('仕上げ')) && convertToast.includes('小見出し「'), JSON.stringify({ convertTools, convertToast }))
  await page.evaluate(() => [...document.querySelectorAll('.undo-toast button')].find((b) => b.textContent.includes('戻す'))?.click())
  await settle()
  const back = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).some((b) => b.type === 'paragraph' && b.content.map((n) => n.text ?? '').join('') === '仕上げ'))
  check('知らせの「戻す」で、小見出しにした段落が段落に戻る', back && !(await minor('仕上げ')))

  await context.close()
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
