// サブタイトルを使わないコース（プロジャの先生の依頼から。依頼者の選択 2026-11-09：先生も切り替えられる）。これだけを流すときは node scripts/e2e/run.mjs noSubtitle1109
// - 学生：使わないコースは、最初の案内にサブタイトルの段がなく、氏名のあと「表紙の入力が終わりました」へ。表紙にサブタイトルの行がなく、抄録は空けたまま。未入力の指摘もない
// - 管理ページ：コースの「サブタイトル」の欄に「使う・使わない」のスイッチ。管理者も先生も切り替えて保存できる。前後の文字の欄は、管理者が「使う」にしているときだけ
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/noSubtitle1109'
mkdirSync(OUT, { recursive: true })
const FILM = 'film-stage-costume'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const fixture = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))

/** 学生のツールを、はじめての人として開く（1つ目のコースはサブタイトルを使わない） */
async function openStudent(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.evaluateOnNewDocument(() => {
    try {
      for (const k of ['tour', 'zoom-tip', 'pinch-tip', 'tablet-tip', 'land-tip', 'tap-hint']) localStorage.setItem(`sotsugyo-seisaku-report-${k}`, 'done')
    } catch {}
  })
  await page.setViewport({ width: 1366, height: 900 })
  await stubConfig(page, { courses: fixture.courses.map((c, i) => (i === 0 ? { ...c, noSubtitle: true } : c)) })
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  return { context, page, ready }
}

/** 管理ページを開き（試験用サーバーの保存を消してから）、映画・舞台衣装デザイナー コースを開く */
async function openAdmin(browser, teacher) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => void d.accept())
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html${teacher ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    for (const key of ['sotsugyo-admin-mock', 'sotsugyo-admin-mock-order', 'sotsugyo-admin-mock-checksheets']) localStorage.removeItem(key)
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
  await wait(400)
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定')).click())
  await wait(400)
  await page.evaluate((id) => {
    const c = document.querySelector(`.course[data-course-id="${id}"]`)
    if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
  }, FILM)
  await page.waitForSelector(`.course.open[data-course-id="${FILM}"] #c-${FILM}-subtitle-use`)
  await wait(200)
  return { context, page }
}
/** 開いたコースの「サブタイトル」の欄の様子 */
const subtitleRow = (page) =>
  page.evaluate((id) => {
    const course = document.querySelector('.course.open')
    const lb = [...course.querySelectorAll('.lb')].find((l) => l.firstChild.textContent === 'サブタイトル')
    const ctl = lb?.nextElementSibling
    const input = ctl?.querySelector(`#c-${id}-subtitle-use`)
    return {
      label: input?.closest('label')?.textContent.trim() ?? '',
      on: input?.checked ?? null,
      fields: ctl ? ctl.querySelectorAll('.template input').length : -1,
      hint: ctl?.querySelector('.hint')?.textContent ?? '',
      changed: !!lb?.querySelector('.chg'),
      bar: document.querySelector('.dirty-bar .tx span')?.textContent ?? '',
    }
  }, FILM)
async function save(page) {
  await page.evaluate(() => [...document.querySelectorAll('.save-group button, .dirty-bar button')].find((b) => b.offsetParent !== null && !b.disabled && b.textContent.includes('保存'))?.click())
  const modal = await page.waitForSelector('.confirm-modal', { timeout: 3000 }).catch(() => null)
  if (modal) await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="ok"]').click())
  await page.waitForFunction(() => !document.querySelector('.dirty-bar') && !document.querySelector('.confirm-modal'), { timeout: 10000 })
  await wait(300)
}
const savedNoSubtitle = (page) => page.evaluate((id) => JSON.parse(localStorage.getItem('sotsugyo-admin-mock')).years[0].config.courses.find((c) => c.id === id).noSubtitle ?? null, FILM)

await withEdge(async (browser) => {
  // ---- 学生：最初の案内にサブタイトルの段がない ----
  {
    const { context, page, ready } = await openStudent(browser)
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => document.querySelector('.g-opts button').click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    const steps = await page.evaluate(() => document.querySelector('.g-steps')?.textContent ?? '')
    check('使わないコースを選ぶと、案内の段階にサブタイトルがない（1 コース 2 Word 3 学籍番号 4 氏名 …）', steps.includes('4 氏名') && !steps.includes('サブタイトル'), steps)
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:studentId', { timeout: 30000 })
    await page.keyboard.type('00ZZ0123')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 30000 })
    for (const t of ['文化', '花子', 'ぶんか', 'ハナコ']) {
      await page.keyboard.type(t)
      await page.keyboard.press('Enter')
    }
    const done = await page.waitForSelector('.guide.step-done', { timeout: 20000 }).catch(() => null)
    const editing = await page.evaluate(() => window.__editor.getSnapshot().editingId)
    check('氏名のあと、サブタイトルを聞かずに「終わりました」の段へ', !!done && editing !== 'basic:subtitleInput', String(editing))
    await page.screenshot({ path: `${OUT}/1-guide-done.png` })
    await page.evaluate(() => [...document.querySelectorAll('.g-actions button')].find((b) => b.textContent.includes('閉じる')).click())
    await ready()
    await page.evaluate(() => window.__editor.goToPage(0, 'none'))
    await wait(500)
    await ready()
    const cover = await page.evaluate(() => {
      // 表紙の紙面だけを見る（紙面の箱には、隣の抄録のページも入っていることがある）
      const front = document.querySelector('.page-viewport.front section.cover')
      return { subtitle: !!front.querySelector('.el.subtitle'), rule: !!front.querySelector('.subtitle-rule'), department: !!front.querySelector('.el.department') }
    })
    check('表紙にサブタイトルの行と下線がない（ほかの部品はある）', !cover.subtitle && !cover.rule && cover.department, JSON.stringify(cover))
    await page.screenshot({ path: `${OUT}/2-cover.png` })
    const findings = await page.evaluate(() => window.__editor.getSnapshot().findings.filter((f) => f.blockId === 'basic:subtitleInput' || f.ruleId === 'required-field').map((f) => f.ruleId))
    check('サブタイトルの未入力の指摘がない', findings.length === 0, JSON.stringify(findings))
    await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.indexOf('abstract'), 'none'))
    await wait(500)
    await ready()
    const abs = await page.evaluate(() => {
      const el = document.querySelector('.page-viewport.front section.abstract .el.subtitle')
      return el ? { text: el.textContent.trim(), height: el.getBoundingClientRect().height } : null
    })
    check('抄録のサブタイトルの行は、空けたまま残る（本文の位置は変わらない）', !!abs && abs.text === '' && abs.height > 5, JSON.stringify(abs))
    await page.screenshot({ path: `${OUT}/3-abstract.png` })
    await context.close()
  }

  // ---- 管理ページ：管理者・先生がスイッチで切り替えて保存できる ----
  for (const teacher of [false, true]) {
    const who = teacher ? '先生' : '管理者'
    const { context, page } = await openAdmin(browser, teacher)
    let s = await subtitleRow(page)
    check(
      `${who}：「サブタイトル」の欄に「表紙と抄録にサブタイトルを入れる」のスイッチ（はじめは使う）。前後の文字の欄は${teacher ? 'なく、形式だけ見える' : 'ある'}`,
      s.label === '表紙と抄録にサブタイトルを入れる' && s.on === true && (teacher ? s.fields === 0 && s.hint.includes('管理者に頼んでください') : s.fields === 2 && s.hint.startsWith('例：')),
      JSON.stringify(s),
    )
    await page.screenshot({ path: `${OUT}/${teacher ? 5 : 4}-${teacher ? 'teacher' : 'admin'}-on.png` })
    await page.evaluate((id) => document.querySelector(`#c-${id}-subtitle-use`).click(), FILM)
    await wait(200)
    s = await subtitleRow(page)
    check(`${who}：切ると前後の文字の欄が消え、説明と「変更あり」、帯に「サブタイトルを使うか」`, s.on === false && s.fields === 0 && s.hint === '表紙と抄録にサブタイトルの行を出しません。学生も入力しません' && s.changed && s.bar.includes('サブタイトルを使うか'), JSON.stringify(s))
    await page.screenshot({ path: `${OUT}/${teacher ? 7 : 6}-${teacher ? 'teacher' : 'admin'}-off.png` })
    await save(page)
    check(`${who}：保存すると、試験用サーバーに「使わない」が残る`, (await savedNoSubtitle(page)) === true)
    await page.evaluate((id) => document.querySelector(`#c-${id}-subtitle-use`).click(), FILM)
    await wait(200)
    await save(page)
    check(`${who}：「使う」に戻して保存すると、項目ごと消える`, (await savedNoSubtitle(page)) === null)
    await context.close()
  }
  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
