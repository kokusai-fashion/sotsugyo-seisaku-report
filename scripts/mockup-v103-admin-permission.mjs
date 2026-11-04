// mockups/v103（2026-11-04）：管理ページに「先生の許可」を使う／使わないの切り替えと、点検表の学生の並べ替えを足す見本（依頼者：許可制はコースごとにオン・オフ。並びはふりがな順に自動、直すときは管理ページから）
//   ① コースの設定に「先生の許可」「点検表」の欄（管理者の画面）
//   ② 並べ替えの置き場：案1 コースの欄から窓を開く／案2 左の一覧に「点検表の並び」（先生の画面）
//   学生の名前・学籍番号はすべて作り物。使い方：node scripts/mockup-v103-admin-permission.mjs（e2e の組み立てを 4180 で配っておく。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v103'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const STUDENTS = [
  ['アオキ ミサキ', '青木　美咲', '00ZZ0107'],
  ['イシダ ハルカ', '石田　遥', '00ZZ0131'],
  ['ウエノ ソラ', '上野　空', '00ZZ0112'],
  ['エンドウ リコ', '遠藤　莉子', '00ZZ0145'],
  ['オオタ ユイ', '太田　結衣', '00ZZ0103'],
  ['カネコ ナナ', '金子　奈々', '00ZZ0126'],
  ['キムラ アオイ', '木村　葵', '00ZZ0119'],
  ['クボ メイ', '久保　芽依', '00ZZ0140'],
  ['コバヤシ ヒナ', '小林　陽菜', '00ZZ0108'],
  ['サイトウ ミオ', '斎藤　美緒', '00ZZ0134'],
  ['シミズ カエデ', '清水　楓', '00ZZ0122'],
]
// 先生が手で動かした学生（ふりがな順なら「フ」のあたり）を3番目に
const LIST = [...STUDENTS.slice(0, 2), ['ブンカ ハナコ', '文化　花子', '00ZZ0123', 'moved'], ...STUDENTS.slice(2)]

const CSS = `
.mk-row-btns{display:flex;gap:8px;flex-wrap:wrap}
.mk-checks{display:flex;flex-direction:column;gap:6px}
.mk-list{border:1px solid #dfe3ea;border-radius:10px;overflow:hidden;background:#fff}
.mk-li{display:grid;grid-template-columns:22px 34px 1.25fr 1fr 92px auto;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid #eef0f4;font-size:14px}
.mk-li:first-child{border-top:0}
.mk-li.head{background:#f5f6f8;color:#667;font-size:12px;font-weight:600;padding:6px 10px}
.mk-li .grip{color:#9aa1ad;cursor:grab;letter-spacing:-2px;font-size:13px}
.mk-li .no{color:#667;text-align:right;font-variant-numeric:tabular-nums}
.mk-li .kana{color:#334;font-size:13px}
.mk-li .id{color:#556;font-family:Consolas,monospace;font-size:13px}
.mk-li .mv{display:flex;gap:4px}
.mk-li .mv button{width:28px;height:26px;border:1px solid #cfd5de;background:#fff;border-radius:6px;color:#334;font-size:12px;padding:0}
.mk-li.moved{background:#fff8e6}
.mk-tag{display:inline-block;margin-left:6px;font-size:11px;color:#7a5200;background:#fdeec8;border-radius:999px;padding:1px 7px;font-weight:600;vertical-align:1px}
.mk-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;align-items:center}
.mk-foot .left{margin-right:auto}
.mk-modal{width:min(640px,calc(100vw - 32px))}
.mk-modal .mk-list{max-height:400px;overflow:auto}
.mk-sec .mk-list{max-width:640px;max-height:470px;overflow:auto}
.mk-tabs{display:flex;gap:6px;margin:0 0 12px}
.mk-tabs span{padding:5px 12px;border-radius:999px;border:1px solid #cfd5de;font-size:14px;background:#fff}
.mk-tabs span.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
`

const listHtml = (list) =>
  `<div class="mk-list"><div class="mk-li head"><span></span><span class="no">番号</span><span>ふりがな</span><span>氏名</span><span>学籍番号</span><span>動かす</span></div>` +
  list
    .map(
      ([kana, name, id, flag], i) =>
        `<div class="mk-li ${flag ?? ''}"><span class="grip">⋮⋮</span><span class="no">${i + 1}</span><span class="kana">${kana}</span><span>${name}${flag === 'moved' ? '<span class="mk-tag">手で動かした</span>' : ''}</span><span class="id">${id}</span><span class="mv"><button>▲</button><button>▼</button></span></div>`,
    )
    .join('') +
  `</div>`

async function open(browser, as) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.5 })
  await page.goto(`${APP}/admin.html${as === 'teacher' ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.side-nav', { timeout: 60000 })
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定'))?.click())
  await sleep(700)
  await page.evaluate(() => [...document.querySelectorAll('.course button')].find((b) => b.textContent.includes('開く'))?.click())
  await sleep(700)
  await page.addStyleTag({ content: CSS })
  return { context, page }
}

/** 「表の空の行」の欄のあとに、新しい欄を足す（teacher：許可の切り替えは見るだけの形） */
const addRows = (page, teacher) =>
  page.evaluate((teacher) => {
    const lb = [...document.querySelectorAll('.course .lb')].find((e) => e.textContent.startsWith('表の空の行'))
    const ctl = lb.nextElementSibling
    const make = (label, sub, inner) => {
      const l = document.createElement('div')
      l.className = 'lb mk-new'
      l.innerHTML = `${label}${sub ? `<small>${sub}</small>` : ''}`
      const c = document.createElement('div')
      c.className = 'ctl mk-new'
      c.innerHTML = inner
      return [l, c]
    }
    const perm = teacher
      ? make('先生の許可', '', `<div class="plain">抄録：許可を使う<br>提出用の PDF：許可を使う</div><div class="hint">変えるときは、管理者に頼んでください</div>`)
      : make(
          '先生の許可',
          '',
          `<div class="mk-checks"><label class="toggle-label"><input type="checkbox" checked> 抄録は、先生の許可が出てから書ける</label><label class="toggle-label"><input type="checkbox" checked> 提出用の PDF は、先生の許可が出てから作れる</label></div><div class="hint">許可は、点検表の「抄録」「最終提出可」に ✓ を入れて出します。使わないときは今のまま（抄録は学生が自分で「先生の許可が出た」を押す。PDF に「点検用」の印は入らない）。</div>`,
        )
    const sheet = make(
      '点検表',
      '',
      `<div class="mk-row-btns"><span class="btn sub sm">点検表を開く</span>${teacher ? '<span class="btn sub sm">学生の並びを直す</span>' : ''}</div><div class="hint">学生がコースを選ぶと、ふりがなの順に自動で載ります。見られるのは、このコースの先生だけです。</div>`,
    )
    ctl.after(...perm, ...sheet)
  }, teacher)

await withEdge(async (browser) => {
  // ① 管理者：コースの設定に「先生の許可」「点検表」
  let { context, page } = await open(browser, 'admin')
  await addRows(page, false)
  await page.evaluate(() => document.querySelector('.lb.mk-new')?.scrollIntoView({ block: 'center' }))
  await sleep(400)
  await page.screenshot({ path: `${OUT}/①コースの設定に先生の許可_管理者.png` })
  await context.close()

  // ② 案1：コースの欄の「学生の並びを直す」→ 窓
  ;({ context, page } = await open(browser, 'teacher'))
  await addRows(page, true)
  await page.evaluate(() => document.querySelector('.lb.mk-new')?.scrollIntoView({ block: 'center' }))
  await sleep(400)
  await page.screenshot({ path: `${OUT}/②案1の前_コースの欄_先生.png` })
  await page.evaluate((list) => {
    const wrap = document.createElement('div')
    wrap.className = 'modal-backdrop'
    wrap.innerHTML = `<div class="modal mk-modal"><header><h2>学生の並び（映画・舞台衣装デザイナー コース）</h2><button class="close">×</button></header>
      <p class="lead">ふりがなの順に自動で並んでいます。⋮⋮ をドラッグするか、▲▼ で動かします。この並びが点検表の順になります。</p>
      ${list}
      <div class="mk-foot"><span class="btn quiet sm left">ふりがなの順に戻す</span><span class="btn">やめる</span><span class="btn primary">この並びにする</span></div></div>`
    document.body.append(wrap)
  }, listHtml(LIST))
  await sleep(400)
  await page.screenshot({ path: `${OUT}/②案1_コースの欄から窓で直す_先生.png` })
  await context.close()

  // ② 案2：左の一覧に「点検表の並び」
  ;({ context, page } = await open(browser, 'teacher'))
  await page.evaluate((list) => {
    const nav = document.querySelector('.side-nav')
    const course = [...nav.querySelectorAll('button')].find((b) => b.textContent.includes('コースごとの設定'))
    const item = course.cloneNode(true)
    course.after(item)
    // 選ばれている形を、新しい項目へ移す
    for (const c of [...course.classList].filter((c) => /active|on|cur|sel/.test(c))) {
      course.classList.remove(c)
      item.classList.add(c)
    }
    course.removeAttribute('aria-current')
    item.setAttribute('aria-current', 'page')
    const texts = [...item.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim())
    if (texts[0]) texts[0].textContent = '点検表の並び'
    if (texts[1]) texts[1].textContent = '学生の順番'
    // 見本のない区切り（「届いた声」などと同じ広い形）
    const content = document.querySelector('section.content')
    const work = content.parentElement
    work.classList.add('wide')
    for (const el of [...work.children]) if (el !== content) el.style.display = 'none'
    content.innerHTML = `<h1 class="sec-h">点検表の並び</h1><p class="sec-lead">ふりがなの順に自動で並んでいます。⋮⋮ をドラッグするか、▲▼ で動かします。この並びが点検表の順になります。</p>
      <div class="mk-sec"><div class="mk-tabs"><span class="on">映画・舞台衣装デザイナー コース</span></div>${list}
      <div class="mk-foot" style="max-width:640px"><span class="btn quiet sm left">ふりがなの順に戻す</span><span class="btn primary">この並びにする</span></div></div>`
  }, listHtml(LIST))
  await sleep(400)
  await page.screenshot({ path: `${OUT}/②案2_左の一覧に点検表の並び_先生.png` })
  await context.close()
  console.log('ok')
})
