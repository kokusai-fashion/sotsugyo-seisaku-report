// mockups/v79：本文のいちばん最初の薄字（ひな形の説明）に、「小見出しを付けてから書く」ことを知らせる案（学生の試し 2026-10-31）。
// 本物のツール（開発サーバー）を開き、文や CSS を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v79-subheading.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9335'
// Edge の番号は、読み込む前に決める（edge.mjs は読み込むときに番号を読む。前は 9333 になり、通しテストの Edge を閉じていた）
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v79/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '1') } catch {} })
  await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(() => window.__editor.finishEditing?.())
  return { context, page, ready }
}

/** 本文1ページ目を拡大で見せ、上の部分を撮る */
async function shoot(page, ready, name) {
  await page.evaluate(() => {
    const first = window.__editor.getSnapshot().report.body[0].blocks.find((b) => b.type === 'paragraph')
    window.__editor.goToPage(window.__editor.pageOfBlock(first.id), 'none')
  })
  await sleep(500)
  await ready()
  await page.mouse.move(1300, 700)
  const clip = await page.evaluate(() => {
    const el = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current section.body') ?? document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current')
    const r = el.getBoundingClientRect()
    return { x: Math.max(0, r.left - 60), y: Math.max(0, r.top - 30), width: Math.min(900, r.width + 120), height: 260 }
  })
  await page.screenshot({ path: join(OUT, `${name}.png`), clip })
}

await withEdge(async (browser) => {
  const { context, page, ready } = await open(browser)
  const firstId = await page.evaluate(() => window.__editor.getSnapshot().report.body[0].blocks.find((b) => b.type === 'paragraph').id)

  // 今：ひな形の説明だけ
  await shoot(page, ready, '0-now')

  // 案A：薄字の頭に一文を足す（同じ薄字の色）
  await page.evaluate((id) => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i ? c : { ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, hint: `はじめに小見出し（ⅰ．）を付けてから書く。${b.hint}` } : b)) })) })), firstId)
  await ready()
  await shoot(page, ready, 'A-hint')
  await page.evaluate((id) => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i ? c : { ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, hint: b.hint.replace('はじめに小見出し（ⅰ．）を付けてから書く。', '') } : b)) })) })), firstId)
  await ready()

  // 案B：薄字の上に、目立つ色の一行（まず「小見出し」を押す）
  const style = await page.addStyleTag({
    content: `.page-viewport [data-block-id="${firstId}"]:empty::before { content: "まず左の「小見出し」を押して、小見出し（ⅰ．）を付けてから書きます"; display: block; color: #b4532a; font-weight: 700; }
.page-viewport [data-block-id="${firstId}"]:empty::after { content: attr(data-placeholder); color: #5f6b95; }`,
  })
  await shoot(page, ready, 'B-line')
  await style.evaluate((el) => el.remove())

  // 案C：小見出しの空き枠を、最初から置いておく
  await page.evaluate((id) => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i ? c : { ...c, blocks: c.blocks.flatMap((b) => (b.id === id ? [{ type: 'subheading', id: 'mock-s', title: '' }, b] : [b])) })) })), firstId)
  await ready()
  await shoot(page, ready, 'C-slot')
  await context.close()
})
console.log('done')
