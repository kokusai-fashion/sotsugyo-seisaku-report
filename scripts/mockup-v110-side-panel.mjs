// mockups/v110（2026-11-05）：パソコンの右の欄を整理する案（依頼者：「点検の予定と記録」がいつも開いていて、セルフチェックの「直すところ」が
//   縦に押しつぶされている。直すところは、1つの画面でできるだけ多く見えるほうが誤りに気づきやすい）
//   今：お知らせ・点検の予定と記録（いつも開いている）・セルフチェック（進み具合・直すところ）・PDF・知らせる・ソースコード
//   案A：「点検の予定と記録」を1行にたたむ（次の回と先生だけ。押すと開く）
//   案B：案A ＋ ほかも詰める（お知らせの見出しを文の頭に入れて1行へらす・PDF の下のひとことと「知らせる」を1行ずつ細く・ソースコードの字はメニューの中へ）
//   案C：案B ＋ 直すところは1件を短く（説明と「このままにする」は、選んでいる項目だけに出す）
//   （上の段に「点検」の札を置く案も考えたが、保存のようすと締切の行に入らず、行が1つ増えたので外した）
//   本物のツール（まとめた版）に見本「シンドバッド」を入れ、よくある書き間違いを6つ入れて撮る。名前・先生はすべて作り物。
//   使い方：APP_URL=http://localhost:4180 node scripts/mockup-v110-side-panel.mjs（Edge は 9336）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { fakeDrive, routeGoogle } = await import('./e2e/fakeGoogle.mjs')
const { closeGuide } = await import('./e2e/nameStep.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v110'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VIEW = { width: 1440, height: 900, deviceScaleFactor: 2 }

// 設定：本番の写し（poc-output/live-config-1104b.json）。先生の名前は作り物に、コースのお知らせと先生の許可を入れる
const live = JSON.parse(readFileSync('poc-output/live-config-1104b.json', 'utf8'))
const config = live.config ?? live
config.notice = ''
for (const c of config.courses) c.advisors = ['山本　恵子', '中村　健一', '小川　真理']
const film = config.courses.find((c) => c.id === 'film-stage-costume')
film.notice = '2回目の点検は、12月の授業で行います。印刷した PDF を持ってきてください。'
film.permission = { abstract: true, final: true }
const ROW = {
  rounds: [
    { label: '1回目', teacher: '小川', state: 'done' },
    { label: '2回目', teacher: '山本', state: 'done' },
    { label: '3回目', teacher: '中村', state: 'plan' },
    { label: '抄録', teacher: '中村', state: 'plan' },
    { label: '4回目', teacher: '小川', state: 'plan' },
  ],
  abstractOk: null,
  finalOk: null,
}
const SAMPLE = JSON.parse(readFileSync('gas/trial-sample.private.json', 'utf8'))
// よくある書き間違い（学科の「書き間違えやすい語」。エラー3・要確認3）
const TYPOS = [
  ['身頃', '見頃'],
  ['寸法', '寸方'],
  ['共布', '友布'],
  ['生地', '記事'],
  ['照明', '証明'],
  ['公演', '講演'],
]

async function setupSample(page) {
  await page.evaluate(async (sample, typos) => {
    const made = []
    for (const { id, file } of sample.images) {
      const blob = await (await fetch(`trial/${file}`)).blob()
      const bitmap = await createImageBitmap(blob)
      made.push({ id, blob, widthPx: bitmap.width, heightPx: bitmap.height })
      bitmap.close()
    }
    window.__editor.addImages(made)
    const r0 = window.__editor.getSnapshot().report
    // 本文の段落の字だけを書き換える（見出し・図のタイトルは変えない）
    const report = { ...sample.report, fiscalYear: r0.fiscalYear, basicInfo: { ...sample.report.basicInfo, courseId: r0.basicInfo.courseId }, abstract: { ...sample.report.abstract, started: false }, updatedAt: new Date().toISOString() }
    let text = JSON.stringify(report)
    for (const [a, b] of typos) {
      const i = text.indexOf(a, text.indexOf('"body"'))
      if (i > 0) text = text.slice(0, i) + b + text.slice(i + a.length)
    }
    window.__editor.replace(JSON.parse(text))
  }, SAMPLE, TYPOS)
}

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => d.accept())
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'pinch-tip', 'knob-hint', 'zoom-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setViewport(VIEW)
  const drive = fakeDrive('00zz0123@bunka-wu.ac.jp')
  drive.checkRow = ROW
  await routeGoogle(page, drive, config)
  await page.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.addStyleTag({ content: '.login-over.tab-locked { display: none !important; }' })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.click('.login-btn')
  await page.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 60000 })
  await page.waitForSelector('.guide.step-course .g-opts button')
  await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画・舞台衣装')).click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 30000 })
  await closeGuide(page)
  await page.evaluate(() => window.__editor.finishEditing())
  await ready()
  await setupSample(page)
  await sleep(1500)
  await ready()
  await page.waitForSelector('.side .check-card', { timeout: 30000 })
  // 本文の2ページ目（作品の説明の途中）を見ているところ
  await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf('body') + 1, 'none'))
  await sleep(800)
  await ready()
  await page.evaluate(() => document.activeElement?.blur())
  await page.mouse.move(5, 5)
  const f = await page.evaluate(() => window.__editor.getSnapshot().findings.map((x) => `${x.severity}:${x.title}`))
  console.log(`指摘 ${f.length}件：${f.join(' / ')}`)
  return { context, page }
}

/** 右の欄の中で、直すところの何件が見えているか（下の PDF の欄に隠れていない件数）と、各部分の高さ */
const measure = (page) =>
  page.evaluate(() => {
    const side = document.querySelector('.side')
    const foot = side.querySelector('.side-foot').getBoundingClientRect()
    const issues = [...side.querySelectorAll('.issues .issue')]
    const seen = issues.filter((e) => e.getBoundingClientRect().bottom <= foot.top + 1).length
    const h = (sel) => Math.round(side.querySelector(sel)?.getBoundingClientRect().height ?? 0)
    return { seen, total: issues.length, head: h('.side-head'), notice: h('.notice'), card: h('.check-card'), foot: Math.round(foot.height), sideW: Math.round(side.getBoundingClientRect().width) }
  })

// 見た目の変更は CSS だけで入れる（ツールが右の欄を描き直しても消えないように。字を足すところは ::after）
const CSS = {
  // 案A：「点検の予定と記録」を1行にたたむ（次の回と先生だけ。右に「開く ▾」）
  A: `.side .check-card{position:relative;padding:6px 10px}
.side .check-card table,.side .check-card .perm,.side .check-card h4 small{display:none}
.side .check-card h4{margin:0}
.side .check-card h4::after{content:'次は 3回目・中村先生';color:#7a5200;font-weight:700;letter-spacing:0;font-size:11.5px}
.side .check-card::after{content:'開く ▾';position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted)}`,
  // 案A を開いたところ（今と同じ中身。右上に「閉じる ▴」）
  Aopen: `.side .check-card{position:relative}
.side .check-card::after{content:'閉じる ▴';position:absolute;right:10px;top:8px;font-size:11px;color:var(--muted)}`,
  // 案B：案A ＋ ほかを詰める（お知らせの見出しを文の頭に・エラーと要確認の説明を1行に・PDF の下を細く・ソースコードの字はメニューの中へ）
  B: `.side .notice b{display:inline;margin-right:6px}
.side .notice p{display:inline;margin:0}
.side .sev-legend{flex-wrap:nowrap;gap:0 10px;font-size:10.5px;white-space:nowrap}
.side .sev-legend .dot{width:14px;height:14px}
.side .side-foot{padding:10px 16px 10px}
.side .side-foot .export{padding:10px 0}
.side .side-foot p.export-note{margin-top:5px}
.side .feedback-link{margin-top:7px!important;padding:5px 10px!important}
.side .source-notice{display:none!important}`,
  // 案C：案B ＋ 直すところは、1件を短く（説明と「このままにする」は、選んでいる項目だけに出す。ここでは1件目を選んでいるところ）
  C: `.side .issues .issue{padding:7px 4px}
.side .igroup .issue .detail,.side .igroup .issue .keep{display:none}
.side .issues .issue:first-child{background:#fdf6e7}
.side .issues .issue:first-child .detail,.side .issues .issue:first-child .keep{display:block}`,
}

async function variant(page, keys) {
  for (const key of keys) await page.addStyleTag({ content: CSS[key] })
  await sleep(500)
  await page.evaluate(() => document.activeElement?.blur())
}

/** 右の欄だけを撮る（倍の細かさ） */
async function shotSide(page, name) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('.side').getBoundingClientRect()
    return { x: b.left, y: 0, width: b.width, height: innerHeight }
  })
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: r })
  return r
}

await withEdge(async (browser) => {
  const results = {}
  const PLAN = { now: [], A: ['A'], B: ['A', 'B'], C: ['A', 'B', 'C'] }
  for (const [key, keys] of Object.entries(PLAN)) {
    const { context, page } = await open(browser)
    await variant(page, keys)
    results[key] = await measure(page)
    await shotSide(page, `side-${key}`)
    if (key === 'A') {
      await page.addStyleTag({ content: '.side .check-card table,.side .check-card .perm{display:revert!important}.side .check-card table{display:table!important}.side .check-card .perm{display:block!important}.side .check-card h4 small{display:inline!important}.side .check-card h4{margin:0 0 4px!important}.side .check-card h4::after{content:none!important}.side .check-card{padding:8px 10px 9px!important}' })
      await variant(page, ['Aopen'])
      await shotSide(page, 'side-A-open')
    }
    console.log(key, JSON.stringify(results[key]))
    await context.close()
  }
  writeFileSync(`${OUT}/measure.json`, JSON.stringify(results, null, 1))
})

// 4つを横に並べた1枚（題名と、直すところ6件のうち見えている数）
const TITLES = {
  now: ['今', '「点検の予定と記録」がいつも開いている'],
  A: ['案A', '「点検の予定と記録」を1行にたたむ（押すと開く）'],
  B: ['案B', '案A ＋ ほかを詰める（お知らせの見出し・説明を1行に、下の欄を細く、ソースコードはメニューへ）'],
  C: ['案C', '案B ＋ 直すところは1件を短く（説明は、選んでいる項目だけ）'],
}
const m = JSON.parse(readFileSync(`${OUT}/measure.json`, 'utf8'))
const img = (f) => `data:image/png;base64,${readFileSync(`${OUT}/${f}.png`).toString('base64')}`
const cells = Object.entries(TITLES).map(([k, [t, sub]]) => `<figure><h2>${t}</h2><p>${sub}</p><img src="${img(`side-${k}`)}"><div class="n">直すところ ${m[k].total}件のうち、見えているのは <b>${m[k].seen}件</b></div></figure>`).join('')
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px 28px;background:#f3f1ec;font-family:'BIZ UDPGothic','Yu Gothic UI',sans-serif;color:#222}
h1{margin:0 0 4px;font-size:22px}.lead{margin:0 0 18px;font-size:14px;color:#555}
.row{display:flex;gap:22px;align-items:flex-start}figure{margin:0;width:340px}h2{margin:0;font-size:20px}figure p{margin:4px 0 10px;min-height:54px;font-size:13px;line-height:1.5;color:#444}
img{width:340px;display:block;border:1px solid #cfcac0;box-shadow:0 2px 10px rgba(0,0,0,.12)}.n{margin-top:10px;font-size:14px}.n b{font-size:18px;color:#b3261e}</style>
<h1>右の欄の整理（パソコン・画面 1440×900）</h1><p class="lead">見本の原稿に、よくある書き間違いを6つ（エラー3・要確認3）入れたところ。名前と先生は作り物です。</p><div class="row">${cells}</div>`
await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1490, height: 1100, deviceScaleFactor: 1.5 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const h = await page.evaluate(() => document.body.scrollHeight)
  await page.setViewport({ width: 1490, height: h, deviceScaleFactor: 1.5 })
  await page.screenshot({ path: `${OUT}/右の欄の案.png` })
  console.log(`${OUT}/右の欄の案.png`)
})
