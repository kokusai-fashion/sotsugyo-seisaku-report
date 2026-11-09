// 点検表の画面のカードを押したときの右の欄（点検の回の行）の見本（依頼者 2026-11-09「ここの見え方が気になります」）。
// 今：札＋先生の選択＋ボタンの3つが並び、選択の右端がボタンの下に潜っている。案A・案B・案C を並べて写真にする。
//   node scripts/mockup-v127-panel-rows.mjs → mockups/v127/
import { mkdirSync, writeFileSync } from 'node:fs'
import { withEdge } from './poc/edge.mjs'

const OUT = 'mockups/v127'
mkdirSync(OUT, { recursive: true })
const T = { 梶田: ['#f8e1e4', '#8a3442'], 佐藤: ['#e7efe6', '#3d6342'], 加藤: ['#f2ece0', '#7a5a2c'] }
const rows = [
  ['1回目', '梶田', 'done'],
  ['2回目', '加藤', 'plan'],
  ['3回目', '佐藤', 'plan'],
  ['4回目', '梶田', 'plan'],
  ['抄録', '加藤', 'plan'],
]
const me = '梶田'
const chip = (t, s) =>
  s === 'done'
    ? `<span class="chip" style="background:${T[t][0]};color:${T[t][1]}">${t} 済み</span>`
    : `<span class="chip plan${t === me ? ' me' : ''}">${t} 予定</span>`
const btn = (t, s) => `<button class="do${s === 'done' ? '' : t === me ? ' strong' : ''}">${s === 'done' ? '予定に戻す' : '済みにする'}</button>`

const head = `<div class="hd"><b>青木　美咲</b><span class="g">①グループ</span><span class="x">×</span></div><a class="pdf">PDF 12/10</a><div class="lbl">点検の回</div>`
const perm = `<div class="perm"><div><span>抄録許可</span><i class="tog on"></i></div><div><span>最終提出可</span><i class="tog"></i></div><div><span>教務提出</span><i class="tog"></i></div></div>`

// 今
const now = rows.map(([l, t, s]) => `<div class="row now"><span class="r">${l}</span><span class="c">${chip(t, s)}<select><option>${t}</option></select></span>${btn(t, s)}</div>`).join('')
// 案A：札をなくし、先生の選択そのものを札の色にする（選択＋ボタンの2つ）
const a = rows
  .map(([l, t, s]) => {
    const style = s === 'done' ? `background:${T[t][0]};color:${T[t][1]};border-color:transparent` : t === me ? 'border:1.5px dashed #5d77bd;color:#2c4a9a;background:#f5f8fe' : 'border:1.5px dashed #b9bec7;color:#6b717c'
    return `<div class="row a"><span class="r">${l}</span><span class="pick" style="${style}">${t} ${s === 'done' ? '済み' : '予定'}<em>▾</em></span>${btn(t, s)}</div>`
  })
  .join('')
// 案B：2段。1段目は回と札とボタン、2段目に小さく「先生を変える」
const b = rows
  .map(([l, t, s]) => `<div class="row b"><div class="top"><span class="r">${l}</span>${chip(t, s)}${btn(t, s)}</div><a class="chg">先生を変える ▾</a></div>`)
  .join('')
// 案C：札だけを押すと「済み」⇄「予定」（表と同じ）。先生の選択は小さく右に
const c = rows
  .map(([l, t, s]) => `<div class="row c3"><span class="r">${l}</span><span class="big">${chip(t, s)}</span><select class="sm"><option>${t}</option></select></div>`)
  .join('')

const panel = (title, note, body) => `<section><h2>${title}</h2><p class="note">${note}</p><div class="panel">${head}${body}${perm}</div></section>`
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#eef1f5;font-family:"Noto Sans JP","Yu Gothic UI",sans-serif;color:#223;display:flex;gap:22px;align-items:flex-start}
section{width:330px}h2{margin:0 0 4px;font-size:17px}.note{margin:0 0 10px;font-size:12.5px;color:#556;line-height:1.6;min-height:60px}
.panel{background:#fff;border:1px solid #dfe3ea;border-radius:14px;box-shadow:0 8px 28px rgba(20,30,60,.12);padding:14px 16px;display:flex;flex-direction:column;gap:10px;font-size:13.5px}
.hd{display:flex;align-items:center;gap:8px}.hd b{font-size:18px}.g{padding:1px 9px;border-radius:999px;font-size:12.5px;font-weight:700;background:#d7e1f2;color:#2d4470}.x{margin-left:auto;color:#778;font-size:20px}
.pdf{color:#1a73e8;text-decoration:underline;font-size:12.5px}.lbl{font-size:12px;color:#667;font-weight:700;margin-bottom:-6px}
.row{border-top:1px solid #f0f2f5;padding:6px 0}.row:first-of-type{border-top:0}
.r{color:#556;font-weight:700;font-size:13px}
.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;border:1px solid transparent}
.chip.plan{background:#fff;border:1px dashed #b9bec7;color:#8a909a;font-weight:400}.chip.plan.me{border-color:#5d77bd;color:#2c4a9a;font-weight:700;background:#f5f8fe}
.do{border:1px solid #1e3a8a;color:#1e3a8a;background:#fff;border-radius:8px;padding:5px 12px;font-size:13px;font-weight:700;white-space:nowrap;font-family:inherit}.do.strong{background:#1e3a8a;color:#fff}
select{font-size:12.5px;padding:2px 4px;border:1px solid #d7dbe2;border-radius:6px;font-family:inherit;background:#fff}
.now{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:8px}.now .c{display:flex;gap:6px;min-width:0;overflow:visible}.now select{width:90px;margin-right:-34px}
.a{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:10px}
.pick{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 10px;border-radius:8px;font-weight:700;font-size:13px;border:1px solid}.pick em{font-style:normal;font-size:10px;opacity:.7}
.b .top{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:8px}.b .chg{display:block;margin:2px 0 0 60px;font-size:11.5px;color:#667;text-decoration:underline}
.c3{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:8px}.c3 .big .chip{font-size:13px;padding:5px 12px;cursor:pointer}.sm{font-size:11.5px;color:#556}
.perm{display:flex;flex-direction:column;gap:8px;background:#fbfaf3;border-radius:10px;padding:10px 12px}.perm div{display:flex;justify-content:space-between;align-items:center}
.tog{display:inline-block;width:30px;height:20px;border-radius:999px;background:#e3e6ec;position:relative}.tog::after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}.tog.on{background:#2e8b57}.tog.on::after{left:13px}
</style></head><body>
${panel('今', '札・先生の選択・ボタンの3つが並び、選択の右端がボタンの下に潜って欠けている。名前が2回出る', now)}
${panel('案A　選択を札にする', '札をなくし、先生の選択そのものを「梶田 済み ▾」の札の形と色に。押すと先生を選べる。右はボタン1つ', a)}
${panel('案B　先生の変更は下に小さく', '1段目は今の札とボタンだけ。先生を変えるときだけ、下の小さな「先生を変える ▾」から', b)}
${panel('案C　札を押して済みに', '表と同じく、札を押すと「済み」⇄「予定」。ボタンはなくし、先生の選択は右に小さく', c)}
</body></html>`
writeFileSync(`${OUT}/index.html`, html)

await withEdge(async (browser) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1520, height: 640, deviceScaleFactor: 1.5 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: `${OUT}/v127-panel-rows.png`, fullPage: true })
})
console.log(`${OUT}/v127-panel-rows.png`)
