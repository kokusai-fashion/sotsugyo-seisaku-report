// パソコンの右の欄を詰める（依頼者 2026-11-05：「点検の予定と記録」がいつも開いていて、直すところが縦に押しつぶされている。mockups/v110 案C）
// - 「点検の予定と記録」は、はじめは1行（次の回と先生）。押すと開き、もう一度押すと閉じる。開いたか閉じたかは、この端末で覚える
// - お知らせの見出しは、文の頭に入る（1行へる）
// - 直すところは、題名だけの短い行。説明と「このままにする」は、押した行（と書いている所の行）だけに出る
// - 1440×900 の画面で、よくある書き間違い6つが、PDF の欄に隠れずに全部見える
// - ソースコードの場所（AGPL-3.0）は、右の欄の下ではなく、右上のメニューの中
// これだけを流すときは node scripts/e2e/run.mjs sidePanel1105
import { readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const fixture = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))
const courses = fixture.courses.map((c, i) => (i === 0 ? { ...c, permission: { abstract: true, final: true }, notice: '2回目の点検は、12月の授業で行います。印刷した PDF を持ってきてください。' } : c))
// 学科の「書き間違えやすい語」（エラー3・要確認3）
const wordChecks = [
  { wrong: '見頃', right: '身頃', note: '服の胴の部分', severity: 'error' },
  { wrong: '寸方', right: '寸法', note: '', severity: 'error' },
  { wrong: '友布', right: '共布', note: '同じ布', severity: 'error' },
  { wrong: '記事', right: '生地', note: '布のこと。雑誌などの記事のことなら、そのままでよい', severity: 'warning' },
  { wrong: '証明', right: '照明', note: '舞台の明かりのこと。「証明する」の意味なら、そのままでよい', severity: 'warning' },
  { wrong: '講演', right: '公演', note: '舞台の上演のこと。講演会のことなら、そのままでよい', severity: 'warning' },
]
const TYPOS = ['前身頃と後ろ見頃をつないだ。', '寸方を測り直した。', '友布で見返しを作った。', '記事は綿のブロードを選んだ。', '証明の色に合わせて染めた。', '講演の前に仮縫いをした。']
const ROW = {
  rounds: [
    { label: '1回目', teacher: '山本', state: 'done' },
    { label: '2回目', teacher: '中村', state: 'done' },
    { label: '3回目', teacher: '小川', state: 'plan' },
    { label: '4回目', teacher: '山本', state: 'plan' },
  ],
  abstractOk: null,
  finalOk: null,
}
const KEY = `sotsugyo-seisaku-report-check-status:${fixture.fiscalYear}:00ZZ0123`

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(
    (key, row) => {
      try {
        for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
        localStorage.setItem(key, JSON.stringify({ row, at: new Date().toISOString() }))
      } catch {}
    },
    KEY,
    ROW,
  )
  await page.setViewport({ width: 1440, height: 900 })
  await stubConfig(page, { courses, wordChecks })
  await answerConfirms(page, () => true)
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
  // 学籍番号を入れ、本文の段落の終わりに書き間違いを1つずつ足す
  await page.evaluate((typos) => {
    let n = 0
    window.__editor.update((r) => ({
      ...r,
      basicInfo: { ...r.basicInfo, studentId: '00ZZ0123' },
      body: r.body.map((ch) => ({ ...ch, blocks: ch.blocks.map((b) => (b.type === 'paragraph' && b.content?.length && n < typos.length ? { ...b, content: [...b.content, { type: 'text', text: typos[n++] }] } : b)) })),
    }))
  }, TYPOS)
  await wait(1500)
  await ready()
  await page.evaluate(() => document.activeElement?.blur())
  await page.mouse.move(5, 5)
  await wait(500)

  // ---- 点検の予定と記録：はじめは1行 ----
  const card = () =>
    page.evaluate(() => {
      const c = document.querySelector('.side .check-card')
      return { folded: c.classList.contains('folded'), height: Math.round(c.getBoundingClientRect().height), rows: c.querySelectorAll('tr').length, sum: c.querySelector('.cc-sum')?.textContent ?? '', open: c.querySelector('.cc-open')?.textContent ?? '', expanded: c.querySelector('.cc-toggle')?.getAttribute('aria-expanded'), stored: localStorage.getItem('sotsugyo-seisaku-report-check-card-open') }
    })
  const c0 = await card()
  check('「点検の予定と記録」は、はじめは1行（「次は 3回目・小川先生」「開く ▾」。高さ 40px より低い）', c0.folded && c0.rows === 0 && c0.height < 40 && c0.sum === '次は 3回目・小川先生' && c0.open === '開く ▾' && c0.expanded === 'false', JSON.stringify(c0))
  await page.click('.side .check-card .cc-toggle')
  await wait(300)
  const c1 = await card()
  check('押すと開いて、回ごとの表と許可が出る（「閉じる ▴」。開いたことをこの端末で覚える）', !c1.folded && c1.rows === 4 && c1.open === '閉じる ▴' && c1.expanded === 'true' && c1.stored === '1', JSON.stringify(c1))
  await page.click('.side .check-card .cc-toggle')
  await wait(300)
  const c2 = await card()
  check('もう一度押すと、1行に戻る（覚えた印も消える）', c2.folded && c2.rows === 0 && c2.stored === null, JSON.stringify(c2))

  // ---- お知らせ・直すところ・下の欄 ----
  const panel = await page.evaluate(() => {
    const side = document.querySelector('.side')
    const foot = side.querySelector('.side-foot').getBoundingClientRect()
    const issues = [...side.querySelectorAll('.issues .issue')]
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none'
    return {
      noticeLabelInline: getComputedStyle(side.querySelector('.notice b')).display === 'inline',
      total: issues.length,
      seen: issues.filter((e) => e.getBoundingClientRect().bottom <= foot.top + 1).length,
      short: issues.every((e) => e.classList.contains('short')),
      detailsShown: issues.filter((e) => shown(e.querySelector('.detail'))).length,
      keepsShown: issues.filter((e) => shown(e.querySelector('.keep'))).length,
      keepsInDom: issues.filter((e) => e.querySelector('.keep')).length,
      source: !!side.querySelector('.side-foot .source-notice'),
    }
  })
  check('お知らせの見出し（コースからのお知らせ）は、文の頭に入る', panel.noticeLabelInline, JSON.stringify(panel))
  check('1440×900 の画面で、書き間違い6つが、PDF の欄に隠れずに全部見える（直すところは短い行）', panel.total === 6 && panel.seen === 6 && panel.short, JSON.stringify(panel))
  check('どの行も、説明と「このままにする」は隠れている（要確認の3つには「このままにする」がある）', panel.detailsShown === 0 && panel.keepsShown === 0 && panel.keepsInDom === 3, JSON.stringify(panel))
  check('右の欄の下に、ソースコードのリンクはない', !panel.source, JSON.stringify(panel))

  // ---- 行を押すと、その行だけ説明と「このままにする」が出る ----
  await page.evaluate(() => [...document.querySelectorAll('.side .issues .issue')].find((li) => li.textContent.includes('「記事」と「生地」')).querySelector('.go').click())
  await wait(800)
  const picked = await page.evaluate(() => {
    const issues = [...document.querySelectorAll('.side .issues .issue')]
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none'
    const li = issues.find((e) => e.textContent.includes('「記事」と「生地」'))
    return { open: li.classList.contains('open'), detail: shown(li.querySelector('.detail')), keep: shown(li.querySelector('.keep')), others: issues.filter((e) => e !== li && shown(e.querySelector('.detail'))).length, editing: window.__editor.getSnapshot().editingId }
  })
  check('行を押すと、その行だけに説明と「このままにする」が出る（その箇所へ移る）', picked.open && picked.detail && picked.keep && picked.others === 0 && !!picked.editing, JSON.stringify(picked))

  // ---- ソースコードの場所は、右上のメニューの中 ----
  await page.evaluate(() => document.activeElement?.blur())
  await page.click('.side .menu-btn')
  await page.waitForSelector('.head-menu')
  const menu = await page.evaluate(() => {
    const a = document.querySelector('.head-menu .hm-source')
    return a ? { text: a.textContent, href: a.getAttribute('href'), target: a.getAttribute('target') } : null
  })
  check('右上のメニューの最後に「このツールのソースコード（AGPL-3.0）」（新しいタブで開く）', !!menu && menu.text.includes('このツールのソースコード（AGPL-3.0）') && !!menu.href && menu.target === '_blank', JSON.stringify(menu))
  await page.keyboard.press('Escape')
  await context.close()

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
