// デザイン案 v57（先生の付箋の見た目を、もっと本物の付箋らしくする案。まだ作っていない機能の見本）の画像を撮る。
// 開発用のサーバー（http://localhost:5173）を開いておき、EDGE_PORT=9335 node scripts/mockup-shots-v57.mjs
// A 正方形の付箋（ふせん紙・手書き風の字）／B フィルムの見出し付箋（ページの端から出る・透ける）／C マスキングテープで留めたメモ用紙／D 色分けの付箋（A の色ちがい）
// 手書き風の字は Klee One（見本では Google Fonts から読む。作るときは @fontsource で同じ字をツールに入れる）
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v57/shots'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 手書き風の字（Klee One）：この見本で使う字だけを Google Fonts から取り、data: の字体として入れる（ツールの決まりで、外の字体は読めないため） */
async function handFont() {
  const chars = [...new Set(readFileSync(fileURLToPath(import.meta.url), 'utf8'))].filter((c) => c >= '　' || /[0-9/.]/.test(c)).join('')
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Klee+One:wght@600&text=${encodeURIComponent(chars)}`, { headers: ua })).text()
  const url = /url\((https:[^)]+)\)/.exec(css)[1]
  const font = Buffer.from(await (await fetch(url, { headers: ua })).arrayBuffer()).toString('base64')
  return `@font-face { font-family: 'Klee One'; font-weight: 600; src: url(data:font/woff2;base64,${font}) format('woff2'); }`
}
const FONT = await handFont()

async function openStudent(browser, scale = 1) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  await stubConfig(page)
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: scale })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide.step-studentId')
  await ready()
  await page.evaluate(() => document.querySelector('.g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await wait(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p4'), 'none'))
  await ready()
  await page.addStyleTag({ content: FONT + CSS })
  await page.evaluate(HELPERS)
  await page.evaluate(() => document.fonts.load("600 16px 'Klee One'", '付箋の字'))
  await wait(800)
  return { context, page, ready }
}

const CSS = `
.app .stage .arrow { visibility: hidden; }
.mk-u { text-decoration: underline 2px; text-underline-offset: 3px; }
.mk-lines { position: fixed; inset: 0; z-index: 31; pointer-events: none; }
.hand { font-family: 'Klee One', 'BIZ UDPGothic', sans-serif; font-weight: 600; }
.nt { position: fixed; z-index: 32; box-sizing: border-box; word-break: auto-phrase; text-wrap: pretty; }
.nt .top { display: flex; align-items: center; gap: 2px; margin-bottom: 5px; font: 10.5px 'BIZ UDPGothic', sans-serif; opacity: .8; }
.nt .who { display: block; font: 10.5px 'BIZ UDPGothic', sans-serif; opacity: .65; margin-top: 6px; }
.nt .btns { display: flex; gap: 6px; margin-top: 8px; }
.nt .btns button { border: 0; border-radius: 6px; padding: 3px 9px; font: 700 11.5px 'BIZ UDPGothic', sans-serif; background: rgba(47,62,117,.9); color: #fff; }
.nt .btns button.ghost { background: rgba(255,255,255,.6); color: #3b3320; font-weight: 400; border: 1px solid rgba(0,0,0,.12); }
.nt .no { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: 5px; border-radius: 50%; font: 700 10.5px 'BIZ UDPGothic', sans-serif; color: #fff; vertical-align: 2px; }

/* A 正方形の付箋：上の1/5が貼り付いていて、下がわずかに浮く（下に濃い影）。右下の角がめくれる */
.nt.a { width: 172px; min-height: 150px; padding: 16px 14px 14px; color: #3d3524; font-size: 14px; line-height: 1.6;
  background: linear-gradient(180deg, #f9e66a 0, #fdf08a 18%, #fff59c 100%);
  box-shadow: 0 1px 1px rgba(0,0,0,.1), 0 14px 12px -10px rgba(60,40,0,.45), 2px 4px 8px rgba(60,40,0,.12); }
.nt.a::before { content: ''; position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; background: linear-gradient(135deg, #fff59c 0 48%, #e2cf5a 50%, #f4e98c 62%, rgba(0,0,0,0) 64%); }
.nt.a .no { background: #b38a00; }
.nt.a.done { min-height: 0; width: 120px; padding: 6px 10px; font-size: 12px; background: linear-gradient(180deg, #cfe8bf, #e3f3d6); color: #2f5a27; }
.nt.a.done::before { display: none; }
.nt.a.done .no { background: #5d9a52; }
/* D：色分け（直してほしい：ピンク／確かめてほしい：黄／よい所：水色） */
.nt.a.pink { background: linear-gradient(180deg, #f9b7c9 0, #fcc9d6 18%, #fdd5df 100%); color: #5a2633; }
.nt.a.pink::before { background: linear-gradient(135deg, #fdd5df 0 48%, #e79bb0 50%, #f7c3d1 62%, rgba(0,0,0,0) 64%); }
.nt.a.pink .no { background: #c24d6e; }
.nt.a.blue { background: linear-gradient(180deg, #a9dcf0 0, #bfe6f5 18%, #cdeefa 100%); color: #1f4655; }
.nt.a.blue::before { background: linear-gradient(135deg, #cdeefa 0 48%, #8cc6dd 50%, #b9e2f2 62%, rgba(0,0,0,0) 64%); }
.nt.a.blue .no { background: #3b88a8; }
.nt .kind { display: inline-block; padding: 0 6px; border-radius: 4px; background: rgba(255,255,255,.55); font: 700 10.5px 'BIZ UDPGothic', sans-serif; }

/* B フィルムの見出し付箋：色の付いた先（ページの外）と、透ける長い部分（ページの余白の上）。押すとメモが開く */
.nt.b { height: 26px; width: 150px; display: flex; align-items: stretch; filter: drop-shadow(1px 1px 1.5px rgba(0,0,0,.18)); }
.nt.b .film { flex: 1; display: flex; align-items: center; padding: 0 8px; background: rgba(255, 228, 92, .38); border: 1px solid rgba(214, 178, 30, .45); border-right: 0; font: 11px 'BIZ UDPGothic', sans-serif; color: #6b5410; white-space: nowrap; overflow: hidden; }
.nt.b .tip { width: 40px; display: grid; place-items: center; background: #f2c517; color: #5b4500; font: 700 12px 'BIZ UDPGothic', sans-serif; border-radius: 0 3px 3px 0; }
.nt.b.pink .film { background: rgba(255, 120, 160, .28); border-color: rgba(220, 80, 120, .4); color: #7a2340; }
.nt.b.pink .tip { background: #f06b92; color: #fff; }
.nt.b.done .film { background: rgba(130, 200, 120, .28); border-color: rgba(90, 160, 80, .4); color: #2f5a27; }
.nt.b.done .tip { background: #7cbf6c; color: #fff; }
.nt.b-memo { width: 210px; padding: 12px 14px; background: #fffdf2; border: 1px solid #e8d98a; border-top: 4px solid #f2c517; border-radius: 4px; color: #3d3524; font-size: 13.5px; line-height: 1.65; box-shadow: 0 8px 22px rgba(60,40,0,.22); }

/* C マスキングテープで留めたメモ用紙（罫線入りのクリーム色の紙。上にテープ） */
.nt.c { width: 180px; padding: 20px 14px 12px; color: #2f2a22; font-size: 14px; line-height: 26px;
  background: #fffdf6 repeating-linear-gradient(transparent 0 25px, #cfdde9 25px 26px) 0 15px / 100% calc(100% - 15px) no-repeat;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 14px rgba(40,30,10,.16); }
.nt.c::before { content: ''; position: absolute; top: -9px; left: 50%; width: 74px; height: 22px; transform: translateX(-50%) rotate(-3deg); background: rgba(232, 196, 120, .75);
  clip-path: polygon(0 8%, 6% 0, 12% 10%, 18% 0, 24% 8%, 30% 0, 36% 9%, 42% 0, 48% 8%, 54% 0, 60% 9%, 66% 0, 72% 8%, 78% 0, 84% 10%, 90% 0, 96% 8%, 100% 0, 100% 92%, 94% 100%, 88% 90%, 82% 100%, 76% 92%, 70% 100%, 64% 91%, 58% 100%, 52% 92%, 46% 100%, 40% 90%, 34% 100%, 28% 92%, 22% 100%, 16% 91%, 10% 100%, 4% 92%, 0 100%);
  background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 6px, transparent 6px 12px); }
.nt.c .no { background: #a5763a; }
.nt.c.done { width: 130px; padding: 14px 10px 6px; font-size: 12px; line-height: 20px; opacity: .8; background: #f3faef; }
.nt.c.done::before { background: rgba(150, 200, 140, .7); }
.nt.c.done .no { background: #5d9a52; }
`

function HELPERS() {
  window.__wrap = (blockId, phrase, cls) => {
    const els = [...document.querySelectorAll(`.page-viewport.front [data-block-id="${blockId}"]`)].filter((e) => e.getBoundingClientRect().width > 0)
    for (const el of els) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const nodes = []
      let text = ''
      while (walker.nextNode()) {
        nodes.push([walker.currentNode, text.length])
        text += walker.currentNode.data
      }
      const i = text.indexOf(phrase)
      if (i < 0) continue
      const at = (pos, end) => {
        for (let k = nodes.length - 1; k >= 0; k--) if (nodes[k][1] < pos || (!end && nodes[k][1] === pos)) return [nodes[k][0], pos - nodes[k][1]]
        return [nodes[0][0], 0]
      }
      const r = document.createRange()
      const [sn, so] = at(i, false)
      const [en, eo] = at(i + phrase.length, true)
      r.setStart(sn, so)
      r.setEnd(en, eo)
      const span = document.createElement('span')
      span.className = cls
      span.append(r.extractContents())
      r.insertNode(span)
      return span
    }
    throw new Error(`見つかりません：${blockId} ${phrase}`)
  }
  window.__paper = () => [...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container]')].find((e) => e.classList.contains('is-current')).getBoundingClientRect()
  /** 印を付ける3つの文（3：キーワード、1：袖、2：藍色＝直した） */
  window.__marks = (color, doneColor) => {
    const u = (id, phrase, c) => { const s = window.__wrap(id, phrase, 'mk-u'); s.style.textDecorationColor = c; return s }
    return [u('p3', 'キーワードは自由、勇気、海である', color), u('p4', '袖は風をはらむように大きく膨らませた', color), u('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', doneColor)]
  }
  /** 付箋を、紙面の右の端に上から順に置く（重ならないよう下へずらす）。点線で、段落の右の端とつなぐ */
  window.__place = (items, { left, gap = 14, line = '#c9a400' }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'mk-lines')
    svg.setAttribute('width', innerWidth)
    svg.setAttribute('height', innerHeight)
    document.body.append(svg)
    let next = 0
    for (const { span, el, tilt = 0, dy = -12, lineColor, noLine } of items) {
      document.body.append(el)
      const r = span.getClientRects()[0]
      const top = Math.max(next, r.top + dy)
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.transform = `rotate(${tilt}deg)`
      next = top + el.getBoundingClientRect().height + gap
      if (noLine) continue
      const last = [...span.getClientRects()].at(-1)
      const x1 = span.closest('[data-block-id]').getBoundingClientRect().right + 4
      const y1 = last.top + last.height / 2
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M${x1} ${y1} C ${x1 + 14} ${y1}, ${left - 14} ${top + 14}, ${left} ${top + 14}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', lineColor ?? line)
      path.setAttribute('stroke-width', '1.4')
      path.setAttribute('stroke-dasharray', '4 3')
      svg.append(path)
    }
  }
  window.__el = (cls, html) => {
    const d = document.createElement('div')
    d.className = `nt ${cls}`
    d.innerHTML = html
    return d
  }
}

const TEXT = {
  n3: 'キーワードが、衣装のどこに表れているかを続けて書きましょう。',
  n1: 'なぜ大きくしたのか、キャラクターの性格とのつながりも書きましょう。',
}

await withEdge(async (browser) => {
  for (const scale of [1, 2]) {
    const suffix = scale === 2 ? '-zoom' : ''
    const zoomClip = { x: 760, y: 230, width: 340, height: 600 }

    // ---- A 正方形の付箋 ----
    {
      const { context, page } = await openStudent(browser, scale)
      await page.evaluate((T) => {
        const [k, s, d] = window.__marks('#d9b100', '#7fb174')
        const p = window.__paper()
        window.__place(
          [
            { span: k, tilt: -2.2, el: window.__el('a hand', `<div class="top"><span class="no">3</span>梶田先生・10/31</div>${T.n3}`) },
            { span: s, tilt: 1.8, el: window.__el('a hand', `<div class="top"><span class="no">1</span>梶田先生・10/31</div>${T.n1}<div class="btns"><button>直した</button></div>`) },
            { span: d, tilt: -1, el: window.__el('a done hand', '<span class="no">2</span>直した ✓'), lineColor: '#7fb174' },
          ],
          { left: p.right - 40 },
        )
      }, TEXT)
      await wait(300)
      if (scale === 1) await page.screenshot({ path: `${OUT}/A${suffix}.png` })
      else await page.screenshot({ path: `${OUT}/A${suffix}.png`, clip: zoomClip })
      await context.close()
    }

    // ---- B フィルムの見出し付箋 ----
    {
      const { context, page } = await openStudent(browser, scale)
      await page.evaluate((T) => {
        const [k, s, d] = window.__marks('#e0b400', '#7fb174')
        const p = window.__paper()
        const film = (cls, n, label) => window.__el(`b ${cls}`, `<span class="film">${label}</span><span class="tip">${n}</span>`)
        const tabs = [
          { span: k, dy: -6, el: film('', '3', 'キーワードが衣装の…') },
          { span: s, dy: -6, el: film('', '1', 'なぜ大きくしたのか…') },
          { span: d, dy: -6, el: film('done', '2 ✓', '直した'), lineColor: '#7fb174' },
        ]
        window.__place(tabs.map((t) => ({ ...t, noLine: true })), { left: p.right - 62, gap: 8 })
        // 1 を開いたところ：見出し付箋のすぐ下にメモが開く
        const t1 = tabs[1].el.getBoundingClientRect()
        const memo = window.__el('b-memo', `<b class="hand" style="font-size:14.5px"><span class="no" style="background:#d9a400">1</span>${T.n1}</b><span class="who">梶田先生・10月31日</span><div class="btns"><button>直した</button><button class="ghost">閉じる</button></div>`)
        document.body.append(memo)
        memo.style.left = `${p.right - 24}px`
        memo.style.top = `${t1.bottom + 4}px`
      }, TEXT)
      await wait(300)
      if (scale === 1) await page.screenshot({ path: `${OUT}/B${suffix}.png` })
      else await page.screenshot({ path: `${OUT}/B${suffix}.png`, clip: zoomClip })
      await context.close()
    }

    // ---- C マスキングテープで留めたメモ用紙 ----
    {
      const { context, page } = await openStudent(browser, scale)
      await page.evaluate((T) => {
        const [k, s, d] = window.__marks('#b9894a', '#7fb174')
        const p = window.__paper()
        window.__place(
          [
            { span: k, tilt: 1.5, dy: -4, el: window.__el('c hand', `<div class="top"><span class="no">3</span>梶田先生・10/31</div>${T.n3}`), lineColor: '#b9894a' },
            { span: s, tilt: -1.6, dy: -4, el: window.__el('c hand', `<div class="top"><span class="no">1</span>梶田先生・10/31</div>${T.n1}<div class="btns"><button>直した</button></div>`), lineColor: '#b9894a' },
            { span: d, tilt: 1, dy: -4, el: window.__el('c done hand', '<span class="no">2</span>直した ✓'), lineColor: '#7fb174' },
          ],
          { left: p.right - 40, gap: 20 },
        )
      }, TEXT)
      await wait(300)
      if (scale === 1) await page.screenshot({ path: `${OUT}/C${suffix}.png` })
      else await page.screenshot({ path: `${OUT}/C${suffix}.png`, clip: zoomClip })
      await context.close()
    }

    // ---- D 色分けの付箋（A の色ちがい：直してほしい＝ピンク／確かめてほしい＝黄／よい所＝水色） ----
    {
      const { context, page } = await openStudent(browser, scale)
      await page.evaluate(() => {
        const u = (id, phrase, c) => { const s = window.__wrap(id, phrase, 'mk-u'); s.style.textDecorationColor = c; return s }
        const k = u('p3', 'キーワードは自由、勇気、海である', '#d9b100')
        const s = u('p4', '袖は風をはらむように大きく膨らませた', '#e0809c')
        const g = u('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', '#5aa9c8')
        const p = window.__paper()
        window.__place(
          [
            { span: k, tilt: -2, el: window.__el('a hand', '<div class="top"><span class="no">3</span><span class="kind">確かめて</span></div>キーワードが、衣装のどこに表れているかを続けて書きましょう。'), lineColor: '#d9b100' },
            { span: s, tilt: 1.6, el: window.__el('a pink hand', '<div class="top"><span class="no">1</span><span class="kind">直してほしい</span></div>なぜ大きくしたのか、性格とのつながりも書きましょう。<div class="btns"><button>直した</button></div>'), lineColor: '#e0809c' },
            { span: g, tilt: -1.2, el: window.__el('a blue hand', '<div class="top"><span class="no">2</span><span class="kind">よい所</span></div>照明で確かめたのがよく分かります。'), lineColor: '#5aa9c8' },
          ],
          { left: p.right - 40 },
        )
      })
      await wait(300)
      if (scale === 1) await page.screenshot({ path: `${OUT}/D${suffix}.png` })
      else await page.screenshot({ path: `${OUT}/D${suffix}.png`, clip: zoomClip })
      await context.close()
    }
  }
})
console.log('撮りました')
