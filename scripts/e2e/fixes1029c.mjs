// 学生の試し 2回目の B（見た目が変わる直し。mockups/v74。依頼者の選択 2026-10-29：① 案A、②〜⑧ おすすめ）。
// これだけを流すときは node scripts/e2e/run.mjs fixes1029c
// ① 直すところが残っているときの PDF の窓：濃い「直しに戻る」・薄い「このまま保存する」。保存したあと「直すところが1つ残ったまま保存しました」
// ② 作品写真が大きく切れている：要確認と紙面の札
// ③ スマホ：本文の幅より広げて書いているとき「幅に合わせる」
// ④ スマホ：抄録を書いている間の字数
// ⑤ スマホ：表のマスの「次のマス」
// ⑥ スマホ：作品写真の空いた枠は、並べ方の左の「＋ 写真」（下の帯は出さない）
// ⑦ 短い段落の「小見出しにする」
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { setupWriting } from './sampleReport.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(browser, { phone = false, writingZoom = '0' } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument((z) => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', z) } catch {} }, writingZoom)
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768 })
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
const goTo = async (page, ready, id) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await wait(300)
}
const openAt = async (page, id, caret = 0) => {
  await page.evaluate((id, caret) => window.__editor.openEditor(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, id)
  await wait(800)
}
/** 作品写真の1ページ目を、2枚・上下にして、下の枠に縦長の全身の写真（見本の g-photo1）を入れる */
const cropPhotos = (page) =>
  page.evaluate(() => {
    const r = window.__editor.getSnapshot().report
    const fig = r.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures.map((f) => f.imageId) : [])).filter(Boolean)
    window.__editor.update((x) => ({ ...x, workPhotos: [{ layout: 2, columns: 1, imageIds: [fig.at(-1), 'g-photo1'] }] }))
  })

await withEdge(async (browser) => {
  // ---- パソコン ----
  {
    const { context, page, ready } = await open(browser)
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny', browserContextId: context.id })

    // ⑦ 短い段落の「小見出しにする」
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [{ type: 'paragraph', id: 'px', content: [{ type: 'text', text: '2-1 パターンと仮縫い' }] }, ...c.blocks] } : c)) })))
    await wait(1000)
    await ready()
    await goTo(page, ready, 'px')
    await openAt(page, 'px', 3)
    const tool = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].some((b) => b.textContent.replace(/\s/g, '').endsWith('小見出しにする')))
    await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.replace(/\s/g, '').endsWith('小見出しにする'))?.click())
    await wait(1200)
    await ready()
    const sub = await page.evaluate(() => { const c = window.__editor.getSnapshot().report.body[1]; return { first: c.blocks[0]?.type, title: c.blocks[0]?.title, toast: document.querySelector('.undo-toast')?.textContent ?? '' } })
    await page.evaluate(() => window.__editor.undo())
    await wait(800)
    await ready()
    const undone = await page.evaluate(() => window.__editor.getSnapshot().report.body[1].blocks[0])
    const longTool = await (async () => {
      await goTo(page, ready, 'p2')
      await openAt(page, 'p2', 3)
      return page.evaluate(() => [...document.querySelectorAll('.palette .tb')].some((b) => b.textContent.replace(/\s/g, '').endsWith('小見出しにする')))
    })()
    await page.evaluate(() => document.activeElement?.blur())
    await wait(500)
    check(
      '短く「。」のない段落には「この段落」に「小見出しにする」が出て、押すと番号を除いた小見出し「パターンと仮縫い」になる（知らせ・元に戻すで段落に戻る）。文の段落には出ない',
      tool && sub.first === 'subheading' && sub.title === 'パターンと仮縫い' && sub.toast.includes('小見出し') && undone?.type === 'paragraph' && !longTool,
      JSON.stringify({ tool, sub, undone: undone?.type, longTool }),
    )

    // 抄録に、本文にない内容らしい文（mockups/v75 案A）
    const madeUp = '本制作では、ミラノで買い付けたシルクを使い、全体を手染めで仕上げた。'
    await page.evaluate((madeUp) => {
      const r = window.__editor.getSnapshot().report
      const body = r.body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph').map((b) => b.content.map((n) => n.text ?? '').join('')).filter((t) => t.length > 20)
      const picked = body.flatMap((p) => p.split(/(?<=。)/).filter((s) => s.length > 15 && !/[（(][図表]/.test(s))).slice(0, 3)
      window.__editor.update((x) => ({ ...x, abstract: { ...x.abstract, started: true, paragraphs: [{ type: 'paragraph', id: 'a1', content: [{ type: 'text', text: [...picked, madeUp].join('') }] }] } }))
    }, madeUp)
    await wait(1200)
    await ready()
    const absSource = await page.evaluate(() => ({
      found: window.__editor.getSnapshot().findings.filter((f) => f.ruleId === 'abstract-source').map((f) => ({ detail: f.detail, key: !!f.key, len: f.end - f.start })),
      side: [...document.querySelectorAll('.side .issue')].some((el) => el.textContent.includes('本文にない内容かもしれない文がある')),
    }))
    check('抄録に本文にない内容の文があると、要確認「本文にない内容かもしれない文がある」（本文にない語を添える。このままにできる）。本文から抜き出した文には出ない', absSource.found.length === 1 && absSource.found[0].detail.includes('ミラノ') && absSource.found[0].key && absSource.found[0].len === madeUp.length && absSource.side, JSON.stringify(absSource))

    // ② 作品写真が大きく切れている
    await cropPhotos(page)
    await wait(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    await wait(600)
    const crop = await page.evaluate(() => ({
      findings: window.__editor.getSnapshot().findings.filter((f) => f.ruleId === 'photo-cropped').map((f) => ({ severity: f.severity, detail: f.detail, key: !!f.key })),
      badge: [...document.querySelectorAll('.page-viewport.front .crop-warn')].map((el) => el.dataset.cropNote),
      side: document.querySelector('.side')?.textContent.includes('作品写真が大きく切れている') ?? false,
    }))
    check(
      '縦長の写真を横長の枠（2枚・上下の下）に入れると、要確認「作品写真が大きく切れている」（このままにできる）と、紙面のその枠に「上と下が大きく切れています」',
      crop.findings.length === 1 && crop.findings[0].severity === 'warning' && crop.findings[0].key && crop.findings[0].detail.startsWith('下の枠の写真は、上と下が大きく切れています') && crop.badge.length >= 1 && crop.badge[0] === '上と下が大きく切れています' && crop.side,
      JSON.stringify(crop),
    )

    // ① 直すところが残っているときの PDF の窓
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' && b.type === 'paragraph' ? { ...b, content: b.content.map((n, i, a) => (i === a.length - 1 && n.type === 'text' ? { ...n, text: n.text.replace(/。$/, '') } : n)) } : b)) })) })))
    await wait(1200)
    await ready()
    await page.evaluate(() => [...document.querySelectorAll('.side button')].find((b) => b.textContent.includes('PDFを書き出す'))?.click())
    await page.waitForSelector('.modal .pdf-start', { timeout: 20000 })
    const before = await page.evaluate(() => ({ primary: [...document.querySelectorAll('.modal .row-buttons button.primary')].map((b) => b.textContent), start: document.querySelector('.modal .pdf-start').textContent }))
    await page.evaluate(() => document.querySelector('.modal .pdf-start').click())
    await page.waitForSelector('.modal .pdf-left-warn', { timeout: 120000 }).catch(() => {})
    const saved = await page.evaluate(() => document.querySelector('.modal .pdf-left-warn')?.textContent ?? '')
    check(
      '直すところが残っているときの PDF の窓：濃いボタンは「直しに戻る」、保存は薄い「このまま保存する」。保存したあと「直すところがNつ残ったまま保存しました。提出するときは…」',
      before.primary.join() === '直しに戻る' && before.start === 'このまま保存する' && /^直すところが[0-9]+つ残ったまま保存しました。/.test(saved) && saved.includes('提出するときは'),
      JSON.stringify({ before, saved }),
    )
    await context.close()
  }

  // ---- スマホ ----
  {
    const { context, page, ready } = await open(browser, { phone: true, writingZoom: '2.2' })
    // ③ 広げて書いているときの「幅に合わせる」
    await goTo(page, ready, 'p2')
    await openAt(page, 'p2', 5)
    await wait(600)
    const zoomed = await page.evaluate(() => ({ over: window.__editor.getSnapshot().overZoomed, chip: !!document.querySelector('.fit-width') }))
    await page.evaluate(() => document.querySelector('.fit-width')?.click())
    await wait(900)
    const fitted = await page.evaluate(() => ({ over: window.__editor.getSnapshot().overZoomed, chip: !!document.querySelector('.fit-width'), editing: window.__editor.getSnapshot().editingId, saved: localStorage.getItem('sotsugyo-seisaku-report-writing-zoom') }))
    check('スマホ：本文の幅より広げて書いているときは「幅に合わせる」が出て、押すと本文の幅に戻る（書き続ける。次からもその大きさ）', zoomed.over && zoomed.chip && !fitted.over && !fitted.chip && fitted.editing === 'p2' && fitted.saved === '1', JSON.stringify({ zoomed, fitted }))
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(600)
    await ready()

    // ④ 抄録を書いている間の字数
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: true, paragraphs: [{ type: 'paragraph', id: 'a1', content: [{ type: 'text', text: 'あ'.repeat(174) }] }] } })))
    await wait(1200)
    await ready()
    await goTo(page, ready, 'a1')
    await openAt(page, 'a1', 10)
    const count = await page.evaluate(() => document.querySelector('.direct-bar .db-count')?.textContent ?? '')
    check('スマホ：抄録を書いている間は、道具の上に「抄録 174字（600〜900字。あと426字）」', count === '抄録 174字（600〜900字。あと426字）', count)
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(600)
    await ready()

    // ⑤ 表のマスの「次のマス」
    const cells = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')?.rows.flatMap((r) => r.cells.map((c) => c.id)) ?? [])
    const tableId = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')?.id)
    await goTo(page, ready, tableId)
    await openAt(page, cells[2])
    const nextBtn = await page.evaluate(() => document.querySelector('.direct-bar .db-next')?.textContent ?? '')
    await page.evaluate(() => document.querySelector('.direct-bar .db-next')?.click())
    await wait(800)
    const moved = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    await openAt(page, cells.at(-1))
    const lastBtn = !!(await page.$('.direct-bar .db-next'))
    check('スマホ：表のマスを書いている間は「次のマス」があり、押すと次のマスへ移る（最後のマスでは出ない）', nextBtn === '次のマス' && moved === cells[3] && !lastBtn, JSON.stringify({ nextBtn, moved, want: cells[3], lastBtn }))
    await page.evaluate(() => window.__editor.finishEditing())
    await wait(600)
    await ready()

    // ⑥ 作品写真の空いた枠：並べ方の左の「＋ 写真」（下の帯は出さない）
    await page.evaluate(() => window.__editor.update((x) => ({ ...x, workPhotos: [{ layout: 4, imageIds: ['g-photo1', '', '', ''] }] })))
    await wait(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    await wait(800)
    const photos = await page.evaluate(() => ({ add: document.querySelector('.photo-arrange .photo-add')?.textContent ?? '', band: !!document.querySelector('.page-band.row'), label: getComputedStyle(document.querySelector('.photo-arrange > .ctx-label')).display }))
    check('スマホ（縦）：作品写真の空いた枠があるときは、並べ方の左に「＋ 写真」（「並べ方」の名前の代わり）。紙面の下の「写真を選ぶ」の帯は出さない', photos.add === '写真' && !photos.band && photos.label === 'none', JSON.stringify(photos))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
