// mockups/v114（2026-11-05）：管理ページを、絵（ピクトグラム）を使って、硬すぎず、ひと目で分かるようにする案
//   依頼者：管理ページでできることが増えた。字が多く、記号や絵をあまり使っていない。もう少し感覚的に、見やすく、分かりやすく、使いやすく。
//   いちばんよく使う「コースごとの設定」（コースを開いたところ・先生の画面）で、3つの方向を見せる。選んだ方向を、管理ページ全体に広げる。
//   案A：絵の札と短い言葉（並びは今のまま。項目に色つきの絵を付け、説明は短い1行に。長い説明は「？」に重ねると出る）
//   案B：できることを絵のタイルで並べる（コースを開くと、まず絵のタイルと今の様子。押すと、その設定が下に開く）
//   案C：使う・使わないをスイッチで（選べることを、絵＋名前＋1行の説明＋右のスイッチの並びに。スマホの設定の画面のように）
//   試験用サーバーの管理ページに、部品を差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v114-admin-visual.mjs（Edge は 9339）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9339'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v114'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const I = {
  people: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M15.5 14.2a4.6 4.6 0 015.2 4.8"/>'),
  notice: svg('<path d="M5 10v4h3l5 4V6L8 10zM16.5 9.5a3.5 3.5 0 010 5"/>'),
  template: svg('<path d="M6.5 3.5h11A1.5 1.5 0 0119 5v14a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19V5a1.5 1.5 0 011.5-1.5zM8.5 8h7M8.5 11.5h7M8.5 15h4"/>'),
  table: svg('<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 10h17M3.5 14.5h17M9.5 5v14"/>'),
  stamp: svg('<path d="M9.5 4h5l-.8 6.5h-3.4zM6 13h12a1.5 1.5 0 011.5 1.5V17h-15v-2.5A1.5 1.5 0 016 13zM5.5 20.5h13"/>'),
  sheet: svg('<rect x="5.5" y="4.5" width="13" height="16" rx="1.5"/><path d="M9.5 4.5V3h5v1.5M8.5 10.5l1.4 1.4 2.6-2.6M8.5 16l1.4 1.4 2.6-2.6M14.5 11h1.5M14.5 16.5h1.5"/>'),
  subtitle: svg('<path d="M5 6.5h14M12 6.5V19M8.5 19h7"/>'),
  q: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 114 1.6c-.9.6-1.8 1.1-1.8 2.4M12 16.3v.1"/>'),
  open: svg('<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 014 18.5v-10A1.5 1.5 0 015.5 7H10"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
}

/** 色（絵の丸の色と、絵の色） */
const CSS = `
.mk-ic { flex: none; display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; }
.mk-ic svg { width: 20px; height: 20px; }
.c-people { background: #eceff4; color: #3f4a5e; }
.c-notice { background: #fff0dd; color: #b25e00; }
.c-template { background: #e8edf9; color: #1e3a8a; }
.c-table { background: #dff3ef; color: #0f6e63; }
.c-stamp { background: #f6e6ef; color: #a2336b; }
.c-sheet { background: #e5f3ea; color: #2f7d4f; }
.c-subtitle { background: #f1ecfb; color: #5b3fa6; }
.mk-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; line-height: 1; padding: 5px 9px; border-radius: 999px; white-space: nowrap; }
.mk-chip.on { background: #e5f3ea; color: #23633d; }
.mk-chip.off { background: #eef0f3; color: #5f6675; }
.mk-chip.draft { background: #fff4e0; color: #8a5100; }
.mk-chip svg { width: 14px; height: 14px; }
/* 案A */
.mk-a .grid { row-gap: 18px; grid-template-columns: 150px minmax(0, 1fr); }
.mk-a .lb > span:last-child { white-space: nowrap; }
.mk-a .lb { display: flex; align-items: flex-start; gap: 10px; }
.mk-a .lb > span:last-child { padding-top: 6px; }
.mk-a .lb small { display: block; }
.mk-a .ctl { padding-top: 2px; }
.mk-a .mk-q { display: inline-flex; vertical-align: -4px; margin-left: 4px; color: #7a8294; width: 18px; height: 18px; }
.mk-a .mk-q svg { width: 18px; height: 18px; }
.mk-a .mk-tip { position: relative; margin-top: 6px; background: #2b3242; color: #fff; font-size: 13px; line-height: 1.6; border-radius: 8px; padding: 8px 12px; max-width: 300px; }
.mk-a .mk-tip::before { content: ''; position: absolute; top: -6px; left: 186px; border: 6px solid transparent; border-top: 0; border-bottom-color: #2b3242; }
.mk-a .short { color: var(--muted); font-size: 13.5px; margin-top: 4px; }
/* 案B */
.mk-b .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mk-b .tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff; text-align: center; font-size: 14px; font-weight: 700; color: var(--ink); }
.mk-b .tile .mk-ic { width: 46px; height: 46px; }
.mk-b .tile .mk-ic svg { width: 26px; height: 26px; }
.mk-b .tile.sel { border: 2px solid var(--accent); background: #f7f9fe; padding: 13px 5px 11px; }
.mk-b .lead { font-size: 13.5px; color: var(--muted); margin: 2px 0 12px; }
.mk-b .detail { margin-top: 14px; border-top: 1px dashed var(--line); padding-top: 14px; }
.mk-b .detail h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 16px; }
.mk-b .detail h3 .mk-ic { width: 28px; height: 28px; }
.mk-b .detail h3 .mk-ic svg { width: 17px; height: 17px; }
/* 案C */
.mk-c .grp { font-size: 13px; font-weight: 700; color: var(--muted); letter-spacing: .04em; margin: 4px 0 6px; }
.mk-c .rows { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
.mk-c .row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.mk-c .row + .row { border-top: 1px solid var(--line); }
.mk-c .row .tx { flex: 1; min-width: 0; }
.mk-c .row .tx b { display: block; font-size: 15px; }
.mk-c .row .tx span { display: block; font-size: 13px; color: var(--muted); line-height: 1.5; }
.mk-sw { flex: none; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.mk-sw i { position: relative; width: 44px; height: 26px; border-radius: 13px; background: #cfd4dd; }
.mk-sw i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.mk-sw.on { color: #23633d; font-weight: 700; }
.mk-sw.on i { background: #2f7d4f; }
.mk-sw.on i::after { left: 21px; }
.mk-c .row .btn { flex: none; width: auto; min-width: 0; height: auto; display: inline-flex; align-items: center; justify-content: center; padding: 6px 14px; white-space: nowrap; }
.mk-c .sub { padding: 0 14px 12px 60px; font-size: 13px; color: var(--muted); }
`

/** 外の画面に、案の説明の札を置く */
const note = (page, { title, lines }) =>
  page.evaluate(
    ({ title, lines }) => {
      document.querySelector('#mk-note')?.remove()
      const d = document.createElement('div')
      d.id = 'mk-note'
      d.style.cssText = `box-sizing:border-box;position:fixed;left:800px;top:660px;width:600px;z-index:2147483647;background:#fffaf0;border:2px solid #b07d1a;border-radius:12px;padding:14px 18px;font:14px/1.7 'BIZ UDPGothic',sans-serif;color:#2b2b2b;box-shadow:0 6px 18px rgba(0,0,0,.18)`
      d.innerHTML = `<b style="display:block;font-size:16px;color:#8a5d00;margin-bottom:6px">${title}</b>${lines.map((l) => `<div>${l}</div>`).join('')}`
      document.documentElement.append(d)
    },
    { title, lines },
  )

async function openCourse(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.removeItem('sotsugyo-admin-mock')
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button')
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごと')).click())
  await sleep(600)
  await page.evaluate(() => {
    const c = document.querySelector('.course')
    if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
  })
  await sleep(800)
  await page.addStyleTag({ content: CSS })
  return { context, page }
}

/** 開いたコースの中身を、案の部品に入れ替える */
const fill = (page, cls, html) =>
  page.evaluate(
    ({ cls, html }) => {
      const body = document.querySelector('.course.open .cbody')
      body.classList.add(cls)
      body.innerHTML = html
      document.querySelector('.content').scrollTop = 0
    },
    { cls, html },
  )

const ADVISORS = `<span class="chips" style="display:flex;flex-wrap:wrap;gap:6px">${['梶田　貴子', '佐藤　綾', '加藤　淳之介'].map((n) => `<span class="mk-chip off" style="font-size:14px;padding:7px 10px;background:#eef2fb;color:#1e3a8a">${n}</span>`).join('')}</span>`

// ---- 案A：絵の札と短い言葉 ----
const A = `<div class="grid">
<div class="lb"><span class="mk-ic c-people">${I.people}</span><span>指導教員</span></div>
<div class="ctl">${ADVISORS}<div class="short">抄録に出ます</div></div>
<div class="lb"><span class="mk-ic c-notice">${I.notice}</span><span>お知らせ<small>任意</small></span></div>
<div class="ctl"><textarea class="in" rows="3" placeholder="例：12月4日（金）の中間発表では、本文の下書きを印刷して持ってきてください" style="width:100%"></textarea><div class="short">学生の画面の、セルフチェックの上に出ます</div></div>
<div class="lb"><span class="mk-ic c-template">${I.template}</span><span>ひな形<small>下書き</small></span></div>
<div class="ctl"><b style="font-size:14.5px">大見出し3・中見出し3・説明5・図の枠1・素材表1</b><div style="margin-top:6px"><button class="btn sub sm">ひな形を作る画面を開く</button></div></div>
<div class="lb"><span class="mk-ic c-table">${I.table}</span><span>表の空の行</span></div>
<div class="ctl"><label><input type="checkbox"> 使わない行は、空のままでよい</label><span class="mk-q">${I.q}</span><div class="short">空の行を「空いている所」に数えません</div></div>
<div class="lb"><span class="mk-ic c-stamp">${I.stamp}</span><span>先生の許可</span></div>
<div class="ctl"><label style="display:block"><input type="checkbox"> 抄録は、先生の許可のあと</label><label style="display:block"><input type="checkbox"> 提出用の PDF は、先生の許可のあと</label><span class="short" style="display:inline">点検表に ✓ を入れて許可します</span><span class="mk-q">${I.q}</span>
<div class="mk-tip">使わないときは今のまま。抄録は、学生が自分で「先生の許可が出た」を押します。PDF に「点検用」の印は入りません。</div></div>
<div class="lb"><span class="mk-ic c-sheet">${I.sheet}</span><span>点検表</span></div>
<div class="ctl"><button class="btn sub sm">点検表を開く</button> <button class="btn sub sm">学生の並びを直す</button><div class="short">学生は、ふりがなの順に自動で載ります</div></div>
</div>`

// ---- 案B：できることを絵のタイルで ----
const tile = (c, icon, name, chip, sel = false) => `<div class="tile${sel ? ' sel' : ''}"><span class="mk-ic ${c}">${icon}</span>${name}${chip}</div>`
const B = `<p class="lead">このコースでできること。押すと、下に設定が開きます。</p>
<div class="tiles">
${tile('c-people', I.people, '指導教員', '<span class="mk-chip on">3人</span>')}
${tile('c-notice', I.notice, 'お知らせ', '<span class="mk-chip off">出していない</span>', true)}
${tile('c-template', I.template, 'ひな形', '<span class="mk-chip draft">下書き</span>')}
${tile('c-table', I.table, '表の空の行', '<span class="mk-chip off">使っていない</span>')}
${tile('c-stamp', I.stamp, '先生の許可', '<span class="mk-chip off">使っていない</span>')}
${tile('c-sheet', I.sheet, '点検表', `<span class="mk-chip on">${I.open}開く</span>`)}
</div>
<div class="detail"><h3><span class="mk-ic c-notice">${I.notice}</span>お知らせ</h3>
<textarea class="in" rows="2" placeholder="例：12月4日（金）の中間発表では、本文の下書きを印刷して持ってきてください" style="width:100%"></textarea>
<div class="hint">学生の画面の、セルフチェックの上に出ます。</div></div>`

// ---- 案C：使う・使わないをスイッチで ----
const row = (c, icon, name, desc, right) => `<div class="row"><span class="mk-ic ${c}">${icon}</span><div class="tx"><b>${name}</b><span>${desc}</span></div>${right}</div>`
const sw = (on) => `<span class="mk-sw${on ? ' on' : ''}">${on ? '使う' : '使わない'}<i></i></span>`
const C = `<div class="grp">このコースの学生に出すもの</div>
<div class="rows">
${row('c-people', I.people, '指導教員', '梶田　貴子、佐藤　綾、加藤　淳之介（抄録に出ます）', '<button class="btn sub sm">直す</button>')}
${row('c-notice', I.notice, 'お知らせ', 'まだ出していません', '<button class="btn sub sm">書く</button>')}
${row('c-template', I.template, 'ひな形', '下書き（見出し6・図の枠1・素材表1）', '<button class="btn sub sm">作る画面を開く</button>')}
</div>
<div class="grp" style="margin-top:16px">コースで選べること</div>
<div class="rows">
${row('c-table', I.table, '表の空の行は、空のままでよい', '空の行を「空いている所」に数えません', sw(false))}
${row('c-stamp', I.stamp, '抄録は、先生の許可のあと', '点検表の「抄録許可」に ✓ を入れて許可します', sw(true))}
${row('c-stamp', I.stamp, '提出用の PDF は、先生の許可のあと', '点検表の「最終提出可」に ✓ を入れて許可します', sw(false))}
${row('c-sheet', I.sheet, '点検表', '学生は、ふりがなの順に自動で載ります', `<button class="btn sub sm">開く</button>`)}
</div>`

await withEdge(async (browser) => {
  {
    const { context, page } = await openCourse(browser)
    await note(page, { title: '今', lines: ['項目の名前と、灰色の長い説明が続きます。'] })
    await page.mouse.move(5, 5)
    await page.screenshot({ path: `${OUT}/今.png` })
    await context.close()
  }
  for (const [name, cls, html, title, lines] of [
    ['案A_絵の札と短い言葉', 'mk-a', A, '案A　絵の札と短い言葉', ['並びは今のまま。項目ごとに色つきの絵を付けます。', '説明は短い1行にして、くわしい説明は「？」に重ねると出ます（写真は「先生の許可」の「？」に重ねたところ）。']],
    ['案B_絵のタイル', 'mk-b', B, '案B　できることを絵のタイルで並べる', ['コースを開くと、まず絵のタイルと今の様子（使っている・使っていない）が並びます。', 'タイルを押すと、その設定が下に開きます（写真は「お知らせ」を押したところ）。']],
    ['案C_スイッチ', 'mk-c', C, '案C　使う・使わないをスイッチで', ['選べることを、絵・名前・1行の説明・右のスイッチの並びにします。', 'スマホの設定の画面に近い形です。', '「使う」「使わない」が、色とスイッチの向きでひと目で分かります。']],
  ]) {
    const { context, page } = await openCourse(browser)
    await fill(page, cls, html)
    await note(page, { title, lines })
    await page.mouse.move(5, 5)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    await context.close()
  }
})
console.log('ok')
