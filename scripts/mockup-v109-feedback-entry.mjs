// mockups/v109（2026-11-04）：「困ったこと・おかしいことを知らせる」の入口を見つけやすくする案（依頼者：入口が分かりにくい）
//   今：右の欄のいちばん下の小さなリンク（と、メニューの中）
//   案A：右の欄の下のリンクを、枠のあるボタンにする
//   （右上のメニューの横にボタンを足す案も考えたが、題名とメニューの間に置く場所がなく、ボタンも増えるので外した）
//   案C：「使い方」の欄の「使い方を AI に聞く」のすぐ下に、知らせる入口を足す（パソコン・スマホ）
//   本物のツール（見本の原稿なし）で撮り、入口の所だけを差し替える。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v109-feedback-entry.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v109'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS = () => {
  try {
    for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
  } catch {}
}
// 吹き出しの絵（ツールの「知らせる」の絵と同じ形）
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5a2 2 0 0 1-2 2H8.5L4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2zM12 7.5v4M12 13.8v.1"/></svg>'
const CSS = `
.mk-fb-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin:10px 0 0;padding:8px 10px;border:1.5px solid var(--accent);border-radius:10px;background:#fff;color:var(--accent);font-size:13px;font-weight:700;line-height:1.4}
.mk-fb-btn svg{width:17px;height:17px;flex:none}
.mk-trouble{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;margin-right:6px;border:1.5px solid #c9822b;border-radius:15px;background:#fff8ec;color:#8a4d00;font-size:12.5px;font-weight:700;white-space:nowrap}
.mk-trouble svg{width:15px;height:15px}
.mk-pop{position:absolute;right:16px;top:52px;z-index:50;width:286px;padding:6px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.16)}
.mk-pop div{display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:8px;font-size:13.5px;color:var(--ink)}
.mk-pop div+div{border-top:1px solid #efece6}
.mk-pop div.on{background:#fff8ec;color:#8a4d00;font-weight:700}
.mk-pop svg{width:17px;height:17px;flex:none}
.mk-help-fb{background:#fff8ec!important;border-color:#efc98d!important}
.mk-help-fb .help-ai-icon{color:#b0651a!important}
`

async function open(browser, phone = false) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS)
  if (phone) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1366, height: 768, deviceScaleFactor: 1.5 })
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
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ', subtitleInput: 'シンドバッド' } })))
  await sleep(900)
  await ready()
  await page.addStyleTag({ content: CSS })
  await page.evaluate(() => document.activeElement?.blur())
  return { context, page, ready }
}

/** 差し込む関数 src を、ツールが書き直して消えても差し込み直すようにする（印 .mk-help-fb がなくなったら） */
const keep = (src, bubble, marker) => {
  const run = new Function(`return (${src})`)()
  run(bubble)
  setInterval(() => {
    if (!document.querySelector(marker)) run(bubble)
  }, 30)
}
/** 案A：右の欄の下のリンクを、枠のあるボタンにする（字は、メニューや窓の題と同じ「困ったこと・おかしいことを知らせる」。前の字は長く、1字だけ折り返した） */
const injectA = (bubble) => {
  const a = document.querySelector('.side-foot .feedback-link')
  if (!a) return
  a.className = 'mk-fb-btn'
  a.innerHTML = `${bubble}困ったこと・おかしいことを知らせる`
}
/** 右の欄（全部の高さ）を撮る */
async function shotSide(page, file) {
  await page.mouse.move(5, 5)
  await sleep(400)
  const r = await page.evaluate(() => {
    const b = document.querySelector('.side').getBoundingClientRect()
    return { x: b.left, y: 0, width: b.width, height: innerHeight }
  })
  await page.screenshot({ path: `${OUT}/${file}`, clip: r })
  console.log(`${OUT}/${file}`)
}

await withEdge(async (browser) => {
  {
    const { context, page } = await open(browser)
    // 今
    await shotSide(page, '0_今（PC・右の欄）.png')
    // 案A：下のリンクを、枠のあるボタンに（ツールが書き直しても消えないよう、見た目だけを CSS で変える）
    await page.evaluate(keep, injectA.toString(), BUBBLE, '.mk-fb-btn')
    await shotSide(page, '1_案A（PC・右の欄の下をボタンに）.png')
    await context.close()
  }
  {
    const { context, page } = await open(browser)
    // 案C：使い方の欄の「AI に聞く」の下に
    await page.click('.side .menu-btn')
    await page.waitForSelector('.side .head-menu [role="menuitem"]')
    await page.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].find((b) => b.textContent.trim() === '使い方').click())
    await page.waitForSelector('.help .help-note')
    await sleep(700)
    const inject = (bubble) => {
      // 試験用の設定には AI の URL がないので、本番と同じ「使い方を AI に聞く」の行を先に置く
      const note = [...document.querySelectorAll('.help-note')].find((e) => e.getBoundingClientRect().width > 0)
      if (!note) return
      const top = note.parentElement
      let ai = top.querySelector('.help-ai')
      if (!ai) {
        ai = document.createElement('a')
        ai.className = 'help-ai'
        ai.innerHTML = '<span class="help-ai-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z"/></svg></span><span class="help-ai-text"><b>使い方を AI に聞く</b><small>見つからないときは、ふだんの言葉で聞けます（新しいタブで開きます）</small></span>'
        note.after(ai)
      }
      const a = document.createElement('a')
      a.className = 'help-ai mk-help-fb'
      a.innerHTML = `<span class="help-ai-icon">${bubble}</span><span class="help-ai-text"><b>困ったこと・おかしいことを知らせる</b><small>見つからないとき・ツールがおかしいときは、学科に知らせます</small></span>`
      ai.after(a)
    }
    await page.evaluate(keep, inject.toString(), BUBBLE, '.mk-help-fb')
    await page.mouse.move(5, 5)
    await page.evaluate(() => document.activeElement?.blur())
    await sleep(400)
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.help')].map((e) => e.getBoundingClientRect()).find((r) => r.width > 0)
      return { x: b.left, y: 0, width: b.width, height: innerHeight }
    })
    await page.screenshot({ path: `${OUT}/3_案C（PC・使い方の欄）.png`, clip: r })
    console.log(`${OUT}/3_案C（PC・使い方の欄）.png`)
    await context.close()

    // スマホ：下の「使い方」から開いた欄
    const ph = await open(browser, true)
    await ph.page.waitForSelector('.nav-help')
    await ph.page.evaluate(() => document.querySelector('.nav-help').click())
    await ph.page.waitForSelector('.help .help-note')
    await sleep(900)
    await ph.page.evaluate(keep, inject.toString(), BUBBLE, '.mk-help-fb')
    await ph.page.evaluate(() => document.activeElement?.blur())
    await sleep(400)
    await ph.page.screenshot({ path: `${OUT}/4_案C（スマホ・使い方の欄）.png` })
    console.log(`${OUT}/4_案C（スマホ・使い方の欄）.png`)
    await ph.context.close()
  }
})
