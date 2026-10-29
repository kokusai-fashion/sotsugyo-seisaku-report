// mockups/v73：学生の試し 1回目（2026-10-29。poc-output/firsttime/r1029/まとめ.md の B）の、見た目が変わる直しの案。
// 本物のツール（開発サーバー）を開き、CSS や部品を差し替えて撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v73-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v73/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

async function open(browser, { width = 1366, height = 768, phone = null } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(phone === 'android' ? ANDROID : IPHONE)
  await page.setViewport(phone ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide .g-later')
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  return { context, page, ready }
}
const go = async (page, ready, id) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await sleep(400)
}
const rect = (page, sel, pad = 0) => page.evaluate((sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), width: Math.min(innerWidth - Math.max(0, r.left - pad), r.width + pad * 2), height: Math.min(innerHeight - Math.max(0, r.top - pad), r.height + pad * 2) } }, sel, pad)
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}), captureBeyondViewport: false })

// SHEET_ONLY=1：撮った絵から、並べた絵だけを作り直す
if (!process.env.SHEET_ONLY) await withEdge(async (browser) => {
  // ===== ① 引用・参考文献の入れ口（パソコン） =====
  {
    const { context, page, ready } = await open(browser)
    // 参考文献のページの道具（ボタンの形を借りる）
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('references'), 'none'))
    await ready()
    await sleep(400)
    const refsTool = await page.evaluate(() => [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('参考文献'))?.outerHTML ?? '')
    await go(page, ready, 'p3')
    await page.mouse.move(5, 5)
    const area = { x: 0, y: 0, width: 1366, height: 768 }
    await shot(page, '1-refs-now', area)
    // 案A：本文の左の道具に「参考文献」
    await page.evaluate((html, refs) => {
      // 参考文献のページの道具があれば、その形を借りる。なければ「改ページ」の道具を写して、絵と名前を変える
      const g = document.createElement('div')
      g.className = 'group mock-refs'
      if (html) g.innerHTML = html
      else {
        const tool = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('改ページ')).cloneNode(true)
        tool.querySelector('svg').innerHTML = refs
        tool.querySelector('span').textContent = '参考文献'
        g.append(tool)
      }
      const tableGroup = [...document.querySelectorAll('.palette .group')].find((x) => x.textContent.includes('表を入れる'))
      tableGroup.after(g)
    }, refsTool, '<path d="M6 4.5h12v15H6zM9 8.5h6M9 12h6M9 15.5h4" />')
    await sleep(200)
    await shot(page, '1-refs-a', area)
    await page.evaluate(() => document.querySelector('.mock-refs')?.remove())
    // 案B：右の欄の進み具合に「引用・参考文献（なくてもよい）」の行
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.side .check-prog > li')]
      const photo = rows.find((li) => li.textContent.includes('作品写真')) ?? rows[rows.length - 1]
      const li = photo.cloneNode(true)
      li.className = 'info'
      li.querySelector('.l').textContent = '引用・参考文献'
      li.querySelector('.v').innerHTML = 'なくてもよい・<b style="color:var(--accent)">＋ 入れる</b>'
      li.querySelector('.bar')?.remove()
      photo.after(li)
    })
    await sleep(200)
    await shot(page, '1-refs-b', area)
    await context.close()
  }
  // ===== ① スマホ：書いている間の「追加」に「参考文献」 =====
  {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: 'iphone' })
    await go(page, ready, 'p3')
    await page.evaluate(() => window.__editor.openEditor('p3', 5))
    await sleep(1200)
    await page.evaluate(() => [...document.querySelectorAll('.direct-bar button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('追加'))?.click())
    await sleep(700)
    const bar = await rect(page, '.direct-bar', 0)
    const clip = { x: 0, y: Math.max(0, bar.y - 160), width: 390, height: Math.min(844 - Math.max(0, bar.y - 160), bar.height + 160) }
    await shot(page, '1-refs-phone-now', clip)
    await page.evaluate(() => {
      const row = document.querySelector('.direct-bar .db-add')
      const last = row.querySelector('button:last-of-type')
      const b = last.cloneNode(true)
      b.classList.add('mock')
      b.querySelector('span') ? (b.querySelector('span').textContent = '参考文献') : (b.textContent = '参考文献')
      const svg = b.querySelector('svg')
      if (svg) svg.innerHTML = '<path d="M6 4.5h12v15H6zM9 8.5h6M9 12h6M9 15.5h4" />'
      row.append(b)
    })
    await sleep(200)
    await shot(page, '1-refs-phone-a', clip)
    await context.close()
  }

  // ===== ② 画面の下の知らせ（パソコン）：紙面の最後の行に重なる =====
  {
    const { context, page, ready } = await open(browser)
    await go(page, ready, 'p8')
    await page.evaluate(() => window.__editor.removeBlock('p9'))
    await sleep(1200)
    await ready()
    await page.mouse.move(5, 5)
    const stage = await rect(page, '.stage', 0)
    await shot(page, '2-toast-now', stage)
    await page.addStyleTag({ content: '.stage .undo-area.on-stage.mock-top { bottom: auto !important; top: 14px; }' })
    await page.evaluate(() => document.querySelector('.stage .undo-area.on-stage')?.classList.add('mock-top'))
    await sleep(200)
    await shot(page, '2-toast-a', stage)
    await page.evaluate(() => document.querySelector('.stage .undo-area.on-stage')?.classList.remove('mock-top'))
    await page.addStyleTag({ content: '.stage .undo-area.on-stage.mock-low { bottom: 8px !important; }' })
    await page.evaluate(() => document.querySelector('.stage .undo-area.on-stage')?.classList.add('mock-low'))
    await sleep(200)
    await shot(page, '2-toast-b', stage)
    await context.close()
  }

  // ===== ③ Android 360px：書いている間の「削除」と「完了」 =====
  {
    const { context, page, ready } = await open(browser, { width: 360, height: 780, phone: 'android' })
    await go(page, ready, 'p3')
    await page.evaluate(() => window.__editor.openEditor('p3', 5))
    await sleep(1200)
    const bar = await rect(page, '.direct-bar', 0)
    const clip = { x: 0, y: Math.max(0, bar.y - 60), width: 360, height: Math.min(780 - Math.max(0, bar.y - 60), bar.height + 60) }
    await shot(page, '3-delete-now', clip)
    // 案A：「削除」を左の端へ（「完了」から離す）
    await page.addStyleTag({ content: '.mock-a .direct-bar .db-row:not(.db-add):not(.db-table) { display: flex; } .mock-a .direct-bar .db-row button.danger { order: -1; margin-right: auto; }' })
    await page.evaluate(() => document.body.classList.add('mock-a'))
    await sleep(200)
    await shot(page, '3-delete-a', clip)
    await page.evaluate(() => document.body.classList.remove('mock-a'))
    // 案B：「削除」と「完了」の間をあけ、区切りの線
    await page.addStyleTag({ content: '.mock-b .direct-bar .db-row button.danger { margin-right: 18px; position: relative; } .mock-b .direct-bar .db-row button.danger::after { content: ""; position: absolute; right: -10px; top: 8px; bottom: 8px; border-right: 1px solid #c9ccd3; }' })
    await page.evaluate(() => document.body.classList.add('mock-b'))
    await sleep(200)
    await shot(page, '3-delete-b', clip)
    await context.close()
  }

  // ===== ④ 紙面の字が小さい（1280×720）／⑤ 左の道具の説明が出ない =====
  {
    const { context, page, ready } = await open(browser, { width: 1280, height: 720 })
    await go(page, ready, 'p3')
    await page.mouse.move(5, 5)
    const all = { x: 0, y: 0, width: 1280, height: 720 }
    await shot(page, '4-font-now', all)
    // 案B：はじめての時だけ、表示の帯の上に一言
    await page.evaluate(() => {
      const bar = document.querySelector('.view-bar')
      const r = bar.getBoundingClientRect()
      const tip = document.createElement('div')
      tip.className = 'mock-tip'
      tip.innerHTML = '字が小さいときは「＋」か、<br>紙面の上で Ctrl を押しながらホイールを回すと、大きくなります <span style="margin-left:8px;opacity:.7">×</span>'
      Object.assign(tip.style, { position: 'fixed', right: `${innerWidth - r.right}px`, bottom: `${innerHeight - r.top + 10}px`, background: '#2f3e75', color: '#fff', padding: '10px 14px', borderRadius: '10px', font: '13px/1.6 "BIZ UDPGothic", sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,.2)', zIndex: 40 })
      document.body.append(tip)
    })
    await sleep(200)
    await shot(page, '4-font-b', all)
    await page.evaluate(() => document.querySelector('.mock-tip')?.remove())
    // 案A：小さい画面では、はじめから「拡大」（本文の幅に合わせる）
    await page.evaluate(() => window.__editor.setView('zoom'))
    await sleep(900)
    await ready()
    await shot(page, '4-font-a', all)
    await page.evaluate(() => window.__editor.setView('fit'))
    await sleep(900)
    await ready()

    // ⑤ 押せない「図を入れる」を押したとき、わけを吹き出しで
    await page.evaluate(() => window.__editor.finishEditing?.())
    await sleep(300)
    const pal = await rect(page, '.palette', 8)
    const clip = { x: 0, y: pal.y, width: Math.min(1280, pal.x + pal.width + 330), height: pal.height }
    await shot(page, '5-palette-now', clip)
    await page.evaluate(() => {
      const fig = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('図を入れる'))
      const r = fig.getBoundingClientRect()
      const tip = document.createElement('div')
      tip.className = 'mock-why'
      tip.textContent = '図・表は、紙面の入れたい所（段落の中）をクリックしてから押します'
      Object.assign(tip.style, { position: 'fixed', left: `${r.right + 12}px`, top: `${r.top + r.height / 2 - 22}px`, width: '230px', background: '#fff', color: '#1f2430', border: '1px solid #d8dbe2', padding: '8px 12px', borderRadius: '10px', font: '13px/1.6 "BIZ UDPGothic", sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,.15)', zIndex: 40 })
      document.body.append(tip)
    })
    await sleep(200)
    await shot(page, '5-palette-a', clip)
    await context.close()
  }

  // ===== ⑥ 字数・ページの数の言い方（右の欄） ／ ⑦ 作品写真の空のページ =====
  {
    const { context, page, ready } = await open(browser)
    // 抄録を短くする（436字くらい）・本文のページはそのまま
    await page.evaluate(() => {
      window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, paragraphs: r.abstract.paragraphs.slice(0, 3) } }))
    })
    await sleep(1500)
    await ready()
    await page.mouse.move(5, 5)
    const side = await rect(page, '.side .check-prog', 10)
    await shot(page, '6-count-now', side)
    await page.evaluate(() => {
      for (const li of document.querySelectorAll('.side .check-prog > li')) {
        const l = li.querySelector('.l')?.textContent
        const v = li.querySelector('.v')
        if (!v) continue
        if (l === '本文のページ') {
          const m = v.textContent.match(/(\d+)\s*\/\s*(\d+)/)
          if (m) v.innerHTML = Number(m[1]) >= Number(m[2]) ? `${m[1]}ページ（${m[2]}ページ以上）` : `${m[1]}ページ（${m[2]}ページ以上。あと<b>${Number(m[2]) - Number(m[1])}</b>）`
        }
        if (l === '抄録') {
          const m = v.textContent.match(/(\d+)\s*\/\s*(\d+)字/)
          if (m) v.innerHTML = `${m[1]}字（600〜900字。あと<b>${600 - Number(m[1])}</b>字）`
        }
      }
    })
    await sleep(200)
    await shot(page, '6-count-a', side)

    // ⑦ 作品写真の空のページ
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: r.workPhotos.map((p) => ({ ...p, imageIds: p.imageIds.map(() => '') })) })))
    await sleep(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    await sleep(500)
    await page.mouse.move(5, 5)
    const stage = await rect(page, '.stage', 0)
    await shot(page, '7-photo-now', stage)
    await page.addStyleTag({ content: `.page-viewport [data-photo-slot]:empty::before { content: '＋\\A写真を選ぶ\\A（ここをクリック）' !important; white-space: pre; font-size: 22pt !important; font-weight: 700; line-height: 1.5; text-align: center; color: #2f3e75 !important; } .page-viewport [data-photo-slot]:empty { outline: 2px dashed #9aa3c4 !important; outline-offset: -6px; background: #f4f6fb; }` })
    await sleep(300)
    await shot(page, '7-photo-a', stage)
    await context.close()
  }

})

// ---- 並べた絵 ----
await sleep(2000)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const sheet = async (file, title, sub, cols, width = 1700, rows = false) => {
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: ${width - 44}px; }
      h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; line-height: 1.6; }
      .row { display: grid; grid-template-columns: ${rows ? '1fr' : `repeat(${cols.length}, 1fr)`}; gap: 16px; align-items: start; }
      .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; min-height: 44px; }
      .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 6px; }
      .rows .col img { width: auto; max-width: 100%; }
    </style><h1>${title}</h1><p class="sub">${sub}</p><div class="row${rows ? ' rows' : ''}">${cols.map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p>${c.imgs.map((s) => `<img src="${img(s)}">`).join('')}</div>`).join('')}</div>`
    await page.setViewport({ width, height: 800 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: `mockups/v73/${file}.png`, fullPage: true })
  }
  await sheet('1-references', '① 引用・参考文献の入れ口', '今は「メニュー → 使い方 → 引用・参考文献」の中にしかなく、パソコン・スマホの2人とも見つけられなかった。', [
    { h: '今', t: '本文の左の道具にも、右の欄にもない', imgs: ['1-refs-now', '1-refs-phone-now'] },
    { h: '案A（おすすめ）', t: '本文の左の道具の下に「参考文献」。スマホは書いている間の「追加」に「参考文献」。押すと今の窓が開く', imgs: ['1-refs-a', '1-refs-phone-a'] },
    { h: '案B', t: '右の欄の進み具合に「引用・参考文献　なくてもよい・＋ 入れる」の行（スマホは「チェック」の中）', imgs: ['1-refs-b'] },
  ], 1440, true)
  await sheet('2-toast', '② 画面の下の知らせ（パソコン）', '「段落を削除しました［戻す］」などが紙面の最後の行に重なり、その行を押すと「戻す」が押されてしまった（うっかりの役）。スマホの「追加」に重なる件は、不具合として直した。', [
    { h: '今', t: '紙面の台の下の真ん中（最後の行に重なる）', imgs: ['2-toast-now'] },
    { h: '案A（おすすめ）', t: '紙面の台の上の真ん中（ページの上の余白に出る。本文の行に重なりにくい）', imgs: ['2-toast-a'] },
    { h: '案B', t: '今より下（ページの下の余白・ページ番号のあたり）', imgs: ['2-toast-b'] },
  ], 1100, true)
  await sheet('3-delete', '③ スマホ（Android 360px）：書いている間の「削除」と「完了」', '「削除」と「完了」の間が 2px しかなく、「削除」は段落を確かめずに消す（戻すは出る）。ダブルタップで次のページへめくれることもあった。', [
    { h: '今', t: '「削除」のすぐ右に「完了」', imgs: ['3-delete-now'] },
    { h: '案A（おすすめ）', t: '「削除」を左の端へ（「完了」から離す）', imgs: ['3-delete-a'] },
    { h: '案B', t: '「削除」と「完了」の間をあけ、区切りの線', imgs: ['3-delete-b'] },
  ], 1300)
  await sheet('4-font', '④ 紙面の字が小さい（1280×720 のノートパソコン）', '1ページの表示では本文の字が約 8px。「＋」と Ctrl＋ホイールで大きくできるが、案内していない（パソコンが苦手な学生の役）。', [
    { h: '今', t: 'はじめは「1ページ」（ページ全体）', imgs: ['4-font-now'] },
    { h: '案A', t: '小さい画面では、はじめから「拡大」（本文の幅に合わせる。ページ全体を見るときは「1ページ」）', imgs: ['4-font-a'] },
    { h: '案B（おすすめ）', t: '今のまま。はじめの1回だけ、右下の帯の上に「字が小さいときは…」の一言（× で閉じる）', imgs: ['4-font-b'] },
  ], 1360, true)
  await sheet('5-palette', '⑤ 1280×720 で、左の道具の説明（「図・表は、入れたい所をクリックしてから押します」）が出ない', '道具が台の高さに入りきらないので、説明を隠している。灰色の「図を入れる」を押しても、わけが分からない。', [
    { h: '今', t: '灰色の「図を入れる」を押しても何も出ない（マウスを重ねたときの小さな説明だけ）', imgs: ['5-palette-now'] },
    { h: '案A（おすすめ）', t: '押せない「図を入れる」「表を入れる」を押したら、横に吹き出しでわけを出す（スマホで前から出しているものと同じ）', imgs: ['5-palette-a'] },
  ], 1300)
  await sheet('6-counts', '⑥ 字数・ページの数の言い方（右の欄）', '「436 / 600字 あと164」が上限に読める（600は下限、上限は900）。「6 / 5ページ」が「超えている」とも読める。', [
    { h: '今', t: '「436 / 600字 あと164」「6 / 5ページ」', imgs: ['6-count-now'] },
    { h: '案（おすすめ）', t: '「436字（600〜900字。あと164字）」「6ページ（5ページ以上）」', imgs: ['6-count-a'] },
  ], 1100)
  await sheet('7-photo', '⑦ 作品写真の空のページ', '白いページの真ん中に、小さく薄い字（約 8px）で「（クリックして写真を選ぶ）」があるだけ。', [
    { h: '今', t: '小さく薄い字', imgs: ['7-photo-now'] },
    { h: '案（おすすめ）', t: '大きな「＋ 写真を選ぶ（ここをクリック）」と点線の枠（印刷・PDF には出ない）', imgs: ['7-photo-a'] },
  ], 1300)
})
console.log('できました：mockups/v73/')
