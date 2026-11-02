// mockups/v89：学生用の手引き（両面）のメリハリの案（依頼者 2026-11-02：裏の「スマホで書くとき・ホーム画面に追加」の並びが変で、
// ホーム画面に追加はもっと勧めたいので目立たせたい。ほかも、きちんと伝えたい所が目立つようにメリハリを。表も同じことが言えれば案を）。
// docs/手引き_学生用.html を写して、案ごとに書き換えた HTML を docs/ に一時的に置き、Edge で両面を画像にする（HTML は消す）。
// 使い方：node scripts/mockup-v89-guide.mjs → mockups/v89/<案>-1.png（表）・<案>-2.png（裏）と、字数
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.EDGE_PORT ??= '9437'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v89'
mkdirSync(OUT, { recursive: true })
const SRC = readFileSync('docs/手引き_学生用.html', 'utf8')
const sub = (html, a, b) => {
  if (html.split(a).length !== 2) throw new Error(`1か所のはずが ${html.split(a).length - 1}か所：${a.slice(0, 60)}`)
  return html.replace(a, b)
}

/** 裏の「スマホで書くとき」（いまの形）を、まるごと差し替えるための範囲 */
const phoneStart = SRC.indexOf('  <div class="phone-row">')
const phoneEnd = SRC.indexOf('  <p class="end">')
const PHONE_OLD = SRC.slice(phoneStart, phoneEnd)
const COMPASS = PHONE_OLD.match(/<svg[^>]*aria-label="方位磁針"[\s\S]*?<\/svg>/)[0]
const SHARE = PHONE_OLD.match(/<svg[^>]*aria-label="共有"[\s\S]*?<\/svg>/)[0]
const END_OLD = '<span>くわしくは <span class="btn">？ 使い方</span> から（動画も）。その中の <span class="btn">使い方を AI に聞く</span> では、ふだんの言葉で質問できます。</span>'
const END_NEW = '<span>くわしくは <span class="btn">？ 使い方</span> から（動画も）。<span class="btn">使い方を AI に聞く</span> でも質問できます。</span>'

/** 表：4「エラーを0に」を赤に（どちらの案も） */
const ROUTE_OLD = '<span class="step"><i>4</i><b>エラーを0に</b></span>'
const ROUTE_NEW = '<span class="step must"><i>4</i><b>エラーを0に</b></span>'

/** ホーム画面に追加（どちらの案も：手順を札にして並べ、折り返しで崩れないように） */
const HOME = `
      <div class="os"><b>iPhone（Safari）</b><ol class="chips"><li>${SHARE} 共有</li><li>ホーム画面に追加</li><li>Web アプリとして開く：オフ</li><li>追加</li></ol></div>
      <div class="os"><b>Android（Chrome）</b><ol class="chips"><li>右上の ⋮</li><li>ホーム画面に追加</li><li>追加</li></ol></div>`

const COMMON_CSS = `
  .route .step.must i { background: #c62828; }
  .route .step.must b { color: #c62828; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 1.2mm 0; margin: 0.8mm 0 0; padding: 0; list-style: none; }
  .chips li { position: relative; display: inline-flex; align-items: center; gap: 0.8mm; padding: 0.6mm 2.2mm; border: 0.3mm solid var(--line); border-radius: 1.4mm; background: #fff; font-size: 10.5pt; line-height: 1.35; white-space: nowrap; }
  .chips li + li { margin-left: 4.6mm; }
  .chips li + li::before { content: '→'; position: absolute; left: -3.9mm; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .chips svg { width: 4mm; height: 4mm; }
  .must-line { position: relative; padding-left: 6.2mm; }
  .must-line::before { content: '!'; position: absolute; left: 0; top: 0.4mm; width: 4.6mm; height: 4.6mm; border-radius: 50%; background: #c62828; color: #fff; font: 700 9pt/4.6mm 'Segoe UI', sans-serif; text-align: center; }
  .rec { display: inline-block; margin-left: 2mm; padding: 0.3mm 2mm; border-radius: 1mm; background: #c62828; color: #fff; font-size: 9.5pt; font-weight: 700; vertical-align: 0.5mm; letter-spacing: 0.1em; }
`

const variants = {
  // 案A：今の並びのまま、伝えたい所に赤い印と札。裏のスマホは「書くとき」と「ホーム画面に追加（おすすめ）」の2つの箱を横に並べる
  a: (html) => {
    html = sub(html, ROUTE_OLD, ROUTE_NEW)
    html = sub(html, '<p class="memo"><b>保存は自動</b><br>共用のパソコンでは、最後に <span class="btn">この端末から原稿を消す</span></p>', '<p class="memo"><b>保存は自動</b><br><span class="must-line">共用のパソコンでは、最後に <span class="btn">この端末から原稿を消す</span></span></p>')
    html = sub(html, PHONE_OLD, `  <div class="phone-a">
    <section class="pa-write">
      <h3>スマホで書くとき</h3>
      <p>タップして書き、<span class="btn">完了</span>。図・表・見出しはキーボードの上。</p>
      <p class="must-line"><b>下に赤い帯が出たら、押して直す。</b></p>
      <p class="must-line"><b>Classroom から開いたら、Safari・Chrome に切り替える</b>（iPhone は右下の ${COMPASS}、Android は「⋮」→「Chrome で開く」）。</p>
    </section>
    <section class="pa-home">
      <h3>ホーム画面に追加<span class="rec">おすすめ</span></h3>
      <p>次からは、アイコンを押すだけで開けます。</p>${HOME}
    </section>
  </div>

`)
    html = sub(html, END_OLD, END_NEW)
    return sub(html, '</style>', `${COMMON_CSS}
  .phone-a { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 3mm; }
  .phone-a section { padding: 2.6mm 3.6mm 3mm; }
  .phone-a h3 { font-size: 12pt; margin-bottom: 1mm; }
  .phone-a p { margin-top: 0.9mm; font-size: 10.5pt; line-height: 1.45; }
  .phone-a svg { width: 4mm; height: 4mm; vertical-align: -0.7mm; }
  .pa-write { background: var(--gray); }
  .pa-home { background: #fdf3d9; border: 0.5mm solid #e8b64a; }
  .pa-home .os { margin-top: 1.6mm; }
  .pa-home .os > b { font-size: 10.5pt; }
</style>`)
  },
  // 案B：裏の下を「スマホで書く人へ」の帯の見出しにして大きくし、気をつけること3つ（赤い帯の絵つき）と、ホーム画面に追加（おすすめ）を並べる。
  // 表にも「スマホで書く人は、裏の『スマホで書く人へ』も見る」の帯を足す。図・表の入れ方のコマは少し低くする
  b: (html) => {
    html = sub(html, ROUTE_OLD, ROUTE_NEW)
    html = sub(html, '<p class="memo"><b>保存は自動</b><br>共用のパソコンでは、最後に <span class="btn">この端末から原稿を消す</span></p>', '<p class="memo"><b>保存は自動</b><br><span class="must-line">共用のパソコンでは、最後に <span class="btn">この端末から原稿を消す</span></span></p>')
    // 図・表の入れ方のコマを低くした分、絵も小さく（幅を 0.82 倍に）
    for (const [a, b] of [['53mm', '43mm'], ['28mm', '23mm'], ['37mm', '30mm'], ['38mm', '31mm']]) html = html.split(`style="width:${a}"`).join(`style="width:${b}"`)
    html = sub(html, '  <h2 class="sec-h">画面の地図', '  <p class="to-back"><b>スマホで書く人は</b>、裏の「スマホで書く人へ」も見てください →</p>\n\n  <h2 class="sec-h">画面の地図')
    html = sub(html, PHONE_OLD, `  <h2 class="pb-band">スマホで書く人へ</h2>
  <ol class="pb-tips">
    <li class="hot"><img src="../../スライド/assets/student/full/s-phone-strip.png" alt="下の赤い帯"><b>下に赤い帯が出たら、押して直す</b></li>
    <li class="hot"><b>Classroom から開いたら、Safari・Chrome に切り替える</b><span>iPhone は右下の ${COMPASS}、Android は「⋮」→「Chrome で開く」</span></li>
    <li><b>タップして書き、<span class="btn">完了</span></b><span>図・表・見出しはキーボードの上</span></li>
  </ol>
  <div class="pb-home">
    <h3>ホーム画面に追加<span class="rec">おすすめ</span><small>次からは、アイコンを押すだけで開けます</small></h3>
    <div class="pb-os">${HOME}
    </div>
  </div>

`)
    html = sub(html, END_OLD, END_NEW)
    return sub(html, '</style>', `${COMMON_CSS}
  .to-back { margin-top: 2.6mm; padding: 1.6mm 4mm; background: #fdf3d9; border-left: 1.4mm solid #e8b64a; font-size: 10.5pt; }
  .koma .stage { height: 34mm; }
  .pb-band { margin-top: 3mm; padding: 1.4mm 4mm; background: var(--navy); color: #fff; font-size: 12.5pt; letter-spacing: 0.08em; }
  .pb-tips { display: grid; grid-template-columns: 1.15fr 1fr 0.85fr; gap: 3mm; margin: 2.4mm 0 0; padding: 0; list-style: none; }
  .pb-tips li { display: flex; flex-direction: column; gap: 1mm; padding: 2.2mm 3mm; background: var(--gray); font-size: 10.5pt; line-height: 1.45; }
  .pb-tips li.hot { background: #fdecea; border-top: 0.8mm solid #c62828; }
  .pb-tips li:not(.hot) { border-top: 0.8mm solid var(--line); }
  .pb-tips img { display: block; width: 100%; border-radius: 1mm; box-shadow: 0 0.3mm 1mm rgba(0,0,0,0.15); }
  .pb-tips span { color: var(--muted); }
  .pb-tips svg { width: 4mm; height: 4mm; vertical-align: -0.7mm; }
  .pb-home { margin-top: 2.6mm; padding: 2.4mm 4mm 3mm; background: #fdf3d9; border: 0.5mm solid #e8b64a; }
  .pb-home h3 { font-size: 12pt; }
  .pb-home h3 small { margin-left: 3mm; font-size: 10.5pt; font-weight: 400; color: var(--muted); }
  .pb-os { display: grid; grid-template-columns: 1.25fr 1fr; gap: 4mm; margin-top: 1.4mm; }
  .pb-os .os > b { font-size: 10.5pt; }
</style>`)
  },
  // 案B'（依頼者 2026-11-02：案Bでよいが、もとのスマホの画面の絵はあった方が分かりやすい）：「スマホで書く人へ」の左に画面の絵を縦に置き、
  // 「タップして書き、完了」を絵の下に添える。右に、気をつけること2つ（赤い帯・Classroom）と、ホーム画面に追加（おすすめ）
  c: (html) => {
    html = variants.b(html)
    const start = html.indexOf('  <ol class="pb-tips">')
    const end = html.indexOf('  <div class="pb-home">')
    const homeEnd = html.indexOf('  <p class="end">')
    const home = html.slice(end, homeEnd).trimEnd()
    html = html.slice(0, start) + `  <div class="pc-grid">
    <div class="pc-phone">
      <figure class="shot lift" data-shot="g-d-phone-add" data-badges="" aria-label="スマホで書いているところ" style="width:18mm"></figure>
      <p><b>タップして書き、<span class="btn">完了</span></b><br><span>図・表・見出しは<br>キーボードの上</span></p>
    </div>
    <div class="pc-right">
      <ol class="pb-tips two">
        <li class="hot"><img src="../../スライド/assets/student/full/s-phone-strip.png" alt="下の赤い帯"><b>下に赤い帯が出たら、押して直す</b></li>
        <li class="hot"><b>Classroom から開いたら、Safari・Chrome に切り替える</b><span>iPhone は右下の ${COMPASS}、Android は「⋮」→「Chrome で開く」</span></li>
      </ol>
${home.replace(/^ {2}/gm, '    ')}
    </div>
  </div>

` + html.slice(homeEnd)
    return html.replace('</style>', `  .pc-grid { display: grid; grid-template-columns: 31mm 1fr; gap: 3mm; margin-top: 2.4mm; align-items: stretch; }
  .pc-phone { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.4mm 1.6mm; background: var(--gray); border-top: 0.8mm solid var(--line); }
  .pc-phone p { margin-top: 1.8mm; font-size: 10.5pt; line-height: 1.45; text-align: center; }
  .pc-phone p span:not(.btn) { color: var(--muted); }
  .pb-tips.two { grid-template-columns: 1.05fr 1fr; margin-top: 0; }
  .pc-right .pb-home { margin-top: 2mm; padding: 2mm 3.6mm 2.4mm; }
  .pb-band { margin-top: 2.4mm; }
</style>`)
  },
}

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.6 })
  for (const [name, make] of Object.entries({ now: (h) => h, ...variants })) {
    const file = `docs/_mock_v89_${name}.html`
    writeFileSync(file, make(SRC))
    try {
      await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'networkidle0' })
      await page.evaluate(() => document.fonts.ready)
      await new Promise((r) => setTimeout(r, 600))
      const sheets = await page.$$('section.sheet')
      const info = await page.evaluate(() =>
        [...document.querySelectorAll('section.sheet')].map((s) => {
          const r = s.getBoundingClientRect()
          const over = Math.max(0, ...[...s.querySelectorAll('*')].map((e) => { const b = e.getBoundingClientRect(); return b.height > 0 ? b.bottom - r.bottom : 0 }))
          return { chars: s.innerText.replace(/\s/g, '').length, over }
        }),
      )
      for (const [i, el] of sheets.entries()) await el.screenshot({ path: `${OUT}/${name}-${i + 1}.png` })
      console.log(name, info.map((x, i) => `${i ? '裏' : '表'} ${x.chars}字${x.over > 1 ? `・はみ出し ${Math.round(x.over)}px` : ''}`).join(' ／ '))
    } finally {
      rmSync(file)
    }
  }
})
