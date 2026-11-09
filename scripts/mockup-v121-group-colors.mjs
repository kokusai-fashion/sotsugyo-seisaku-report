// mockups/v121（2026-11-09）：点検表の所属の色分けの見本（依頼者：所属に分かりやすい区分表記はあるか → 色分けの見本を見たい）
//   今：所属の列と、所属の境の太い線だけ（v118）。回の列の「済み」は先生ごとの淡い色（薄赤・緑・砂色）なので、まぎれない色にする
//   案A 所属の列のセルだけ、所属ごとの淡い色（青灰・藤・水色。4つ目からは繰り返し）
//   案B 所属ごとに、回の列と ✓ の列の地を白と薄い灰色で交互（色は使わない）
//   案C 所属の列と氏名の列を、所属ごとの淡い色
//   どれも Google スプレッドシートのセルの地の色でできる。学生の名前はすべて作り物。使い方：node scripts/mockup-v121-group-colors.mjs（Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const OUT = 'mockups/v121'
mkdirSync(OUT, { recursive: true })

// ふりがな・氏名・グループ（0 から。①9人・②9人・③8人。v118 と同じ学生）
const RAW = [
  ['青木　美咲', 1], ['石田　遥', 0], ['上野　空', 2], ['遠藤　莉子', 0], ['太田　結衣', 1], ['金子　奈々', 2], ['木村　葵', 0], ['久保　芽依', 1], ['小林　陽菜', 2],
  ['斎藤　美緒', 0], ['清水　楓', 1], ['鈴木　彩花', 0], ['瀬川　真央', 2], ['高橋　咲良', 1], ['千葉　千尋', 0], ['塚本　七海', 2], ['寺田　優花', 1], ['中島　菜摘', 0],
  ['西村　里奈', 2], ['野口　杏', 1], ['長谷川　舞', 0], ['平野　凛', 2], ['福田　紗希', 1], ['星野　桃子', 0], ['前田　和花', 2], ['三浦　未来', 1],
]
const GROUPS = ['①グループ', '②グループ', '③グループ']
const STUDENTS = RAW.map(([name, g]) => ({ name, g })).sort((a, b) => a.g - b.g)
const T = ['山本', '中村', '小川']
const who = (g, r) => T[(((g - r) % 3) + 3) % 3]
const TONE = { 山本: { bg: '#f8e1e4', ink: '#8a3442' }, 中村: { bg: '#e7efe6', ink: '#3d6342' }, 小川: { bg: '#f2ece0', ink: '#7a5a2c' } }
// 所属の色（先生の色：薄赤・緑・砂色、見出しの青・黄・緑とまぎれない、くすんだ淡い色。字は濃い同じ色）
const GROUP_TONES = [
  { bg: '#d7e1f2', ink: '#2d4470' },
  { bg: '#e5d9f2', ink: '#56377c' },
  { bg: '#cfeaec', ink: '#1b5a5e' },
]
// 案B：交互の所属は、ツールの灰色の列を少し濃く、回の列（予定）と教務提出の地を薄い灰色に（許可の列の黄色はそのまま）
const BAND = '#eceef2'
const TOOL_DARK = '#e1e4e8'
const ROWS = STUDENTS.map((s, i) => {
  const done = i === 6 ? 1 : i % 5 === 2 ? 2 : 3
  return {
    ...s,
    no: i + 1,
    pdf: i === 6 ? '' : ['12/14', '12/15', '12/11', '12/9', '12/16', '11/20', '12/12'][i % 7],
    rounds: [0, 1, 2, 3, 4].map((r) => ({ t: who(s.g, r), done: r < done })),
    abstractOk: done >= 3,
    note: i === 6 ? 'PDF まだ' : '',
  }
})

const PLANS = {
  now: { title: '今の形　所属の列と、境の太い線だけ', note: '色分けはなし。' },
  A: { title: '案A　所属の列のセルだけ、所属ごとの淡い色', note: '所属の名前のセルだけに色。ほかの列は今のまま。' },
  B: { title: '案B　所属ごとに、行の地を交互に少し濃く', note: '色は使わない。②（1つおきの所属）だけ、灰色の列を少し濃く、回の列の地を薄い灰色に。' },
  C: { title: '案C　所属の列と氏名の列を、所属ごとの淡い色', note: '名前を見るときにも所属が分かる。' },
}

const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
// 「済み」は、本物と同じくセルの地ごと先生の色（条件付き書式）。予定は灰色の字
const roundCell = (x, edge, band) =>
  x.done
    ? `<td class="c${edge}" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink};font-weight:700">${x.t} 済み</td>`
    : `<td class="c plan${edge}"${band ? ` style="background:${band}"` : ''}>${x.t} 予定</td>`

function sheet(plan) {
  const p = PLANS[plan]
  const head = [
    ['番号', 'tool', 30],
    ['所属', 'tool', 72],
    ['氏名', 'tool', 84],
    ['最新<br>PDF', 'tool', 40],
    ['1回目', 'round', 66],
    ['2回目', 'round', 66],
    ['3回目', 'round', 66],
    ['4回目', 'round', 66],
    ['抄録', 'round', 66],
    ['抄録<br>許可', 'perm', 38],
    ['最終<br>提出可', 'perm', 42],
    ['教務<br>提出', 'kyomu', 38],
    ['知らせ', 'tool', 62],
  ]
  const rows = ROWS.map((r, k) => {
    const edge = k > 0 && r.g !== ROWS[k - 1].g ? ' edge' : ''
    const tone = GROUP_TONES[r.g % GROUP_TONES.length]
    const colored = (on) => (on ? ` style="background:${tone.bg};color:${tone.ink}"` : '')
    const band = plan === 'B' && r.g % 2 === 1 ? BAND : null
    const kyomuBg = band ? ` style="background:${band}"` : ''
    const dark = band ? ` style="background:${TOOL_DARK}"` : ''
    return [
      `<td class="tool num${edge}"${dark}>${r.no}</td>`,
      `<td class="tool c grp${edge}"${plan === 'A' || plan === 'C' ? colored(true) : dark}>${GROUPS[r.g]}</td>`,
      `<td class="tool name${edge}"${plan === 'C' ? colored(true) : dark}>${r.name}</td>`,
      `<td class="tool c${edge}"${dark}>${r.pdf ? `<a>${r.pdf}</a>` : ''}</td>`,
      ...r.rounds.map((x) => roundCell(x, edge, band)),
      `<td class="perm c${edge}">${box(r.abstractOk)}</td>`,
      `<td class="perm c${edge}">${box(false)}</td>`,
      `<td class="c${edge}"${kyomuBg}>${box(false)}</td>`,
      `<td class="tool dim${edge}"${dark}>${r.note}</td>`,
    ].join('')
  })
  const headCells = head.map(([h, role, w]) => `<th class="${role}" style="width:${w}px">${h}</th>`).join('')
  const letters = head.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')
  return `<div class="wrap">
<div class="cap"><b>${p.title}</b><span class="sub">${p.note}</span></div>
<table>
<tr class="letters"><th class="rn"></th>${letters}</tr>
<tr class="head"><td class="rn">2</td>${headCells}</tr>
${rows.map((l, k) => `<tr><td class="rn">${k + 3}</td>${l}</tr>`).join('\n')}
</table></div>`
}

const CSS = `
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 14px;display:inline-block}
.cap{padding:14px 14px 10px;font-size:15px;line-height:1.6}
.cap b{font-size:18px;display:block;margin-bottom:2px}
.cap .sub{color:#4a4f57}
table{border-collapse:collapse;font-size:12px;margin-left:12px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:22px;padding:0 4px;white-space:nowrap;overflow:hidden}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:10px;height:17px;text-align:center}
.rn{background:#f8f9fa;color:#5f6368;font-size:10px;text-align:center;width:26px;padding:0}
.head th{font-weight:700;font-size:11px;line-height:1.2;height:34px;text-align:center;white-space:normal}
.head th.tool{background:#dadce0;color:#3c4043}
.head th.round{background:#d6e4f5;color:#1f3f6b}
.head th.perm{background:#f8dc8c;color:#5c3b00}
.head th.kyomu{background:#d3ead6;color:#1e5b2a}
td.tool{background:#f3f4f6;color:#3c4043}
td.num{text-align:right}
td.name{font-weight:700;color:#202124}
td.c{text-align:center}
td.grp{font-weight:700;font-size:11.5px}
td.plan{color:#a0a5ad;font-size:11px}
td.perm{background:#fcf9ee}
td.dim{color:#80868b;font-size:11px}
td.edge{border-top:2px solid #6b7280}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:12px;height:12px;border:2px solid #80868b;border-radius:2px;line-height:12px;font-size:11px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#5f6368;border-color:#5f6368}
`

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1.5 })
  for (const plan of Object.keys(PLANS)) {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style>${sheet(plan)}`, { waitUntil: 'load' })
    const el = await page.$('.wrap')
    await el.screenshot({ path: `${OUT}/${plan === 'now' ? '今の形' : `案${plan}`}.png` })
    console.log('saved', plan)
  }
})
