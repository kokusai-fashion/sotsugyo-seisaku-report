// mockups/v125（2026-11-09）：点検表の画面の「見た目の方向性」3案（依頼者：v124 もしっくりこない。仕組みは良いので、見た目を組み直してほしい）
//   案A「確認印」：紙の点検表に判を押す。済みは朱色の丸い印（先生の名字）、予定は灰色の字、自分の担当は付箋の淡い黄色。見出しは明朝
//   案B「進み具合が主役」：回ごとの達成率を丸いグラフで大きく。所属ごとに学生を札で並べ、回は5つの点（済み＝緑・予定＝灰・自分の担当＝紺の輪）
//   案C「表を洗練」：スプレッドシートに近い表。済みは緑の ✓ と名字、予定は灰色の字、自分の担当は淡い青の地。行は1行おきに薄い地
//   それぞれ、パソコン（コース全体）とスマホ（自分の担当・まだの分）。学生・先生の名前はすべて作り物。
//   使い方：node scripts/mockup-v125-check-styles.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v125'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------- 見本の中身（v123・v124 と同じ） ----------------
const RAW = [
  ['青木　美咲', 1], ['石田　遥', 0], ['上野　空', 2], ['遠藤　莉子', 0], ['太田　結衣', 1], ['金子　奈々', 2], ['木村　葵', 0], ['久保　芽依', 1], ['小林　陽菜', 2],
  ['斎藤　美緒', 0], ['清水　楓', 1], ['鈴木　彩花', 0], ['瀬川　真央', 2], ['高橋　咲良', 1], ['千葉　千尋', 0], ['塚本　七海', 2], ['寺田　優花', 1], ['中島　菜摘', 0],
  ['西村　里奈', 2], ['野口　杏', 1], ['長谷川　舞', 0], ['平野　凛', 2], ['福田　紗希', 1], ['星野　桃子', 0], ['前田　和花', 2], ['三浦　未来', 1],
]
const GROUPS = ['①グループ', '②グループ', '③グループ']
const T = ['山本', '中村', '小川']
const ME = '山本'
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
const leftAll = ROUNDS.map((_, r) => (started(r) ? myLeft(r).length : 0)).reduce((a, b) => a + b, 0)
/** 自分の担当・まだの分：[{ label, kind: 'left'|'now'|'later', list }] */
const myBlocks = () =>
  ROUNDS.map((l, r) => ({ l, r, list: myLeft(r), kind: started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later' })).filter((b) => b.list.length)

const I = {
  sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10A1.5 1.5 0 0118.5 6v13a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V6A1.5 1.5 0 017 4.5zM9.5 4.5V3h5v1.5M8.5 10.5l1.4 1.4 2.6-2.6M8.5 16l1.4 1.4 2.6-2.6M14.5 11h1.5M14.5 16.5h1.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M16 10.5a2.6 2.6 0 100-5.2M17.5 14.6c1.8.5 3 1.9 3.4 4.4"/></svg>',
}
const seg = (items, on, cls = '') => `<span class="seg ${cls}">${items.map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</span>`

// ================= 案A 確認印 =================
const A_CSS = `
.cv{--paper:#fbf9f4;--ink:#2b2622;--line:#ebe4d6;--sub:#7a7166;--shu:#c8402f;--fusen:#fff3c4;font-size:14px;color:var(--ink);display:flex;flex-direction:column;gap:14px}
.cv .mincho{font-family:'BIZ UDMincho',serif}
.cv .hd{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}
.cv .hd h1{margin:0;font-size:26px;font-weight:700;letter-spacing:.08em}
.cv .hd .course{font-size:15px;color:var(--sub);padding-bottom:3px}
.cv .hd .acts{margin-left:auto;display:flex;gap:18px;font-size:13px;color:var(--sub)}
.cv .hd .acts span{display:inline-flex;align-items:center;gap:5px}
.cv .hd .acts svg{width:15px;height:15px}
.cv .bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:9px 2px}
.cv .seg{display:inline-flex;gap:0;border:1px solid #d9d0bf;border-radius:999px;overflow:hidden;background:#fff}
.cv .seg span{padding:4px 14px;font-size:13px;color:var(--sub);display:inline-flex;align-items:center;gap:5px}
.cv .seg span.on{background:var(--ink);color:#fff}
.cv .seg svg{width:15px;height:15px}
.cv .bar .right{margin-left:auto}
.cv .bar .flt{font-size:13px;color:var(--sub)}
.cv .bar .flt b{color:var(--ink)}
.cv .paper{background:var(--paper);border:1px solid var(--line);border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
.cv table{border-collapse:collapse;width:100%}
.cv th{font-family:'BIZ UDMincho',serif;font-weight:700;font-size:13px;color:var(--sub);padding:12px 8px 8px;border-bottom:1.5px solid #d9d0bf;text-align:center}
.cv th.l{text-align:left}
.cv td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:center;height:46px}
.cv td.l{text-align:left}
.cv td.no{color:#a89f93;width:28px;text-align:right;font-size:12.5px}
.cv td.nm{font-weight:700;font-size:14.5px;white-space:nowrap}
.cv td.mine{background:var(--fusen)}
.cv tr.g td{height:auto;padding:14px 8px 6px;border-bottom:1px solid #d9d0bf;text-align:left;font-family:'BIZ UDMincho',serif;font-weight:700;font-size:15px}
.cv tr.g small{font-family:'BIZ UDPGothic',sans-serif;font-weight:400;color:var(--sub);font-size:12px;margin-left:10px}
.cv .stamp{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:38px;height:38px;border:1.6px solid var(--shu);border-radius:50%;color:var(--shu);font-family:'BIZ UDMincho',serif;font-weight:700;font-size:11.5px;line-height:1.05;transform:rotate(-8deg)}
.cv .stamp small{font-family:'BIZ UDPGothic',sans-serif;font-weight:400;font-size:8.5px;margin-top:1px}
.cv .yotei{color:#a89f93;font-size:12.5px}
.cv .pdf{color:#2f5fb3;font-size:12.5px}
.cv .ok{color:var(--shu);font-weight:700}
.cv .no-mark{color:#cfc6b8}
.cv .red{color:var(--shu);font-size:12px;font-weight:700}
.cv .legend{display:flex;gap:18px;align-items:center;font-size:12.5px;color:var(--sub);flex-wrap:wrap}
.cv .legend .sw{display:inline-block;width:18px;height:14px;background:var(--fusen);border:1px solid #efe1a3;vertical-align:-2px;margin-right:4px}
`
const aHead = () => `<div class="hd"><h1 class="mincho">点検表</h1><span class="course">映画・舞台衣装デザイナー コース ▾</span><span class="acts"><span>${I.people}担当の割り振り</span><span>${I.link}この画面のリンク</span><span>${I.grid}スプレッドシート</span></span></div>`
function aPC() {
  let rows = ''
  S.forEach((s, i) => {
    if (i === 0 || S[i - 1].g !== s.g) rows += `<tr class="g"><td colspan="10">${GROUPS[s.g]}<small>${S.filter((x) => x.g === s.g).length}人</small></td></tr>`
    rows += `<tr><td class="no">${s.no}</td><td class="nm l">${s.name}</td><td class="l">${s.pdf ? `<span class="pdf">${s.pdf}</span>` : '<span class="yotei">まだ</span>'}</td>${s.rounds
      .map((x) => `<td class="${x.t === ME && !x.done ? 'mine' : ''}">${x.done ? `<span class="stamp">${x.t}<small>${x.at}</small></span>` : `<span class="yotei">${x.t}</span>`}</td>`)
      .join('')}<td>${s.abstractOk ? '<span class="ok">許可</span>' : '<span class="no-mark">—</span>'}</td><td>${s.note ? `<span class="red">${s.note}</span>` : '<span class="no-mark">—</span>'}</td></tr>`
  })
  return `<div class="cv">${aHead()}<div class="bar">${seg(['自分の担当', 'コース全体'], 1)}<span class="flt">所属 <b>すべて</b> ▾</span><span class="flt">1回目 <b>${doneN(0)}</b>/26　2回目 <b>${doneN(1)}</b>/26　3回目 <b>${doneN(2)}</b>/26　4回目 <b>0</b>/26</span><span class="right">${seg([I.list, I.grid, I.card], 1)}</span></div>
  <div class="legend"><span><span class="stamp" style="width:26px;height:26px;font-size:8px">山本</span> 済み（押した日）</span><span><span class="yotei">山本</span> 予定</span><span><span class="sw"></span>自分の担当で、まだの所（押すと印が付きます）</span></div>
  <div class="paper"><table><tr><th></th><th class="l">氏名</th><th class="l">最新 PDF</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}<th>抄録許可</th><th>知らせ</th></tr>${rows}</table></div></div>`
}
const A_PHONE = `
body{margin:0;background:#f3efe7;font-family:'BIZ UDPGothic',sans-serif;width:390px}
.top{background:#fbf9f4;border-bottom:1px solid #ebe4d6;padding:12px 16px;display:flex;align-items:center;gap:10px}
.top .b{color:#7a7166;font-size:14px}.top h1{margin:0;font-family:'BIZ UDMincho',serif;font-size:19px;letter-spacing:.08em}.top svg{width:20px;height:20px;margin-left:auto;color:#7a7166}
.ph{padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.ph .course{font-size:13px;color:#7a7166}
.ph .line{display:flex;gap:8px;align-items:center}
.ph .seg{flex:1}
.ph .seg span{flex:1;justify-content:center;padding:7px 4px}
.ph .tabs{display:flex;gap:16px;font-size:13.5px;color:#7a7166;border-bottom:1px solid #ebe4d6;padding-bottom:6px}
.ph .tabs .on{color:#2b2622;font-weight:700;border-bottom:2px solid #c8402f;padding-bottom:5px;margin-bottom:-7px}
.ph h3{margin:6px 2px 4px;font-family:'BIZ UDMincho',serif;font-size:16px;display:flex;align-items:baseline;gap:8px}
.ph h3 small{font-family:'BIZ UDPGothic',sans-serif;font-weight:400;color:#7a7166;font-size:12px}
.ph h3 .red{color:#c8402f;font-size:12px;font-family:'BIZ UDPGothic',sans-serif}
.ph .it{display:flex;align-items:center;gap:12px;background:#fbf9f4;border:1px solid #ebe4d6;border-radius:6px;padding:10px 12px;margin-bottom:6px}
.ph .it .t{flex:1;min-width:0}
.ph .it b{font-size:16px;display:block}
.ph .it small{color:#7a7166;font-size:12px}
.ph .slot{width:46px;height:46px;border:1.6px dashed #d4c8b6;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#b3a898;font-size:11px}
.ph .fold{color:#7a7166;font-size:13px;padding:6px 2px}
`
function aPhone() {
  const blocks = myBlocks()
    .map((b) => (b.kind === 'later' ? `<div class="fold">${b.l}・まだ先（${b.list.length}人） ▸</div>` : `<h3>${b.l}${b.kind === 'left' ? '<span class="red">残り</span>' : ''}<small>${b.list.length}人</small></h3>${b.list.slice(0, b.kind === 'now' ? 3 : 9).map((s) => `<div class="it"><span class="t"><b>${s.name}</b><small>${GROUPS[s.g]}・PDF ${s.pdf || 'まだ'}</small></span><span class="slot">押す</span></div>`).join('')}${b.kind === 'now' && b.list.length > 3 ? `<div class="fold">ほか ${b.list.length - 3}人 ▾</div>` : ''}`))
    .join('')
  return `<!doctype html><meta charset="utf-8"><style>${A_CSS.replaceAll('.cv ', '').replace('.cv{', ':root{')}${A_PHONE}</style><div class="top"><span class="b">‹ 一覧</span><h1>点検表</h1>${I.link}</div><div class="ph"><div class="course">映画・舞台衣装デザイナー コース ▾</div><div class="line">${seg(['自分の担当', 'コース全体'], 0)}${seg([I.list, I.grid, I.card], 0)}</div><div class="tabs"><span class="on">まだの分 ${leftAll}</span>${ROUNDS.map((l) => `<span>${l}</span>`).join('')}</div>${blocks}</div>`
}

// ================= 案B 進み具合が主役 =================
const B_CSS = `
.cv{--ink:#1d2433;--sub:#667085;--line:#e8ebf0;--done:#22a06b;--plan:#d0d5dd;--me:#2f54eb;font-size:14px;color:var(--ink);display:flex;flex-direction:column;gap:16px}
.cv .hd{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.cv .hd h1{margin:0;font-size:24px}
.cv .hd .course{background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 12px;font-weight:700;font-size:14px}
.cv .hd .acts{margin-left:auto;display:flex;gap:8px}
.cv .hd .acts span{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 12px;font-size:13px;color:#344054}
.cv .hd .acts svg{width:15px;height:15px}
.cv .ctrl{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.cv .seg{display:inline-flex;background:#eef1f5;border-radius:10px;padding:3px}
.cv .seg span{padding:5px 14px;border-radius:8px;font-size:13.5px;color:var(--sub);display:inline-flex;align-items:center;gap:5px}
.cv .seg span.on{background:#fff;color:var(--ink);font-weight:700;box-shadow:0 1px 3px rgba(16,24,40,.12)}
.cv .seg svg{width:16px;height:16px}
.cv .ctrl .right{margin-left:auto}
.cv .rings{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.cv .ring{background:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
.cv .ring.on{box-shadow:0 0 0 2px var(--me)}
.cv .ring svg{width:56px;height:56px;flex:none}
.cv .ring b{display:block;font-size:14px}
.cv .ring small{color:var(--sub);font-size:12.5px}
.cv .grp{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 1px 3px rgba(16,24,40,.06);display:flex;flex-direction:column;gap:12px}
.cv .grp .gh{display:flex;align-items:center;gap:12px}
.cv .grp .gh b{font-size:15px}
.cv .grp .gh small{color:var(--sub)}
.cv .grp .gh .mini{margin-left:auto;display:flex;gap:6px;align-items:center;font-size:11.5px;color:var(--sub)}
.cv .mini i{display:inline-block;width:46px;height:6px;border-radius:3px;background:#eef1f5;overflow:hidden;position:relative}
.cv .mini i:after{content:"";position:absolute;inset:0;width:var(--p);background:var(--done);border-radius:3px}
.cv .people{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.cv .p{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:8px 10px}
.cv .p b{font-size:14px;flex:1;min-width:0;white-space:nowrap}
.cv .dots{display:flex;gap:4px}
.cv .dots i{width:11px;height:11px;border-radius:50%;background:var(--plan)}
.cv .dots i.d{background:var(--done)}
.cv .dots i.m{background:#fff;box-shadow:inset 0 0 0 2.5px var(--me)}
.cv .legend{display:flex;gap:16px;font-size:12.5px;color:var(--sub);align-items:center}
.cv .legend i{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:-1px;margin-right:4px}
`
const ringSvg = (p, color = '#22a06b') => {
  const c = 2 * Math.PI * 24
  return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="#eef1f5" stroke-width="6"/><circle cx="28" cy="28" r="24" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="#1d2433">${Math.round(p * 100)}%</text></svg>`
}
function bPC() {
  const rings = ROUNDS.map((l, r) => `<div class="ring ${r === 2 ? 'on' : ''}">${ringSvg(doneN(r) / S.length)}<span><b>${l}</b><small>${doneN(r)} / ${S.length}人 済み</small></span></div>`).join('')
  const groups = GROUPS.map((name, g) => {
    const list = S.filter((s) => s.g === g)
    const mini = ROUNDS.slice(0, 4).map((l, r) => `<span>${l.replace('回目', '')}<i style="--p:${(doneN(r, list) / list.length) * 100}%"></i></span>`).join('')
    const people = list.map((s) => `<div class="p"><b>${s.name}</b><span class="dots">${s.rounds.map((x) => `<i class="${x.done ? 'd' : x.t === ME ? 'm' : ''}"></i>`).join('')}</span></div>`).join('')
    return `<div class="grp"><div class="gh"><b>${name}</b><small>${list.length}人</small><span class="mini">${mini}</span></div><div class="people">${people}</div></div>`
  }).join('')
  return `<div class="cv"><div class="hd"><h1>点検表</h1><span class="course">映画・舞台衣装デザイナー コース ▾</span><span class="acts"><span>${I.people}担当の割り振り</span><span>${I.link}リンク</span><span>${I.grid}スプレッドシート</span></span></div>
  <div class="ctrl">${seg(['自分の担当', 'コース全体'], 1)}${seg(['すべて', ...GROUPS], 0)}<span class="right">${seg([I.list, I.grid, I.card], 2)}</span></div>
  <div class="rings">${rings}</div>
  <div class="legend"><span><i style="background:#22a06b"></i>済み</span><span><i style="background:#d0d5dd"></i>予定</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2.5px #2f54eb"></i>自分の担当（まだ）</span><span>点は左から 1・2・3・4回目・抄録。名前を押すと記録が開きます</span></div>${groups}</div>`
}
const B_PHONE = `
body{margin:0;background:#f5f7fa;font-family:'BIZ UDPGothic',sans-serif;width:390px;color:#1d2433}
.top{padding:12px 16px;display:flex;align-items:center;gap:10px;background:#fff;box-shadow:0 1px 0 #e8ebf0}
.top .b{color:#2f54eb;font-size:14px}.top h1{margin:0;font-size:18px}.top svg{width:20px;height:20px;margin-left:auto;color:#667085}
.ph{padding:14px;display:flex;flex-direction:column;gap:12px}
.ph .line{display:flex;gap:8px}
.ph .line .seg{flex:1}
.ph .line .seg span{flex:1;justify-content:center;white-space:nowrap;padding:6px 8px}
.ph .line .seg:first-child{flex:1.5}
.hero{background:#fff;border-radius:18px;padding:16px;display:flex;align-items:center;gap:16px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
.hero svg{width:76px;height:76px}
.hero b{font-size:20px;display:block}
.hero small{color:#667085;font-size:13px;line-height:1.6}
.card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(16,24,40,.06);overflow:hidden}
.card h3{margin:0;padding:12px 14px 6px;font-size:14.5px;display:flex;gap:8px;align-items:baseline}
.card h3 small{color:#667085;font-weight:400;font-size:12px}
.card h3 .red{color:#d92d20;font-size:12px}
.row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-top:1px solid #f0f2f5}
.row .t{flex:1}
.row b{font-size:16px;display:block}
.row small{color:#667085;font-size:12px}
.chk{width:40px;height:40px;border-radius:50%;border:2px solid #d0d5dd}
.fold{padding:10px 14px;color:#667085;font-size:13px;border-top:1px solid #f0f2f5}
`
function bPhone() {
  const total = ROUNDS.map((_, r) => mine(r).length).reduce((a, b) => a + b, 0)
  const doneMine = ROUNDS.map((_, r) => doneN(r, mine(r))).reduce((a, b) => a + b, 0)
  const blocks = myBlocks()
    .map((b) => (b.kind === 'later' ? `<div class="card"><div class="fold">${b.l}・まだ先（${b.list.length}人） ▸</div></div>` : `<div class="card"><h3>${b.l}${b.kind === 'left' ? '<span class="red">残り</span>' : ''}<small>${b.list.length}人</small></h3>${b.list.slice(0, b.kind === 'now' ? 3 : 9).map((s) => `<div class="row"><span class="t"><b>${s.name}</b><small>${GROUPS[s.g]}・PDF ${s.pdf || 'まだ'}</small></span><span class="chk"></span></div>`).join('')}${b.kind === 'now' && b.list.length > 3 ? `<div class="fold">ほか ${b.list.length - 3}人 ▾</div>` : ''}</div>`))
    .join('')
  return `<!doctype html><meta charset="utf-8"><style>${B_CSS.replaceAll('.cv ', '').replace('.cv{', ':root{')}${B_PHONE}</style><div class="top"><span class="b">‹ 一覧</span><h1>点検表</h1>${I.link}</div><div class="ph"><div class="line">${seg(['自分の担当', 'コース全体'], 0)}${seg([I.list, I.grid, I.card], 0)}</div>
  <div class="hero">${ringSvg(doneMine / total, '#2f54eb')}<span><b>まだの分 ${leftAll}人</b><small>山本先生の担当 ${total}件のうち ${doneMine}件 済み<br>前の回で済んでいない学生がいます</small></span></div>${blocks}</div>`
}

// ================= 案C 表を洗練 =================
const C_CSS = `
.cv{--ink:#1f2937;--sub:#6b7280;--line:#e5e7eb;--zebra:#fafbfc;--done:#15803d;--mine:#eaf2ff;font-size:14px;color:var(--ink);display:flex;flex-direction:column;gap:12px}
.cv .hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cv .hd h1{margin:0;font-size:22px}
.cv .hd .course{font-size:14.5px;font-weight:700;color:#374151}
.cv .hd .acts{margin-left:auto;display:flex;gap:6px}
.cv .hd .acts span{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:6px;padding:5px 10px;font-size:13px;color:#374151}
.cv .hd .acts svg{width:15px;height:15px}
.cv .ctrl{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.cv .seg{display:inline-flex;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;background:#fff}
.cv .seg span{padding:4px 12px;font-size:13px;color:#374151;border-left:1px solid #d1d5db;display:inline-flex;align-items:center;gap:5px}
.cv .seg span:first-child{border-left:0}
.cv .seg span.on{background:#374151;color:#fff}
.cv .seg svg{width:15px;height:15px}
.cv .ctrl .right{margin-left:auto}
.cv .ctrl .sum{font-size:13px;color:var(--sub)}
.cv .ctrl .sum b{color:var(--ink)}
.cv .sheet{background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.cv table{border-collapse:collapse;width:100%;font-size:13.5px}
.cv th{position:sticky;top:0;background:#f3f4f6;color:#4b5563;font-size:12.5px;font-weight:700;padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);border-left:1px solid var(--line)}
.cv th:first-child,.cv td:first-child{border-left:0}
.cv th .pct{display:block;font-weight:400;color:var(--sub);font-size:11px}
.cv td{padding:8px 10px;border-bottom:1px solid #f0f1f3;border-left:1px solid #f0f1f3;white-space:nowrap}
.cv tr:nth-child(even) td{background:var(--zebra)}
.cv td.no{color:#9ca3af;width:26px;text-align:right}
.cv td.nm{font-weight:700}
.cv td.mine{background:var(--mine)!important;box-shadow:inset 3px 0 0 #3b82f6}
.cv .d{color:var(--done);font-weight:700}
.cv .d::before{content:"✓ ";}
.cv .y{color:#9ca3af}
.cv .at{color:#9ca3af;font-size:11px;margin-left:4px;font-weight:400}
.cv .pdf{color:#2563eb}
.cv .red{color:#b91c1c;font-weight:700;font-size:12.5px}
.cv tr.g td{background:#f9fafb!important;font-weight:700;color:#374151;padding:7px 10px;border-bottom:1px solid var(--line)}
.cv tr.g small{font-weight:400;color:var(--sub);margin-left:8px}
.cv .legend{display:flex;gap:16px;font-size:12.5px;color:var(--sub);align-items:center}
.cv .legend .sw{display:inline-block;width:16px;height:12px;background:var(--mine);box-shadow:inset 3px 0 0 #3b82f6;vertical-align:-1px;margin-right:4px}
`
function cPC() {
  let rows = ''
  S.forEach((s, i) => {
    if (i === 0 || S[i - 1].g !== s.g) rows += `<tr class="g"><td colspan="10">${GROUPS[s.g]}<small>${S.filter((x) => x.g === s.g).length}人</small></td></tr>`
    rows += `<tr><td class="no">${s.no}</td><td class="nm">${s.name}</td><td>${s.pdf ? `<span class="pdf">${s.pdf}</span>` : '<span class="y">まだ</span>'}</td>${s.rounds
      .map((x) => `<td class="${x.t === ME && !x.done ? 'mine' : ''}">${x.done ? `<span class="d">${x.t}</span><span class="at">${x.at}</span>` : `<span class="y">${x.t}</span>`}</td>`)
      .join('')}<td>${s.abstractOk ? '<span class="d"></span>' : '<span class="y">—</span>'}</td><td>${s.note ? `<span class="red">${s.note}</span>` : ''}</td></tr>`
  })
  return `<div class="cv"><div class="hd"><h1>点検表</h1><span class="course">映画・舞台衣装デザイナー コース ▾</span><span class="acts"><span>${I.people}担当の割り振り</span><span>${I.link}この画面のリンク</span><span>${I.grid}スプレッドシート</span></span></div>
  <div class="ctrl">${seg(['自分の担当', 'コース全体'], 1)}${seg(['すべて', ...GROUPS], 0)}<span class="right">${seg([I.list, I.grid, I.card], 1)}</span></div>
  <div class="legend"><span><span class="d">山本</span> 済み（日付）</span><span><span class="y">山本</span> 予定</span><span><span class="sw"></span>自分の担当で、まだの所（押すと ✓）</span></div>
  <div class="sheet"><table><tr><th></th><th>氏名</th><th>最新 PDF</th>${ROUNDS.map((l, r) => `<th>${l}<span class="pct">${doneN(r)}/26 済み</span></th>`).join('')}<th>抄録許可</th><th>知らせ</th></tr>${rows}</table></div></div>`
}
const C_PHONE = `
body{margin:0;background:#f3f4f6;font-family:'BIZ UDPGothic',sans-serif;width:390px;color:#1f2937}
.top{padding:12px 16px;display:flex;align-items:center;gap:10px;background:#fff;border-bottom:1px solid #e5e7eb}
.top .b{color:#2563eb;font-size:14px}.top h1{margin:0;font-size:18px}.top svg{width:20px;height:20px;margin-left:auto;color:#6b7280}
.ph{padding:12px;display:flex;flex-direction:column;gap:10px}
.ph .line{display:flex;gap:8px}
.ph .line .seg{flex:1}
.ph .line .seg span{flex:1;justify-content:center;padding:7px 4px}
.list{background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.list .h{background:#f3f4f6;padding:7px 12px;font-size:13px;font-weight:700;color:#374151;display:flex;gap:8px;border-bottom:1px solid #e5e7eb}
.list .h small{font-weight:400;color:#6b7280}
.list .h .red{color:#b91c1c}
.r{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 10px;padding:9px 12px;border-bottom:1px solid #f0f1f3}
.r b{font-size:15.5px}
.r .m{grid-column:1;font-size:12px;color:#6b7280}
.r .box{grid-row:1 / span 2;grid-column:2;width:34px;height:34px;border:2px solid #d1d5db;border-radius:6px}
.fold{padding:9px 12px;color:#6b7280;font-size:13px}
`
function cPhone() {
  const blocks = myBlocks()
    .map((b) => (b.kind === 'later' ? `<div class="list"><div class="fold">${b.l}・まだ先（${b.list.length}人） ▸</div></div>` : `<div class="list"><div class="h">${b.l}${b.kind === 'left' ? '<span class="red">残り</span>' : ''}<small>${b.list.length}人</small></div>${b.list.slice(0, b.kind === 'now' ? 4 : 9).map((s) => `<div class="r"><b>${s.name}</b><span class="box"></span><span class="m">${GROUPS[s.g]}　PDF ${s.pdf || 'まだ'}</span></div>`).join('')}${b.kind === 'now' && b.list.length > 4 ? `<div class="fold">ほか ${b.list.length - 4}人 ▾</div>` : ''}</div>`))
    .join('')
  return `<!doctype html><meta charset="utf-8"><style>${C_CSS.replaceAll('.cv ', '').replace('.cv{', ':root{')}${C_PHONE}</style><div class="top"><span class="b">‹ 一覧</span><h1>点検表</h1>${I.link}</div><div class="ph"><div class="line">${seg(['自分の担当', 'コース全体'], 0)}${seg([I.list, I.grid, I.card], 0)}</div><div style="font-size:13px;color:#6b7280">まだの分 <b style="color:#1f2937">${leftAll}人</b>　・　1回目 ${doneN(0, mine(0))}/${mine(0).length}　2回目 ${doneN(1, mine(1))}/${mine(1).length}　3回目 ${doneN(2, mine(2))}/${mine(2).length}</div>${blocks}</div>`
}

// ---------------- 撮る ----------------
const scope = (css) => css.replace(/([^{}]+)\{/g, (m, sel) => sel.split(',').map((x) => (x.trim().startsWith('.cv') ? x.trim() : '.cv ' + x.trim())).join(',') + '{')
const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    for (const [name, css, make, bg] of [
      ['案A_確認印_パソコン', A_CSS, aPC, '#f3efe7'],
      ['案B_進み具合が主役_パソコン', B_CSS, bPC, '#f5f7fa'],
      ['案C_表を洗練_パソコン', C_CSS, cPC, '#f3f4f6'],
    ]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.addStyleTag({ content: scope(css) })
      await page.evaluate(
        (html, svg, bg) => {
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
          work.style.background = bg
          for (const el of [...work.children]) if (el !== content) el.style.display = 'none'
          content.innerHTML = html
        },
        make(),
        I.sheet,
        bg,
      )
      await sleep(600)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
      await context.close()
    }
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
    for (const [name, make] of [['案A_確認印_スマホ', aPhone], ['案B_進み具合が主役_スマホ', bPhone], ['案C_表を洗練_スマホ', cPhone]]) {
      await page.setContent(make(), { waitUntil: 'load' })
      await sleep(400)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
    }
  })
} finally {
  server.close()
}
