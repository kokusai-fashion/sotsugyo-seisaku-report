// 手で書いた「（図n）」（まだ図がない）から図を入れる「図nを入れる」（mockups/v87 案B。依頼者の案 2026-11-02）：
// 書く欄でカーソルがその「（図n）」にあるとき、すぐ上に出す ／ 右の欄のエラー「「（図n）」の図がない」にも出す。
// 押して写真を選ぶと、段落の下に図が入り、書いた「（図n）」がその図につながる（番号は図の順で付く）。
// これだけを流すときは node scripts/e2e/run.mjs figureRefChip
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, { phone = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
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
/** 「図nを入れる」（書く欄の近く）：出ていれば、その言葉と位置 */
const chip = (page) => page.evaluate(() => { const c = document.querySelector('.figure-chip'); if (!c || c.hidden) return null; const r = c.getBoundingClientRect(); return { label: c.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom } })
/** 段落の中身（文字と、図表へのつながり） */
const content = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id)?.content, id)
const missing = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().findings.filter((f) => f.ruleId === 'reference-missing' && f.blockId === id).map((f) => f.title), id)
const figureIds = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures.map((f) => f.id) : [])))

await withEdge(async (browser) => {
  // 写真（選ぶ画面で選ぶ）
  const pngPath = join(tmpdir(), 'sotsugyo-e2e-figref.png')
  {
    const { context, page, ready } = await open(browser)
    const png = await page.evaluate(async () => {
      const c = new OffscreenCanvas(600, 800)
      const g = c.getContext('2d')
      g.fillStyle = '#e8d9c4'
      g.fillRect(0, 0, 600, 800)
      g.fillStyle = '#7a4b20'
      g.fillRect(150, 200, 300, 400)
      const blob = await c.convertToBlob({ type: 'image/png' })
      return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))
    })
    writeFileSync(pngPath, Buffer.from(png, 'base64'))

    // ---- 書く欄の近くの「図nを入れる」 ----
    // 見本の図は3枚。帯の段落に、まだない「（図4）」を手で書いておく
    const text = '帯は、からし色の布を幅15cmの筒に縫い、腰に二重に巻いた（図4）。結び目が大きく見えるよう、端に房を付けた。'
    await setText(page, 'p11', text)
    await settle(page, ready)
    const at = text.indexOf('（図4）')
    check('手で書いた、まだない「（図4）」は、「「（図4）」の図がない」のエラーになる', (await missing(page, 'p11')).join() === '「（図4）」の図がない', JSON.stringify(await missing(page, 'p11')))
    await editAt(page, ready, 'p11', 3)
    check('カーソルが「（図4）」から離れているときは、「図nを入れる」を出さない', (await chip(page)) === null)
    await page.evaluate((caret) => window.__editor.openEditor('p11', caret), at + 2)
    await wait(500)
    let c = await chip(page)
    check('カーソルが「（図4）」の中にあるとき、すぐ上に「図4を入れる」を出す', c?.label === '図4を入れる', JSON.stringify(c))
    // カーソルが離れたら隠す
    await page.evaluate((caret) => window.__editor.openEditor('p11', caret), text.length)
    await wait(400)
    check('「図nを入れる」は、カーソルが「（図4）」から離れると消える', (await chip(page)) === null)
    // 段落の終わりで「（図5）」まで打った直後は出さない（打っている間）。左の矢印で中に入ると出す
    await page.keyboard.type('（図5）')
    await wait(500)
    check('「（図5）」を打った直後（打っている間）は、「図nを入れる」を出さない', (await chip(page)) === null)
    await page.keyboard.press('ArrowLeft')
    await wait(500)
    c = await chip(page)
    // 図4の所に図を入れていないので、ここに入れる図は図4（書いた番号は、図の順で直る）
    check('打ったあとにカーソルを動かすと出す（番号は、入れたら付く番号：まだ図4がないので「図4を入れる」）', c?.label === '図4を入れる', JSON.stringify(c))
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await page.keyboard.press('Delete')
    await wait(300)
    // 「（図4）」の中に戻って、「図4を入れる」を押し、写真を選ぶ
    // 打った字で紙面を組み直し終えるのを待つ（組み直すと、ボタンの位置も動く）
    await settle(page, ready)
    await page.evaluate((caret) => window.__editor.openEditor('p11', caret), at + 1)
    await wait(800)
    c = await chip(page)
    const before = await figureIds(page)
    const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.mouse.click(c.x, c.y)])
    await chooser.accept([pngPath])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
    const editing = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    await page.keyboard.type('帯')
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const after = await figureIds(page)
    const p11 = await content(page, 'p11')
    const blocks = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => b.id))
    const fid = after.find((x) => !before.includes(x))
    check(
      '押して写真を選ぶと、段落のすぐ下に図4が入り、書いた「（図4）」がその図につながる（自動の（図n）は足さない）。図のタイトルを書き始める',
      !!fid && editing === fid && after.indexOf(fid) === 3 && p11.filter((x) => x.type === 'ref').length === 1 && p11.some((x) => x.type === 'ref' && x.targetId === fid && x.withParens) && blocks[blocks.indexOf('p11') + 1]?.startsWith('r'),
      JSON.stringify({ fid, editing, after, p11 }),
    )
    check('つながったので、「（図4）」のエラーは消える', (await missing(page, 'p11')).length === 0, JSON.stringify(await missing(page, 'p11')))
    // 元に戻すで、図を入れる前（書いた「（図4）」の文字）に戻る（1回目は、図のタイトルに打った字が戻る）
    for (let i = 0; i < 3 && (await figureIds(page)).includes(fid); i++) {
      await page.evaluate(() => window.__editor.undo())
      await settle(page, ready)
    }
    const undone = await content(page, 'p11')
    check('元に戻すと、入れた図が外れ、書いた「（図4）」の文字に戻る', !(await figureIds(page)).includes(fid) && undone.every((x) => x.type === 'text') && undone.map((x) => x.text).join('').includes('（図4）'), JSON.stringify(undone))

    // ---- 右の欄のエラーの「図nを入れる」 ----
    // ズボンの段落に、番号の合わない「（図9）」（図は3枚）。ここに入れると図4になり、書いた番号も「（図4）」に直る
    await page.keyboard.press('Escape')
    await setText(page, 'p11', '帯は、からし色の布を幅15cmの筒に縫い、腰に二重に巻いた。')
    await setText(page, 'p12', 'ズボンは、裾に向かって細くなる形にした（図9）。')
    await settle(page, ready)
    const card = await page.evaluate(() => {
      const li = [...document.querySelectorAll('.issue')].find((e) => e.textContent.includes('（図9）'))
      const b = li?.querySelector('.add-figure')
      return b ? b.textContent.trim() : null
    })
    check('右の欄の「「（図9）」の図がない」に、「図4を入れる」（入れたら付く番号）を出す', card === '図4を入れる', String(card))
    const before2 = await figureIds(page)
    const [chooser2] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(() => [...document.querySelectorAll('.issue')].find((e) => e.textContent.includes('（図9）')).querySelector('.add-figure').click())])
    await chooser2.accept([pngPath])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const fid2 = (await figureIds(page)).find((x) => !before2.includes(x))
    const p12 = await content(page, 'p12')
    const p12Text = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p12'))
    const shown = await page.evaluate(() => [...document.querySelectorAll('.page-viewport.front [data-block-id="p12"]')].map((e) => e.textContent).join(''))
    check(
      '右の欄から押して写真を選ぶと、ズボンの段落の下に図が入り、書いた「（図9）」がつながって「（図4）」に直る。エラーと「図nを入れる」は消える',
      !!fid2 && p12.some((x) => x.type === 'ref' && x.targetId === fid2) && (await missing(page, 'p12')).length === 0 && !(await page.evaluate(() => !!document.querySelector('.issue .add-figure'))),
      JSON.stringify({ fid2, p12: p12Text?.content, shown: shown.slice(0, 60) }),
    )
    await context.close()
  }

  // ---- スマホ：紙面で書いているとき、同じ所に出す ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    const text = '帯は、からし色の布を幅15cmの筒に縫い、腰に二重に巻いた（図4）。'
    await setText(page, 'p11', text)
    await settle(page, ready)
    await editAt(page, ready, 'p11', text.indexOf('（図4）') + 2)
    await wait(600)
    const c = await chip(page)
    check('スマホ：カーソルが「（図4）」の中にあるとき、「図4を入れる」を出す', c?.label === '図4を入れる', JSON.stringify(c))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
