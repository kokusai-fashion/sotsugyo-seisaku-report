// 学生の試し 3回目の B（見た目が変わる直し。依頼者の選択 mockups/v76：① 案B・② 案A・③ 案A）。
// これだけを流すときは node scripts/e2e/run.mjs fixes1029e
// ① スマホの「表を削除」は「この表を削除しますか？」と確かめてから消す（「やめる」なら残る）
// ② Word から写したあとの「つぎにすること」：項目の説明は、次にする1つ（と、確かめている途中の項目）だけ。上の一言は「のこり Nつ」
// ③ iPhone の下の「チェック」：赤いエラーがなく、黄色の要確認だけのときは黄色の小さな点（数は出さない）
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

async function open(browser, { phone = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 720 })
  await stubConfig(page)
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
const lengthOf = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content.map((n) => n.text ?? '').join('').length, id)
const tableIds = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'table').map((b) => b.id))
const modal = (page) => page.evaluate(() => { const m = document.querySelector('.confirm-modal'); return m ? { title: m.querySelector('h2')?.textContent ?? '', text: m.dataset.text ?? '', ok: m.querySelector('[data-confirm="ok"]')?.textContent ?? '', danger: !!m.querySelector('[data-confirm="ok"].danger-fill') } : null })

await withEdge(async (browser) => {
  // ---- ① スマホ：キーボードの上の道具の「表を削除」 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const len = await lengthOf(page, 'p6')
    await page.evaluate((len) => window.__editor.openEditor('p6', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await wait(600)
    const before = await tableIds(page)
    await page.evaluate(() => window.__editor.addTable('blank', { columns: 2, rows: 2 }))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
    await ready()
    await wait(600)
    const added = (await tableIds(page)).find((id) => !before.includes(id))
    const del = () => page.evaluate(() => [...document.querySelectorAll('.direct-bar .db-table button.danger')].find((b) => b.textContent.includes('表を削除'))?.click())
    await page.keyboard.type('記録')
    await wait(300)
    await del()
    await page.waitForSelector('.confirm-modal', { timeout: 10000 }).catch(() => {})
    const asked = await modal(page)
    await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="cancel"]')?.click())
    await wait(1200)
    await ready()
    const kept = (await tableIds(page)).includes(added)
    check('スマホ：キーボードの上の道具の「表を削除」を押すと「この表を削除しますか？」と確かめ（赤い「削除する」）、「やめる」なら表は残る', asked?.title === 'この表を削除しますか？' && asked.text.includes('表の中の字と画像も') && asked.ok === '削除する' && asked.danger && kept, JSON.stringify({ asked, kept }))
    // 「やめる」のあとは、書いていた所（表のタイトルの終わり）で書き続ける
    await page.keyboard.type('表')
    await wait(1000)
    await ready()
    const after = await page.evaluate((id) => { const s = window.__editor.getSnapshot(); return { kind: s.editingKind, caption: s.report.body.flatMap((c) => c.blocks).find((b) => b.id === id)?.caption } }, added)
    check('「やめる」のあとは、書いていた所で書き続けられる（表のタイトル「記録」の後ろに「表」が入る）', after.kind === 'tableCaption' && after.caption === '記録表', JSON.stringify(after))
    if (after.kind !== 'tableCaption') {
      await page.evaluate((id) => window.__editor.openEditor(id, 0), added)
      await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 20000 })
      await wait(600)
    }
    await del()
    await page.waitForSelector('.confirm-modal [data-confirm="ok"]', { timeout: 10000 }).catch(() => {})
    await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="ok"]')?.click())
    await wait(900)
    await ready()
    const gone = !(await tableIds(page)).includes(added)
    const toast = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    check('「削除する」を押すと表が消え、画面の下に「表を削除しました［戻す］」が出る', gone && toast.includes('表を削除しました'), JSON.stringify({ gone, toast }))
    await context.close()
  }

  // ---- ② パソコン：「つぎにすること」 ----
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => {
      const todo = { at: new Date().toISOString(), snapshotAt: null, figuresSeen: 0, coverSeen: false, coverChecked: false, pagesSeen: false, pagesChecked: false, problems: [{ message: 'コメント（1件）は写していません' }] }
      localStorage.setItem('sotsugyo-seisaku-report-word-todo', JSON.stringify(todo))
    })
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await page.waitForSelector('.side .word-todo', { timeout: 20000 })
    await wait(500)
    const card = () => page.evaluate(() => {
      const c = document.querySelector('.side .word-todo')
      return {
        lead: c.querySelector(':scope > p')?.textContent ?? '',
        title: c.querySelector('.hd b')?.title ?? '',
        items: [...c.querySelectorAll(':scope > ul > li')].map((li) => ({ name: li.querySelector('b')?.textContent ?? '', done: li.classList.contains('done'), note: !!li.querySelector(':scope > div > small') })),
        height: Math.round(c.getBoundingClientRect().height),
      }
    })
    const first = await card()
    const left = first.items.filter((i) => !i.done).length
    const next = first.items.findIndex((i) => !i.done)
    check(
      '「つぎにすること」の上の一言は「のこり Nつ。済んだら、移しかえは終わりです」（写した日時は、見出しにマウスを乗せたとき）',
      first.lead === `のこり ${left}つ。済んだら、移しかえは終わりです` && /に写しました$/.test(first.title),
      JSON.stringify({ lead: first.lead, title: first.title }),
    )
    check(
      '項目の説明は、次にする1つだけ（済んだ・まだ先の項目は名前だけの1行）',
      first.items.every((item, i) => (i === next && item.name !== '読み取れなかったところを直す' ? true : !item.note)) && first.height < 260,
      JSON.stringify(first),
    )
    // 先の項目でも、押して確かめている途中なら説明を出す（「本文へ」を押したら「最後のページまで見て、…「確かめた」を押します」）
    await page.evaluate(() => [...document.querySelectorAll('.side .word-todo .go')].find((b) => b.textContent === '本文へ')?.click())
    await wait(800)
    await ready()
    const doing = await page.evaluate(() => { const li = [...document.querySelectorAll('.side .word-todo > ul > li')].find((x) => x.textContent.includes('改ページの位置を確かめる')); return li?.querySelector('small')?.textContent ?? '' })
    check('先の項目でも、「本文へ」を押して確かめている途中なら説明を出す', doing.includes('最後のページまで見て'), doing)
    await context.close()
  }

  // ---- ③ iPhone：下の「チェック」の黄色の点 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    // 抄録に、本文にない文（要確認：本文にない内容かもしれない文がある）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, paragraphs: r.abstract.paragraphs.map((p, i) => (i === 0 ? { ...p, content: [...p.content, { type: 'text', text: '会場では演出家と相談し、ターバンを40時間かけて仕上げた。' }] } : p)) } })))
    await wait(1200)
    await ready()
    const badge = () => page.evaluate(() => {
      const b = document.querySelector('.p-nav .nav-check .badge')
      const fixes = window.__editor.getSnapshot().findings
      return { warnings: fixes.filter((f) => f.severity === 'warning').length, dot: !!b?.classList.contains('warn-dot'), text: b?.textContent ?? null, label: b?.getAttribute('aria-label') ?? '', bg: b ? getComputedStyle(b).backgroundColor : '' }
    })
    const warnOnly = await badge()
    check('赤いエラーがなく、黄色の要確認だけのとき、「チェック」に黄色の小さな点（数は出さない。読み上げは「要確認があります」）', warnOnly.warnings > 0 && warnOnly.dot && warnOnly.text === '' && warnOnly.label === '要確認があります' && warnOnly.bg === 'rgb(224, 161, 0)', JSON.stringify(warnOnly))
    // 赤いエラーを1つ作る（段落の終わりの「。」を外す）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' && b.type === 'paragraph' ? { ...b, content: b.content.map((n, i, a) => (i === a.length - 1 && n.type === 'text' ? { ...n, text: n.text.replace(/。$/, '') } : n)) } : b)) })) })))
    await wait(1200)
    await ready()
    const withError = await badge()
    check('赤いエラーがあれば、今までどおり赤い数（黄色の点は出さない）', !withError.dot && /^[1-9][0-9]*$/.test(withError.text ?? ''), JSON.stringify(withError))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
