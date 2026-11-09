// 管理ページの「コースごとの設定」：はじめはコースの一覧（1コース1行）。押すと、そのコースの設定の画面に入り、ほかのコースは出さない。
// 「‹ コースの一覧」で戻る（依頼者の選択 2026-11-07 案1。前は一覧の中でその場で広げていた）。
// この端末で最後に入っていたコースを覚えておき、次に開いたときは、そのコースの画面から始める（一覧に戻っていれば一覧から）。管理者の画面。
// 先生は担当のコースだけ（依頼者の判断 2026-11-09）：いつもそのコースの画面で、一覧はない
// これだけを流すときは node scripts/e2e/run.mjs adminCourseOpen
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(context, { teacher = false } = {}) {
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => void d.accept())
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html${teacher ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.side-nav')
  return page
}
const navTitles = (page) => page.evaluate(() => [...document.querySelectorAll('.side-nav li button')].map((b) => b.querySelector('.nt b')?.firstChild?.textContent.trim()))
const nav = async (page, title) => {
  await page.evaluate((title) => [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('.nt b')?.firstChild?.textContent.trim() === title).click(), title)
  await wait(300)
}
/** 今の見え方：区切りの見出し・一覧のコース・入っているコース（なければ null）・「‹ コースの一覧」があるか */
const state = (page) =>
  page.evaluate(() => ({
    head: document.querySelector('.content .sec-h')?.textContent ?? '',
    ids: [...document.querySelectorAll('.course-list .course')].map((c) => c.dataset.courseId),
    page: document.querySelector('.course.page')?.dataset.courseId ?? null,
    courses: document.querySelectorAll('.content .course').length,
    back: !!document.querySelector('.course-back'),
  }))
const reopen = async (page) => {
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.side-nav')
  await wait(300)
  if (!(await page.$('.course-list, .course.page'))) await nav(page, 'コースごとの設定')
}

await withEdge(async (browser) => {
  for (const teacher of [false, true]) {
    const who = teacher ? '先生' : '管理者'
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher })
    check(`${who}：左の見出しは「コース」ではなく「コースごとの設定」`, (await navTitles(page)).includes('コースごとの設定') && !(await navTitles(page)).includes('コース'), JSON.stringify(await navTitles(page)))
    await nav(page, 'コースごとの設定')
    let s = await state(page)
    if (teacher) {
      // 先生は担当のコースだけ（依頼者の判断 2026-11-09）：いつもそのコースの画面。一覧・「‹ コースの一覧」はない。読み込み直しても同じ
      check('先生：担当のコースの画面がいつも開いている（コースの一覧・「‹ コースの一覧」はない）', s.page === 'film-stage-costume' && s.courses === 1 && s.ids.length === 0 && !s.back, JSON.stringify(s))
      await reopen(page)
      s = await state(page)
      check('先生：読み込み直しても、担当のコースの画面', s.page === 'film-stage-costume' && !s.back, JSON.stringify(s))
      await context.close()
      continue
    }
    check(`${who}：はじめはコースの一覧（見出しは「コースごとの設定」。どのコースにも入っていない）`, s.head === 'コースごとの設定' && s.ids.length >= 1 && s.page === null && !s.back, JSON.stringify(s))
    // コースを押す → そのコースの画面（見出しはコース名。ほかのコースは出さない。上に「‹ コースの一覧」）
    const last = s.ids.at(-1)
    const name = await page.evaluate((id) => document.querySelector(`.course[data-course-id="${id}"] .cname`).textContent, last)
    await page.evaluate((id) => document.querySelector(`.course[data-course-id="${id}"] .open-btn`).click(), last)
    await wait(300)
    s = await state(page)
    check(`${who}：コースを押すと、そのコースの画面に入る（見出しはコース名・ほかのコースは出さない・上に「‹ コースの一覧」）`, s.page === last && s.head === name && s.courses === 1 && s.ids.length === 0 && s.back, JSON.stringify({ ...s, name }))
    // 読み込み直す → そのコースの画面から始まる
    await reopen(page)
    s = await state(page)
    check(`${who}：入っていたコースを覚えていて、次に開くと、そのコースの画面から始まる`, s.page === last && s.head === name, JSON.stringify(s))
    // 「‹ コースの一覧」で戻る → 一覧。読み込み直しても一覧のまま
    await page.click('.course-back')
    await wait(300)
    s = await state(page)
    check(`${who}：「‹ コースの一覧」で一覧に戻る`, s.page === null && s.head === 'コースごとの設定' && s.ids.includes(last), JSON.stringify(s))
    await reopen(page)
    s = await state(page)
    check(`${who}：一覧に戻ってから読み込み直すと、一覧から始まる`, s.page === null && s.head === 'コースごとの設定', JSON.stringify(s))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
