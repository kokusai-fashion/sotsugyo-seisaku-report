// mockups/v76：学生の試し 3回目（2026-10-29。poc-output/firsttime/r1029/まとめ3.md の B）の、見た目が変わる直しの案。
// 本物のツール（開発サーバー）を開き、CSS や部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v76-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）。SHEET_ONLY=1 で並べた絵だけ作り直す
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v76/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
// Word の試しのファイル（手元だけ。学生のものではない、作った見本）
const B16 = '../試し用_Wordのいろいろ/作ったファイル/B16_脚注・コメント・変更履歴・隠し文字.docx'

async function open(browser, { width = 1366, height = 768, phone = false, sample = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0'); localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  if (sample) {
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await sleep(600)
    await ready()
  }
  return { context, page, ready }
}
const rect = (page, sel, pad = 0) => page.evaluate((sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), width: Math.min(innerWidth - Math.max(0, r.left - pad), r.width + pad * 2), height: Math.min(innerHeight - Math.max(0, r.top - pad), r.height + pad * 2) } }, sel, pad)
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}), captureBeyondViewport: false })
const ONLY = process.env.ONLY?.split(',')
const item = async (name, fn) => {
  if (ONLY && !ONLY.includes(name)) return
  try {
    await fn()
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}
// 画面の下半分（スマホの道具のあたり）
const lower = (page, from = 0.45) => page.evaluate((from) => ({ x: 0, y: Math.round(innerHeight * from), width: innerWidth, height: Math.round(innerHeight * (1 - from)) }), from)

if (!process.env.SHEET_ONLY) await withEdge(async (browser) => {
  // ===== ① スマホ：表の道具の「表を削除」 =====
  await item('table', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    const len = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === 'p6').content.map((n) => n.text ?? '').join('').length)
    await page.evaluate((len) => window.__editor.openEditor('p6', len), len)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p6', { timeout: 20000 })
    await sleep(600)
    await page.evaluate(() => window.__editor.addTable('blank', { columns: 3, rows: 3 }))
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
    await ready()
    await page.keyboard.type('仮縫いの記録')
    const first = await page.evaluate(() => { const s = window.__editor.getSnapshot(); return s.report.body.flatMap((c) => c.blocks).find((b) => b.id === s.editingId).rows[1].cells[0].id })
    await page.evaluate(() => window.__editor.finishEditing())
    await sleep(600)
    await ready()
    await page.evaluate((id) => window.__editor.openEditor(id, 0), first)
    await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, first)
    await sleep(900)
    const bar = await rect(page, '.direct-bar', 40)
    await shot(page, '1-table-now', bar)
    // 案B：今の場所のまま、押したら確かめる
    await page.evaluate(() => {
      const d = document.createElement('div')
      d.className = 'modal-backdrop confirm-backdrop mock'
      d.innerHTML = `<div class="modal confirm-modal" role="alertdialog"><header><h2>この表を削除しますか？</h2><button class="close">×</button></header>
        <div class="confirm-body"><p>表の中の字と画像も、いっしょに消えます。</p></div>
        <div class="row-buttons confirm-buttons"><button>やめる</button><button class="danger-fill">削除する</button></div></div>`
      document.body.append(d)
    })
    await sleep(300)
    await shot(page, '1-table-b')
    await page.evaluate(() => document.querySelector('.mock')?.remove())
    // 案A：表の道具の段から外し、「表の形」の欄のいちばん下へ
    await page.evaluate(() => {
      const del = [...document.querySelectorAll('.direct-bar .db-table button.danger')].pop()
      del?.remove()
    })
    await sleep(300)
    await shot(page, '1-table-a-bar', await rect(page, '.direct-bar', 40))
    await page.evaluate(() => document.querySelector('.direct-bar .db-table .shape-btn')?.click())
    await page.waitForSelector('.sheet.table-shape .sheet-body', { timeout: 10000 })
    await sleep(500)
    await page.evaluate(() => {
      const body = document.querySelector('.sheet.table-shape .sheet-body')
      const wrap = document.createElement('div')
      wrap.style.cssText = 'margin: 14px 0 4px; padding-top: 12px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 10px;'
      wrap.innerHTML = `<button class="danger" style="display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border:1px solid var(--error);border-radius:10px;background:#fff;color:var(--error);font-size:15px;">この表を削除</button>
        <span style="font-size:12.5px;color:var(--muted);line-height:1.5;">消したあとも、上の「戻す」で戻せます</span>`
      body.append(wrap)
      body.scrollTop = body.scrollHeight
    })
    await sleep(400)
    await shot(page, '1-table-a-sheet')
    await context.close()
  })

  // ===== ② 図の多い Word を読み込んだあとの「つぎにすること」（パソコン 1280×720） =====
  await item('todo', async () => {
    const { context, page, ready } = await open(browser, { width: 1280, height: 720, sample: false })
    await page.evaluate(() => document.querySelector('.g-word-opt:not(.no)').click())
    await page.waitForSelector('.word-file .acts button:not(.link)', { timeout: 20000 })
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[0].click())])
    await chooser.accept([B16])
    await page.waitForFunction(() => document.querySelector('.word-file.picked'), { timeout: 20000 })
    await sleep(500)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる'))?.click())
    await page.waitForFunction(() => [...document.querySelectorAll('.modal .row-buttons button')].some((b) => b.textContent.includes('読み込む') && !b.disabled), { timeout: 120000 })
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('読み込む')).click())
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 120000 })
    await ready()
    await sleep(800)
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
    await page.waitForSelector('.side .word-todo', { timeout: 20000 })
    await sleep(800)
    await page.mouse.move(5, 5)
    await shot(page, '2-todo-now', await rect(page, '.side'))
    console.log('今：', await page.evaluate(() => { const s = document.querySelector('.side'); const f = document.querySelector('.side .side-foot').getBoundingClientRect(); const c = document.querySelector('.side .sec.check').getBoundingClientRect(); return { side: s.getBoundingClientRect().height, todo: document.querySelector('.side .word-todo').getBoundingClientRect().height, check: Math.round(c.height), footTop: Math.round(f.top), footBottom: Math.round(f.bottom), inner: innerHeight } }))
    // 案A：済んだ項目は1行、まだの項目の説明は、次にする1つだけ
    await page.evaluate(() => {
      const card = document.querySelector('.side .word-todo')
      card.dataset.before = card.innerHTML
      const items = [...card.querySelectorAll(':scope > ul > li')]
      const next = items.find((li) => !li.classList.contains('done'))
      for (const li of items) if (li !== next) li.querySelector('small')?.remove()
      for (const li of items) li.style.gap = '6px'
      card.querySelector(':scope > ul').style.gap = '5px'
      const p = card.querySelector(':scope > p')
      const left = items.filter((li) => !li.classList.contains('done')).length
      p.innerHTML = `のこり <b style="color:var(--accent)">${left}つ</b>。済んだら、移しかえは終わりです`
      p.style.margin = '1px 0 6px'
    })
    await sleep(400)
    await shot(page, '2-todo-a', await rect(page, '.side'))
    console.log('案A：', await page.evaluate(() => { const c = document.querySelector('.side .sec.check').getBoundingClientRect(); const f = document.querySelector('.side .side-foot').getBoundingClientRect(); return { todo: document.querySelector('.side .word-todo').getBoundingClientRect().height, check: Math.round(c.height), footBottom: Math.round(f.bottom) } }))
    // 案B：一覧は今のまま、セルフチェックといっしょに動く（「PDFを書き出す」はいつも見える）
    await page.evaluate(() => {
      const card = document.querySelector('.side .word-todo')
      card.innerHTML = card.dataset.before
      const check = document.querySelector('.side .sec.check')
      check.prepend(card)
      card.style.margin = '0 0 16px'
      check.scrollTop = 0
    })
    await sleep(400)
    await shot(page, '2-todo-b', await rect(page, '.side'))
    await page.evaluate(() => { const c = document.querySelector('.side .sec.check'); c.scrollTop = c.scrollHeight })
    await sleep(300)
    await shot(page, '2-todo-b-scrolled', await rect(page, '.side'))
    await context.close()
  })

  // ===== ③ iPhone の「チェック」の数（黄色の要確認だけのとき） =====
  await item('badge', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    // 抄録に、本文にない文（要確認：本文にない内容かもしれない文がある）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, paragraphs: r.abstract.paragraphs.map((p, i) => (i === 0 ? { ...p, content: [...p.content, { type: 'text', text: '会場では演出家と相談し、ターバンを40時間かけて仕上げた。' }] } : p)) } })))
    await sleep(1200)
    await ready()
    const nav = await rect(page, '.p-nav', 6)
    const area = { x: 0, y: Math.max(0, nav.y - 60), width: nav.width, height: nav.height + 60 }
    // 赤いエラーが0で、要確認だけが残っている形（今は数が出ない）
    await page.evaluate(() => document.querySelector('.p-nav .nav-check .badge')?.remove())
    await sleep(200)
    await shot(page, '3-badge-now', area)
    // 案A：赤いエラーがないときは、黄色の点（数は出さない）
    await page.evaluate(() => {
      const b = document.createElement('i')
      b.className = 'badge mock'
      b.style.cssText = 'min-width:11px;width:11px;height:11px;padding:0;top:8px;background:#e0a100;'
      document.querySelector('.p-nav .nav-check').append(b)
    })
    await sleep(200)
    await shot(page, '3-badge-a', area)
    // 案B：黄色の数（要確認の数）
    await page.evaluate(() => {
      const b = document.querySelector('.p-nav .badge.mock')
      b.style.cssText = 'background:#e0a100;color:#3a2a00;'
      b.textContent = '1'
    })
    await sleep(200)
    await shot(page, '3-badge-b', area)
    // 赤いエラーもあるとき（案A・B 共通：赤い数を出す。案B は黄色の数も並べる）
    await page.evaluate(() => {
      const b = document.querySelector('.p-nav .badge.mock')
      b.style.cssText = ''
      b.textContent = '2'
    })
    await sleep(200)
    await shot(page, '3-badge-red', area)
    await page.evaluate(() => {
      const b = document.createElement('i')
      b.className = 'badge mock2'
      b.style.cssText = 'left:calc(50% + 24px);background:#e0a100;color:#3a2a00;'
      b.textContent = '1'
      document.querySelector('.p-nav .nav-check').append(b)
    })
    await sleep(200)
    await shot(page, '3-badge-b-red', area)
    await page.evaluate(() => document.querySelectorAll('.p-nav .mock, .p-nav .mock2').forEach((b) => b.remove()))
    // チェックの欄（要確認が1つ）
    await page.evaluate(() => document.querySelector('.p-nav .nav-check').click())
    await sleep(900)
    await shot(page, '3-badge-sheet', await lower(page, 0.3))
    await context.close()
  })
})

// ---- 並べた絵 ----
await sleep(1500)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const has = (p) => { try { readFileSync(join(OUT, `${p}.png`)); return true } catch { return false } }
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const sheet = async (file, title, sub, cols, width = 1700) => {
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: ${width - 44}px; }
      h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; line-height: 1.6; }
      .row { display: grid; grid-template-columns: repeat(${cols.length}, 1fr); gap: 16px; align-items: start; }
      .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; min-height: 44px; }
      .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 6px; }
    </style><h1>${title}</h1><p class="sub">${sub}</p><div class="row">${cols.map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p>${c.imgs.filter(has).map((s) => `<img src="${img(s)}">`).join('')}</div>`).join('')}</div>`
    await page.setViewport({ width, height: 800 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: `mockups/v76/${file}.png`, fullPage: true })
  }
  await sheet('1-table', '① スマホ：表の道具の「表を削除」', '「表を削除」が「完了」のすぐ下（6px）にあり、押すと確かめずに表が消える（下に「戻す」は出る）（スマホの役）。', [
    { h: '今', t: '表の道具の段のいちばん右。「完了」のすぐ下', imgs: ['1-table-now'] },
    { h: '案A（おすすめ）', t: '段から外し、「表の形」の欄のいちばん下へ（表ごと消すことはまれなので、1つ奥に）。段の道具は1つ減って押しやすくなる', imgs: ['1-table-a-bar', '1-table-a-sheet'] },
    { h: '案B', t: '今の場所のまま。押したら「この表を削除しますか？」と確かめる', imgs: ['1-table-now', '1-table-b'] },
  ], 1300)
  await sheet('2-todo', '② Word を読み込んだあとの「つぎにすること」（パソコン 1280×720）', '一覧が右の欄の半分を占め、セルフチェックが1〜2行しか見えない（Word の役の画面では、「PDFを書き出す」も隠れていた）。', [
    { h: '今', t: '説明がすべての項目に付き、一覧が高い', imgs: ['2-todo-now'] },
    { h: '案A（おすすめ）', t: '項目の説明は、次にする1つだけに出す（済んだ・まだ先の項目は名前だけの1行）。上の一言も短く', imgs: ['2-todo-a'] },
    { h: '案B', t: '一覧は今のまま、セルフチェックといっしょに上下に動く（「PDFを書き出す」はいつも見える）', imgs: ['2-todo-b', '2-todo-b-scrolled'] },
  ], 1300)
  await sheet('3-badge', '③ iPhone：下の「チェック」の数', '数は赤いエラーだけ。黄色の要確認（抄録の照らし合わせなど）だけのときは、何も出ず気づかない（抄録の役）。赤い数だけにしたのは 10/24 のご判断（mockups/v35 ①：まだのところは数えない）。', [
    { h: '今', t: '赤いエラーが0なら、要確認があっても何も出ない', imgs: ['3-badge-now', '3-badge-sheet'] },
    { h: '案A（おすすめ）', t: '赤いエラーがないときだけ、黄色の小さな点（数は出さない）。赤いエラーがあれば今と同じ赤い数', imgs: ['3-badge-a', '3-badge-red'] },
    { h: '案B', t: '黄色の数（要確認の数）も出す。赤いエラーもあれば、2つ並ぶ', imgs: ['3-badge-b', '3-badge-b-red'] },
  ], 1300)
})
console.log('できました：mockups/v76/')
