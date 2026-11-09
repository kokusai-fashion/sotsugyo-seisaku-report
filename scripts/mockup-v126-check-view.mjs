// mockups/v126（2026-11-09）：点検表の画面の見本 その4（依頼者：最初の見本 v122 が良さそう。それをもとに少しブラッシュアップ）
//   見た目は v122 のまま（先生の色の札「山本 済み」・点線の「予定」・所属の色の帯・回ごとの進み具合のカード・許可のスイッチ・カードの丸）。
//   その後に決めたことを、見た目を崩さない範囲で足す：左の一覧のいちばん上に「点検表」／題の横でコースを切り替え／右上に「担当の割り振り」「この画面のリンク」
//   「スプレッドシートで開く」／範囲（自分の担当・コース全体）と見せ方（表・カード・担当の目線）の切り替え／担当の目線は「まだの分」から（前の回の残りが上）／
//   自分の担当の目印は控えめに（予定の札・丸の点線を紺に）／担当の割り振り（並び順で3等分のコースの例）
//   ① 表・コース全体　② カード・コース全体　③ 担当の目線・まだの分　④ 担当の割り振り　⑤ スマホ：担当の目線　⑥ スマホ：カード
//   学生・先生の名前はすべて作り物。使い方：node scripts/mockup-v126-check-view.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v126'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 見本の中身（v122 と同じ。1回目の残りが1人いる様子を足した） ----
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
const ME = '山本'
const TONE = { 山本: { bg: '#f8e1e4', ink: '#8a3442' }, 中村: { bg: '#e7efe6', ink: '#3d6342' }, 小川: { bg: '#f2ece0', ink: '#7a5a2c' }, 佐藤: { bg: '#f8e1e4', ink: '#8a3442' }, 加藤: { bg: '#e7efe6', ink: '#3d6342' }, 森: { bg: '#f2ece0', ink: '#7a5a2c' } }
const ROUNDS = ['1回目', '2回目', '3回目', '4回目', '抄録']
const who = (g, r) => T[(((g - r) % 3) + 3) % 3]
const STUDENTS = RAW.map(([name, g]) => ({ name, g }))
  .sort((a, b) => a.g - b.g)
  .map((s, i) => {
    const done = i === 8 ? 0 : i === 6 ? 1 : i % 5 === 2 ? 2 : 3
    return {
      ...s,
      no: i + 1,
      pdf: i === 6 ? '' : ['12/14', '12/15', '12/11', '12/9', '12/16', '11/20', '12/12'][i % 7],
      rounds: ROUNDS.map((label, r) => ({ label, t: who(s.g, r), done: r < done, at: `12/${2 + r * 4 + (i % 3)}` })),
      abstractOk: done >= 3,
      note: i === 6 ? 'PDF まだ' : i === 13 ? '書き換え 12/16' : '',
    }
  })
const doneCount = (r, list = STUDENTS) => list.filter((s) => s.rounds[r].done).length
const started = (r) => STUDENTS.some((s) => s.rounds[r].done)
const mine = (r) => STUDENTS.filter((s) => s.rounds[r].t === ME)
const myLeft = (r) => mine(r).filter((s) => !s.rounds[r].done)
const firstUpcoming = ROUNDS.findIndex((_, k) => !started(k))
const leftAll = ROUNDS.map((_, r) => (started(r) ? myLeft(r).length : 0)).reduce((a, b) => a + b, 0)

const I = {
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10A1.5 1.5 0 0118.5 6v13a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V6A1.5 1.5 0 017 4.5zM9.5 4.5V3h5v1.5M8.5 10.5l1.4 1.4 2.6-2.6M8.5 16l1.4 1.4 2.6-2.6M14.5 11h1.5M14.5 16.5h1.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M16 10.5a2.6 2.6 0 100-5.2M17.5 14.6c1.8.5 3 1.9 3.4 4.4"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
}

// ---- v122 の部品（そのまま）＋ 足した部品 ----
const CSS = `
.cv{display:flex;flex-direction:column;gap:14px;min-width:0}
.cv-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cv-top h1{margin:0;font-size:22px;display:flex;align-items:center;gap:10px}
.cv-top .course{display:inline-flex;align-items:center;gap:6px;font-size:16px;font-weight:700;color:#223;border:1px solid #cfd5de;border-radius:8px;background:#fff;padding:5px 12px}
.cv-top .course i{font-style:normal;color:#8a909a;font-size:11px}
.cv-top .acts{margin-left:auto;display:flex;gap:8px}
.cv-top .open{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfd5de;border-radius:8px;background:#fff;padding:7px 12px;font-size:13.5px;color:#334}
.cv-top .open svg{width:15px;height:15px;color:#667}
.cv-top .open i{width:12px;height:16px;border-radius:2px;background:#188038;display:inline-block}
.cv-filter{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:13.5px}
.cv-filter .k{color:#667;font-weight:600;margin-right:2px}
.cv-filter .right{margin-left:auto}
.chips{display:inline-flex;gap:6px;flex-wrap:wrap}
.chips span{padding:4px 11px;border-radius:999px;border:1px solid #cfd5de;background:#fff;color:#334}
.chips span.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
.vseg{display:inline-flex;border:1px solid #cfd5de;border-radius:8px;overflow:hidden;background:#fff}
.vseg span{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;font-size:13px;color:#334;border-left:1px solid #cfd5de}
.vseg span:first-child{border-left:0}
.vseg span.on{background:var(--accent);color:#fff;font-weight:700}
.vseg svg{width:15px;height:15px}
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
.tchip.plan.me{border-color:#5d77bd;color:#2c4a9a;font-weight:700;background:#f5f8fe}
.tog{display:inline-flex;align-items:center;justify-content:center;width:30px;height:20px;border-radius:999px;background:#e3e6ec;position:relative}
.tog:after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.tog.on{background:#2e8b57}
.tog.on:after{left:13px}
.pdf{color:#1a73e8;text-decoration:underline;font-size:12.5px}
.warn{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:700}
.warn.red{background:#fce8e6;color:#c5221f}
.warn.gray{background:#eef0f3;color:#6b7280}
.legend{display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#667}
/* 表 */
.ta{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.ta table{width:100%;border-collapse:collapse;font-size:13px}
.ta th{background:#f5f6f8;color:#556;font-size:12px;font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid #e3e6ec}
.ta td{padding:6px 8px;border-bottom:1px solid #eef0f4;vertical-align:middle}
.ta td.no{color:#8a909a;text-align:right;width:28px}
.ta td.nm{font-weight:700;white-space:nowrap}
.ta tr.gh td{padding:7px 10px;font-size:13px;font-weight:700}
.ta tr.gh .cnt{font-weight:400;color:#556;margin-left:10px;font-size:12.5px}
/* カード */
.gb{display:flex;flex-direction:column;gap:8px}
.gb h3{margin:4px 0 0;font-size:15px;display:flex;align-items:center;gap:10px}
.gb h3 small{font-weight:400;color:#667;font-size:12.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.card{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:10px 12px 10px 14px;position:relative;display:flex;flex-direction:column;gap:7px}
.card:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 3px 3px 0;background:var(--g)}
.card .row1{display:flex;align-items:baseline;gap:6px}
.card .row1 b{font-size:15px}
.card .row1 .pdf,.card .row1 .warn{margin-left:auto}
.dots{display:flex;gap:6px}
.dot{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:#8a909a;width:30px}
.dot i{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700}
.dot i.plan{border:1.5px dashed #b9bec7;color:#8a909a;background:#fff}
.dot i.plan.me{border-color:#5d77bd;color:#2c4a9a;background:#f5f8fe}
.badges{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px}
.badges span{padding:1px 7px;border-radius:6px;background:#f2f3f6;color:#667}
.badges span.ok{background:#fdf3d0;color:#7a5200;font-weight:700}
/* 担当の目線 */
.tabs{display:flex;gap:4px;border-bottom:2px solid #e3e6ec}
.tabs span{padding:8px 16px;font-size:14px;color:#556;border-radius:8px 8px 0 0}
.tabs span.on{background:#fff;border:2px solid #e3e6ec;border-bottom-color:#fff;margin-bottom:-2px;color:#1f3f6b;font-weight:700}
.tabs span em{font-style:normal;display:inline-block;margin-left:6px;background:#fce8e6;color:#c5221f;border-radius:999px;padding:0 7px;font-size:12px;font-weight:700}
.cgrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;align-items:start}
.col{display:flex;flex-direction:column;gap:12px}
.box{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:12px 14px}
.box h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:8px}
.box h3 small{font-weight:400;color:#667;font-size:12.5px}
.box h3 .left{font-size:12px;font-weight:700;color:#c5221f;background:#fce8e6;border-radius:999px;padding:1px 8px}
.box.fold h3{margin:0;color:#667;font-weight:400}
.task{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid #eef0f4;font-size:13.5px}
.task:first-of-type{border-top:0}
.task b{font-size:14.5px}
.task .btn2{border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700}
.task .btn2.strong{background:var(--accent);color:#fff}
.trow{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:7px 0}
.trow .nm{width:64px}
.trow .pbar{flex:1;margin:0}
.wait{font-size:13px;line-height:1.8;color:#334}
/* 割り振り */
.as-note{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:10px 14px;font-size:13.5px;color:#334;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.as-note b{font-weight:700}
.as-note small{color:#667}
.atab{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.atab table{width:100%;border-collapse:collapse}
.atab th{background:#f5f6f8;color:#556;font-size:12px;font-weight:600;text-align:left;padding:8px 12px;border-bottom:1px solid #e3e6ec}
.atab td{padding:10px 12px;border-bottom:1px solid #eef0f4}
.atab td small{display:block;color:#667;font-size:12px;margin-top:2px}
.pick{display:inline-flex;align-items:center;gap:8px;padding:4px 10px 4px 12px;border-radius:6px;font-size:13px;font-weight:700}
.pick:after{content:"▾";font-size:10px;opacity:.6}
.as-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btnp{background:var(--accent);color:#fff;border-radius:8px;padding:7px 14px;font-weight:700;font-size:13.5px}
.btns{border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:8px;padding:6px 14px;font-weight:700;font-size:13.5px}
.as-foot small{color:#667;font-size:12.5px;line-height:1.6}
`
const gtag = (g) => `<span class="gtag" style="background:${GTONE[g].bg};color:${GTONE[g].ink}">${GROUPS[g]}</span>`
const tchip = (x) => (x.done ? `<span class="tchip" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t} 済み</span>` : `<span class="tchip plan ${x.t === ME ? 'me' : ''}">${x.t} 予定</span>`)
const note = (n) => (!n ? '' : n.startsWith('書き換え') ? `<span class="warn red">${n}</span>` : `<span class="warn gray">${n}</span>`)
const pdf = (s) => (s.pdf ? `<span class="pdf">PDF ${s.pdf}</span>` : '<span class="warn gray">PDF まだ</span>')
const top = ({ course = '映画・舞台衣装デザイナー コース', assign = false } = {}) =>
  `<div class="cv-top"><h1>点検表 <span class="course">${course}<i>▾</i></span></h1><span class="acts"><span class="open">${assign ? `${I.list}点検にもどる` : `${I.people}担当の割り振り`}</span><span class="open">${I.link}この画面のリンク</span><span class="open"><i></i>スプレッドシートで開く</span></span></div>`
const filters = ({ scope, view, group = 0 }) =>
  `<div class="cv-filter"><span class="k">範囲</span><span class="chips"><span class="${scope === 0 ? 'on' : ''}">自分の担当（${ME}）</span><span class="${scope === 1 ? 'on' : ''}">コース全体</span></span>
   <span class="k">所属</span><span class="chips">${['すべて', ...GROUPS].map((g, i) => `<span class="${i === group ? 'on' : ''}">${g}</span>`).join('')}</span>
   <span class="right"><span class="k">見せ方</span> <span class="vseg"><span class="${view === 0 ? 'on' : ''}">${I.table}表</span><span class="${view === 1 ? 'on' : ''}">${I.card}カード</span><span class="${view === 2 ? 'on' : ''}">${I.list}担当の目線</span></span></span></div>`
const progress = () =>
  `<div class="prog">${ROUNDS.map((l, r) => {
    const n = doneCount(r)
    return `<div><b>${l}</b><span class="n">${n}<small>/ ${STUDENTS.length}人 済み</small></span><div class="pbar"><i style="width:${(n / STUDENTS.length) * 100}%"></i></div></div>`
  }).join('')}</div>`
const legend = () =>
  `<div class="legend"><span><span class="tchip" style="background:${TONE['山本'].bg};color:${TONE['山本'].ink}">山本 済み</span></span><span><span class="tchip plan">中村 予定</span></span><span><span class="tchip plan me">${ME} 予定</span> 自分の担当（青い点線）</span><span>札を押すと「済み」になります</span></div>`

// ① 表・コース全体
function planTable() {
  let rows = ''
  STUDENTS.forEach((s, i) => {
    if (i === 0 || STUDENTS[i - 1].g !== s.g) {
      const list = STUDENTS.filter((x) => x.g === s.g)
      rows += `<tr class="gh"><td colspan="11" style="background:${GTONE[s.g].bg};color:${GTONE[s.g].ink}">${GROUPS[s.g]}<span class="cnt">${list.length}人・3回目 ${doneCount(2, list)}人済み</span></td></tr>`
    }
    rows += `<tr><td class="no">${s.no}</td><td class="nm">${s.name}</td><td>${pdf(s)}</td>${s.rounds.map((x) => `<td>${tchip(x)}</td>`).join('')}<td><span class="tog ${s.abstractOk ? 'on' : ''}"></span></td><td><span class="tog"></span></td><td>${note(s.note === 'PDF まだ' ? '' : s.note)}</td></tr>`
  })
  return `<div class="cv">${top()}${filters({ scope: 1, view: 0 })}${progress()}${legend()}
  <div class="ta"><table><tr><th></th><th>氏名</th><th>最新 PDF</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}<th>抄録許可</th><th>最終提出可</th><th>知らせ</th></tr>${rows}</table></div></div>`
}

// ② カード・コース全体
const card = (s) => `<div class="card" style="--g:${GTONE[s.g].ink}">
      <div class="row1"><b>${s.name}</b>${s.note === '書き換え 12/16' ? note(s.note) : pdf(s)}</div>
      <div class="dots">${s.rounds.map((x) => `<span class="dot">${x.done ? `<i style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t[0]}</i>` : `<i class="plan ${x.t === ME ? 'me' : ''}">${x.t[0]}</i>`}${x.label.replace('回目', '')}</span>`).join('')}</div>
      <div class="badges"><span class="${s.abstractOk ? 'ok' : ''}">抄録許可 ${s.abstractOk ? '✓' : '—'}</span><span>最終提出可 —</span></div></div>`
function planCards() {
  const groups = GROUPS.map((_, g) => {
    const list = STUDENTS.filter((s) => s.g === g)
    return `<div class="gb"><h3>${gtag(g)}<small>${list.length}人・3回目 ${doneCount(2, list)}人済み</small></h3><div class="cards">${list.map(card).join('')}</div></div>`
  })
  return `<div class="cv">${top()}${filters({ scope: 1, view: 1 })}${progress()}
  <div class="legend">丸は回（1〜4・抄録）。色の付いた丸は済み、点線の丸は予定、青い点線は自分の担当です。カードを押すと、その学生の記録を直せます。</div>${groups.join('')}</div>`
}

// ③ 担当の目線・まだの分
function planMine() {
  const boxes = ROUNDS.map((l, r) => {
    const list = myLeft(r)
    if (!list.length) return ''
    const kind = started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
    if (kind === 'later') return `<div class="box fold"><h3>${l}・まだ先<small>${list.length}人　▸ 開く</small></h3></div>`
    const tasks = list.map((s) => `<div class="task"><span><b>${s.name}</b>　${gtag(s.g)}</span>${pdf(s)}${note(s.note === 'PDF まだ' ? '' : s.note) || '<span></span>'}<span class="btn2 ${kind === 'left' ? 'strong' : ''}">済みにする</span></div>`).join('')
    return `<div class="box"><h3>${l}${kind === 'left' ? '<span class="left">残り</span>' : ''}<small>${list.length}人</small></h3>${tasks}</div>`
  }).join('')
  const r = 2
  const others = T.map((t) => {
    const list = STUDENTS.filter((s) => s.rounds[r].t === t)
    const n = doneCount(r, list)
    return `<div class="trow"><span class="nm"><span class="tchip" style="background:${TONE[t].bg};color:${TONE[t].ink}">${t}</span></span><div class="pbar"><i style="width:${(n / list.length) * 100}%;background:${TONE[t].ink}"></i></div><span>${n} / ${list.length}人</span></div>`
  }).join('')
  return `<div class="cv">${top()}${filters({ scope: 0, view: 2 })}
  <div class="tabs"><span class="on">まだの分<em>${leftAll}</em></span>${ROUNDS.map((l) => `<span>${l}</span>`).join('')}</div>
  <div class="cgrid"><div class="col">${boxes}</div>
    <div class="col"><div class="box"><h3>3回目の進み具合<small>先生ごと</small></h3>${others}</div>
    <div class="box"><h3>次にできること</h3><div class="wait">・前の回で、まだ済んでいない学生：${leftAll}人<br>・PDF をまだ出していない学生：1人<br>・最終提出のあとに書き換えた学生：1人</div></div></div></div></div>`
}

// ④ 担当の割り振り
function planAssign() {
  const TT = ['佐藤', '加藤', '森']
  const at = (g, r) => TT[(((g - r) % 3) + 3) % 3]
  const han = [
    ['1班', '1〜9番　アオキ 〜 クボ'],
    ['2班', '10〜18番　コバヤシ 〜 チバ'],
    ['3班', '19〜27番　ツカモト 〜 ミウラ'],
  ]
  const rows = han
    .map(([h, sub], g) => `<tr><td><span class="gtag" style="background:${GTONE[g].bg};color:${GTONE[g].ink}">${h}</span><small>${sub}</small></td>${ROUNDS.map((_, r) => `<td><span class="pick" style="background:${TONE[at(g, r)].bg};color:${TONE[at(g, r)].ink}">${at(g, r)}</span></td>`).join('')}</tr>`)
    .join('')
  return `<div class="cv">${top({ course: 'スタイリスト・コーディネーター コース', assign: true })}
  <div class="as-note"><span>まとまり：<b>並び順で3等分</b></span><small>27人 → 9・9・9人（五十音順の上から）。人数が変わると分け直します。分け方は「コースごとの設定」で変えられます。</small></div>
  <div class="atab"><table><tr><th>班</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}</tr>${rows}</table></div>
  <div class="as-foot"><span class="btns">1回ずつずらして埋める</span><span class="btnp">点検表に入れる</span><small>1回目の先生を選んで「1回ずつずらして埋める」を押すと、2回目からは1班ずつずれて回ります。<br>点検表の回の欄に「佐藤 予定」などが入ります。「済み」の所は書き換えません。</small></div></div>`
}

// ---- スマホ ----
const PHONE = `
:root{--accent:#1e3a8a}
body{margin:0;background:#f4f5f8;font-family:'BIZ UDPGothic',sans-serif;color:#1f2430;width:390px}
.ptop{background:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e3e6ec}
.ptop .b{color:#1e3a8a;font-size:14px}.ptop h1{margin:0;font-size:18px}.ptop svg{width:20px;height:20px;margin-left:auto;color:#667}
.ph{padding:12px;display:flex;flex-direction:column;gap:10px}
.ph .course{font-size:13.5px;font-weight:700;color:#334}
.ph .course i{font-style:normal;color:#8a909a;font-size:11px;margin-left:4px}
.ph .chips{display:flex}
.ph .chips span{flex:1;text-align:center;padding:7px 4px}
.ph .vrow{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#667}
.ph .vrow .vseg{margin-left:auto}
.ph .tabs{overflow:hidden;white-space:nowrap}
.ph .tabs span{padding:7px 11px;font-size:13.5px}
.ph .task{grid-template-columns:minmax(0,1fr) auto;gap:4px 10px}
.ph .task .meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px}
.ph .task .btn2{grid-row:1 / span 2;grid-column:2;padding:10px 14px}
.ph .cards{grid-template-columns:1fr}
.ph .dot{flex:1;width:auto}
.ph .dot i{width:30px;height:30px;font-size:13px}
`
const phone = (inner) => `<!doctype html><meta charset="utf-8"><style>${CSS}${PHONE}</style><div class="ptop"><span class="b">‹ 一覧</span><h1>点検表</h1>${I.link}</div><div class="ph">${inner}</div>`
function phoneMine() {
  const boxes = ROUNDS.map((l, r) => {
    const list = myLeft(r)
    if (!list.length) return ''
    const kind = started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
    if (kind === 'later') return `<div class="box fold"><h3>${l}・まだ先<small>${list.length}人 ▸</small></h3></div>`
    const shown = kind === 'now' ? list.slice(0, 3) : list
    return `<div class="box"><h3>${l}${kind === 'left' ? '<span class="left">残り</span>' : ''}<small>${list.length}人</small></h3>${shown.map((s) => `<div class="task"><b>${s.name}</b><span class="btn2 ${kind === 'left' ? 'strong' : ''}">済み</span><span class="meta">${gtag(s.g)}${pdf(s)}</span></div>`).join('')}${list.length > shown.length ? `<div class="task" style="display:block;color:#667;font-size:13px;text-align:center">ほか ${list.length - shown.length}人 ▾</div>` : ''}</div>`
  }).join('')
  return phone(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
  <div class="chips"><span class="on">自分の担当</span><span>コース全体</span></div>
  <div class="vrow">見せ方<span class="vseg"><span>${I.table}</span><span>${I.card}</span><span class="on">${I.list}</span></span></div>
  <div class="tabs"><span class="on">まだの分<em>${leftAll}</em></span>${ROUNDS.slice(0, 4).map((l) => `<span>${l}</span>`).join('')}</div>${boxes}`)
}
function phoneCards() {
  const list = STUDENTS.filter((s) => s.g === 1)
  return phone(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
  <div class="chips"><span>自分の担当</span><span class="on">コース全体</span></div>
  <div class="vrow">見せ方<span class="vseg"><span>${I.table}</span><span class="on">${I.card}</span><span>${I.list}</span></span></div>
  <div class="vrow" style="gap:6px">所属 ${['すべて', '①', '②', '③'].map((g, i) => `<span class="gtag" style="${i === 2 ? 'background:#1e3a8a;color:#fff' : 'background:#fff;color:#334;border:1px solid #cfd5de'};padding:4px 12px">${g}</span>`).join('')}</div>
  <div class="gb"><h3>${gtag(1)}<small>${list.length}人・3回目 ${doneCount(2, list)}人済み</small></h3><div class="cards">${list.slice(0, 5).map(card).join('')}</div></div>`)
}

const scope = (css) => css.replace(/([^{}]+)\{/g, (m, sel) => sel.split(',').map((x) => (x.trim().startsWith('.cv') ? x.trim() : '.cv ' + x.trim())).join(',') + '{')
const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    for (const [name, make] of [['①表_コース全体', planTable], ['②カード_コース全体', planCards], ['③担当の目線_まだの分', planMine], ['④担当の割り振り_3等分のコース', planAssign]]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.addStyleTag({ content: scope(CSS) })
      await page.evaluate(
        (html, svg) => {
          const nav = document.querySelector('.side-nav')
          const first = nav.querySelector('button')
          const item = first.cloneNode(true)
          first.before(item)
          for (const b of nav.querySelectorAll('button')) {
            for (const c of [...b.classList].filter((c) => /active|on|cur|sel/.test(c))) b.classList.remove(c)
            b.removeAttribute('aria-current')
          }
          item.classList.add('on')
          const icon = item.querySelector('svg')
          if (icon) icon.outerHTML = svg
          const texts = [...item.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim())
          if (texts[0]) texts[0].textContent = '点検表'
          if (texts[1]) texts[1].textContent = '点検の予定と記録'
          const content = document.querySelector('section.content')
          const work = content.parentElement
          work.classList.add('wide')
          for (const el of [...work.children]) if (el !== content) el.style.display = 'none'
          content.innerHTML = html
        },
        make(),
        I.sheet,
      )
      await sleep(500)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
      await context.close()
    }
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    for (const [name, make] of [['⑤スマホ_担当の目線', phoneMine], ['⑥スマホ_カード', phoneCards]]) {
      await page.setContent(make(), { waitUntil: 'load' })
      await sleep(300)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
    }
  })
} finally {
  server.close()
}
