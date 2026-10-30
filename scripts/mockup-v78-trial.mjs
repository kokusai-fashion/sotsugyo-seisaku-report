// mockups/v78：学生の試し 5回目（2026-10-30。poc-output/firsttime/r1029/まとめ5.md の B）の、見た目が変わる直しの案。
// 本物のツール（開発サーバー）を開き、CSS や部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v78-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）。SHEET_ONLY=1 で並べた絵だけ作り直す
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v78/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const FIXTURES = 'scripts/e2e/fixtures'
const PHOTOS = 'docs/guide-images/sample'

async function open(browser, { width = 1366, height = 768, phone = false } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
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
const rect = (page, sel, pad = 0) => page.evaluate((sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), width: Math.min(innerWidth - Math.max(0, r.left - pad), r.width + pad * 2), height: Math.min(innerHeight - Math.max(0, r.top - pad), r.height + pad * 2) } }, sel, pad)
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}), captureBeyondViewport: false })
const ONLY = process.env.ONLY?.split(',')
const item = async (name, fn) => {
  if (ONLY && !ONLY.includes(name)) return
  try {
    await fn()
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}

if (!process.env.SHEET_ONLY) await withEdge(async (browser) => {
  // ===== ① スマホの形の「追加」に「図」「表」 =====
  await item('add', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p6'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('p6', 6))
    await sleep(800)
    await page.evaluate(() => window.__editor.finishEditing())
    await sleep(900)
    await ready()
    await page.evaluate(() => document.querySelector('.p-nav .add').click())
    await page.waitForSelector('.sheet .add-grid', { timeout: 10000 })
    await sleep(600)
    await shot(page, '1-add-now')
    await page.evaluate(() => {
      const grid = document.querySelector('.sheet .add-grid')
      const base = [...grid.querySelectorAll('button')].pop()
      for (const label of ['図', '表']) {
        const b = base.cloneNode(true)
        b.querySelector('span').textContent = label
        grid.append(b)
      }
      const hints = document.querySelectorAll('.sheet .sheet-hint')
      const last = hints[hints.length - 1]
      if (last) last.textContent = '図・表は、さっき書いていた所（「配色と素材は…」の段落）に入ります。ほかの所に入れるときは、その文を押してから。'
    })
    await sleep(300)
    await shot(page, '1-add-a')
    await context.close()
  })

  // ===== ② 大見出し（章）の順番の入れ替え =====
  await item('chapter', async () => {
    const { context, page, ready } = await open(browser)
    const chapterId = await page.evaluate(() => window.__editor.getSnapshot().report.body[1].id)
    await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), chapterId)
    await ready()
    await page.evaluate((id) => window.__editor.openEditor(id, 2), chapterId)
    await sleep(800)
    const area = await page.evaluate(() => { const p = document.querySelector('.palette').getBoundingClientRect(); return { x: 0, y: 0, width: p.right + 520, height: innerHeight } })
    await shot(page, '2-ch-now', area)
    await page.evaluate(() => {
      const group = [...document.querySelectorAll('.palette .group.ctx')].pop()
      const del = group.querySelector('.tb')
      for (const [label, arrow] of [['章を前へ', '↑'], ['章を後ろへ', '↓']]) {
        const b = del.cloneNode(true)
        b.classList.remove('danger')
        b.querySelector('svg')?.replaceWith(Object.assign(document.createElement('b'), { textContent: arrow, style: 'font-size:18px;line-height:1;color:#2f3e75' }))
        b.querySelector('span').textContent = label
        group.insertBefore(b, del)
      }
    })
    await sleep(300)
    await shot(page, '2-ch-a', area)
    await context.close()
  })

  // ===== ③ 貼った表を、表として入れる =====
  await item('table', async () => {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [...c.blocks.slice(0, 2), { type: 'paragraph', id: 'pz', content: [{ type: 'text', text: '' }] }, ...c.blocks.slice(2)] } : c)) })))
    await sleep(900)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('pz'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('pz', 0))
    await sleep(700)
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', '素材\t用途\t量\nコットンサテン\tブラウス\t3m\nシルクシフォン\t袖\t2m')
      dt.setData('text/html', '<table><tr><td>素材</td><td>用途</td><td>量</td></tr><tr><td>コットンサテン</td><td>ブラウス</td><td>3m</td></tr><tr><td>シルクシフォン</td><td>袖</td><td>2m</td></tr></table>')
      document.querySelector('.overlay-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await sleep(1500)
    await ready()
    const paper = await page.evaluate(() => { const p = document.querySelector('.palette').getBoundingClientRect(); return { x: Math.max(0, p.left - 4), y: 0, width: 760, height: 470 } })
    await shot(page, '3-tb-now', paper)
    // 案A：知らせに「表にする」
    await page.evaluate(() => {
      const t = document.querySelector('.undo-toast')
      if (!t) return
      t.innerHTML = '<span>貼り付けた表は、文（3つの段落）になりました</span><button style="margin-left:10px">表にする</button>'
    })
    await sleep(300)
    await shot(page, '3-tb-a', paper)
    // 案B：貼ったときに、表として入れる（「表にしました［戻す］」）
    await page.keyboard.press('Escape')
    await sleep(900)
    await page.evaluate(() => window.__editor.update((r) => {
      const ids = ['tbA', 'tbB', 'tbC']
      const rows = [['素材', '用途', '量'], ['コットンサテン', 'ブラウス', '3m'], ['シルクシフォン', '袖', '2m']].map((texts, i) => ({ id: `tr${i}`, cells: texts.map((t, j) => ({ id: `tc${i}${j}`, text: t, imageId: null })) }))
      return { ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.flatMap((b) => {
        if (b.type !== 'paragraph') return [b]
        const text = b.content.map((n) => n.text ?? '').join('')
        if (/^素材　用途|^コットンサテン　|^シルクシフォン　/.test(text)) return text.startsWith('素材') ? [{ type: 'table', id: 'tbX', caption: '', widths: 'equal', heights: 'auto', rows }] : []
        return [b]
      }) })) }
    }))
    await sleep(1500)
    await ready()
    await page.evaluate(() => {
      const area = document.querySelector('.undo-area') ?? document.body
      let t = document.querySelector('.undo-toast')
      if (!t) {
        t = document.createElement('div')
        t.className = 'undo-toast'
        area.append(t)
      }
      t.innerHTML = '<span>貼り付けた表を、表にしました（3行×3列）</span><button style="margin-left:10px">戻す</button>'
    })
    await sleep(300)
    await shot(page, '3-tb-b', paper)
    await context.close()
  })

  // ===== ④ 提出前チェック：保存したあとの画面 =====
  await item('check', async () => {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.25 })
    const dl = mkdtempSync(join(tmpdir(), 'v78-'))
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, browserContextId: context.id })
    await stubConfig(page)
    page.on('dialog', (d) => void d.accept())
    await page.goto(`${APP}/check.html`, { waitUntil: 'networkidle0', timeout: 90000 })
    await sleep(800)
    const files = readdirSync(FIXTURES).filter((f) => /^word-sample-.*\.(docx|pdf)$/.test(f)).map((f) => join(process.cwd(), FIXTURES, f))
    const photos = readdirSync(PHOTOS).filter((f) => /^photo|^design/.test(f)).slice(0, 2).map((f) => join(process.cwd(), PHOTOS, f))
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ファイルを選ぶ'))?.click())])
    await chooser.accept([...files, ...photos])
    await sleep(6000)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('1つの PDF にまとめる'))?.click())
    await sleep(1500)
    await page.evaluate(() => [...document.querySelectorAll('.modal button, [role=dialog] button')].find((b) => /まとめる|このまま/.test(b.textContent))?.click())
    await page.waitForSelector('.c-saved, .c2-saved', { timeout: 60000 })
    await sleep(1200)
    const card = await rect(page, '.c-saved, .c2-saved', 14)
    await shot(page, '4-ck-now', card)
    // 案A：「ファイルを足す・入れ替える」のボタン
    await page.evaluate(() => {
      const c = document.querySelector('.c-saved, .c2-saved')
      const b = document.createElement('button')
      b.className = 'btn'
      b.textContent = 'ファイルを足す・入れ替える'
      b.style.marginRight = '6px'
      const first = [...c.querySelectorAll('button.btn')][0]
      c.insertBefore(b, first)
    })
    await sleep(300)
    await shot(page, '4-ck-a', await rect(page, '.c-saved, .c2-saved', 14))
    await context.close()
  })
})

// ---- 並べた絵 ----
await sleep(1500)
await withEdge(async (browser) => {
  const page = await browser.newPage()
  const has = (p) => { try { readFileSync(join(OUT, `${p}.png`)); return true } catch { return false } }
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const sheet = async (file, title, sub, cols, width = 1700) => {
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: ${width - 44}px; }
      h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 14px; color: #4a5060; font-size: 15px; line-height: 1.6; }
      .row { display: grid; grid-template-columns: repeat(${cols.length}, 1fr); gap: 16px; align-items: start; }
      .col { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
      .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 14px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; min-height: 44px; }
      .col img { width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; display: block; margin-top: 6px; }
    </style><h1>${title}</h1><p class="sub">${sub}</p><div class="row">${cols.map((c) => `<div class="col"><h2>${c.h}</h2><p>${c.t}</p>${c.imgs.filter(has).map((s) => `<img src="${img(s)}">`).join('')}</div>`).join('')}</div>`
    await page.setViewport({ width, height: 800 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.screenshot({ path: `mockups/v78/${file}.png`, fullPage: true })
  }
  await sheet('1-add', '① スマホの形の「追加」に「図」「表」', '書く欄を閉じると、図・表を入れる道具がない（キーボードの上の道具は、書いている間だけ）。ブラウザを拡大したパソコン（スマホの形）では、キーボードだけで図・表を入れられない（4回目の B① は、パソコンの形の左の道具だけ）。', [
    { h: '今', t: '「追加」は大見出し・小見出し・改ページだけ', imgs: ['1-add-now'] },
    { h: '案A（おすすめ）', t: '「追加」に「図」「表」。さっき書いていた所に入る（どの段落かを書く）。見ているページにないときは押せない形', imgs: ['1-add-a'] },
    { h: '案B', t: '見た目は今のまま。書いている間に Tab でキーボードの上の道具（図・表）へ移れるようにする（パソコンだけ）', imgs: [] },
  ], 1300)
  await sheet('2-chapter', '② 大見出し（章）の順番の入れ替え', 'いまは「章の中身を切り取る → 大見出しを足す → 貼る → 空の章を消す」の4つが要る（大きく直す役）。番号・目次・（図n）は、どの直しのあとも正しかった。', [
    { h: '今', t: '大見出しを書いている間の道具は「削除」だけ', imgs: ['2-ch-now'] },
    { h: '案A（おすすめ）', t: '大見出しを書いている間、「この見出し」に「章を前へ」「章を後ろへ」（中の小見出し・段落・図表ごと動く。元に戻せる）', imgs: ['2-ch-a'] },
    { h: '案B', t: '道具は足さない。使い方に「章を入れ替えるとき」の手順（見開きで選ぶ → 切り取る → 貼る）を書く', imgs: [] },
  ], 1500)
  await sheet('3-table', '③ 貼った表を、表として入れる', 'Word・Google ドキュメントの表を貼ると、行ごとの段落になり、知らせ「表は「表を入れる」で作ります」が出る。各行に「文末に「。」」の赤い指摘が出る（貼り付けの役）。', [
    { h: '今', t: '行ごとの段落になる', imgs: ['3-tb-now'] },
    { h: '案A（おすすめ）', t: '知らせに「表にする」。押すと、貼った行を表にする（いつもは文のまま）', imgs: ['3-tb-a'] },
    { h: '案B', t: '貼ったときに、表として入れる。知らせに「戻す」（文のままにしたいときは戻す）', imgs: ['3-tb-b'] },
  ], 1900)
  await sheet('4-check', '④ 提出前チェック：保存したあとに、1つだけ直したいとき', '保存の画面で押せるのは「はじめから」（全部外れる）・「PDF を開く」・「もう一度保存」だけ。引っぱって入れると、いつもの画面に戻るが、気づきにくい（提出前チェックの役）。', [
    { h: '今', t: '「はじめから」か、引っぱって入れる', imgs: ['4-ck-now'] },
    { h: '案A（おすすめ）', t: '「ファイルを足す・入れ替える」（直した Word・PDF だけを入れ直して、もう一度まとめる）', imgs: ['4-ck-a'] },
  ], 1100)
})
console.log('できました：mockups/v78/')
