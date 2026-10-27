// mockups/v71：管理ページの試し（2026-10-27。サブエージェント4役）で見つかったことのうち、見た目が変わるものの案（動きは作っていない）。
//   ① 終了した年度の「この年度を学生に公開」（今は、いちばん目立つ青いボタン。押すと古い年度に戻る）
//   ② 保存の確認に、新しい値と、まだ確かめていない確認を出す（今は「・最終締切」だけ）
//   ③ スマホ：横向き（今はパソコンの3列になり、はみ出す）・キーボードを出したとき（下の帯が欄を隠す）・押す所の大きさ
//   ④ ひな形を作る画面：左の道具が「ここに書くこと」の札に重なる・「やめる」を押すと窓にまた「やめる」
// 使い方：node scripts/mockup-v71-admin-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v71/shots'
mkdirSync(OUT, { recursive: true })
const KEY = 'sotsugyo-admin-mock'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function openAdmin(browser, { viewport = { width: 1366, height: 768 }, phone = false, setup } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  if (phone) await page.emulate({ viewport: { ...viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: IPHONE })
  else await page.setViewport({ ...viewport, deviceScaleFactor: 1.5 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0', timeout: 180000 })
  await page.evaluate((key) => {
    localStorage.removeItem(key)
    localStorage.removeItem('sotsugyo-admin-year')
    sessionStorage.removeItem('sotsugyo-admin-section')
  }, KEY)
  await page.reload({ waitUntil: 'networkidle0' })
  if (setup) {
    await page.evaluate(setup, KEY)
    await page.reload({ waitUntil: 'networkidle0' })
  }
  await page.waitForSelector('.side-nav')
  return { context, page }
}
const nav = (page, title) => page.evaluate((title) => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes(title))?.click(), title)
/** React の欄に値を入れる（日付の欄にも） */
const setValue = (page, selector, value) =>
  page.evaluate(
    (selector, value) => {
      const el = document.querySelector(selector)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    selector,
    value,
  )
/** 確認の窓の見本（confirm.tsx と同じ形）。body は段落の配列（「・」で始まる行は箇条） */
const fakeConfirm = (page, { title, body, cancel = 'やめる', ok, danger = false, extra = '' }) =>
  page.evaluate(
    ({ title, body, cancel, ok, danger, extra }) => {
      document.querySelector('.mock-confirm')?.remove()
      const para = (p) =>
        p.startsWith('・') ? `<ul class="confirm-list">${p.split('\n').map((l) => `<li>${l.slice(1)}</li>`).join('')}</ul>` : `<p>${p.replace(/\n/g, '<br>')}</p>`
      const wrap = document.createElement('div')
      wrap.className = 'modal-backdrop confirm-backdrop mock-confirm'
      wrap.innerHTML = `<div class="modal confirm-modal" role="alertdialog"><header><h2>${title}</h2><button class="close">×</button></header>
        <div class="confirm-body">${body.map(para).join('')}${extra}</div>
        <div class="row-buttons"><span class="spacer"></span><button class="btn">${cancel}</button><button class="btn ${danger ? 'danger-fill' : 'primary'}">${ok}</button></div></div>`
      document.body.append(wrap)
    },
    { title, body, cancel, ok, danger, extra },
  )

/** 確認の窓だけを撮る */
const shootModal = async (page, name) => (await page.$('.confirm-modal')).screenshot({ path: join(OUT, `${name}.png`) })
/** 見出しの右半分（年度・保存・公開のボタン）を撮る */
const shootHead = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), clip: { x: 560, y: 0, width: 806, height: 52 }, captureBeyondViewport: false })

/** 2027年度を公開中、2026年度を終了にした試験用サーバー（2026年度を開く） */
function endedSetup(key) {
  const s = JSON.parse(localStorage.getItem(key))
  const y26 = s.years[0]
  y26.status = '終了'
  s.years.push({ ...y26, year: 2027, status: '公開中', config: { ...y26.config, fiscalYear: 2027, deadline: '2028-01-20' } })
  s.history.push({ at: new Date().toISOString(), user: 'admin@example.ac.jp', year: 2026, action: '公開', config: y26.config })
  s.history.push({ at: new Date().toISOString(), user: 'admin@example.ac.jp', year: 2027, action: '公開', config: y26.config })
  localStorage.setItem(key, JSON.stringify(s))
  localStorage.setItem('sotsugyo-admin-year', '2026')
}

// SHEET_ONLY=1：撮った絵を並べ直すだけ
if (!process.env.SHEET_ONLY) await withEdge(async (browser) => {
  // ---- ① 終了した年度の「この年度を学生に公開」
  {
    const { context, page } = await openAdmin(browser, { setup: endedSetup })
    await page.select('select[aria-label="年度"]', '2026')
    await sleep(600)
    await nav(page, '年度の設定')
    await sleep(500)
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, '1-now.png') })
    await shootHead(page, '1-now-head')
    await page.click('#publish-btn')
    await page.waitForSelector('.confirm-modal')
    await sleep(300)
    await shootModal(page, '1-now-ask')
    await page.evaluate(() => [...document.querySelectorAll('.confirm-modal .btn')].find((b) => b.textContent.trim() === 'やめる').click())
    await sleep(300)

    // 案A：終了した年度は、白いボタン「この年度に戻す…」。押すと、強く確かめる
    await page.evaluate(() => {
      const b = document.querySelector('#publish-btn')
      b.className = 'btn'
      b.textContent = 'この年度に戻す…'
    })
    await shootHead(page, '1-a-head')
    await fakeConfirm(page, {
      title: '2026年度に戻しますか？',
      body: [
        '新しい年度を間違えて公開したときに使います。',
        '・いま公開中の2027年度は「終了」になります。\n・まだ書き始めていない学生は、2026年度の設定（題目・締切・ひな形など）で書き始めます。\n・すでに書き始めた学生は、書き始めた年度の設定のままです。',
      ],
      ok: '2026年度に戻す',
      danger: true,
    })
    await sleep(200)
    await shootModal(page, '1-a-ask')
    await page.evaluate(() => document.querySelector('.mock-confirm').remove())

    // 案B：上のボタンはなくし、年度の設定のいちばん下に「この年度に戻す」（削除の欄と同じ形）
    await page.evaluate(() => {
      document.querySelector('#publish-btn').remove()
      const content = document.querySelector('.admin .content')
      const card = document.createElement('div')
      card.className = 'card mock-back'
      card.innerHTML = `<h2 class="card-h">この年度に戻す</h2><p class="card-lead">新しい年度（2027年度）を間違えて公開したときに使います。2027年度は「終了」になり、まだ書き始めていない学生は、2026年度の設定で書き始めます。</p><button class="btn danger">この年度に戻す</button>`
      content.querySelector('.sec, section, div')?.parentElement.append(card)
      content.scrollTo({ top: content.scrollHeight })
    })
    await sleep(300)
    await shootHead(page, '1-b-head')
    const card = await page.$('.mock-back')
    await card.screenshot({ path: join(OUT, '1-b-card.png') })
    await context.close()
  }

  // ---- ② 保存の確認に、新しい値と、まだ確かめていない確認
  {
    const { context, page } = await openAdmin(browser)
    await nav(page, '年度の設定')
    await page.waitForSelector('#y-deadline')
    await setValue(page, '#y-deadline', '2721-04-20')
    await sleep(400)
    await page.evaluate(() => [...document.querySelectorAll('.save-group button')].find((b) => b.offsetParent)?.click())
    await page.waitForSelector('.confirm-modal')
    await sleep(300)
    await page.mouse.move(5, 5)
    await shootModal(page, '2-now')
    await page.evaluate(() => [...document.querySelectorAll('.confirm-modal .btn')].find((b) => b.textContent.trim() === 'やめる').click())
    await sleep(300)
    const head = '2026年度は学生に公開中です。保存すると、次の変更が学生のツールに届きます（学生がツールを開き直すと、1分ほどで届きます）。'
    const tail = 'すでに書き始めた学生の原稿（書いた文章）は変わりません。'
    const warn = `<div class="mock-warn"><b>まだ確かめていない確認があります</b><span>最終締切（2721年4月20日）が、2026年度（2026年4月1日〜2027年3月31日）の外です</span></div>`
    // 案A：前と後の値
    await fakeConfirm(page, { title: '保存して学生に反映しますか？', body: [head, '・最終締切：2027年1月20日 → <b>2721年4月20日</b>', tail], ok: '保存して学生に反映', extra: warn })
    await page.addStyleTag({
      content: `.mock-warn { display: grid; gap: 2px; margin-top: 10px; padding: 9px 12px; border-radius: 8px; background: #fff4df; border: 1px solid #f0c987; color: #7a4b00; font-size: 14px; line-height: 1.6; } .mock-warn b { font-size: 14px; }`,
    })
    await sleep(200)
    await shootModal(page, '2-a')
    // 案B：新しい値だけ
    await fakeConfirm(page, { title: '保存して学生に反映しますか？', body: [head, '・最終締切：<b>2721年4月20日</b>', tail], ok: '保存して学生に反映', extra: warn })
    await sleep(200)
    await shootModal(page, '2-b')
    await context.close()
  }

  // ---- ③ スマホ：横向き
  {
    const { context, page } = await openAdmin(browser, { phone: true, viewport: { width: 844, height: 390 } })
    await nav(page, 'コース')
    await sleep(600)
    await page.screenshot({ path: join(OUT, '3-land-now.png') })
    await context.close()
  }
  {
    // 案：横向きでも、スマホの作り（一覧 → 中身）のまま（見本は 760 の幅で。実際は 844）
    const { context, page } = await openAdmin(browser, { phone: true, viewport: { width: 760, height: 390 } })
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コース')).click())
    await sleep(600)
    await page.screenshot({ path: join(OUT, '3-land-a.png') })
    await context.close()
  }

  // ---- ③ スマホ：キーボードを出したとき（画面の高さを、キーボードの分だけ低くする）
  for (const variant of ['now', 'a']) {
    const { context, page } = await openAdmin(browser, { phone: true, viewport: { width: 390, height: 844 } })
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('年度の設定')).click())
    await page.waitForSelector('#y-commonTitle')
    await setValue(page, '#y-commonTitle', '卒業イベント「シンドバッド」について（直している）')
    await page.setViewport({ width: 390, height: 480, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.evaluate(() => {
      const el = document.querySelector('#y-handbook')
      el.focus()
      const r = el.getBoundingClientRect()
      window.scrollBy(0, r.top - innerHeight + 150)
    })
    if (variant === 'a') await page.addStyleTag({ content: '.dirty-bar, .save-group { display: none !important; }' })
    await sleep(400)
    await page.screenshot({ path: join(OUT, `3-key-${variant}.png`) })
    await context.close()
  }

  // ---- ③ スマホ：押す所の大きさ（「‹ 管理ページの一覧」「前の作り方で直す」）
  for (const variant of ['now', 'a']) {
    const { context, page } = await openAdmin(browser, { phone: true, viewport: { width: 390, height: 844 } })
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コース')).click())
    await sleep(600)
    if (variant === 'a')
      await page.addStyleTag({
        content: `
        .phone-back { min-height: 44px !important; padding: 0 14px 0 6px !important; border: 1px solid #cfd5de !important; border-radius: 10px !important; background: #fff !important; }
        .tpl-line .tpl-old { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; }
        .pv-view button { min-height: 40px; }`,
      })
    await sleep(300)
    await page.screenshot({ path: join(OUT, `3-tap-${variant}.png`) })
    await context.close()
  }

  // ---- ④ ひな形を作る画面
  async function openTemplate() {
    const { context, page } = await openAdmin(browser)
    await nav(page, 'コース')
    await page.waitForSelector('.course.open .tpl-open')
    await page.evaluate(() => document.querySelector('.course.open .tpl-open').click())
    await page.waitForSelector('.tpl-overlay iframe')
    await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 60000 })
    const frame = page.frames().find((f) => f.url().includes('template=1') && f.parentFrame() === page.mainFrame())
    await frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && s.page === window.__editor.pageOfArea('body') }, { timeout: 90000 })
    await sleep(800)
    // 段落を1つ押して、左の道具を出す
    const p = await frame.$('.page-viewport.front section.body p[data-block-id]:not(:empty)')
    await p.click()
    await frame.waitForSelector('.overlay-editor[data-kind="paragraph"]')
    await sleep(800)
    return { context, page, frame }
  }
  const TAG = '.tpl-mode .page-viewport section.body p[data-block-id]:not(:empty)::before'
  const variants = {
    now: '',
    // 案A：札を短く（「説明」「本文」）して、紙の余白に収める
    a: `${TAG} { content: '説明' !important; } .tpl-mode .page-viewport section.body p[data-block-id][data-prefilled]:not(:empty)::before { content: '本文' !important; }`,
    // 案B：札を、段落の上の左に小さく（紙の中）
    b: `${TAG} { right: auto !important; left: 0 !important; top: auto !important; bottom: 100% !important; transform: translateY(-1px); }`,
  }
  for (const [name, css] of Object.entries(variants)) {
    const { context, page, frame } = await openTemplate()
    if (css) await frame.addStyleTag({ content: css })
    await sleep(400)
    await page.mouse.move(5, 5)
    await page.screenshot({ path: join(OUT, `4-tag-${name}.png`), clip: { x: 228, y: 70, width: 500, height: 420 }, captureBeyondViewport: false })
    if (name === 'now') {
      // 「やめる」→ 窓にまた「やめる」（直したあと）
      await frame.evaluate(() => {
        const ed = document.querySelector('.overlay-editor[data-kind="paragraph"]')
        ed.focus()
      })
      await page.keyboard.type('（直した）')
      await sleep(500)
      await frame.evaluate(() => [...document.querySelectorAll('.tpl-sub')].find((b) => b.textContent.trim() === 'やめる').click())
      await page.waitForSelector('.confirm-modal', { timeout: 10000 }).catch(() => {})
      await sleep(400)
      await shootModal(page, '4-cancel-now')
      await page.screenshot({ path: join(OUT, '4-cancel-now-foot.png'), clip: { x: 1030, y: 550, width: 320, height: 210 }, captureBeyondViewport: false })
      // 案：画面のボタンを「閉じる」、窓のボタンを「書き続ける」「消して閉じる」
      await page.evaluate(() => {
        const keep = [...document.querySelectorAll('.confirm-modal .btn')].find((b) => b.textContent.trim() === 'やめる')
        if (keep) keep.textContent = '書き続ける'
      })
      await frame.evaluate(() => {
        const b = [...document.querySelectorAll('.tpl-sub')].find((x) => x.textContent.trim() === 'やめる')
        if (b) b.textContent = '閉じる'
      })
      await sleep(200)
      await shootModal(page, '4-cancel-a')
      await page.screenshot({ path: join(OUT, '4-cancel-a-foot.png'), clip: { x: 1030, y: 550, width: 320, height: 210 }, captureBeyondViewport: false })
    }
    await context.close()
  }
})

// ---- 並べた1枚（依頼者に見せる）。前の Edge が閉じ終わるのを待ってから
await sleep(3000)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, p)).toString('base64')}`
  const sheet = async (name, title, cols, width = 1500) => {
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: ${width - 44}px; }
      h1 { font-size: 22px; margin: 0 0 14px; }
      .row { display: grid; grid-template-columns: repeat(${cols.length}, 1fr); gap: 16px; align-items: start; }
      .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 10px; color: #4a5060; line-height: 1.6; }
      .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 8px; }
    </style><h1>${title}</h1><div class="row">${cols
      .map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p>${c.imgs.map((p) => `<img src="${img(p)}">`).join('')}</div>`)
      .join('')}</div>`
    await page.setViewport({ width, height: 800, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: join('mockups/v71', `${name}.png`), fullPage: true })
  }
  await sheet('1-ended-year', '① 終了した年度の「この年度を学生に公開」', [
    { h: '今', t: '終了した年度（2026）を開くと、いちばん目立つ青いボタン。押すと、ふつうの確認で古い年度に戻る', imgs: ['1-now-head.png', '1-now-ask.png'] },
    { h: '案A（おすすめ）', t: '白いボタン「この年度に戻す…」。押すと、何が起きるかを書いた赤い確認', imgs: ['1-a-head.png', '1-a-ask.png'] },
    { h: '案B', t: '上のボタンはなくし、年度の設定のいちばん下に「この年度に戻す」（削除と同じ所）', imgs: ['1-b-head.png', '1-b-card.png'] },
  ])
  await sheet('2-save-confirm', '② 保存の確認に、新しい値を出す（締切に「27/2/14」と打って 2721年になった例）', [
    { h: '今', t: '「・最終締切」だけ。値も、残っている確認も出ない', imgs: ['2-now.png'] },
    { h: '案A（おすすめ）', t: '前と後の値。まだ確かめていない確認を、黄色の枠で', imgs: ['2-a.png'] },
    { h: '案B', t: '新しい値だけ。確認の枠は案Aと同じ', imgs: ['2-b.png'] },
  ])
  await sheet('3-phone', '③ スマホ：横向き・キーボード・押す所', [
    { h: '横向き：今 → 案', t: '今はパソコンの3列ではみ出す。案：横でも「一覧 → 中身」のまま（絵は幅760で作ったイメージ）', imgs: ['3-land-now.png', '3-land-a.png'] },
    { h: 'キーボード：今 → 案', t: '今は下の帯が、書いている欄を隠す。案：書いている間は下の帯を隠す（書き終えると出る）', imgs: ['3-key-now.png', '3-key-a.png'] },
    { h: '押す所：今 → 案', t: '「‹ 管理ページの一覧」「前の作り方で直す」を、指で押しやすい高さ（44px）に', imgs: ['3-tap-now.png', '3-tap-a.png'] },
  ], 1700)
  await sheet('4-template', '④ ひな形を作る画面', [
    { h: '札：今', t: '左の道具が札に重なり、「に書くこと」と欠ける', imgs: ['4-tag-now.png'] },
    { h: '札：案A', t: '札を短く「説明」「本文」にして、紙の余白に収める', imgs: ['4-tag-a.png'] },
    { h: '札：案B', t: '札を、段落の上の左に小さく', imgs: ['4-tag-b.png'] },
    { h: '「やめる」：今 → 案', t: '今は窓にまた「やめる」（閉じない、の意味）。案：画面は「閉じる」、窓は「書き続ける」「消して閉じる」', imgs: ['4-cancel-now-foot.png', '4-cancel-now.png', '4-cancel-a-foot.png', '4-cancel-a.png'] },
  ], 1800)
})
console.log('できました：mockups/v71')
