// mockups/v123（2026-11-09）：管理ページの「点検表」の画面の見本 その2（依頼者：入口・直接のリンク・切り替え・まだの一覧・担当の割り振りなど、もろもろ含めて。見やすく直せる所は直してよい）
//   パソコン（本物の管理ページに重ねる）：
//     ① リスト・自分の担当・まだの分（前の回の残りが上、次の回はその下、先の回はたたむ）。「この画面のリンク」の吹き出し
//     ② 表・コース全体（自分の担当の欄に太い枠）
//     ③ カード・コース全体と、学生を押したときの右の欄（記録を直す）
//     ④ 担当の割り振り（並び順で3等分するコースの例。1回目を入れて「1回ずつずらして埋める」）
//   スマホ：⑤ リスト・自分の担当・まだの分　⑥ カード・コース全体（②グループ）
//   v122 から：左の一覧の「点検表」をいちばん上に・点検表の絵／コースの切り替え／範囲・所属・見せ方の切り替えを1段に／回の進み具合を押して絞り込む／
//   まだ始まっていない回はたたむ／自分の担当に枠／カードを押すと右の欄で記録を直す
//   学生・先生の名前はすべて作り物。使い方：node scripts/mockup-v123-check-view.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v123'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------- 見本の中身（26人・3つの所属。12月半ば） ----------------
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

// ---------------- 部品 ----------------
const SHEET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10A1.5 1.5 0 0118.5 6v13a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V6A1.5 1.5 0 017 4.5zM9.5 4.5V3h5v1.5M8.5 10.5l1.4 1.4 2.6-2.6M8.5 16l1.4 1.4 2.6-2.6M14.5 11h1.5M14.5 16.5h1.5"/></svg>'
const LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>'
const ICON = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>',
}
const gtag = (g) => `<span class="gtag" style="background:${GTONE[g].bg};color:${GTONE[g].ink}">${GROUPS[g]}</span>`
const tchip = (x, opts = {}) => {
  const me = opts.mark && x.t === ME ? ' mine' : ''
  return x.done ? `<span class="tchip${me}" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t}<b>✓</b></span>` : `<span class="tchip plan${me}">${x.t}</span>`
}
const pdf = (s) => (s.pdf ? `<span class="pdfb">PDF ${s.pdf}</span>` : '<span class="badge gray">PDF まだ</span>')
const note = (s) => (s.note ? `<span class="badge red">${s.note}</span>` : '')
const tog = (on) => `<span class="tog ${on ? 'on' : ''}"></span>`
const seg = (items, on, cls = '') => `<span class="seg ${cls}">${items.map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</span>`

const CSS = `
.cv{display:flex;flex-direction:column;gap:12px;min-width:0;font-size:14px}
.cv-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cv-head h1{margin:0;font-size:22px}
.course-pick{display:inline-flex;align-items:center;gap:8px;border:1px solid #cfd5de;border-radius:8px;background:#fff;padding:6px 12px;font-size:14.5px;font-weight:700;color:#223}
.course-pick i{font-style:normal;color:#778;font-size:12px}
.cv-head .acts{margin-left:auto;display:flex;gap:8px;position:relative}
.btn-o{display:inline-flex;align-items:center;gap:6px;border:1px solid #cfd5de;border-radius:8px;background:#fff;padding:6px 12px;font-size:13.5px;color:#334}
.btn-o svg{width:16px;height:16px}
.btn-o .gs{width:11px;height:15px;border-radius:2px;background:#188038;display:inline-block}
.btn-o.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.pop{position:absolute;right:150px;top:44px;z-index:5;width:340px;background:#fff;border:1px solid #dfe3ea;border-radius:12px;box-shadow:0 10px 30px rgba(20,30,60,.16);padding:14px 16px;font-size:13.5px;line-height:1.7}
.pop b{display:block;font-size:14px;margin-bottom:4px}
.pop .url{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
.pop .url code{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:#f3f5f8;border-radius:6px;padding:5px 8px;font-size:12px;color:#445}
.pop .url span{background:var(--accent);color:#fff;border-radius:6px;padding:5px 10px;font-size:12.5px;font-weight:700;white-space:nowrap}
.pop small{color:#667;font-size:12px}
.subtabs{display:flex;gap:2px;border-bottom:2px solid #e3e6ec}
.subtabs span{padding:7px 16px;font-size:14px;color:#556}
.subtabs span.on{color:var(--accent);font-weight:700;border-bottom:3px solid var(--accent);margin-bottom:-2px}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:9px 14px}
.toolbar .k{color:#667;font-weight:700;font-size:12.5px;margin-right:6px}
.toolbar .right{margin-left:auto}
.seg{display:inline-flex;border:1px solid #cfd5de;border-radius:8px;overflow:hidden;background:#fff;vertical-align:middle}
.seg span{padding:4px 12px;font-size:13px;color:#334;border-left:1px solid #cfd5de;display:inline-flex;align-items:center;gap:5px}
.seg span:first-child{border-left:0}
.seg span.on{background:var(--accent);color:#fff;font-weight:700}
.seg svg{width:15px;height:15px}
.chips{display:inline-flex;gap:6px;flex-wrap:wrap;vertical-align:middle}
.chips span{padding:3px 10px;border-radius:999px;border:1px solid #cfd5de;background:#fff;color:#334;font-size:13px}
.chips span.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
.rounds{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.rounds.five{grid-template-columns:repeat(5,minmax(0,1fr))}
.rc{background:#fff;border:1px solid #e3e6ec;border-radius:10px;padding:7px 11px}
.rc.on{border:2px solid var(--accent);padding:6px 10px;background:#f7f9fe}
.rc b{display:block;font-size:12.5px;color:#445}
.rc .n{font-size:19px;font-weight:700;color:#1f3f6b}
.rc .n small{font-size:11.5px;color:#667;font-weight:400;margin-left:3px}
.rc .n.red{color:#b3261e}
.pbar{height:5px;border-radius:3px;background:#e9ecf1;margin-top:5px;overflow:hidden}
.pbar i{display:block;height:100%;border-radius:3px;background:#4f7cc4}
.gtag{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.tchip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:6px;font-size:12.5px;font-weight:700;white-space:nowrap}
.tchip b{font-size:11px}
.tchip.plan{background:#fff;border:1px dashed #b9bec7;color:#8a909a;font-weight:400}
.tchip.mine{outline:2px solid var(--accent);outline-offset:1px}
.pdfb{display:inline-block;padding:2px 9px;border-radius:6px;border:1px solid #c9d6ef;color:#1a56c4;font-size:12.5px;background:#f5f8ff;white-space:nowrap}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.badge.red{background:#fce8e6;color:#c5221f}
.badge.gray{background:#eef0f3;color:#6b7280}
.tog{display:inline-flex;width:32px;height:19px;border-radius:999px;background:#d9dde4;position:relative;vertical-align:middle}
.tog:after{content:"";position:absolute;left:3px;top:3px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.tog.on{background:#2e8b57}
.tog.on:after{left:16px}
.btn-p{display:inline-flex;align-items:center;justify-content:center;gap:5px;background:var(--accent);color:#fff;border-radius:8px;padding:6px 14px;font-size:13.5px;font-weight:700;white-space:nowrap}
.btn-s{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:8px;padding:6px 14px;font-size:13.5px;font-weight:700;white-space:nowrap}
.legend{color:#667;font-size:12.5px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
/* リスト */
.sec{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.sec h3{margin:0;padding:9px 14px;font-size:14.5px;display:flex;align-items:center;gap:10px;background:#f7f8fa;border-bottom:1px solid #eef0f4}
.sec h3 small{font-weight:400;color:#667;font-size:12.5px}
.sec h3 .lab{font-size:11.5px;padding:1px 8px;border-radius:999px;font-weight:700}
.lab.left{background:#fce8e6;color:#b3261e}
.lab.now{background:#e8edf9;color:#1e3a8a}
.lab.later{background:#eef0f3;color:#6b7280}
.sec.fold h3{border-bottom:0}
.sec.fold h3:after{content:"▸ 開く";margin-left:auto;color:#667;font-weight:400;font-size:12.5px}
.li{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:12px;padding:9px 14px;border-top:1px solid #f0f2f5}
.li:first-of-type{border-top:0}
.li .nm{display:flex;align-items:center;gap:8px;min-width:0}
.li .nm b{font-size:15px}
/* 表 */
.ta{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.ta table{width:100%;border-collapse:collapse;font-size:13px}
.ta th{background:#f5f6f8;color:#556;font-size:12px;font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid #e3e6ec;white-space:nowrap}
.ta td{padding:6px 8px;border-bottom:1px solid #f0f2f5;vertical-align:middle}
.ta td.no{color:#8a909a;text-align:right;width:26px}
.ta td.nm{font-weight:700;white-space:nowrap}
.ta tr.gh td{padding:6px 10px;font-weight:700;font-size:13px}
.ta tr.gh small{font-weight:400;margin-left:10px;font-size:12px;opacity:.85}
/* カード */
.split{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
.gb{display:flex;flex-direction:column;gap:8px}
.gb h3{margin:2px 0 0;font-size:14.5px;display:flex;align-items:center;gap:10px}
.gb h3 small{font-weight:400;color:#667;font-size:12.5px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px}
.card{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:9px 11px 9px 13px;position:relative;display:flex;flex-direction:column;gap:7px}
.card:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:4px;border-radius:0 3px 3px 0;background:var(--g)}
.card.sel{border:2px solid var(--accent);padding:8px 10px 8px 12px;box-shadow:0 4px 14px rgba(30,58,138,.15)}
.card .r1{display:flex;align-items:center;gap:6px}
.card .r1 b{font-size:14.5px}
.card .r1 .pdfb,.card .r1 .badge{margin-left:auto}
.dots{display:flex;gap:4px}
.dot{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:10px;color:#8a909a;width:31px}
.dot i{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11.5px;font-weight:700}
.dot i.plan{border:1.5px dashed #b9bec7;color:#8a909a;background:#fff}
.dot i.mine{outline:2px solid var(--accent);outline-offset:1px;margin-bottom:4px}
.cflag{display:flex;gap:5px;flex-wrap:wrap;font-size:11.5px}
.cflag span{padding:1px 7px;border-radius:6px;background:#f2f3f6;color:#667}
.cflag span.ok{background:#fdf3d0;color:#7a5200;font-weight:700}
.drawer{background:#fff;border:1px solid #dfe3ea;border-radius:14px;box-shadow:0 8px 28px rgba(20,30,60,.12);padding:14px 16px;display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
.drawer .hd{display:flex;align-items:center;gap:8px}
.drawer .hd b{font-size:18px}
.drawer .hd .x{margin-left:auto;color:#778;font-size:18px}
.drawer .row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #f0f2f5;font-size:13.5px}
.drawer .row:first-of-type{border-top:0}
.drawer .row .r{color:#556;font-weight:700;font-size:13px}
.drawer .row .at{color:#2e7d4f;font-size:12.5px;font-weight:700}
.drawer .perm{display:flex;flex-direction:column;gap:8px;background:#fbfaf3;border-radius:10px;padding:10px 12px}
.drawer .perm div{display:flex;align-items:center;gap:10px;font-size:13.5px}
.drawer .perm div span:first-child{flex:1}
.drawer h4{margin:0;font-size:13px;color:#556}
/* 割り振り */
.as-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:12px 14px}
.as-top .k{font-weight:700;color:#445;font-size:13.5px}
.as-top .mode{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:8px;background:var(--accent-soft);color:var(--accent);font-weight:700;font-size:13.5px}
.as-top small{color:#667;font-size:12.5px}
.han{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.han div{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:9px 12px;font-size:13px;color:#445;line-height:1.6}
.han b{font-size:14px;color:#223}
.atab{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.atab table{border-collapse:collapse;width:100%}
.atab th{background:#f5f6f8;color:#556;font-size:12.5px;font-weight:700;padding:9px 10px;text-align:center;border-bottom:1px solid #e3e6ec}
.atab td{padding:10px;text-align:center;border-bottom:1px solid #f0f2f5;border-left:1px solid #f0f2f5}
.atab td:first-child{border-left:0;text-align:left;width:140px}
.pick{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 12px;border-radius:8px;font-weight:700;font-size:13.5px;min-width:78px;justify-content:space-between}
.pick:after{content:"▾";font-size:10px;opacity:.7}
.pick.auto{box-shadow:inset 0 0 0 1.5px rgba(30,58,138,.35)}
.atab td.first{background:#fafbff}
.as-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.as-acts small{color:#667;font-size:12.5px;line-height:1.6}
.callout{display:flex;gap:8px;align-items:flex-start;background:#fff8e6;border:1px solid #f1d9a6;border-radius:10px;padding:9px 12px;font-size:13px;color:#5c4400;line-height:1.7}
`

// パソコンの共通の上の段
const head = ({ popover = false } = {}) => `
<div class="cv-head">
  <h1>点検表</h1><span class="course-pick">映画・舞台衣装デザイナー コース<i>▾</i></span>
  <div class="acts"><span class="btn-o ${popover ? 'on' : ''}">${LINK_SVG}この画面のリンク</span><span class="btn-o"><i class="gs"></i>スプレッドシートで開く</span>
  ${popover ? `<div class="pop"><b>この画面に直接入るリンク</b>ブックマークや、スマホのホーム画面に置いておくと、1回押すだけで、このコースの点検表が開きます。<div class="url"><code>https://script.google.com/a/macros/…/exec?view=check&amp;course=film</code><span>コピー</span></div><small>スマホのホーム画面への置き方：iPhone は共有 →「ホーム画面に追加」、Android は ⋮ →「ホーム画面に追加」</small></div>` : ''}
  </div>
</div>`
const toolbar = ({ scope, group = 0, view }) => `
<div class="toolbar">
  <span><span class="k">範囲</span>${seg([`自分の担当（${ME}）`, 'コース全体'], scope)}</span>
  <span><span class="k">所属</span><span class="chips">${['すべて', ...GROUPS].map((g, i) => `<span class="${i === group ? 'on' : ''}">${g}</span>`).join('')}</span></span>
  <span class="right"><span class="k">見せ方</span>${seg([`${ICON.list}リスト`, `${ICON.table}表`, `${ICON.card}カード`], view)}</span>
</div>`
const roundCardsAll = (on = -1) =>
  `<div class="rounds five">${ROUNDS.map((l, r) => {
    const n = doneN(r)
    return `<div class="rc ${r === on ? 'on' : ''}"><b>${l}</b><span class="n">${n}<small>/ ${S.length}人 済み</small></span><div class="pbar"><i style="width:${(n / S.length) * 100}%"></i></div></div>`
  }).join('')}</div>`
const roundCardsMine = () => {
  const left = ROUNDS.map((_, r) => myLeft(r).filter(() => started(r)).length).reduce((a, b) => a + b, 0)
  return `<div class="rounds"><div class="rc on"><b>まだの分</b><span class="n red">${left}<small>人（前の回の残り）</small></span><div class="pbar"><i style="width:0"></i></div></div>${ROUNDS.map((l, r) => {
    const all = mine(r).length
    const n = doneN(r, mine(r))
    return `<div class="rc"><b>${l}</b><span class="n">${n}<small>/ ${all}人 済み</small></span><div class="pbar"><i style="width:${all ? (n / all) * 100 : 0}%"></i></div></div>`
  }).join('')}</div>`
}

// ① リスト・自分の担当・まだの分
function pcList() {
  const secs = []
  ROUNDS.forEach((l, r) => {
    const left = myLeft(r)
    if (!left.length) return
    const isStarted = started(r)
    const firstUpcoming = ROUNDS.findIndex((_, k) => !started(k))
    const kind = isStarted ? 'left' : r === firstUpcoming ? 'now' : 'later'
    const lab = kind === 'left' ? `<span class="lab left">${l}の残り</span>` : kind === 'now' ? '<span class="lab now">次の回</span>' : '<span class="lab later">まだ先</span>'
    const rows =
      kind === 'later'
        ? ''
        : left
            .map((s) => `<div class="li"><span class="nm"><b>${s.name}</b>${gtag(s.g)}</span>${pdf(s)}${note(s) || '<span></span>'}<span class="${kind === 'left' ? 'btn-p' : 'btn-s'}">済みにする</span></div>`)
            .join('')
    secs.push(`<div class="sec ${kind === 'later' ? 'fold' : ''}"><h3>${l}${lab}<small>${left.length}人</small></h3>${rows}</div>`)
  })
  return `<div class="cv">${head({ popover: true })}<div class="subtabs"><span class="on">点検</span><span>担当の割り振り</span></div>${toolbar({ scope: 0, view: 0 })}${roundCardsMine()}
  <div class="legend">前の回で済んでいない学生は、済みにするまで上に残ります。まだ始まっていない回はたたんであります。</div>${secs.join('')}</div>`
}

// ② 表・コース全体（自分の担当の欄に枠）
function pcTable() {
  let rows = ''
  S.forEach((s, i) => {
    if (i === 0 || S[i - 1].g !== s.g) {
      const list = S.filter((x) => x.g === s.g)
      rows += `<tr class="gh"><td colspan="11" style="background:${GTONE[s.g].bg};color:${GTONE[s.g].ink}">${GROUPS[s.g]}<small>${list.length}人・3回目 ${doneN(2, list)}人済み</small></td></tr>`
    }
    rows += `<tr><td class="no">${s.no}</td><td class="nm">${s.name}</td><td>${pdf(s)}</td>${s.rounds.map((x) => `<td>${tchip(x, { mark: true })}</td>`).join('')}<td>${tog(s.abstractOk)}</td><td>${tog(false)}</td><td>${note(s)}</td></tr>`
  })
  return `<div class="cv">${head()}<div class="subtabs"><span class="on">点検</span><span>担当の割り振り</span></div>${toolbar({ scope: 1, view: 1 })}${roundCardsAll()}
  <div class="legend"><span><span class="tchip" style="background:${TONE['山本'].bg};color:${TONE['山本'].ink}">山本<b>✓</b></span>　済み</span><span><span class="tchip plan">山本</span>　予定</span><span><span class="tchip plan mine">山本</span>　自分の担当（太い枠）</span><span>欄を押すと「済み」になります</span></div>
  <div class="ta"><table><tr><th></th><th>氏名</th><th>最新 PDF</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}<th>抄録許可</th><th>最終提出可</th><th>知らせ</th></tr>${rows}</table></div></div>`
}

// ③ カード・コース全体と、右の欄
function card(s, sel = false) {
  return `<div class="card ${sel ? 'sel' : ''}" style="--g:${GTONE[s.g].ink}">
    <div class="r1"><b>${s.name}</b>${s.note ? note(s) : pdf(s)}</div>
    <div class="dots">${s.rounds.map((x) => `<span class="dot">${x.done ? `<i style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}" class="${x.t === ME ? 'mine' : ''}">${x.t[0]}</i>` : `<i class="plan ${x.t === ME ? 'mine' : ''}">${x.t[0]}</i>`}${x.label.replace('回目', '')}</span>`).join('')}</div>
    <div class="cflag"><span class="${s.abstractOk ? 'ok' : ''}">抄録許可 ${s.abstractOk ? '✓' : '—'}</span><span>最終提出可 —</span></div></div>`
}
function pcCards() {
  const pick = S.find((s) => s.name === '塚本　七海')
  const groups = GROUPS.map((name, g) => {
    const list = S.filter((s) => s.g === g)
    return `<div class="gb"><h3>${gtag(g)}<small>${list.length}人・3回目 ${doneN(2, list)}人済み</small></h3><div class="cards">${list.map((s) => card(s, s === pick)).join('')}</div></div>`
  })
  const drawer = `<div class="drawer"><div class="hd"><b>${pick.name}</b>${gtag(pick.g)}<span class="x">×</span></div>
    <div style="display:flex;gap:8px;align-items:center">${pdf(pick)}<small style="color:#667">最新の PDF を開く</small></div>
    <div><h4>点検の回</h4>${pick.rounds
      .map((x) => `<div class="row"><span class="r">${x.label}</span><span>${tchip(x, { mark: true })}</span>${x.done ? `<span class="at">✓ 済み ${x.at}</span>` : x.t === ME ? '<span class="btn-p">済みにする</span>' : '<span style="color:#8a909a;font-size:12.5px">予定</span>'}</div>`)
      .join('')}</div>
    <div class="perm"><div><span>抄録許可</span>${tog(pick.abstractOk)}</div><div><span>最終提出可</span>${tog(false)}</div><div><span>教務提出</span>${tog(false)}</div></div>
    <small style="color:#667;font-size:12px;line-height:1.6">担当の先生を変えるときは、回の札を押して選び直します。</small></div>`
  return `<div class="cv">${head()}<div class="subtabs"><span class="on">点検</span><span>担当の割り振り</span></div>${toolbar({ scope: 1, view: 2 })}${roundCardsAll()}
  <div class="split"><div style="display:flex;flex-direction:column;gap:12px">${groups.join('')}</div>${drawer}</div></div>`
}

// ④ 担当の割り振り（並び順で3等分するコースの例）
function pcAssign() {
  const TT = ['佐藤', '加藤', '森']
  const han = ['1班', '2班', '3班']
  const at = (g, r) => TT[(((g - r) % 3) + 3) % 3]
  const pick = (t, auto) => `<span class="pick ${auto ? 'auto' : ''}" style="background:${TONE[t].bg};color:${TONE[t].ink}">${t}</span>`
  const rows = han
    .map((h, g) => `<tr><td><span class="gtag" style="background:${GTONE[g].bg};color:${GTONE[g].ink}">${h}</span> <small style="color:#667">9人</small></td>${ROUNDS.map((_, r) => `<td class="${r === 0 ? 'first' : ''}">${pick(at(g, r), r > 0)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="cv">
  <div class="cv-head"><h1>点検表</h1><span class="course-pick">スタイリスト・コーディネーター コース<i>▾</i></span><div class="acts"><span class="btn-o">${LINK_SVG}この画面のリンク</span><span class="btn-o"><i class="gs"></i>スプレッドシートで開く</span></div></div>
  <div class="subtabs"><span>点検</span><span class="on">担当の割り振り</span></div>
  <div class="as-top"><span class="k">まとまり</span><span class="mode">並び順で3等分</span><small>27人を 9・9・9人に分けます（五十音順の上から）。人数が変わったら、分け直します。分け方は「コースごとの設定」で変えられます。</small></div>
  <div class="han"><div><b>1班</b>　1〜9番<br>アオキ ミサキ 〜 クボ メイ</div><div><b>2班</b>　10〜18番<br>コバヤシ ヒナ 〜 チバ チヒロ</div><div><b>3班</b>　19〜27番<br>ツカモト ナナミ 〜 ミウラ ミライ</div></div>
  <div class="callout">① 1回目の担当の先生を選びます　② 「1回ずつずらして埋める」を押すと、2回目からは1班ずつずれて回ります（1回目に1班の先生は、2回目は2班へ）　③ 1マスずつ直すこともできます</div>
  <div class="atab"><table><tr><th style="text-align:left">班</th>${ROUNDS.map((l) => `<th>${l}</th>`).join('')}</tr>${rows}</table></div>
  <div class="as-acts"><span class="btn-s">1回ずつずらして埋める</span><span class="btn-p">この割り振りを点検表に入れる</span><small>点検表の回の欄に「佐藤 予定」などが入ります。すでに「済み」の所は書き換えません。<br>班が変わった学生は、まだの回だけ新しい班の先生になります。</small></div>
  </div>`
}

// ---------------- スマホ（単独の画面。管理ページのスマホの形：上に戻るの段） ----------------
const PHONE_CSS = `
:root{--accent:#1e3a8a;--accent-soft:#e8edf9}
body{margin:0;background:#f4f5f8;font-family:'BIZ UDPGothic',sans-serif;color:#1f2430;width:390px}
.pbar-top{position:sticky;top:0;background:#fff;border-bottom:1px solid #e3e6ec;padding:10px 14px;display:flex;align-items:center;gap:10px;z-index:3}
.pbar-top .back{color:var(--accent);font-size:14px;font-weight:700}
.pbar-top h1{margin:0;font-size:17px}
.pbar-top .lk{margin-left:auto;display:inline-flex;align-items:center;gap:4px;color:#445;font-size:12.5px;border:1px solid #cfd5de;border-radius:8px;padding:4px 8px}
.pbar-top .lk svg{width:15px;height:15px}
.ph{display:flex;flex-direction:column;gap:10px;padding:10px 12px 20px}
.ph .course{font-size:13px;color:#445;font-weight:700;display:flex;align-items:center;gap:6px}
.ph .course i{font-style:normal;color:#778;font-size:11px}
.ph .seg2{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cfd5de;border-radius:10px;overflow:hidden;background:#fff}
.ph .seg2 span{padding:9px 6px;text-align:center;font-size:14px;color:#334;border-left:1px solid #cfd5de}
.ph .seg2 span:first-child{border-left:0}
.ph .seg2 span.on{background:var(--accent);color:#fff;font-weight:700}
.ph .viewbar{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#667}
.ph .viewbar .seg{margin-left:auto}
.ph .seg{display:inline-flex;border:1px solid #cfd5de;border-radius:8px;overflow:hidden;background:#fff}
.ph .seg span{padding:6px 10px;display:inline-flex;align-items:center;border-left:1px solid #cfd5de}
.ph .seg span:first-child{border-left:0}
.ph .seg span.on{background:var(--accent);color:#fff}
.ph .seg svg{width:18px;height:18px}
.ph .scroll{display:flex;gap:6px;overflow:hidden;white-space:nowrap}
.ph .scroll span{padding:6px 12px;border-radius:999px;border:1px solid #cfd5de;background:#fff;font-size:13px;color:#334}
.ph .scroll span.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
.ph .scroll span em{font-style:normal;font-weight:700;margin-left:4px}
.ph .sec{background:#fff;border:1px solid #e3e6ec;border-radius:12px;overflow:hidden}
.ph .sec h3{margin:0;padding:9px 12px;font-size:14.5px;display:flex;align-items:center;gap:8px;background:#f7f8fa;border-bottom:1px solid #eef0f4}
.ph .sec h3 small{color:#667;font-weight:400;font-size:12.5px}
.ph .sec.fold h3{border-bottom:0}
.ph .sec.fold h3:after{content:"▸";margin-left:auto;color:#667}
.ph .it{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:10px 12px;border-top:1px solid #f0f2f5}
.ph .it:first-of-type{border-top:0}
.ph .it b{font-size:16px}
.ph .it .sub{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ph .it .btn-p,.ph .it .btn-s{grid-row:1 / span 2;grid-column:2;min-height:44px;padding:0 14px}
.ph .cards{display:flex;flex-direction:column;gap:8px}
.ph .card .r1 b{font-size:16px}
.ph .dot{width:auto;flex:1}
.ph .dot i{width:30px;height:30px;font-size:13px}
`
function phonePage(inner) {
  return `<!doctype html><meta charset="utf-8"><style>${CSS}${PHONE_CSS}</style><div class="pbar-top"><span class="back">‹ 一覧</span><h1>点検表</h1><span class="lk">${LINK_SVG}リンク</span></div><div class="ph">${inner}</div>`
}
function phList() {
  const firstUpcoming = ROUNDS.findIndex((_, k) => !started(k))
  const secs = ROUNDS.map((l, r) => {
    const left = myLeft(r)
    if (!left.length) return ''
    const kind = started(r) ? 'left' : r === firstUpcoming ? 'now' : 'later'
    const lab = kind === 'left' ? `<span class="lab left">${l}の残り</span>` : kind === 'now' ? '<span class="lab now">次の回</span>' : '<span class="lab later">まだ先</span>'
    const rows = kind === 'later' ? '' : left.slice(0, kind === 'now' ? 4 : 9).map((s) => `<div class="it"><b>${s.name}</b><span class="${kind === 'left' ? 'btn-p' : 'btn-s'}">済み</span><span class="sub">${gtag(s.g)}${pdf(s)}${note(s)}</span></div>`).join('')
    const more = kind === 'now' && left.length > 4 ? `<div class="it" style="color:#667;font-size:13px;display:block;text-align:center">ほか ${left.length - 4}人 ▾</div>` : ''
    return `<div class="sec ${kind === 'later' ? 'fold' : ''}"><h3>${l}${lab}<small>${left.length}人</small></h3>${rows}${more}</div>`
  }).join('')
  const counts = ROUNDS.map((l, r) => (started(r) ? myLeft(r).length : 0))
  const leftAll = counts.reduce((a, b) => a + b, 0)
  return phonePage(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
    <div class="seg2"><span class="on">自分の担当</span><span>コース全体</span></div>
    <div class="viewbar">見せ方${seg([ICON.list, ICON.table, ICON.card], 0)}</div>
    <div class="scroll"><span class="on">まだの分<em>${leftAll}</em></span>${ROUNDS.map((l) => `<span>${l}</span>`).join('')}</div>${secs}`)
}
function phCards() {
  const list = S.filter((s) => s.g === 1)
  return phonePage(`<div class="course">映画・舞台衣装デザイナー コース<i>▾</i></div>
    <div class="seg2"><span>自分の担当</span><span class="on">コース全体</span></div>
    <div class="viewbar">見せ方${seg([ICON.list, ICON.table, ICON.card], 2)}</div>
    <div class="scroll"><span>すべて</span>${GROUPS.map((g, i) => `<span class="${i === 1 ? 'on' : ''}">${g}</span>`).join('')}</div>
    <div class="legend" style="font-size:12px">${gtag(1)}　${list.length}人・3回目 ${doneN(2, list)}人済み　<span style="margin-left:auto">太い枠：自分の担当</span></div>
    <div class="cards">${list.slice(0, 5).map((s) => card(s)).join('')}</div>`)
}

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    // パソコン
    for (const [name, make] of [['①PC_リスト_自分の担当_まだの分', pcList], ['②PC_表_コース全体', pcTable], ['③PC_カード_コース全体と右の欄', pcCards], ['④PC_担当の割り振り_3等分のコース', pcAssign]]) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.addStyleTag({ content: CSS })
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
        SHEET_SVG,
      )
      await sleep(500)
      await page.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
      await context.close()
    }
    // スマホ
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
