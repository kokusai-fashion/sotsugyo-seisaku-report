// mockups/v107（2026-11-04）：点検表の見本 その4（依頼者：v106 は色がうるさい。もう少し落ち着いた色に）
//   2段組・学籍番号とふりがななし・最新 PDF ありは v106 のまま。回の札の色だけ3つの案
//   案A 済みだけ先生ごとの淡い色（予定は白地に灰色の字）／案B 色は字だけ（済み＝先生の色の字、予定＝灰色の字）／案C 色なし（済み＝黒い字と ✓、予定＝灰色の字）
//   どれも Google スプレッドシートのプルダウンと条件付き書式でできる色。名前はすべて作り物。使い方：node scripts/mockup-v107-check-sheet-colors.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v107'
mkdirSync(OUT, { recursive: true })

const NAMES = [
  '青木　美咲', '石田　遥', '上野　空', '遠藤　莉子', '太田　結衣', '金子　奈々', '木村　葵', '久保　芽依', '小林　陽菜', '斎藤　美緒', '清水　楓', '鈴木　彩花', '瀬川　真央',
  '高橋　咲良', '千葉　千尋', '塚本　七海', '寺田　優花', '中島　菜摘', '西村　里奈', '野口　杏', '長谷川　舞', '平野　凛', '福田　紗希', '星野　桃子', '前田　和花', '三浦　未来',
]
const T = ['山本', '中村', '小川']
// くすんだ青・緑・砂色（淡い地と、濃い字）
const TONE = {
  山本: { bg: '#e6edf5', ink: '#30527a' },
  中村: { bg: '#e7efe6', ink: '#3d6342' },
  小川: { bg: '#f2ece0', ink: '#7a5a2c' },
}
const PLAN = '#a0a5ad'

const STYLES = {
  A: {
    title: '案A　済みだけ、先生ごとの淡い色',
    note: '予定は白地に灰色の字。見終わると、その先生の淡い色になります。',
    done: (t) => `<span class="tag" style="background:${TONE[t].bg};color:${TONE[t].ink}">${t} 済み</span>`,
    plan: (t) => `<span class="tag plan">${t} 予定</span>`,
  },
  B: {
    title: '案B　色は字だけ',
    note: '地の色はなし。済みは先生ごとの色の字、予定は灰色の字です。',
    done: (t) => `<span class="txt" style="color:${TONE[t].ink}">${t} 済み</span>`,
    plan: (t) => `<span class="txt" style="color:${PLAN}">${t} 予定</span>`,
  },
  C: {
    title: '案C　色を使わない',
    note: '済みは黒い字に ✓、予定は灰色の字。先生は名前で見分けます。',
    done: (t) => `<span class="txt" style="color:#202124">✓ ${t}</span>`,
    plan: (t) => `<span class="txt" style="color:${PLAN}">${t} 予定</span>`,
  },
}

const group = (i) => (i < 9 ? 0 : i < 18 ? 1 : 2)
const who = (i, round) => T[(group(i) + [0, 1, 2, 2, 0][round]) % 3]
// 12月の半ばごろの様子（予定と済みが混ざる。PDF をまだ出していない学生も）
const rows = NAMES.map((name, i) => {
  const done = i === 6 ? 1 : i % 4 === 1 ? 2 : i % 5 === 3 ? 4 : 3
  return {
    no: i + 1,
    name,
    pdf: i === 6 ? '' : ['12/14', '12/15', '12/11', '12/9', '12/16', '11/20', '12/12'][i % 7],
    rounds: [0, 1, 2, 3, 4].map((r) => ({ t: who(i, r), done: r < done })),
    abstractOk: done >= 3,
    finalOk: false,
    kyomu: false,
    note: i === 6 ? 'PDF まだ' : '',
  }
})

const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
const HEAD = ['番号', '氏名', '最新<br>PDF', '1回目', '2回目', '3回目', '抄録', '4回目', '抄録<br>許可', '最終<br>提出可', '教務<br>提出', '知らせ']
const W = [28, 78, 40, 62, 62, 62, 62, 62, 36, 36, 36, 60]

function sheet(style) {
  const block = (list) =>
    list.map((r) =>
      [
        `<td class="tool num">${r.no}</td>`,
        `<td class="name">${r.name}</td>`,
        `<td class="tool c">${r.pdf ? `<a>${r.pdf}</a>` : '<span class="dim">—</span>'}</td>`,
        ...r.rounds.map((x) => `<td class="c">${x.done ? style.done(x.t) : style.plan(x.t)}</td>`),
        `<td class="perm c">${box(r.abstractOk)}</td>`,
        `<td class="perm c">${box(r.finalOk)}</td>`,
        `<td class="c">${box(r.kyomu)}</td>`,
        `<td class="tool dim">${r.note}</td>`,
      ].join(''),
    )
  const half = Math.ceil(rows.length / 2)
  const left = block(rows.slice(0, half))
  const right = block(rows.slice(half))
  const headCells = HEAD.map((h, i) => `<th class="${i === 8 || i === 9 ? 'perm' : i === 0 || i === 2 || i === 11 ? 'toolh' : ''}" style="width:${W[i]}px">${h}</th>`).join('')
  return `<div class="wrap">
<div class="cap"><b>${style.title}</b><span>${style.note}</span></div>
<div class="bar"><span class="icon"></span><span class="name">2026年度 点検表（映画・舞台衣装デザイナー コース）</span><span class="share">共有：このコースの先生3人</span></div>
<table>
<tr class="letters"><th class="rn"></th>${HEAD.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')}<th class="gap"></th>${HEAD.map((_, i) => `<th>${String.fromCharCode(65 + HEAD.length + 1 + i)}</th>`).join('')}</tr>
<tr class="head"><td class="rn">1</td>${headCells}<th class="gap"></th>${headCells}</tr>
${left.map((l, k) => `<tr><td class="rn">${k + 2}</td>${l}<td class="gap"></td>${right[k] ?? HEAD.map(() => '<td></td>').join('')}</tr>`).join('')}
</table></div>`
}

const CSS = `
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 12px;display:inline-block}
.cap{display:flex;gap:14px;align-items:baseline;padding:12px 12px 8px;font-size:15px}
.cap b{font-size:18px}
.cap span{color:#555;font-size:14px}
.bar{display:flex;align-items:center;gap:10px;padding:8px 12px 8px;border-top:1px solid #e0e3e7;border-bottom:1px solid #e0e3e7;margin-bottom:6px}
.bar .icon{width:18px;height:24px;border-radius:3px;background:#188038;position:relative}
.bar .icon:after{content:"";position:absolute;inset:7px 4px;border:2px solid #fff;border-radius:1px}
.bar .name{font-size:15px}
.bar .share{margin-left:auto;font-size:12px;color:#444;background:#c2e7ff;border-radius:999px;padding:5px 14px;font-weight:600}
table{border-collapse:collapse;font-size:12px;margin-left:12px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:22px;padding:0 4px;white-space:nowrap;overflow:hidden}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:10px;height:17px;text-align:center}
.rn{background:#f8f9fa;color:#5f6368;font-size:10px;text-align:center;width:26px;padding:0}
.head th{background:#f1f3f4;font-weight:700;font-size:11px;line-height:1.2;height:32px;text-align:center;white-space:normal}
.head th.perm{background:#f6efd2}
.head th.toolh{background:#e8eaed}
.gap{width:10px;background:#fff;border-top:0!important;border-bottom:0!important}
td.tool{background:#f3f4f6;color:#3c4043}
td.num{text-align:right}
td.name{font-weight:600}
td.c{text-align:center}
td.perm{background:#fcf9ee}
td.dim,.dim{color:#80868b;font-size:11px}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:12px;height:12px;border:2px solid #80868b;border-radius:2px;line-height:12px;font-size:11px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#5f6368;border-color:#5f6368}
.tag{display:inline-block;border-radius:4px;padding:0 6px;font-size:11px;line-height:16px;font-weight:600}
.tag.plan{color:${PLAN};font-weight:400}
.txt{font-size:11.5px;font-weight:600}
`

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1800, height: 700, deviceScaleFactor: 1.5 })
  for (const [key, style] of Object.entries(STYLES)) {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style>${sheet(style)}`, { waitUntil: 'load' })
    const el = await page.$('.wrap')
    await el.screenshot({ path: `${OUT}/案${key}_点検表の色.png` })
    console.log('saved', key)
  }
})
