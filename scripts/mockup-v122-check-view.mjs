// mockups/v122（2026-11-09）：スプレッドシートに頼らない「点検表」の画面の見本（依頼者：もっと見やすく分かりやすい、ビジュアル的にも良い点検表を見てみたい）
//   管理ページの左の一覧に「点検表」を足し、その画面の案を3つ。中身はスプレッドシートと同じ（ここで ✓ を入れると、スプレッドシートにも入る想定）
//   案A 表のまま見やすく（所属ごとの見出し・回ごとの進み具合・済みは先生の色の札・✓ はボタン）
//   案B 学生ごとのカード（所属ごとに並べ、回は5つの丸。スマホでも見やすい）
//   案C 担当の先生の目線（回を選ぶと、自分の担当の学生だけ。「済みにする」を押す）
//   学生の名前・先生の名前はすべて作り物。使い方：node scripts/mockup-v122-check-view.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v122'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 見本の中身（v121 と同じ 26人・3つの所属。12月半ばの様子） ----
const RAW = [
  ['青木　美咲', 1], ['石田　遥', 0], ['上野　空', 2], ['遠藤　莉子', 0], ['太田　結衣', 1], ['金子　奈々', 2], ['木村　葵', 0], ['久保　芽依', 1], ['小林　陽菜', 2],
  ['斎藤　美緒', 0], ['清水　楓', 1], ['鈴木　彩花', 0], ['瀬川　真央', 2], ['高橋　咲良', 1], ['千葉　千尋', 0], ['塚本　七海', 2], ['寺田　優花', 1], ['中島　菜摘', 0],
  ['西村　里奈', 2], ['野口　杏', 1], ['長谷川　舞', 0], ['平野　凛', 2], ['福田　紗希', 1], ['星野　桃子', 0], ['前田　和花', 2], ['三浦　未来', 1],
]
const GROUPS = ['①グループ', '②グループ', '③グループ']
const GTONE = [
  { bg: '#d7e1f2', ink: '#2d4470' },
  { bg: '#e5d9f2', ink: '#56377c' },
  { bg: '#cfeaec', ink: '#1b5a5e' },
]
const T = ['山本', '中村', '小川']
const TONE = { 山本: { bg: '#f8e1e4', ink: '#8a3442' }, 中村: { bg: '#e7efe6', ink: '#3d6342' }, 小川: { bg: '#f2ece0', ink: '#7a5a2c' } }
const ROUNDS = ['1回目', '2回目', '3回目', '4回目', '抄録']
const who = (g, r) => T[(((g - r) % 3) + 3) % 3]
const STUDENTS = RAW.map(([name, g]) => ({ name, g }))
  .sort((a, b) => a.g - b.g)
  .map((s, i) => {
    const done = i === 6 ? 1 : i % 5 === 2 ? 2 : 3
    return {
      ...s,
      no: i + 1,
      pdf: i === 6 ? '' : ['12/14', '12/15', '12/11', '12/9', '12/16', '11/20', '12/12'][i % 7],
      rounds: ROUNDS.map((label, r) => ({ label, t: who(s.g, r), done: r < done })),
      abstractOk: done >= 3,
      finalOk: false,
      note: i === 6 ? 'PDF まだ' : i === 13 ? '書き換え 12/16' : '',
    }
  })
const doneCount = (r, list = STUDENTS) => list.filter((s) => s.rounds[r].done).length

// ---- 共通の部品 ----
const CSS = `
.cv{display:flex;flex-direction:column;gap:14px;min-width:0}
.cv-top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.cv-top h1{margin:0;font-size:22px}
.cv-top .sub{color:#5f6675;font-size:13.5px;margin-top:4px}
.cv-top .open{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:1px solid #cfd5de;border-radius:8px;background:#fff;padding:7px 12px;font-size:13.5px;color:#334}
.cv-top .open i{width:12px;height:16px;border-radius:2px;background:#188038;display:inline-block}
.cv-filter{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:13.5px}
.cv-filter .k{color:#667;font-weight:600}
.chips{display:inline-flex;gap:6px;flex-wrap:wrap}
.chips span{padding:4px 11px;border-radius:999px;border:1px solid #cfd5de;background:#fff;color:#334}
.chips span.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
.prog{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.prog > div{background:#fff;border:1px solid #e3e6ec;border-radius:10px;padding:8px 12px}
.prog b{display:block;font-size:13px;color:#334}
.prog .n{font-size:20px;font-weight:700;color:#1f3f6b}
.prog .n small{font-size:12px;color:#667;font-weight:400;margin-left:2px}
.pbar{height:6px;border-radius:3px;background:#e9ecf1;margin-top:6px;overflow:hidden}
.pbar i{display:block;height:100%;background:#4f7cc4;border-radius:3px}
.gtag{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12.5px;font-weight:700}
.tchip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.tchip.plan{background:#fff;border:1px dashed #b9bec7;color:#8a909a;font-weight:400}
.tog{display:inline-flex;align-items:center;justify-content:center;width:30px;height:20px;border-radius:999px;background:#e3e6ec;position:relative}
.tog:after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.tog.on{background:#2e8b57}
.tog.on:after{left:13px}
.pdf{color:#1a73e8;text-decoration:underline;font-size:12.5px}
.warn{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:700}
.warn.red{background:#fce8e6;color:#c5221f}
.warn.gray{background:#eef0f3;color:#6b7280}
/* 案A */
.ta{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.ta table{width:100%;border-collapse:collapse;font-size:13px}
.ta th{background:#f5f6f8;color:#556;font-size:12px;font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid #e3e6ec}
.ta td{padding:6px 8px;border-bottom:1px solid #eef0f4;vertical-align:middle}
.ta td.no{color:#8a909a;text-align:right;width:28px}
.ta td.nm{font-weight:700;white-space:nowrap}
.ta tr.gh td{padding:7px 10px;font-size:13px;font-weight:700}
.ta tr.gh .cnt{font-weight:400;color:#556;margin-left:10px;font-size:12.5px}
/* 案B */
.gb{display:flex;flex-direction:column;gap:8px}
.gb h3{margin:4px 0 0;font-size:15px;display:flex;align-items:center;gap:10px}
.gb h3 small{font-weight:400;color:#667;font-size:12.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.card{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:10px 12px 10px 14px;position:relative;display:flex;flex-direction:column;gap:7px}
.card:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 3px 3px 0;background:var(--g)}
.card .row1{display:flex;align-items:baseline;gap:6px}
.card .row1 b{font-size:15px}
.card .row1 .pdf{margin-left:auto}
.dots{display:flex;gap:6px}
.dot{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:#8a909a;width:30px}
.dot i{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700}
.dot i.plan{border:1.5px dashed #b9bec7;color:#8a909a;background:#fff}
.badges{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px}
.badges span{padding:1px 7px;border-radius:6px;background:#f2f3f6;color:#667}
.badges span.ok{background:#fdf3d0;color:#7a5200;font-weight:700}
/* 案C */
.tabs{display:flex;gap:4px;border-bottom:2px solid #e3e6ec}
.tabs span{padding:8px 16px;font-size:14px;color:#556;border-radius:8px 8px 0 0}
.tabs span.on{background:#fff;border:2px solid #e3e6ec;border-bottom-color:#fff;margin-bottom:-2px;color:#1f3f6b;font-weight:700}
.cgrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;align-items:start}
.box{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:12px 14px}
.box h3{margin:0 0 8px;font-size:15px}
.box h3 small{font-weight:400;color:#667;font-size:12.5px;margin-left:8px}
.task{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid #eef0f4;font-size:13.5px}
.task:first-of-type{border-top:0}
.task b{font-size:14.5px}
.task .btn2{border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700}
.task .doneat{color:#2e7d4f;font-size:12.5px;font-weight:700}
.task.done{color:#8a909a}
.task.done b{color:#556}
.trow{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:7px 0}
.trow .nm{width:64px}
.trow .pbar{flex:1;margin:0}
.wait{font-size:13px;line-height:1.8;color:#334}
`
const gtag = (g) => `<span class="gtag" style="background:${GTONE[g].bg};color:${GTONE[g].ink}">${GROUPS[g]}</span>`
const tchip = (x) => (x.done ? `<span class="tchip" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t} 済み</span>` : `<span class="tchip plan">${x.t} 予定</span>`)
const note = (n) => (!n ? '' : n.startsWith('書き換え') ? `<span class="warn red">${n}</span>` : `<span class="warn gray">${n}</span>`)
const pdf = (s) => (s.pdf ? `<span class="pdf">PDF ${s.pdf}</span>` : '<span class="warn gray">PDF まだ</span>')
const top = (sub) => `<div class="cv-top"><div><h1>点検表（映画・舞台衣装デザイナー コース）</h1><div class="sub">${sub}</div></div><span class="open"><i></i>スプレッドシートで開く</span></div>`
const progress = () =>
  `<div class="prog">${ROUNDS.map((l, r) => {
    const n = doneCount(r)
    return `<div><b>${l}</b><span class="n">${n}<small>/ ${STUDENTS.length}人 済み</small></span><div class="pbar"><i style="width:${(n / STUDENTS.length) * 100}%;background:#4f7cc4"></i></div></div>`
  }).join('')}</div>`
const filters = (group = 0, mine = false) =>
  `<div class="cv-filter"><span class="k">所属</span><span class="chips">${['すべて', ...GROUPS].map((g, i) => `<span class="${i === group ? 'on' : ''}">${g}</span>`).join('')}</span>
   <span class="k">担当</span><span class="chips"><span class="${mine ? '' : 'on'}">すべて</span><span class="${mine ? 'on' : ''}">自分（山本）</span></span></div>`

function planA() {
  let rows = ''
  STUDENTS.forEach((s, i) => {
    if (i === 0 || STUDENTS[i - 1].g !== s.g) {
      const list = STUDENTS.filter((x) => x.g === s.g)
      rows += `<tr class="gh"><td colspan="11" style="background:${GTONE[s.g].bg};color:${GTONE[s.g].ink}">${GROUPS[s.g]}<span class="cnt">${list.length}人・3回目 ${doneCount(2, list)}人済み</span></td></tr>`
    }
    rows += `<tr><td class="no">${s.no}</td><td class="nm">${s.name}</td><td>${pdf(s)}</td>${s.rounds.map((x) => `<td>${tchip(x)}</td>`).join('')}<td><span class="tog ${s.abstractOk ? 'on' : ''}"></span></td><td><span class="tog"></span></td><td>${note(s.note === 'PDF まだ' ? '' : s.note)}</td></tr>`
  })
  return `<div class="cv">${top('スプレッドシートと同じ中身です。ここで ✓ を入れると、スプレッドシートにも入ります。')}${progress()}${filters()}
  <div class="ta"><table><tr><th></th><th>氏名</th><th>最新 PDF</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}<th>抄録許可</th><th>最終提出可</th><th>知らせ</th></tr>${rows}</table></div></div>`
}

function planB() {
  const groups = GROUPS.map((name, g) => {
    const list = STUDENTS.filter((s) => s.g === g)
    const cards = list
      .map(
        (s) => `<div class="card" style="--g:${GTONE[s.g].ink}">
      <div class="row1"><b>${s.name}</b>${pdf(s)}</div>
      <div class="dots">${s.rounds.map((x) => `<span class="dot">${x.done ? `<i style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t[0]}</i>` : `<i class="plan">${x.t[0]}</i>`}${x.label.replace('回目', '')}</span>`).join('')}</div>
      <div class="badges"><span class="${s.abstractOk ? 'ok' : ''}">抄録許可 ${s.abstractOk ? '✓' : '—'}</span><span>最終提出可 —</span>${s.note && s.note !== 'PDF まだ' ? note(s.note) : ''}</div></div>`,
      )
      .join('')
    return `<div class="gb"><h3>${gtag(g)}<small>${list.length}人・3回目 ${doneCount(2, list)}人済み</small></h3><div class="cards">${cards}</div></div>`
  })
  return `<div class="cv">${top('丸は回（1〜4・抄録）。色の付いた丸は済み、点線の丸は予定です。カードを押すと、その学生の記録を直せます。')}${progress()}${filters()}${groups.join('')}</div>`
}

function planC() {
  const r = 2
  const mine = STUDENTS.filter((s) => s.rounds[r].t === '山本')
  const tasks = mine
    .map(
      (s, k) =>
        `<div class="task ${s.rounds[r].done ? 'done' : ''}"><span><b>${s.name}</b>　${gtag(s.g)}</span>${pdf(s)}${note(s.note === 'PDF まだ' ? '' : s.note) || '<span></span>'}${s.rounds[r].done ? `<span class="doneat">✓ 済み 12/${10 + (k % 5)}</span>` : '<span class="btn2">済みにする</span>'}</div>`,
    )
    .join('')
  const others = T.map((t) => {
    const list = STUDENTS.filter((s) => s.rounds[r].t === t)
    const n = doneCount(r, list)
    return `<div class="trow"><span class="nm"><span class="tchip" style="background:${TONE[t].bg};color:${TONE[t].ink}">${t}</span></span><div class="pbar"><i style="width:${(n / list.length) * 100}%;background:${TONE[t].ink}"></i></div><span>${n} / ${list.length}人</span></div>`
  }).join('')
  const waiting = STUDENTS.filter((s) => !s.rounds[2].done).length
  return `<div class="cv">${top('回を選ぶと、その回の自分の担当の学生だけが並びます。見終わったら「済みにする」。')}
  <div class="tabs">${ROUNDS.map((l, i) => `<span class="${i === r ? 'on' : ''}">${l}</span>`).join('')}</div>
  <div class="cgrid">
    <div class="box"><h3>山本先生の担当（3回目）<small>${mine.length}人・済み ${doneCount(r, mine)}人・まだ ${mine.length - doneCount(r, mine)}人</small></h3>${tasks}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="box"><h3>3回目の進み具合</h3>${others}</div>
      <div class="box"><h3>次にできること</h3><div class="wait">・3回目がまだの学生（全体）：${waiting}人<br>・PDF をまだ出していない学生：1人<br>・最終提出のあとに書き換えた学生：1人</div></div>
    </div>
  </div></div>`
}

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    for (const [key, make] of [['A', planA], ['B', planB], ['C', planC]]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.addStyleTag({ content: CSS })
      await page.evaluate((html) => {
        const nav = document.querySelector('.side-nav')
        const base = [...nav.querySelectorAll('button')].find((b) => b.textContent.includes('届いた声'))
        const item = base.cloneNode(true)
        base.after(item)
        for (const b of nav.querySelectorAll('button')) {
          for (const c of [...b.classList].filter((c) => /active|on|cur|sel/.test(c))) b.classList.remove(c)
          b.removeAttribute('aria-current')
        }
        item.classList.add('on')
        item.setAttribute('aria-current', 'page')
        const texts = [...item.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim())
        if (texts[0]) texts[0].textContent = '点検表'
        if (texts[1]) texts[1].textContent = '点検の予定と記録'
        const content = document.querySelector('section.content')
        const work = content.parentElement
        work.classList.add('wide')
        for (const el of [...work.children]) if (el !== content) el.style.display = 'none'
        content.innerHTML = html
      }, make())
      await sleep(500)
      await page.screenshot({ path: `${OUT}/案${key}.png` })
      console.log('saved', key)
      await context.close()
    }
  })
} finally {
  server.close()
}
