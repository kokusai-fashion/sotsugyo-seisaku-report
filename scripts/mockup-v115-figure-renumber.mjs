// mockups/v115（2026-11-06）：手で打った「（図n）」の番号が、図を入れたときに直ったことを知らせる案
//   依頼者の問い：本当は図4の所に「（図5）」と打った（番号が飛んだ）とき、ずれを知らせるメッセージはないのか。
//   今：「図4を入れる」で入れると、書いた「（図5）」は何も知らせずに「（図4）」に直る（手がかりはボタンの名前だけ）
//   案A：直したあと、画面の下の知らせ（「段落を削除しました」と同じ所）に「書いた（図5）を（図4）に直しました」
//   案B：直したあと、直した「（図4）」のすぐ上に、吹き出しで少しの間出す
//   案C：入れる前に、ボタンの下に「書いた（図5）は（図4）に直ります」と添える
//   本物のツール（まとめた版）に、字を差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v115-figure-renumber.mjs（Edge は 9339）
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'
import { answerConfirms } from './e2e/confirmUi.mjs'
import { closeGuide } from './e2e/nameStep.mjs'

process.env.EDGE_PORT ??= '9339'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v115'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TIPS_DONE = () => { try { for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done'); localStorage.setItem('sotsugyo-seisaku-report-writing-zoom', '0') } catch {} }
const TEXT = '帯は、からし色の布を幅15cmの筒に縫い、腰に二重に巻いた（図5）。結び目が大きく見えるよう、端に房を付けた。'

/** 外の画面に、案の説明の札を置く */
const note = (page, { title, lines, x, y, w = 330 }) =>
  page.evaluate(
    ({ title, lines, x, y, w }) => {
      document.querySelector('#mk-note')?.remove()
      const d = document.createElement('div')
      d.id = 'mk-note'
      d.style.cssText = `box-sizing:border-box;position:fixed;left:${x}px;top:${y}px;width:${w}px;z-index:2147483647;background:#fffaf0;border:2px solid #b07d1a;border-radius:12px;padding:12px 14px;font:14px/1.7 'BIZ UDPGothic',sans-serif;color:#2b2b2b;box-shadow:0 6px 18px rgba(0,0,0,.18)`
      d.innerHTML = `<b style="display:block;font-size:16px;color:#8a5d00;margin-bottom:4px">${title}</b>${lines.map((l) => `<div>${l}</div>`).join('')}`
      document.documentElement.append(d)
    },
    { title, lines, x, y, w },
  )

async function open(browser, phone) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(TIPS_DONE)
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 })
  await stubConfig(page)
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 120000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await closeGuide(page)
  await ready()
  await page.evaluate(setupWriting)
  await sleep(600)
  await ready()
  // 見本の図は3枚。帯の段落に、本当は図4のところを「（図5）」と打った（番号が飛んだ）
  await page.evaluate((text) => window.__editor.update((r) => ({ ...r, body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p11' ? { ...b, content: [{ type: 'text', text }] } : b)) })) })), TEXT)
  await sleep(1200)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p11'), 'none'))
  await ready()
  return { context, page, ready }
}

/** 紙面の、帯の段落の「（図4）」の位置（画面の座標。紙面の段落は、字が小さな並びに分かれているので、段落の中の何字目かで探す） */
const textRect = (page) =>
  page.evaluate(() => {
    // 左のページの一覧の小さな絵にも同じ段落があるので、いちばん大きく見えている段落（紙面）を選ぶ
    const p = [...document.querySelectorAll('section.body p')].filter((e) => e.textContent.includes('帯は、からし色') && e.textContent.includes('図4')).sort((x, y) => y.getBoundingClientRect().height - x.getBoundingClientRect().height)[0]
    if (!p) return null
    const at = p.textContent.indexOf('図4')
    const nodes = []
    const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n)
    const place = (k) => { let sum = 0; for (const n of nodes) { if (k <= sum + n.length) return [n, k - sum]; sum += n.length } return null }
    const [sn, so] = place(Math.max(0, at - 1))
    const [en, eo] = place(at + 3)
    const r = document.createRange()
    r.setStart(sn, so)
    r.setEnd(en, eo)
    const box = r.getBoundingClientRect()
    return box.width > 0 ? { x: box.left, y: box.top, w: box.width, h: box.height } : null
  })

await withEdge(async (browser) => {
  const pngPath = join(tmpdir(), 'sotsugyo-v115.png')
  for (const phone of [false, true]) {
    const tag = phone ? 'phone' : 'pc'
    const { context, page, ready } = await open(browser, phone)
    if (!phone) {
      const png = await page.evaluate(async () => {
        const c = new OffscreenCanvas(600, 800)
        const g = c.getContext('2d')
        g.fillStyle = '#efe4d2'
        g.fillRect(0, 0, 600, 800)
        g.fillStyle = '#c99a2e'
        g.fillRect(120, 330, 360, 140)
        return btoa(String.fromCharCode(...new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())))
      })
      writeFileSync(pngPath, Buffer.from(png, 'base64'))
    }
    // 書く欄を開いて、カーソルを「（図5）」の中へ → 「図4を入れる」が出る
    await page.evaluate((caret) => window.__editor.openEditor('p11', caret), TEXT.indexOf('（図5）') + 2)
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p11', { timeout: 20000 })
    await sleep(1000)
    await page.waitForFunction(() => { const c = document.querySelector('.figure-chip'); return c && !c.hidden }, { timeout: 15000 })
    const chipBox = await page.evaluate(() => { const r = document.querySelector('.figure-chip').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
    if (!phone) {
      await note(page, { title: '今：図を入れる前', lines: ['「（図5）」にカーソルを置くと、すぐ上に<b>「図4を入れる」</b>が出る。', '番号が違うことの手がかりは、このボタンの名前だけ。'], x: 1096, y: 470 })
      await page.screenshot({ path: `${OUT}/0-今-入れる前-${tag}.png` })
      // 案C：ボタンの下に、番号が直ることを添える
      await page.evaluate(() => {
        const c = document.querySelector('.figure-chip')
        c.dataset.mkStyle = c.style.cssText
        const label = [...c.querySelectorAll('span')].find((e) => e.textContent.includes('を入れる')) ?? c
        const s = document.createElement('span')
        s.id = 'mk-c'
        s.textContent = '書いた（図5）は（図4）に直ります'
        s.style.cssText = 'display:block;font-size:11px;font-weight:400;line-height:1.4;opacity:.92;margin-top:1px'
        label.style.display = 'inline-block'
        label.style.textAlign = 'left'
        c.style.height = 'auto'
        c.style.paddingBlock = '4px'
        label.append(s)
      })
      await note(page, { title: '案C　入れる前に添える', lines: ['ボタンの中に、<b>「書いた（図5）は（図4）に直ります」</b>と小さく添える。', '押す前に分かる。直したあとは何も出さない。'], x: 1096, y: 470 })
      await page.screenshot({ path: `${OUT}/C-入れる前に添える-${tag}.png` })
      await page.evaluate(() => { document.querySelector('#mk-c')?.remove(); const c = document.querySelector('.figure-chip'); c.style.cssText = c.dataset.mkStyle; c.querySelectorAll('span').forEach((e) => { e.style.display = ''; e.style.textAlign = '' }); document.querySelector('#mk-note')?.remove() })
    }
    // 「図4を入れる」を押して写真を選ぶ → 図4が入り、書いた「（図5）」が「（図4）」に直る
    await sleep(600)
    const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 15000 }), page.click('.figure-chip')])
    await chooser.accept([pngPath])
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
    await page.keyboard.type('帯')
    if (phone) await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '完了')?.click())
    else await page.keyboard.press('Escape')
    await sleep(1500)
    await ready()
    await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p11'), 'none'))
    await ready()
    await sleep(500)
    const ref = await textRect(page)
    if (!phone) {
      await note(page, { title: '今：図を入れたあと', lines: ['本文の「（図5）」は「（図4）」に直っている。', '<b>何も知らせない</b>（直った結果は正しい）。'], x: 1096, y: 470 })
      await page.screenshot({ path: `${OUT}/0-今-入れたあと-${tag}.png` })
    }
    // 案A：画面の下の知らせ（「段落を削除しました」と同じ所・8秒ほど）
    await page.evaluate(() => window.__editor.showNotice('書いた「（図5）」を「（図4）」に直しました（図の番号は、図の順に付きます）'))
    await sleep(500)
    if (!phone) await note(page, { title: '案A　画面の下に知らせる', lines: ['「『。』を付けました」などの知らせと同じ所に、<b>「書いた（図5）を（図4）に直しました」</b>を8秒ほど出す。', '書き続けても、じゃまにならない。'], x: 1096, y: 470 })
    await page.screenshot({ path: `${OUT}/A-下に知らせる-${tag}.png` })
    await page.evaluate(() => { document.querySelector('#mk-note')?.remove() })
    // 案B：直した「（図4）」のすぐ上に吹き出し（少しの間）
    await page.evaluate(() => window.__editor.showNotice(''))
    await page.evaluate(() => document.querySelectorAll('.undo-bar, [role="status"] > *').forEach((e) => (e.style.visibility = 'hidden')))
    if (ref) {
      await page.evaluate((ref, phone) => {
        const b = document.createElement('div')
        b.id = 'mk-b'
        const w = phone ? 250 : 250
        const left = Math.max(8, Math.min(innerWidth - w - 8, ref.x + ref.w / 2 - w / 2))
        b.style.cssText = `position:fixed;left:${left}px;top:${ref.y - (phone ? 52 : 50)}px;width:${w}px;z-index:2147483646;background:#2b3a67;color:#fff;border-radius:8px;padding:6px 10px;font:${phone ? 11.5 : 12.5}px/1.5 'BIZ UDPGothic',sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25);text-align:center;box-sizing:border-box;white-space:normal`
        b.innerHTML = '書いた（図5）を<b>（図4）</b>に直しました<br><span style="opacity:.85;font-size:.9em">図の番号は、図の順に付きます</span>'
        const t = document.createElement('div')
        t.style.cssText = `position:absolute;left:${ref.x + ref.w / 2 - left - 6}px;bottom:-6px;width:12px;height:12px;background:#2b3a67;transform:rotate(45deg)`
        b.append(t)
        const hl = document.createElement('div')
        hl.id = 'mk-hl'
        hl.style.cssText = `position:fixed;left:${ref.x - 2}px;top:${ref.y - 1}px;width:${ref.w + 4}px;height:${ref.h + 2}px;border-radius:3px;background:rgba(255,214,90,.45);z-index:2147483645;pointer-events:none`
        document.documentElement.append(hl, b)
      }, ref, phone)
    }
    if (!phone) await note(page, { title: '案B　直した所に吹き出し', lines: ['直した<b>「（図4）」のすぐ上</b>に、吹き出しで少しの間（5秒ほど）出し、字を薄く光らせる。', 'どこが直ったかが分かる。'], x: 1096, y: 470 })
    await page.screenshot({ path: `${OUT}/B-直した所に吹き出し-${tag}.png` })
    console.log(tag, 'ok', JSON.stringify(ref))
    await context.close()
  }
})
