// デザイン案 v56（先生がツールの上で添削する仕組みの見本。まだ作っていない機能を、画面に部品を足して見せるだけ）の画像を撮る。
// 開発用のサーバー（http://localhost:5173）を開いておき、EDGE_PORT=9335 node scripts/mockup-shots-v56.mjs
// ① 小：ページごとのコメント（先生は管理ページで、届いた PDF を見て書く） ② 中：紙面に付箋（先生は学生の原稿の写しを開いて貼る）
// ③ 大：赤ペン（先生の書き直し案を、学生が受け入れる）
import { mkdirSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v56/shots'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const W = 1440
const H = 900

/** 見本の原稿で、学生のツールを開く */
async function openStudent(browser, scale = 1) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  await stubConfig(page)
  await page.setViewport({ width: W, height: H, deviceScaleFactor: scale })
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
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123' } })))
  await wait(600)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p4'), 'none'))
  await ready()
  await wait(400)
  await page.addStyleTag({ content: MOCK_CSS })
  await page.evaluate(HELPERS)
  return { context, page, ready }
}

/** 見本の部品の見た目 */
const MOCK_CSS = `
.mk-mark { background: rgba(255, 214, 92, 0.55); border-bottom: 2px solid #d9a400; }
.mk-mark.done { background: rgba(160, 200, 160, 0.35); border-bottom-color: #6aa36a; }
.mk-sel { background: rgba(80, 120, 230, 0.28); }
.mk-del { color: #c0392b; text-decoration: line-through 1.5px; }
.mk-ins { color: #c0392b; border-bottom: 1.5px solid #c0392b; }
.mk-badge { position: fixed; z-index: 30; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #d9a400; color: #fff; font: 700 11.5px 'BIZ UDPGothic', sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.mk-badge.done { background: #6aa36a; }
.mk-badge.red { background: #c0392b; }
.mk-float { position: fixed; z-index: 31; display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; border-radius: 10px; background: #2b2e36; color: #fff; font: 13px 'BIZ UDPGothic', sans-serif; box-shadow: 0 6px 18px rgba(0,0,0,.25); white-space: nowrap; }
.mk-float button { border: 0; border-radius: 7px; padding: 6px 10px; background: #fff; color: var(--accent); font: 700 12.5px 'BIZ UDPGothic', sans-serif; }
.mk-float button.ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.4); font-weight: 400; }
.mk-band { position: fixed; z-index: 44; left: 0; right: 0; top: 0; height: 34px; display: flex; align-items: center; gap: 14px; padding: 0 16px; background: #e8ecf7; border-bottom: 1px solid #c9d1ea; color: #2f3e75; font: 13px 'BIZ UDPGothic', sans-serif; white-space: nowrap; }
.mk-band b { font-weight: 700; }
.mk-band .sp { flex: 1; }
.mk-band button { border: 1px solid #b9c3e3; background: #fff; border-radius: 8px; padding: 4px 12px; color: #2f3e75; font: 12.5px 'BIZ UDPGothic', sans-serif; }
.app.mk-banded { top: 34px; height: calc(100% - 34px); }
.mk-sec { padding: 14px 18px 16px; border-top: 1px solid #dcd7cf; background: #fffaf0; }
.mk-sec h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 14.5px; letter-spacing: 0.06em; }
.mk-sec h3 .n { min-width: 20px; padding: 1px 7px; border-radius: 99px; background: #d9a400; color: #fff; font-size: 12px; text-align: center; letter-spacing: 0; }
.mk-item { margin: 0 0 8px; padding: 9px 11px 10px; border: 1px solid #ecdcb4; border-radius: 10px; background: #fff; font-size: 13px; line-height: 1.6; word-break: auto-phrase; }
.mk-item.done { opacity: 0.6; }
.mk-item .top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; font-size: 11.5px; color: var(--muted); }
.mk-item .chip { padding: 0 7px; border-radius: 99px; background: #f3ead2; color: #8a6400; font-weight: 700; }
.mk-item .num { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #d9a400; color: #fff; font-size: 11px; font-weight: 700; }
.mk-item.done .num { background: #6aa36a; }
.mk-item .num.red { background: #c0392b; }
.mk-item q { display: block; margin: 0 0 3px; color: var(--muted); font-size: 12px; quotes: '「' '」'; }
.mk-item .acts { display: flex; gap: 6px; margin-top: 7px; }
.mk-item .acts button { border: 1px solid var(--line); background: #fff; border-radius: 7px; padding: 4px 10px; font-size: 12px; color: var(--ink); }
.mk-item .acts button.pri { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
.mk-item .ok { color: #3d7a3d; font-weight: 700; font-size: 12px; }
.mk-item del { color: #c0392b; }
.mk-item ins { color: #c0392b; text-decoration: none; border-bottom: 1px solid #c0392b; }
.mk-tside { position: absolute; inset: 0; display: flex; flex-direction: column; background: var(--panel-bg, #fbfaf7); font-family: 'BIZ UDPGothic', sans-serif; }
.mk-tside .hd { padding: 16px 18px 12px; border-bottom: 1px solid #e6e2da; }
.mk-tside .hd b { display: block; font-size: 16px; }
.mk-tside .hd small { color: var(--muted); font-size: 12px; }
.mk-tside .list { flex: 1; overflow: auto; padding: 14px 18px; }
.mk-tside .list h3 { margin: 0 0 10px; font-size: 14px; }
.mk-form { padding: 12px 18px 16px; border-top: 1px solid #e6e2da; background: #fff; }
.mk-form .where { margin: 0 0 6px; font-size: 12px; color: var(--muted); }
.mk-form .where b { color: var(--ink); }
.mk-form textarea { width: 100%; box-sizing: border-box; min-height: 74px; padding: 8px 10px; border: 1.5px solid var(--accent); border-radius: 10px; font: 13.5px/1.6 'BIZ UDPGothic', sans-serif; resize: none; }
.mk-form .row { display: flex; gap: 8px; margin-top: 8px; }
.mk-form .row .sp { flex: 1; }
.mk-form button { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 7px 14px; font: 13px 'BIZ UDPGothic', sans-serif; }
.mk-form button.pri { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
.mk-note { position: fixed; z-index: 32; width: 196px; box-sizing: border-box; padding: 0 12px 12px; background: #fff4a8; color: #3b3320; font: 12.5px/1.65 'BIZ UDPGothic', sans-serif; box-shadow: 1px 2px 2px rgba(0,0,0,.08), 3px 6px 14px rgba(60,40,0,.22); border-radius: 1px 1px 2px 2px; word-break: auto-phrase; }
.mk-note .hd { display: flex; align-items: center; gap: 6px; margin: 0 -12px 7px; padding: 5px 12px 4px; background: #f6e27c; font-size: 11px; color: #7a6420; }
.mk-note .hd b { display: inline-grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: #c99400; color: #fff; font-size: 10.5px; }
.mk-note .acts { display: flex; gap: 6px; margin-top: 8px; }
.mk-note .acts button { border: 1px solid rgba(0,0,0,.15); background: rgba(255,255,255,.75); border-radius: 6px; padding: 3px 9px; font: 11.5px 'BIZ UDPGothic', sans-serif; color: #3b3320; }
.mk-note .acts button.pri { background: #2f3e75; border-color: #2f3e75; color: #fff; font-weight: 700; }
.mk-note .ok { color: #3d7a3d; font-weight: 700; font-size: 11.5px; }
.mk-note.done { background: #e9f3e3; opacity: .92; padding-bottom: 0; }
.mk-note.done .hd { margin-bottom: 0; }
.mk-note.done .hd { background: #cfe5c4; color: #3d6a33; }
.mk-note.done .hd b { background: #6aa36a; }
.mk-note.writing { background: #fffbd9; outline: 2px solid #2f3e75; }
.mk-note.writing .txt { min-height: 66px; padding: 4px 6px; border-radius: 4px; background: rgba(255,255,255,.85); border: 1px solid #d8c56a; }
.mk-note.writing .txt::after { content: ''; display: inline-block; width: 1.5px; height: 1.1em; margin-left: 1px; vertical-align: -2px; background: #2f3e75; }
.mk-lines { position: fixed; inset: 0; z-index: 31; pointer-events: none; }
.app .stage .arrow.prev, .app .stage .arrow.next { visibility: var(--mk-arrows, visible); }
`

/** 紙面の欄の中の文字を包む・印を付ける部品（ページの中で動かす） */
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
  /** 紙面の右の余白に、番号の丸（span の最初の行の高さ） */
  window.__badge = (span, n, cls = '') => {
    const r = span.getClientRects()[0]
    const p = window.__paper()
    const b = document.createElement('div')
    b.className = `mk-badge ${cls}`
    b.textContent = n
    b.style.left = `${p.right - 30}px`
    b.style.top = `${r.top + r.height / 2 - 10}px`
    document.body.append(b)
  }
  window.__float = (span, html, below = false) => {
    const r = span.getClientRects()[0]
    const f = document.createElement('div')
    f.className = 'mk-float'
    f.innerHTML = html
    document.body.append(f)
    const fr = f.getBoundingClientRect()
    f.style.left = `${Math.max(8, r.left + Math.min(r.width, 200) / 2 - fr.width / 2)}px`
    f.style.top = `${below ? r.bottom + 8 : r.top - fr.height - 8}px`
  }
  /** 右の欄の、セルフチェックの前に部品を入れる */
  window.__sideSection = (html) => {
    const sec = document.createElement('section')
    sec.className = 'mk-sec'
    sec.innerHTML = html
    const check = document.querySelector('.side .sec.check')
    check.parentElement.insertBefore(sec, check)
    document.querySelector('.side .course-notice')?.remove()
  }
  /** 右の欄を、先生の画面のものに替える */
  window.__teacherSide = (html) => {
    const side = document.querySelector('.side')
    side.style.position = 'relative'
    const box = document.createElement('div')
    box.className = 'mk-tside'
    box.innerHTML = html
    side.append(box)
  }
  /** 紙面の右の端に付箋を貼る（印の文と点線でつなぐ）。notes：[{ span, html, cls, tilt }] を上から順に。重ならないように下へずらす */
  window.__notes = (notes) => {
    const p = window.__paper()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'mk-lines')
    svg.setAttribute('width', innerWidth)
    svg.setAttribute('height', innerHeight)
    document.body.append(svg)
    let next = 0
    for (const n of notes) {
      const rects = [...n.span.getClientRects()]
      const last = rects.at(-1)
      const el = document.createElement('div')
      el.className = `mk-note ${n.cls ?? ''}`
      el.innerHTML = n.html
      el.style.left = `${p.right - 46}px`
      el.style.transform = `rotate(${n.tilt ?? -1.5}deg)`
      document.body.append(el)
      const top = Math.max(next, rects[0].top - 14)
      el.style.top = `${top}px`
      next = top + el.getBoundingClientRect().height + 12
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      // 線は、段落の右の端（余白）から付箋へ（文の上を横切らないように）。文には下線の印が付いている
      const x1 = n.span.closest('[data-block-id]').getBoundingClientRect().right + 4
      const y1 = last.top + last.height / 2
      const x2 = p.right - 46
      const y2 = top + 12
      line.setAttribute('d', `M${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`)
      line.setAttribute('fill', 'none')
      line.setAttribute('stroke', n.cls?.includes('done') ? '#7fb174' : n.cls?.includes('writing') ? '#2f3e75' : '#d0a400')
      line.setAttribute('stroke-width', '1.5')
      line.setAttribute('stroke-dasharray', '4 3')
      svg.append(line)
    }
  }
  window.__band = (html) => {
    const b = document.createElement('div')
    b.className = 'mk-band'
    b.innerHTML = html
    document.body.append(b)
    document.querySelector('.app').classList.add('mk-banded')
    window.dispatchEvent(new Event('resize'))
  }
}

const shot = (page, file) => page.screenshot({ path: `${OUT}/${file}.png` })
/** FUSEN=1：付箋の見た目の②だけを撮る */
const FUSEN = !!process.env.FUSEN
/** SPREAD=1：見開きの付箋だけを撮る */
const SPREAD = !!process.env.SPREAD

await withEdge(async (browser) => {
  // ---- 学生の PDF のページの絵（① の先生の画面で使う） ----
  const pages = []
  if (!FUSEN && !SPREAD) {
    const { context, page, ready } = await openStudent(browser, 2)
    // PDF の絵には、紙面に重なる画面の部品（右下の帯・‹ ›・道具）を写さない
    await page.addStyleTag({ content: '.view-bar, .arrow, .palette, .continue-row { visibility: hidden !important; }' })
    for (const id of ['p4', 'f2']) {
      await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
      await ready()
      await wait(300)
      const r = await page.evaluate(() => { const p = window.__paper(); return { x: p.left, y: p.top, width: p.width, height: p.height } })
      pages.push(await page.screenshot({ clip: r, encoding: 'base64' }))
    }
    await context.close()
  }

  // ---- ① 小：先生（管理ページで、届いた PDF を見てコメントを書く） ----
  if (!FUSEN && !SPREAD) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({ width: W, height: H })
    await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
    await wait(1200)
    await page.addStyleTag({
      content: `${MOCK_CSS}
      .mk-stu .crow { display: flex; align-items: center; }
      .mk-stu .open-btn { width: auto; flex: none; }
      .mk-stu .meta { display: block; margin-top: 2px; font-size: 12.5px; color: var(--muted); }
      .mk-stu .cnt { margin-left: auto; margin-right: 10px; font-size: 12.5px; color: #8a6400; white-space: nowrap; }
      .mk-pages { display: flex; gap: 14px; justify-content: center; padding: 14px; }
      .mk-pages figure { margin: 0; text-align: center; font-size: 12px; color: var(--muted); }
      .mk-pages img { display: block; width: 300px; box-shadow: 0 1px 4px rgba(0,0,0,.18); margin-bottom: 6px; }
      .mk-cform select, .mk-cform textarea { font: 14px 'BIZ UDPGothic', sans-serif; }
      .mk-cform textarea { width: 100%; box-sizing: border-box; min-height: 80px; }`,
    })
    await page.evaluate((imgs) => {
      const ul = document.querySelector('nav.side-nav ul')
      ul.querySelectorAll('button').forEach((b) => { b.classList.remove('on'); b.removeAttribute('aria-current') })
      const li = document.createElement('li')
      li.innerHTML = '<button class="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16l-1 4zM13.5 7.5l3 3"/></svg><span class="nt"><b>学生の添削</b><small>届いた PDF 12人・コメント</small></span></button>'
      ul.prepend(li)
      const c = document.querySelector('section.content')
      c.innerHTML = `<h1 class="sec-h">学生の添削</h1><p class="sec-lead">学生が「PDFを書き出す」を押すと、ここに届きます。ページを見て、コメントを書きます（学生のツールに届きます）。</p>
      <div class="course-list">
        <div class="course open mk-stu"><div class="crow nogrip"><div class="cmain"><b class="cname">文化　花子（00ZZ0123）</b><span class="meta">映画・舞台衣装デザイナー コース・届いた PDF：10月30日 14:05</span></div><span class="cnt">コメント 2</span><button class="btn sub sm open-btn">閉じる</button></div>
          <div class="cbody"><div class="grid">
            <div class="lb">送ったコメント</div><div class="ctl">
              <div class="mk-item"><div class="top"><span class="chip">本文 1ページ</span>10月31日</div>ⅱ．デザイン説明：なぜ袖を大きく膨らませたのか、キャラクターの性格とのつながりも書きましょう。<div class="top" style="margin:6px 0 0">学生：まだ</div></div>
              <div class="mk-item done"><div class="top"><span class="chip">本文 2ページ</span>10月31日</div>図2のイメージボードは、どの場面のイメージかをタイトルで分かるようにしましょう。<div class="top" style="margin:6px 0 0"><span class="ok">学生：直した ✓（11月2日）</span></div></div>
            </div>
            <label class="lb">コメントを足す</label><div class="ctl mk-cform">
              <select class="sel in" style="margin-bottom:8px"><option>本文 1ページ</option></select>
              <textarea class="in" placeholder="例：図1の説明が足りません">「キーワードは自由、勇気、海」が、衣装のどこに表れているかを続けて書きましょう。</textarea>
              <div style="margin-top:8px;display:flex;gap:8px"><button class="btn">コメントを送る</button></div>
              <div class="hint">送ると、学生のツールの右の欄に「先生からのコメント」として出ます。</div>
            </div>
          </div></div>
        </div>
        <div class="course mk-stu"><div class="crow nogrip"><div class="cmain"><b class="cname">服飾　太郎（00ZZ0456）</b><span class="meta">映画・舞台衣装デザイナー コース・届いた PDF：10月29日 18:40</span></div><span class="cnt">コメント 0</span><button class="btn sub sm open-btn">開く</button></div></div>
        <div class="course mk-stu"><div class="crow nogrip"><div class="cmain"><b class="cname">装苑　さくら（00ZZ0789）</b><span class="meta">映画・舞台衣装デザイナー コース・PDF はまだ届いていません</span></div><button class="btn sub sm open-btn" disabled>開く</button></div></div>
      </div>`
      const s = document.querySelector('section.stage')
      s.innerHTML = `<div class="caption"><b>PDF</b><span>文化　花子さん（10月30日 14:05 に届いた控え）</span></div>
      <div class="mk-pages">${imgs.map((src, i) => `<figure><img src="data:image/png;base64,${src}">本文 ${i + 1}ページ</figure>`).join('')}</div>`
    }, pages)
    await wait(400)
    await shot(page, '1-teacher')
    await context.close()
  }

  // ---- ① 小：学生（右の欄に「先生からのコメント」） ----
  if (!FUSEN && !SPREAD) {
    const { context, page } = await openStudent(browser)
    await page.evaluate(() => {
      window.__sideSection(`<h3>先生からのコメント <span class="n">1</span></h3>
        <div class="mk-item"><div class="top"><span class="chip">本文 1ページ</span>梶田先生・10月31日</div>ⅱ．デザイン説明：なぜ袖を大きく膨らませたのか、キャラクターの性格とのつながりも書きましょう。<div class="acts"><button>そのページへ</button><button class="pri">直した</button></div></div>
        <div class="mk-item done"><div class="top"><span class="chip">本文 2ページ</span>梶田先生・10月31日</div>図2のイメージボードは、どの場面のイメージかをタイトルで分かるようにしましょう。<div class="acts"><span class="ok">直した ✓</span></div></div>`)
    })
    await wait(300)
    await shot(page, '1-student')
    await context.close()
  }

  // ---- ② 中：先生（学生の原稿の写しを開いて、紙面に付箋を貼る） ----
  if (!FUSEN && !SPREAD) {
    const { context, page, ready } = await openStudent(browser)
    // 先生の画面は読むだけ：道具と「元に戻す・やり直す」は出さない
    await page.addStyleTag({ content: '.palette, .view-bar .undo-redo { display: none !important; }' })
    await page.evaluate(() => window.__band('<b>先生の画面</b>文化　花子さん（00ZZ0123）の原稿・10月30日 14:05 に届いた写し（読むだけ。書き換えはできません）<span class="sp"></span><button>学生の一覧へ戻る</button>'))
    await wait(900)
    await ready()
    await page.evaluate(() => {
      const a = window.__wrap('p4', '袖は風をはらむように大きく膨らませた', 'mk-mark')
      window.__badge(a, 1)
      const b = window.__wrap('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', 'mk-mark')
      window.__badge(b, 2)
      const c = window.__wrap('p3', 'キーワードは自由、勇気、海である', 'mk-sel')
      window.__float(c, '選んだ所に <button>コメントを付ける</button>', true)
      window.__teacherSide(`<div class="hd"><b>文化　花子さん</b><small>映画・舞台衣装デザイナー コース・00ZZ0123</small></div>
        <div class="list"><h3>付けたコメント 2</h3>
          <div class="mk-item"><div class="top"><span class="num">1</span>本文 1ページ・10月31日</div><q>袖は風をはらむように大きく膨らませた</q>なぜ大きくしたのか、キャラクターの性格とのつながりも書きましょう。</div>
          <div class="mk-item"><div class="top"><span class="num">2</span>本文 1ページ・10月31日</div><q>藍色の濃さは、照明の下でも黒く沈まないものを選んだ</q>どのように確かめたか（照明を当てて試したなど）を書くと、説得力が出ます。</div>
        </div>
        <div class="mk-form"><p class="where">選んだ所：<b>「キーワードは自由、勇気、海である」</b></p><textarea>キーワードが、衣装のどこに表れているかを続けて書きましょう。</textarea><div class="row"><button>やめる</button><span class="sp"></span><button class="pri">コメントを付ける</button></div></div>`)
    })
    await wait(300)
    await shot(page, '2-teacher')
    await context.close()
  }

  // ---- ② 中：学生（紙面に印と番号、右の欄に一覧） ----
  if (!FUSEN && !SPREAD) {
    const { context, page } = await openStudent(browser)
    await page.evaluate(() => {
      const a = window.__wrap('p4', '袖は風をはらむように大きく膨らませた', 'mk-mark')
      window.__badge(a, 1)
      const b = window.__wrap('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', 'mk-mark done')
      window.__badge(b, 2, 'done')
      const c = window.__wrap('p3', 'キーワードは自由、勇気、海である', 'mk-mark')
      window.__badge(c, 3)
      window.__sideSection(`<h3>先生からのコメント <span class="n">2</span></h3>
        <div class="mk-item"><div class="top"><span class="num">1</span>梶田先生・10月31日</div><q>袖は風をはらむように大きく膨らませた</q>なぜ大きくしたのか、キャラクターの性格とのつながりも書きましょう。<div class="acts"><button>その場所へ</button><button class="pri">直した</button></div></div>
        <div class="mk-item"><div class="top"><span class="num">3</span>梶田先生・10月31日</div><q>キーワードは自由、勇気、海である</q>キーワードが、衣装のどこに表れているかを続けて書きましょう。<div class="acts"><button>その場所へ</button><button class="pri">直した</button></div></div>
        <div class="mk-item done"><div class="top"><span class="num">2</span>梶田先生・10月31日</div><q>藍色の濃さは、照明の下でも黒く沈まないものを選んだ</q>どのように確かめたかを書くと、説得力が出ます。<div class="acts"><span class="ok">直した ✓</span></div></div>`)
    })
    await wait(300)
    await shot(page, '2-student')
    await context.close()
  }

  // ---- ② 中（付箋の見た目）：先生（紙面の右の端に付箋を貼る。いま3枚目を書いている） ----
  if (!SPREAD) {
    const { context, page, ready } = await openStudent(browser)
    await page.addStyleTag({ content: '.palette, .view-bar .undo-redo { display: none !important; } .app .stage { --mk-arrows: hidden; }' })
    await page.evaluate(() => window.__band('<b>先生の画面</b>文化　花子さん（00ZZ0123）の原稿・10月30日 14:05 に届いた写し（読むだけ。書き換えはできません）<span class="sp"></span><button>学生の一覧へ戻る</button>'))
    await wait(900)
    await ready()
    await page.evaluate(() => {
      const c = window.__wrap('p3', 'キーワードは自由、勇気、海である', 'mk-sel')
      const a = window.__wrap('p4', '袖は風をはらむように大きく膨らませた', 'mk-mark')
      const b = window.__wrap('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', 'mk-mark')
      window.__notes([
        { span: c, cls: 'writing', tilt: 0, html: '<div class="hd"><b>3</b>付箋を書いています</div><div class="txt">キーワードが、衣装のどこに表れているかを続けて書きましょう。</div><div class="acts"><button class="pri">貼る</button><button>やめる</button></div>' },
        { span: a, tilt: -1.8, html: '<div class="hd"><b>1</b>梶田・10月31日</div>なぜ大きくしたのか、キャラクターの性格とのつながりも書きましょう。' },
        { span: b, tilt: 1.2, html: '<div class="hd"><b>2</b>梶田・10月31日</div>どのように確かめたか（照明を当てて試したなど）を書くと、説得力が出ます。' },
      ])
      window.__teacherSide(`<div class="hd"><b>文化　花子さん</b><small>映画・舞台衣装デザイナー コース・00ZZ0123</small></div>
        <div class="list"><h3>貼った付箋 2枚</h3>
          <div class="mk-item"><div class="top"><span class="num">1</span>本文 1ページ・10月31日・学生：まだ</div>なぜ大きくしたのか、キャラクターの性格とのつながりも…</div>
          <div class="mk-item"><div class="top"><span class="num">2</span>本文 1ページ・10月31日・学生：まだ</div>どのように確かめたか（照明を当てて試したなど）を…</div>
          <p style="margin:14px 0 0;font-size:12.5px;color:var(--muted);line-height:1.7">紙面の文をなぞると、その横に新しい付箋が出ます。書いて「貼る」と、学生のツールに届きます。</p>
        </div>`)
    })
    await wait(300)
    await shot(page, '2-teacher-fusen')
    await context.close()
  }

  // ---- ② 中（付箋の見た目）：学生（紙面の右の端に先生の付箋。直したら「直した」） ----
  if (!SPREAD) {
    const { context, page } = await openStudent(browser)
    await page.addStyleTag({ content: '.app .stage { --mk-arrows: hidden; }' })
    await page.evaluate(() => {
      const c = window.__wrap('p3', 'キーワードは自由、勇気、海である', 'mk-mark')
      const a = window.__wrap('p4', '袖は風をはらむように大きく膨らませた', 'mk-mark')
      const b = window.__wrap('p4b', '藍色の濃さは、照明の下でも黒く沈まないものを選んだ', 'mk-mark done')
      window.__notes([
        { span: c, tilt: -1.2, html: '<div class="hd"><b>3</b>梶田先生・10月31日</div>キーワードが、衣装のどこに表れているかを続けて書きましょう。<div class="acts"><button class="pri">直した</button></div>' },
        { span: a, tilt: 1.4, html: '<div class="hd"><b>1</b>梶田先生・10月31日</div>なぜ大きくしたのか、キャラクターの性格とのつながりも書きましょう。<div class="acts"><button class="pri">直した</button></div>' },
        { span: b, cls: 'done', tilt: -0.8, html: '<div class="hd"><b>2</b>直した ✓（押すと開く）</div>' },
      ])
      window.__sideSection(`<h3>先生の付箋 <span class="n">2</span></h3>
        <div class="mk-item"><div class="top"><span class="num">3</span>本文 1ページ</div>キーワードが、衣装のどこに表れているかを…<div class="acts"><button>その付箋へ</button></div></div>
        <div class="mk-item"><div class="top"><span class="num">1</span>本文 1ページ</div>なぜ大きくしたのか、キャラクターの性格との…<div class="acts"><button>その付箋へ</button></div></div>
        <div class="mk-item done"><div class="top"><span class="num">2</span>本文 1ページ・直した ✓</div>どのように確かめたかを書くと…</div>`)
    })
    await wait(300)
    await shot(page, '2-student-fusen')
    await context.close()
  }

  // ---- ② 中（付箋の見た目）：見開きのとき（学生）。付箋は、それぞれのページの右の端から出る小さなつまみ（番号）にたたむ。押すと開く ----
  if (!FUSEN || SPREAD) {
    const { context, page, ready } = await openStudent(browser)
    await page.evaluate(() => window.__editor.setView('spread'))
    await wait(600)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await wait(500)
    await page.addStyleTag({
      content: `.mk-tab { position: fixed; z-index: 32; display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 7px 0 6px; border-radius: 2px 5px 5px 2px; background: #fff4a8; border-left: 4px solid #e2c84a; color: #6b5410; font: 700 11.5px 'BIZ UDPGothic', sans-serif; box-shadow: 2px 2px 6px rgba(60,40,0,.25); }
      .mk-tab.open { background: #ffe97a; outline: 2px solid #2f3e75; }
      .mk-tab.done { background: #e1f0d9; border-left-color: #8fbf84; color: #3d6a33; }
      .mk-note.pop { transform: none !important; }`,
    })
    await page.evaluate(() => {
      const pageOf = (span) => span.closest('[data-vivliostyle-page-container]').getBoundingClientRect()
      const tab = (span, n, cls = '') => {
        const r = span.getClientRects()[0]
        const p = pageOf(span)
        const t = document.createElement('div')
        t.className = `mk-tab ${cls}`
        t.textContent = n
        t.style.left = `${p.right - 10}px`
        t.style.top = `${r.top + r.height / 2 - 12}px`
        document.body.append(t)
        return t
      }
      // 見えている2ページの段落から、2つずつ選ぶ（左のページ：1・2、右のページ：3・4）
      const report = window.__editor.getSnapshot().report
      const textOf = (id) => report.body.flatMap((c) => c.blocks).find((b) => b.id === id)?.content?.filter((n) => n.type === 'text').map((n) => n.text).join('') ?? ''
      const shown = [...document.querySelectorAll('.page-viewport.front [data-vivliostyle-page-container]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left < innerWidth && getComputedStyle(e).visibility !== 'hidden' }).sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left)
      const picks = shown.slice(0, 2).map((pg) => [...new Set([...pg.querySelectorAll('p[data-block-id]')].map((e) => e.dataset.blockId))].filter((id) => textOf(id).length > 30))
      const phrase = (id) => textOf(id).slice(0, 14)
      const left = picks[0] ?? []
      const right = picks[1] ?? []
      // 左のページ：1（開いている）。右のページ：2（直した）・3
      const a = window.__wrap(left[0], phrase(left[0]), 'mk-mark')
      const b = window.__wrap(right[0], phrase(right[0]), 'mk-mark done')
      const c = window.__wrap(right[Math.min(2, right.length - 1)], phrase(right[Math.min(2, right.length - 1)]), 'mk-mark')
      const open = tab(a, '1', 'open')
      tab(b, '2 ✓', 'done')
      tab(c, '3')
      // 開いた付箋：つまみのすぐ下に、ページに重ねて出す（ほかを押すと、またたたむ）
      const o = open.getBoundingClientRect()
      const note = document.createElement('div')
      note.className = 'mk-note pop'
      note.innerHTML = '<div class="hd"><b>1</b>梶田先生・10月31日</div>コットンサテンを選んだ理由を、照明や場面とのつながりから書きましょう。<div class="acts"><button class="pri">直した</button><button>たたむ</button></div>'
      document.body.append(note)
      note.style.left = `${o.right - 196}px`
      note.style.top = `${o.bottom + 6}px`
      window.__sideSection(`<h3>先生の付箋 <span class="n">2</span></h3>
        <div class="mk-item"><div class="top"><span class="num">1</span>本文 2ページ（左）</div>コットンサテンを選んだ理由を、照明や…<div class="acts"><button>その付箋へ</button></div></div>
        <div class="mk-item"><div class="top"><span class="num">3</span>本文 3ページ（右）</div>刺繍の模様の大きさを、どう決めたかを…<div class="acts"><button>その付箋へ</button></div></div>
        <div class="mk-item done"><div class="top"><span class="num">2</span>本文 3ページ（右）・直した ✓</div>仮縫いで確かめたことを…</div>`)
    })
    await wait(300)
    await shot(page, '2-student-spread')
    await context.close()
  }

  // ---- ③ 大：学生（先生の書き直し案を、受け入れる・受け入れない） ----
  if (!FUSEN && !SPREAD) {
    const { context, page } = await openStudent(browser)
    await page.evaluate(() => {
      const del = window.__wrap('p4', '全体を軽く見せた', 'mk-del')
      const ins = document.createElement('span')
      ins.className = 'mk-ins'
      ins.textContent = '全体の印象を軽くした'
      del.after(ins)
      window.__badge(del, 1, 'red')
      window.__float(ins, '先生の書き直し案 <button>受け入れる</button><button class="ghost">受け入れない</button>', true)
      const d2 = window.__wrap('p2', 'そのため', 'mk-del')
      const i2 = document.createElement('span')
      i2.className = 'mk-ins'
      i2.textContent = 'そこで'
      d2.after(i2)
      window.__badge(d2, 2, 'red')
      window.__sideSection(`<h3>先生の書き直し案 <span class="n" style="background:#c0392b">2</span></h3>
        <div class="mk-item"><div class="top"><span class="num red">1</span>梶田先生・10月31日</div><del>全体を軽く見せた</del> → <ins>全体の印象を軽くした</ins><div class="acts"><button class="pri">受け入れる</button><button>受け入れない</button></div></div>
        <div class="mk-item"><div class="top"><span class="num red">2</span>梶田先生・10月31日</div><del>そのため</del> → <ins>そこで</ins><div class="acts"><button class="pri">受け入れる</button><button>受け入れない</button></div></div>`)
    })
    await wait(300)
    await shot(page, '3-student')
    await context.close()
  }
})
console.log('撮りました')
