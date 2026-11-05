// mockups/v113（2026-11-05）：ひな形の図の枠に、「図はほかの所にも入れられる」と1行足す案
//   依頼者の心配：ひな形に図の枠があると、学生が「図はこの枠にしか入れられない」と思うのではないか。
//   案A：枠の中に、いつも出す（「（クリックして写真を選ぶ）」の下に小さな字で2行）
//   案B：枠はそのまま。左の道具の説明（図・表は、入れたい所をクリックしてから押します）に「どこにでも入れられます」を足す
//   案C：枠にマウスを重ねたときだけ、案Aの2行を出す（ふだんは今と同じ）
//   スマホ（どの案でも）：帯の2行目に出す（スマホの枠は「＋」の印だけで、字が入らないため）
//   本物のツール（まとめた版）に、字を差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v113-figure-frame.mjs（Edge は 9339）
import { mkdirSync, readFileSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { closeGuide } from './e2e/nameStep.mjs'

process.env.EDGE_PORT ??= '9339'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v113'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const live = JSON.parse(readFileSync('poc-output/live-config-1104b.json', 'utf8'))
const config = live.config ?? live
config.notice = ''
for (const c of config.courses) {
  c.advisors = ['山本　恵子', '中村　健一', '小川　真理']
  delete c.notice
}

/** 枠の中の2行（案A・案C） */
const FRAME_CSS = (sel) => `
.page-viewport .figure-slot${sel} { align-content: center !important; row-gap: 2.2mm; }
.page-viewport .figure-slot${sel}::after { content: '図は、ほかの所にも\\A左の「図を入れる」で入れられます'; white-space: pre; text-align: center; color: #5f6b95; font-family: 'BIZ UDPGothic', sans-serif; font-size: 8pt; line-height: 1.6; }`

/** 外の画面に、案の説明の札を置く */
const note = (page, { title, lines, x = 1086, y = 430, w = 340 }) =>
  page.evaluate(
    ({ title, lines, x, y, w }) => {
      document.querySelector('#mk-note')?.remove()
      const d = document.createElement('div')
      d.id = 'mk-note'
      d.style.cssText = `box-sizing:border-box;position:fixed;left:${x}px;top:${y}px;width:${w}px;z-index:2147483647;background:#fffaf0;border:2px solid #b07d1a;border-radius:12px;padding:14px 16px;font:14px/1.7 'BIZ UDPGothic',sans-serif;color:#2b2b2b;box-shadow:0 6px 18px rgba(0,0,0,.18)`
      d.innerHTML = `<b style="display:block;font-size:16px;color:#8a5d00;margin-bottom:6px">${title}</b>${lines.map((l) => `<div>${l}</div>`).join('')}`
      document.documentElement.append(d)
    },
    { title, lines, x, y, w },
  )

/** 学生のツールを開き、映画・舞台衣装デザイナーのひな形で、図の枠のあるページへ */
async function openStudent(browser, phone) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  }
  await stubConfig(page, { courses: config.courses, fiscalYear: config.fiscalYear })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画')).click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  if (phone) {
    await sleep(500)
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
  } else {
    await closeGuide(page)
  }
  await ready()
  await page.evaluate(() => {
    const i = window.__editor.pageElements().findIndex((p) => p.querySelector('.figure-slot'))
    return window.__editor.goToPage(i, 'none')
  })
  await sleep(900)
  await ready()
  await page.mouse.move(5, 5)
  await sleep(300)
  return { context, page }
}

await withEdge(async (browser) => {
  // ---- PC ----
  {
    const { context, page } = await openStudent(browser, false)
    await note(page, { title: '今', lines: ['ひな形の図の枠には「（クリックして写真を選ぶ）」だけ。'] })
    await page.screenshot({ path: `${OUT}/今.png` })

    // 案A：枠の中に、いつも出す
    await page.addStyleTag({ content: FRAME_CSS('') })
    await note(page, {
      title: '案A　枠の中に、いつも出す',
      lines: ['「（クリックして写真を選ぶ）」の下に、小さな字で2行。', '写真を入れると消えます。PDF・印刷には出ません。'],
    })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案A_枠の中に出す.png` })
    await context.close()
  }
  {
    // 案B：左の道具の説明に足す
    const { context, page } = await openStudent(browser, false)
    await page.evaluate(() => {
      const n = document.querySelector('.palette .ctx-note')
      if (n) n.innerHTML = '<b style="color:#2f3e75">図・表は、<br>どこにでも<br>入れられます</b><br>入れたい所を<br>クリックして<br>から押します'
    })
    await note(page, {
      title: '案B　左の道具の説明に足す',
      lines: ['枠はそのまま。', '左の「図を入れる」「表を入れる」の下の説明に、「どこにでも入れられます」を足します。'],
    })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案B_左の道具の説明に足す.png` })
    await context.close()
  }
  {
    // 案C：マウスを重ねたときだけ
    const { context, page } = await openStudent(browser, false)
    await page.addStyleTag({ content: FRAME_CSS('.mk-hover') })
    await page.evaluate(() => {
      const s = document.querySelector('.page-viewport.front .figure-slot') ?? document.querySelector('.figure-slot')
      s?.classList.add('mk-hover')
      if (s) s.style.outline = '2px solid #2f3e75'
    })
    await note(page, {
      title: '案C　マウスを重ねたときだけ出す',
      lines: ['ふだんは今と同じ。', '枠にマウスを重ねると、案Aと同じ2行が出ます（写真で見せているのは、重ねたとき）。'],
    })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案C_重ねたときだけ.png` })
    await context.close()
  }

  {
    // 枠の大きさ：写真を入れるまでは大きくしない（ふつうの枠の大きさ 6×4.5cm のまま）
    const { context, page } = await openStudent(browser, false)
    await page.evaluate(() => {
      for (const s of document.querySelectorAll('.figure-slot')) {
        s.style.width = '60mm'
        s.style.height = '45mm'
      }
    })
    await note(page, {
      title: '写真を入れるまでは大きくしない',
      lines: ['空の枠は、ふつうの大きさ（6×4.5cm）のまま。', '写真を入れたあとは、今と同じく、改ページの前ならページの空きに合わせて大きくなります。'],
    })
    await sleep(300)
    await page.screenshot({ path: `${OUT}/枠の大きさ_写真を入れるまでは大きくしない.png` })
    await context.close()
  }

  // ---- スマホ（どの案でも）：帯の2行目 ----
  {
    const { context, page } = await openStudent(browser, true)
    const has = await page.evaluate(() => {
      const band = document.querySelector('.page-band.row')
      if (!band) return false
      const span = band.querySelector('.t > span:last-child')
      span.innerHTML = '図の枠に、まだ写真がありません<small><span style="display:inline-block">図は、</span><span style="display:inline-block">ほかの所にも</span><span style="display:inline-block">入れられます</span><span style="display:inline-block">（文の中をタップして、</span><span style="display:inline-block">キーボードの上の「図」）</span></small>'
      band.querySelector('button').textContent = '写真を選ぶ'
      return true
    })
    if (!has) console.log('スマホ：帯が見つかりません')
    await sleep(400)
    await page.screenshot({ path: `${OUT}/スマホ_帯の2行目.png` })
    await context.close()
  }
})
console.log('ok')
