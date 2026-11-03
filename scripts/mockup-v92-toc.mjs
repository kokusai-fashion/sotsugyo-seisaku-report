// mockups/v92：目次の Word にだけ書いた見出しも読み込む（依頼者 2026-11-03 の会議のあと。import/wordToc.ts）。
// 本物のツール（自動テスト用にまとめた版）で、見本_シンドバッド（新）/途中まで書いたWord の本文・表紙・目次を選び、窓を撮る。
// 目次の Word は、学科のひな形（../03_目次.docx）の「〇〇〇〇」を、見本の小見出しの名前にしたもの（ⅳ．ターバン・ⅴ．靴は、本文にまだない）。
// 使い方：APP_URL=http://localhost:4180 node scripts/mockup-v92-toc.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v92'
const DIR = resolve('..', '見本_シンドバッド（新）', '途中まで書いたWord')
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done') } catch {} })
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.yes')
  await page.evaluate(() => document.querySelector('.g-word-opt.yes').click())
  await page.waitForSelector('input[type=file][aria-label*="本文"]')
  for (const [label, file] of [['本文', '04_本文.docx'], ['表紙', '01_表紙.docx'], ['目次', '03_目次.docx']]) {
    await (await page.$(`input[type=file][aria-label*="${label}"]`)).uploadFile(resolve(DIR, file))
    await sleep(600)
  }
  const shot = async (name) => {
    const box = await page.evaluate(() => { const r = document.querySelector('.modal')?.getBoundingClientRect(); return r ? { x: r.left - 12, y: Math.max(0, r.top - 12), width: r.width + 24, height: Math.min(r.height + 24, innerHeight - Math.max(0, r.top - 12)) } : null })
    await page.screenshot({ path: `${OUT}/${name}.png`, ...(box ? { clip: box, captureBeyondViewport: false } : {}) })
  }
  await shot('1_ファイルを選ぶ（目次の欄）')
  await page.evaluate(() => document.querySelector('.word-read').click())
  await page.waitForFunction(() => { const b = document.querySelector('.word-import'); return b && !b.disabled }, { timeout: 60000 })
  await sleep(800)
  await shot('2_中身を確かめる（上）')
  await page.evaluate(() => document.querySelector('.word-outline')?.scrollIntoView({ block: 'start' }))
  await sleep(400)
  await shot('3_中身を確かめる（見出しの一覧）')
  const outline = await page.evaluate(() => [...document.querySelectorAll('.word-outline li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()))
  console.log(outline.join('\n'))
  await context.close()
})
console.log('done')
