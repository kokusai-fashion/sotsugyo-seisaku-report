// 2026-10-28 の直し。これだけを流すときは node scripts/e2e/run.mjs fixes1028
// - 氏名の書き方をそろえる（依頼者の選択 案1）：書き終えたら、姓と名の間の半角の空白・続いた空白を全角の空白1つに。前後の空白は除く。
//   英字の名前は打ったまま。空白がなければ、書き終えてから「姓と名の間に全角の空白を入れる」（要確認。書いている間は出さない）
// - 「元に戻す」で戻した所は、うすい黄色の地だけ（mockups/v72 案A。枠なし。0.2秒そのままにして、1.3秒で消える）
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
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
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
