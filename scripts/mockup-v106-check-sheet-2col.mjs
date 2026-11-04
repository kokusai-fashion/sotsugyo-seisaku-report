// mockups/v106（2026-11-04）：点検表の見本 その3（依頼者：今の確認表と同じ2段組に。表を小さく。学籍番号は要らない。最新の PDF は残す。先生ごとに色分け）
//   左右2段に、ふりがなの順で半分ずつ。回の列は先生の名前のプルダウン（先生ごとの色。薄い＝予定、濃い＝済み）
//   ツールが学生の行を見つける印（学籍番号）は、見えない所に持たせる（表には出さない）
//   学生・先生の名前はすべて作り物。使い方：node scripts/mockup-v106-check-sheet-2col.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v106'
mkdirSync(OUT, { recursive: true })

const NAMES = [
  '青木　美咲', '石田　遥', '上野　空', '遠藤　莉子', '太田　結衣', '金子　奈々', '木村　葵', '久保　芽依', '小林　陽菜', '斎藤　美緒', '清水　楓', '鈴木　彩花', '瀬川　真央',
  '高橋　咲良', '千葉　千尋', '塚本　七海', '寺田　優花', '中島　菜摘', '西村　里奈', '野口　杏', '長谷川　舞', '平野　凛', '福田　紗希', '星野　桃子', '前田　和花', '三浦　未来',
]
const T = ['山本', '中村', '小川']
const COLOR = {
  山本: { soft: '#e3edfd', ink: '#1a56c4', solid: '#1a56c4' },
  中村: { soft: '#fdebdc', ink: '#b2560e', solid: '#d9711c' },
  小川: { soft: '#efe6fb', ink: '#6b3fb0', solid: '#7b4bc4' },
}
// 3つの組（1〜9・10〜18・19〜26）で、回ごとに先生を替える。抄録は3回目と同じ先生
const group = (i) => (i < 9 ? 0 : i < 18 ? 1 : 2)
const who = (i, round) => T[(group(i) + [0, 1, 2, 2, 0][round]) % 3]

// 1月13日ごろの様子（ほとんど4回目まで。遅れている学生・PDF をまだ出していない学生・許可のあとに書き換えた学生）
const rows = NAMES.map((name, i) => {
  const behind = i === 6 ? 2 : i === 15 ? 3 : i === 22 ? 4 : i % 5 === 3 ? 4 : 5 // 済んだ回の数
  const rounds = [0, 1, 2, 3, 4].map((r) => ({ t: who(i, r), done: r < behind }))
  const abstractOk = behind >= 3
  const finalOk = behind >= 5 && i % 4 !== 1
  return {
    no: i + 1,
    name,
    pdf: i === 6 ? '' : ['1/12', '1/13', '1/11', '1/9', '1/13', '12/20', '1/12'][i % 7],
    rounds,
    abstractOk,
    finalOk,
    kyomu: finalOk && i % 3 === 0,
    note: i === 6 ? 'PDF まだ' : i === 11 ? '書き換え 1/14' : '',
  }
})

const chip = ({ t, done }) => {
  const c = COLOR[t]
  return done ? `<span class="chip" style="background:${c.solid};color:#fff">${t} 済み</span>` : `<span class="chip" style="background:${c.soft};color:${c.ink}">${t} 予定</span>`
}
const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`

const HEAD = ['番号', '氏名', '最新<br>PDF', '1回目', '2回目', '3回目', '抄録', '4回目', '抄録<br>許可', '最終<br>提出可', '教務<br>提出', '知らせ']
const W = [28, 78, 40, 64, 64, 64, 64, 64, 36, 36, 36, 72]
const ROUND_COLS = [3, 4, 5, 6, 7]
const block = (list, first) =>
  list
    .map((r) => {
      const cells = [
        `<td class="tool num">${r.no}</td>`,
        `<td class="name">${r.name}</td>`,
        `<td class="tool c">${r.pdf ? `<a>${r.pdf}</a>` : '<span class="dim">—</span>'}</td>`,
        // 並び：1回目・2回目・3回目・抄録・4回目
        ...[0, 1, 2, 3, 4].map((k) => `<td class="c">${chip(r.rounds[k])}</td>`),
        `<td class="perm c">${box(r.abstractOk)}</td>`,
        `<td class="perm c">${box(r.finalOk)}</td>`,
        `<td class="c">${box(r.kyomu)}</td>`,
        `<td class="tool ${r.note.startsWith('書き換え') ? 'warn' : 'dim'}">${r.note}</td>`,
      ]
      return cells.join('')
    })
    .map((cells) => cells)

const half = Math.ceil(rows.length / 2)
const left = block(rows.slice(0, half))
const right = block(rows.slice(half))
const headCells = HEAD.map((h, i) => `<th class="${i === 8 || i === 9 ? 'perm' : ROUND_COLS.includes(i) ? 'round' : i === 0 || i === 2 || i === 11 ? 'toolh' : ''}" style="width:${W[i]}px">${h}</th>`).join('')

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 12px;display:inline-block}
.bar{display:flex;align-items:center;gap:10px;padding:9px 12px 7px;border-bottom:1px solid #e0e3e7}
.bar .icon{width:20px;height:26px;border-radius:3px;background:#188038;position:relative}
.bar .icon:after{content:"";position:absolute;inset:7px 5px;border:2px solid #fff;border-radius:1px}
.bar .name{font-size:16px}
.bar .share{margin-left:auto;font-size:12px;color:#444;background:#c2e7ff;border-radius:999px;padding:6px 14px;font-weight:600}
.legend{display:flex;gap:16px;font-size:12px;color:#444;padding:7px 12px;flex-wrap:wrap;align-items:center}
.legend .sw{display:inline-flex;gap:4px;align-items:center}
.legend i.box{display:inline-block;width:12px;height:12px;border:1px solid #c7c7c7;vertical-align:-2px;margin-right:4px}
table{border-collapse:collapse;font-size:12px;margin-left:12px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:22px;padding:0 4px;white-space:nowrap;overflow:hidden}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:10px;height:17px;text-align:center}
.rn{background:#f8f9fa;color:#5f6368;font-size:10px;text-align:center;width:26px;padding:0}
.head th{background:#f1f3f4;font-weight:700;font-size:11px;line-height:1.2;height:32px;text-align:center;white-space:normal}
.head th.perm{background:#fff3c4}
.head th.toolh{background:#e3e6e9}
.head th.gap,.gap{width:10px;background:#fff;border-top:0;border-bottom:0}
td.tool{background:#eef0f2;color:#3c4043}
td.num{text-align:right}
td.name{font-weight:600}
td.c{text-align:center}
td.perm{background:#fffbe6}
td.dim,.dim{color:#80868b;font-size:11px}
td.warn{color:#c5221f;font-weight:700;background:#fce8e6;font-size:11px}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:12px;height:12px;border:2px solid #5f6368;border-radius:2px;line-height:12px;font-size:11px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#1a73e8;border-color:#1a73e8}
.chip{display:inline-block;border-radius:999px;padding:0 6px;font-size:11px;line-height:16px;font-weight:600}
.tabs{display:flex;gap:2px;margin:8px 0 0 12px;font-size:12px}
.tabs span{padding:5px 12px;background:#e8f0fe;color:#0b57d0;font-weight:700;border-radius:0 0 6px 6px}
</style><div class="wrap">
<div class="bar"><span class="icon"></span><span class="name">2026年度 点検表（映画・舞台衣装デザイナー コース）</span><span class="share">共有：このコースの先生3人</span></div>
<div class="legend">
<span class="sw">先生：${T.map((t) => `<span class="chip" style="background:${COLOR[t].solid};color:#fff">${t}</span>`).join('')}</span>
<span class="sw"><span class="chip" style="background:${COLOR['山本'].soft};color:${COLOR['山本'].ink}">山本 予定</span>→<span class="chip" style="background:${COLOR['山本'].solid};color:#fff">山本 済み</span>（名前を選ぶ）</span>
<span><i class="box" style="background:#fff3c4"></i>✓ を入れると、その学生のツールに届く</span>
<span><i class="box" style="background:#e3e6e9"></i>ツールが入れる</span>
</div>
<table>
<tr class="letters"><th class="rn"></th>${HEAD.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')}<th class="gap"></th>${HEAD.map((_, i) => `<th>${String.fromCharCode(65 + HEAD.length + 1 + i)}</th>`).join('')}</tr>
<tr class="head"><td class="rn">1</td>${headCells}<th class="gap"></th>${headCells}</tr>
${left.map((l, k) => `<tr><td class="rn">${k + 2}</td>${l}<td class="gap"></td>${right[k] ?? HEAD.map(() => '<td></td>').join('')}</tr>`).join('')}
</table>
<div class="tabs"><span>点検表</span></div>
</div>`

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1800, height: 700, deviceScaleFactor: 1.5 })
  await page.setContent(html, { waitUntil: 'load' })
  const el = await page.$('.wrap')
  await el.screenshot({ path: `${OUT}/点検表の見本_2段組_先生ごとの色.png` })
  const size = await el.evaluate((e) => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)
  console.log('ok', size)
})
