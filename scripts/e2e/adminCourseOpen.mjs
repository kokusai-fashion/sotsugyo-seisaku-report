// 管理ページの「コースごとの設定」（前の「コース」。依頼者の要望 2026-11-02）：はじめはどのコースも閉じたまま。
// この端末で最後に開いていたコースを覚えておき、次に開いたときは、そのコースを開いた形で始める（閉じていれば閉じたまま）。管理者・先生の画面とも
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
const navTitles = (page) => page.evaluate(() => [...document.querySelectorAll('.side-nav button')].map((b) => b.querySelector('.nt b')?.firstChild?.textContent.trim()))
const nav = async (page, title) => {
  await page.evaluate((title) => [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('.nt b')?.firstChild?.textContent.trim() === title).click(), title)
  await wait(300)
}
/** 開いているコースの名前（閉じていれば null）と、コースの数 */
const courses = (page) => page.evaluate(() => ({ open: [...document.querySelectorAll('.course.open')].map((c) => c.querySelector('.cname, input')?.textContent || c.querySelector('input')?.value || c.dataset.courseId), ids: [...document.querySelectorAll('.course')].map((c) => c.dataset.courseId), openIds: [...document.querySelectorAll('.course.open')].map((c) => c.dataset.courseId) }))
const toggle = async (page, id) => {
  await page.evaluate((id) => document.querySelector(`.course[data-course-id="${id}"] .open-btn`).click(), id)
  await wait(300)
}
const reopen = async (page) => {
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.side-nav')
  await wait(300)
}

await withEdge(async (browser) => {
  for (const teacher of [false, true]) {
    const who = teacher ? '先生' : '管理者'
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher })
    check(`${who}：左の見出しは「コース」ではなく「コースごとの設定」`, (await navTitles(page)).includes('コースごとの設定') && !(await navTitles(page)).includes('コース'), JSON.stringify(await navTitles(page)))
    await nav(page, 'コースごとの設定')
    const head = await page.evaluate(() => document.querySelector('.content .sec-h')?.textContent ?? '')
    let c = await courses(page)
    check(`${who}：区切りの見出しも「コースごとの設定」。はじめは、どのコースも閉じている（いちばん上も開かない）`, head === 'コースごとの設定' && c.ids.length >= 1 && c.openIds.length === 0, JSON.stringify({ head, c }))
    // コースを開いて、読み込み直す → そのコースが開いた形で始まる（試験用の設定のコースは、いちばん下のもの）
    const second = c.ids.at(-1)
    await toggle(page, second)
    await reopen(page)
    if ((await page.evaluate(() => document.querySelector('.content .sec-h')?.textContent)) !== 'コースごとの設定') await nav(page, 'コースごとの設定')
    c = await courses(page)
    check(`${who}：開いていたコースを覚えていて、次に開くと、そのコースが開いた形で始まる`, c.openIds.join() === second, JSON.stringify(c))
    // 閉じて、読み込み直す → 閉じたまま
    await toggle(page, second)
    await reopen(page)
    if ((await page.evaluate(() => document.querySelector('.content .sec-h')?.textContent)) !== 'コースごとの設定') await nav(page, 'コースごとの設定')
    c = await courses(page)
    check(`${who}：閉じてから読み込み直すと、閉じたまま始まる`, c.openIds.length === 0, JSON.stringify(c))
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
