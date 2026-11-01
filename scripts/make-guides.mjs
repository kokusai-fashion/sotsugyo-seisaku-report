// 使い方の手引き（学生用・先生用・管理者用。どれも A4 片面1枚の PDF）を作る。デザインは案B「雑誌風」（mockups/v25/b.html）を
// 軽くした案C2（mockups/v26 の c2・t-c2）。くわしいことは、ツールと管理ページの「？ 使い方」に任せる。
//   1. 本物のツール（学生用ツール・管理ページの試験版）を Edge で操作して、画面の画像を撮る（docs/guide-images/g-*.jpg）。
//      番号の吹き出しを付ける場所（画面の部品の位置）も書き出す（docs/guide-images/marks.js。HTML の中の guide.js が読んで重ねる）
//   2. ツールの URL の QR コードを作る（docs/guide-images/qr-guide.svg）
//      手引きで使っていない画像も撮っている（前の版の手引きで使っていたもの。デザイン案 mockups/v26・v27 が読む）
//   3. 手引きの HTML（docs/手引き_学生用.html・手引き_先生用.html・手引き_管理者用.html。文は HTML に手で書く）を Edge で PDF にする。
//      ページ数（学生用は両面の2ページ、ほかは1ページ）・用紙からのはみ出し・文字の大きさ（本文 10.5pt 以上）・1ページの文字数（目安 400字まで）・1字だけの行・書体・画像を確かめ、
//      外れていたら失敗にする
//   4. PDF を public/guides/（student-guide.pdf・teacher-guide.pdf（先生用）・admin-guide.pdf（管理者用））に写す（GitHub Pages で公開される）
// 使い方: node scripts/make-guides.mjs            … 画面を撮り直して PDF を作る（開発サーバーが http://localhost:5173 で動いていること）
//         node scripts/make-guides.mjs --pdf-only … HTML の文だけを直したあと、PDF だけ作り直す（画面は撮り直さない）
//   自動テスト用にまとめた版（dist-e2e）で撮るとき：scripts/e2e/serveBuilt.mjs で出して（PORT=4241 node scripts/e2e/serveBuilt.mjs）、
//   APP_URL=http://localhost:4241 node scripts/make-guides.mjs（ページの中の部品は window.__import で読むので、どちらでも動く）
//   SHOTS=student（学生用ツール。スマホも）／SHOTS=admin（管理ページ） node scripts/make-guides.mjs … 画面の画像を一部だけ撮り直す
//   Edge は EDGE_PORT（ふだんは 9364）で起動する（ほかの確かめと同時に動かしてもぶつからないように）。
//   書き出した PDF を画像にするときは、この中で小さなサーバーを立てる（ポートは PDF_VIEW_PORT。なければ空いているポート）
//
// 見本の原稿：衣装コースの学生（架空の文化花子・00ZZ0123）の「シンドバッド」（2026-11-01 に組み立てを見直したもの。
// scripts/e2e/sampleSinbad.mjs：文は git に入れない gas/trial-sample.private.json から読み、写真は public/trial/ のもの）。
// 本物の Google にはつながない（学生用ツールは Google のログインとドライブを偽物 scripts/e2e/fakeGoogle.mjs に差し替え、管理ページは試験版）。
// （前の見本の原稿と、その写真 docs/guide-images/sample/ は、自動テストの見本 scripts/e2e/sampleReport.mjs が使う）
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import QRCode from 'qrcode'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { showPhoneKeyboard } from './phoneKeyboard.mjs'

// ほかの確かめと同時に動かしても Edge がぶつからないよう、別のポートを使う（edge.mjs は読み込んだときにポートを決めるので、先に決める）
process.env.EDGE_PORT ??= '9364'
const { withEdge } = await import('./poc/edge.mjs')
const { fakeDrive, routeGoogle } = await import('./e2e/fakeGoogle.mjs')
const { sinbadSample, setupSinbad, sampleText } = await import('./e2e/sampleSinbad.mjs')

const APP = process.env.APP_URL ?? 'http://localhost:5173'
/** 学生に配るツールの URL（QR コードにする。GitHub のリポジトリを移したら、ここと HTML の URL を直す） */
const TOOL_URL = 'https://kokusai-fashion.github.io/sotsugyo-seisaku-report/'
const IMG = 'docs/guide-images'
const GUIDES = [
  // 学生用は両面1枚の、具体的な使い方の版（表：はじめてから提出まで・画面の地図・自動で入るもの／裏：早見表・図と表の入れ方・スマホ）。
  // 依頼者の選択 2026-10-23：クラスルームで配る手引きは、この版にする
  { html: 'docs/手引き_学生用.html', pdf: 'docs/手引き_学生用.pdf', publish: 'public/guides/student-guide.pdf', pages: 2 },
  { html: 'docs/手引き_先生用.html', pdf: 'docs/手引き_先生用.pdf', publish: 'public/guides/teacher-guide.pdf', pages: 1 },
  { html: 'docs/手引き_管理者用.html', pdf: 'docs/手引き_管理者用.pdf', publish: 'public/guides/admin-guide.pdf', pages: 1 },
]
/**
 * 試作の手引き（依頼者に見てもらうための版。公開しない：PDF は ../試作/ に置く）。いまはない
 * （学生用の具体的な版は、2026-10-23 に試作から学生用の手引きにした）
 */
const DRAFTS = []
/** 本文の文字の大きさの下限（pt）。柱・ページ番号・英字の飾りの見出し（MIN_EXEMPT）は除く */
const MIN_PT = 10.5
const MIN_EXEMPT = '.folio, .edge, .hero-top, .kick2, .year, .shot .mk, .lh .k'
/** 1ページの文字数の上限（学生は長い文を読まないため）。数えるのは、ひらがな・カタカナ・漢字と全角の記号（英数字・URL は数えない） */
// 1ページの字数の目安（依頼者の決まりではなく、軽く読める量の目安。少し超えるのはよい：依頼者 2026-10-26）。
// MAX_CHARS を超えたら知らせるだけにし、MAX_CHARS_HARD を超えたら失敗にする（学生用の裏は、2026-11-01 に「困った・おかしい」の行と
// 「使い方を AI に聞く」の一文が入って 433字）
const MAX_CHARS = 400
const MAX_CHARS_HARD = 450
const JP = /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/g
const pdfOnly = process.argv.includes('--pdf-only')
/** --draft：試作の手引き（DRAFTS）だけを PDF にする（ふだんの手引きは作らない） */
const draftOnly = process.argv.includes('--draft')
const SHOT_ONLY = (process.env.SHOTS ?? '').split(',').filter(Boolean)
const doShot = (k) => !SHOT_ONLY.length || SHOT_ONLY.includes(k)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PC = { width: 1440, height: 900, deviceScaleFactor: 2 }
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
/** 見本の学生のアカウント（架空。@ より前が学籍番号） */
const STUDENT_EMAIL = '00zz0123@bunka-wu.ac.jp'
mkdirSync(IMG, { recursive: true })
mkdirSync('poc-output/guides', { recursive: true })
mkdirSync('public/guides', { recursive: true })

// =====================================================================
// 見本の原稿「シンドバッド」（scripts/e2e/sampleSinbad.mjs。文は git に入れないファイルから読み、ここには書き写さない）
// =====================================================================

/** 見本の原稿（{ report, images }）。ログインしてコースを選んだあとの学生用ツールで page.evaluate(setupSinbad, SAMPLE) */
const SAMPLE = sinbadSample()

/**
 * 「セルフチェック」の画像のために、わざと入れる誤り（「見頃」「記事」「です」）。
 * 図・表を参照していない段落（CHECK_ID：ブラウスの袖の段落）に入れる（ほかの指摘が出ないように）。撮ったら、もとの中身に戻す
 */
const CHECK_ID = 'p5'
// 段落の最初の文は見本のまま（実行のときに読む）。そのあとに、誤りを入れた文を足す
const CHECK_TEXT = sampleText(SAMPLE, CHECK_ID).split('。')[0] + '。袖の内側には軽いシルクシフォンを重ねた。袖の記事が重いと、前見頃が引っ張られて形が崩れるためです。'
/** 書いているところ・画面全体・スマホで書くところを撮る段落（デザイン説明。すぐ下にデザイン画） */
const WRITE_ID = 'p2'
/** 別の端末（スマホ）で書き足す段落と、そのあとパソコンで書き足す段落（まとめ）。書き足す文は、見本の原稿の段落の後ろに付ける */
const PHONE_ID = 'p14'
const PC_ID = 'p13'
const PC_ADD = '着替えの順番は、紙にまとめて楽屋の壁に貼った。'
const PC_ADD2 = '次の公演では、留め具をはじめから付けておきたい。'
/** 図の入れ方の3コマ：本文の最初の段落（担当衣装のキャラクター）の終わりに入れる写真（public/trial/）と、打つタイトル */
const FIGURE_FILE = 'public/trial/w-stage.jpg'
const FIGURE_CAPTION = '劇中のシンドバッド'
/** 薄い字（ひな形の「何を書くか」）の段落を仮に足す場所（この段落のすぐ後ろ。デザイン説明）と、その説明 */
const HINT_AFTER = 'p2'
const HINT_TEXT = 'デザインのもとにした資料と、そこから取り入れたところを書く'
/** 紙面をなぞって選ぶ、図をはさまずに続いた2つの段落（ブラウスの最初の2段落） */
const RANGE_FROM = 'p4'
const RANGE_TO = 'p5'
/** 図を押したときの道具を撮る図（ブラウス前・後ろの2枚並び r2 の左。すぐ下に袖の刺繍の図が続く） */
const TOOLS_FIGURE = 'f2'

// =====================================================================
// 画面の画像
// =====================================================================

/** 撮影のじゃまになるもの（別のタブの知らせ・はじめての案内）を出さない（.guide は、案内を撮るときだけ出す） */
const SHOT_CSS = `
  .login-over.tab-locked { display: none !important; }
  .no-guide .guide { display: none !important; }
`

/**
 * 撮影のあいだに src/ が直されても、画面が入れ替わらないようにする（開発サーバーの即時反映をつながない）。
 * はじめての案内のあとに出る指差し確認（ツアー）は、見たことにしておく（出ると画面が覆われ、撮影が先へ進めない）
 */
const noHotReload = (page) =>
  page.evaluateOnNewDocument(() => {
    const Real = window.WebSocket
    window.WebSocket = function (url, protocols) {
      if (String(protocols).includes('vite-hmr')) return { readyState: 0, addEventListener() {}, removeEventListener() {}, send() {}, close() {} }
      return new Real(url, protocols)
    }
    try {
      localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done')
    } catch {}
  })

const ready = (page, phone = false) =>
  page.waitForFunction(
    (phone) => {
      const s = window.__editor?.getSnapshot()
      return s?.layout && (!phone || s.sheet !== undefined) && !s.rendering && !s.turning && !document.querySelector('.loading')
    },
    { timeout: 120000 },
    phone,
  )

/** ドライブへの保存が済むまで待つ（右の欄・スマホの上の帯の「ドライブに保存 13:44」） */
const driveSaved = (page) =>
  page.waitForFunction(() => [...document.querySelectorAll('.chip.ok')].some((c) => /ドライブに保存|\d+:\d+/.test(c.textContent)) && !document.querySelector('.chip .dot.busy'), { timeout: 60000 })

/**
 * ページの中で、画像の下の端 y が紙面（root）の字の行や図（写真とタイトル）の途中にかかるなら、その手前（3px 上）の y を返す
 * （画像の下の端で、行の字や図が半分だけ写らないように）。down なら、逆に、かかっているものの下の端（3px 下）まで伸ばす
 */
function lineSafeBottom(root, y, down = false) {
  let best = y
  const el = document.querySelector(root)
  const boxes = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue
    range.selectNodeContents(n)
    boxes.push(...range.getClientRects())
  }
  for (const f of el.querySelectorAll('figure, img')) boxes.push(f.getBoundingClientRect())
  for (const r of boxes) if (r.height && r.top < y && r.bottom > y) best = down ? Math.max(best, r.bottom + 3) : Math.min(best, r.top - 3)
  return best
}

/** ページの中で、最初の1つの要素の位置を測る */
function rectFirst(sel) {
  const e = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0)
  if (!e) return null
  const r = e.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

/** ページの中で、要素の位置を測る（いくつかなら、それらを囲む範囲。text があれば、その文字を含むものだけ） */
function rectOf(sel, text) {
  const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0 && (!text || e.textContent.includes(text)))
  if (!els.length) return null
  const rs = els.map((e) => e.getBoundingClientRect())
  const x = Math.min(...rs.map((r) => r.left))
  const y = Math.min(...rs.map((r) => r.top))
  return { x, y, w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y }
}

const pad = (r, px, py = px) => ({ x: r.x - px, y: r.y - py, w: r.w + px * 2, h: r.h + py * 2 })
const union = (...rs) => {
  rs = rs.filter(Boolean)
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}
const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
const clickText = (page, selector, text) => page.evaluate((selector, text) => [...document.querySelectorAll(selector)].find((b) => b.textContent.includes(text)).click(), selector, text)

/** 番号の吹き出しの場所（marks.js に書き出す。前に撮った分は残し、撮り直した分だけ入れ替える） */
const MARKS_FILE = `${IMG}/marks.js`
const MARKS = existsSync(MARKS_FILE) ? JSON.parse(readFileSync(MARKS_FILE, 'utf8').replace(/^[^=]*=\s*/, '').replace(/;\s*$/, '')) : {}
// 前の版で撮っていた画像（今の画面にはないので、もう撮らない）：下書きの PDF の窓・管理ページの前の見出しの欄
for (const old of ['g-export-draft', 'g-admin-draft']) delete MARKS[old]
const writeMarks = () =>
  writeFileSync(
    MARKS_FILE,
    `// node scripts/make-guides.mjs が書き出す（手で直さない）。画面の画像の大きさと、番号の吹き出しを付ける部品の場所（画像の中の %）\nwindow.GUIDE_MARKS = ${JSON.stringify(MARKS, null, 1)};\n`,
  )

/**
 * 画面を切り抜いて撮り（docs/guide-images/<name>.jpg）、吹き出しの番号の場所を書き出す。
 * clip：切り抜く範囲（CSS px）。marks：[{ n, box（部品の範囲）, at：吹き出しを置く側（l・r・t・b・tl・tr・bl・br・c・ol）, dx, dy（px） }]
 * optional：見つからなくてもよい印（画面が変わりやすい部品。見つからなければ、その番号は付けない）
 */
async function capture(page, name, clip, marks = []) {
  for (const m of marks) if (!m.box && m.optional) console.log(`  （${name}：${m.n} の場所が見つからないので、番号を付けません）`)
  marks = marks.filter((m) => m.box || !m.optional)
  const vp = page.viewport()
  const x = Math.max(0, Math.round(clip.x))
  const y = Math.max(0, Math.round(clip.y))
  const c = { x, y, width: Math.min(vp.width, Math.round(clip.x + clip.w)) - x, height: Math.min(vp.height, Math.round(clip.y + clip.h)) - y }
  // captureBeyondViewport を切る：切ると、撮るときに画面の大きさが一時的に変わらない（変わると、紙面や見本が作り直されて白く写る）
  await page.screenshot({ path: `${IMG}/${name}.jpg`, type: 'jpeg', quality: 88, clip: c, captureBeyondViewport: false })
  const pct = (v, s) => +((v / s) * 100).toFixed(2)
  for (const m of marks) if (!m.box) throw new Error(`${name}：${m.n} の場所が見つかりません（ツールの画面が変わったかもしれません）`)
  MARKS[name] = {
    w: c.width,
    h: c.height,
    marks: marks.map(({ n, box, at = 'l', dx = 0, dy = 0 }) => ({
      n,
      at,
      dx: pct(dx, c.width),
      dy: pct(dy, c.height),
      box: { x: pct(box.x - c.x, c.width), y: pct(box.y - c.y, c.height), w: pct(box.w, c.width), h: pct(box.h, c.height) },
    })),
  }
  writeMarks()
  console.log(`  ${IMG}/${name}.jpg  (${c.width}×${c.height})`)
}

/** 学生用ツールを、偽物の Google につないで開く（ログインはまだ）。phone：スマホの画面 */
async function openTool(browser, drive, config, { phone = false, context } = {}) {
  context ??= await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => d.accept())
  await noHotReload(page)
  if (phone) await page.setUserAgent(PHONE_UA)
  await page.setViewport(phone ? PHONE : PC)
  await routeGoogle(page, drive, config)
  await page.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.addStyleTag({ content: SHOT_CSS })
  return { context, page }
}

const goToBlock = async (page, id, phone = false) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await sleep(300)
  await ready(page, phone)
}

/** スマホの紙面の段落 id の、i 文字目（見ているページ）を指で押す（字の左寄りを押す） */
async function tapChar(page, id, i) {
  const pt = await page.evaluate(
    (id, i) => {
      const el = [...document.querySelectorAll(`.page-viewport.front [data-block-id="${id}"]`)].find((e) => e.getBoundingClientRect().width > 0)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let acc = 0
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (i < acc + n.length) {
          const range = document.createRange()
          range.setStart(n, i - acc)
          range.setEnd(n, i - acc + 1)
          const r = [...range.getClientRects()].find((x) => x.height > 0)
          return { x: r.left + r.width * 0.25, y: (r.top + r.bottom) / 2 }
        }
        acc += n.length
      }
      throw new Error(`${id} の ${i} 文字目がありません`)
    },
    id,
    i,
  )
  await page.touchscreen.tap(pt.x, pt.y)
}

/** スマホのキーボードを仮に出す（iPhone のキーボードの絵を置き、見えている所 visualViewport を低くする。phoneKeyboard.mjs） */
const fakeKeyboard = (page, on) => showPhoneKeyboard(page, on)

/** 押したボタンなどに残る、選んでいる印（青い枠）を消す */
const unfocus = (page) => page.evaluate(() => document.activeElement?.blur())

/** 段落を開いて書き始める（caret：カーソルを置く文字の位置） */
const openBlock = async (page, id, caret) => {
  await goToBlock(page, id)
  await page.evaluate((id, caret) => window.__editor.openWhenReady(id, caret), id, caret)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 30000 }, id)
  await sleep(500)
}

/** 段落の文を書き換える */
const setParagraph = (page, id, text) =>
  page.evaluate(
    (id, text) =>
      window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, content: [{ type: 'text', text }] } : b)) })) })),
    id,
    text,
  )
/** 段落の中身（文と図・表の参照）を、そのまま返す・置き換える（わざと入れた誤りを、もとの文に戻すため） */
const getContent = (page, id) => page.evaluate((id) => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.id === id).content, id)
const setContent = (page, id, content) =>
  page.evaluate((id, content) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, content } : b)) })) })), id, content)
/** 段落の後ろに文を足す（ページの中で動かす。見本の原稿の文は、スクリプトに書き写さない） */
function appendText(id, text) {
  window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, content: [...b.content, { type: 'text', text }] } : b)) })) }))
}

/**
 * 書き出した PDF の1ページを、pdf.js（node_modules/pdfjs-dist）で描いて JPEG にする（out。page：0 から）。
 * pdf.js とその PDF は、ここで立てる小さなサーバーから読む（開発サーバーの poc-pdf.html を使わない。まとめた版でも撮れるように）
 */
async function pdfPageToJpeg(browser, pdfPath, pageIndex, scale, out) {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888"><script type="module">
import * as pdfjs from '/pdfjs/pdf.mjs'
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs'
const doc = await pdfjs.getDocument({ url: '/doc.pdf' }).promise
const page = await doc.getPage(${pageIndex + 1})
const viewport = page.getViewport({ scale: ${scale} })
const canvas = document.createElement('canvas')
canvas.width = viewport.width
canvas.height = viewport.height
document.body.append(canvas)
// intent: 'print' は描画に requestAnimationFrame を使わないため、画面が隠れていても止まらない
await page.render({ canvas, viewport, intent: 'print' }).promise
document.body.dataset.rendered = 'true'
</script>`
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (path === '/') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
    if (path === '/doc.pdf') return res.writeHead(200, { 'Content-Type': 'application/pdf' }).end(readFileSync(pdfPath))
    if (path === '/pdfjs/pdf.mjs' || path === '/pdfjs/pdf.worker.mjs') return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(readFileSync(join('node_modules/pdfjs-dist/build', basename(path))))
    res.writeHead(404).end()
  })
  await new Promise((ok, fail) => {
    server.once('error', fail)
    server.listen(Number(process.env.PDF_VIEW_PORT ?? 0), 'localhost', ok)
  })
  const view = await browser.newPage()
  try {
    await view.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 1 })
    await view.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'networkidle0' })
    await view.waitForFunction(() => document.body.dataset.rendered === 'true', { timeout: 120000 })
    const canvas = await view.$('canvas')
    await canvas.screenshot({ path: out, type: 'jpeg', quality: 88 })
    return await canvas.evaluate((c) => ({ w: c.width, h: c.height }))
  } finally {
    await view.close()
    server.close()
  }
}

async function studentShots(browser, config) {
  const drive = fakeDrive(STUDENT_EMAIL)
  const { context, page } = await openTool(browser, drive, config)
  await ready(page)

  // ---- ログインの窓（Google のログインの部品は偽物） ----
  await page.waitForSelector('.login-over .login-btn')
  await sleep(500)
  // 開いたときにログインのボタンが選ばれていて、黄色い枠が付くので、外してから撮る
  await unfocus(page)
  await sleep(200)
  await capture(page, 'g-login', pad(await page.evaluate(rectOf, '.login-card'), 16), [{ n: 1, box: await page.evaluate(rectOf, '.login-card .login-btn'), at: 'r' }])
  await page.click('.login-btn')
  await page.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 60000 })

  // ---- はじめての案内：コースを選ぶ → Word で書き始めているか → 表紙（学籍番号はアカウントから入るので、氏名から） ----
  await page.waitForSelector('.guide.step-course .g-opts button')
  await sleep(900)
  await capture(page, 'g-course', pad(await page.evaluate(rectOf, '.g-tip'), 14), [{ n: 1, box: await page.evaluate(rectOf, '.g-opts button', '映画・舞台衣装'), at: 'r' }])
  await clickText(page, '.guide .g-opts button', '映画・舞台衣装')
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await ready(page)
  await sleep(900)
  await capture(page, 'g-word', pad(await page.evaluate(rectOf, '.g-tip'), 14), [
    { n: 1, box: await page.evaluate(rectOf, '.g-word-opt.yes'), at: 'r' },
    { n: 2, box: await page.evaluate(rectOf, '.g-word-opt.no'), at: 'r' },
  ])
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:name', { timeout: 30000 })
  await sleep(500)
  // 氏名を書いているところ（学籍番号は、ログインしたアカウントから入っている）
  await page.keyboard.type('文化　花子')
  await sleep(900)
  {
    const fields = await page.evaluate(rectOf, `${CUR} [data-block-id="basic:course"], ${CUR} [data-block-id="basic:studentId"], .overlay-clip:not([hidden]) .overlay-editor`)
    const tip = await page.evaluate(rectOf, '.g-tip')
    const paper = await page.evaluate(rectOf, CUR)
    const area = union(fields, tip)
    await capture(page, 'g-cover', { x: paper.x + 20, y: area.y - 24, w: paper.w - 40, h: area.h + 40 }, [
      { n: 1, box: await page.evaluate(rectOf, `${CUR} [data-block-id="basic:studentId"]`), at: 'r' },
      { n: 2, box: await page.evaluate(rectOf, '.overlay-clip:not([hidden]) .overlay-editor'), at: 'r' },
    ])
  }
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:subtitleInput', { timeout: 30000 })
  await page.keyboard.type('シンドバッド')
  await sleep(500)
  await page.keyboard.press('Enter')
  await page.waitForSelector('.guide.step-done')
  await page.evaluate(() => [...document.querySelectorAll('.g-actions button')].find((b) => b.textContent.includes('閉じる')).click())
  await ready(page)
  await page.evaluate(() => document.documentElement.classList.add('no-guide'))

  // ---- 見本の原稿にする ----
  await page.evaluate(setupSinbad, SAMPLE)
  await sleep(800)
  await ready(page)
  await driveSaved(page)
  const info = await page.evaluate(() => {
    const s = window.__editor.getSnapshot()
    return { bodyPages: s.layout.bodyPages, abstractLines: s.layout.abstractLines, findings: s.findings.map((f) => `${f.severity}:${f.title}`) }
  })
  console.log(`  見本の原稿：本文 ${info.bodyPages}ページ・抄録 ${info.abstractLines}行・指摘 ${info.findings.length}件${info.findings.length ? `（${info.findings.join('、')}）` : ''}`)
  if (info.findings.some((f) => f.startsWith('error'))) throw new Error('見本の原稿にエラーが残っています（提出用の PDF の画面が撮れません）')

  // ---- PDF を書き出す窓（直すところ・まだのところが0のとき） ----
  // （PDF はツールの中で作って保存する。「PDF を保存する」が押せるところ。3つのチェックと下書きは、依頼者の判断でなくした。2026-10-19）
  await page.evaluate(() => document.querySelector('.side .export').click())
  await page.waitForSelector('.modal .pdf-start')
  await page.evaluate(() => document.activeElement?.blur())
  await sleep(500)
  await capture(page, 'g-export', await page.evaluate(rectOf, '.modal'), [
    { n: 1, box: await page.evaluate(rectOf, '.modal .pdf-file'), at: 'l' },
    { n: 2, box: await page.evaluate(rectOf, '.modal .row-buttons button.primary'), at: 'l' },
  ])
  await page.evaluate(() => document.querySelector('.modal .close').click())

  // ---- 学生が書き出した PDF（教員用：途中点検で印刷して見る）。本文の1ページ目を画像にする（画像の名前は前の「下書き」のときのまま） ----
  {
    const bodyPage = await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.indexOf('body'))
    await page.evaluate(() => {
      document.title = window.__editor.pdfTitle
    })
    await page.pdf({ path: 'poc-output/guides/draft.pdf', preferCSSPageSize: true, printBackground: true })
    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    const size = await pdfPageToJpeg(browser, 'poc-output/guides/draft.pdf', bodyPage, 1.6, `${IMG}/g-draft-page.jpg`)
    MARKS['g-draft-page'] = { w: size.w, h: size.h, marks: [] }
    writeMarks()
    console.log(`  ${IMG}/g-draft-page.jpg（書き出した PDF の ${bodyPage + 1}ページ目）`)
    await page.bringToFront()
  }

  // ---- 抄録：先生の許可が出るまでは、案内と「先生の許可が出た」ボタン ----
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: false } })))
  await sleep(500)
  await ready(page)
  await page.evaluate(() => window.__editor.goToArea('abstract'))
  await sleep(900)
  await ready(page)
  {
    const box = await page.evaluate(rectOf, `${CUR} [data-abstract-start]`)
    const lock = await page.evaluate(rectOf, `${CUR} .abstract-lock`)
    const head = await page.evaluate(rectOf, CUR)
    await capture(page, 'g-abstract', { x: lock.x - 24, y: head.y + 60, w: lock.w + 48, h: lock.y + lock.h - head.y - 60 + 20 }, [{ n: 1, box, at: 'r' }])
  }
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: true } })))
  await sleep(500)
  await ready(page)

  // ---- セルフチェック：わざと誤りを入れる（エラー・警告・押すとその箇所へ移る指摘・「このままにする（確認済み）」）。「直す」のボタンはない（学生が自分で直す） ----
  const checkOriginal = await getContent(page, CHECK_ID)
  await setParagraph(page, CHECK_ID, CHECK_TEXT)
  await sleep(500)
  await ready(page)
  await driveSaved(page)
  console.log(`  わざと入れた誤りの指摘：${(await page.evaluate(() => window.__editor.getSnapshot().findings.map((f) => `${f.severity}:${f.title}`))).join('、')}`)
  await goToBlock(page, WRITE_ID)
  await page.mouse.move(5, 5)
  await sleep(600)
  // PC の画面全体（表紙の絵・教員用の「学生の画面」）
  await capture(page, 'g-pc-full', { x: 0, y: 0, w: PC.width, h: PC.height }, [
    { n: 1, box: await page.evaluate(rectOf, '.thumbs-col'), at: 'c' },
    { n: 2, box: await page.evaluate(rectOf, '.palette'), at: 'b' },
    { n: 3, box: await page.evaluate(rectOf, CUR), at: 'tl', dx: 26, dy: 26 },
    { n: 4, box: await page.evaluate(rectOf, '.side .drive-chip-wrap .chip'), at: 'b' },
    { n: 5, box: await page.evaluate(rectOf, '.side .sec.check .sec-h'), at: 'l' },
    { n: 6, box: await page.evaluate(rectOf, '.side .export'), at: 'l' },
  ])
  {
    // 指摘の一覧が欄の中で切れないよう、この画像だけ画面を縦に長くして撮る
    await page.setViewport({ ...PC, height: 1200 })
    await sleep(800)
    await ready(page)
    const sec = await page.evaluate(rectOf, '.side .sec.check')
    const issues = await page.evaluate(rectOf, '.side .sec.check .igroup')
    await capture(page, 'g-check', { x: sec.x, y: sec.y, w: sec.w, h: issues.y + issues.h - sec.y + 6 }, [
      { n: 1, box: await page.evaluate(rectFirst, '.side .issue.error .dot'), at: 'l' },
      { n: 2, box: await page.evaluate(rectFirst, '.side .issue.warning .dot'), at: 'l' },
      // 3：指摘の題（押すと、その箇所へ移る）
      { n: 3, box: await page.evaluate(rectFirst, '.side .issue.error .go .ttl'), at: 'r' },
      { n: 4, box: await page.evaluate(rectFirst, '.side .issue .keep'), at: 'l' },
    ])
    await page.setViewport(PC)
    await sleep(800)
    await ready(page)
  }
  // わざと入れた誤りを戻す（このあとの画像に、指摘が写らないように）
  await setContent(page, CHECK_ID, checkOriginal)
  await sleep(500)
  await ready(page)

  // ---- 書く：段落を書いているところ（道具と紙面の上半分） ----
  await openBlock(page, WRITE_ID, 999)
  {
    const palette = await page.evaluate(rectOf, '.palette')
    const paper = await page.evaluate(rectOf, CUR)
    const figure = await page.evaluate(rectOf, `${CUR} figure[data-figure-id]`)
    const editor = await page.evaluate(rectOf, '.overlay-clip:not([hidden]) .overlay-editor')
    const tool = (label) => page.evaluate(rectOf, '.palette .tb', label)
    await capture(page, 'g-write', { x: palette.x - 18, y: 0, w: paper.x + paper.w + 18 - (palette.x - 18), h: figure.y + figure.h + 14 }, [
      { n: 1, box: editor, at: 'l', dy: -editor.h / 2 + 12 },
      { n: 2, box: await tool('図を入れる'), at: 'r' },
      { n: 3, box: await tool('表を入れる'), at: 'r' },
      { n: 4, box: union(await tool('小見出し'), await tool('大見出し')), at: 'r' },
      // 「元に戻す」は左の道具のいちばん下（mockups/v65 案B）。この絵では印は付けない（裏の画面の地図の 7）
    ])
  }
  await page.keyboard.press('Escape')
  await sleep(400)
  await ready(page)

  // ---- 裏面「主な使い方」の画像（依頼者の選択 2026-10-23 案A：図・表・見出しと改ページ・自動で入るもの・作品写真・スマホ） ----
  await page.mouse.move(5, 5)
  // 図：本文の「（図1）」と、すぐ下の図とタイトル（番号は自動で入る）。字が読めるよう、本文の左から図の右までに絞る
  {
    const ref = await page.evaluate(rectFirst, `${CUR} .fig-ref`)
    const para = await page.evaluate((cur) => {
      const r = document.querySelector(`${cur} .fig-ref`).closest('[data-block-id]').getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    }, CUR)
    const img = await page.evaluate(rectFirst, `${CUR} figure[data-figure-id] img`)
    const caption = await page.evaluate(rectFirst, `${CUR} figure[data-figure-id] figcaption`)
    const x = para.x - 10
    const y = ref.y - ref.h - 8
    await capture(page, 'g-figure', { x, y, w: Math.max(img.x + img.w, caption.x + caption.w) + 18 - x, h: caption.y + caption.h + 10 - y }, [
      { n: 1, box: ref, at: 'r' },
      { n: 2, box: caption, at: 'r' },
    ])
  }
  // 見出し・改ページ：左の道具の上の方（大見出し・小見出し・改ページ）
  {
    const palette = await page.evaluate(rectOf, '.palette')
    const tool = (label) => page.evaluate(rectOf, '.palette .tb', label)
    const pb = await tool('改ページ')
    await capture(page, 'g-heading', { x: palette.x - 10, y: palette.y - 10, w: palette.w + 20, h: pb.y + pb.h + 12 - (palette.y - 10) }, [
      { n: 1, box: union(await tool('大見出し'), await tool('小見出し')), at: 'r' },
      { n: 2, box: pb, at: 'r' },
    ])
  }
  // 表：紙面の素材表（タイトルの番号は自動）
  {
    const tableId = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table').id)
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), tableId)
    await sleep(600)
    await ready(page)
    // 手引きの3コマの枠に収まるよう、生地見本の入った行は上から3行まで写す（見本の表は6行あり、縦に長すぎるため）
    // 上は、すぐ上の段落の行が半分写らないよう、余白を小さく
    const t0 = await page.evaluate(rectOf, `${CUR} .data-table`)
    const table = { ...pad(t0, 12), y: t0.y - 3, h: t0.h + 15 }
    const rowsBottom = await page.evaluate((cur) => {
      const rows = [...document.querySelectorAll(`${cur} .data-table tr`)].filter((tr) => tr.querySelector('img'))
      return rows.length > 3 ? rows[2].getBoundingClientRect().bottom + 2 : null
    }, CUR)
    await capture(page, 'g-table', rowsBottom ? { ...table, h: rowsBottom - table.y } : table, [{ n: 1, box: await page.evaluate(rectOf, `${CUR} .data-table .table-caption`), at: 'r' }])
  }
  // 自動で入るもの：目次（見出しとページ番号から自動で作る）
  {
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('toc'), 'none'))
    await sleep(600)
    await ready(page)
    // ページを送ると、目次の最初の行に選んだ印（「→ 見出しへ」）が出るので、外してから撮る
    await page.evaluate(() => document.activeElement?.blur())
    await page.mouse.move(5, 5)
    await sleep(300)
    await capture(page, 'g-toc', pad(await page.evaluate(rectOf, `${CUR} .toc`), 14))
  }
  // 作品写真：作品写真のページ
  {
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await sleep(600)
    await ready(page)
    await capture(page, 'g-photos', await page.evaluate(rectOf, CUR))
  }
  await goToBlock(page, WRITE_ID)

  // ---- 保存のようす（右の欄の「ドライブに保存」を押したところ） ----
  await page.mouse.move(5, 5)
  await page.click('.side .drive-chip-wrap .chip')
  await page.waitForSelector('.drive-pop')
  await sleep(300)
  {
    const head = await page.evaluate(rectOf, '.side .side-head')
    const pop = await page.evaluate(rectOf, '.drive-pop')
    // 窓のうしろの右の欄（セルフチェック）の字が、窓の端から少し見えるので、撮るあいだだけ隠す。右の端は、窓の右の端まで
    await page.evaluate(() => document.querySelectorAll('.side .sec').forEach((e) => e.style.setProperty('visibility', 'hidden')))
    const clip = union(head, pad(pop, 10))
    await capture(page, 'g-drive', { ...clip, w: pop.x + pop.w + 4 - clip.x }, [
      { n: 1, box: await page.evaluate(rectOf, '.side .drive-chip-wrap .chip'), at: 'l' },
      { n: 2, box: await page.evaluate(rectOf, '.drive-pop button', 'この端末から原稿を消す'), at: 'l' },
    ])
    await page.evaluate(() => document.querySelectorAll('.side .sec').forEach((e) => e.style.removeProperty('visibility')))
  }
  await page.keyboard.press('Escape')
  await sleep(300)

  // ---- バックアップ（自動の控え） ----
  // 開いたときの控えがまだないとき（同じ原稿の控えは残さないため）は、いまの見本の原稿の控えを1つ置く（一覧が空にならないように）
  await page.evaluate(async () => {
    const { saveSnapshot, listSnapshots } = await window.__import('model/storage.ts')
    if (!(await listSnapshots()).length) await saveSnapshot(window.__editor.getSnapshot().report, new Date(Date.now() - 5 * 60000).toISOString())
  })
  // 「バックアップ・作り直す」は右の欄の「メニュー」の中（mockups/v37 案C）
  await page.click('.side .menu-btn')
  await page.waitForSelector('.side .head-menu')
  await page.evaluate(() => [...document.querySelectorAll('.side .head-menu [role="menuitem"]')].find((b) => b.textContent.includes('バックアップ')).click())
  await page.waitForSelector('.modal .snapshots, .modal .muted')
  await page.evaluate(() => document.activeElement?.blur())
  await sleep(400)
  await capture(page, 'g-backup', await page.evaluate(rectOf, '.modal'), [{ n: 1, box: await page.evaluate(rectOf, '.modal h3'), at: 'l' }])
  await page.evaluate(() => document.querySelector('.modal .close').click())

  // ---- スマホ：同じアカウントでログインすると、ドライブの原稿が開く ----
  const phone = await openTool(browser, drive, config, { phone: true })
  const pp = phone.page
  await ready(pp, true)
  await pp.waitForSelector('.login-btn')
  await pp.tap('.login-btn')
  await pp.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 90000 })
  await ready(pp, true)
  await pp.evaluate(() => document.documentElement.classList.add('no-guide'))
  // 偽物のドライブは写真（バイナリ）を正しく受け渡せないので、スマホにも同じ見本の原稿と写真を入れ直して、紙面を組み直す
  await pp.evaluate(setupSinbad, SAMPLE)
  await sleep(800)
  await ready(pp, true)
  await driveSaved(pp)
  // 紙面の段落をタップすると、紙面が広がって、その場で書ける。キーボードのすぐ上に細い道具
  // はじめて書くときの「字を大きくするには」の知らせは写さない（紙面が隠れるため。使い方の写真と同じ）
  await pp.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await goToBlock(pp, WRITE_ID, true)
  await tapChar(pp, WRITE_ID, 14)
  await pp.waitForFunction((id) => window.__editor.getSnapshot().editingId === id && window.__editor.getSnapshot().zoomed, { timeout: 30000 }, WRITE_ID)
  await sleep(900)
  await fakeKeyboard(pp, true)
  await sleep(700)
  await capture(pp, 'g-phone-write', { x: 0, y: 0, w: PHONE.width, h: PHONE.height }, [{ n: 1, box: await pp.evaluate(rectOf, '.direct-bar'), at: 't' }])
  await fakeKeyboard(pp, false)
  await pp.evaluate(() => window.__editor.finishEditing())
  await sleep(600)
  await pp.click('.p-top .icon-btn')
  await pp.waitForSelector('.sheet .sheet-body')
  await sleep(600)
  await capture(pp, 'g-phone-menu', { x: 0, y: 0, w: PHONE.width, h: PHONE.height }, [
    { n: 1, box: await pp.evaluate(rectOf, '.sheet .drive-pop button', 'この端末から原稿を消す'), at: 'l' },
    // 「使い方」のボタン（その下の「使い方を AI に聞く」は含めない）
    { n: 2, box: await pp.evaluate(rectOf, '.sheet .sheet-body a:not(.ai-btn), .sheet .sheet-body button', '使い方'), at: 'r', optional: true },
  ])
  await pp.click('.sheet-close')
  await sleep(400)

  // ---- 別の端末（スマホ）が後から保存していた：パソコンで書くと、どちらで続けるかを聞く ----
  await pp.evaluate(appendText, PHONE_ID, '（スマホで書き足した）')
  await sleep(1500)
  await driveSaved(pp)
  await page.bringToFront()
  await page.evaluate(appendText, PC_ID, PC_ADD)
  await page.waitForSelector('.drive-two', { timeout: 60000 })
  await page.evaluate(() => document.activeElement?.blur())
  await sleep(500)
  await capture(page, 'g-conflict', await page.evaluate(rectOf, '.modal'), [
    { n: 1, box: await page.evaluate(rectOf, '.modal .row-buttons button', 'この端末の原稿で続ける'), at: 'b' },
    { n: 2, box: await page.evaluate(rectOf, '.modal .row-buttons button', 'ドライブの原稿を開く'), at: 'b' },
  ])
  // （この端末の原稿で続ける：ドライブの原稿を開くと、写真を偽物のドライブから読むことになるため）
  await clickText(page, '.modal button', 'この端末の原稿で続ける')
  await page.waitForFunction(() => !document.querySelector('.drive-two'), { timeout: 60000 })
  await ready(page)
  await phone.context.close()

  // ---- 1時間たって Google の許可が切れたとき ----
  drive.failNext = 401
  await page.evaluate(appendText, PC_ID, PC_ADD2)
  await page.waitForFunction(() => [...document.querySelectorAll('.modal h2')].some((h) => h.textContent.includes('もう一度ログイン')), { timeout: 60000 })
  await page.evaluate(() => document.activeElement?.blur())
  await sleep(400)
  await capture(page, 'g-relogin', await page.evaluate(rectOf, '.modal'), [{ n: 1, box: await page.evaluate(rectOf, '.modal .row-buttons button.primary'), at: 'l' }])
  await clickText(page, '.modal button', 'ログインし直す')
  await driveSaved(page)

  // ---- 同じパソコンで2つめのタブを開いたとき ----
  {
    const second = await context.newPage()
    await noHotReload(second)
    await second.setViewport(PC)
    await routeGoogle(second, drive, config)
    await second.goto(`${APP}/`, { waitUntil: 'networkidle0', timeout: 90000 })
    await second.waitForSelector('.login-over.tab-locked .login-card', { timeout: 60000 })
    await second.evaluate(() => document.activeElement?.blur())
    await sleep(600)
    await capture(second, 'g-tablock', await second.evaluate(rectOf, '.login-over.tab-locked .login-card'), [{ n: 1, box: await second.evaluate(rectOf, '.login-over.tab-locked .login-btn'), at: 'r' }])
    await second.close()
  }
  await context.close()
}

/**
 * 管理ページ（試験版）を開く。as：teacher なら先生の画面（試験版の管理者・先生のアドレスは example.ac.jp）。
 * 管理ページは mockups/v43 案B：左の見出し（年度の設定・コース・書き方のチェック・先生の登録・変更履歴・詳細設定）と、選んだ区切り
 */
/** 紙面（見ているページ）の欄 id の i 文字目の、画面の上の点（字の真ん中） */
const charPoint = (page, id, i) =>
  page.evaluate(
    (cur, id, i) => {
      const el = [...document.querySelectorAll(`${cur} [data-block-id="${id}"]`)].find((e) => e.getBoundingClientRect().width > 0)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let acc = 0
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (i < acc + n.length) {
          const range = document.createRange()
          range.setStart(n, i - acc)
          range.setEnd(n, i - acc + 1)
          const r = [...range.getClientRects()].find((x) => x.height > 0)
          return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }
        }
        acc += n.length
      }
      throw new Error(`${id} の ${i} 文字目がありません`)
    },
    CUR,
    id,
    i,
  )

/**
 * 学生用の手引き（具体的な使い方の版。依頼者の依頼 2026-10-23：執筆で操作するときに困らないように）の画面。
 * 学生用の画面と一緒に撮る（SHOTS=detail なら、これだけ）。画像の名前は g-d-*
 */
async function detailShots(browser, config) {
  const drive = fakeDrive(STUDENT_EMAIL)
  const { context, page } = await openTool(browser, drive, config)
  await ready(page)
  await page.waitForSelector('.login-over .login-btn')
  await page.click('.login-btn')
  await page.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 60000 })
  await page.waitForSelector('.guide.step-course .g-opts button')
  await clickText(page, '.guide .g-opts button', '映画・舞台衣装')
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:name', { timeout: 30000 })
  await page.keyboard.type('文化　花子')
  await page.evaluate(() => document.querySelector('.g-later')?.click())
  await sleep(600)
  await ready(page)
  await page.evaluate(() => document.documentElement.classList.add('no-guide'))
  await page.evaluate(setupSinbad, SAMPLE)
  await sleep(800)
  await ready(page)
  await driveSaved(page)
  await page.mouse.move(5, 5)

  // ---- 画面の地図（パソコン）：段落を書いているところ（案A 2026-10-23） ----
  // 1 ページの一覧・2 左の道具・3 紙面（書いている所）・4 保存・5 セルフチェック・6 PDF・7 元に戻す・8 表示の大きさ・9 メニュー
  await openBlock(page, WRITE_ID, 40)
  await page.mouse.move(5, 5)
  await sleep(700)
  await capture(page, 'g-d-map', { x: 0, y: 0, w: PC.width, h: PC.height }, [
    { n: 1, box: await page.evaluate(rectOf, '.thumbs-col'), at: 'c' },
    { n: 2, box: await page.evaluate(rectOf, '.palette'), at: 'r' },
    { n: 3, box: await page.evaluate(rectOf, '.overlay-clip:not([hidden]) .overlay-editor'), at: 'r' },
    { n: 4, box: await page.evaluate(rectOf, '.side .drive-chip-wrap .chip'), at: 'b' },
    { n: 5, box: await page.evaluate(rectOf, '.side .sec.check .sec-h'), at: 'l' },
    { n: 6, box: await page.evaluate(rectOf, '.side .export'), at: 'l' },
    // 元に戻す・やり直すは、左の道具のいちばん下（mockups/v65 案B。前は右下の帯）
    { n: 7, box: await page.evaluate(rectOf, '.palette .undo-redo'), at: 'r' },
    { n: 8, box: await page.evaluate(rectOf, '.view-bar .zoom'), at: 't' },
    { n: 9, box: await page.evaluate(rectOf, '.side .menu-btn'), at: 'b' },
  ])
  await page.keyboard.press('Escape')
  await sleep(400)
  await ready(page)

  // ---- 図の入れ方の3コマ：1 書いている文の、入れたい位置で「図を入れる」 → 2 写真を選んでタイトルを打つ → 3 本文の（図n）と番号は自動 ----
  {
    await page.evaluate(() => {
      window.__beforeFigure = window.__editor.getSnapshot().report
    })
    // 本文の最初の段落（ページの上の方。図を入れても、段落と図が同じページに収まる）
    const pid = await page.evaluate(() => window.__editor.getSnapshot().report.body[0].blocks.find((b) => b.type === 'paragraph').id)
    await openBlock(page, pid, 999)
    await page.mouse.move(5, 5)
    await sleep(500)
    const caret = await page.evaluate(() => {
      const c = window.__editor.overlay.caretClientRect()
      return { x: c.left - 3, y: c.top, w: 6, h: c.bottom - c.top }
    })
    const palette = await page.evaluate(rectOf, '.palette')
    const para = await page.evaluate(rectOf, '.overlay-clip:not([hidden]) .overlay-editor')
    const figTool = await page.evaluate(rectOf, '.palette .tb', '図を入れる')
    const top1 = Math.min(figTool.y, para.y) - 60
    // 下の端は、紙面の行の途中で切らない（下の段落の行にかかるときは、その行の上で切る）
    const bottom1 = await page.evaluate(lineSafeBottom, CUR, Math.max(figTool.y + figTool.h, para.y + para.h) + 60)
    await capture(page, 'g-d-fig1', { x: palette.x - 10, y: top1, w: para.x + para.w + 14 - (palette.x - 10), h: bottom1 - top1 }, [
      { n: 1, box: caret, at: 'b' },
      { n: 2, box: figTool, at: 'r' },
    ])
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('図を入れる')).click())])
    await chooser.accept([resolve(FIGURE_FILE)])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
    await sleep(800)
    await ready(page).catch(() => {})
    const fid = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    await page.keyboard.type(FIGURE_CAPTION)
    await page.mouse.move(5, 5)
    await sleep(700)
    {
      const img = await page.evaluate(rectOf, `${CUR} figure[data-figure-id="${fid}"] img`)
      const cap = await page.evaluate(rectOf, '.overlay-clip:not([hidden]) .overlay-editor')
      await capture(page, 'g-d-fig2', pad(union(img, cap), 14), [
        { n: 1, box: img, at: 'r', dy: -img.h / 3 },
        { n: 2, box: cap, at: 'r' },
      ])
    }
    await page.keyboard.press('Escape')
    await sleep(600)
    await ready(page)
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), fid)
    await sleep(500)
    await ready(page)
    await page.mouse.move(5, 5)
    // 図のタイトルの欄に残る、選んでいる印（黄色い枠）を外す
    await unfocus(page)
    await sleep(200)
    {
      // 本文の「（図n）」：図のタイトルの番号と同じもの
      const ref = await page.evaluate(
        (cur, fid) => {
          const cap = document.querySelector(`${cur} figure[data-figure-id="${fid}"] figcaption`).textContent
          const n = cap.match(/図\s*(\d+)/)?.[1]
          const el = [...document.querySelectorAll(`${cur} .fig-ref`)].find((e) => e.textContent.includes(`図${n}`))
          if (!el) throw new Error(`本文の（図${n}）が見つかりません：${cap}／${[...document.querySelectorAll(`${cur} .fig-ref`)].map((e) => e.textContent).join(',')}`)
          const r = el.getBoundingClientRect()
          return { x: r.left, y: r.top, w: r.width, h: r.height }
        },
        CUR,
        fid,
      )
      const img = await page.evaluate(rectOf, `${CUR} figure[data-figure-id="${fid}"] img`)
      const cap = await page.evaluate(rectOf, `${CUR} figure[data-figure-id="${fid}"] figcaption`)
      const para = await page.evaluate(rectOf, `${CUR} [data-block-id="${pid}"]`)
      const x = para.x - 10
      const y = ref.y - ref.h - 6
      await capture(page, 'g-d-fig3', { x, y, w: para.x + para.w + 10 - x, h: cap.y + cap.h + 10 - y }, [
        { n: 1, box: ref, at: 'b' },
        { n: 2, box: cap, at: 'r' },
      ])
    }
    await page.evaluate(() => window.__editor.update(() => window.__beforeFigure))
    await sleep(600)
    await ready(page)
  }

  // ---- 書き始める：薄い字（ひな形の「何を書くか」）の段落 ----
  {
    const saved = await page.evaluate(
      (after, hint) => {
        window.__beforeHint = window.__editor.getSnapshot().report
        let added = false
        window.__editor.update((r) => ({
          ...r,
          body: r.body.map((c) => {
            const i = c.blocks.findIndex((b) => b.id === after)
            if (i < 0) return c
            const blocks = [...c.blocks]
            blocks.splice(i + 1, 0, { type: 'paragraph', id: 'p-hint', content: [{ type: 'text', text: '' }], hint })
            added = true
            return { ...c, blocks }
          }),
        }))
        return added
      },
      HINT_AFTER,
      HINT_TEXT,
    )
    if (!saved) throw new Error('薄い字の段落を足せませんでした')
    await sleep(600)
    await ready(page)
    await goToBlock(page, 'p-hint')
    await page.mouse.move(5, 5)
    const prev = await page.evaluate(rectOf, `${CUR} [data-block-id="${HINT_AFTER}"]`)
    const hint = await page.evaluate(rectOf, `${CUR} [data-block-id="p-hint"]`)
    // 字が読めるよう、本文の左から6割ほどに絞る（行の途中で切れてよい）
    const clip = pad(union(prev, hint), 14)
    await capture(page, 'g-d-hint', { ...clip, w: Math.round(clip.w * 0.6) }, [{ n: 1, box: { ...hint, w: Math.round(clip.w * 0.6) - 28 }, at: 'r' }])
    await page.evaluate(() => window.__editor.update(() => window.__beforeHint))
    await sleep(600)
    await ready(page)
  }

  // ---- 書いているときの左の道具（見出し・改ページ・図・表・この段落の削除） ----
  await openBlock(page, WRITE_ID, 999)
  {
    const palette = await page.evaluate(rectOf, '.palette')
    const tool = (label) => page.evaluate(rectOf, '.palette .tb', label)
    await capture(page, 'g-d-palette', pad(palette, 10), [
      { n: 1, box: union(await tool('大見出し'), await tool('小見出し')), at: 'r' },
      { n: 2, box: await tool('改ページ'), at: 'r' },
      { n: 3, box: union(await tool('図を入れる'), await tool('表を入れる')), at: 'r' },
      { n: 4, box: await page.evaluate(rectOf, '.palette .tb.danger'), at: 'r' },
    ])
  }

  // ---- 表を入れる：マス目で大きさを選ぶ（素材表のひな形も） ----
  await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('表を入れる')).click())
  await page.waitForSelector('.table-menu .tgrid')
  {
    const cells = await page.evaluate(() => [...document.querySelectorAll('.table-menu .tgrid button')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))
    // 3列×4行のあたりにマウスを重ねる（色が付く）
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.table-menu .tgrid')).gridTemplateColumns.split(' ').length)
    const at = cells[3 * cols + 2] ?? cells.at(-1)
    await page.mouse.move(at.x, at.y)
    await sleep(400)
    const menu = await page.evaluate(rectOf, '.table-menu')
    const palette = await page.evaluate(rectOf, '.palette')
    await capture(page, 'g-d-table-size', pad(union(menu, { x: palette.x, y: menu.y, w: 1, h: menu.h }), 10), [
      { n: 1, box: await page.evaluate(rectOf, '.table-menu .tgrid'), at: 'r' },
      { n: 2, box: await page.evaluate(rectOf, '.table-menu button', '素材表'), at: 'r', optional: true },
    ])
  }
  await page.keyboard.press('Escape')
  await page.mouse.move(5, 5)
  await sleep(300)
  await page.keyboard.press('Escape')
  await sleep(400)
  await ready(page)

  // ---- 元に戻す（左の道具のいちばん下。mockups/v65 案B） ----
  {
    const group = await page.evaluate(rectOf, '.palette .undo-redo')
    await capture(page, 'g-d-undo', pad(group, 8), [{ n: 1, box: await page.evaluate(rectOf, '.palette .undo-redo .tb', '元に戻す'), at: 'r' }])
  }

  // ---- 紙面をなぞって選ぶ：コピー・切り取り・削除 ----
  // 図をはさまない、続いた2つの段落（RANGE_FROM・RANGE_TO：ブラウスの最初の2段落）をなぞる
  await goToBlock(page, RANGE_FROM)
  {
    const from = await charPoint(page, RANGE_FROM, 20)
    const to = await charPoint(page, RANGE_TO, 14)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12)
      await sleep(30)
    }
    await page.mouse.up()
    await page.waitForFunction(() => !!document.querySelector('.palette .sel-tools'), { timeout: 10000 })
    await page.mouse.move(5, 5)
    await sleep(500)
    const tools = await page.evaluate(rectOf, '.palette .sel-tools')
    const text = union(await page.evaluate(rectOf, `${CUR} [data-block-id="${RANGE_FROM}"]`), await page.evaluate(rectOf, `${CUR} [data-block-id="${RANGE_TO}"]`))
    // 選んだ所の上に出るボタン（コピー・切り取り・削除）も、上と右の端まで入れる（前は「削除」が切れていた。段落がページの上にあると、上が切れていた）
    const bar = await page.evaluate(() => { const r = document.querySelector('.range-bar:not([hidden])')?.getBoundingClientRect(); return r ? { top: r.top, right: r.right } : { top: Infinity, right: 0 } })
    const y = Math.min(tools.y, text.y, bar.top) - 12
    const right = Math.max(text.x + text.w, bar.right) + 14
    // 下の端は、紙面の行や図の途中で切らない（左の道具まで入れるので、かかった図はタイトルまで入れる）
    const bottom = await page.evaluate(lineSafeBottom, CUR, Math.max(tools.y + tools.h, text.y + text.h) + 12, true)
    await capture(page, 'g-d-range', { x: tools.x - 10, y, w: right - (tools.x - 10), h: bottom - y }, [
      // 1：選んだ行（なぞり始めの行から終わりの行まで）
      { n: 1, box: { x: text.x, y: from.y - 9, w: text.w, h: to.y - from.y + 18 }, at: 'r' },
      { n: 2, box: tools, at: 'r' },
    ])
    await page.mouse.click(5, 300)
    await page.keyboard.press('Escape')
    await sleep(400)
  }

  // ---- 図を押したときの道具（差し替え・もう1枚・小見出しの終わりへ・削除）。TOOLS_FIGURE（2枚並びの左の図）を押す ----
  {
    // ページを探すのは図の id で（図の並び r… の id ではページが見つからない）
    await goToBlock(page, TOOLS_FIGURE)
    const fig = `${CUR} figure[data-figure-id="${TOOLS_FIGURE}"]`
    const img = await page.evaluate(rectFirst, `${fig} img`)
    await page.mouse.click(img.x + img.w / 2, img.y + img.h / 2)
    await page.waitForFunction(() => window.__editor.getSnapshot().selection?.kind === 'figure', { timeout: 10000 })
    await page.mouse.move(5, 5)
    await sleep(500)
    const group = await page.evaluate(rectOf, '.palette .group.ctx')
    const tool = (label) => page.evaluate(rectOf, '.palette .group.ctx .tb', label)
    const paper = union(img, await page.evaluate(rectFirst, `${fig} figcaption`))
    const y = Math.min(group.y, paper.y) - 12
    await capture(page, 'g-d-figure-tools', { x: group.x - 10, y, w: paper.x + paper.w + 16 - (group.x - 10), h: Math.max(group.y + group.h, paper.y + paper.h) + 12 - y }, [
      { n: 1, box: await tool('差し替え'), at: 'r' },
      { n: 2, box: await tool('もう1枚'), at: 'r' },
      // 図の置き場所によっては「段落の下へ戻す」になる（そのときは番号を付けない）
      { n: 3, box: await tool('小見出しの終わりへ'), at: 'r', optional: true },
    ])
    await page.keyboard.press('Escape')
    await sleep(300)
  }

  // ---- 表のマスを書いているときの道具（画像を入れる・行や列を足す・表の形を整える） ----
  {
    const tableId = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table').id)
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), tableId)
    await sleep(600)
    await ready(page)
    const cell = await page.evaluate((cur) => {
      const td = [...document.querySelectorAll(`${cur} .data-table tbody td`)][0]
      const r = td.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, CUR)
    await page.mouse.click(cell.x, cell.y)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCell', { timeout: 10000 })
    await page.mouse.move(5, 5)
    await sleep(600)
    const group = await page.evaluate(rectOf, '.palette .group.ctx')
    const table = await page.evaluate(rectOf, `${CUR} .data-table`)
    const y = Math.min(group.y, table.y) - 12
    const tool = (label) => page.evaluate(rectOf, '.palette .group.ctx .tb', label)
    await capture(page, 'g-d-table-tools', { x: group.x - 10, y, w: table.x + table.w + 14 - (group.x - 10), h: Math.max(group.y + group.h, table.y + table.h) + 12 - y }, [
      { n: 1, box: await tool('画像を入れる'), at: 'r' },
      { n: 2, box: union(await tool('行を足す'), await tool('列を足す')), at: 'r' },
      { n: 3, box: await tool('表の形'), at: 'r' },
    ])
    await page.keyboard.press('Escape')
    await sleep(400)
    await ready(page)
  }

  // ---- 作品写真：写真を押したときの道具（並べ方・写真のページを足す） ----
  {
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await sleep(600)
    await ready(page)
    const slot = await page.evaluate(rectFirst, `${CUR} [data-photo-slot="0"] img`)
    await page.mouse.click(slot.x + slot.w / 2, slot.y + slot.h / 2)
    await page.waitForFunction(() => window.__editor.getSnapshot().selection?.kind === 'photos', { timeout: 10000 })
    await page.mouse.move(5, 5)
    await sleep(600)
    const palette = await page.evaluate(rectOf, '.palette')
    const paper = await page.evaluate(rectOf, CUR)
    const y = Math.min(palette.y, paper.y) - 10
    await capture(page, 'g-d-photo-tools', { x: palette.x - 10, y, w: paper.x + paper.w + 12 - (palette.x - 10), h: Math.max(palette.y + palette.h, paper.y + paper.h) + 10 - y }, [
      { n: 1, box: await page.evaluate(rectOf, '.palette .ctx-label', '並べ方'), at: 'r', optional: true },
      { n: 2, box: await page.evaluate(rectOf, '.palette .tb', '写真のページを足す'), at: 'r', optional: true },
    ])
    await page.keyboard.press('Escape')
    await sleep(300)
  }

  // ---- スマホ：書いているときの「追加」（大見出し・小見出し・改ページ） ----
  {
    const phone = await openTool(browser, drive, config, { phone: true })
    const pp = phone.page
    await ready(pp, true)
    await pp.waitForSelector('.login-btn')
    await pp.tap('.login-btn')
    await pp.waitForFunction(() => !document.querySelector('.login-over'), { timeout: 90000 })
    await ready(pp, true)
    await pp.evaluate(() => document.documentElement.classList.add('no-guide'))
    await pp.evaluate(setupSinbad, SAMPLE)
    await sleep(800)
    await ready(pp, true)
    await pp.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
    await goToBlock(pp, WRITE_ID, true)
    await tapChar(pp, WRITE_ID, 14)
    await pp.waitForFunction((id) => window.__editor.getSnapshot().editingId === id && window.__editor.getSnapshot().zoomed, { timeout: 30000 }, WRITE_ID)
    await sleep(900)
    await fakeKeyboard(pp, true)
    await sleep(500)
    await pp.tap('.direct-bar button[aria-expanded]')
    await sleep(700)
    await capture(pp, 'g-d-phone-add', { x: 0, y: 0, w: PHONE.width, h: PHONE.height }, [
      { n: 1, box: await pp.evaluate(rectOf, '.direct-bar .db-add'), at: 't' },
    ])
    await fakeKeyboard(pp, false)
    await phone.context.close()
  }
  await context.close()
}

async function openAdmin(browser, { as, viewport = PC } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => d.accept())
  await noHotReload(page)
  await page.setViewport(viewport)
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.removeItem('sotsugyo-admin-mock')
    localStorage.removeItem('sotsugyo-admin-year')
    localStorage.removeItem('sotsugyo-admin-form-width')
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.goto(`${APP}/admin.html${as ? `?as=${as}` : ''}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .content')
  await hideMockBadge(page)
  return { context, page }
}

/** 「試験用サーバー」の印は本物の管理ページにはないので出さない */
const hideMockBadge = (page) => page.evaluate(() => [...document.querySelectorAll('.badge')].filter((b) => b.textContent.includes('試験用')).forEach((b) => b.style.setProperty('display', 'none')))

/** 左の見出しの区切りを押す（title：「年度の設定」「コース」など） */
const nav = async (page, title) => {
  await page.evaluate((t) => [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('.nt b').firstChild.textContent.trim() === t).click(), title)
  await page.waitForFunction((t) => document.querySelector('.content .sec-h')?.textContent.startsWith(t), {}, title)
  await sleep(500)
  await hideMockBadge(page)
}
/** 左の見出しの区切りのボタン */
const navBox = (page, title) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('.nt b').firstChild.textContent.trim() === t)
    const r = b.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }, title)

/** 入力欄に字を入れる（React に知らせる） */
const setValue = (handle, text) =>
  handle.evaluate((el, text) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)

/** 管理ページの見本（iframe）は設定や幅が変わるたびに作り直されるので、表紙と抄録が出て、作り直しが止まるまで待つ */
async function previewStable(page) {
  for (let i = 0; i < 40; i++) {
    const stable = await page.evaluate(() => {
      const d = document.querySelector('.preview iframe')?.contentDocument
      if (!d || d.readyState !== 'complete' || d.querySelectorAll('.page').length !== 2) return false
      if (d.__guideSeen) return true
      d.__guideSeen = true
      return false
    })
    if (stable) return
    await sleep(800)
  }
  throw new Error('管理ページの見本が表示されません')
}
const previewReady = async (page) => {
  await previewStable(page)
  await page.evaluate(() => document.querySelector('.preview iframe').contentDocument.fonts.ready)
  await sleep(600)
  await previewStable(page)
}
/** 見本の1ページ目（表紙）の範囲 */
const previewPage = (page) =>
  page.evaluate(() => {
    const f = document.querySelector('.preview iframe')
    const fr = f.getBoundingClientRect()
    const r = f.contentDocument.querySelector('.page').getBoundingClientRect()
    return { x: fr.left + r.left, y: fr.top + r.top, w: r.width, h: r.height }
  })

/** 「ひな形を作る画面を開く」を押して、重ねた窓の中の学生のツールが開くまで待つ（e2e/templateMode.mjs と同じ） */
async function openTemplate(page) {
  await page.evaluate(() => document.querySelector('.course.open .tpl-open').click())
  await page.waitForSelector('.tpl-overlay iframe')
  await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 30000 })
  const frame = page.frames().find((f) => f.url().includes('template=1') && f.parentFrame() === page.mainFrame())
  await frame.waitForFunction(() => {
    const s = window.__editor?.getSnapshot()
    return s?.layout && !s.rendering && !s.turning
  }, { timeout: 60000 })
  await sleep(900)
  return frame
}

async function adminShots(browser) {
  const { context, page } = await openAdmin(browser)

  // ---- 年度の設定（左の見出し・年度の欄・右の見本） ----
  await page.mouse.move(5, 5)
  await previewReady(page)
  {
    const pp = await previewPage(page)
    await capture(page, 'g-admin-main', { x: 0, y: 0, w: PC.width, h: pp.y + pp.h + 14 }, [
      { n: 1, box: union(await page.evaluate(rectOf, '.admin-header .sel'), await page.evaluate(rectOf, '.admin-header .badge.pub')), at: 'b' },
      { n: 2, box: await navBox(page, '年度の設定'), at: 'r' },
      { n: 3, box: await page.evaluate(rectOf, '#y-commonTitle'), at: 'r' },
      { n: 4, box: await page.evaluate(rectOf, '#y-deadline'), at: 'r' },
      { n: 5, box: pp, at: 'tl', dx: 10, dy: 10 },
      { n: 6, box: await page.evaluate(rectOf, '.admin-header .btn', '保存して学生に反映'), at: 'b' },
      { n: 7, box: await page.evaluate(rectOf, '.admin-header button', '使い方'), at: 'b', optional: true },
    ])
  }

  // ---- コース（開いたコースのカード：ひな形を作る画面を開く・お知らせ） ----
  await nav(page, 'コース')
  await page.waitForSelector('.course.open .tpl-open')
  await page.mouse.move(5, 5)
  await capture(page, 'g-admin-course', pad(await page.evaluate(rectOf, '.course.open'), 10), [
    { n: 1, box: await page.evaluate(rectOf, '.course.open .tpl-open'), at: 'r' },
    { n: 2, box: await page.evaluate(rectOf, '.course.open textarea.notice'), at: 'l' },
  ])

  // ---- 下書きのひな形を作る画面（管理ページの上に重ねた窓。中は学生と同じ紙面） ----
  {
    const frame = await openTemplate(page)
    await page.mouse.move(5, 5)
    const outer = await page.evaluate(() => document.querySelector('.tpl-overlay iframe').getBoundingClientRect().toJSON())
    const back = await frame.evaluate(() => document.querySelector('.tpl-primary').getBoundingClientRect().toJSON())
    await capture(page, 'g-admin-template', { x: 0, y: 0, w: PC.width, h: PC.height }, [{ n: 1, box: { x: outer.x + back.x, y: outer.y + back.y, w: back.width, h: back.height }, at: 'l' }])
    // 直していないので、「閉じる」（前は「やめる」）で確かめずに閉じる
    await frame.evaluate(() => document.querySelector('.tpl-foot .tpl-sub').click())
    await page.waitForFunction(() => !document.querySelector('.tpl-overlay'), { timeout: 10000 })
  }

  // ---- 書き方のチェック（書き間違えやすい語の一覧と、試しに確かめる） ----
  await nav(page, '書き方のチェック')
  await page.mouse.move(5, 5)
  await capture(page, 'g-admin-words', pad(union(await page.evaluate(rectOf, '.content .sec-h'), await page.evaluate(rectOf, '.words')), 14), [
    { n: 1, box: await page.evaluate(rectOf, '.wtable'), at: 'tl', dx: 12, dy: 12 },
    { n: 2, box: await page.evaluate(rectOf, '.wtry'), at: 'tl', dx: 12, dy: 12 },
  ])

  // ---- 詳細設定：Google の障害のとき（学生のドライブ保存の切り替え） ----
  await nav(page, '詳細設定')
  await page.mouse.move(5, 5)
  await capture(page, 'g-admin-switch', pad(await page.evaluate(rectOf, '.content .card', 'Google の障害のとき'), 10), [
    { n: 1, box: await page.evaluate(rectOf, '.drive-switch .seg2 button', '止める'), at: 'r' },
  ])

  // ---- 締切を1日ずらして保存 → 変更履歴 ----
  await nav(page, '年度の設定')
  await setValue(await page.$('#y-deadline'), '2027-01-22')
  await page.waitForSelector('.dirty-bar')
  await page.evaluate(() => document.querySelector('.dirty-bar .btn.primary').click())
  // 画面の中の確認の窓（src/admin/confirm.tsx）で「保存する」
  await page.waitForSelector('[data-confirm="ok"]')
  await page.evaluate(() => document.querySelector('[data-confirm="ok"]').click())
  await page.waitForFunction(() => !document.querySelector('.dirty-bar') && !document.querySelector('.admin-header .busy'), { timeout: 30000 })
  await nav(page, '変更履歴')
  await page.waitForSelector('.history li')
  await page.mouse.move(5, 5)
  await capture(page, 'g-admin-history', pad(union(await page.evaluate(rectOf, '.content .sec-h'), await page.evaluate(rectOf, '.history-sec .card')), 14), [
    { n: 1, box: await page.evaluate(rectOf, '.history li button'), at: 'l' },
  ])

  // ---- 新年度を作成 → 準備中の年度：「新年度の準備」・題目を直したところ（下に、保存していない変更の帯）。管理者用の手引きの大きな画像 ----
  await nav(page, '年度の設定')
  await page.evaluate(() => document.querySelector('.next-year button').click())
  await page.waitForSelector('.modal')
  await clickText(page, '.modal button', '作成する')
  await page.waitForFunction(() => document.querySelector('.badge.draft')?.textContent === '準備中', { timeout: 30000 })
  await setValue(await page.$('#y-commonTitle'), '卒業イベント「アラジン」について')
  await page.waitForSelector('.dirty-bar')
  // 「作成しました」の知らせ（数秒）が消えるまで待つ
  await page.waitForFunction(() => !document.querySelector('.admin-header .done-note'), { timeout: 15000 }).catch(() => {})
  await page.evaluate(() => document.querySelector('.content')?.scrollTo?.(0, 0))
  await unfocus(page)
  await page.mouse.move(5, 5)
  await previewReady(page)
  await hideMockBadge(page)
  await sleep(400)
  await capture(page, 'g-admin-newyear', { x: 0, y: 0, w: PC.width, h: PC.height }, [
    { n: 1, box: await navBox(page, '年度の設定'), at: 'l' },
    { n: 2, box: await page.evaluate(rectOf, '.steps-card'), at: 'r' },
    { n: 3, box: await page.evaluate(rectOf, '.dirty-bar .btn.primary'), at: 't' },
    { n: 4, box: await page.evaluate(rectOf, '#publish-btn'), at: 'b' },
    { n: 5, box: await navBox(page, '先生の登録'), at: 'l' },
    { n: 6, box: await navBox(page, '変更履歴'), at: 'l' },
    { n: 7, box: await navBox(page, '詳細設定'), at: 'l' },
    { n: 8, box: await previewPage(page), at: 'tl', dx: 10, dy: 10 },
  ])
  await context.close()

  // ---- 先生の画面（コースと書き方のチェックだけ）。お知らせを書いたところ（下に、保存していない変更の帯） ----
  // 先生用の手引きでは、画像の横に手順を並べるので、画面を小さめ（1180×640）にして、コースのカードのすぐ下に帯が来るようにする
  const TEACHER = { width: 1180, height: 640, deviceScaleFactor: 2 }
  const t = await openAdmin(browser, { as: 'teacher', viewport: TEACHER })
  await t.page.waitForSelector('.course.open textarea.notice')
  await setValue(await t.page.$('.course.open textarea.notice'), '12月4日（金）の中間発表では、本文の下書きを印刷して持ってきてください')
  await t.page.waitForSelector('.dirty-bar')
  await unfocus(t.page)
  await t.page.mouse.move(5, 5)
  await hideMockBadge(t.page)
  await sleep(600)
  await capture(t.page, 'g-admin-teacher', { x: 0, y: 0, w: TEACHER.width, h: TEACHER.height }, [
    { n: 1, box: await t.page.evaluate(rectOf, '.course.open .tpl-open'), at: 'l' },
    { n: 2, box: await t.page.evaluate(rectOf, '.course.open textarea.notice'), at: 'r' },
    { n: 3, box: await t.page.evaluate(rectOf, '.dirty-bar .btn.primary'), at: 't' },
  ])
  await t.context.close()
}

// =====================================================================
// PDF
// =====================================================================

async function makePdf(browser, guide) {
  const page = await browser.newPage()
  const failed = []
  page.on('pageerror', (e) => failed.push(`ページのエラー：${e.message}`))
  page.on('requestfailed', (r) => failed.push(`読み込めなかったもの：${r.url()}`))
  await page.setViewport({ width: 1000, height: 1200 })
  await page.emulateMediaType('print')
  await page.goto(pathToFileURL(resolve(guide.html)).href, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.body.dataset.ready === 'true', { timeout: 30000 })
  const check = await page.evaluate((exempt, minPt, jp) => {
    const fonts = ['BIZ UDPGothic'].filter((f) => !document.fonts.check(`16px "${f}"`) || !document.fonts.check(`bold 16px "${f}"`))
    const images = [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.getAttribute('src'))
    const missing = [...document.querySelectorAll('figure[data-shot]')].filter((f) => !f.querySelector('img')).map((f) => f.dataset.shot)
    // 用紙（A4）からはみ出していないか（わざと用紙の外まで伸ばすもの .bleed は除く）
    const sheets = [...document.querySelectorAll('.sheet')]
    const over = sheets.map((s, i) => {
      const r = s.getBoundingClientRect()
      let worst = { px: 0, who: '' }
      for (const e of s.querySelectorAll('*')) {
        if (e.closest('.bleed, svg')) continue
        const q = e.getBoundingClientRect()
        if (!q.width || !q.height) continue
        const px = Math.max(q.bottom - r.bottom, q.right - r.right, r.left - q.left)
        if (px > worst.px) worst = { px: Math.round(px), who: `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}「${e.textContent.trim().slice(0, 14)}」` }
      }
      // 中の要素が、自分の枠からあふれていないか（柱の上に文が重なるなど）
      for (const e of s.querySelectorAll('.fit')) {
        if (e.scrollHeight - e.clientHeight > 1) worst = { px: Math.max(worst.px, e.scrollHeight - e.clientHeight), who: `.fit「${e.textContent.trim().slice(0, 14)}」の中があふれています` }
      }
      return { page: i + 1, chars: (s.innerText.match(new RegExp(jp, 'g')) ?? []).length, ...worst }
    })
    // 文字の大きさ（pt）。柱・ページ番号・飾りの英字（exempt）は除く
    let min = { pt: 99, who: '' }
    const small = []
    for (const e of document.querySelectorAll('.sheet *')) {
      if (e.closest('svg') || e.closest(exempt)) continue
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      const pt = Math.round(parseFloat(getComputedStyle(e).fontSize) * 0.75 * 10) / 10
      const who = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}「${e.textContent.trim().slice(0, 12)}」`
      if (pt < min.pt) min = { pt, who }
      if (pt < minPt) small.push(`${pt}pt ${who}`)
    }
    // 1字だけが行に残っている文（「…書／く。」のような折り返し）。字のある部品（行の箱）ごとに、1字ずつの位置から行を分け、
    // 句読点・かっこを除いて1字以下の行があれば知らせる（1行だけの部品は見ない。e2e/admin.mjs の lonelyLines と同じ数え方）
    const lonely = []
    const boxes = new Map()
    const range = document.createRange()
    // どのページも（学生用は両面の2ページ）
    for (const sheet of document.querySelectorAll('.sheet')) {
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('svg, style, script')) continue
        let box = n.parentElement
        while (box && getComputedStyle(box).display === 'inline') box = box.parentElement
        if (!box || !box.getClientRects().length) continue
        if (!boxes.has(box)) boxes.set(box, [])
        const list = boxes.get(box)
        for (let i = 0; i < n.length; i++) {
          if (/\s/.test(n.data[i])) continue
          range.setStart(n, i)
          range.setEnd(n, i + 1)
          const r = range.getBoundingClientRect()
          if (r.height) list.push({ y: (r.top + r.bottom) / 2, h: r.height, ch: n.data[i] })
        }
      }
    }
    for (const list of boxes.values()) {
      const lines = []
      for (const c of list.sort((a, b) => a.y - b.y)) {
        const line = lines.at(-1)
        if (line && Math.abs(c.y - line.y) < line.h * 0.55) line.chars.push(c.ch)
        else lines.push({ y: c.y, h: c.h, chars: [c.ch] })
      }
      const bare = (l) => l.chars.join('').replace(/[、。，．・：；！？）」』】〕〉》,.:;!?)\]]/g, '')
      if (lines.length > 1 && lines.some((l) => bare(l).length <= 1)) lonely.push(`${lines.map((l) => l.chars.join('')).join('／')}`.slice(0, 80))
    }
    return { fonts, images, missing, sheets: sheets.length, over, min, small, lonely }
  }, MIN_EXEMPT, MIN_PT, JP.source)
  const problems = [...failed]
  if (check.fonts.length) problems.push(`書体を読み込めませんでした：${check.fonts.join(', ')}（node_modules/@fontsource があるか確かめてください）`)
  if (check.images.length) problems.push(`読み込めなかった画像：${check.images.join(', ')}`)
  if (check.missing.length) problems.push(`画面の画像がありません（先に画面を撮ってください）：${check.missing.join(', ')}`)
  if (check.sheets !== guide.pages) problems.push(`${guide.pages}ページのはずが、${check.sheets}ページあります`)
  for (const o of check.over) if (o.px > 0) problems.push(`${o.page}ページ：用紙・枠から ${o.px}px はみ出しています（${o.who}）。文を短くしてください`)
  for (const o of check.over) {
    if (o.chars > MAX_CHARS_HARD) problems.push(`${o.page}ページ：${o.chars}字あります（${MAX_CHARS_HARD}字まで）。文を短くしてください`)
    else if (o.chars > MAX_CHARS) console.log(`  （${o.page}ページ：${o.chars}字。目安の ${MAX_CHARS}字を超えています）`)
  }
  if (check.small.length) problems.push(`文字が ${MIN_PT}pt より小さいところがあります：${check.small.slice(0, 6).join('　')}`)
  for (const l of check.lonely) problems.push(`1字だけの行があります（言葉の切れ目で折り返すよう、文を直してください）：${l}`)
  console.log(`  ${guide.html}：${check.over.map((o) => o.chars).join('・')}字　いちばん小さい文字 ${check.min.pt}pt（${check.min.who}。柱・ページ番号などを除く）`)
  await page.pdf({ path: guide.pdf, printBackground: true, preferCSSPageSize: true })
  await page.close()
  const doc = await getDocument({ data: new Uint8Array(readFileSync(guide.pdf)), useSystemFonts: false, verbosity: 0 }).promise
  const kb = Math.round(readFileSync(guide.pdf).length / 1024)
  console.log(`  ${guide.pdf}（${doc.numPages}ページ・${kb.toLocaleString()}KB）`)
  if (doc.numPages !== guide.pages) problems.push(`PDF が ${guide.pages}ページになっていません（${doc.numPages}ページ）`)
  if (problems.length) {
    for (const p of problems) console.log(`！ ${p}`)
    process.exitCode = 1
    return false
  }
  if (guide.publish) {
    copyFileSync(guide.pdf, guide.publish)
    console.log(`  ${guide.publish} に写しました`)
  }
  return true
}

async function makeQr() {
  // 白黒で印刷しても読めるよう、濃い色にする
  const svg = await QRCode.toString(TOOL_URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#14161b', light: '#ffffff' } })
  writeFileSync(`${IMG}/qr-guide.svg`, svg)
  console.log(`  ${IMG}/qr-guide.svg  (${TOOL_URL})`)
}

const TARGETS = draftOnly ? DRAFTS : GUIDES
for (const g of TARGETS) if (!existsSync(g.html)) throw new Error(`${g.html} がありません`)

// Edge は1回だけ起動する（続けて起動し直すと、閉じかけの Edge に接続しようとして失敗することがあるため）
await withEdge(async (browser) => {
  if (!pdfOnly) {
    console.log('画面の画像を撮ります')
    const config = JSON.parse(readFileSync('scripts/e2e/config-fixture.json', 'utf8'))
    // 試験用の設定の「（自動テスト用）」のお知らせは写さない
    for (const c of config.courses) delete c.notice
    // 本番の年度の設定には「AI に聞くのリンク」があるので、メニューと使い方の欄の「使い方を AI に聞く」も写す（リンクの先は仮のもの）
    config.aiHelpUrl = 'https://gemini.google.com/gem/example'
    if (doShot('student') && !draftOnly) await studentShots(browser, config)
    if (doShot('admin') && !draftOnly) await adminShots(browser)
    // 学生用の手引きの画面（画面の地図・図と表の入れ方・スマホ）。SHOTS=detail でこれだけ撮れる
    if ((doShot('student') && !draftOnly) || SHOT_ONLY.includes('detail')) await detailShots(browser, config)
    await makeQr()
  }
  console.log('PDF にします')
  for (const g of TARGETS) await makePdf(browser, g)
})
