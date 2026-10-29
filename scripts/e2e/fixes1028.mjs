// 2026-10-28 の直し。これだけを流すときは node scripts/e2e/run.mjs fixes1028
// - 氏名の書き方をそろえる（依頼者の選択 案1）：書き終えたら、姓と名の間の半角の空白・続いた空白を全角の空白1つに。前後の空白は除く。
//   英字の名前は打ったまま。空白がなければ、書き終えてから「姓と名の間に全角の空白を入れる」（要確認。書いている間は出さない）
// - 「元に戻す」で戻した所は、うすい黄色の地だけ（mockups/v72 案A。枠なし。0.2秒そのままにして、1.3秒で消える）
// - 紙面の上で Ctrl＋ホイール（タッチパッドの2本の指）：紙面の大きさを1段ずつ。紙面の外はブラウザの拡大のまま（依頼者の選択 2026-10-28）
// - Ctrl+Enter（⌘+Enter）：左の道具の「改ページ」と同じ（依頼者の選択 2026-10-28）。抄録など改ページを入れない所では Enter と同じ
// - iPhone の写真（HEIC）：パソコンの Chrome・Edge でも、端末の中で変換して入れる（作成ツール・提出前チェック）。変換の間は知らせを出す（依頼者の要望 2026-10-28）
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
/** iPhone の写真と同じ形式（HEIC）の見本（fixtures/make-heic.mjs で作った。450×600） */
const HEIC = fileURLToPath(new URL('./fixtures/photo.heic', import.meta.url))
/** 待つ間の知らせ（.wait-toast・提出前チェックの .d-busy）に出た言葉を、全部ためておく */
const watchToasts = (page) =>
  page.evaluate(() => {
    window.__toasts = []
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('.wait-toast .wt-text, .d-busy')) if (!window.__toasts.includes(el.textContent)) window.__toasts.push(el.textContent)
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
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
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 })
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
const editingWait = (page, id) => page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
const nameNow = (page) => page.evaluate(() => window.__editor.getSnapshot().report.basicInfo.name)
const nameFindings = (page) => page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'basic:name').map((f) => f.ruleId))
/** 氏名の欄を開き、中身を消して text を打つ（書き終えるのは呼ぶ側） */
async function typeName(page, ready, text) {
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('basic:name'), 'none'))
  await ready()
  await page.evaluate(() => window.__editor.openEditor('basic:name', 0))
  await editingWait(page, 'basic:name')
  await wait(300)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text)
  await wait(900)
}
const finish = async (page, ready) => {
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId !== 'basic:name', { timeout: 20000 })
  await wait(400)
  await ready()
}

await withEdge(async (browser) => {
  // ---- 氏名の書き方をそろえる（パソコン） ----
  {
    const { context, page, ready } = await open(browser)
    await typeName(page, ready, ' 文化 花子 ')
    const typing = await nameFindings(page)
    await finish(page, ready)
    const half = { name: await nameNow(page), findings: await nameFindings(page), cover: await page.evaluate(() => document.querySelector('.page-viewport.front .name-value')?.textContent ?? '') }
    check('氏名に半角の空白で打っても、書き終えると全角の空白1つになり（前後の空白は除く）、紙面にもそう出る。書いている間に指摘は出さない', half.name === '文化　花子' && half.cover.includes('文化　花子') && !half.findings.includes('name-space') && !typing.includes('name-space'), JSON.stringify({ typing, ...half }))

    await typeName(page, ready, '文化　　花子')
    await finish(page, ready)
    check('全角の空白が2つ続いても、1つにする', (await nameNow(page)) === '文化　花子', await nameNow(page))

    await typeName(page, ready, 'Emma Smith')
    await finish(page, ready)
    const latin = { name: await nameNow(page), findings: await nameFindings(page) }
    check('英字の名前は、打ったまま（半角の空白のまま。指摘も出さない）', latin.name === 'Emma Smith' && latin.findings.length === 0, JSON.stringify(latin))

    await typeName(page, ready, '文化花子')
    const noSpaceTyping = await nameFindings(page)
    await finish(page, ready)
    const noSpace = await page.evaluate(() => window.__editor.getSnapshot().findings.find((f) => f.ruleId === 'name-no-space') ?? null)
    await wait(600)
    const side = await page.evaluate(() => document.querySelector('.side')?.textContent ?? '')
    check(
      '空白のない「文化花子」は、書き終えてから「姓と名の間に全角の空白を入れる」（要確認）を出す（書いている間は出さない）。右の欄にも出る',
      !noSpaceTyping.includes('name-no-space') && noSpace?.severity === 'warning' && side.includes('姓と名の間に全角の空白を入れる'),
      JSON.stringify({ noSpaceTyping, noSpace }),
    )
    await typeName(page, ready, '文化　花子')
    await finish(page, ready)
    check('空白を入れると、その指摘は消える', !(await nameFindings(page)).includes('name-no-space'), JSON.stringify(await nameFindings(page)))

    // ---- 「元に戻す」で戻した所は、うすい黄色の地だけ（枠なし） ----
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p2'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.removeBlock('p2'))
    await ready()
    await wait(400)
    await page.evaluate(() => window.__editor.undo())
    await page.waitForSelector('.page-viewport.front .undo-flash', { timeout: 10000 })
    const flash = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('.page-viewport.front .undo-flash'))
      return { bg: c.backgroundColor, shadow: c.boxShadow, name: c.animationName, dur: c.animationDuration, delay: c.animationDelay }
    })
    check(
      '「元に戻す」で戻した所は、うすい黄色の地だけ（オレンジの枠なし）で、0.2秒そのままにして1.3秒で消える',
      flash.bg === 'rgba(255, 221, 120, 0.42)' && !/224, 178, 60/.test(flash.shadow) && flash.name === 'undo-flash' && flash.dur === '1.3s' && flash.delay === '0.2s',
      JSON.stringify(flash),
    )

    // ---- 紙面の上で Ctrl＋ホイール：紙面の大きさを1段ずつ（右下の「－ ＋」と同じ）。紙面の外は、ブラウザの拡大のまま ----
    await page.evaluate(() => window.__editor.setView('fit'))
    await wait(500)
    await ready()
    const view = () => page.evaluate(() => { const s = window.__editor.getSnapshot(); return { level: Math.round(s.zoomLevel * 100), zoomed: s.zoomed, spread: s.spread } })
    /** 合成のホイールを sel の上で回す（ctrl：Ctrl を押しながら）。ブラウザの動き（拡大・スクロール）を止めたか（defaultPrevented）を返す */
    const wheel = (sel, deltaY, ctrl = true) =>
      page.evaluate((sel, deltaY, ctrl) => !document.querySelector(sel).dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey: ctrl, bubbles: true, cancelable: true })), sel, deltaY, ctrl)
    const steps = []
    for (const d of [-100, -100, 100, 100]) {
      const stopped = await wheel('.page-viewport.front', d)
      await wait(400)
      steps.push({ d, stopped, ...(await view()) })
    }
    check(
      '紙面の上で Ctrl を押しながらホイールを上へ回すと、1目盛りで1段大きく（125%→150%）、下へ回すと小さく、100% で「1ページ」に戻る（ブラウザの拡大はしない）',
      steps.every((s) => s.stopped) && steps.map((s) => s.level).join() === '125,150,125,100' && steps[1].zoomed && !steps[3].zoomed,
      JSON.stringify(steps),
    )
    // タッチパッドの2本の指で広げる（Ctrl つきの小さな回転が続く）：広げた分だけ少しずつ（小さな回転10回 = 1段）
    for (let i = 0; i < 10; i++) await wheel('.page-viewport.front', -5)
    await wait(400)
    const pinch = await view()
    await page.evaluate(() => window.__editor.setView('fit'))
    await wait(400)
    const outside = { stopped: await wheel('.side', -100), ...(await view()) }
    check('タッチパッドで少し広げると1段だけ大きく。右の欄の上の Ctrl＋ホイールは、ブラウザの拡大のまま（紙面は変えない）', pinch.level === 125 && !outside.stopped && outside.level === 100, JSON.stringify({ pinch, outside }))
    // 本物のマウス：Ctrl を押しながら回しても、画面全体（ブラウザ）は拡大しない
    const dpr = await page.evaluate(() => window.devicePixelRatio)
    const center = await page.evaluate(() => { const r = document.querySelector('.page-viewport.front').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.mouse.move(center.x, center.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel({ deltaY: -100 })
    await page.keyboard.up('Control')
    await wait(500)
    const real = { ...(await view()), dpr: await page.evaluate(() => window.devicePixelRatio), was: dpr }
    check('マウスで Ctrl＋ホイールを上へ回すと、紙面だけが 125% になる（ブラウザの拡大の倍率は変わらない）', real.level === 125 && real.dpr === dpr, JSON.stringify(real))
    // 見開き：大きくすると1ページの表示にして1段大きく。小さくするときは、見開きのまま
    await page.evaluate(() => window.__editor.setView('spread'))
    await wait(600)
    await ready()
    const spreadOn = (await view()).spread
    await wheel('.page-viewport.front', 100)
    await wait(400)
    const spreadDown = await view()
    await wheel('.page-viewport.front', -100)
    await wait(600)
    const spreadUp = await view()
    check('見開きで Ctrl＋ホイールを上へ回すと、1ページの表示の 125% に（下へ回しても見開きのまま）', spreadOn && spreadDown.spread && !spreadUp.spread && spreadUp.level === 125, JSON.stringify({ spreadOn, spreadDown, spreadUp }))
    await page.evaluate(() => window.__editor.setView('fit'))
    await wait(400)
    await ready()

    // ---- Ctrl+Enter：左の道具の「改ページ」と同じ（段落の終わり・途中なら段落の後ろ、頭なら段落の前）。抄録では Enter と同じ ----
    const blocksOf = () => page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks.map((b) => `${b.type === 'pageBreak' ? 'PB' : b.id}`)).join(' '))
    const ctrlEnterAt = async (id, caret) => {
      await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
      await ready()
      await page.evaluate((id, caret) => window.__editor.openEditor(id, caret === 'end' ? window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content.map((n) => n.text ?? '').join('').length : caret), id, caret)
      await editingWait(page, id)
      await wait(300)
      await page.keyboard.down('Control')
      await page.keyboard.press('Enter')
      await page.keyboard.up('Control')
      await wait(900)
      await ready()
    }
    const before = await blocksOf()
    await ctrlEnterAt('p2', 'end')
    const afterEnd = { blocks: await blocksOf(), editing: (await page.evaluate(() => window.__editor.getSnapshot().editingId)) }
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    const undone = await blocksOf()
    await ctrlEnterAt('p2', 0)
    const afterHead = await blocksOf()
    await page.evaluate(() => window.__editor.undo())
    await wait(600)
    await ready()
    check(
      '本文の段落で Ctrl+Enter：段落の終わりなら段落の後ろに、頭なら段落の前に改ページが入る（「改ページ」の道具と同じ。元に戻すで消える）',
      afterEnd.blocks.includes('p2 PB') && afterHead.includes('PB p2') && undone === before && !before.includes('p2 PB'),
      JSON.stringify({ before, afterEnd, undone, afterHead }),
    )
    const abstractBefore = await page.evaluate(() => window.__editor.getSnapshot().report.abstract.paragraphs.length)
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('abstract'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('a1', 10))
    await editingWait(page, 'a1')
    await wait(300)
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    await wait(900)
    const abstractAfter = { paragraphs: await page.evaluate(() => window.__editor.getSnapshot().report.abstract.paragraphs.length), breaks: (await blocksOf()).split(' ').filter((b) => b === 'PB').length, was: before.split(' ').filter((b) => b === 'PB').length }
    check('抄録で Ctrl+Enter は、改ページを入れず、Enter と同じく段落を分ける', abstractAfter.paragraphs === abstractBefore + 1 && abstractAfter.breaks === abstractAfter.was, JSON.stringify({ abstractBefore, ...abstractAfter }))
    await page.keyboard.press('Escape')
    await wait(400)
    await ready()

    // ---- iPhone の写真（HEIC）：パソコンの Edge でも、端末の中で変換して図に入れる。変換の間は「HEIC を変換しています…」 ----
    await page.evaluate(() => {
      const click = HTMLInputElement.prototype.click
      HTMLInputElement.prototype.click = function () {
        window.__accept = this.accept
        return click.call(this)
      }
    })
    const nativeHeic = await page.evaluate(async (b64) => {
      try {
        ;(await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]))).close()
        return true
      } catch {
        return false
      }
    }, readFileSync(HEIC).toString('base64'))
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p3'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p3', window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p3').content.map((n) => n.text ?? '（図1）').join('').length))
    await editingWait(page, 'p3')
    await wait(300)
    await watchToasts(page)
    const figuresBefore = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'figureRow').flatMap((b) => b.figures.map((f) => f.id)))
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('図を入れる')).click())])
    await chooser.accept([HEIC])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 60000 }).catch(async (e) => {
      // 待ちきれなかったときは、そのときの様子を出す
      console.log('heic:', JSON.stringify(await page.evaluate(() => ({ editing: window.__editor.getSnapshot().editingId, toasts: window.__toasts, modal: document.querySelector('[role="alertdialog"], .modal')?.textContent ?? '' }))))
      throw e
    })
    await page.keyboard.type('作品')
    await page.keyboard.press('Escape')
    await wait(800)
    await ready()
    const heic = await page.evaluate((was) => {
      const added = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((b) => b.type === 'figureRow').flatMap((b) => b.figures).find((f) => !was.includes(f.id))
      const img = added && document.querySelector(`.page-viewport.front figure[data-figure-id="${added.id}"] img`)
      return { added: !!added?.imageId, width: img?.naturalWidth, height: img?.naturalHeight, toasts: window.__toasts, accept: window.__accept, alert: document.querySelector('.alert-modal, .modal[role="alertdialog"]')?.textContent ?? '' }
    }, figuresBefore)
    check(
      'パソコンで iPhone の写真（HEIC）を「図を入れる」で選ぶと、端末の中で変換して図に入る（450×600）。変換の間は「iPhone の写真（HEIC）を変換しています…」。選ぶ画面に .heic も出す',
      !nativeHeic && heic.added && heic.width === 450 && heic.height === 600 && heic.toasts.some((t) => t.includes('iPhone の写真（HEIC）を変換しています')) && heic.accept.includes('.heic') && !heic.alert,
      JSON.stringify({ nativeHeic, ...heic }),
    )
    await context.close()
  }

  // ---- 提出前チェック：作品写真に HEIC を入れても読める（変換の間は「iPhone の写真（HEIC）を変換しています」） ----
  {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await stubConfig(page)
    await page.setViewport({ width: 1440, height: 900 })
    await page.goto(`${APP}/check.html`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.c2-side')
    await watchToasts(page)
    await page.evaluate((b64) => {
      const dt = new DataTransfer()
      dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'IMG_0001.HEIC', { type: 'image/heic', lastModified: Date.now() }))
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    }, readFileSync(HEIC).toString('base64'))
    await page.waitForFunction(() => document.querySelector('main')?.dataset.busy === 'false' && !!document.querySelector('[aria-label="作品写真"] .pg img'), { timeout: 60000, polling: 100 }).catch(() => {})
    const checked = await page.evaluate(() => ({ img: !!document.querySelector('[aria-label="作品写真"] .pg img'), notes: [...document.querySelectorAll('.add-notes li')].map((x) => x.textContent).join(''), toasts: window.__toasts }))
    check('提出前チェック：作品写真に HEIC を入れても、変換して入る（知らせは「iPhone の写真（HEIC）を変換しています」）', checked.img && !checked.notes && checked.toasts.some((t) => t.includes('iPhone の写真（HEIC）を変換しています')), JSON.stringify(checked))
    await context.close()
  }

  // ---- スマホ：氏名をそろえる ----
  {
    const { context, page, ready } = await open(browser, { phone: true })
    await typeName(page, ready, '文化 花子')
    await page.evaluate(() => window.__editor.finishEditing())
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId !== 'basic:name', { timeout: 20000 })
    await wait(600)
    await ready()
    check('スマホ：氏名を半角の空白で打っても、書き終えると全角の空白1つになる', (await nameNow(page)) === '文化　花子', await nameNow(page))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
