// 学生の試し 6回目（2026-10-30。5回目の直しの確かめ・Android・遅い回線・Mac。poc-output/firsttime/r1029/まとめ6.md）の A の直し。
// これだけを流すときは node scripts/e2e/run.mjs fixes1030e
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = (zoom) => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); if (!zoom) localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser, { phone = false, mac = false, zoom = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE, zoom)
  if (phone) await page.setUserAgent(IPHONE)
  if (mac) {
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: MAC, platform: 'MacIntel' })
  }
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
const textOf = (page, id) => page.evaluate((id) => { const b = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((x) => x.id === id); return b?.type === 'paragraph' ? b.content.map((n) => n.text ?? '').join('') : null }, id)
const editAt = async (page, ready, id, caret) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(300)
}
const key = async (page, mod, k) => {
  await page.keyboard.down(mod)
  await page.keyboard.press(k)
  await page.keyboard.up(mod)
}
const paste = (page, text, html = '') =>
  page.evaluate((text, html) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    if (html) dt.setData('text/html', html)
    document.querySelector('.overlay-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text, html)
const settle = async (page, ready) => {
  await wait(1200)
  await ready()
}
const blocks = (page) => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).map((b) => ({ id: b.id, type: b.type, text: b.type === 'paragraph' ? b.content.map((n) => (n.type === 'ref' ? `[${n.targetId}]` : (n.text ?? ''))).join('') : '' })))

await withEdge(async (browser) => {
  // ---- 欄を移りながら書いて、元に戻す2回 → やり直す2回で、打った字まで戻る ----
  {
    const { context, page, ready } = await open(browser)
    const p1 = await textOf(page, 'p1')
    const p2 = await textOf(page, 'p2')
    await editAt(page, ready, 'p1', p1.length)
    await page.keyboard.type('Ｑ')
    await page.keyboard.press('ArrowDown')
    await wait(800)
    await page.keyboard.type('Ｒ')
    await wait(300)
    await key(page, 'Control', 'KeyZ')
    await wait(600)
    await key(page, 'Control', 'KeyZ')
    await settle(page, ready)
    await key(page, 'Control', 'KeyY')
    await settle(page, ready)
    await key(page, 'Control', 'KeyY')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const after = { p1: (await textOf(page, 'p1')).slice(-3), p2: (await textOf(page, 'p2')) }
    check('↓ で移りながら書き、元に戻す2回 → やり直す2回で、後の段落で打った字（Ｒ）まで戻る', after.p1.includes('Ｑ') && after.p2.includes('Ｒ') && after.p2.length === p2.length + 1, JSON.stringify({ p1: after.p1, p2: after.p2.slice(-6) }))
    await context.close()
  }

  // ---- 貼り付け：段落の終わりの表・Word の段落 ----
  {
    const { context, page, ready } = await open(browser)
    const p2 = await textOf(page, 'p2')
    await editAt(page, ready, 'p2', p2.length)
    await paste(page, '名称\t使用箇所\r\nコットンサテン\tブラウス\r\nシルクシフォン\t袖\r\n', '<table><tr><td>名称</td><td>使用箇所</td></tr><tr><td>コットンサテン</td><td>ブラウス</td></tr><tr><td>シルクシフォン</td><td>袖</td></tr></table>')
    await settle(page, ready)
    const toast = await page.evaluate(() => ({ text: document.querySelector('.undo-toast')?.textContent ?? '', buttons: [...document.querySelectorAll('.undo-toast button')].map((b) => b.textContent.trim()) }))
    const list = await blocks(page)
    const at = list.findIndex((b) => b.id === 'p2')
    check('段落の終わりに表を貼ると、表の1行目は前の段落にくっつかず、「表にする」が出る', (await textOf(page, 'p2')) === p2 && list[at + 1]?.text.startsWith('名称') && list[at + 3]?.text.startsWith('シルクシフォン') && toast.buttons.includes('表にする'), JSON.stringify({ next: list.slice(at + 1, at + 5).map((b) => b.text.slice(0, 10)), toast }))
    await page.evaluate(() => [...document.querySelectorAll('.undo-toast button')].find((b) => b.textContent.includes('表にする'))?.click())
    await settle(page, ready)
    const made = await page.evaluate(() => ({ notice: document.querySelector('.undo-toast')?.textContent ?? '', kind: window.__editor.getSnapshot().editingKind }))
    const list1 = await blocks(page)
    const p2After = list1.find((b) => b.id === 'p2').text
    const afterTable = list1[list1.findIndex((b) => b.id === 'p2') + 2]
    check('「表にする」で表になり、前の段落の終わりに（表n）が入って、そのことを番号つきで知らせる（貼ったときの終わりの改行の空の段落は残らない）', !(afterTable?.type === 'paragraph' && afterTable.text === '') &&/\[t[^\]]*\]。$/.test(p2After) && /前の段落の終わりに「（表\d+）」を入れました/.test(made.notice) && made.kind === 'tableCaption', JSON.stringify({ end: p2After.slice(-12), ...made }))
    await page.keyboard.press('Escape')
    await settle(page, ready)

    // Word で段落ごとコピーした（終わりに改行）ものを、段落の終わりに貼る
    const p6 = await textOf(page, 'p6')
    const before = (await blocks(page)).length
    await editAt(page, ready, 'p6', p6.length)
    await paste(page, '仮縫いは二回行った。\r\n')
    await settle(page, ready)
    await page.keyboard.press('Escape')
    await settle(page, ready)
    const list2 = await blocks(page)
    const empties = list2.filter((b) => b.type === 'paragraph' && b.text === '').length
    check('Word の段落（終わりに改行）を段落の終わりに貼っても、空の段落が残らない', (await textOf(page, 'p6')).endsWith('仮縫いは二回行った。') && list2.length === before && empties === 0, JSON.stringify({ before, after: list2.length, empties }))
    await context.close()
  }

  // ---- 図のタイトルで Enter → Backspace で、タイトルに戻る ----
  {
    const { context, page, ready } = await open(browser)
    await editAt(page, ready, 'f1', 5)
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await settle(page, ready)
    const made = await page.evaluate(() => window.__editor.getSnapshot().editingKind)
    await page.keyboard.press('Backspace')
    await settle(page, ready)
    const back = await page.evaluate(() => ({ id: window.__editor.getSnapshot().editingId, kind: window.__editor.getSnapshot().editingKind }))
    const p3 = await textOf(page, 'p3')
    check('図のタイトルで Enter → Backspace で、図の上の段落ではなく、図のタイトルに戻る', made === 'paragraph' && back.kind === 'figureCaption' && p3.endsWith('海である。'), JSON.stringify({ made, back, p3: p3.slice(-6) }))
    await page.keyboard.press('Escape')
    await context.close()
  }

  // ---- ファイルを紙面に落とす：ツールから出ない・入れ方を知らせる ----
  {
    const { context, page } = await open(browser)
    const dropped = await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.items.add(new File(['x'], 'デザイン画.jpg', { type: 'image/jpeg' }))
      const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
      document.querySelector('.stage').dispatchEvent(ev)
      return ev.defaultPrevented
    })
    await wait(500)
    const toast = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    check('写真のファイルを紙面に落とすと、ブラウザが開かず（止める）、「図を入れる」で入れることを知らせる', dropped && toast.includes('「図を入れる」で入れます'), JSON.stringify({ dropped, toast }))
    await context.close()
  }

  // ---- Mac：キーの書き方・変換中の Esc ----
  {
    const { context, page, ready } = await open(browser, { mac: true })
    const tips = await page.evaluate(() => ({
      smaller: document.querySelector('.zoom-step button[aria-label="小さく"]')?.title ?? '',
    }))
    check('Mac では、大きさの説明が「Ctrl＋ホイール」ではなく「トラックパッドを2本の指で広げても」', tips.smaller.includes('トラックパッド') && !tips.smaller.includes('Ctrl'), JSON.stringify(tips))
    // 使い方の探す欄で、変換中に Esc（変換をやめるだけ）
    await page.evaluate(() => document.querySelector('.side .menu-btn').click())
    await page.waitForSelector('[role=menuitem]', { timeout: 10000 })
    await page.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].find((b) => b.textContent.includes('使い方'))?.click())
    await page.waitForSelector('.help-search input', { timeout: 10000 })
    await page.focus('.help-search input')
    const cdp = await page.createCDPSession()
    await cdp.send('Input.imeSetComposition', { text: 'こぴ', selectionStart: 2, selectionEnd: 2 })
    await wait(200)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await wait(500)
    const helpOpen = await page.evaluate(() => !!document.querySelector('.help-search input'))
    await cdp.send('Input.insertText', { text: 'コピー' })
    await wait(300)
    await page.keyboard.press('Escape')
    await wait(500)
    const closed = await page.evaluate(() => !document.querySelector('.help-search input'))
    check('使い方の探す欄で、変換中に Esc を押しても、使い方は閉じない（変換を終えたあとの Esc では閉じる）', helpOpen && closed, JSON.stringify({ helpOpen, closed }))
    await ready()
    await context.close()
  }

  // ---- はじめて開く途中で、書体を読み込めなかった（回線が切れた）：止まらずに案内が出て、書いた字が紙面に出る。一度だけ知らせる ----
  {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(TIPS_DONE, false)
    await page.setViewport({ width: 1366, height: 768 })
    // 学科の設定は stubConfig と同じに返し、書体のファイルだけ、通信が切れたように読めなくする
    const { readFileSync } = await import('node:fs')
    const config = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (/script\.google(usercontent)?\.com/.test(request.url())) return request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, year: config.fiscalYear, config }) })
      if (/\.woff2?(\?|$)/.test(request.url())) return request.abort('internetdisconnected')
      return request.continue()
    })
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    const guide = await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 90000 }).then(() => true, () => false)
    await wait(1500)
    const toast = await page.evaluate(() => document.querySelector('.undo-toast')?.textContent ?? '')
    check('はじめて開く途中で書体を読み込めなくても、止まらずに案内が出て、「読み込み直してください」と知らせる', guide && toast.includes('書体の一部を読み込めませんでした'), JSON.stringify({ guide, toast }))
    await context.close()
  }

  // ---- スマホ：変換中に幅が変わっても、確定した字が入る・2回すばやく押しても閉じない ----
  {
    // 書くときに拡大する（ふつうの設定）。1語を確定して、次の語を変換している間に横向きにする（役の台本と同じ手順）
    const { context, page, ready } = await open(browser, { phone: true, zoom: true })
    const p6 = await textOf(page, 'p6')
    await editAt(page, ready, 'p6', p6.length)
    const cdp = await page.createCDPSession()
    await cdp.send('Input.imeSetComposition', { text: 'かんせい', selectionStart: 4, selectionEnd: 4 })
    await wait(100)
    await cdp.send('Input.insertText', { text: '完成' })
    await wait(120)
    await cdp.send('Input.imeSetComposition', { text: 'させた', selectionStart: 3, selectionEnd: 3 })
    await wait(100)
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true })
    await wait(1200)
    await cdp.send('Input.insertText', { text: 'させた' })
    await wait(300)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await wait(1200)
    await page.evaluate(() => window.__editor.finishEditing())
    await settle(page, ready)
    const text = await textOf(page, 'p6')
    check('スマホ：変換中に横向きにしても、そのあと確定した字（完成させた）が原稿に入る', text.includes('完成させた'), text.slice(-8))
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await settle(page, ready)
    // 2回すばやく押す（1回目で書き始め、2回目で閉じない）
    const pt = await page.evaluate(() => { const e = [...document.querySelectorAll('.page-viewport.front [data-block-id="p6"]')].find((x) => x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 8 } })
    await page.touchscreen.tap(pt.x, pt.y)
    await wait(120)
    await page.touchscreen.tap(pt.x, pt.y + 40)
    await wait(1500)
    const editing = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    check('スマホ：紙面を2回すばやく押しても、書き始めた欄は閉じない', editing === 'p6', String(editing))
    await page.evaluate(() => window.__editor.finishEditing())
    await settle(page, ready)

    // ブラウザの「戻る」（Android の戻る・iPhone の左端からなぞる）：開いている欄を閉じるだけで、ツールからは出ない
    const href = page.url()
    await page.evaluate(() => document.querySelector('.p-nav .add').click())
    await page.waitForSelector('.sheet', { timeout: 10000 })
    await wait(400)
    await page.evaluate(() => history.back())
    await wait(800)
    const afterBack = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), editor: !!window.__editor }))
    // ×で閉じてすぐ別の欄（メニュー → 使い方）を開いても、「戻る」は開いている欄を閉じるだけ（ツールの外へ出ない）
    const len0 = await page.evaluate(() => history.length)
    await page.evaluate(() => document.querySelector('.p-nav .add').click())
    await page.waitForSelector('.sheet .sheet-close', { timeout: 10000 })
    await wait(400)
    await page.evaluate(() => document.querySelector('.sheet .sheet-close').click())
    await page.evaluate(() => document.querySelector('.p-nav .add').click())
    await page.waitForSelector('.sheet', { timeout: 10000 })
    await wait(400)
    await page.evaluate(() => history.back())
    await wait(800)
    const afterClose = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), editor: !!window.__editor, len: history.length }))
    check('スマホ：「追加」を開いたまま「戻る」を押すと、欄が閉じるだけでツールから出ない。×で閉じてすぐ開き直しても同じ（履歴を増やし続けない）', !afterBack.sheet && afterBack.editor && !afterClose.sheet && afterClose.editor && afterClose.len <= len0 + 1 && page.url() === href, JSON.stringify({ afterBack, afterClose, len0, same: page.url() === href }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
