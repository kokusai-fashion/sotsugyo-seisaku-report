// mockups/v124（2026-11-09）：管理ページの「点検表」の画面の見本 その3（依頼者：v123 は見づらい → 枠を減らす・色を絞る・上の部分を軽くする方針で作り直す）
//   方針：枠はほとんど使わない（PDF は小さな文字のリンク、予定は灰色の字だけ）／色は先生の色（済み）と赤（残り）が主役、所属の色は見出しの小さな丸だけ／
//   上は2段（題とコース・ボタン／切り替え）、回の進み具合は細い帯1本／「済みにする」は行の右の丸（押すと ✓）／自分の担当は名前の前の小さな紺の点
//   ①〜⑥の並びは v123 と同じ。学生・先生の名前はすべて作り物。使い方：node scripts/mockup-v124-check-view.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v124'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------- 見本の中身（v123 と同じ） ----------------
const RAW = [
  ['青木　美咲', 1], ['石田　遥', 0], ['上野　空', 2], ['遠藤　莉子', 0], ['太田　結衣', 1], ['金子　奈々', 2], ['木村　葵', 0], ['久保　芽依', 1], ['小林　陽菜', 2],
  ['斎藤　美緒', 0], ['清水　楓', 1], ['鈴木　彩花', 0], ['瀬川　真央', 2], ['高橋　咲良', 1], ['千葉　千尋', 0], ['塚本　七海', 2], ['寺田　優花', 1], ['中島　菜摘', 0],
  ['西村　里奈', 2], ['野口　杏', 1], ['長谷川　舞', 0], ['平野　凛', 2], ['福田　紗希', 1], ['星野　桃子', 0], ['前田　和花', 2], ['三浦　未来', 1],
]
const GROUPS = ['①グループ', '②グループ', '③グループ']
const GDOT = ['#6f86b8', '#9a7fc4', '#5aa6ab']
const T = ['山本', '中村', '小川']
const ME = '山本'
const TONE = { 山本: { bg: '#f6e3e6', ink: '#8a3442' }, 中村: { bg: '#e6efe5', ink: '#3d6342' }, 小川: { bg: '#f1ebdf', ink: '#7a5a2c' }, 佐藤: { bg: '#f6e3e6', ink: '#8a3442' }, 加藤: { bg: '#e6efe5', ink: '#3d6342' }, 森: { bg: '#f1ebdf', ink: '#7a5a2c' } }
const ROUNDS = ['1回目', '2回目', '3回目', '4回目', '抄録']
const who = (g, r) => T[(((g - r) % 3) + 3) % 3]
const S = RAW.map(([name, g]) => ({ name, g }))
  .sort((a, b) => a.g - b.g)
  .map((s, i) => {
    const done = i === 8 ? 0 : i === 6 ? 1 : i % 5 === 2 ? 2 : 3
    return {
      ...s,
      no: i + 1,
      pdf: i === 6 ? '' : ['12/14', '12/15', '12/11', '12/9', '12/16', '11/20', '12/12'][i % 7],
      rounds: ROUNDS.map((label, r) => ({ label, r, t: who(s.g, r), done: r < done, at: `12/${2 + r * 4 + (i % 3)}` })),
      abstractOk: done >= 3,
      note: i === 13 ? '書き換え 12/16' : '',
    }
  })
const started = (r) => S.some((s) => s.rounds[r].done)
const doneN = (r, list = S) => list.filter((s) => s.rounds[r].done).length
const mine = (r) => S.filter((s) => s.rounds[r].t === ME)
const myLeft = (r) => mine(r).filter((s) => !s.rounds[r].done)
const firstUpcoming = ROUNDS.findIndex((_, k) => !started(k))

// ---------------- 部品 ----------------
const I = {
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10A1.5 1.5 0 0118.5 6v13a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V6A1.5 1.5 0 017 4.5zM9.5 4.5V3h5v1.5M8.5 10.5l1.4 1.4 2.6-2.6M8.5 16l1.4 1.4 2.6-2.6M14.5 11h1.5M14.5 16.5h1.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M16 10.5a2.6 2.6 0 100-5.2M17.5 14.6c1.8.5 3 1.9 3.4 4.4"/></svg>',
}
const gname = (g) => `<span class="gname"><i style="background:${GDOT[g]}"></i>${GROUPS[g]}</span>`
const pdf = (s) => (s.pdf ? `<span class="pdf">PDF ${s.pdf}</span>` : '<span class="muted">PDF まだ</span>')
const note = (s) => (s.note ? `<span class="red">${s.note}</span>` : '')
const done = (x) => `<span class="done" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t}</span>`
const plan = (x) => `<span class="plan">${x.t}</span>`
const cell = (x) => `${x.t === ME ? '<i class="me"></i>' : ''}${x.done ? done(x) : plan(x)}`
const check = (on) => `<span class="ck ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
const seg = (items, on) => `<span class="seg">${items.map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</span>`

const CSS = `
.cv{display:flex;flex-direction:column;gap:14px;min-width:0;font-size:14px;color:#1f2430}
.h1row{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.h1row h1{margin:0;font-size:22px;letter-spacing:.02em}
.h1row .course{font-size:15px;color:#3a4150;font-weight:700}
.h1row .course i{font-style:normal;color:#8a909a;font-size:12px;margin-left:4px}
.h1row .acts{margin-left:auto;display:flex;gap:18px;align-items:center}
.qbtn{display:inline-flex;align-items:center;gap:5px;color:#4a5160;font-size:13.5px}
.qbtn svg{width:16px;height:16px;color:#6b7280}
.ctrl{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.seg{display:inline-flex;background:#e9ecf1;border-radius:9px;padding:3px;gap:2px}
.seg span{padding:5px 13px;border-radius:7px;font-size:13.5px;color:#4a5160;display:inline-flex;align-items:center;gap:5px}
.seg span.on{background:#fff;color:#1f2430;font-weight:700;box-shadow:0 1px 2px rgba(20,30,60,.12)}
.seg svg{width:16px;height:16px}
.sel{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;color:#4a5160}
.sel b{color:#1f2430}
.sel i{font-style:normal;color:#8a909a;font-size:11px}
.ctrl .right{margin-left:auto}
.strip{display:flex;gap:22px;flex-wrap:wrap;align-items:center;font-size:13px;color:#4a5160}
.strip span{display:inline-flex;align-items:center;gap:8px}
.strip .bar{width:70px;height:4px;border-radius:2px;background:#e3e6ec;overflow:hidden;display:inline-block}
.strip .bar i{display:block;height:100%;background:#7d93c4}
.strip b{color:#1f2430;font-weight:700}
.strip .on{color:#1f2430;font-weight:700;border-bottom:2px solid #1e3a8a;padding-bottom:2px}
.surface{background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(20,30,60,.06)}
.sh{display:flex;align-items:baseline;gap:10px;padding:14px 18px 6px;font-size:15px;font-weight:700}
.sh small{font-weight:400;color:#6b7280;font-size:12.5px}
.sh .red{font-size:12.5px}
.sh.fold{color:#6b7280;font-weight:400;padding:12px 18px}
.row{display:grid;grid-template-columns:minmax(0,1fr) 140px 120px 40px;align-items:center;gap:12px;padding:10px 18px;border-top:1px solid #f1f3f6;font-size:14px}
.row b{font-size:15px;font-weight:700;margin-right:12px}
.gname{display:inline-flex;align-items:center;gap:5px;color:#6b7280;font-size:12.5px;white-space:nowrap}
.gname i{width:7px;height:7px;border-radius:50%;display:inline-block}
.pdf{color:#2a5bd7;font-size:13px;white-space:nowrap}
.muted{color:#9aa0a8;font-size:13px}
.red{color:#c5221f;font-size:12.5px;font-weight:700;white-space:nowrap}
.ck{width:26px;height:26px;border-radius:50%;border:1.5px solid #c3c8d0;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;justify-self:end}
.ck.on{background:#2e7d4f;border-color:#2e7d4f}
.done{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12.5px;font-weight:700;white-space:nowrap}
.plan{color:#9aa0a8;font-size:12.5px;padding:2px 4px;white-space:nowrap}
.me{display:inline-block;width:6px;height:6px;border-radius:50%;background:#1e3a8a;margin-right:5px;vertical-align:middle}
.legend{display:flex;gap:16px;align-items:center;color:#6b7280;font-size:12.5px;flex-wrap:wrap}
/* 表 */
.tb{width:100%;border-collapse:collapse;font-size:13.5px}
.tb th{color:#6b7280;font-size:12px;font-weight:600;text-align:left;padding:12px 10px 8px;white-space:nowrap}
.tb td{padding:9px 10px;border-top:1px solid #f1f3f6;white-space:nowrap}
.tb td.no{color:#9aa0a8;width:26px;text-align:right}
.tb td.nm{font-weight:700}
.tb tr.gh td{border-top:0;padding:16px 10px 6px;font-weight:700;font-size:13.5px;color:#3a4150}
.tb tr.gh small{font-weight:400;color:#6b7280;margin-left:8px;font-size:12px}
.tb .okmark{color:#2e7d4f;font-weight:700}
.tb .nomark{color:#c3c8d0}
/* カード */
.split{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}
.gtitle{display:flex;align-items:baseline;gap:8px;font-weight:700;font-size:14px;color:#3a4150;margin:4px 2px 8px}
.gtitle small{font-weight:400;color:#6b7280;font-size:12.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:10px;margin-bottom:12px}
.cd{background:#fff;border-radius:12px;box-shadow:0 1px 2px rgba(20,30,60,.07);padding:11px 13px;display:flex;flex-direction:column;gap:9px}
.cd.sel{box-shadow:0 0 0 2px #1e3a8a,0 6px 16px rgba(30,58,138,.12)}
.cd .t{display:flex;align-items:baseline;gap:8px}
.cd .t b{font-size:15px}
.cd .t .pdf,.cd .t .red,.cd .t .muted{margin-left:auto}
.rd{display:flex;gap:6px}
.rd span{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:#9aa0a8}
.rd i{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700;background:#f1f3f6;color:#9aa0a8}
.rd em{width:4px;height:4px;border-radius:50%;background:#1e3a8a;display:block}
.rd em.no{background:transparent}
.cd .f{display:flex;gap:10px;font-size:12px;color:#6b7280}
.cd .f .ok{color:#7a5200;font-weight:700}
.panel{background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(20,30,60,.10);padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.panel .hd{display:flex;align-items:center;gap:10px}
.panel .hd b{font-size:18px}
.panel .hd .x{margin-left:auto;color:#9aa0a8;font-size:18px}
.panel .lbl{font-size:12px;color:#6b7280;font-weight:700}
.pr{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #f1f3f6;font-size:13.5px}
.pr:first-of-type{border-top:0}
.pr .r{color:#4a5160;font-weight:700;font-size:13px}
.pr .at{color:#2e7d4f;font-size:12.5px}
.pr .go{color:#1e3a8a;font-weight:700;font-size:13px}
.sw{display:flex;align-items:center;justify-content:space-between;font-size:13.5px;padding:4px 0}
.tg{width:34px;height:20px;border-radius:999px;background:#d9dde4;position:relative;display:inline-block}
.tg:after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}
.tg.on{background:#2e7d4f}
.tg.on:after{left:17px}
/* 割り振り */
.as-info{display:flex;flex-wrap:wrap;gap:6px 22px;align-items:baseline;font-size:13.5px;color:#4a5160}
.as-info b{color:#1f2430}
.at{width:100%;border-collapse:collapse}
.at th{color:#6b7280;font-size:12px;font-weight:600;padding:14px 12px 8px;text-align:left}
.at td{padding:11px 12px;border-top:1px solid #f1f3f6;font-size:14px}
.at td.h{font-weight:700;width:190px}
.at td.h small{display:block;font-weight:400;color:#6b7280;font-size:12px}
.tp{display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:13.5px;color:#1f2430}
.tp i{width:10px;height:10px;border-radius:50%;display:inline-block}
.tp:after{content:"▾";color:#9aa0a8;font-size:10px;margin-left:2px}
.tp.auto{color:#4a5160;font-weight:400}
.as-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.bp{background:#1e3a8a;color:#fff;border-radius:9px;padding:8px 16px;font-weight:700;font-size:13.5px}
.bs{color:#1e3a8a;font-weight:700;font-size:13.5px;padding:8px 6px}
.hint{color:#6b7280;font-size:12.5px;line-height:1.7}
`
// パソコンの上の2段
const top = ({ tab = '点検', course = '映画・舞台衣装デザイナー コース', ctrl = '' } = {}) => `
<div class="h1row"><h1>点検表</h1><span class="course">${course}<i>▾</i></span>
  <span class="acts">${tab === '点検' ? `<span class="qbtn">${I.people}担当の割り振り</span>` : `<span class="qbtn">${I.list}点検にもどる</span>`}<span class="qbtn">${I.link}この画面のリンク</span><span class="qbtn">${I.grid}スプレッドシート</span></span></div>
${ctrl}`
const controls = ({ scope, view }) => `<div class="ctrl">${seg(['自分の担当', 'コース全体'], scope)}<span class="sel">所属 <b>すべて</b><i>▾</i></span><span class="right">${seg([I.list, I.grid, I.card], view)}</span></div>`
const stripAll = () =>
  `<div class="strip">${ROUNDS.map((l, r) => {
    const n = doneN(r)
    return `<span>${l} <span class="bar"><i style="width:${(n / S.length) * 100}%"></i></span><b>${n}</b>/${S.length}</span>`
  }).join('')}</div>`
const stripMine = () => {
  const left = ROUNDS.map((_, r) => (started(r) ? myLeft(r).length : 0)).reduce((a, b) => a + b, 0)
  return `<div class="strip"><span class="on">まだの分 ${left}人</span>${ROUNDS.map((l, r) => `<span>${l} <b>${doneN(r, mine(r))}</b>/${mine(r).length}</span>`).join('')}</div>`
}

// ① リスト・自分の担当・まだの分
function pcList() {
  const blocks = ROUNDS.map((l, r) => {
    const left = myLeft(r)
    if (!left.length) return ''
    const kind = started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
    if (kind === 'later') return `<div class="sh fold">${l}・まだ先（${left.length}人）　▸</div>`
    const head = `<div class="sh">${l}${kind === 'left' ? '<span class="red">残り</span>' : ''}<small>${left.length}人</small></div>`
    const rows = left.map((s) => `<div class="row"><span><b>${s.name}</b>${gname(s.g)}</span>${pdf(s)}<span>${note(s)}</span>${check(false)}</div>`).join('')
    return head + rows
  }).join('')
  return `<div class="cv">${top({ ctrl: controls({ scope: 0, view: 0 }) })}${stripMine()}<div class="surface" style="padding-bottom:6px;max-width:920px">${blocks}</div>
  <div class="legend">右の丸を押すと「済み」になります（もう一度押すと戻ります）。前の回で済んでいない学生は、済むまで上に残ります。</div></div>`
}

// ② 表・コース全体
function pcTable() {
  let rows = ''
  S.forEach((s, i) => {
    if (i === 0 || S[i - 1].g !== s.g) {
      const list = S.filter((x) => x.g === s.g)
      rows += `<tr class="gh"><td colspan="11">${gname(s.g).replace('gname', 'gname" style="color:#3a4150;font-size:13.5px;font-weight:700')}<small>${list.length}人</small></td></tr>`
    }
    rows += `<tr><td class="no">${s.no}</td><td class="nm">${s.name}</td><td>${pdf(s)}</td>${s.rounds.map((x) => `<td>${cell(x)}</td>`).join('')}<td>${s.abstractOk ? '<span class="okmark">✓</span>' : '<span class="nomark">—</span>'}</td><td><span class="nomark">—</span></td><td>${note(s)}</td></tr>`
  })
  return `<div class="cv">${top({ ctrl: controls({ scope: 1, view: 1 }) })}${stripAll()}
  <div class="surface"><table class="tb"><tr><th></th><th>氏名</th><th>最新 PDF</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}<th>抄録許可</th><th>最終提出可</th><th>知らせ</th></tr>${rows}</table></div>
  <div class="legend"><span>${done({ t: '山本' })}　済み</span><span>${plan({ t: '山本' })}　予定</span><span><i class="me"></i>自分の担当</span><span>欄を押すと「済み」になります</span></div></div>`
}

// ③ カード・コース全体と右の欄
const cardHtml = (s, sel = false) => `<div class="cd ${sel ? 'sel' : ''}"><div class="t"><b>${s.name}</b>${s.note ? note(s) : pdf(s)}</div>
  <div class="rd">${s.rounds.map((x) => `<span>${x.done ? `<i style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t[0]}</i>` : `<i>${x.t[0]}</i>`}${x.label.replace('回目', '')}<em class="${x.t === ME ? '' : 'no'}"></em></span>`).join('')}</div>
  <div class="f"><span class="${s.abstractOk ? 'ok' : ''}">抄録許可 ${s.abstractOk ? '✓' : '—'}</span><span>最終提出可 —</span></div></div>`
function pcCards() {
  const pick = S.find((s) => s.name === '塚本　七海')
  const groups = GROUPS.map((_, g) => {
    const list = S.filter((s) => s.g === g)
    return `<div class="gtitle">${gname(g).replace('gname', 'gname" style="color:#3a4150;font-size:14px;font-weight:700')}<small>${list.length}人</small></div><div class="cards">${list.map((s) => cardHtml(s, s === pick)).join('')}</div>`
  })
  const panel = `<div class="panel"><div class="hd"><b>${pick.name}</b>${gname(pick.g)}<span class="x">×</span></div>
    <div>${pdf(pick)}</div>
    <div><div class="lbl">点検の回</div>${pick.rounds
      .map((x) => `<div class="pr"><span class="r">${x.label}</span><span>${cell(x)}</span>${x.done ? `<span class="at">済み ${x.at}</span>` : x.t === ME ? `<span class="go">済みにする</span>` : '<span class="muted">予定</span>'}</div>`)
      .join('')}</div>
    <div><div class="lbl">許可</div><div class="sw">抄録許可 <span class="tg ${pick.abstractOk ? 'on' : ''}"></span></div><div class="sw">最終提出可 <span class="tg"></span></div><div class="sw">教務提出 <span class="tg"></span></div></div></div>`
  return `<div class="cv">${top({ ctrl: controls({ scope: 1, view: 2 }) })}${stripAll()}<div class="split"><div>${groups.join('')}</div>${panel}</div>
  <div class="legend"><span>色の丸：済み　灰色の丸：予定</span><span>丸の下の紺の点：自分の担当</span></div></div>`
}

// ④ 担当の割り振り（並び順で3等分するコースの例）
function pcAssign() {
  const TT = ['佐藤', '加藤', '森']
  const han = [
    ['1班', '1〜9番　アオキ 〜 クボ'],
    ['2班', '10〜18番　コバヤシ 〜 チバ'],
    ['3班', '19〜27番　ツカモト 〜 ミウラ'],
  ]
  const at = (g, r) => TT[(((g - r) % 3) + 3) % 3]
  const tp = (t, auto) => `<span class="tp ${auto ? 'auto' : ''}"><i style="background:${TONE[t].ink}"></i>${t}</span>`
  const rows = han.map(([h, sub], g) => `<tr><td class="h">${h}<small>${sub}</small></td>${ROUNDS.map((_, r) => `<td>${tp(at(g, r), r > 0)}</td>`).join('')}</tr>`).join('')
  return `<div class="cv">${top({ tab: '割り振り', course: 'スタイリスト・コーディネーター コース' })}
  <div class="as-info"><span>まとまり：<b>並び順で3等分</b>（27人 → 9・9・9人。人数が変わると分け直します）</span><span class="qbtn" style="font-size:12.5px">分け方を変える（コースごとの設定）</span></div>
  <div class="surface"><table class="at"><tr><th>班</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}</tr>${rows}</table></div>
  <div class="as-foot"><span class="bs">1回ずつずらして埋める</span><span class="bp">点検表に入れる</span><span class="hint">1回目の先生を選び「1回ずつずらして埋める」を押すと、2回目からは1班ずつずれて回ります。<br>点検表の回の欄に「佐藤 予定」などが入ります。「済み」の所は書き換えません。</span></div></div>`
}

// ---------------- スマホ ----------------
const PHONE_CSS = `
:root{--accent:#1e3a8a}
body{margin:0;background:#f4f5f8;font-family:'BIZ UDPGothic',sans-serif;color:#1f2430;width:390px}
.pt{background:#fff;padding:12px 16px 10px;display:flex;align-items:center;gap:10px;box-shadow:0 1px 0 #eceef2}
.pt .back{color:#1e3a8a;font-size:14px}
.pt h1{margin:0;font-size:17px}
.pt .lk{margin-left:auto;color:#6b7280}
.pt .lk svg{width:20px;height:20px}
.pc{padding:12px 14px 20px;display:flex;flex-direction:column;gap:12px}
.pc .course{font-size:13px;color:#4a5160;font-weight:700}
.pc .course i{font-style:normal;color:#9aa0a8;font-size:11px;margin-left:3px}
.pc .line{display:flex;align-items:center;gap:8px}
.pc .line .seg{flex:1}
.pc .line .seg span{flex:1;justify-content:center;padding:7px 6px}
.pc .vs span{padding:7px 9px}
.pc .vs svg{width:17px;height:17px}
.pc .chipsx{display:flex;gap:16px;font-size:13.5px;color:#6b7280;overflow:hidden;white-space:nowrap}
.pc .chipsx .on{color:#1f2430;font-weight:700;border-bottom:2px solid #1e3a8a;padding-bottom:3px}
.pc .surface .sh{padding:12px 14px 4px}
.pc .it{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:center;gap:2px 10px;padding:11px 14px;border-top:1px solid #f1f3f6}
.pc .it b{font-size:16px}
.pc .it .meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pc .it .ck{grid-row:1 / span 2;grid-column:2;width:36px;height:36px;justify-self:center}
.pc .more{padding:10px 14px;color:#6b7280;font-size:13px;border-top:1px solid #f1f3f6;text-align:center}
.pc .cards{grid-template-columns:1fr;margin:0}
.pc .rd i{width:30px;height:30px;font-size:13px}
.pc .rd span{font-size:11px}
`
const phone = (inner) => `<!doctype html><meta charset="utf-8"><style>${CSS}${PHONE_CSS}</style><div class="pt"><span class="back">‹ 一覧</span><h1>点検表</h1><span class="lk">${I.link}</span></div><div class="pc">${inner}</div>`
function phList() {
  const left = ROUNDS.map((_, r) => (started(r) ? myLeft(r).length : 0)).reduce((a, b) => a + b, 0)
  const blocks = ROUNDS.map((l, r) => {
    const list = myLeft(r)
    if (!list.length) return ''
    const kind = started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
    if (kind === 'later') return `<div class="sh fold">${l}・まだ先（${list.length}人）　▸</div>`
    const shown = kind === 'now' ? list.slice(0, 4) : list
    return `<div class="sh">${l}${kind === 'left' ? '<span class="red">残り</span>' : ''}<small>${list.length}人</small></div>${shown.map((s) => `<div class="it"><b>${s.name}</b>${check(false)}<span class="meta">${gname(s.g)}${pdf(s)}${note(s)}</span></div>`).join('')}${list.length > shown.length ? `<div class="more">ほか ${list.length - shown.length}人を見る</div>` : ''}`
  }).join('')
  return phone(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
    <div class="line">${seg(['自分の担当', 'コース全体'], 0)}<span class="vs">${seg([I.list, I.grid, I.card], 0)}</span></div>
    <div class="chipsx"><span class="on">まだの分 ${left}</span>${ROUNDS.map((l) => `<span>${l}</span>`).join('')}</div>
    <div class="surface" style="padding-bottom:4px">${blocks}</div>`)
}
function phCards() {
  const list = S.filter((s) => s.g === 1)
  return phone(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
    <div class="line">${seg(['自分の担当', 'コース全体'], 1)}<span class="vs">${seg([I.list, I.grid, I.card], 2)}</span></div>
    <div class="chipsx"><span>すべて</span>${GROUPS.map((g, i) => `<span class="${i === 1 ? 'on' : ''}">${g}</span>`).join('')}</div>
    <div class="cards">${list.slice(0, 5).map((s) => cardHtml(s)).join('')}</div>`)
}

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    for (const [name, make] of [['①PC_リスト_自分の担当_まだの分', pcList], ['②PC_表_コース全体', pcTable], ['③PC_カード_コース全体と右の欄', pcCards], ['④PC_担当の割り振り_3等分のコース', pcAssign]]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.addStyleTag({ content: CSS.replace(/([^{}]+){/g, (m, sel) => sel.split(',').map((x) => (x.trim().startsWith('.cv') ? x.trim() : '.cv ' + x.trim())).join(',') + '{') })
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
          item.setAttribute('aria-current', 'page')
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
    for (const [name, make] of [['⑤スマホ_リスト_自分の担当_まだの分', phList], ['⑥スマホ_カード_コース全体', phCards]]) {
      await page.setContent(make(), { waitUntil: 'load' })
      await sleep(300)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
    }
  })
} finally {
  server.close()
}
