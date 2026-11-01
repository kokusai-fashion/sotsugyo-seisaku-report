// 見直した見本の原稿（お試しの見本 gas/trial-sample.private.json と、写真 public/trial/）を、学生のツールに入れて全ページを撮る（確かめ用。git に入れない）
// 使い方：node scripts/shots-sinbad-sample.mjs <まとめた版のフォルダ> <写真の出力先>（Edge は 9336・サーバーは 4231）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const [dist, OUT] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })
const sample = JSON.parse(readFileSync('gas/trial-sample.private.json', 'utf8'))
const server = await serveBuilt(dist, 4231)
const APP = 'http://localhost:4231'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await withEdge(async (browser) => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await stubConfig(page)
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 120000 })
    const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
    await ready()
    // 写真と原稿を、このブラウザの入れ物に置いて、開き直す
    await page.evaluate(async (sample) => {
      const { putImage, saveReport } = await window.__import('model/storage.ts')
      const { importImage } = await window.__import('model/images.ts')
      for (const { id, file, maxPx } of sample.images) {
        const blob = await (await fetch(`/trial/${file}`)).blob()
        await putImage(await importImage(blob, id, maxPx))
      }
      await saveReport(sample.report)
    }, sample)
    await page.reload({ waitUntil: 'networkidle0' })
    await ready()
    await sleep(1500)
    await ready()
    const info = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return { pages: s.layout.kinds, findings: s.findings.map((f) => `${f.severity}:${f.title}`) } })
    console.log(JSON.stringify(info))
    for (let i = 0; i < info.pages.length; i++) {
      await page.evaluate((i) => window.__editor.goToPage(i, 'none'), i)
      await sleep(400)
      await ready()
      const box = await page.evaluate(() => { const r = document.querySelector('.page-viewport.front [data-vivliostyle-page-container].is-current').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })
      await page.screenshot({ path: join(OUT, `${String(i + 1).padStart(2, '0')}-${info.pages[i]}.png`), clip: box, captureBeyondViewport: false })
    }
    // PDF：学生の「PDFを書き出す」と同じ作り方（pdf/exportPdf.ts の buildPdf）で作り、写真の出力先に置く
    const pdf = await page.evaluate(async () => {
      const { buildPdf } = await window.__import('pdf/exportPdf.ts')
      const built = await buildPdf(window.__editor.pageElements(), { title: window.__editor.pdfTitle })
      const bytes = new Uint8Array(await built.blob.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return { name: built.fileName, pages: built.pageCount, data: btoa(bin) }
    })
    writeFileSync(join(OUT, pdf.name), Buffer.from(pdf.data, 'base64'))
    console.log('pdf', pdf.name, pdf.pages)
    await context.close()
  })
} finally {
  server.close()
}
console.log('done')
