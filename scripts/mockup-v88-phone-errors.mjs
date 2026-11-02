// mockups/v88：スマホで書いている学生が、直すところ（× エラー）に気づきにくい（依頼者 2026-11-02：説明の日に休んだ・手引きを読み込んでいない学生ほど、
// エラーが多いのに、下の「チェック」の赤い数に気づかない）。気づける工夫の案を、本物のツールのスマホの画面に重ねて見せる。
// 本物のツール（自動テスト用にまとめた版 dist-e2e）に見本「シンドバッド」を入れ、本文の1段落を「私は…思います。」にして、エラーを出す。
// 使い方：node scripts/mockup-v88-phone-errors.mjs（dist-e2e をこの中で出す。Edge は 9335）
import { mkdirSync } from 'node:fs'
import { serveBuilt } from './e2e/serveBuilt.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { sinbadSample, setupSinbad } from './e2e/sampleSinbad.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const PORT = 4243
const OUT = 'mockups/v88'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const server = await serveBuilt('dist-e2e', PORT)

/** 見本の段落を、この文に置き換える（です・ます と「私」で、× エラーが3つ出る） */
const BAD_TEXT = '私は、この衣装でいちばん大切にしたのは、動いたときの布の揺れだと思います。袖の刺繍は、波の形にしました。'

try {
  await withEdge(async (browser) => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(() => {
      try {
        for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
      } catch {}
    })
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await stubConfig(page)
    await page.goto(`http://localhost:${PORT}/?nodrive&direct=0`, { waitUntil: 'load', timeout: 180000 })
    const ready = () =>
      page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
    await ready()
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await sleep(500)
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
    await ready()
    await page.evaluate(setupSinbad, sinbadSample())
    await sleep(800)
    await ready()
    // 本文の最初の章の、2つ目の段落を、エラーの出る文にする
    const target = await page.evaluate((text) => {
      const r = window.__editor.getSnapshot().report
      const paras = r.body[0].blocks.filter((b) => b.type === 'paragraph')
      const p = paras[1] ?? paras[0]
      window.__editor.update((rep) => ({
        ...rep,
        body: rep.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === p.id ? { ...b, content: [{ type: 'text', text }] } : b)) })),
      }))
      return p.id
    }, BAD_TEXT)
    await sleep(800)
    await ready()
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), target)
    await sleep(1500)
    await ready()
    await sleep(1500)
    const errors = await page.evaluate(() => document.querySelector('.nav-check .badge')?.textContent ?? '0')
    console.log('エラーの数（下のチェックの赤い数）：', errors)

    const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
    await shot('0-now')

    // 案を重ねる（本物の画面の上に、案の部品を置く。部品の見た目はツールの色に合わせる）
    const geo = await page.evaluate(() => {
      const nav = document.querySelector('.p-nav').getBoundingClientRect()
      const chk = document.querySelector('.nav-check').getBoundingClientRect()
      return { navTop: nav.top, chk: { x: chk.left, y: chk.top, w: chk.width, h: chk.height } }
    })
    const overlay = (html) =>
      page.evaluate((h) => {
        document.querySelector('#mock-v88')?.remove()
        const pager = document.querySelector('.pager')
        if (pager) pager.style.translate = h.includes('data-lift') ? '0 -44px' : ''
        const el = document.createElement('div')
        el.id = 'mock-v88'
        el.innerHTML = h
        document.body.append(el)
      }, html)
    const X = '<i style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#c62828;color:#fff;font:700 12px/1 system-ui;font-style:normal">×</i>'

    // 案A：エラーがあるあいだ、下のタブのすぐ上に、ことばの帯を出し続ける（押すとチェックの欄）
    await overlay(`<div data-lift style="position:fixed;left:0;right:0;top:${geo.navTop - 44}px;height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#fdecea;border-top:1px solid #f1c0bb;font:14px/1.3 'BIZ UDPGothic','BIZ UDPゴシック',sans-serif;color:#7f1d1d;z-index:9999">
      ${X}<b style="font-weight:700">直すところが ${errors}つ あります</b><span style="margin-left:auto;color:#c62828;font-weight:700">見る ›</span></div>`)
    await shot('a-bar')

    // 案B：書き終えて「完了」を押したとき、その段落にエラーがあれば、下に知らせを出す（数秒で消える）
    await overlay(`<div style="position:fixed;left:12px;right:12px;top:${geo.navTop - 92}px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;padding:11px 14px;border-radius:12px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18);border-left:5px solid #c62828;font:14px/1.45 'BIZ UDPGothic','BIZ UDPゴシック',sans-serif;color:#1f1f1f;z-index:9999">
      ${X}<div><b>直すところがあります</b><br><span style="font-size:12.5px;color:#555">いま書いた段落の、赤い線のところ</span></div><span style="color:#c62828;font-weight:700;white-space:nowrap">直し方 ›</span></div>`)
    await shot('b-toast')

    // 案C：はじめてエラーが出たとき、一度だけ「チェック」の赤い数を指して説明する
    const cx = geo.chk.x + geo.chk.w / 2
    await overlay(`<div style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9998"></div>
      <div style="position:fixed;left:${geo.chk.x + 4}px;top:${geo.chk.y + 2}px;width:${geo.chk.w - 8}px;height:${geo.chk.h - 4}px;border-radius:12px;box-shadow:0 0 0 3px #fff, 0 0 0 9999px rgba(0,0,0,0);background:transparent;z-index:9999"></div>
      <div style="position:fixed;left:16px;right:16px;top:${geo.navTop - 150}px;padding:14px 16px 12px;border-radius:14px;background:#fff;font:14.5px/1.55 'BIZ UDPGothic','BIZ UDPゴシック',sans-serif;color:#1f1f1f;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.25)">
        <b style="font-size:15.5px">${X} 直すところがあります</b><br>下の「チェック」の赤い数は、<br>直すところの数です。<br>押すと、どこをどう直すかが出ます。
        <div style="text-align:right;margin-top:6px"><span style="display:inline-block;padding:6px 16px;border-radius:8px;background:#2f3e75;color:#fff;font-weight:700">わかった</span></div>
        <i style="position:absolute;left:${cx - 16 - 9}px;bottom:-9px;width:0;height:0;border:9px solid transparent;border-top-color:#fff;border-bottom:0"></i></div>`)
    await shot('c-first')
    await context.close()
  })
} finally {
  server.close()
}
