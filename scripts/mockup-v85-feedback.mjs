// mockups/v85：「困ったこと・おかしいことを知らせる」（学生がツールの中から送る窓）と、「直しました」の知らせの案（依頼者 2026-11-01）。
// まとめた版を開いて、画面に案を重ねて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v85-feedback.mjs <まとめた版のフォルダ>（ポート 4233。Edge は 9338）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9338'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const server = await serveBuilt(process.argv[2] ?? 'dist-e2e', 4233)
const APP = 'http://localhost:4233'
const OUT = 'mockups/v85/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 案の部品の見た目（ツールの窓・お知らせと同じ色・角の丸み） */
const CSS = `
.mk-mark { outline: 2px solid #c98a2b !important; outline-offset: 2px; border-radius: 6px; }
.fb .chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 2px 0 12px; }
.fb .chips span { border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; font-size: 13px; background: #fff; }
.fb .chips span.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.fb label.q { display: block; font-weight: 700; font-size: 13px; margin: 10px 0 4px; }
.fb textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13.5px; line-height: 1.7; resize: none; }
.fb textarea::placeholder { color: #9aa0b4; }
.fb .attach { display: flex; gap: 8px; align-items: flex-start; margin: 10px 0 0; font-size: 13px; line-height: 1.6; }
.fb .attach input { margin-top: 4px; }
.fb .attach small { display: block; color: var(--muted); font-size: 12px; }
.fb details { margin: 12px 0 0; font-size: 12.5px; color: var(--muted); }
.fb details summary { cursor: pointer; }
.fb .auto { margin: 10px 0 0; padding: 8px 12px; border-radius: 8px; background: #f5f6fa; font-size: 12.5px; line-height: 1.7; color: var(--muted); }
.fb .auto b { color: var(--ink); font-weight: 600; }
.fb .auto ul { margin: 2px 0 4px; padding-left: 1.2em; }
.fb .wait { margin: 12px 0 0; font-size: 12.5px; line-height: 1.7; color: var(--ink); }
.fb .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.fb .sent { text-align: center; padding: 6px 0 2px; }
.fb .sent .ok { font-size: 30px; color: var(--ok); }
.fb .sent p { line-height: 1.8; margin: 6px 0; }
.fb .sent .no { font-family: ui-monospace, Consolas, monospace; font-weight: 700; }
.mk-side-link { display: block; margin: 0 0 4px; font-size: 12px; color: var(--accent); text-decoration: underline; text-align: center; }
.mk-done { margin: 0 0 10px; padding: 10px 12px; border-radius: 10px; background: #e7f2ea; border: 1px solid #b7d9c0; font-size: 13px; line-height: 1.7; color: #1f4d2c; position: relative; }
.mk-done b { display: block; font-size: 12.5px; }
.mk-done .x { position: absolute; top: 4px; right: 8px; color: #5b7d64; font-size: 16px; }
.mk-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); background: #23283a; color: #fff; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; display: flex; gap: 14px; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 60; }
.mk-toast .ok { color: #8fd6a3; font-weight: 700; }
.mk-toast button { background: none; border: 1px solid #5a627d; color: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12.5px; }
`

const WAIT = '<p class="wait">送っていただいた内容は、確かめてからツールを直します。直るまでに数日かかることがあります。急ぐときは、担当の先生に直接お知らせください。</p>'
const AUTO_LIST = '<ul><li>ツールの版・パソコンかスマホか・ブラウザ</li><li>開いていたページ（例：本文 3）</li><li>直前に出た知らせ・ツールの中で起きたエラー</li></ul>原稿の文や写真は送りません。'

const formA = `<div class="modal-backdrop"><div class="modal fb" role="dialog"><header><h2>困ったこと・おかしいことを知らせる</h2><button class="close">×</button></header>
<div class="chips"><span class="on">うまく動かない</span><span>やり方が分からない</span><span>そのほか</span></div>
<label class="q">何をしようとして、何が起きましたか</label>
<textarea rows="5" placeholder="例：表の生地見本のマスに写真を入れたら、カーソルが下のマスに出て、どこを書いているのか分からなくなった"></textarea>
<label class="attach"><input type="checkbox"><span>いまの画面の写真を付ける<small>原稿の文が写ります。先生だけが見ます</small></span></label>
<div class="auto"><b>いっしょに送るもの（自動）</b>${AUTO_LIST}</div>
${WAIT}
<div class="actions"><button>やめる</button><button class="primary">送る</button></div></div></div>`

const formB = `<div class="modal-backdrop"><div class="modal fb" role="dialog"><header><h2>困ったこと・おかしいことを知らせる</h2><button class="close">×</button></header>
<label class="q">① 何をしようとしましたか</label>
<textarea rows="2" placeholder="例：表の生地見本のマスに、写真を入れようとした"></textarea>
<label class="q">② 何が起きましたか（困っていること）</label>
<textarea rows="3" placeholder="例：カーソルが下のマスに出て、どこを書いているのか分からなくなった"></textarea>
<label class="attach"><input type="checkbox"><span>いまの画面の写真を付ける<small>原稿の文が写ります。先生だけが見ます</small></span></label>
<details><summary>いっしょに送るもの（自動）・送らないもの</summary><div class="auto">${AUTO_LIST}</div></details>
${WAIT}
<div class="actions"><button>やめる</button><button class="primary">送る</button></div></div></div>`

const sent = `<div class="modal-backdrop"><div class="modal fb" role="dialog"><header><h2>送りました</h2><button class="close">×</button></header>
<div class="sent"><div class="ok">✓</div><p>受付番号 <span class="no">1105-023</span></p><p>直したら、このツールを開いたときと、大学のメールでお知らせします。<br>急ぐときは、担当の先生に直接お知らせください。</p></div>
<div class="actions"><button class="primary">閉じる</button></div></div></div>`

try {
  await withEdge(async (browser) => {
    const shotsOf = async ({ width, height, phone }) => {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
      await page.setViewport({ width, height, deviceScaleFactor: phone ? 2 : 1.25, isMobile: !!phone, hasTouch: !!phone })
      await stubConfig(page)
      await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
      const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
      await ready()
      await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
      await page.evaluate(() => document.querySelector('.g-opts button').click())
      await page.waitForSelector('.guide.step-word .g-word-opt.no')
      await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
      await page.waitForSelector('.guide .g-later')
      await page.evaluate(() => document.querySelector('.guide .g-later').click())
      await ready()
      await page.evaluate(setupWriting)
      await sleep(600)
      await ready()
      await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
      await ready()
      await page.addStyleTag({ content: CSS })
      await page.mouse.move(width - 20, height - 20)
      const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), captureBeyondViewport: false })
      const overlay = (html) => page.evaluate((html) => { document.querySelector('#mk')?.remove(); const d = document.createElement('div'); d.id = 'mk'; d.innerHTML = html; document.body.append(d) }, html)
      const clear = () => page.evaluate(() => { document.querySelector('#mk')?.remove(); for (const el of document.querySelectorAll('.mk-temp')) el.remove() })
      return { context, page, shot, overlay, clear, ready }
    }

    // ---- パソコン ----
    {
      const { context, page, shot, overlay, clear } = await shotsOf({ width: 1440, height: 810 })
      // 入口①：メニューの「使い方」「手順書」の下
      await page.click('.menu-btn')
      await page.waitForSelector('.head-menu')
      await page.evaluate(() => {
        const menu = document.querySelector('.head-menu')
        const item = document.createElement('button')
        item.className = 'mk-temp mk-mark'
        item.setAttribute('role', 'menuitem')
        item.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>困ったこと・おかしいことを知らせる'
        menu.querySelector('hr').before(item)
      })
      await sleep(300)
      await shot('1-entry-menu')
      await page.keyboard.press('Escape')
      await page.evaluate(() => document.activeElement?.blur())
      await page.mouse.click(1410, 405)
      await sleep(200)
      // 入口②：右の欄のいちばん下（ソースコードの上）に、いつも小さく
      await page.evaluate(() => {
        const src = document.querySelector('.source-notice')
        const a = document.createElement('a')
        a.className = 'mk-temp mk-side-link mk-mark'
        a.textContent = '困ったとき・おかしいときは、ここから知らせる'
        ;(src ?? document.querySelector('aside.side .side-foot'))?.before(a)
      })
      await sleep(300)
      await shot('2-entry-side')
      await clear()
      // 送る窓：案A（1つの欄＋種類）・案B（2つの問い）
      await overlay(formA)
      await sleep(300)
      await shot('3-form-A')
      await overlay(formB)
      await sleep(300)
      await shot('4-form-B')
      await overlay(sent)
      await sleep(300)
      await shot('5-sent')
      await clear()
      // 「直しました」の知らせ：案A 右の欄のいちばん上（コースのお知らせと同じ場所）・案B 画面の下の知らせ
      await page.evaluate(() => {
        const d = document.createElement('div')
        d.className = 'mk-temp mk-done'
        d.innerHTML = '<b>✓ 直しました</b>11月5日に送っていただいた「表の写真を入れるとカーソルが下のマスに出る」は、直しました。<span class="x">×</span>'
        const notice = document.querySelector('aside.side .notice')
        if (notice) notice.before(d)
        else document.querySelector('aside.side .side-head').after(d)
      })
      await sleep(300)
      await shot('6-done-A')
      await clear()
      await overlay('<div class="mk-toast"><span><span class="ok">✓ 直しました</span>　11月5日に送っていただいた件（受付番号 1105-023）</span><button>くわしく</button><button>閉じる</button></div>')
      await sleep(300)
      await shot('7-done-B')
      await context.close()
    }
    // ---- スマホ（送る窓：案A） ----
    {
      const { context, shot, overlay } = await shotsOf({ width: 390, height: 844, phone: true })
      await overlay(formA)
      await sleep(400)
      await shot('8-phone-form-A')
      await context.close()
    }

    // 並べた絵
    const img = (n) => `data:image/png;base64,${readFileSync(join(OUT, `${n}.png`)).toString('base64')}`
    const card = (f, t, d, narrow) => `<div class="card${narrow ? ' narrow' : ''}"><h2>${t}</h2><p>${d}</p><img src="${img(f)}"></div>`
    const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#f4f1ec;font-family:'Yu Gothic UI','Meiryo',sans-serif;width:1720px}
h1{font-size:22px;margin:0 0 6px;color:#2b2b2b} .lead{margin:0 0 16px;color:#555;font-size:14px}
h1.sec{font-size:19px;margin:26px 0 10px;color:#1f3a6e}
.row{display:flex;gap:18px;align-items:flex-start}
.card{background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:18px;flex:1}
.card.narrow{flex:0 0 360px}
.card h2{font-size:18px;margin:0 0 4px;color:#1f3a6e}
.card p{font-size:13.5px;margin:0 0 8px;color:#555;line-height:1.6}
.card img{width:100%;border:1px solid #e4e0d8;border-radius:6px;display:block}
</style><h1>困ったこと・おかしいことを知らせる（v85 の案）</h1><p class="lead">だいだいの枠は、案の場所を示すためのもの（実際には出ません）。</p>
<h1 class="sec">① 入口（どちらか、または両方）</h1>
<div class="row">${card('1-entry-menu', '入口A　メニューの中', '右上の「メニュー」の「使い方」「手順書」の下に置く。ふだんは目立たない')}${card('2-entry-side', '入口B　右の欄のいちばん下', '「PDFを書き出す」の下に、いつも小さく出す。困ったときに見つけやすい')}</div>
<h1 class="sec">② 送る窓</h1>
<div class="row">${card('3-form-A', '窓A　種類を選んで、1つの欄に書く', '「うまく動かない／やり方が分からない／そのほか」を選び、何をして何が起きたかを1つの欄に書く。自動で送るものは、いつも見せる')}${card('4-form-B', '窓B　2つの問いに答える', '「何をしようとしたか」「何が起きたか」を分けて聞く（書きやすいが、少し長い）。自動で送るものは、開くと見える')}</div>
<div class="row">${card('5-sent', '送ったあと', '受付番号と、「直したら知らせる」ことを出す')}${card('8-phone-form-A', 'スマホ（窓A）', 'メニューから開く。同じ窓が画面いっぱいに出る', true)}</div>
<h1 class="sec">③ 「直しました」の知らせ（大学のメールにも同じ内容を送る）</h1>
<div class="row">${card('6-done-A', '知らせA　右の欄のいちばん上', 'コースのお知らせと同じ場所に、緑の欄で出す。× で閉じるまで残る')}${card('7-done-B', '知らせB　画面の下', '開いたときに、画面の下に少しの間出す（「くわしく」で何を直したかを見る）')}</div>`
    const sheet = await browser.newPage()
    await sheet.setViewport({ width: 1768, height: 900, deviceScaleFactor: 1 })
    await sheet.setContent(html, { waitUntil: 'load' })
    const h = await sheet.evaluate(() => document.body.scrollHeight)
    await sheet.setViewport({ width: 1768, height: h, deviceScaleFactor: 1 })
    await sheet.screenshot({ path: 'mockups/v85/v85-案.png', fullPage: true })
  })
} finally {
  server.close()
}
console.log('done')
