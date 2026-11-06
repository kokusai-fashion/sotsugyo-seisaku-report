// mockups/v116（2026-11-06）：管理者が「標準のひな形」（ひな形を作っていないコースに出る）を直せるようにする案
//   依頼者：管理者は標準のひな形を編集できるようにしたい。今は標準のひな形がプログラムに書いてあり、管理ページでは直せない。
//   案A：「コースごとの設定」の、コースの一覧の下に「標準のひな形」のカード
//   案B：「詳細設定」のいちばん上に「標準のひな形」のカード
//   どちらも「ひな形を作る画面を開く」で、コースのひな形と同じ画面で直す。コースは本番の3つ（プロデューサー・ジャーナリストだけ、ひな形を作っていない）に見せる
//   試験用サーバーの管理ページ（管理者）に差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v116-standard-template.mjs（Edge は 9338）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9338'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v116'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TPL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11A1.5 1.5 0 0119 5v14a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19V5a1.5 1.5 0 011.5-1.5zM8.5 8h7M8.5 11.5h7M8.5 15h4"></path></svg>'
const USERS = 'プロデューサー・ジャーナリスト コース'
const PARTS = '企画・立案／制作過程／まとめ'

async function openAdmin(browser, section) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.removeItem('sotsugyo-admin-mock')
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button')
  await page.evaluate((s) => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes(s)).click(), section)
  await sleep(800)
  return { context, page }
}

/** 試験用サーバーのコース（1つ）を、本番の3つに見せる */
async function liveCourses(page) {
  await page.evaluate((icon) => {
    const list = document.querySelector('.course-list')
    const first = list.querySelector('.course')
    const make = (name, adv, own) => {
      const c = first.cloneNode(true)
      c.querySelector('.cname').textContent = `${name} コース`
      c.querySelector('.adv').textContent = `指導教員：${adv}`
      const chips = c.querySelectorAll('.chip')
      chips[1].className = own ? 'chip acc' : 'chip '
      chips[1].innerHTML = own ? `${icon}独自のひな形` : '標準のひな形'
      return c
    }
    list.replaceChildren(
      make('スタイリスト・コーディネーター', '佐藤　綾、鈴木　花子', true),
      make('プロデューサー・ジャーナリスト', '田中　一郎、山本　直子', false),
      make('映画・舞台衣装デザイナー', '梶田　貴子、佐藤　綾、加藤　淳之介', true),
    )
  }, TPL_ICON)
}

await withEdge(async (browser) => {
  // 案A：コースの一覧の下に「標準のひな形」のカード
  {
    const { context, page } = await openAdmin(browser, 'コースごとの設定')
    await liveCourses(page)
    await page.evaluate(({ icon, users, parts }) => {
      document.querySelector('.content .sec-lead').textContent = '学生が最初に選ぶコースです。開いて直します。並べ替えは ⋮⋮ をドラッグします。ひな形を作っていないコースには、いちばん下の「標準のひな形」が出ます。'
      document.querySelector('.content button.add').insertAdjacentHTML(
        'afterend',
        `<div class="course" style="margin-top:22px;background:#f6f7fb;border-style:dashed"><div class="crow"><span style="width:22px;display:grid;place-items:center;color:#2f3e75">${icon}</span><div class="cmain"><b class="cname">標準のひな形</b><span class="adv">ひな形を作っていないコースの学生に出ます（今は ${users}）</span><span class="chips"><span class="chip ">${parts}</span></span></div><button class="btn sub sm" style="white-space:nowrap">${icon}ひな形を作る画面を開く</button></div></div>`,
      )
    }, { icon: TPL_ICON, users: USERS, parts: PARTS })
    await page.mouse.move(5, 5)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案A_コースの一覧の下.png` })
    await context.close()
  }
  // 案B：詳細設定のいちばん上に「標準のひな形」のカード
  {
    const { context, page } = await openAdmin(browser, '詳細設定')
    await page.evaluate(({ icon, users, parts }) => {
      document.querySelector('.content .sec-lead').insertAdjacentHTML(
        'afterend',
        `<div class="card"><h2 class="card-h"><span class="set-ic t-template">${icon}</span>標準のひな形<small>ひな形を作っていないコースに出ます</small></h2><div class="grid">
<div class="lb">今の組み立て</div><div class="ctl"><b>${parts}</b><div class="hint">大見出し3つと、それぞれに書くことの説明です。</div></div>
<div class="lb">使っているコース</div><div class="ctl">${users}</div>
<div class="lb">直す</div><div class="ctl"><button class="btn sub sm">${icon}ひな形を作る画面を開く</button><div class="hint">コースのひな形と同じ画面で直します。すでに書き始めた学生の原稿は変わりません。</div></div>
</div></div>`,
      )
    }, { icon: TPL_ICON, users: USERS, parts: PARTS })
    await page.mouse.move(5, 5)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案B_詳細設定のいちばん上.png` })
    await context.close()
  }
})
console.log('ok')
