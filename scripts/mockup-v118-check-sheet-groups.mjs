// mockups/v118（2026-11-09）：点検表の並びを、コースごとに選べるようにする見本（依頼者：制作グループごとに並べたい・五十音順か学籍番号順か・縦1列か2列か）
//   案1 グループは、管理ページの「学生の並びを直す」の窓で、学生ごとに選ぶ
//   案2 グループは、点検表の「グループ」の列に、先生が打つ（ツールが10分ほどで並び直す）
//   どちらも、できあがる点検表は同じ（グループの列と、グループの境の太い線）。1列と2列の見本も作る
//   学生の名前・学籍番号はすべて作り物。使い方：node scripts/mockup-v118-check-sheet-groups.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v118'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ふりがな・氏名・学籍番号・グループ（0 から。①9人・②9人・③8人）
const RAW = [
  ['アオキ ミサキ', '青木　美咲', '00ZZ0107', 1],
  ['イシダ ハルカ', '石田　遥', '00ZZ0131', 0],
  ['ウエノ ソラ', '上野　空', '00ZZ0112', 2],
  ['エンドウ リコ', '遠藤　莉子', '00ZZ0145', 0],
  ['オオタ ユイ', '太田　結衣', '00ZZ0103', 1],
  ['カネコ ナナ', '金子　奈々', '00ZZ0126', 2],
  ['キムラ アオイ', '木村　葵', '00ZZ0119', 0],
  ['クボ メイ', '久保　芽依', '00ZZ0140', 1],
  ['コバヤシ ヒナ', '小林　陽菜', '00ZZ0108', 2],
  ['サイトウ ミオ', '斎藤　美緒', '00ZZ0134', 0],
  ['シミズ カエデ', '清水　楓', '00ZZ0122', 1],
  ['スズキ アヤカ', '鈴木　彩花', '00ZZ0115', 0],
  ['セガワ マオ', '瀬川　真央', '00ZZ0138', 2],
  ['タカハシ サクラ', '高橋　咲良', '00ZZ0101', 1],
  ['チバ チヒロ', '千葉　千尋', '00ZZ0129', 0],
  ['ツカモト ナナミ', '塚本　七海', '00ZZ0143', 2],
  ['テラダ ユウカ', '寺田　優花', '00ZZ0110', 1],
  ['ナカジマ ナツミ', '中島　菜摘', '00ZZ0124', 0],
  ['ニシムラ リナ', '西村　里奈', '00ZZ0136', 2],
  ['ノグチ アン', '野口　杏', '00ZZ0105', 1],
  ['ハセガワ マイ', '長谷川　舞', '00ZZ0141', 0],
  ['ヒラノ リン', '平野　凛', '00ZZ0117', 2],
  ['フクダ サキ', '福田　紗希', '00ZZ0128', 1],
  ['ホシノ モモコ', '星野　桃子', '00ZZ0133', 0],
  ['マエダ ノドカ', '前田　和花', '00ZZ0120', 2],
  ['ミウラ ミライ', '三浦　未来', '00ZZ0146', 1],
]
const MARK = ['①', '②', '③']
// グループごと、その中は五十音順（RAW はふりがなの順）
const STUDENTS = RAW.map(([kana, name, id, g]) => ({ kana, name, id, g })).sort((a, b) => a.g - b.g)

// 回の担当（依頼者の例：1回目 ①山本 ②中村 ③小川 → 2回目 ②山本 ③中村 ①小川）
const T = ['山本', '中村', '小川']
const who = (g, r) => T[(((g - r) % 3) + 3) % 3]
const TONE = { 山本: { bg: '#f8e1e4', ink: '#8a3442' }, 中村: { bg: '#e7efe6', ink: '#3d6342' }, 小川: { bg: '#f2ece0', ink: '#7a5a2c' } }
const PLAN = '#a0a5ad'
// 12月の半ばごろの様子（3回目まで済み。何人かは2回目まで。PDF をまだ出していない学生も）
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

// ---------------- 点検表（Google スプレッドシートの見た目） ----------------
const box = (on) => `<span class="cb ${on ? 'on' : ''}">${on ? '✓' : ''}</span>`
const tag = (x) => (x.done ? `<span class="tag" style="background:${TONE[x.t].bg};color:${TONE[x.t].ink}">${x.t} 済み</span>` : `<span class="tag plan">${x.t} 予定</span>`)

/** groupCol：'tool'（ツールが書く灰色の列）・'teacher'（先生が打つ白い列）。blocks：1 か 2 */
function sheet({ groupCol, blocks, caption, typing }) {
  const head = [
    ['番号', 'tool', 30],
    ['グループ', groupCol === 'teacher' ? 'teach' : 'tool', 52],
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
  const cells = (r, k) => {
    // グループの境（前の行と違うグループ）は、上に太い線
    const edge = k > 0 && r.g !== ROWS[r.no - 2]?.g ? ' edge' : ''
    const typed = groupCol === 'teacher' ? (typing && r.no === typing.no ? `<span class="caret">${typing.text}</span>` : String(r.g + 1)) : MARK[r.g]
    return [
      `<td class="tool num${edge}">${r.no}</td>`,
      `<td class="${groupCol === 'teacher' ? 'teachc' : 'tool'} c grp${edge}">${typed}</td>`,
      `<td class="tool name${edge}">${r.name}</td>`,
      `<td class="tool c${edge}">${r.pdf ? `<a>${r.pdf}</a>` : ''}</td>`,
      ...r.rounds.map((x) => `<td class="c${edge}">${tag(x)}</td>`),
      `<td class="perm c${edge}">${box(r.abstractOk)}</td>`,
      `<td class="perm c${edge}">${box(false)}</td>`,
      `<td class="c${edge}">${box(false)}</td>`,
      `<td class="tool dim${edge}">${r.note}</td>`,
    ].join('')
  }
  const per = blocks === 2 ? Math.ceil(ROWS.length / 2) : ROWS.length
  const left = ROWS.slice(0, per).map((r, k) => cells(r, k))
  const right = blocks === 2 ? ROWS.slice(per).map((r, k) => cells(r, k)) : []
  const headCells = head.map(([h, role, w]) => `<th class="${role}" style="width:${w}px">${h}</th>`).join('')
  const empty = head.map(() => '<td></td>').join('')
  const letters = (n, from) => Array.from({ length: n }, (_, i) => `<th>${String.fromCharCode(65 + from + i)}</th>`).join('')
  const span = blocks === 2 ? head.length * 2 + 1 : head.length
  return `<div class="wrap">
<div class="cap">${caption}</div>
<div class="bar"><span class="icon"></span><span class="name">2026年度 点検表（映画・舞台衣装デザイナー コース）</span><span class="share">共有：このコースの先生3人</span></div>
<table>
<tr class="letters"><th class="rn"></th>${letters(head.length, 0)}${blocks === 2 ? `<th class="gap"></th>${letters(head.length, head.length + 1)}` : ''}</tr>
<tr class="top"><td class="rn">1</td><td colspan="${span}">⚠ 並びを直すときは、管理ページの「コースごとの設定」→「学生の並びを直す」から（灰色の列はツールが書きます）<br>✎ 青い見出しの列（点検の回）は、コースごとに名前を変えたり、列を足したり消したりできます</td></tr>
<tr class="head"><td class="rn">2</td>${headCells}${blocks === 2 ? `<th class="gap"></th>${headCells}` : ''}</tr>
${left.map((l, k) => `<tr><td class="rn">${k + 3}</td>${l}${blocks === 2 ? `<td class="gap"></td>${right[k] ?? empty}` : ''}</tr>`).join('\n')}
</table></div>`
}

const SHEET_CSS = `
body{margin:0;background:#fff;font-family:Arial,"BIZ UDPGothic","Yu Gothic UI",sans-serif;color:#202124}
.wrap{padding:0 0 14px;display:inline-block}
.cap{padding:14px 14px 10px;font-size:15px;line-height:1.6;max-width:1100px}
.cap b{font-size:19px;display:block;margin-bottom:2px}
.cap .sub{color:#4a4f57}
.bar{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid #e0e3e7;border-bottom:1px solid #e0e3e7;margin-bottom:6px}
.bar .icon{width:18px;height:24px;border-radius:3px;background:#188038;position:relative}
.bar .icon:after{content:"";position:absolute;inset:7px 4px;border:2px solid #fff;border-radius:1px}
.bar .name{font-size:15px}
.bar .share{margin-left:auto;font-size:12px;color:#444;background:#c2e7ff;border-radius:999px;padding:5px 14px;font-weight:600}
table{border-collapse:collapse;font-size:12px;margin-left:12px;table-layout:fixed}
th,td{border:1px solid #e2e3e3;height:22px;padding:0 4px;white-space:nowrap;overflow:hidden}
.letters th{background:#f8f9fa;color:#5f6368;font-weight:400;font-size:10px;height:17px;text-align:center}
.rn{background:#f8f9fa;color:#5f6368;font-size:10px;text-align:center;width:26px;padding:0}
tr.top td:not(.rn){background:#fff1c2;color:#5c3b00;font-weight:700;font-size:12.5px;line-height:1.55;height:44px;padding:0 6px}
.head th{font-weight:700;font-size:11px;line-height:1.2;height:34px;text-align:center;white-space:normal}
.head th.tool{background:#dadce0;color:#3c4043}
.head th.round{background:#d6e4f5;color:#1f3f6b}
.head th.teach{background:#d6e4f5;color:#1f3f6b;outline:2px solid #1a73e8;outline-offset:-2px}
.head th.perm{background:#f8dc8c;color:#5c3b00}
.head th.kyomu{background:#d3ead6;color:#1e5b2a}
.gap{width:10px;background:#fff;border-top:0!important;border-bottom:0!important}
td.tool{background:#f3f4f6;color:#3c4043}
td.num{text-align:right}
td.name{font-weight:700;color:#202124}
td.c{text-align:center}
td.grp{font-weight:700;font-size:13px}
td.teachc{background:#fff;color:#202124}
td.perm{background:#fcf9ee}
td.dim{color:#80868b;font-size:11px}
td.edge{border-top:2px solid #6b7280}
a{color:#1a73e8;text-decoration:underline}
.cb{display:inline-block;width:12px;height:12px;border:2px solid #80868b;border-radius:2px;line-height:12px;font-size:11px;color:#fff;font-weight:700;vertical-align:-3px}
.cb.on{background:#5f6368;border-color:#5f6368}
.tag{display:inline-block;border-radius:4px;padding:0 6px;font-size:11px;line-height:16px;font-weight:700}
.tag.plan{color:${PLAN};font-weight:400}
.caret{display:inline-block;outline:2px solid #1a73e8;outline-offset:3px;padding:0 6px}
`

// ---------------- 管理ページの「学生の並びを直す」の窓 ----------------
const DIALOG_CSS = `
.mk-opts{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;align-items:center;margin:2px 0 14px;padding:12px 14px;border:1px solid #dfe3ea;border-radius:10px;background:#f8f9fb}
.mk-opts .lb{font-size:13.5px;font-weight:700;color:#334}
.mk-seg{display:inline-flex;border:1px solid #cfd5de;border-radius:8px;overflow:hidden;background:#fff;width:max-content}
.mk-seg span{padding:5px 14px;font-size:13.5px;color:#334;border-left:1px solid #cfd5de}
.mk-seg span:first-child{border-left:0}
.mk-seg span.on{background:var(--accent);color:#fff;font-weight:700}
.mk-modal .so-head,.mk-modal .so-li{grid-template-columns:22px 34px minmax(0,1.2fr) minmax(0,1fr) 84px 62px auto}
.mk-grp{display:flex;align-items:center;gap:8px;padding:5px 12px;background:#eef2f8;border-top:1px solid #dfe3ea;color:#1f3f6b;font-size:13px;font-weight:700;position:relative}
.mk-grp small{color:#667;font-weight:400}
.mk-sel{display:inline-flex;align-items:center;justify-content:space-between;width:54px;height:26px;padding:0 6px 0 9px;border:1px solid #cfd5de;border-radius:6px;background:#fff;font-size:14px;color:#223;box-sizing:border-box}
.mk-sel:after{content:"▾";color:#778;font-size:11px}
.so-li .grip{display:inline-flex;align-items:center;justify-content:center;color:#9aa1ad;letter-spacing:-2px}
`
const seg = (items, on) => `<span class="mk-seg">${items.map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</span>`
const options = (group) => `<div class="mk-opts">
  <span class="lb">順番</span>${seg(['五十音順', '学籍番号順'], 0)}
  <span class="lb">グループ</span>${seg(['使わない', '制作グループごとに並べる'], group ? 1 : 0)}
  <span class="lb">並べ方</span>${seg(['26人からは2列', 'いつも縦1列'], 0)}
</div>`
const row = (s, i) =>
  `<div class="so-li"><span class="grip">⋮⋮</span><span class="no">${i + 1}</span><span class="kana">${s.kana}</span><span class="nm">${s.name}</span><span class="id">${s.id}</span><span><span class="mk-sel">${MARK[s.g]}</span></span><span class="mv"><button>▲</button><button>▼</button></span></div>`
function dialogList() {
  let html = `<div class="so-box"><div class="so-head"><span></span><span class="no">番号</span><span>ふりがな</span><span>氏名</span><span>学籍番号</span><span>グループ</span><span>動かす</span></div><div class="so-list">`
  STUDENTS.forEach((s, i) => {
    if (i === 0 || STUDENTS[i - 1].g !== s.g) html += `<div class="mk-grp">${MARK[s.g]} グループ <small>${STUDENTS.filter((x) => x.g === s.g).length}人</small></div>`
    html += row(s, i)
  })
  return html + `</div></div>`
}

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    // 案1：窓でグループを選ぶ
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1.5 })
    await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.side-nav', { timeout: 60000 })
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定'))?.click())
    await sleep(700)
    await page.evaluate(() => {
      const c = document.querySelector('.course[data-course-id="film-stage-costume"]')
      if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
    })
    await page.waitForSelector('.course.open .cs-order', { timeout: 20000 })
    await sleep(300)
    await page.evaluate(() => document.querySelector('.course.open .cs-order').click())
    await page.waitForSelector('.so-modal .so-li', { timeout: 20000 })
    await page.addStyleTag({ content: DIALOG_CSS })
    await page.evaluate(
      (opts, list) => {
        const modal = document.querySelector('.so-modal')
        modal.classList.add('mk-modal')
        modal.querySelector('.lead').outerHTML =
          opts + '<p class="lead">グループは、学生ごとに右の欄で選びます。グループの中は、上で選んだ順番に並びます。⋮⋮ をドラッグするか、▲▼ で動かすこともできます。</p>'
        modal.querySelector('.so-box').outerHTML = list
        const kana = [...modal.querySelectorAll('.so-foot button')].find((b) => b.textContent.includes('ふりがな'))
        if (kana) kana.textContent = '五十音順に戻す'
      },
      options(true),
      dialogList(),
    )
    await sleep(400)
    await page.screenshot({ path: `${OUT}/案1_窓でグループを選ぶ.png` })
    await context.close()

    // 点検表（案2・できあがりの1列・2列）
    const sheetPage = await browser.newPage()
    await sheetPage.setViewport({ width: 1900, height: 900, deviceScaleFactor: 1.5 })
    const shots = [
      [
        '案2_点検表にグループを打つ',
        {
          groupCol: 'teacher',
          blocks: 1,
          typing: { no: 9, text: '2' },
          caption: '<b>案2　グループは、点検表の「グループ」の列に打つ</b><span class="sub">先生が点検表の「グループ」の列に 1・2・3 と打ちます（名簿から貼り付けもできます）。打ってから10分ほどで、ツールがグループごとに並び直します。<br>順番（五十音順・学籍番号順）と並べ方（1列・2列）は、管理ページの「学生の並びを直す」の窓で選びます。</span>',
        },
      ],
      [
        'できあがり_縦1列',
        { groupCol: 'tool', blocks: 1, caption: '<b>できあがり　いつも縦1列（グループごと・その中は五十音順）</b><span class="sub">グループの列はツールが書きます。グループの境には太い線を引きます。番号は通し番号のままです。</span>' },
      ],
      [
        'できあがり_2列',
        { groupCol: 'tool', blocks: 2, caption: '<b>できあがり　26人からは2列（今と同じ。前半が左）</b><span class="sub">2列に分ける所は今と同じく人数の半分です。グループが左右に分かれることがあります（この見本では ② グループ）。</span>' },
      ],
    ]
    for (const [name, opts] of shots) {
      await sheetPage.setContent(`<!doctype html><meta charset="utf-8"><style>${SHEET_CSS}</style>${sheet(opts)}`, { waitUntil: 'load' })
      const el = await sheetPage.$('.wrap')
      await el.screenshot({ path: `${OUT}/${name}.png` })
      console.log('saved', name)
    }
  })
} finally {
  server.close()
}
