// デザイン案 v135：はじめての案内の「Word で書き始めていますか？」に「あとで」を足す（依頼者 2026-11-10）。
// 教室ではスマホで登録だけを済ませ、Word はあとでパソコンから読み込む学生が多いため。
// 学生用ツール（dist-e2e）の案内に、案ごとの中身を仮に入れて撮る（ツール本体は変えない）。
//   node scripts/mockup-v135-word-later.mjs [--page-only：一覧のページだけ撮り直す] → mockups/v135/screens/*.png と mockups/v135/v135-word-later.png
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
process.env.EDGE_PORT ??= '9381'
const { withEdge } = await import('./poc/edge.mjs')
const { stubConfig } = await import('./e2e/configStub.mjs')
const { serveBuilt } = await import('./e2e/serveBuilt.mjs')

const OUT = 'mockups/v135'
mkdirSync(`${OUT}/screens`, { recursive: true })
const server = await serveBuilt(resolve('dist-e2e'), 4174)
const APP = 'http://localhost:4174'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fixture = JSON.parse(readFileSync('scripts/e2e/config-fixture.json', 'utf8'))

const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12.5" r="8"/><path d="M12 8v4.5l3 2"/></svg>'
const CSS = `
  .g-opts button.g-word-opt.later svg { color: var(--accent); }
  .v135-link { display: block; width: 100%; margin-top: 8px; padding: 9px 4px 2px; border: 0; border-top: 1px dashed var(--line); background: none; text-align: left; font-size: 13px; color: var(--accent); }
  .v135-link b { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
  .v135-link small { display: block; margin-top: 2px; font-size: 11.5px; color: var(--muted); }
  .v135-said { margin: -2px 0 10px; padding: 7px 11px; border-radius: 9px; background: var(--accent-soft); font-size: 12px; line-height: 1.6; color: var(--accent); }
`

// 案ごとの、ボタンの並び（yes の絵は、今の「はい」のボタンの絵を使う）
const opt = (cls, title, small, icon) => ({ cls, title, small, icon })
const PLANS = {
  now: {
    opts: [opt('yes', 'はい、Word から読み込む', '本文の Word と、書いていれば表紙の Word を選びます', 'word'), opt('no', 'いいえ、ここから書き始める', '学籍番号・氏名・サブタイトルを順に案内します')],
  },
  a: {
    opts: [
      opt('yes', 'はい、Word から読み込む', '本文の Word と、書いていれば表紙の Word を選びます', 'word'),
      opt('later', 'あとで読み込む', 'Word がいま手元にないとき。次にパソコンで開いたときに、もう一度聞きます', 'clock'),
      opt('no', 'いいえ、ここから書き始める', '学籍番号・氏名・サブタイトルを順に案内します'),
    ],
  },
  b: {
    opts: [
      opt('yes', 'はい、いま読み込む', '本文の Word と、書いていれば表紙の Word を選びます', 'word'),
      opt('later', 'はい、あとで読み込む', 'Word がいま手元にないとき。次にパソコンで開いたときに、もう一度聞きます', 'clock'),
      opt('no', 'いいえ、Word では書いていない', '学籍番号・氏名・サブタイトルを順に案内します'),
    ],
  },
  c: {
    opts: [opt('yes', 'はい、Word から読み込む', '本文の Word と、書いていれば表紙の Word を選びます', 'word'), opt('no', 'いいえ、ここから書き始める', '学籍番号・氏名・サブタイトルを順に案内します')],
    link: { lead: 'Word がいま手元にない人は ', b: 'あとで読み込む', small: '次にパソコンで開いたときに、もう一度聞きます' },
  },
  // パソコンで開いたとき（スマホで「あとで」を選んでいた）。ボタンは案A の形で見せる
  pc: {
    said: 'スマホで「あとで読み込む」を選んでいました。',
    opts: [
      opt('yes', 'はい、Word から読み込む', '本文の Word と、書いていれば表紙の Word を選びます', 'word'),
      opt('later', 'あとで読み込む', '次にパソコンで開いたときに、もう一度聞きます', 'clock'),
      opt('no', 'いいえ、Word では書いていない', 'もう聞きません（メニューからは、いつでも読み込めます）'),
    ],
    noSteps: true,
  },
}

async function openAtWord(browser, phone) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  if (phone) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await stubConfig(page, { courses: fixture.courses })
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'domcontentloaded', timeout: 300000 })
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 180000 })
  await page.evaluate(() => document.querySelector('.g-opts button').click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no', { timeout: 60000 })
  await page.addStyleTag({ content: CSS })
  await wait(800)
  return { context, page }
}

async function apply(page, plan) {
  await page.evaluate(
    (plan, CLOCK) => {
      const tip = document.querySelector('.g-tip')
      const opts = tip.querySelector('.g-opts')
      const wordSvg = opts.querySelector('.g-word-opt.yes svg').outerHTML
      opts.innerHTML = plan.opts
        .map((o) => `<button class="g-word-opt ${o.cls}">${o.icon === 'word' ? wordSvg : o.icon === 'clock' ? CLOCK : ''}<span>${o.title}<small>${o.small}</small></span></button>`)
        .join('')
      tip.querySelector('.v135-link')?.remove()
      tip.querySelector('.v135-said')?.remove()
      if (plan.link) opts.insertAdjacentHTML('afterend', `<button class="v135-link">${plan.link.lead}<b>${plan.link.b}</b><small>${plan.link.small}</small></button>`)
      if (plan.said) tip.querySelector('h2').insertAdjacentHTML('afterend', `<p class="v135-said">${plan.said}</p>`)
      if (plan.noSteps) tip.querySelector('.g-steps')?.remove()
      document.activeElement?.blur()
    },
    plan,
    CLOCK,
  )
  await wait(400)
}

async function shotTip(page, file, margin) {
  const box = await page.evaluate(() => {
    const r = document.querySelector('.g-tip').getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  })
  const vw = await page.evaluate(() => [innerWidth, innerHeight])
  const x = Math.max(0, box.x - margin)
  const y = Math.max(0, box.y - margin)
  await page.screenshot({ path: `${OUT}/screens/${file}`, clip: { x, y, width: Math.min(vw[0] - x, box.width + margin * 2), height: Math.min(vw[1] - y, box.height + margin * 2) } })
}

const PAGE_ONLY = process.argv.includes('--page-only')
try {
  await withEdge(async (browser) => {
    if (!PAGE_ONLY) {
    const { context, page } = await openAtWord(browser, true)
    for (const key of ['now', 'a', 'b', 'c']) {
      await apply(page, PLANS[key])
      await shotTip(page, `phone-${key}.png`, 8)
    }
    await context.close()
    const pc = await openAtWord(browser, false)
    await apply(pc.page, PLANS.pc)
    await shotTip(pc.page, 'pc-again.png', 24)
    await pc.context.close()
    }

    // 一覧のページを画像に
    const p = await browser.newPage()
    await p.setViewport({ width: 1640, height: 900, deviceScaleFactor: 1.5 })
    await p.goto(pathToFileURL(resolve(`${OUT}/index.html`)).href, { waitUntil: 'load' })
    await p.evaluate(() => document.fonts.ready)
    await wait(500)
    await p.screenshot({ path: `${OUT}/v135-word-later.png`, fullPage: true })
  })
} finally {
  server.close()
}
console.log(`${OUT}/v135-word-later.png`)
