// mockups/v120（2026-11-09）：管理ページのコースの欄で、「点検表の並び」（順番・並べ方）と「学生の並びを直す」をまとめる見本（依頼者：同じ分類なので、まとめ方を調整したい）
//   案A「点検表の並び」の欄に「学生の並びを直す」を移す（「点検表」の欄は「点検表を開く」だけ）
//   案B「点検表」の1つの欄にまとめる（開く・順番・並べ方・学生の並びを直す。所属はその上の欄）
//   案C 区切りの見出し「点検表」を立てて、点検表・所属・点検表の並びの3つの欄をその下にまとめる（並びの欄に「学生の並びを直す」）
//   使い方：node scripts/mockup-v120-sheet-rows.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v120'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const FILM = 'film-stage-costume'

const CSS = `.mk-frame{outline:2px dashed #e0a100;outline-offset:6px;border-radius:12px}`

/** 案ごとに、本物の欄を並べ替える（ブラウザの中で動く） */
function arrange(plan) {
  const course = document.querySelector('.course.open')
  const rowOf = (label) => [...course.querySelectorAll('.set-row')].find((r) => r.querySelector('.lb')?.firstChild?.textContent === label)
  const sheet = rowOf('点検表')
  const group = rowOf('所属')
  const order = rowOf('点検表の並び')
  const orderBtn = sheet.querySelector('.cs-order')
  const hint = (row, text) => {
    const h = row.querySelector('.ctl > .hint')
    if (h) h.textContent = text
  }
  const btnRow = () => {
    const d = document.createElement('div')
    d.className = 'row-btns'
    d.style.marginTop = '10px'
    d.append(orderBtn)
    return d
  }
  if (plan === 'A' || plan === 'C') {
    const buttons = btnRow()
    order.querySelector('.seg-rows').after(buttons)
    // 「保存してから使えます」の注意も、ボタンと一緒に移す
    const warn = sheet.querySelector('.warn-line')
    if (warn) buttons.after(warn)
    hint(order, '所属の中（所属を使わないときは全員）を、この順番に並べます。1人ずつ動かすときは「学生の並びを直す」から。')
    hint(sheet, '学生がコースと氏名を入れると、自動で載ります。見られるのは、PDF の控えのフォルダを見られる先生方です。')
  }
  if (plan === 'B') {
    sheet.before(group)
    sheet.querySelector('.ctl .row-btns').after(order.querySelector('.seg-rows'), btnRow())
    sheet.querySelector('.ctl .seg-rows').style.marginTop = '12px'
    order.remove()
    hint(sheet, '学生がコースと氏名を入れると、自動で載ります。所属の中（所属を使わないときは全員）を、この順番に並べます。1人ずつ動かすときは「学生の並びを直す」から。見られるのは、PDF の控えのフォルダを見られる先生方です。')
  }
  if (plan === 'C') {
    const lists = [...course.querySelectorAll('.grid.set-list')]
    const last = lists[lists.length - 1]
    const head = document.createElement('div')
    head.className = 'set-group'
    head.textContent = '点検表'
    const list = document.createElement('div')
    list.className = 'grid set-list'
    list.append(sheet, group, order)
    last.after(head, list)
  }
  const frame = plan === 'C' ? sheet.parentElement : null
  if (frame) frame.classList.add('mk-frame')
  else for (const r of plan === 'B' ? [group, sheet] : [sheet, group, order]) r.classList.add('mk-frame')
  ;(plan === 'C' ? course.querySelector('.set-group:last-of-type') ?? sheet : plan === 'B' ? group : sheet).scrollIntoView({ block: 'start' })
}

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    for (const plan of ['A', 'B', 'C']) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav', { timeout: 60000 })
      await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定'))?.click())
      await sleep(700)
      await page.evaluate((id) => {
        const c = document.querySelector(`.course[data-course-id="${id}"]`)
        if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
      }, FILM)
      await page.waitForSelector('.course.open .group-input', { timeout: 20000 })
      // 所属を3つ登録したところ（本物の欄に打つ）
      for (const name of ['①グループ', '②グループ', '③グループ']) {
        await page.click('.course.open .group-input')
        await page.keyboard.type(name)
        await page.keyboard.press('Enter')
        await sleep(150)
      }
      await page.addStyleTag({ content: CSS })
      await page.evaluate(arrange, plan)
      await sleep(500)
      // 画面の上の帯の下にずらす（見出しが帯に隠れないように）
      await page.evaluate(() => document.querySelector('.mk-frame')?.closest('.work, main, .content')?.scrollBy?.(0, -90))
      await sleep(300)
      await page.screenshot({ path: `${OUT}/案${plan}.png` })
      console.log('saved', plan)
      await context.close()
    }
  })
} finally {
  server.close()
}
