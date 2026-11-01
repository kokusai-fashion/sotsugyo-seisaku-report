// mockups/v84：表のマスに画像（生地見本）を入れたあと、カーソルが画像の下（下のマスの上端）に出て、下のマスを選んでいるように見える
// （依頼者の指摘 2026-11-01）。入れたあとの見え方の案。まとめた版（dist-e2e）を開いて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v84-cell-image.mjs（まとめた版はポート 4232。Edge は 9337）
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9337'
// Edge の番号は、読み込む前に決める（edge.mjs は読み込むときに番号を読む）
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const server = await serveBuilt('dist-e2e', 4232)
const APP = 'http://localhost:4232'
const OUT = 'mockups/v84/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await withEdge(async (browser) => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
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
    await page.evaluate(setupWriting)
    await sleep(600)
    await ready()
    // 素材表の生地見本のマスを、写真の高さにして、写真を外しておく（学生の試しと同じ：入れたばかりの形）
    const cellId = await page.evaluate(() => {
      const t = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')
      const col = t.rows[0].cells.findIndex((c) => c.text.includes('生地'))
      window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === t.id ? { ...b, heights: 'photo', rows: b.rows.map((row, i) => (i === 0 ? row : { ...row, cells: row.cells.map((cell, j) => (j === col ? { ...cell, imageId: null } : cell)) })) } : b)) })) }))
      return { tableId: t.id, cellId: t.rows[1].cells[col].id }
    })
    await ready()
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), cellId.tableId)
    await ready()
    // マスを押して、左の道具の「画像を入れる」で写真を入れる
    await page.evaluate((id) => window.__editor.openEditor(id, 0), cellId.cellId)
    await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, cellId.cellId)
    await sleep(400)
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate((id) => void window.__editor.setCellImage(id), cellId.tableId)])
    await chooser.accept([resolve('public/trial/g-shantung.jpg')])
    await sleep(2500)
    await ready()
    await page.mouse.move(1400, 790)
    const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
    await shot('0-now')
    // 案A：入れた画像を選んだ形（「この画像」の道具が出る。カーソルは出ない）
    await page.evaluate((id) => { window.__editor.finishEditing(); window.__editor.select({ kind: 'cellImage', id }) }, cellId.cellId)
    await sleep(800)
    await ready()
    await shot('A-select-image')
    // 案B：何も選ばない（書く欄を閉じるだけ。表の道具も出ない）
    await page.evaluate(() => window.__editor.select(null))
    await sleep(800)
    await shot('B-none')
    await context.close()

    // 並べた絵
    const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
    const items = [
      ['0-now', '今', '画像を入れたあと、同じマスで字を書く欄が開き直す。画像でマスが埋まっているので、カーソルが画像の下（下の行のマスの上端）に出て、下のマスを選んでいるように見える'],
      ['A-select-image', '案A　入れた画像を選んだ形にする', 'カーソルは出さず、入れた画像に選んだ印が付く。左の道具は「この画像」（切り抜き・外す・入れ替え）。続けて次のマスを押して入れる'],
      ['B-none', '案B　何も選ばない', '書く欄を閉じるだけ。印も道具も出ない。続けて次のマスを押して入れる'],
    ]
    const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 16px;color:#2b2b2b}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:18px}
.card h2{font-size:19px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:14px;margin:0 0 8px;color:#555}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>表のマスに画像を入れたあとの見え方の案</h1>
${items.map(([f, t, d]) => `<div class="card"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`).join('')}`
    const sheet = await browser.newPage()
    await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
    await sheet.setContent(html, { waitUntil: 'load' })
    const h = await sheet.evaluate(() => document.body.scrollHeight)
    await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
    await sheet.screenshot({ path: 'mockups/v84/v84-案.png', fullPage: true })
  })
} finally {
  server.close()
}
console.log('done')
