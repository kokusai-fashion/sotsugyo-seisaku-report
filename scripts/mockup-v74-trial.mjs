// mockups/v74：学生の試し 2回目（2026-10-29。poc-output/firsttime/r1029/まとめ2.md の B）の、見た目が変わる直しの案。
// 本物のツール（開発サーバー）を開き、CSS や部品を差し込んで撮る（見た目の案。動きは作っていない）。
// 使い方：node scripts/mockup-v74-trial.mjs（開発サーバー http://localhost:5173。Edge は 9335）。SHEET_ONLY=1 で並べた絵だけ作り直す
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v74/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
// Word の試しのファイル（手元だけ。学生のものではない、作った見本）
const B29 = '../試し用_Wordのいろいろ/作ったファイル/B29_長い本文（図24枚）.docx'

async function open(browser, { width = 1366, height = 768, phone = false, sample = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0'); localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done') } catch {} })
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height, deviceScaleFactor: 1.25 })
  await stubConfig(page)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'load', timeout: 180000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 180000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  if (sample) {
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForSelector('.guide .g-later')
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()
    await page.evaluate(setupWriting)
    await sleep(600)
    await ready()
  }
  return { context, page, ready }
}
const go = async (page, ready, id) => {
  await page.evaluate((id) => window.__editor.goToPage(window.__editor.pageOfBlock(id), 'none'), id)
  await ready()
  await sleep(400)
}
const rect = (page, sel, pad = 0) => page.evaluate((sel, pad) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad), width: Math.min(innerWidth - Math.max(0, r.left - pad), r.width + pad * 2), height: Math.min(innerHeight - Math.max(0, r.top - pad), r.height + pad * 2) } }, sel, pad)
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}), captureBeyondViewport: false })
// ONLY=crop,se-photos：その案だけ撮り直す
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
  // ===== ① 直すところが残ったまま保存した PDF（パソコン 1280×720） =====
  await item('pdf', async () => {
    const { context, page, ready } = await open(browser, { width: 1280, height: 720 })
    const dl = mkdtempSync(join(tmpdir(), 'v74-'))
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl })
    // 段落の終わりの「。」を外す（直すところ1つ）
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' && b.type === 'paragraph' ? { ...b, content: b.content.map((n, i, a) => (i === a.length - 1 && n.type === 'text' ? { ...n, text: n.text.replace(/。$/, '') } : n)) } : b)) })) })))
    await sleep(1200)
    await ready()
    await page.evaluate(() => [...document.querySelectorAll('.side button')].find((b) => b.textContent.includes('PDFを書き出す'))?.click())
    await page.waitForSelector('.modal', { timeout: 20000 })
    await sleep(600)
    const modal = await rect(page, '.modal', 12)
    await shot(page, '1-pdf-now', modal)
    // 案A：残っているときは「直しに戻る」を濃く、「このまま保存する」を薄く
    await page.evaluate(() => {
      const bs = [...document.querySelectorAll('.modal .row-buttons button')]
      const back = bs.find((b) => b.textContent.includes('直しに戻る'))
      const save = bs.find((b) => b.textContent.includes('保存する'))
      back?.classList.add('primary')
      if (save) {
        save.classList.remove('primary')
        save.textContent = 'このまま保存する'
        back?.parentElement?.append(back)
      }
    })
    await sleep(200)
    await shot(page, '1-pdf-a-before', await rect(page, '.modal', 12))
    // 保存したあと
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('保存する'))?.click())
    await page.waitForFunction(() => /保存しました|ダウンロード/.test(document.querySelector('.modal')?.textContent ?? '') && !document.querySelector('.modal .busy'), { timeout: 120000 })
    await sleep(800)
    await shot(page, '1-pdf-now-saved', await rect(page, '.modal', 12))
    await page.evaluate(() => {
      const m = document.querySelector('.modal')
      const warn = document.createElement('p')
      warn.innerHTML = '<b>直すところが1つ残ったまま保存しました。</b><br>提出するときは、直してから、もう一度保存します。'
      warn.style.cssText = 'margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#fdf1e4;color:#8a4b0f;font-size:14px;line-height:1.6;border:1px solid #f0c58f'
      const h = m.querySelector('h2, .modal-title, header')
      ;(h?.nextElementSibling ?? m.firstElementChild).before(warn)
    })
    await sleep(200)
    await shot(page, '1-pdf-a-saved', await rect(page, '.modal', 12))
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.modal *')) if (el.childNodes.length === 1 && el.firstChild.nodeType === 3 && /\.pdf$/.test(el.textContent.trim())) el.textContent = el.textContent.replace(/\.pdf$/, '_途中.pdf')
    })
    await sleep(200)
    await shot(page, '1-pdf-b-saved', await rect(page, '.modal', 12))
    rmSync(dl, { recursive: true, force: true })
    await context.close()
  })

  // ===== ② 作品写真が大きく切れている（パソコン 1280×720） =====
  await item('crop', async () => {
    const { context, page, ready } = await open(browser, { width: 1280, height: 720 })
    // 縦長の全身の写真を、「2枚・上下」の下の枠に（横長の枠）
    const ok = await page.evaluate(() => {
      const r = window.__editor.getSnapshot().report
      const figs = r.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures.map((f) => f.imageId) : [])).filter(Boolean)
      const full = r.workPhotos.flatMap((p) => p.imageIds).filter(Boolean)[0]
      if (!full || figs.length < 1) return false
      window.__editor.update((x) => ({ ...x, workPhotos: [{ layout: 2, columns: 1, imageIds: [figs.at(-1), full] }] }))
      return true
    })
    if (!ok) throw new Error('作品写真がない')
    await sleep(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    await sleep(600)
    await page.mouse.move(5, 5)
    const stage = await rect(page, '.stage', 0)
    await shot(page, '2-crop-now', stage)
    // 案A：紙面の枠に「上下が切れています」の札（印刷には出ない）と、右の欄の要確認
    await page.evaluate(() => {
      const slot = document.querySelectorAll('.page-viewport.front [data-photo-slot]')[1]
      if (slot) {
        const b = document.createElement('div')
        b.textContent = '上と下が大きく切れています'
        b.style.cssText = 'position:absolute;left:50%;bottom:10px;translate:-50% 0;z-index:5;padding:3px 10px;border-radius:99px;background:#b26a00;color:#fff;font:700 9pt sans-serif;white-space:nowrap'
        slot.style.position = 'relative'
        slot.append(b)
      }
      const fixes = [...document.querySelectorAll('.side h3, .side .fix-h, .side b')].find((x) => x.textContent.trim().startsWith('直すところ'))
      const box = document.createElement('div')
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:8px;background:#fff7ec"><span style="color:#b26a00;font-weight:700">!</span><div><b style="font-size:13.5px">作品写真が大きく切れている</b><div style="font-size:12px;color:#5b616e">1ページ目の下の写真。上と下が切れています。「全体を入れる（切らない）」か、並べ方を変えます</div><div style="font-size:12px;color:#2f3e75;text-decoration:underline;margin-top:2px">このままにする（確認済み）</div></div></div>'
      box.style.cssText = 'margin:6px 18px'
      ;(fixes?.closest('section, div') ?? document.querySelector('.side .check'))?.append(box)
    })
    await sleep(300)
    await shot(page, '2-crop-a', stage)
    await shot(page, '2-crop-a-side', await rect(page, '.side', 0))
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.page-viewport.front [data-photo-slot] div')) if (el.textContent.includes('切れています')) el.remove()
      for (const el of document.querySelectorAll('.side div')) if (el.textContent.startsWith('作品写真が大きく切れている') || el.querySelector?.('b')?.textContent === '作品写真が大きく切れている') el.closest('div[style*="margin:6px 18px"]')?.remove()
      const t = document.createElement('div')
      t.innerHTML = '縦長の写真を横長の枠に入れたので、上と下が切れています <button style="margin-left:10px;padding:3px 12px;border-radius:99px;border:1px solid #fff;background:none;color:#fff;font:inherit;font-weight:700">全体を入れる</button>'
      t.style.cssText = 'position:fixed;left:50%;top:14px;translate:-50% 0;z-index:90;padding:10px 16px;border-radius:12px;background:#2b2e36;color:#fff;font:14px sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25)'
      document.querySelector('.stage')?.append(t)
    })
    await sleep(300)
    await shot(page, '2-crop-b', stage)
    await context.close()
  })

  // ===== ③ スマホ：2本指で広げた倍率（iPhone 390×844） =====
  await item('zoom', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '2.2'))
    await go(page, ready, 'p2')
    await page.evaluate(() => window.__editor.openEditor('p2', 10))
    await sleep(1500)
    const full = { x: 0, y: 0, width: 390, height: 844 }
    await shot(page, '3-zoom-now', full)
    await page.evaluate(() => {
      const chip = document.createElement('button')
      chip.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>幅に合わせる'
      chip.style.cssText = 'position:fixed;right:10px;top:104px;z-index:60;display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;border:1px solid #c9cede;background:#fff;color:#2f3e75;font:700 14px sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.18)'
      document.body.append(chip)
    })
    await sleep(200)
    await shot(page, '3-zoom-a', full)
    await page.evaluate(() => {
      document.querySelector('body > button[style*="position:fixed"]')?.remove()
      const tip = document.createElement('div')
      tip.innerHTML = '<b>字が大きすぎるとき</b><br>2本の指でつまむと、幅いっぱいに戻ります'
      tip.style.cssText = 'position:fixed;left:12px;right:12px;top:104px;z-index:60;padding:10px 14px;border-radius:12px;background:#2f3e75;color:#fff;font:14px/1.6 sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.2)'
      document.body.append(tip)
    })
    await sleep(200)
    await shot(page, '3-zoom-b', full)
    await context.close()
  })

  // ===== ④ スマホ：抄録を書いている間の字数（iPhone 390×844） =====
  await item('abstract', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, abstract: { ...r.abstract, started: true, paragraphs: [{ type: 'paragraph', id: 'a1', content: [{ type: 'text', text: '本制作では、卒業イベント「シンドバッド」で、主人公シンドバッドの衣装を担当した。七つの海を旅する船乗りらしく、紺と金の色で、海と宝物を表すことにした。' }] }] } })))
    await sleep(1200)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('a1'), 'none'))
    await ready()
    await page.evaluate(() => window.__editor.openEditor('a1', 20))
    await sleep(1500)
    const full = { x: 0, y: 0, width: 390, height: 844 }
    await shot(page, '4-abs-now', full)
    const count = await page.evaluate(() => { const r = window.__editor.getSnapshot().report; return r.abstract.paragraphs.map((p) => p.content.map((n) => n.text ?? '').join('')).join('').replace(/\s/g, '').length })
    await page.evaluate((n) => {
      const bar = document.querySelector('.direct-bar')
      const line = document.createElement('div')
      line.innerHTML = `抄録 <b>${n}字</b>（600〜900字。あと<b>${600 - n}</b>字）`
      line.style.cssText = 'padding:4px 12px 2px;font:13px sans-serif;color:#4a5060;border-bottom:1px solid #e3e5ea'
      bar?.prepend(line)
    }, count)
    await sleep(300)
    await shot(page, '4-abs-a', full)
    await page.evaluate((n) => {
      document.querySelector('.direct-bar > div[style*="padding:4px 12px"]')?.remove()
      const sub = [...document.querySelectorAll('.phone-head *, header *')].find((x) => x.childNodes.length === 1 && x.textContent.trim() === '抄録')
      if (sub) sub.innerHTML = `抄録 <b style="color:#2f3e75">${n}字</b>（あと${600 - n}字）`
    }, count)
    await sleep(300)
    await shot(page, '4-abs-b', full)
    await context.close()
  })

  // ===== ⑤ スマホ：表の次のマスへ（iPhone 390×844） =====
  await item('cell', async () => {
    const { context, page, ready } = await open(browser, { width: 390, height: 844, phone: true })
    const cell = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')?.rows[1]?.cells[0]?.id)
    const table = await page.evaluate(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).find((b) => b.type === 'table')?.id)
    await go(page, ready, table)
    await page.evaluate((id) => window.__editor.openEditor(id, 0), cell)
    await sleep(1500)
    const full = { x: 0, y: 0, width: 390, height: 844 }
    await shot(page, '5-cell-now', full)
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.direct-bar .db-row')].find((r) => !r.classList.contains('db-add') && !r.classList.contains('db-table'))
      const done = row?.querySelector('.db-done')
      const b = document.createElement('button')
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h12M13 6l6 6-6 6"/></svg><span>次のマス</span>'
      done?.before(b)
    })
    await sleep(200)
    await shot(page, '5-cell-a', full)
    await context.close()
  })

  // ===== ⑥ iPhone SE：作品写真を3枚まとめて選んだあと（375×667） =====
  await item('se-photos', async () => {
    const { context, page, ready } = await open(browser, { width: 375, height: 667, phone: true })
    await page.evaluate(() => {
      const r = window.__editor.getSnapshot().report
      const figs = r.body.flatMap((c) => c.blocks).flatMap((b) => (b.type === 'figureRow' ? b.figures.map((f) => f.imageId) : [])).filter(Boolean)
      const full = r.workPhotos.flatMap((p) => p.imageIds).filter(Boolean)[0]
      window.__editor.update((x) => ({ ...x, workPhotos: [{ layout: 4, imageIds: [full, figs[0] ?? full, figs[1] ?? full] }] }))
    })
    await sleep(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('photos'), 'none'))
    await ready()
    await sleep(800)
    await page.evaluate(() => window.__editor.showNotice?.('3枚なので「4枚」の並べ方にしました'))
    await sleep(600)
    const full = { x: 0, y: 0, width: 375, height: 667 }
    await shot(page, '6-se-now', full)
    // 案A：「写真を選ぶ」の帯をなくし、並べ方の帯の左に「＋ 写真」。知らせは上に
    await page.evaluate(() => {
      const bands = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'absolute')
      const pick = bands.find((el) => el.textContent.includes('まだ写真がありません') && el.querySelector('button') && el.getBoundingClientRect().height < 120)
      pick && (pick.style.display = 'none')
      const layout = bands.find((el) => el.textContent.includes('並べ方') && el.textContent.includes('1枚') && el.getBoundingClientRect().height < 140)
      if (layout) {
        const plus = document.createElement('button')
        plus.innerHTML = '<b style="font-size:20px;line-height:1">＋</b><span style="font-size:11px">写真</span>'
        plus.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:52px;height:58px;margin-right:4px;border:0;border-radius:10px;background:#2f3e75;color:#fff'
        const first = layout.querySelector('button')
        first?.parentElement?.insertBefore(plus, first)
        const label = [...layout.querySelectorAll('*')].find((x) => x.childNodes.length === 1 && x.textContent.trim() === '並べ方')
        label && (label.style.display = 'none')
      }
      const toast = document.querySelector('.undo-toast')?.closest('.undo-area')
      if (toast) {
        toast.style.top = '70px'
        toast.style.bottom = 'auto'
      }
    })
    await sleep(300)
    await shot(page, '6-se-a', full)
    await context.close()
  })

  // ===== ⑦ 書いている段落を小見出しにする（パソコン 1366×768） =====
  await item('subheading', async () => {
    const { context, page, ready } = await open(browser)
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 1 ? { ...c, blocks: [{ type: 'paragraph', id: 'px', content: [{ type: 'text', text: '2-1 パターンと仮縫い' }] }, ...c.blocks] } : c)) })))
    await sleep(1200)
    await ready()
    await go(page, ready, 'px')
    await page.evaluate(() => window.__editor.openEditor('px', 3))
    await sleep(900)
    await page.mouse.move(5, 5)
    const pal = await rect(page, '.palette', 0)
    const area = { x: Math.max(0, pal.x - 8), y: 0, width: 560, height: 560 }
    await shot(page, '7-sub-now', area)
    await page.evaluate(() => {
      const ctx = document.querySelector('.palette .group.ctx')
      const del = [...(ctx?.querySelectorAll('.tb') ?? [])].find((b) => b.textContent.includes('削除'))
      const sub = [...document.querySelectorAll('.palette .tb')].find((b) => b.textContent.includes('小見出し'))
      if (del && sub) {
        const b = sub.cloneNode(true)
        const label = [...b.querySelectorAll('span, div')].find((x) => x.textContent.trim() === '小見出し')
        if (label) label.innerHTML = '小見出し<br>にする'
        b.classList.remove('off', 'disabled')
        b.removeAttribute('disabled')
        del.before(b)
      }
    })
    await sleep(200)
    await shot(page, '7-sub-a', area)
    await context.close()
  })

  // ===== ⑧ Word：図の多い原稿の「つぎにすること」（パソコン 1366×768） =====
  await item('todo', async () => {
    const { context, page, ready } = await open(browser, { sample: false })
    await page.evaluate(() => document.querySelector('.g-word-opt:not(.no)').click())
    await page.waitForSelector('.word-file .acts button:not(.link)', { timeout: 20000 })
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.evaluate(() => document.querySelectorAll('.word-file .acts button:not(.link)')[0].click())])
    await chooser.accept([B29])
    await page.waitForFunction(() => document.querySelector('.word-file.picked'), { timeout: 20000 })
    await sleep(500)
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('中身を確かめる'))?.click())
    await page.waitForFunction(() => [...document.querySelectorAll('.modal .row-buttons button')].some((b) => b.textContent.includes('読み込む') && !b.disabled), { timeout: 120000 })
    await page.evaluate(() => [...document.querySelectorAll('.modal .row-buttons button')].find((b) => b.textContent.includes('読み込む')).click())
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 120000 })
    await ready()
    await sleep(800)
    await page.evaluate(() => document.querySelector('.guide .g-later')?.click())
    await page.waitForSelector('.side .word-todo', { timeout: 20000 })
    await sleep(800)
    await page.mouse.move(5, 5)
    const side = await rect(page, '.side', 0)
    await shot(page, '8-todo-now', side)
    // 案A：図の位置と改ページの位置を1つに（全ページを見る）。済んだ項目は1行にたたむ
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.side .word-todo > ul > li')]
      const fig = items.find((li) => li.textContent.includes('図の位置'))
      const pages = items.find((li) => li.textContent.includes('改ページの位置'))
      fig?.remove()
      if (pages) {
        pages.querySelector('b').textContent = '図と改ページの位置を確かめる'
        pages.querySelector('small').textContent = '図の大きさが Word と変わるため、図や改ページの位置がずれることがあります。全ページを見て、必要なら直す'
      }
      const done = items.find((li) => li.classList.contains('done'))
      if (done) done.querySelector('small')?.remove()
      const p = document.querySelector('.side .word-todo > p')
      if (p) p.textContent = p.textContent.replace(/次の\d+つ/, '次の3つ')
    })
    await sleep(300)
    await shot(page, '8-todo-a', await rect(page, '.side', 0))
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
    await page.screenshot({ path: `mockups/v74/${file}.png`, fullPage: true })
  }
  await sheet('1-pdf', '① 直すところが残ったまま保存した PDF', '濃いボタンはいつも「PDF を保存する」。保存したあとの窓は残りに触れず、提出用と見分けられなかった（仕上げの役）。透かしは 10/19 のご判断どおり付けない。', [
    { h: '今', t: '残っていても、濃いボタンは「PDF を保存する」。保存後は残りのことを言わない', imgs: ['1-pdf-now', '1-pdf-now-saved'] },
    { h: '案A（おすすめ）', t: '残っているときは「直しに戻る」を濃く、「このまま保存する」を薄く。保存したあと「直すところが1つ残ったまま保存しました」', imgs: ['1-pdf-a-before', '1-pdf-a-saved'] },
    { h: '案B', t: '案A に加えて、ファイル名の終わりに「_途中」（提出用と名前でも分かる）', imgs: ['1-pdf-a-before', '1-pdf-b-saved'] },
  ], 1700)
  await sheet('2-crop', '② 作品写真が大きく切れている', '縦長の全身の写真を横長の枠に入れると、上と下が大きく切れるが、何も言わない（仕上げの役。PDF でも切れていた）。', [
    { h: '今', t: '何も言わない', imgs: ['2-crop-now'] },
    { h: '案A（おすすめ）', t: '紙面の枠に札（印刷・PDF には出ない）と、右の欄の要確認「作品写真が大きく切れている」（このままにできる）', imgs: ['2-crop-a', '2-crop-a-side'] },
    { h: '案B', t: '入れたときだけ、上に知らせと「全体を入れる」', imgs: ['2-crop-b'] },
  ], 1700)
  await sheet('3-zoom', '③ スマホ：2本指で広げた倍率が、次の段落・表紙にも続く', '一度広げると、行の両端が画面の外に出たまま。「幅いっぱい」に戻す方法が分からない（スマホの役）。', [
    { h: '今', t: '戻し方の案内がない', imgs: ['3-zoom-now'] },
    { h: '案A（おすすめ）', t: '幅より大きく広げているときだけ、右上に「幅に合わせる」', imgs: ['3-zoom-a'] },
    { h: '案B', t: '広げすぎたときに一度だけ「2本の指でつまむと、幅いっぱいに戻ります」', imgs: ['3-zoom-b'] },
  ], 1300)
  await sheet('4-abstract', '④ 抄録を書いている間の字数', 'スマホでは書いている間に字数が見えない（チェックを開くと「174字（600〜900字。あと426字）」）。パソコンの右の欄は、今回の直しで「742字・18行」と出るようにした。', [
    { h: '今', t: '字数が見えない', imgs: ['4-abs-now'] },
    { h: '案A（おすすめ）', t: '抄録を書いている間だけ、キーボードの上の道具の上に「抄録 174字（600〜900字。あと426字）」', imgs: ['4-abs-a'] },
    { h: '案B', t: '画面の上の「抄録」の横に字数', imgs: ['4-abs-b'] },
  ], 1300)
  await sheet('5-cell', '⑤ スマホ：表の次のマスへ', 'スマホには Tab がなく、改行はマスの中の改行。次のマス（高さ約 19px）はタップするしかない（スマホの役）。', [
    { h: '今', t: '次のマスへ移る道具がない', imgs: ['5-cell-now'] },
    { h: '案（おすすめ）', t: 'マスを書いている間だけ、「完了」の左に「次のマス」', imgs: ['5-cell-a'] },
  ], 900)
  await sheet('6-se-photos', '⑥ iPhone SE：作品写真を3枚まとめて選んだあと', '「4枚目の枠に…写真を選ぶ」の帯・並べ方の帯・ページ送り・知らせが重なり、3枚目と4枚目の枠が見えない（iPhone 390 は問題なし）。', [
    { h: '今', t: '帯が3つ重なる', imgs: ['6-se-now'] },
    { h: '案（おすすめ）', t: '「写真を選ぶ」の帯をなくし、並べ方の帯の左に「＋ 写真」。知らせは上に', imgs: ['6-se-a'] },
  ], 900)
  await sheet('7-subheading', '⑦ 書いている段落を小見出しにする', 'Word から読み込んだ「2-1 パターンと仮縫い」が段落になった。「小見出し」を押すと、下に空の小見出しが増えるだけだった（Word の役）。今回の直しで、行の終わりで Enter を押すと小見出しになるようにした。', [
    { h: '今', t: '左の道具の「この段落」は「削除」だけ', imgs: ['7-sub-now'] },
    { h: '案A（おすすめ）', t: '「この段落」に「小見出しにする」（短く「。」のない段落のときだけ出す）', imgs: ['7-sub-a'] },
    { h: '案B', t: '道具は今のまま。短く「。」のない段落で「小見出し」を押したら、その段落を小見出しにする（絵は今と同じ）', imgs: [] },
  ], 1500)
  await sheet('8-todo', '⑧ 図の多い Word を読み込んだあとの「つぎにすること」', '図24枚では「図の位置を確かめる」を24回押す。読み込んだ直後は、この一覧が右の欄の大半を占める（Word の役）。', [
    { h: '今', t: '図の位置（図1〜図24）と改ページの位置が別々', imgs: ['8-todo-now'] },
    { h: '案A（おすすめ）', t: '「図と改ページの位置を確かめる」の1つにまとめる（「本文へ」→ 全ページを見て「確かめた」）。済んだ項目は1行に', imgs: ['8-todo-a'] },
  ], 1100)
})
console.log('できました：mockups/v74/')
