// 書いている途中の段落でも、指摘の字に赤い印が付く（依頼者の報告 2026-11-12）。これだけを流すときは node scripts/e2e/run.mjs markWhileTyping1112
// - PC の段落の書く欄は、打つたび・打つ手が止まって測り直したときに中身を作り直す。前は、作り直した字から印が外れ、
//   右の一覧には「「です・ます」ではなく…」が出ているのに、書いている段落の字は赤くならなかった（書き終えると赤くなった）。
//   同じ段落にもとからあったエラーの赤も、書き始めると外れていた
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { answerConfirms } from './confirmUi.mjs'
import { setupWriting } from './sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

/** いま見えている赤い印（issue-error）の字。空の印（外れた印）は数えない */
const marks = (page) =>
  page.evaluate(() => {
    const h = CSS.highlights.get('issue-error')
    return h ? [...h].filter((r) => !r.collapsed && r.startContainer.isConnected).map((r) => r.toString()) : []
  })

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setViewport({ width: 1440, height: 900 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await wait(800)
  await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(1500)
  await ready()
  const id = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).filter((x) => x.type === 'paragraph' && x.content.some((n) => n.text?.trim()))[1].id)
  const open = async () => {
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
    await ready()
    const box = await page.evaluate((id) => {
      const el = [...document.querySelectorAll(`.page-viewport.front [data-block-id="${id}"]`)].find((e) => e.getBoundingClientRect().width > 0)
      const r = el.getBoundingClientRect()
      return { x: r.left + 40, y: r.top + r.height / 2 }
    }, id)
    await page.mouse.click(box.x, box.y)
    await wait(500)
  }
  // 段落の終わりを「〜考えました。」にする（書き終えずに見る）
  await open()
  await page.keyboard.down('Control')
  await page.keyboard.press('End')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('ました。')
  await wait(1500)
  const listed = await page.evaluate((id) => window.__editor.getSnapshot().findings.some((f) => f.blockId === id && f.ruleId === 'desu-masu'), id)
  let m = await marks(page)
  check('書いている途中でも、右の一覧の「です・ます」の字（ました）が赤くなる', listed && m.includes('ました'), JSON.stringify(m))
  // 書き終えると、紙面の字も赤い
  await page.evaluate(() => document.activeElement.blur())
  await ready()
  await wait(600)
  m = await marks(page)
  check('書き終えても、赤いまま', m.includes('ました'), JSON.stringify(m))
  // 同じ段落を開き直して、もう1つエラーを作る間も、前からのエラーの赤は外れない（打つたびに数える）
  await open()
  await page.keyboard.press('Home')
  let kept = true
  const seen = []
  for (const ch of [...'私は']) {
    await page.keyboard.type(ch)
    for (let k = 0; k < 6; k++) {
      await wait(150)
      const now = await marks(page)
      seen.push(now.join('/'))
      if (!now.includes('ました')) kept = false
    }
  }
  check('同じ段落にもう1つエラーを作っている間も、前からあったエラーの赤は外れない', kept, seen.slice(-3).join(' | '))
  m = await marks(page)
  check('新しく作ったエラー（私）も、書いている途中から赤くなる', m.includes('私'), JSON.stringify(m))
  await context.close()

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
