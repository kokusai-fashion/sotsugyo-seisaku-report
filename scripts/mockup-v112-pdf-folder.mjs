// mockups/v112（2026-11-05）：PDF の控えのもとのフォルダを、管理ページ（管理者だけ）で変えられるようにする案
//   依頼者：フォルダを1つ選んでおけば、その中に年度のフォルダ、その中にコースのフォルダが毎年できていくのがよい（年度のフォルダは作った）。
//   今は、もとのフォルダは裏の設定（gas/pdf-folder.local.json・スクリプト プロパティ）でしか変えられない。
//   案A：「詳細設定」のいちばん上に、カード「PDF の控えのフォルダ」
//   案B：左の見出しに「PDF の控え」を足し、そこに置き場所と中のつくり（年度 → コース）を出す
//   試験用サーバーの管理ページ（管理者）に、カードを差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v112-pdf-folder.mjs（Edge は 9338）
import { mkdirSync } from 'node:fs'

process.env.EDGE_PORT ??= '9338'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v112'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** カードの中身（どちらの案でも同じ） */
const CARD = `
<div class="card mk-card"><h2 class="card-h">PDF の控えのフォルダ<small style="font-weight:400;color:#6b7280;margin-left:8px">どの年度にも共通</small></h2><div class="grid">
<div class="lb">今のフォルダ</div><div class="ctl"><span style="display:inline-flex;align-items:center;gap:8px"><b>卒業制作報告書　提出された PDF</b><a href="#" style="color:#2f3e75;white-space:nowrap">ドライブで開く ↗</a></span>
<div class="hint">学生が書き出した PDF の控えと、コースの点検表が入ります。見られるのは、このフォルダを共有している人だけです。</div></div>
<div class="lb">中のつくり<small>自動でできます</small></div><div class="ctl"><div style="font:13px/1.8 'BIZ UDPGothic',sans-serif;background:#f6f7f9;border-radius:8px;padding:6px 12px">
📁 卒業制作報告書　提出された PDF<br>　└ 📁 2026年度<br>　　　├ 📁 映画・舞台衣装デザイナー　（控え・点検表）<br>　　　└ 📁 スタイリスト・コーディネーター<br>　└ 📁 2027年度　（来年度、はじめの控えが届いたときにできます）</div></div>
<label class="lb" for="mk-folder">フォルダを変える</label><div class="ctl"><span style="display:flex;gap:8px"><input id="mk-folder" class="in" type="text" placeholder="新しいフォルダのリンクを貼る（https://drive.google.com/drive/folders/…）" style="flex:1"><button class="btn" style="white-space:nowrap">このフォルダにする</button></span>
<div class="hint">変えると、これから届く控えと、これから作る点検表が、新しいフォルダに入ります。今までのものは、元のフォルダに残ります。<br>このツールを設置したアカウントが編集できるフォルダにしてください（できないときは、ここで知らせます）。</div></div>
</div></div>`

async function openAdmin(browser) {
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
  return { context, page }
}

await withEdge(async (browser) => {
  // 案A：詳細設定のいちばん上
  {
    const { context, page } = await openAdmin(browser)
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
    await sleep(800)
    await page.evaluate((card) => document.querySelector('.content .sec-lead').insertAdjacentHTML('afterend', card), CARD)
    await page.mouse.move(5, 5)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案A_詳細設定のいちばん上.png` })
    await context.close()
  }
  // 案B：左の見出しに「PDF の控え」
  {
    const { context, page } = await openAdmin(browser)
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
    await sleep(800)
    await page.evaluate((card) => {
      // 見出し：「先生の登録」の上に「PDF の控え」を足し、選んでいる形にする
      const members = [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('先生の登録'))
      const item = members.cloneNode(true)
      item.querySelector('.nt b').firstChild.textContent = 'PDF の控え'
      const sub = item.querySelector('.nt small, .nt span:not(.count)')
      if (sub) sub.textContent = '置き場所・中のつくり'
      for (const b of document.querySelectorAll('.side-nav button')) b.classList.remove('on', 'active', 'current')
      item.classList.add('on', 'active', 'current')
      item.setAttribute('aria-current', 'page')
      members.before(item)
      const content = document.querySelector('.content')
      content.innerHTML = `<h1 class="sec-h">PDF の控え</h1><p class="sec-lead">学生が「PDFを書き出す」で作った PDF の控えと、コースの点検表を置くフォルダです。</p>${card}`
    }, CARD)
    await page.mouse.move(5, 5)
    await sleep(300)
    await page.screenshot({ path: `${OUT}/案B_左の見出しに足す.png` })
    await context.close()
  }
})
console.log('ok')
