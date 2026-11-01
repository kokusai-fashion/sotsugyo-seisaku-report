// 「困ったこと・おかしいことを知らせる」と、管理ページの「届いた声」を撮る（できたものの確かめ用）。
// 使い方：node scripts/shots-feedback.mjs <まとめた版のフォルダ> <写真の出力先>（ポート 4234。Edge は 9339）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { feedbackStub, stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9339'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const [dist, OUT] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })
const server = await serveBuilt(dist, 4234)
const APP = 'http://localhost:4234'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await withEdge(async (browser) => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
    await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1.25 })
    await stubConfig(page)
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 120000 })
    const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
    await ready()
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await sleep(600)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    await page.click('.side .side-foot .feedback-link')
    await page.waitForSelector('.modal.feedback')
    await page.type('#fb-text', '表の生地見本のマスに写真を入れたら、カーソルが下のマスに出て、どこを書いているのか分からなくなった')
    await page.mouse.move(1400, 790)
    await shot('1-form')
    await page.click('.modal.feedback .fb-actions .primary')
    await page.waitForFunction(() => document.querySelector('.modal.feedback h2')?.textContent === '送りました', { timeout: 60000 })
    await shot('2-sent')
    await page.click('.modal.feedback .fb-actions .primary')
    feedbackStub.statuses.set('1101-001', { status: '直しました', reply: '' })
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await page.waitForSelector('.side .fb-done', { timeout: 20000 })
    await page.mouse.move(1400, 790)
    await shot('3-done')
    // 管理ページ（試験用のサーバー）の「届いた声」
    const admin = await context.newPage()
    await admin.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 })
    await admin.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
    await admin.waitForSelector('.admin .content')
    await admin.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('届いた声')).click())
    await admin.waitForSelector('.fb-item')
    await sleep(500)
    await admin.screenshot({ path: join(OUT, '4-admin.png'), captureBeyondViewport: false })
    await admin.evaluate(() => { const sel = document.querySelector('[data-feedback-id="1105-001"] select'); sel.value = '直しました'; sel.dispatchEvent(new Event('change', { bubbles: true })) })
    await sleep(300)
    await admin.evaluate(() => document.querySelector('[data-feedback-id="1105-001"]').scrollIntoView({ block: 'start' }))
    await sleep(300)
    await admin.screenshot({ path: join(OUT, '5-admin-done.png'), captureBeyondViewport: false })
    await context.close()
  })
} finally {
  server.close()
}
console.log('done')
