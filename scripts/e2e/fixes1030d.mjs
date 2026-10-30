// 学生の試し 5回目の B（見た目が変わる直し。依頼者の選択 mockups/v78：① 案A・② 案B・③ 案A・④ 案A）。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030d
// ① スマホの形の「追加」に「図」「表」（さっき書いていた所に入れる）
// ② 章の順番の入れ替えは、使い方に手順（単体テスト：help/search.test.ts）
// ③ 貼った表は、知らせの「表にする」で表になる（元に戻すと文に戻る）
// ④ 提出前チェック：保存したあとの画面に「ファイルを足す・入れ替える」
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
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

async function open(browser, { phone = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 })
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
const ids = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => `${b.type}:${b.id}`))

await withEdge(async (browser) => {
  // ---- ① スマホの「追加」の「図」「表」 ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p6', 6))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await wait(800)
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(1000)
    await ready()
    await page.evaluate(() => document.querySelector('.p-nav .add').click())
    await page.waitForSelector('.sheet .add-grid', { timeout: 10000 })
    await wait(400)
    const sheet = await page.evaluate(() => ({
      tools: [...document.querySelectorAll('.sheet .add-grid button')].map((b) => `${b.querySelector('span')?.textContent.trim()}${b.disabled ? '（押せない）' : ''}`),
      hint: [...document.querySelectorAll('.sheet .sheet-hint')].map((p) => p.textContent).join(' '),
    }))
    check('スマホ：書く欄を閉じたあとの「追加」に「図」「表」があり、さっき書いていた段落（「配色と素材…」）に入ると書いてある', sheet.tools.join() === '大見出し,小見出し,改ページ,図,表' && /さっき書いていた所（「.+」の段落）に入ります/.test(sheet.hint), JSON.stringify(sheet))
    const before = await ids(page)
    await page.evaluate(() => [...document.querySelectorAll('.sheet .add-grid button')].find((b) => b.textContent.trim() === '表').click())
    await page.waitForSelector('.sheet.table-size', { timeout: 10000 })
    await wait(400)
    await page.evaluate(() => [...document.querySelectorAll('.sheet.table-size button')].find((b) => /入れる/.test(b.textContent) && !b.disabled)?.click())
    await wait(1500)
    await ready()
    const after = await ids(page)
    const added = after.find((x) => x.startsWith('table:') && !before.includes(x))
    const placed = added ? after[after.indexOf(added) - 1] : null
    check('スマホ：「追加」→「表」→ 大きさを選んで入れると、さっき書いていた段落のすぐ下に表が入る', !!added && placed === 'paragraph:p6', JSON.stringify({ added, placed }))
    await context.close()
  }

  // ---- ③ 貼った表を「表にする」 ----
  {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [...c.blocks, { type: 'paragraph', id: 'pz', content: [{ type: 'text', text: '' }] }] } : c)) })))
    await wait(1000)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('pz'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('pz', 0))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'pz', { timeout: 20000 })
    await wait(400)
    const tablesBefore = (await ids(page)).filter((x) => x.startsWith('table:')).length
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', '素材\t用途\t量\nコットンサテン\tブラウス\t3m\nシルクシフォン\t袖\t2m')
      dt.setData('text/html', '<table><tr><td>素材</td><td>用途</td><td>量</td></tr><tr><td>コットンサテン</td><td>ブラウス</td><td>3m</td></tr><tr><td>シルクシフォン</td><td>袖</td><td>2m</td></tr></table>')
      document.querySelector('.overlay-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await wait(1500)
    await ready()
    const toast = await page.evaluate(() => ({ text: document.querySelector('.undo-toast')?.textContent ?? '', button: [...document.querySelectorAll('.undo-toast button')].map((b) => b.textContent.trim()) }))
    check('表を貼ると、知らせ「貼り付けた表は、文（3つの段落）になりました」に「表にする」が出る', toast.text.includes('貼り付けた表は、文（3つの段落）になりました') && toast.button.includes('表にする'), JSON.stringify(toast))
    await page.evaluate(() => [...document.querySelectorAll('.undo-toast button')].find((b) => b.textContent.includes('表にする'))?.click())
    await wait(1500)
    await ready()
    const made = await page.evaluate(() => { const s = window.__editor.getSnapshot(); const t = s.report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'table').at(-1); return { rows: t?.rows.map((r) => r.cells.map((c) => c.text).join('|')), kind: s.editingKind, leftover: s.report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph' && /コットンサテン　ブラウス/.test(b.content.map((n) => n.text ?? '').join(''))).length } })
    const tablesAfter = (await ids(page)).filter((x) => x.startsWith('table:')).length
    check('「表にする」を押すと、貼った3行が3列×3行の表になり（文の段落は残らない）、表のタイトルを書き始める', tablesAfter === tablesBefore + 1 && made.rows?.join('/') === '素材|用途|量/コットンサテン|ブラウス|3m/シルクシフォン|袖|2m' && made.leftover === 0 && made.kind === 'tableCaption', JSON.stringify({ ...made, tablesBefore, tablesAfter }))
    await page.keyboard.press('Escape')
    await wait(800)
    await page.evaluate(() => window.__editor.undo())
    await wait(1200)
    await ready()
    const undone = { tables: (await ids(page)).filter((x) => x.startsWith('table:')).length, rows: await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph' && /コットンサテン　ブラウス|シルクシフォン　袖/.test(b.content.map((n) => n.text ?? '').join(''))).length) }
    check('元に戻すと、表が文（行ごとの段落）に戻る', undone.tables === tablesBefore && undone.rows === 2, JSON.stringify(undone))
    await context.close()
  }

  // ---- ④ 提出前チェック：保存したあとの「ファイルを足す・入れ替える」 ----
  {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    page.on('dialog', (d) => void d.accept())
    await page.setViewport({ width: 1366, height: 768 })
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId: context.id })
    await stubConfig(page)
    await page.goto(`${APP}/check.html`, { waitUntil: 'networkidle0', timeout: 90000 })
    await wait(600)
    const fixtures = join(process.cwd(), 'scripts', 'e2e', 'fixtures')
    const files = readdirSync(fixtures).filter((f) => /^word-sample-.*\.(docx|pdf)$/.test(f)).map((f) => join(fixtures, f))
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ファイルを選ぶ'))?.click())])
    await chooser.accept(files)
    await page.waitForFunction(() => !document.querySelector('.d-busy'), { timeout: 60000 }).catch(() => {})
    await wait(1500)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('1つの PDF にまとめる'))?.click())
    await wait(1200)
    await page.evaluate(() => [...document.querySelectorAll('.modal button, [role=dialog] button')].find((b) => /まとめる|このまま/.test(b.textContent))?.click())
    await page.waitForSelector('.c-saved, .c2-saved', { timeout: 60000 }).catch(() => {})
    await wait(800)
    const savedButtons = await page.evaluate(() => [...document.querySelectorAll('.c-saved button, .c2-saved button')].map((b) => b.textContent.trim()))
    const opened = await Promise.all([page.waitForFileChooser({ timeout: 5000 }).then(() => true, () => false), page.evaluate(() => [...document.querySelectorAll('.c-saved button, .c2-saved button')].find((b) => b.textContent.includes('ファイルを足す・入れ替える'))?.click())])
    check('提出前チェック：保存したあとの画面に「ファイルを足す・入れ替える」があり、押すとファイルを選ぶ画面が開く', savedButtons.includes('ファイルを足す・入れ替える') && opened[0], JSON.stringify({ savedButtons, opened: opened[0] }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
