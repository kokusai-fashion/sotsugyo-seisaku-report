// 困ったこと・おかしいことを知らせる（依頼者の選択 2026-11-01：mockups/v85 入口A・B／窓A／知らせA）。
// 窓口（Apps Script）は configStub.mjs がまねて答える。これだけを流すときは node scripts/e2e/run.mjs feedback
import { withEdge } from '../poc/edge.mjs'
import { feedbackStub, posted, stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(context, viewport) {
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport(viewport)
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  if (await page.$('.guide.step-course .g-opts button')) {
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
  return { page, ready }
}

await withEdge(async (browser) => {
  // ---- パソコン：入口（メニュー・右の欄のいちばん下）、送る窓、送ったあと、「直しました」の知らせ ----
  {
    const context = await browser.createBrowserContext()
    const { page, ready } = await open(context, { width: 1440, height: 900 })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.click('.side .menu-btn')
    await page.waitForSelector('.head-menu')
    const menu = await page.evaluate(() => [...document.querySelectorAll('.head-menu [role=menuitem]')].map((b) => b.textContent.trim()))
    await page.keyboard.press('Escape')
    // 右の欄のいちばん下は、枠のある吹き出しの絵つきのボタン（mockups/v109 案A。字はメニューと同じ）
    const link = await page.evaluate(() => {
      const b = document.querySelector('.side .side-foot .feedback-link')
      const st = b && getComputedStyle(b)
      return { text: b?.textContent.trim() ?? '', icon: !!b?.querySelector('svg'), border: st?.borderTopWidth ?? '', oneLine: b ? b.getBoundingClientRect().height < 40 : false }
    })
    check('入口：右の「メニュー」と、右の欄のいちばん下の枠のあるボタン（絵つき・1行）に「困ったこと・おかしいことを知らせる」', menu.includes('困ったこと・おかしいことを知らせる') && link.text === '困ったこと・おかしいことを知らせる' && link.icon && link.border !== '0px' && link.oneLine, JSON.stringify({ menu, link }))

    // 使い方の欄の、言葉で探す欄の下にも入口（mockups/v109 案C）。押すと送る窓が開く（使い方は開いたまま）
    await page.click('.side .menu-btn')
    await page.waitForSelector('.head-menu')
    await page.evaluate(() => [...document.querySelectorAll('.head-menu [role=menuitem]')].find((b) => b.textContent.trim() === '使い方').click())
    await page.waitForSelector('.help .help-feedback')
    const inHelp = await page.evaluate(() => document.querySelector('.help .help-feedback').textContent)
    await page.click('.help .help-feedback')
    await page.waitForSelector('.modal.feedback')
    check('入口：使い方の欄の上にも「困ったこと・おかしいことを知らせる」があり、押すと送る窓が開く', inHelp.includes('困ったこと・おかしいことを知らせる') && inHelp.includes('学科に知らせます'))
    await page.evaluate(() => document.querySelector('.modal.feedback .close')?.click())
    await page.waitForFunction(() => !document.querySelector('.modal.feedback'))
    await page.evaluate(() => document.querySelector('.help .help-close')?.click())
    await page.waitForFunction(() => !document.querySelector('.help'))

    // 右の欄のいちばん下から開く：種類・欄・ページの写真・いっしょに送るもの・返事の目安
    await page.click('.side .side-foot .feedback-link')
    await page.waitForSelector('.modal.feedback')
    const form = await page.evaluate(() => {
      const m = document.querySelector('.modal.feedback')
      return {
        title: m.querySelector('h2').textContent,
        kinds: [...m.querySelectorAll('.fb-kinds button')].map((b) => `${b.textContent}${b.getAttribute('aria-checked') === 'true' ? '*' : ''}`),
        focus: document.activeElement?.id,
        auto: m.querySelector('.fb-auto').textContent,
        wait: m.querySelector('.fb-wait').textContent,
        sendDisabled: m.querySelector('.fb-actions .primary').disabled,
      }
    })
    check(
      '送る窓：「うまく動かない」（選んだ形）「やり方が分からない」「そのほか」、書く欄に入る。いっしょに送るもの（開いていたページの名前つき）・「原稿の文や写真は送りません」・返事の目安。書くまで「送る」は押せない',
      form.title === '困ったこと・おかしいことを知らせる' && form.kinds.join('|') === 'うまく動かない*|やり方が分からない|そのほか' && form.focus === 'fb-text' && /開いていたページ（本文/.test(form.auto) && form.auto.includes('原稿の文や写真は送りません') && form.wait.includes('数日かかることがあります') && form.wait.includes('担当の先生に直接') && form.sendDisabled,
      JSON.stringify(form),
    )
    posted.length = 0
    // ツールの中でエラーが起きた、ことにする（テストから投げたエラーは「Script error.」になり、中身が分からないので送らない。
    // ツールの中で起きたのと同じ形の知らせを出す）
    await page.evaluate(() => { const error = new Error('e2e-feedback-error'); window.dispatchEvent(new ErrorEvent('error', { message: error.message, error })) })
    await wait(300)
    await page.click('.modal.feedback .fb-kinds button:nth-child(2)')
    await page.type('#fb-text', '表の写真の入れ方が分かりません')
    await page.click('.modal.feedback .fb-attach input')
    await page.click('.modal.feedback .fb-actions .primary')
    await page.waitForFunction(() => document.querySelector('.modal.feedback h2')?.textContent === '送りました', { timeout: 60000 })
    const sent = posted.find((p) => p.action === 'feedback')
    const shownNo = await page.evaluate(() => document.querySelector('.modal.feedback .fb-sent .no')?.textContent)
    check(
      '送ると：種類・書いた文・版・端末・開いていたページ・直前のエラー・ページの写真（JPEG）を窓口に送り、受付番号を出す（原稿の文は送らない）',
      !!sent && sent.kind === 'やり方が分からない' && sent.text === '表の写真の入れ方が分かりません' && !!sent.version && /パソコンの画面/.test(sent.device) && /^本文/.test(sent.page) && sent.errors.includes('e2e-feedback-error') && typeof sent.screen === 'string' && sent.screen.startsWith('/9j/') && shownNo === '1101-001' && !JSON.stringify(sent).includes('筆者が担当したのは'),
      JSON.stringify({ ...sent, screen: sent?.screen?.slice(0, 8) }),
    )
    const errorLog = posted.find((p) => p.action === 'errorLog' && p.message.includes('e2e-feedback-error'))
    check('ツールの中で起きたエラーは、知らせなくても窓口に送る（版・端末・ページ。原稿の文は送らない）', !!errorLog && !!errorLog.version && !!errorLog.page, JSON.stringify(errorLog))
    await page.click('.modal.feedback .fb-actions .primary')
    await wait(200)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sotsugyo-seisaku-report-feedback') ?? '[]'))
    check('送った声（受付番号と鍵）を、この端末に覚える', stored.length === 1 && stored[0].id === '1101-001' && stored[0].key === 'key-1101-001' && stored[0].summary === '表の写真の入れ方が分かりません', JSON.stringify(stored))

    // 管理ページで「直しました」にした：開き直すと、右の欄のいちばん上に緑の知らせ（× で閉じるまで）
    feedbackStub.statuses.set('1101-001', { status: '直しました', reply: '' })
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await page.waitForSelector('.side .fb-done', { timeout: 20000 })
    const done = await page.evaluate(() => ({ text: document.querySelector('.side .fb-done').textContent, before: document.querySelector('.side .fb-done').nextElementSibling?.className ?? '' }))
    check('「直しました」にすると、開いたときに右の欄のいちばん上に「✓ 直しました …「表の写真の入れ方が分かりません」は、直しました。」', done.text.startsWith('✓ 直しました') && done.text.includes('「表の写真の入れ方が分かりません」は、直しました。'), JSON.stringify(done))
    await page.click('.side .fb-done .x')
    await wait(200)
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await wait(1500)
    const gone = await page.evaluate(() => !!document.querySelector('.fb-done'))
    check('× で閉じると、開き直しても出ない', !gone)
    await context.close()
  }

  // ---- スマホ：メニューの中の入口から開く。「使い方で解決」のひとことも出る ----
  {
    const context = await browser.createBrowserContext()
    const { page } = await open(context, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await page.evaluate(() => { localStorage.setItem('sotsugyo-seisaku-report-feedback', JSON.stringify([{ id: '1101-009', key: 'key-1101-009', sentAt: '2026-11-05T01:00:00.000Z', summary: '抄録の写し方' }])) })
    feedbackStub.statuses.set('1101-009', { status: '使い方で解決', reply: '使い方の「抄録」の動画を見てください' })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction(() => !!window.__editor?.getSnapshot()?.layout, { timeout: 120000 })
    await wait(1500)
    await page.evaluate(() => [...document.querySelectorAll('button.icon-btn')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('メニュー'))?.click())
    await page.waitForSelector('.sheet .feedback-menu-link', { timeout: 20000 })
    const phone = await page.evaluate(() => ({ done: document.querySelector('.sheet .fb-done')?.textContent ?? '', link: document.querySelector('.sheet .feedback-menu-link').textContent }))
    check('スマホ：メニューの中に入口と「使い方で解決できます」の知らせ（ひとこと付き）', phone.link.trim() === '困ったこと・おかしいことを知らせる' && phone.done.includes('使い方で解決できます') && phone.done.includes('「抄録」の動画'), JSON.stringify(phone))
    await page.evaluate(() => document.querySelector('.sheet .feedback-menu-link').click())
    await page.waitForSelector('.modal.feedback')
    const fits = await page.evaluate(() => { const r = document.querySelector('.modal.feedback').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })
    check('スマホ：送る窓が画面の幅に収まる', fits)
    // スマホ：下の「使い方」の欄からも開ける（使い方の欄を閉じてから窓を開く。mockups/v109 案C）
    await page.evaluate(() => document.querySelector('.modal.feedback .close')?.click())
    await page.waitForFunction(() => !document.querySelector('.modal.feedback'))
    await page.evaluate(() => document.querySelector('.nav-help').click())
    await page.waitForSelector('.help .help-feedback')
    await page.evaluate(() => document.querySelector('.help .help-feedback').click())
    await page.waitForSelector('.modal.feedback')
    const helpClosed = await page.evaluate(() => !document.querySelector('.help'))
    check('スマホ：使い方の欄の入口から送る窓が開き、使い方の欄は閉じる', helpClosed)
    await context.close()
  }

  // ---- 管理ページ（試験用のサーバー）：「届いた声」の一覧・状態を変えて学生に知らせる ----
  {
    const context = await browser.createBrowserContext()
    const admin = await context.newPage()
    await admin.setViewport({ width: 1366, height: 900 })
    await admin.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('.admin .content')
    await admin.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('届いた声')).click())
    await admin.waitForSelector('.fb-item')
    const list = await admin.evaluate(() => ({
      filters: [...document.querySelectorAll('.fb-filter button')].map((b) => b.textContent),
      ids: [...document.querySelectorAll('.fb-item')].map((e) => e.dataset.feedbackId),
      first: document.querySelector('.fb-item .fb-meta')?.textContent ?? '',
      notifyButton: !!document.querySelector('.fb-item .fb-buttons .primary'),
    }))
    check('管理ページ：左の見出しの「届いた声」に、まだのもの（受け付けた・確かめ中）の一覧。送った人・端末・ページ。知らせる状態でなければ「知らせる」は出ない', list.filters.join('|') === 'まだのもの 2|すべて 2' && list.ids.join(',') === '1105-002,1105-001' && list.first.includes('00ZZ0124') && list.first.includes('スマホの画面') && !list.notifyButton, JSON.stringify(list))
    await admin.select('[data-feedback-id="1105-001"] select', '直しました')
    await admin.waitForSelector('[data-feedback-id="1105-001"] .fb-buttons .primary')
    await admin.click('[data-feedback-id="1105-001"] .fb-buttons .primary')
    await admin.waitForSelector('.confirm-modal')
    const confirm = await admin.evaluate(() => document.querySelector('.confirm-modal').textContent)
    await admin.click('.confirm-modal [data-confirm="ok"]')
    await admin.waitForFunction(() => document.querySelector('.fb-filter button')?.textContent === 'まだのもの 1', { timeout: 20000 })
    await admin.click('.fb-filter button:nth-child(2)')
    await admin.waitForSelector('[data-feedback-id="1105-001"]')
    const head = await admin.evaluate(() => document.querySelector('[data-feedback-id="1105-001"] .fb-head').textContent)
    check('「直しました」にして「保存して学生に知らせる」：確かめの窓（学生のツールと大学のメールに知らせる）のあと、まだのものから外れ、「知らせた」の札', confirm.includes('学生に知らせますか') && confirm.includes('wu00zz0123@bunka-wu.ac.jp') && head.includes('直しました') && head.includes('知らせた'), JSON.stringify({ confirm, head }))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
