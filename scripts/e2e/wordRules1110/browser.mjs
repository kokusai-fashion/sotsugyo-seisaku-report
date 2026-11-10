// 決まりを破った Word を、まとめた版（dist-e2e2）の「Word で書いた分を読み込む」で読み込み、結果を集める（wordRules1110）。
// 先に：node node_modules/vite/bin/vite.js build --mode e2e --outDir dist-e2e2 --emptyOutDir --logLevel warn
// 動かす：EDGE_PORT=9441 node scripts/e2e/wordRules1110/browser.mjs [ID,ID...]
// 結果：poc-output/wordRules1110/browser/<ID>.json・画面の写真 poc-output/wordRules1110/shots/・PDF poc-output/wordRules1110/downloads/<ID>/
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { withEdge } from '../../poc/edge.mjs'
import { serveBuilt } from '../serveBuilt.mjs'
import { stubConfig } from '../configStub.mjs'
import { answerConfirms } from '../confirmUi.mjs'
import { fillGuideName } from '../nameStep.mjs'
import { analyze, placementIssues } from './analyze.mjs'
import { APP_DIR, cases, fileNameOf, OUT } from './cases.mjs'

process.chdir(APP_DIR)
const PORT = 4251
const APP = `http://localhost:${PORT}`
const SHOTS = join(OUT, 'shots')
const RES = join(OUT, 'browser')
for (const d of [SHOTS, RES, join(OUT, 'downloads')]) mkdirSync(d, { recursive: true })
const SAMPLE_DIR = join(APP_DIR, '..', '試し用_学生のWord', 'SAMPLE', '＜SAMPLE＞Wordデータ')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const want = process.argv[2] ? new Set(process.argv[2].split(',')) : null
// ID を渡したときは、その見本だけ（browser の印がなくても）。渡さなければ browser の印のあるもの。PDF=1 で全部 PDF も書き出す
const all = cases()
  .filter((c) => (want ? want.has(c.id) : c.browser))
  .map((c) => (process.env.PDF === '1' ? { ...c, pdf: true } : c))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

const ready = (page, timeout = 180000) =>
  page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout, polling: 200 })
const checked = (page, timeout = 180000) =>
  page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !s.pageChecksPending && !document.querySelector('.loading') }, { timeout, polling: 250 })

async function runCase(browser, c) {
  const out = { id: c.id, title: c.title, steps: [], pageErrors: [], consoleErrors: [] }
  const step = (s) => {
    out.steps.push(s)
    log(c.id, s)
  }
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => out.pageErrors.push(String(e.message ?? e).slice(0, 400)))
  page.on('console', (m) => {
    if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 300))
  })
  page.on('dialog', (d) => d.accept().catch(() => {}))
  const dl = resolve(join(OUT, 'downloads', c.id))
  // 前の回の PDF は消す（同じ名前だと、新しい PDF を見分けられない）
  rmSync(dl, { recursive: true, force: true })
  mkdirSync(dl, { recursive: true })
  try {
    await (await page.createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, browserContextId: context.id })
    await page.evaluateOnNewDocument(() => {
      try {
        for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
      } catch {}
    })
    await page.setViewport({ width: 1440, height: 900 })
    await stubConfig(page)
    await answerConfirms(page, () => true)
    await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 120000 })
    await ready(page)
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画・舞台衣装')).click())
    await page.waitForSelector('.guide.step-word .g-word-opt.yes', { timeout: 30000 })
    await page.evaluate(() => document.querySelector('.g-word-opt.yes').click())
    await page.waitForSelector('.modal.word-mid', { timeout: 30000 })
    step('Word を選ぶ窓')

    const files = [join(OUT, 'docx', fileNameOf(c))]
    if (c.id === 'SM0') files.push(join(SAMPLE_DIR, '01_表紙.docx'), join(SAMPLE_DIR, '03_目次.docx'))
    for (const [row, path] of files.entries()) {
      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 20000 }), page.evaluate((row) => document.querySelectorAll('.word-file .acts button:not(.link)')[row].click(), row)])
      await chooser.accept([path])
      await wait(300)
    }
    out.rowErrors = await page.evaluate(() => [...document.querySelectorAll('.word-file small.err')].map((e) => e.textContent))
    const t0 = Date.now()
    await page.evaluate(() => document.querySelector('.modal .word-read').click())
    await page.waitForSelector('.modal.word-modal, .word-error', { timeout: 180000 })
    out.readMs = Date.now() - t0
    const readError = await page.evaluate(() => document.querySelector('.word-error')?.textContent ?? '')
    if (readError) {
      out.readError = readError
      step(`読み取れない：${readError.slice(0, 60)}`)
      await page.screenshot({ path: join(SHOTS, `${c.id}-1-error.png`) })
      return out
    }
    await wait(500)
    out.dialog = await page.evaluate(() => ({
      warnTitle: document.querySelector('.word-warn > b')?.textContent ?? '',
      problems: [...document.querySelectorAll('.word-warn li')].map((li) => li.innerText.replace(/\s*\n\s*/g, ' / ')),
      counts: [...document.querySelectorAll('.word-count span')].map((s) => s.textContent).join(' '),
      outline: [...document.querySelectorAll('.word-outline li')].map((li) => li.innerText.replace(/\s*\n\s*/g, ' ')),
      figures: [...document.querySelectorAll('.word-figs figure')].map((f) => `${f.querySelector('figcaption')?.textContent}${f.querySelector('img') ? '' : '（画像なし）'}`),
      tables: [...document.querySelectorAll('.word-tbl')].map((t) => t.textContent),
      skip: [...document.querySelectorAll('.word-skip')].map((t) => t.textContent),
      lost: document.querySelector('.word-lost')?.textContent ?? '',
      importDisabled: document.querySelector('.modal .word-import')?.disabled ?? null,
    }))
    await page.screenshot({ path: join(SHOTS, `${c.id}-1-confirm.png`) })
    step(`確認の窓：${out.dialog.counts}・知らせ ${out.dialog.problems.length}`)
    if (out.dialog.importDisabled) {
      step('「読み込む」を押せない')
      return out
    }
    const t1 = Date.now()
    await page.evaluate(() => document.querySelector('.modal .word-import').click())
    await page.waitForFunction(() => !document.querySelector('.modal.word-modal'), { timeout: 300000, polling: 250 })
    out.importMs = Date.now() - t1
    step(`読み込んだ（${out.importMs}ms）`)
    // はじめての案内（表紙の項目・ふりがな）を閉じる
    for (let k = 0; k < 8; k++) {
      await wait(1000)
      if (await page.$('.guide.step-name .name-fields input')) {
        await fillGuideName(page)
        continue
      }
      if (await page.$('.guide.step-done .g-actions .primary')) {
        await page.evaluate(() => document.querySelector('.guide.step-done .g-actions .primary').click())
        continue
      }
      if (await page.$('.guide .g-later')) {
        await page.evaluate(() => document.querySelector('.guide .g-later').click())
        continue
      }
      if (!(await page.$('.guide'))) break
    }
    const t2 = Date.now()
    await checked(page, 300000)
    out.layoutMs = Date.now() - t2
    await wait(800)
    out.after = await page.evaluate(() => {
      const ed = window.__editor
      const s = ed.getSnapshot()
      const ids = []
      for (const ch of s.report.body)
        for (const b of ch.blocks) {
          if (b.type === 'figureRow') ids.push(...b.figures.map((f) => f.id))
          else if (b.type === 'table' || b.type === 'subheading') ids.push(b.id)
          else if (b.type === 'paragraph' && b.content.some((n) => n.type === 'ref')) ids.push(b.id)
        }
      const pages = ed.pageElements()
      const overflow = pages.flatMap((p, i) => {
        const pr = p.getBoundingClientRect()
        const xs = []
        if (p.scrollWidth > p.clientWidth + 2) xs.push(`p${i + 1}: scrollWidth ${p.scrollWidth}>${p.clientWidth}`)
        if (pr.width > 0)
          for (const el of p.querySelectorAll('table, img, figure, .data-table')) {
            const r = el.getBoundingClientRect()
            if (r.width === 0) continue
            if (r.right > pr.right + 1 || r.left < pr.left - 1) xs.push(`p${i + 1}: ${el.tagName.toLowerCase()}.${el.className} 横にはみ出し ${Math.round(r.left - pr.left)}..${Math.round(r.right - pr.left)} / ${Math.round(pr.width)}`)
            if (r.bottom > pr.bottom + 1) xs.push(`p${i + 1}: ${el.tagName.toLowerCase()}.${el.className} 下にはみ出し`)
          }
        return xs
      })
      return {
        report: { body: s.report.body, basicInfo: s.report.basicInfo },
        findings: s.findings.map(({ ruleId, severity, title, detail, blockId, area, start, end }) => ({ ruleId, severity, title, detail, blockId, area, start, end })),
        acknowledged: s.acknowledged.length,
        pageCount: s.pageCount,
        kinds: s.layout?.kinds ?? [],
        bodyPages: s.layout?.bodyPages,
        pageOf: Object.fromEntries(ids.map((id) => [id, ed.pageOfBlock(id)])),
        todo: document.querySelector('.side .word-todo')?.innerText ?? null,
        tally: document.querySelector('.tally')?.innerText ?? '',
        issues: [...document.querySelectorAll('.side .issues .issue .go')].map((b) => b.getAttribute('aria-label')),
        overflow: overflow.slice(0, 20),
        images: [...document.querySelectorAll('.page-viewport img')].filter((i) => i.naturalWidth === 0 && i.complete).length,
      }
    })
    const a = analyze(out.after.report, out.after.findings)
    out.analysis = { chapters: a.chapters, findings: a.findings, placement: placementIssues(a), textRefs: a.textRefs, findingCounts: a.findingCounts }
    // 図表のページと、それを初めて指す段落のページ
    const firstRef = new Map()
    for (const ch of out.after.report.body) for (const b of ch.blocks) if (b.type === 'paragraph') for (const n of b.content) if (n.type === 'ref' && !firstRef.has(n.targetId)) firstRef.set(n.targetId, b.id)
    let fn = 0
    let tn = 0
    out.objectPages = []
    for (const ch of out.after.report.body)
      for (const b of ch.blocks) {
        const items = b.type === 'figureRow' ? b.figures.map((f) => ({ id: f.id, label: `図${++fn}` })) : b.type === 'table' ? [{ id: b.id, label: `表${++tn}` }] : []
        for (const it of items) out.objectPages.push(`${it.label}: p${out.after.pageOf[it.id] + 1}${firstRef.has(it.id) ? `（初めの参照 p${out.after.pageOf[firstRef.get(it.id)] + 1}）` : '（参照なし）'}`)
      }
    step(`紙面 ${out.after.pageCount}ページ（本文 ${out.after.bodyPages}）・指摘 ${out.after.findings.length}・つぎにすること ${out.after.todo ? 'あり' : 'なし'}`)
    await page.evaluate(() => window.__editor.goToArea('body'))
    await ready(page)
    await page.screenshot({ path: join(SHOTS, `${c.id}-2-body.png`) })
    // 位置の食い違いのある図・表のページを写す（2つまで）
    const targets = []
    let n = 0
    for (const ch of out.after.report.body)
      for (const b of ch.blocks) {
        if (b.type === 'figureRow') for (const f of b.figures) targets.push({ id: f.id, label: `図${++n}` })
      }
    const placementLabels = out.analysis.placement.map((x) => x.split(':')[0])
    const tableFirst = out.after.report.body.flatMap((ch) => ch.blocks).find((b) => b.type === 'table')
    const shotIds = [...targets.filter((t) => placementLabels.includes(t.label)).slice(0, 2), ...(/^T0[57]$/.test(c.id) && tableFirst ? [{ id: tableFirst.id, label: 'table' }] : []), ...(/^(F17|F18|F13|F19|F20)/.test(c.id) ? targets.slice(0, 1) : [])]
    for (const t of shotIds) {
      const pg = out.after.pageOf[t.id]
      if (pg === undefined || pg < 0) continue
      await page.evaluate((pg) => window.__editor.goToPage(pg, 'none'), pg)
      await ready(page)
      await wait(400)
      await page.screenshot({ path: join(SHOTS, `${c.id}-3-${t.label}-p${pg + 1}.png`) })
    }
    // 指摘を押すと、その場所へ移るか（本文の指摘を2つまで）
    out.jumps = []
    const picks = await page.evaluate(() => {
      const s = window.__editor.getSnapshot()
      const labels = [...document.querySelectorAll('.side .issues .issue .go')].map((b) => b.getAttribute('aria-label'))
      const body = s.findings.filter((f) => f.area === 'body' && f.blockId)
      const order = ['figure-order', 'figure-unreferenced', 'figure-image', 'reference-missing', 'manual-ref', 'required-text', 'table-unreferenced']
      const fig = body.find((f) => order.includes(f.ruleId))
      const other = body.find((f) => f !== fig)
      return [fig, other].filter(Boolean).map((f) => ({ ruleId: f.ruleId, title: f.title, blockId: f.blockId, index: labels.findIndex((l) => l?.includes(f.title)) }))
    })
    for (const pk of picks) {
      if (pk.index < 0) {
        out.jumps.push({ ...pk, listed: false })
        continue
      }
      await page.evaluate(() => window.__editor.goToPage(0, 'none'))
      await ready(page)
      await page.evaluate((i) => document.querySelectorAll('.side .issues .issue')[i].click(), pk.index)
      await wait(1500)
      await ready(page)
      const r = await page.evaluate((pk) => {
        const ed = window.__editor
        const s = ed.getSnapshot()
        const f = s.findings.find((x) => x.title === pk.title && x.blockId === pk.blockId)
        return { page: s.page, expected: f ? ed.pageOfFinding(f, f.end ?? f.start ?? 0) : null, editingId: s.editingId, blockPage: ed.pageOfBlock(pk.blockId) }
      }, pk)
      out.jumps.push({ ...pk, ...r, ok: r.page === r.blockPage && r.editingId === pk.blockId })
      await page.screenshot({ path: join(SHOTS, `${c.id}-4-jump-${pk.ruleId}.png`) })
      await page.keyboard.press('Escape')
      await wait(500)
      await ready(page)
    }
    step(`指摘を押す：${out.jumps.map((j) => `${j.ruleId} ${j.ok ? 'OK' : 'NG'}`).join('、') || 'なし'}`)
    // PDF
    if (c.pdf) {
      const before = new Set(readdirSync(dl))
      const t3 = Date.now()
      await page.click('.side .export')
      await page.waitForSelector('.modal .pdf-start', { timeout: 60000 })
      await page.click('.modal .pdf-start')
      await page.waitForSelector('.modal .pdf-open, .modal .pdf-print, .modal .pdf-reload', { timeout: 600000 })
      out.pdfMs = Date.now() - t3
      out.pdf = await page.evaluate(() => ({ ok: !!document.querySelector('.modal .pdf-open'), text: document.querySelector('.modal')?.innerText.slice(0, 300) }))
      let file = null
      for (let i = 0; i < 80 && !file; i++) {
        file = readdirSync(dl).find((f) => f.endsWith('.pdf') && !before.has(f)) ?? null
        if (!file) await wait(250)
      }
      if (file) {
        await wait(1000)
        const text = readFileSync(join(dl, file), 'latin1')
        out.pdf.file = file
        out.pdf.bytes = statSync(join(dl, file)).size
        out.pdf.pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length
      }
      await page.screenshot({ path: join(SHOTS, `${c.id}-5-pdf.png`) })
      step(`PDF：${out.pdf.ok ? 'できた' : 'できない'} ${out.pdf.pages ?? '?'}ページ ${out.pdf.bytes ?? ''}B ${out.pdfMs}ms`)
      await page.evaluate(() => document.querySelector('.modal .close, .modal button.x')?.click())
    }
  } catch (e) {
    out.failure = String(e?.message ?? e).slice(0, 500)
    step(`止まった：${out.failure.slice(0, 120)}`)
    await page.screenshot({ path: join(SHOTS, `${c.id}-9-failure.png`) }).catch(() => {})
  } finally {
    writeFileSync(join(RES, `${c.id}.json`), JSON.stringify(out, null, 1))
    await context.close().catch(() => {})
  }
  return out
}

const server = await serveBuilt('dist-e2e2', PORT)
try {
  await withEdge(async (browser) => {
    for (const c of all) await runCase(browser, c)
  })
} finally {
  server.close()
}
log('おわり', all.length, '件')
