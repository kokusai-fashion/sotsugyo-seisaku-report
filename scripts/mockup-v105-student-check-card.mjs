// mockups/v105（2026-11-04）：学生のツールに「点検の予定と記録」を出す見本（依頼者：今は確認表を Classroom で学生に見せている。次の回の担当も見せたい。回の数や抄録の時期はコースで違う）
//   学生は、点検表の自分の行だけをツールの中で見る（ほかの学生の学籍番号・PDF は見えない）。点検表の白い列（回）を、見出しと中身のまま並べる
//   パソコン：右の欄の上（コースからのお知らせの下）。スマホ：メニュー（≡）の中
//   使い方：APP_URL=http://localhost:4180 node scripts/mockup-v105-student-check-card.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v105'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

const CSS = `
.mk-card{margin:0 16px 10px;padding:8px 10px 9px;border:1px solid #d9dee8;border-radius:8px;background:#fff;font-size:11.5px;line-height:1.5;color:#1c2333}
.mk-card h4{margin:0 0 4px;font-size:11px;color:var(--accent,#2b3a67);letter-spacing:.06em;display:flex;align-items:center;gap:6px}
.mk-card h4 small{font-weight:400;color:#7a8190;letter-spacing:0}
.mk-card table{width:100%;border-collapse:collapse}
.mk-card td{padding:2px 0;vertical-align:baseline}
.mk-card td.r{width:3.6em;color:#555}
.mk-card td.t{width:5.2em}
.mk-card .done{color:#1e7b34;font-weight:600}
.mk-card .plan{color:#7a8190}
.mk-card .next{color:#7a5200;font-weight:700}
.mk-card .perm{margin-top:5px;padding-top:5px;border-top:1px dashed #d9dee8}
.mk-card .ok{color:#1e7b34;font-weight:700}
.mk-card .wait{color:#7a8190}
.sheet-body .mk-card{margin:12px 0 0;font-size:14px}
.sheet-body .mk-card h4{font-size:13px}
`

const card = `<div class="mk-card" data-mock="1"><h4>点検の予定と記録 <small>先生の点検表から</small></h4>
<table>
<tr><td class="r">1回目</td><td class="t">山本先生</td><td class="done">✓ 済み</td></tr>
<tr><td class="r">2回目</td><td class="t">中村先生</td><td class="done">✓ 済み</td></tr>
<tr><td class="r">3回目</td><td class="t">小川先生</td><td class="done">✓ 済み</td></tr>
<tr><td class="r">抄録</td><td class="t">小川先生</td><td class="next">次はここ</td></tr>
<tr><td class="r">4回目</td><td class="t">山本先生</td><td class="plan">予定</td></tr>
</table>
<div class="perm"><div>抄録を書く許可：<span class="ok">出ています</span>（12/15 小川先生）</div><div>最終提出の許可：<span class="wait">まだです</span></div></div></div>`

async function open(browser, phone) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.5 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await sleep(1200)
  await ready()
  await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  await sleep(500)
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', subtitleInput: 'シンドバッド' } })))
  await sleep(900)
  await ready()
  await page.addStyleTag({ content: CSS })
  return { context, page }
}

await withEdge(async (browser) => {
  // パソコン：右の欄の、セルフチェックの上
  let { context, page } = await open(browser, false)
  const placed = await page.evaluate((html) => {
    const check = document.querySelector('.side .sec.check') ?? document.querySelector('.sec.check')
    if (!check) return false
    check.insertAdjacentHTML('beforebegin', html)
    return true
  }, card)
  console.log('pc placed', placed)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/パソコン_右の欄に点検の予定と記録.png` })
  await context.close()

  // スマホ：メニュー（≡）の中
  ;({ context, page } = await open(browser, true))
  await page.evaluate(() => document.querySelector('button[aria-label^="メニュー"]')?.click())
  await sleep(800)
  const placedPhone = await page.evaluate((html) => {
    const body = document.querySelector('.sheet-body')
    if (!body) return false
    const links = body.querySelector('.links')
    if (links) links.insertAdjacentHTML('beforebegin', html)
    else body.insertAdjacentHTML('afterbegin', html)
    return true
  }, card)
  console.log('phone placed', placedPhone)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/スマホ_メニューに点検の予定と記録.png` })
  await context.close()
  console.log('ok')
})
