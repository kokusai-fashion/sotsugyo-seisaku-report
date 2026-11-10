// 「Word で書き始めていますか？」の「あとで読み込む」（依頼者の選択 2026-11-10 mockups/v135 案A）。これだけを流すときは node scripts/e2e/run.mjs wordLater1110
// - 教室ではスマホで登録だけを済ませ、Word はあとでパソコンから読み込む学生のため。「はい」と「いいえ」の間に「あとで読み込む」。
//   押すと原稿に印がつき、案内は学籍番号・氏名…へ進む。スマホで開き直しても聞かない。パソコンで開くと、同じ質問をもう一度だけ聞く
//   （段階の並びは出さず「前に「あとで読み込む」を選んでいました。」）。「あとで」ならまた次に、「いいえ」なら印を外して、もう聞かない
// - あわせて：所属（制作グループなど）が、開き直しても残る（前は原稿を読み込むときに落ちていて、また選ばされていた）
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/wordLater1110'
mkdirSync(OUT, { recursive: true })
const FILM = 'film-stage-costume'
const GROUPS = ['①グループ', '②グループ']
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const fixture = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

/** 同じ端末（同じ保存場所）で、スマホ・パソコンの画面として開く。前に開いたページは閉じておく（別のタブで開いている、にしない） */
async function open(context, phone) {
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  if (phone) {
    await page.setUserAgent(PHONE_UA)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  } else await page.setViewport({ width: 1366, height: 900 })
  await stubConfig(page, { courses: fixture.courses.map((c) => (c.id === FILM ? { ...c, groups: GROUPS } : c)) })
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await wait(1200)
  return page
}
const guideState = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('.guide')
    return {
      step: g ? [...g.classList].find((c) => c.startsWith('step-')) ?? '' : '',
      // ボタンの言葉（下の小さな説明は除く）
      opts: [...(g?.querySelectorAll('.g-opts button') ?? [])].map((b) => (b.querySelector('span')?.firstChild ?? b).textContent.trim()),
      steps: !!g?.querySelector('.g-steps'),
      said: g?.querySelector('.g-said')?.textContent ?? '',
    }
  })
const wordLater = (page) => page.evaluate(() => window.__editor.getSnapshot().report.wordLater === true)

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()

  // ---- スマホ：はじめて開く → コース → 「あとで読み込む」 ----
  let page = await open(context, true)
  await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
  await page.evaluate((id) => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画・舞台衣装')).click(), FILM)
  await page.waitForSelector('.guide.step-word .g-word-opt.later', { timeout: 20000 })
  let g = await guideState(page)
  check('スマホ：Word の質問に「はい」「あとで読み込む」「いいえ」の3つ', JSON.stringify(g.opts) === JSON.stringify(['はい、Word から読み込む', 'あとで読み込む', 'いいえ、ここから書き始める']), g.opts.join(' / '))
  await page.screenshot({ path: `${OUT}/1-phone-word.png` })
  await page.evaluate(() => document.querySelector('.g-word-opt.later').click())
  await wait(800)
  g = await guideState(page)
  check('「あとで読み込む」を押すと、表紙の項目の案内へ進む', g.step === 'step-studentId', g.step)
  check('原稿に「あとで」の印がつく', await wordLater(page))
  check('印をつけても「戻す」は押せないまま（コースを選んだばかり）', !(await page.evaluate(() => window.__editor.getSnapshot().canUndo)))
  // 表紙の項目は、ここでは API で入れる（案内は閉じる）
  await page.evaluate(() => document.querySelector('.guide .g-later').click())
  await wait(300)
  await page.evaluate(() => {
    const ed = window.__editor
    ed.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', subtitleInput: 'パリス' } }))
    ed.setNameParts({ familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' })
    ed.setGroup('②グループ')
  })
  await wait(2500)
  await page.close()

  // ---- スマホで開き直す：聞かない。所属も残っている ----
  page = await open(context, true)
  g = await guideState(page)
  check('スマホで開き直しても、Word の質問は出ない', g.step !== 'step-word', g.step || '案内なし')
  check('開き直しても所属が残っていて、所属を聞かれない', (await page.evaluate(() => window.__editor.getSnapshot().report.basicInfo.group)) === '②グループ' && g.step !== 'step-group', g.step || '案内なし')
  await page.close()

  // ---- パソコンで開く：もう一度だけ聞く ----
  page = await open(context, false)
  g = await guideState(page)
  check('パソコンで開くと、Word の質問がもう一度出る', g.step === 'step-word', g.step || '案内なし')
  check('もう一度のときは段階の並びを出さず、「前に「あとで読み込む」を選んでいました。」', !g.steps && g.said === '前に「あとで読み込む」を選んでいました。', g.said)
  check('もう一度のときの「いいえ」は「いいえ、Word では書いていない」', g.opts[2] === 'いいえ、Word では書いていない', g.opts.join(' / '))
  await page.screenshot({ path: `${OUT}/2-pc-again.png` })
  // 「はい」は Word を選ぶ窓を開く（閉じると質問に戻る）
  await page.evaluate(() => document.querySelector('.g-word-opt.yes').click())
  await wait(600)
  check('「はい」で Word を読み込む窓が開く', await page.evaluate(() => !!document.querySelector('.modal input[type=file], .modal [accept*="docx"]') || [...document.querySelectorAll('.modal h2')].some((h) => h.textContent.includes('Word'))))
  await page.keyboard.press('Escape')
  await wait(600)
  // 「あとで読み込む」：閉じる。印はそのまま
  await page.evaluate(() => document.querySelector('.g-word-opt.later')?.click())
  await wait(800)
  g = await guideState(page)
  check('もう一度のときの「あとで読み込む」で案内が閉じ、印はそのまま', !g.step && (await wordLater(page)), g.step || '案内なし')
  await page.close()

  page = await open(context, false)
  g = await guideState(page)
  check('「あとで」なら、次にパソコンで開いたときにまた聞く', g.step === 'step-word', g.step || '案内なし')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await wait(800)
  g = await guideState(page)
  check('「いいえ」で案内が閉じ、印が外れる', !g.step && !(await wordLater(page)), g.step || '案内なし')
  await wait(2000)
  await page.close()

  page = await open(context, false)
  g = await guideState(page)
  check('「いいえ」のあとは、パソコンで開いても聞かない', g.step !== 'step-word', g.step || '案内なし')
  await page.close()
  await context.close()

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
