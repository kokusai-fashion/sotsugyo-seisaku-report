// mockups/v104（2026-11-04）：ツールが作る点検表（コースごとのスプレッドシート）の見本（依頼者の今の確認表の列に合わせる。名簿は貼らず、ふりがなの順）
//   灰色の列はツールが入れる。白い列は先生が書く（名前・✓）。ツールが読むのは「抄録を書いてよい」「最終提出可」の ✓ だけ
//   学生・先生の名前と学籍番号はすべて作り物。使い方：node scripts/mockup-v104-check-sheet.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v104'
mkdirSync(OUT, { recursive: true })

// [ふりがな, 氏名, 学籍番号, 最新の PDF, 1回目, 2回目, 3回目, 抄録を書いてよい, 抄録, 4回目, 最終提出可, 教務提出確認, ツールからの知らせ]
const ROWS = [
  ['アオキ ミサキ', '青木　美咲', '00ZZ0107', '1/12 21:40', '山本', '中村', '小川', true, '小川', '山本', true, true, ''],
  ['イシダ ハルカ', '石田　遥', '00ZZ0131', '1/13 09:05', '山本', '中村', '小川', true, '小川', '山本', true, false, '最終提出可のあとに書き換えた（1/14 10:22）'],
  ['ウエノ ソラ', '上野　空', '00ZZ0112', '1/10 18:31', '山本', '中村', '小川', true, '小川', '山本', false, false, ''],
  ['エンドウ リコ', '遠藤　莉子', '00ZZ0145', '12/16 23:58', '中村', '小川', '山本', true, '山本', '', false, false, ''],
  ['オオタ ユイ', '太田　結衣', '00ZZ0103', '12/9 08:12', '中村', '小川', '山本', false, '', '', false, false, ''],
  ['カネコ ナナ', '金子　奈々', '00ZZ0126', '11/9 22:47', '中村', '小川', '', false, '', '', false, false, ''],
  ['キムラ アオイ', '木村　葵', '00ZZ0119', '—', '', '', '', false, '', '', false, false, 'まだ PDF を出していない'],
  ['クボ メイ', '久保　芽依', '00ZZ0140', '1/11 15:20', '小川', '山本', '中村', true, '中村', '小川', false, false, ''],
]

const COLS = [
  { t: '番号', w: 44, tool: true },
  { t: '学籍番号', w: 92, tool: true },
  { t: '氏名', w: 96, tool: true },
  { t: 'ふりがな', w: 112, tool: true },
  { t: '最新の PDF', w: 100, tool: true },
  { t: '1回目', w: 62 },
  { t: '2回目', w: 62 },
  { t: '3回目', w: 62 },
  { t: '抄録を<br>書いてよい', w: 84, perm: true },
  { t: '抄録', w: 56 },
  { t: '4回目', w: 62 },
  { t: '最終提出可', w: 84, perm: true },
  { t: '教務提出<br>確認', w: 72 },
  { t: 'ツールからの知らせ', w: 300, tool: true },
]

const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
const cell = (c, v, i) => {
  if (i === 0) return `<td class="tool num">${v}</td>`
  if (c.perm || c.t.startsWith('教務')) return `<td class="${c.perm ? 'perm' : ''} mid">${box(v)}</td>`
  if (c.t === '最新の PDF') return `<td class="tool">${v === '—' ? '<span class="dim">—</span>' : `<a>${v}</a>`}</td>`
  if (c.t === 'ツールからの知らせ') return `<td class="tool ${v.includes('書き換えた') ? 'warn' : 'dim'}">${v}</td>`
  return `<td class="${c.tool ? 'tool' : ''}">${v}</td>`
}

const letters = 'ABCDEFGHIJKLMNOP'
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 14px;display:inline-block}
.bar{display:flex;align-items:center;gap:10px;padding:10px 14px 8px;border-bottom:1px solid #e0e3e7}
.bar .icon{width:22px;height:28px;border-radius:3px;background:#188038;position:relative}
.bar .icon:after{content:"";position:absolute;inset:8px 5px;border:2px solid #fff;border-radius:1px}
.bar .name{font-size:17px}
.bar .share{margin-left:auto;font-size:13px;color:#444;background:#c2e7ff;border-radius:999px;padding:7px 16px;font-weight:600}
.legend{display:flex;gap:18px;font-size:13px;color:#444;padding:8px 14px}
.legend i{display:inline-block;width:14px;height:14px;border:1px solid #c7c7c7;vertical-align:-2px;margin-right:5px}
.legend i.t{background:#eceff1}.legend i.p{background:#e6f4ea}
table{border-collapse:collapse;font-size:13px;margin-left:14px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:26px;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:11px;height:20px;text-align:center}
.letters th.rn,.rn{background:#f8f9fa;color:#5f6368;font-size:11px;text-align:center;width:34px;padding:0}
.head th{background:#f1f3f4;font-weight:700;font-size:12px;line-height:1.25;height:40px;text-align:center;white-space:normal}
.head th.perm{background:#ceead6}
td.tool{background:#eceff1;color:#3c4043}
td.num{text-align:right}
td.perm{background:#e6f4ea}
td.mid{text-align:center}
td.dim,.dim{color:#9aa0a6}
td.warn{color:#c5221f;font-weight:700;background:#fce8e6}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:14px;height:14px;border:2px solid #5f6368;border-radius:2px;line-height:14px;font-size:12px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#1a73e8;border-color:#1a73e8}
.tabs{display:flex;gap:2px;margin:10px 0 0 14px;font-size:13px}
.tabs span{padding:6px 14px;background:#f1f3f4;border-radius:0 0 6px 6px;color:#444}
.tabs span.on{background:#e8f0fe;color:#0b57d0;font-weight:700}
</style><div class="wrap">
<div class="bar"><span class="icon"></span><span class="name">2026年度 点検表（映画・舞台衣装デザイナー コース）</span><span class="share">共有：このコースの先生3人</span></div>
<div class="legend"><span><i class="t"></i>ツールが入れる（書き換えない）</span><span><i></i>先生が書く</span><span><i class="p"></i>✓ を入れると、その学生のツールに届く</span></div>
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
  const el = await page.$('.wrap')
  await el.screenshot({ path: `${OUT}/点検表の見本.png` })
  console.log('ok')
})
