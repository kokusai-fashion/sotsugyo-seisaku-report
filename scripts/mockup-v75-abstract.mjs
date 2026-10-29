// mockups/v75：抄録に、本文にない内容らしい文があれば知らせる（依頼者の要望 2026-10-29：抄録は本文の抜粋。本文にないことを急に書かないように）。
// 本物のツール（開発サーバー）で、抄録の文を本文の文（となり合う2文まで）と比べ、重なりの少ない文に印を付けた見た目を撮る（動きは作っていない）。
// 使い方：node scripts/mockup-v75-abstract.mjs（開発サーバー http://localhost:5173。Edge は 9335。通しテストを流している間は使わない）
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withEdge } from './poc/edge.mjs'
import { stubConfig } from './e2e/configStub.mjs'
import { setupWriting } from './e2e/sampleReport.mjs'

process.env.EDGE_PORT ??= '9335'
const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'mockups/v75/shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (page, name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}) })
/** 本文にない内容として足す文（見本） */
const MADE_UP = '本制作では、ミラノで買い付けたシルクを使い、全体を手染めで仕上げた。'

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sotsugyo-seisaku-report-tour', 'done'); localStorage.setItem('sotsugyo-seisaku-report-zoom-tip', 'done') } catch {} })
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1.25 })
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

  // 抄録：書き出しの文＋本文から抜き出した文（1つは少し言い換え）＋本文にない文＋まとめの文
  const sentences = await page.evaluate((madeUp) => {
    const r = window.__editor.getSnapshot().report
    const text = (b) => b.content.map((n) => n.text ?? '').join('')
    const body = r.body.flatMap((c) => c.blocks).filter((b) => b.type === 'paragraph').map(text).filter((t) => t.length > 20)
    const sents = body.flatMap((p) => p.split(/(?<=。)/).map((s) => s.trim()).filter((s) => s.length > 15 && !/[（(][図表]/.test(s)))
    const picked = [sents[0], sents[2], sents[4], sents[6], sents[8]].filter(Boolean)
    // 1つは言い方を少し変える（読点を足し、語尾を変える）
    picked[2] = picked[2].replace(/た。$/, 'ている。').replace(/、/, '、さらに')
    const opening = '本制作報告書は、卒業イベント「シンドバッド」において、筆者が担当した主人公の衣装の制作について報告するものである。'
    const closing = '制作を通して、物語の場面に合わせて衣装の見え方を考えることの大切さを学んだ。'
    const all = [opening, picked[0], picked[1], madeUp, picked[2], picked[3], picked[4], closing]
    window.__editor.update((x) => ({ ...x, abstract: { ...x.abstract, started: true, paragraphs: [
      { type: 'paragraph', id: 'a1', content: [{ type: 'text', text: all.slice(0, 3).join('') }] },
      { type: 'paragraph', id: 'a2', content: [{ type: 'text', text: all.slice(3, 6).join('') }] },
      { type: 'paragraph', id: 'a3', content: [{ type: 'text', text: all.slice(6).join('') }] },
    ] } }))
    // 比べる（重なりの割合：抄録の文の2字の組のうち、本文の文（となり合う2文まで）にあるものの割合のいちばん大きいもの）
    const bodySents = body.flatMap((p) => p.split(/(?<=。)/).filter((s) => s.trim()))
    const norm = (t) => t.replace(/[（(][図表]\s*\d+[）)]/g, '').replace(/[\s　、。（）「」『』・,.]/g, '')
    const grams = (t) => { const s = norm(t); const g = []; for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2)); return g }
    const windows = bodySents.flatMap((s, i) => [s, ...(bodySents[i + 1] ? [s + bodySents[i + 1]] : [])]).map((w) => new Set(grams(w)))
    const bodyText = r.body.flatMap((c) => [c.title, ...c.blocks.flatMap((b) => (b.type === 'paragraph' ? [text(b)] : b.type === 'subheading' ? [b.title] : b.type === 'figureRow' ? b.figures.map((f) => f.caption) : []))]).join('\n')
    return all.map((s, i) => {
      const g = grams(s)
      const score = Math.max(...windows.map((w) => g.filter((x) => w.has(x)).length / Math.max(1, g.length)))
      // 語のかたまり：漢字2字以上（後ろの送り仮名も、助詞の前まで）・カタカナ2字以上。本文にあるかは、漢字・カタカナの部分で見る
      const terms = [...new Set((s.match(/[一-鿿々]{2,}[ぁ-ん]{0,3}|[ァ-ヴー]{2,}/g) ?? []).map((t) => t.replace(/[をにがはでとのへもやなだ][ぁ-ん]*$/, '')))].filter((t) => !bodyText.includes(t.replace(/[ぁ-ん]+$/, '')))
      return { s, score: Math.round(score * 100), terms, first: i === 0 }
    })
  }, MADE_UP)
  console.log(sentences.map((x) => `${x.score}% ${x.first ? '(書き出し)' : ''} ${x.terms.join('・')} | ${x.s.slice(0, 30)}`).join('\n'))
  await sleep(1500)
  await ready()
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('abstract'), 'none'))
  await ready()
  await sleep(600)
  await page.evaluate(() => window.__editor.setZoom(true))
  await sleep(800)
  await ready()
  await page.evaluate((madeUp) => {
    const p = [...document.querySelectorAll('.page-viewport.front p')].find((el) => el.textContent.replace(/\s/g, '').includes(madeUp.slice(0, 10)))
    p?.scrollIntoView({ block: 'center' })
  }, MADE_UP)
  await sleep(500)
  await page.mouse.move(5, 5)
  const full = { x: 0, y: 0, width: 1366, height: 768 }
  await shot(page, '1-now', full)

  // 印を付ける文（書き出しの文は比べない。5割より少ない文）
  const flagged = sentences.filter((x) => !x.first && x.score < 50)
  await page.addStyleTag({ content: '::highlight(mock-warn) { text-decoration: underline 2px wavy #c98a00; text-underline-offset: 3px; background-color: rgba(201, 138, 0, 0.16); }' })
  await page.evaluate((list) => {
    const hl = new Highlight()
    for (const p of document.querySelectorAll('.page-viewport.front p')) {
      const nodes = []
      const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) nodes.push(w.currentNode)
      const all = nodes.map((n) => n.textContent).join('')
      for (const s of list) {
        const at = all.indexOf(s)
        if (at < 0) continue
        let pos = 0
        const range = document.createRange()
        for (const n of nodes) {
          const len = n.textContent.length
          if (pos <= at && at < pos + len) range.setStart(n, at - pos)
          if (pos < at + s.length && at + s.length <= pos + len) range.setEnd(n, at + s.length - pos)
          pos += len
        }
        hl.add(range)
      }
    }
    CSS.highlights.set('mock-warn', hl)
  }, flagged.map((x) => x.s))

  // 案A：右の欄の「直すところ」に、文ごとの要確認（このままにできる）
  const issueHtml = (x) => `<li class="issue warning"><i class="dot"></i><button type="button" class="go"><span class="ttl">本文にない内容かもしれない文がある</span><span class="detail">「${x.s.slice(0, 14)}…」${x.terms.length ? `本文にない語：${x.terms.slice(0, 3).join('・')}。` : ''}抄録は、本文から抜き出して、言い方を少し整えて書きます</span></button><button class="keep">このままにする（確認済み）</button></li>`
  await page.evaluate((html) => {
    const none = document.querySelector('.side .check-none')
    const side = document.querySelector('.side').getBoundingClientRect()
    const at = (none ?? document.querySelector('.side .check-prog')).getBoundingClientRect()
    // 右の欄の幅で、「いま直すところはありません」の所から下に重ねる（右の欄と同じ部品の形）
    const wrap = document.createElement('aside')
    wrap.className = 'side mock-abs'
    wrap.style.cssText = `position:fixed;z-index:50;left:${side.left}px;top:${at.top - 4}px;width:${side.width}px;height:auto;padding:0 0 8px;background:var(--panel-bg, #faf8f4);border:0;box-shadow:none;grid-template-rows:none;display:block`
    wrap.innerHTML = `<div class="check" style="padding:0 18px"><div class="sev-legend" style="font-size:11.5px;color:#5b616e;margin:0 0 6px">⚠ 要確認：確かめて、必要なら直す</div><div class="igroup"><div class="ig-h">抄録<span>${(html.match(/<li/g) || []).length}件</span></div><ul class="issues">${html}</ul></div></div>`
    document.body.append(wrap)
  }, flagged.map(issueHtml).join(''))
  await sleep(300)
  await shot(page, '2-a', full)

  // 案B：右の欄に「本文との照らし合わせ」（抄録の文ごとに、本文から ○・本文と離れている △。押すと本文の近い所へ）
  await page.evaluate((list) => {
    const keep = document.querySelector('.mock-abs')
    const side = document.querySelector('.side:not(.mock-abs)').getBoundingClientRect()
    const prog = document.querySelector('.side .check-prog').getBoundingClientRect()
    const box = document.createElement('div')
    box.className = 'mock-abs-b'
    box.style.cssText = `box-sizing:border-box;position:fixed;z-index:51;left:${side.left + 18}px;width:${side.width - 36}px;top:${prog.top}px;padding:10px 12px;border:1px solid #e3e5ea;border-radius:10px;background:#fff;font-size:12.5px;line-height:1.6;box-shadow:0 2px 8px rgba(0,0,0,.06)`
    box.innerHTML = `<b style="display:block;font-size:13.5px;margin-bottom:4px">本文との照らし合わせ</b><div style="color:#5b616e;margin-bottom:6px">抄録の文ごとに、本文の近い所と比べます</div>${list
      .map((x) => `<div style="display:grid;grid-template-columns:18px 1fr auto;gap:6px;padding:3px 0;border-top:1px solid #f0f1f4"><span style="color:${x.first ? '#9aa0ab' : x.score < 50 ? '#c98a00' : '#2e7d32'};font-weight:700">${x.first ? '－' : x.score < 50 ? '△' : '○'}</span><span>${x.s.slice(0, 16)}…${x.score < 50 && !x.first ? `<br><span style="color:#8a5a00">本文にない内容かもしれません${x.terms.length ? `（${x.terms.slice(0, 3).join('・')}）` : ''}</span>` : ''}</span><span style="color:#2f3e75;text-decoration:underline;white-space:nowrap">${x.first ? '書き出し' : x.score < 50 ? '' : '本文へ'}</span></div>`)
      .join('')}`
    document.body.append(box)
    keep?.remove()
  }, sentences)
  await sleep(300)
  await shot(page, '3-b', full)
  await context.close()

  // ---- 並べた絵 ----
  const sheet = await browser.newPage()
  const img = (p) => `data:image/png;base64,${readFileSync(join(OUT, `${p}.png`)).toString('base64')}`
  const rows = sentences.map((x) => `<tr><td>${x.first ? '書き出し（比べない）' : x.s === MADE_UP ? '本文にない（見本に足した文）' : x.s.startsWith('制作を通して') ? 'まとめ（本文と言い方が違う）' : '本文から抜き出し'}</td><td class="n">${x.score}%</td><td>${x.terms.join('・') || '—'}</td><td>${x.s}</td></tr>`).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 22px; background: #eef0f3; font-family: 'BIZ UDPGothic', 'Yu Gothic', sans-serif; color: #1f2430; width: 1420px; }
    h1 { font-size: 22px; margin: 0 0 4px; } .sub { margin: 0 0 12px; color: #4a5060; font-size: 15px; line-height: 1.7; }
    table { border-collapse: collapse; background: #fff; margin: 0 0 16px; font-size: 13px; width: 100%; } td, th { border: 1px solid #d8dbe2; padding: 4px 8px; text-align: left; vertical-align: top; } th { background: #f4f5f8; } td.n { text-align: right; font-weight: 700; }
    .row { display: grid; grid-template-columns: 1fr; gap: 16px; } .col { background: #fff; border-radius: 12px; padding: 12px; }
    .col h2 { font-size: 17px; margin: 0 0 4px; } .col p { font-size: 15px; margin: 0 0 8px; color: #4a5060; line-height: 1.6; } .col img { width: 1366px; max-width: 100%; border: 1px solid #d8dbe2; border-radius: 6px; }
  </style><h1>抄録に、本文にない内容らしい文があれば知らせる</h1>
  <p class="sub">抄録の1文ずつを、本文の文（となり合う2文まで）と比べ、2字ずつの組がどれだけ重なるかを出す。5割より少ない文に印を付ける（要確認。正しければ「このままにする」）。抄録のいちばん初めの「本制作報告書は…」の文は比べない。比べるのは学生の端末の中だけ（外に送らない）。<br>見本の抄録で比べた結果：</p>
  <table><tr><th>文の種類</th><th>重なり</th><th>本文にない語</th><th>文</th></tr>${rows}</table>
  <div class="row">
    <div class="col"><h2>今</h2><p>抄録の字数・行数だけを確かめる</p><img src="${img('1-now')}"></div>
    <div class="col"><h2>案A（おすすめ）</h2><p>重なりの少ない文に黄色の波線。右の欄の「直すところ」に要確認「本文にない内容かもしれない文がある」（本文にない語を添える。押すとその文へ。このままにできる）</p><img src="${img('2-a')}"></div>
    <div class="col"><h2>案B</h2><p>案A の波線に加えて、右の欄に「本文との照らし合わせ」（抄録の文ごとに ○・△。○ の文は「本文へ」で本文の近い所へ移る）</p><img src="${img('3-b')}"></div>
  </div>`
  await sheet.setViewport({ width: 1464, height: 900 })
  await sheet.setContent(html, { waitUntil: 'load' })
  await sheet.screenshot({ path: 'mockups/v75/1-abstract-check.png', fullPage: true })
})
console.log('できました：mockups/v75/1-abstract-check.png')
