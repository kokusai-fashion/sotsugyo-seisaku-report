// mockups/v101（2026-11-04）：氏名を「姓・名・セイ・メイ」の4つで入れる（依頼者：点検表をふりがなのあいうえお順に並べる。表紙の氏名は「姓　名」と自動で入る）
//   ① はじめての案内の「氏名」の段（今／新しい形）パソコン・スマホ
//   ② Word を読み込んだあと（姓・名は Word から。ふりがなだけ入れる）
//   ③ 表紙の氏名を押したとき（4つの欄で直す）パソコン・スマホ
//   ④ 前から書いている学生（ふりがながまだ）：表紙の氏名の知らせ
// 本物のツール（見本の原稿なし）で撮り、案内・欄だけを差し替える。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v101-name-kana.mjs（Edge は 9335）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9335'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v101'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}

async function open(browser, phone) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 })
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
  // 学籍番号はログインで入る（試しの開き方では、ここで入れて「氏名」の段へ）
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123' } })))
  await sleep(400)
  // スマホ：学籍番号の欄をタップしてから「完了」（パソコン：Enter）
  if (phone) {
    const p = await page.evaluate(() => { const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="basic:studentId"]')].find((e) => e.getBoundingClientRect().width > 0); const r = el?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null })
    if (p) { await page.touchscreen.tap(p.x, p.y); await sleep(900); await page.evaluate(() => document.querySelector('.direct-bar .db-done')?.click()) }
  } else await page.keyboard.press('Enter')
  await sleep(300)
  await page.waitForSelector('.guide.step-name', { timeout: 15000 }).catch(() => {})
  await sleep(900)
  return { context, page, ready }
}

/** 案内の吹き出しを、同じ位置の動かない写しに替えて、中身を書き換える */
const freezeTip = (html) => {
  const tip = document.querySelector('.g-tip')
  const r = tip.getBoundingClientRect()
  const copy = tip.cloneNode(true)
  copy.dataset.mock = '1'
  Object.assign(copy.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: '0', zIndex: '9999' })
  tip.style.visibility = 'hidden'
  tip.parentElement.append(copy)
  const steps = copy.querySelector('.g-steps')?.outerHTML ?? ''
  const later = copy.querySelector('.g-later')?.outerHTML ?? ''
  copy.innerHTML = steps + html + later
  return copy
}

const FORM_CSS = `
.mk-form{display:grid;grid-template-columns:auto 1fr 1fr;gap:6px 8px;align-items:center;margin:8px 0 6px;font-size:13px}
.mk-form b{font-weight:600;color:#555;font-size:12px;white-space:nowrap}
.mk-form label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:#666}
.mk-form input{font:inherit;font-size:15px;padding:6px 8px;border:1px solid #c7cdd8;border-radius:6px;width:100%;box-sizing:border-box;background:#fff;color:#1c2333}
.mk-form input.need{border-color:#d33;background:#fff6f5}
.mk-note{font-size:12px;color:#555;margin:4px 0 8px;line-height:1.6}
.mk-err{font-size:12px;color:#c0392b;margin:0 0 6px}
.mk-next{display:inline-block;padding:7px 16px;border-radius:999px;background:#2b3a67;color:#fff;font-weight:600;font-size:13px}
.mk-next.off{background:#c9cfdb}
.mk-pop{position:fixed;z-index:9999;background:#fff;border:1px solid #c9cfdb;border-radius:10px;box-shadow:0 8px 24px rgba(20,30,60,.2);padding:12px 14px;width:330px;font-family:inherit;color:#1c2333}
.mk-pop h3{margin:0 0 4px;font-size:14px}
.mk-badge{position:fixed;z-index:9999;background:#fdecea;color:#7f1d1d;border:1px solid #f1c0bb;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap}
.mk-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#fff;border-radius:14px 14px 0 0;box-shadow:0 -6px 20px rgba(20,30,60,.18);padding:14px 16px 22px;color:#1c2333}
.mk-sheet h3{margin:0 0 4px;font-size:15px}
`

const form = ({ sei = '文化', mei = '花子', kanaSei = 'ブンカ', kanaMei = 'ハナコ', needKana = false } = {}) => `
<div class="mk-form">
  <b>氏名</b>
  <label>姓<input value="${sei}"></label>
  <label>名<input value="${mei}"></label>
  <b>ふりがな</b>
  <label>セイ（カタカナ）<input class="${needKana && !kanaSei ? 'need' : ''}" value="${kanaSei}" placeholder="ブンカ"></label>
  <label>メイ（カタカナ）<input class="${needKana && !kanaMei ? 'need' : ''}" value="${kanaMei}" placeholder="ハナコ"></label>
</div>`

await withEdge(async (browser) => {
  for (const phone of [false, true]) {
    const tag = phone ? 'スマホ' : 'パソコン'
    // ---- ① 今 ----
    let { context, page, ready } = await open(browser, phone)
    await page.addStyleTag({ content: FORM_CSS })
    await page.screenshot({ path: `${OUT}/①今_案内の氏名_${tag}.png` })
    // ---- ① 新しい形：姓・名・セイ・メイ ----
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, name: '文化　花子' } })))
    await sleep(900)
    await page.evaluate(
      (freezeSrc, html) => new Function(`return (${freezeSrc})`)()(html),
      freezeTip.toString(),
      `<h2>氏名とふりがなを入力してください</h2>${form()}<p class="mk-note">表紙には「文化　花子」と入ります（姓と名の間は自動で空きます）。ふりがなは表紙には出ず、先生の点検表を名前の順に並べるのに使います。</p><span class="mk-next">次へ</span>`,
    )
    await sleep(300)
    await page.screenshot({ path: `${OUT}/①新_案内の氏名とふりがな_${tag}.png` })
    await context.close()

    // ---- ② Word を読み込んだあと（ふりがなだけ） ----
    ;({ context, page, ready } = await open(browser, phone))
    await page.addStyleTag({ content: FORM_CSS })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, name: '文化　花子' } })))
    await sleep(900)
    await page.evaluate(
      (freezeSrc, html) => new Function(`return (${freezeSrc})`)()(html),
      freezeTip.toString(),
      `<h2>氏名のふりがなを入力してください</h2>${form({ kanaSei: '', kanaMei: '', needKana: true })}<p class="mk-err">ふりがなを入れると、次へ進めます</p><p class="mk-note">姓と名は、Word の表紙から読み込みました。</p><span class="mk-next off">次へ</span>`,
    )
    await sleep(300)
    await page.screenshot({ path: `${OUT}/②Wordのあと_ふりがなだけ_${tag}.png` })
    await context.close()

    // ---- ③ 表紙の氏名を押したとき・④ ふりがながまだの学生 ----
    ;({ context, page, ready } = await open(browser, phone))
    await page.addStyleTag({ content: FORM_CSS })
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
    await sleep(600)
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, name: '文化　花子', subtitleInput: 'シンドバッド' } })))
    await sleep(900)
    await ready()
    const box = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.page-viewport.front [data-block-id="basic:name"]')].find((e) => e.getBoundingClientRect().width > 0)
      const r = el?.getBoundingClientRect()
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
    })
    console.log(tag, 'name box', JSON.stringify(box))
    if (box) {
      // ④ ふりがながまだ
      await page.evaluate((b) => {
        const s = document.createElement('div')
        s.className = 'mk-badge'
        s.dataset.mock = '1'
        s.textContent = '！ ふりがなを入れてください'
        s.style.left = `${Math.max(8, b.left)}px`
        s.style.top = `${b.bottom + 6}px`
        document.body.append(s)
      }, box)
      await page.screenshot({ path: `${OUT}/④前から書いている学生_ふりがながまだ_${tag}.png` })
      await page.evaluate(() => document.querySelectorAll('[data-mock]').forEach((e) => e.remove()))
      // ③ 表紙の氏名を押したとき
      await page.evaluate(
        (b, phone, html) => {
          const p = document.createElement('div')
          p.dataset.mock = '1'
          if (phone) {
            p.className = 'mk-sheet'
            p.innerHTML = html + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px"><span class="mk-next">完了</span></div>'
          } else {
            p.className = 'mk-pop'
            p.style.left = `${Math.max(8, b.left - 40)}px`
            p.style.top = `${b.bottom + 8}px`
            p.innerHTML = html + '<div style="display:flex;justify-content:flex-end;gap:10px"><span class="mk-next">閉じる</span></div>'
          }
          document.body.append(p)
          // 下に入らなければ、氏名の上に出す
          if (!phone && p.getBoundingClientRect().bottom > innerHeight - 8) p.style.top = `${b.top - p.getBoundingClientRect().height - 8}px`
        },
        box,
        phone,
        `<h3>氏名とふりがな</h3>${form()}<p class="mk-note">表紙には「姓　名」の形で入ります。ふりがなは表紙には出ません。</p>`,
      )
      await sleep(200)
      await page.screenshot({ path: `${OUT}/③表紙の氏名を押したとき_${tag}.png` })
    }
    await context.close()
  }
  console.log('ok')
})
