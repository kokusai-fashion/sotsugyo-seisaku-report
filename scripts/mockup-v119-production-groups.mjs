// mockups/v119（2026-11-09）：制作グループの見本（依頼者：グループ名は先に担当教員が登録しておき、学生は初回使用の際に、用意されたグループ名の中から選ぶ。
//   選んだグループで、点検表が自動で並ぶ）
//   ① 管理ページ（先生の画面）：コースの欄に「制作グループ」（名前の札。指導教員の欄と同じ形）と「点検表の並び」（順番・並べ方）
//   ② 学生：はじめての案内で、コースを選んだすぐ後に「制作グループを選んでください」
//   ③ 学生：あとから変える所（表紙のコース欄を押したときの「コースを選ぶ」の下に、制作グループ）
//   使い方：node scripts/mockup-v119-production-groups.mjs（dist-e2e を 4180 で配る。Edge は 9336）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9336'
const { withEdge } = await import('./poc/edge.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')
const { stubConfig } = await import('./e2e/configStub.mjs')
const PORT = 4180
const APP = `http://localhost:${PORT}`
const OUT = 'mockups/v119'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const FILM = 'film-stage-costume'
const GROUPS = ['①グループ', '②グループ', '③グループ']

const ADMIN_CSS = `
.mk-seg{display:inline-flex;border:1px solid #cfd5de;border-radius:8px;overflow:hidden;background:#fff;width:max-content}
.mk-seg span{padding:5px 14px;font-size:14px;color:#334;border-left:1px solid #cfd5de}
.mk-seg span:first-child{border-left:0}
.mk-seg span.on{background:var(--accent);color:#fff;font-weight:700}
.mk-opts{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;margin-top:4px}
.mk-opts .k{font-size:14px;color:#445;font-weight:600}
.mk-new{position:relative}
.set-row.mk-new{outline:2px dashed #e0a100;outline-offset:4px;border-radius:10px}
.mk-new .tag-input{width:240px;min-width:240px}
`
const seg = (items, on) => `<span class="mk-seg">${items.map((t, i) => `<span class="${i === on ? 'on' : ''}">${t}</span>`).join('')}</span>`

const STUDENT_CSS = `
.mk-glist{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding-top:8px;border-top:1px solid #e6e8ee}
.mk-glist .popover-title{margin-top:2px}
`

const server = await serveBuilt('dist-e2e', PORT)
try {
  await withEdge(async (browser) => {
    // ---------------- ① 管理ページ（先生の画面） ----------------
    {
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
      await page.waitForSelector('.course.open .cs-order', { timeout: 20000 })
      await page.addStyleTag({ content: ADMIN_CSS })
      await page.evaluate(
        (groups, order) => {
          const sheetLb = [...document.querySelectorAll('.course.open .lb')].find((l) => l.firstChild.textContent === '点検表')
          const sheetRow = sheetLb.closest('.set-row')
          const icon = (id) => [...document.querySelectorAll('.course.open .lb')].find((l) => l.firstChild.textContent === id)?.closest('.set-row')?.querySelector('.set-ic')?.outerHTML ?? ''
          const make = (iconHtml, label, inner, hint) => {
            const row = document.createElement('div')
            row.className = 'set-row mk-new'
            row.innerHTML = `${iconHtml}<div class="lb">${label}</div><div class="ctl">${inner}<div class="hint">${hint}</div></div>`
            return row
          }
          const tags = `<div class="tags">${groups.map((g) => `<span class="tag">${g}<button>×</button></span>`).join('')}<input class="in tag-input" placeholder="グループ名を入れて Enter"></div>`
          const groupRow = make(
            icon('指導教員'),
            '制作グループ',
            tags,
            '学生は、はじめて使うときに、この中から自分のグループを選びます。点検表は、グループごとに並びます。グループを使わないコースは、空のままにします。',
          )
          const orderRow = make(icon('点検表'), '点検表の並び', order, 'グループの中（グループを使わないときは全員）を、この順番に並べます。')
          sheetRow.after(groupRow, orderRow)
          groupRow.scrollIntoView({ block: 'center' })
        },
        GROUPS,
        `<div class="mk-opts"><span class="k">順番</span>${seg(['五十音順', '学籍番号順'], 0)}<span class="k">並べ方</span>${seg(['26人からは2列', 'いつも縦1列'], 0)}</div>`,
      )
      await sleep(500)
      await page.screenshot({ path: `${OUT}/①管理ページ_制作グループの登録_先生.png` })
      await context.close()
    }

    // ---------------- ② 学生：はじめての案内でグループを選ぶ ----------------
    {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', (e) => console.log('pageerror:', e.message))
      await stubConfig(page)
      await page.setViewport({ width: 1366, height: 820, deviceScaleFactor: 1.5 })
      await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
      await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 90000 })
      await sleep(800)
      await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画'))?.click())
      await page.waitForSelector('.guide.step-word .g-opts', { timeout: 30000 })
      await sleep(1200)
      await page.evaluate((groups) => {
        const tip = document.querySelector('.guide .g-tip')
        const steps = tip.querySelector('.g-steps')
        steps.innerHTML = ['コース', 'グループ', 'Word', '学籍番号', '氏名', 'サブタイトル'].map((l, i) => `<span class="${i === 1 ? 'on' : i < 1 ? 'past' : ''}">${i + 1} ${l}</span>`).join('')
        tip.querySelector('h2').textContent = '制作グループを選んでください'
        tip.querySelector('p').innerHTML = '先生が決めたグループの中から、自分のグループを選びます。先生の点検表は、グループごとに並びます。'
        // もとのボタン（Word の問い）は隠して残す（このあと「いいえ」を押して、案内を閉じるため）
        const opts = tip.querySelector('.g-opts')
        for (const b of opts.children) b.style.display = 'none'
        opts.insertAdjacentHTML('beforeend', groups.map((g) => `<button class="mk-g">${g}</button>`).join(''))
        tip.querySelector('.g-note').textContent = 'グループはあとから変えられます（表紙のコースの欄を押します）'
      }, GROUPS)
      await sleep(400)
      await page.screenshot({ path: `${OUT}/②学生_はじめての案内でグループを選ぶ.png` })

      // ---------------- ③ 学生：あとから変える（表紙のコース欄 → コースを選ぶ の下に制作グループ） ----------------
      await page.evaluate(() => document.querySelector('.guide .g-word-opt.no')?.click())
      await sleep(600)
      await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
      await sleep(1200)
      const at = await page.evaluate(() => {
        const el = document.querySelector('.page-viewport.front [data-block-id="basic:course"]') ?? document.querySelector('[data-block-id="basic:course"]')
        el.scrollIntoView({ block: 'center' })
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
      await sleep(400)
      await page.mouse.click(at.x, at.y)
      await page.waitForSelector('.course-menu', { timeout: 10000 })
      await page.addStyleTag({ content: STUDENT_CSS })
      await page.evaluate((groups) => {
        const menu = document.querySelector('.course-menu')
        const list = document.createElement('div')
        list.className = 'mk-glist'
        list.innerHTML = `<div class="popover-title">制作グループ</div>${groups.map((g, i) => `<button class="${i === 1 ? 'on' : ''}">${g}</button>`).join('')}`
        menu.append(list)
        // 下にはみ出すときは上へ
        const r = menu.getBoundingClientRect()
        if (r.bottom > innerHeight - 8) menu.style.top = `${Math.max(8, innerHeight - 8 - r.height)}px`
      }, GROUPS)
      await sleep(400)
      await page.screenshot({ path: `${OUT}/③学生_あとから変える_表紙のコース欄.png` })
      await context.close()
    }
    console.log('ok')
  })
} finally {
  server.close()
}
