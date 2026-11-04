// mockups/v105（2026-11-04）：点検表の見本 その2（依頼者：次の回を誰が見るかも見せたい。回の数・名前・抄録の時期はコースで違う）
//   回の列（白）は、コースの先生の名前から選ぶ（Google スプレッドシートのプルダウン）。「山本 予定」（灰色）→ 見終わったら「山本 済み」（緑）
//   ツールが決めているのは、灰色の列と、緑の見出しの ✓ の2列（抄録を書いてよい・最終提出可）だけ。回の列は足す・消す・名前を変えるのも自由
//   学生・先生の名前と学籍番号はすべて作り物。使い方：node scripts/mockup-v105-check-sheet-plan.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v105'
mkdirSync(OUT, { recursive: true })

// 回の中身：'山本+'（済み）・'山本?'（予定）・''（空）
// [ふりがな, 氏名, 学籍番号, 最新の PDF, 1回目, 2回目, 3回目, 抄録を書いてよい, 抄録, 4回目, 最終提出可, 教務提出確認, ツールからの知らせ]
const ROWS = [
  ['アオキ ミサキ', '青木　美咲', '00ZZ0107', '12/14 21:40', '山本+', '中村+', '小川+', true, '小川?', '山本?', false, false, ''],
  ['イシダ ハルカ', '石田　遥', '00ZZ0131', '12/16 09:05', '山本+', '中村+', '小川+', true, '小川+', '山本?', false, false, ''],
  ['ウエノ ソラ', '上野　空', '00ZZ0112', '12/10 18:31', '山本+', '中村+', '小川?', false, '小川?', '山本?', false, false, ''],
  ['エンドウ リコ', '遠藤　莉子', '00ZZ0145', '12/12 23:58', '中村+', '小川+', '山本+', true, '山本?', '中村?', false, false, ''],
  ['オオタ ユイ', '太田　結衣', '00ZZ0103', '12/9 08:12', '中村+', '小川+', '山本?', false, '山本?', '中村?', false, false, ''],
  ['カネコ ナナ', '金子　奈々', '00ZZ0126', '11/9 22:47', '中村+', '小川?', '山本?', false, '山本?', '中村?', false, false, ''],
  ['キムラ アオイ', '木村　葵', '00ZZ0119', '—', '小川?', '山本?', '中村?', false, '中村?', '小川?', false, false, 'まだ PDF を出していない'],
  ['クボ メイ', '久保　芽依', '00ZZ0140', '12/11 15:20', '小川+', '山本+', '中村+', true, '中村?', '小川?', false, false, ''],
]

const COLS = [
  { t: '番号', w: 44, tool: true },
  { t: '学籍番号', w: 92, tool: true },
  { t: '氏名', w: 96, tool: true },
  { t: 'ふりがな', w: 112, tool: true },
  { t: '最新の PDF', w: 100, tool: true },
  { t: '1回目', w: 92, round: true },
  { t: '2回目', w: 92, round: true },
  { t: '3回目', w: 92, round: true },
  { t: '抄録を<br>書いてよい', w: 84, perm: true },
  { t: '抄録', w: 92, round: true },
  { t: '4回目', w: 92, round: true },
  { t: '最終提出可', w: 84, perm: true },
  { t: '教務提出<br>確認', w: 72 },
  { t: 'ツールからの知らせ', w: 190, tool: true },
]

const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
const chip = (v) => (!v ? '' : v.endsWith('+') ? `<span class="chip done">${v.slice(0, -1)} 済み<i>▾</i></span>` : `<span class="chip plan">${v.slice(0, -1)} 予定<i>▾</i></span>`)
const cell = (c, v, i) => {
  if (i === 0) return `<td class="tool num">${v}</td>`
  if (c.perm || c.t.startsWith('教務')) return `<td class="${c.perm ? 'perm' : ''} mid">${box(v)}</td>`
  if (c.round) return `<td>${chip(v)}</td>`
  if (c.t === '最新の PDF') return `<td class="tool">${v === '—' ? '<span class="dim">—</span>' : `<a>${v}</a>`}</td>`
  if (c.t === 'ツールからの知らせ') return `<td class="tool dim">${v}</td>`
  return `<td class="${c.tool ? 'tool' : ''}">${v}</td>`
}

const letters = 'ABCDEFGHIJKLMNOP'
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 14px;display:inline-block;position:relative}
.bar{display:flex;align-items:center;gap:10px;padding:10px 14px 8px;border-bottom:1px solid #e0e3e7}
.bar .icon{width:22px;height:28px;border-radius:3px;background:#188038;position:relative}
.bar .icon:after{content:"";position:absolute;inset:8px 5px;border:2px solid #fff;border-radius:1px}
.bar .name{font-size:17px}
.bar .share{margin-left:auto;font-size:13px;color:#444;background:#c2e7ff;border-radius:999px;padding:7px 16px;font-weight:600}
.legend{display:flex;gap:18px;font-size:13px;color:#444;padding:8px 14px;flex-wrap:wrap}
.legend i{display:inline-block;width:14px;height:14px;border:1px solid #c7c7c7;vertical-align:-2px;margin-right:5px}
.legend i.t{background:#eceff1}.legend i.p{background:#ceead6}
table{border-collapse:collapse;font-size:13px;margin-left:14px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:26px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:11px;height:20px;text-align:center}
.rn{background:#f8f9fa;color:#5f6368;font-size:11px;text-align:center;width:34px;padding:0}
.head th{background:#f1f3f4;font-weight:700;font-size:12px;line-height:1.25;height:40px;text-align:center;white-space:normal}
.head th.perm{background:#ceead6}
td.tool{background:#eceff1;color:#3c4043}
td.num{text-align:right}
td.perm{background:#e6f4ea}
td.mid{text-align:center}
td.dim,.dim{color:#7a8088}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:14px;height:14px;border:2px solid #5f6368;border-radius:2px;line-height:14px;font-size:12px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#1a73e8;border-color:#1a73e8}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:1px 8px;font-size:12px;line-height:18px}
.chip i{font-style:normal;font-size:9px;opacity:.7}
.chip.done{background:#c6efce;color:#0d5c1f;font-weight:700}
.chip.plan{background:#e8eaed;color:#5f6368}
.tabs{display:flex;gap:2px;margin:10px 0 0 14px;font-size:13px}
.tabs span{padding:6px 14px;background:#f1f3f4;border-radius:0 0 6px 6px;color:#444}
.tabs span.on{background:#e8f0fe;color:#0b57d0;font-weight:700}
.dd{position:absolute;background:#fff;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.25);padding:6px 0;font-size:13px;min-width:130px}
.dd div{padding:4px 12px}
.dd div.sel{background:#e8f0fe}
</style><div class="wrap">
<div class="bar"><span class="icon"></span><span class="name">2026年度 点検表（映画・舞台衣装デザイナー コース）</span><span class="share">共有：このコースの先生3人</span></div>
<div class="legend"><span><i class="t"></i>ツールが入れる（書き換えない）</span><span><i></i>回の列：先生の名前を選ぶ（予定 → 済み）。列は足す・消す・名前を変えるのも自由</span><span><i class="p"></i>✓ を入れると、その学生のツールに届く</span></div>
<table>
<tr class="letters"><th class="rn"></th>${COLS.map((c, i) => `<th style="width:${c.w}px">${letters[i]}</th>`).join('')}</tr>
<tr class="head"><td class="rn">1</td>${COLS.map((c) => `<th class="${c.perm ? 'perm' : ''}">${c.t}</th>`).join('')}</tr>
${ROWS.map((r, k) => `<tr><td class="rn">${k + 2}</td>${COLS.map((c, i) => cell(c, i === 0 ? k + 1 : i === 1 ? r[2] : i === 2 ? r[1] : i === 3 ? r[0] : r[i - 1], i)).join('')}</tr>`).join('')}
</table>
<div class="tabs"><span class="on">点検表</span></div>
</div>`

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1700, height: 600, deviceScaleFactor: 1.5 })
  await page.setContent(html, { waitUntil: 'load' })
  // 上野さんの「3回目」のプルダウンを開いた形（予定 → 済み に変えるところ）
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('table tr')]
    const td = rows[4].children[8]
    const r = td.getBoundingClientRect()
    const w = document.querySelector('.wrap').getBoundingClientRect()
    const dd = document.createElement('div')
    dd.className = 'dd'
    dd.innerHTML = ['山本 予定', '中村 予定', '小川 予定', '山本 済み', '中村 済み', '<b>小川 済み</b>'].map((t, i) => `<div class="${i === 5 ? 'sel' : ''}">${t}</div>`).join('')
    dd.style.left = `${r.left - w.left}px`
    dd.style.top = `${r.bottom - w.top + 2}px`
    document.querySelector('.wrap').append(dd)
    document.querySelector('.wrap').style.paddingBottom = '150px'
  })
  const el = await page.$('.wrap')
  await el.screenshot({ path: `${OUT}/点検表の見本_予定と済み.png` })
  console.log('ok')
})
