// mockups/v111（2026-11-05）：ひな形の段落に「書き出しの文（黒い字）」と「続きの説明（薄い字）」を両方入れる案
//   依頼者：本文に入る文は、本文の最初の文（書き出し）を入れる前提。黒い字の書き出しのあと、同じ行の続きに「ここにはこういうことを書く」を
//   薄い字で出したい。今は1つの段落が「ここに書くこと」か「本文に入る文」のどちらかにしかならない。
//   案A：字の色を切り替える（書き出しを打ったら、左の「ここに書くこと」を押して、同じ段落に続けて説明を打つ）
//   案B：続きの説明の欄（「書き出しの文」の段落の下に欄が出て、そこに説明を書く）
//   案C：今の作り方のまま、書き出しの段落（「。」で終わらない）と、すぐ下の「ここに書くこと」の段落を、学生には1つにつないで出す
//   学生の画面（どの案でも同じ）：書く前／書き始めたあと。「本文に入る文」の名前は「書き出しの文」に変える案。
//   本物のツール（まとめた版）に、字や枠を差し込んで撮る。使い方：APP_URL=http://localhost:4180 node scripts/mockup-v111-template-starter.mjs（Edge は 9337）
import { mkdirSync, readFileSync } from 'node:fs'
import { stubConfig } from './e2e/configStub.mjs'
import { closeGuide } from './e2e/nameStep.mjs'

process.env.EDGE_PORT ??= '9337'
const { withEdge } = await import('./poc/edge.mjs')
const APP = process.env.APP_URL ?? 'http://localhost:4180'
const OUT = 'mockups/v111'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VIEW = { width: 1440, height: 900, deviceScaleFactor: 2 }
const HINT = 'rgb(95, 107, 149)'
const START = 'この衣装のデザインは、'
const MORE = 'デザインのもとにした作品や時代を書く'

const live = JSON.parse(readFileSync('poc-output/live-config-1104b.json', 'utf8'))
const config = live.config ?? live
config.notice = ''
for (const c of config.courses) {
  c.advisors = ['山本　恵子', '中村　健一', '小川　真理']
  delete c.notice
}

/** 「デザイン説明」の下の段落の id */
const designParagraph = (f) =>
  f.evaluate(() => {
    for (const ch of window.__editor.getSnapshot().report.body) {
      const i = ch.blocks.findIndex((b) => b.type === 'subheading' && b.title.includes('デザイン'))
      const p = i >= 0 && ch.blocks.slice(i + 1).find((b) => b.type === 'paragraph')
      if (p) return p.id
    }
    return null
  })

/** 外の画面に、案の説明の札を置く */
const note = (page, { title, lines, x = 1092, y = 418, w = 334 }) =>
  page.evaluate(
    ({ title, lines, x, y, w }) => {
      document.querySelector('#mk-note')?.remove()
      const d = document.createElement('div')
      d.id = 'mk-note'
      d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${w}px;z-index:2147483647;background:#fffaf0;border:2px solid #b07d1a;border-radius:12px;padding:14px 16px;font:14px/1.7 'BIZ UDPGothic',sans-serif;color:#2b2b2b;box-shadow:0 6px 18px rgba(0,0,0,.18)`
      d.innerHTML = `<b style="display:block;font-size:16px;color:#8a5d00;margin-bottom:6px">${title}</b>${lines.map((l) => `<div>${l}</div>`).join('')}`
      document.documentElement.append(d)
    },
    { title, lines, x, y, w },
  )

async function openTemplate(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('dialog', (d) => void d.accept())
  await page.evaluateOnNewDocument((config) => {
    try {
      if (sessionStorage.getItem('mk-seeded')) return
      sessionStorage.setItem('mk-seeded', '1')
      localStorage.setItem('sotsugyo-admin-mock', JSON.stringify({ years: [{ year: config.fiscalYear, status: '公開中', config, updatedAt: '2026-11-04T09:00:00.000Z', updatedBy: 'admin@example.ac.jp' }], history: [] }))
    } catch {}
  }, config)
  await page.setViewport(VIEW)
  await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button')
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定')).click())
  await sleep(600)
  await page.evaluate(() => {
    const c = document.querySelector('.course[data-course-id="film-stage-costume"]')
    if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
  })
  await page.waitForSelector('.course.open .tpl-open')
  await page.evaluate(() => document.querySelector('.course.open .tpl-open').click())
  await page.waitForSelector('.tpl-overlay iframe')
  await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 30000 })
  const frame = page.frames().find((f) => f.url().includes('template=1'))
  await frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && s.page === window.__editor.pageOfArea('body') }, { timeout: 60000 })
  await sleep(800)
  // 「本文に入る文」の名前を「書き出しの文」に（どの案でも）
  await frame.addStyleTag({ content: `.mk-hint{color:${HINT}}` })
  return { context, page, frame, pid: await designParagraph(frame) }
}

/** 書いている段落（ひな形を作る画面）に、黒い字と薄い字を入れ、左の道具の名前と押した所を変える */
async function editing(frame, pid, { html, pressed, tag }) {
  await frame.evaluate((id) => window.__editor.openWhenReady(id, 0), pid)
  await frame.waitForSelector('.overlay-editor', { visible: true })
  await sleep(700)
  await frame.evaluate(
    ({ html, pressed, tag }) => {
      const ed = document.querySelector('.overlay-editor')
      ed.innerHTML = html
      // 書く印（カーソル）は、書いた字の終わりに置く
      const r = document.createRange()
      r.selectNodeContents(ed)
      r.collapse(false)
      getSelection().removeAllRanges()
      getSelection().addRange(r)
      const [hintBtn, textBtn] = [...document.querySelectorAll('.palette .group.ctx .tb')]
      textBtn.querySelector(':scope > span').innerHTML = '<span class="tb-line">書き出し</span><span class="tb-line">の文</span>'
      hintBtn.setAttribute('aria-pressed', String(pressed === 'hint'))
      textBtn.setAttribute('aria-pressed', String(pressed === 'text'))
      const t = document.querySelector('.tpl-editing-tag')
      if (t && tag) t.textContent = tag
    },
    { html, pressed, tag },
  )
  await sleep(300)
}

async function templateShots(browser) {
  // 案A：字の色を切り替える
  {
    const { context, page, frame, pid } = await openTemplate(browser)
    await editing(frame, pid, { html: `<span style="color:#1d2433">${START}</span><span class="mk-hint">${MORE}</span>`, pressed: 'hint', tag: '書き出し＋ここに書くこと' })
    await note(page, {
      title: '案A　字の色を切り替える',
      lines: ['書き出しを黒い字で打ったら、左の「ここに書くこと」を押して、同じ段落に続けて説明を打つ（ペンの色を変えるように）。', '紙面の見え方が、そのまま学生の見え方になる。'],
    })
    await page.screenshot({ path: `${OUT}/案A_字の色を切り替える.png` })
    await context.close()
  }
  // 案B：続きの説明の欄
  {
    const { context, page, frame, pid } = await openTemplate(browser)
    await editing(frame, pid, { html: `<span style="color:#1d2433">${START}</span>`, pressed: 'text', tag: '書き出しの文' })
    await frame.evaluate((more) => {
      const ed = document.querySelector('.overlay-editor').getBoundingClientRect()
      const box = document.createElement('div')
      box.style.cssText = `position:fixed;left:${ed.left}px;top:${ed.bottom + 10}px;width:${Math.max(360, ed.width * 0.8)}px;z-index:50;background:#fff;border:1.5px solid #2f3e75;border-radius:10px;padding:8px 10px;font:12.5px/1.6 'BIZ UDPGothic',sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)`
      box.innerHTML = `<div style="color:#2f3e75;font-weight:700">続きの説明（学生には、書き出しのあとに薄い字で出ます）</div><div style="margin-top:4px;border:1px solid #c9cedd;border-radius:6px;padding:4px 8px;color:#2b2b2b">${more}<span style="border-left:1.5px solid #2f3e75;margin-left:1px">&nbsp;</span></div>`
      document.body.append(box)
    }, MORE)
    await note(page, {
      title: '案B　続きの説明の欄',
      lines: ['「書き出しの文」の段落を書いていると、下に「続きの説明」の欄が出る。', 'そこに書いた説明が、学生には書き出しのあとに薄い字で出る。'],
    })
    await page.screenshot({ path: `${OUT}/案B_続きの説明の欄.png` })
    await context.close()
  }
  // 案C：2つの段落をつないで見せる
  {
    const { context, page, frame, pid } = await openTemplate(browser)
    await frame.evaluate(
      ({ id, start, more }) => {
        const p = document.querySelector(`.page-viewport.front p[data-block-id="${id}"]`)
        p.textContent = start
        p.style.color = '#1d2433'
        const q = p.cloneNode(false)
        q.setAttribute('data-block-id', 'mk-hint')
        // 左の札（::before）の見た目を、もとの段落から写す
        const cs = getComputedStyle(p, '::before')
        const props = ['position', 'left', 'top', 'right', 'width', 'height', 'transform', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-indent', 'white-space', 'padding', 'border', 'border-radius', 'background', 'color', 'display', 'box-sizing', 'margin']
        const tagCss = props.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';')
        q.textContent = more
        q.style.color = 'rgb(95, 107, 149)'
        p.after(q)
        const st = document.createElement('style')
        st.textContent = `p[data-block-id="${id}"]::before{content:'書き出しの文'!important;background:#e3e8f6!important;color:#2f3e75!important;border-color:#b9c3e3!important} p[data-block-id="mk-hint"]::before{content:'ここに書くこと'!important;${tagCss}}`
        document.head.append(st)
        const a = p.getBoundingClientRect()
        const b = q.getBoundingClientRect()
        const link = document.createElement('div')
        link.style.cssText = `position:fixed;left:${Math.max(a.right, b.right) + 10}px;top:${a.top - 2}px;height:${b.bottom - a.top + 4}px;border:2px solid #b07d1a;border-left:none;border-radius:0 8px 8px 0;width:12px;z-index:50`
        const lb = document.createElement('div')
        lb.style.cssText = `position:fixed;left:${Math.max(a.right, b.right) + 28}px;top:${(a.top + b.bottom) / 2 - 18}px;z-index:50;font:12px/1.5 'BIZ UDPGothic',sans-serif;color:#8a5d00;background:#fffaf0;border:1px solid #e3c98f;border-radius:6px;padding:2px 6px`
        lb.innerHTML = '学生には<br>1つの段落で出る'
        document.body.append(link, lb)
      },
      { id: pid, start: START, more: MORE },
    )
    await note(page, {
      title: '案C　2つの段落をつなぐ',
      lines: ['作り方は今のまま。「書き出しの文」の段落が「。」で終わらず、すぐ下が「ここに書くこと」の段落なら、学生には1つの段落につないで出す。', '先生の画面では2行に分かれて見える。'],
    })
    await page.screenshot({ path: `${OUT}/案C_2つの段落をつなぐ.png` })
    await context.close()
  }
}

/** 学生の画面（どの案でも同じ）：書く前・書き始めたあと */
async function studentShots(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setViewport(VIEW)
  await stubConfig(page, { courses: config.courses, fiscalYear: config.fiscalYear })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画')).click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await closeGuide(page)
  await ready()
  const pid = await designParagraph(page)
  // その段落のページへ（開いてから閉じる）
  await page.evaluate((id) => window.__editor.openWhenReady(id, 0), pid)
  await page.waitForSelector('.overlay-editor', { visible: true })
  await sleep(500)
  await page.keyboard.press('Escape')
  await sleep(800)
  await ready()
  await page.mouse.move(5, 5)
  const clip = await page.evaluate((id) => {
    const p = document.querySelector(`.page-viewport.front p[data-block-id="${id}"]`)
    const pg = p.closest('[data-vivliostyle-page-container]').getBoundingClientRect()
    const r = p.getBoundingClientRect()
    return { x: pg.left - 10, y: Math.max(0, r.top - 120), width: pg.width + 20, height: 330 }
  }, pid)
  // 書く前：黒い字の書き出しのあとに、薄い字の説明
  await page.evaluate(
    ({ id, start, more, hint }) => {
      const p = document.querySelector(`.page-viewport.front p[data-block-id="${id}"]`)
      p.innerHTML = `<span style="color:#1d2433">${start}</span><span style="color:${hint}">（${more}）</span>`
      document.activeElement?.blur()
    },
    { id: pid, start: START, more: MORE, hint: HINT },
  )
  await sleep(300)
  await page.screenshot({ path: `${OUT}/学生の画面_書く前.png`, clip })
  // 書き始めたあと：書き出しのすぐ後ろから続きを書く。薄い字は消える
  await page.evaluate((id) => window.__editor.openWhenReady(id, 0), pid)
  await page.waitForSelector('.overlay-editor', { visible: true })
  await sleep(600)
  await page.keyboard.type(`${START}中世アラビアの船乗りの衣装をもとにした`)
  await sleep(800)
  await page.screenshot({ path: `${OUT}/学生の画面_書き始めたあと.png`, clip })
  await context.close()
}

await withEdge(async (browser) => {
  await templateShots(browser)
  await studentShots(browser)
})
console.log('ok')
