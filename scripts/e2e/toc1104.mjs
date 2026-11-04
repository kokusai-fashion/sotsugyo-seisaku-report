// PDF の目次（依頼者の選択 2026-11-04 案3）：まだ何も書いていない章のページは PDF に入れないが、目次には、すべての章と中見出し・小見出しを載せる。
// - 書いていない章（とその中見出し・小見出し）の行は灰色で、ページ番号（とリーダー）を付けない
// - 灰色の章があるときだけ、目次の下に「灰色の章は、まだ書いていないので、この PDF には入っていません」
// - 章の番号（Ⅰ．Ⅱ．…）は詰めない：目次も本文の見出しも、原稿の番号のまま（Ⅱ を書いていなければ、本文はⅠとⅢ）
// - 画面の紙面の目次は今までどおり（灰色の行も、わけの1行もない）
// - すべての章を書き始めたら、灰色の行も、わけの1行もない
// 目次のページの絵は poc-output/toc1104/ に置く（見た目の確かめ用）。
// これだけを流すときは node scripts/e2e/run.mjs toc1104
import { mkdirSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/toc1104'
mkdirSync(OUT, { recursive: true })
const NOTE = '灰色の章は、まだ書いていないので、この PDF には入っていません'
const GRAY = 'rgb(138, 143, 153)'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }

async function open(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  await page.setViewport({ width: 1440, height: 1200 })
  await stubConfig(page)
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
  await ready()
  return { context, page, ready }
}
const settle = async (page, ready) => {
  await wait(1200)
  await ready()
}

/**
 * PDF に入れるページ（editor.pdfPages）から、目次の行・目次の下の1行・本文の大見出しを読む。
 * shot：目次のページの絵を撮るファイル名（画面に出さない所で組んだページを、撮る間だけ前に出す）
 */
async function pdfFacts(page, shot) {
  const facts = await page.evaluate(async () => {
    const { pages, release } = await window.__editor.pdfPages()
    const kept = pages.filter((p) => !p.classList.contains('print-skip'))
    const kindOf = (p) => ['cover', 'abstract', 'toc', 'body', 'references', 'photos'].find((k) => p.querySelector(`section.${k}`)) ?? ''
    const tocPage = kept.find((p) => kindOf(p) === 'toc')
    const rows = [...(tocPage?.querySelectorAll('.toc .toc-ch, .toc .toc-sub') ?? [])].map((el) => ({
      id: el.dataset.tocTarget,
      text: el.querySelector('span')?.textContent ?? '',
      sub: el.classList.contains('toc-sub'),
      gray: el.classList.contains('not-started'),
      color: getComputedStyle(el).color,
      pno: el.querySelector('.pno')?.textContent ?? null,
      leader: !!el.querySelector('.leader'),
    }))
    const noteEl = tocPage?.querySelector('.toc .toc-not-started')
    const note = noteEl ? { text: noteEl.textContent, color: getComputedStyle(noteEl).color, inPage: noteEl.getBoundingClientRect().bottom <= tocPage.getBoundingClientRect().bottom + 1 } : null
    // 本文の大見出し（章を分けて組むときの「次の章の始まり」の代わりは数えない）と、本文の何ページ目か
    const bodyStart = kept.findIndex((p) => kindOf(p) === 'body')
    const headings = kept.flatMap((p, i) => [...p.querySelectorAll('h1.chapter:not([data-sentinel])')].map((h) => ({ text: h.textContent.trim(), page: i - bodyStart + 1 })))
    let shotRect = null
    // 目次のページの絵を撮る間だけ、組んだ所を前に出し、目次のページだけを見せる（書いていない章がなく、画面の紙面をそのまま使うときは撮らない）
    const paper = document.querySelector('.export-paper')
    if (tocPage && paper) {
      paper.style.cssText = 'opacity:1;z-index:99999;background:#fff'
      for (const p of pages) p.classList.toggle('is-current', p === tocPage)
      const r = tocPage.getBoundingClientRect()
      shotRect = { x: r.left, y: r.top, width: r.width, height: r.height }
    }
    window.__releaseToc1104 = release
    return { n: kept.length, rows, note, headings, shotRect, paper: !!paper }
  })
  if (shot && facts.shotRect && facts.shotRect.width > 0) await page.screenshot({ path: `${OUT}/${shot}`, clip: facts.shotRect })
  facts.paperAfter = await page.evaluate(() => {
    window.__releaseToc1104()
    return !!document.querySelector('.export-paper')
  })
  return facts
}

await withEdge(async (browser) => {
  const { context, page, ready } = await open(browser)

  // ---- 真ん中の章（Ⅱ．制作過程）を、まだ何も書いていない章にする（中見出し・小見出し・ひな形の説明・写真のない図の枠だけ） ----
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) =>
        c.id === 'c2'
          ? {
              ...c,
              blocks: [
                { type: 'subheading', id: 's4', title: 'パターンと仮縫い' },
                { type: 'paragraph', id: 'q1', content: [{ type: 'text', text: '' }], hint: 'パターンと仮縫いのことを書く。' },
                { type: 'subheading', id: 's4m', title: '仮縫いの直し', level: 3 },
                { type: 'paragraph', id: 'q2', content: [{ type: 'text', text: '' }] },
                { type: 'figureRow', id: 'qr', figures: [{ id: 'qf', imageId: '', caption: '仮縫い' }] },
                { type: 'subheading', id: 's5', title: '袖の刺繍' },
                { type: 'paragraph', id: 'q3', content: [{ type: 'text', text: '' }] },
              ],
            }
          : c,
      ),
    })),
  )
  await settle(page, ready)
  const cut = await pdfFacts(page, '目次_書いていない章あり.png')
  const want = [
    { id: 'c1', text: 'Ⅰ．企画・立案', gray: false },
    { id: 's1', text: 'ⅰ．担当衣装のキャラクター', gray: false },
    { id: 's2', text: 'ⅱ．デザイン説明', gray: false },
    { id: 's3', text: 'ⅲ．使用素材', gray: false },
    { id: 'c2', text: 'Ⅱ．制作過程', gray: true },
    { id: 's4', text: 'ⅰ．パターンと仮縫い', gray: true },
    { id: 's4m', text: '（1）仮縫いの直し', gray: true },
    { id: 's5', text: 'ⅱ．袖の刺繍', gray: true },
    { id: 'c3', text: 'Ⅲ．まとめ', gray: false },
  ]
  check(
    '目次には、書いていない章（Ⅱ）も入れて、すべての章と中見出し・小見出しを、原稿の番号のまま順に載せる',
    JSON.stringify(cut.rows.map(({ id, text, gray }) => ({ id, text, gray }))) === JSON.stringify(want),
    JSON.stringify(cut.rows.map((r) => `${r.text}${r.gray ? '(灰)' : ''}`)),
  )
  const grayRows = cut.rows.filter((r) => r.gray)
  check(
    '書いていない章の行（中見出し・小見出しも）は灰色で、ページ番号もリーダーもない',
    grayRows.length === 4 && grayRows.every((r) => r.color === GRAY && r.pno === null && !r.leader && !/\d$/.test(r.text)),
    JSON.stringify(grayRows),
  )
  const c1 = cut.rows.find((r) => r.id === 'c1')
  const c3 = cut.rows.find((r) => r.id === 'c3')
  const h3 = cut.headings.find((h) => h.text === 'Ⅲ．まとめ')
  check(
    'PDF に入る章の行は黒のまま、ページ番号付き（Ⅲ のページ番号は、本文でⅢ．まとめが始まるページ）',
    [c1, c3].every((r) => r && r.color !== GRAY && r.leader && /^\d+$/.test(r.pno ?? '')) && c1.pno === '1' && !!h3 && c3.pno === String(h3.page),
    JSON.stringify({ c1, c3, h3 }),
  )
  check('目次の下に「灰色の章は、まだ書いていないので、この PDF には入っていません」（目次のページの中。灰色）', cut.note?.text === NOTE && cut.note.inPage && cut.note.color === GRAY, JSON.stringify(cut.note))
  check(
    '本文の大見出しは、原稿の番号のまま（Ⅰ．企画・立案 とⅢ．まとめ。Ⅱ は入らない。Ⅲ をⅡ に詰めない）',
    cut.headings.map((h) => h.text).join('｜') === 'Ⅰ．企画・立案｜Ⅲ．まとめ',
    JSON.stringify(cut.headings),
  )
  check('組み直しに使った所（画面に出さない所）は、使い終わったら消す', cut.paper && !cut.paperAfter, JSON.stringify({ paper: cut.paper, after: cut.paperAfter }))

  // ---- 画面の紙面の目次は今までどおり（灰色の行も、わけの1行もない。書いていない章もふつうに載り、ページ番号が付く） ----
  const screen = await page.evaluate(() => {
    const toc = window.__editor.pageElements().find((p) => p.querySelector('section.toc'))
    return {
      gray: toc?.querySelectorAll('.not-started').length ?? -1,
      note: !!toc?.querySelector('.toc-not-started'),
      c2: toc?.querySelector('[data-toc-target="c2"] .pno')?.textContent ?? null,
      heading2: [...document.querySelectorAll('.page-viewport.front h1.chapter:not([data-sentinel])')].some((h) => h.textContent.trim() === 'Ⅱ．制作過程'),
    }
  })
  check('画面の紙面の目次は今までどおり（灰色の行・わけの1行はない。Ⅱ にもページ番号。本文にⅡ．制作過程がある）', screen.gray === 0 && !screen.note && /^\d+$/.test(screen.c2 ?? '') && screen.heading2, JSON.stringify(screen))

  // ---- すべての章を書き始めたら：灰色の行も、わけの1行もない。本文はⅠ・Ⅱ・Ⅲ ----
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => (c.id === 'c2' ? { ...c, blocks: c.blocks.map((b) => (b.id === 'q1' ? { ...b, content: [{ type: 'text', text: '型紙を引き、シーチングで仮縫いをした。' }] } : b)) } : c)) })))
  await settle(page, ready)
  const all = await pdfFacts(page, null)
  check(
    'すべての章を書き始めたら、目次に灰色の行も、わけの1行もない（どの章にもページ番号）',
    all.rows.length === want.length && all.rows.every((r) => !r.gray) && all.note === null && all.rows.filter((r) => !r.sub).every((r) => /^\d+$/.test(r.pno ?? '')),
    JSON.stringify({ rows: all.rows.map((r) => `${r.text}${r.gray ? '(灰)' : ''}:${r.pno}`), note: all.note }),
  )
  check('すべての章を書き始めたら、本文の大見出しはⅠ・Ⅱ・Ⅲ', all.headings.map((h) => h.text).join('｜') === 'Ⅰ．企画・立案｜Ⅱ．制作過程｜Ⅲ．まとめ', JSON.stringify(all.headings))

  await context.close()
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
