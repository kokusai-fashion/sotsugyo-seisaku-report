// 管理ページの「点検表」の画面と、先生の「氏名と担当コース」（依頼者の判断 2026-11-09 mockups/v126）。これだけを流すときは node scripts/e2e/run.mjs checkView1109
// - 先生：まだ登録していなければ、開いたときに「氏名と担当コース」の窓（閉じられない）。指導教員の名前を押して登録する。担当のコースは1つだけ
// - 先生は担当のコースだけ（コースごとの設定は、そのコースを開いたまま。一覧・「‹ コースの一覧」はない。ほかのコースはサーバーでも断る）
// - 左の見出しのいちばん上に「点検表」。表・カード・担当の目線、範囲（自分の担当・コース全体）、所属。札を押すと「済み」⇄「予定」
// - 担当の割り振り：1回ずつずらして埋める → 点検表に入れる。並び順で等分するコースは 1班〜
// - ?view=check のリンクで、点検表から開く（スマホも、一覧でなく中身から）
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/checkView1109'
mkdirSync(OUT, { recursive: true })
const FILM = 'film-stage-costume'
const SPLIT = 'course-muv5jgwd'
const GROUPS = ['①グループ', '②グループ', '③グループ']
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const fixture = JSON.parse(readFileSync(new URL('./config-fixture.json', import.meta.url), 'utf8'))
const config = { ...fixture, courses: fixture.courses.map((c) => (c.id === FILM ? { ...c, groups: GROUPS } : c.id === SPLIT ? { ...c, checkSplit: 3 } : c)) }

/** 試験用サーバーの保存を、所属のあるコース・3等分のコースの年度にしてから開く */
async function open(browser, query, viewport = { width: 1440, height: 900 }, { keep = false } = {}) {
  const context = keep ? null : await browser.createBrowserContext()
  const page = keep ? keep : await context.newPage()
  if (!keep) {
    page.on('pageerror', (e) => console.log('pageerror:', e.message))
    page.on('dialog', (d) => void d.accept())
    await page.setViewport(viewport)
    await page.goto(`${APP}/admin.html?${query}`, { waitUntil: 'networkidle0' })
    await page.evaluate((config) => {
      for (const key of Object.keys(localStorage)) if (key.startsWith('sotsugyo-admin')) localStorage.removeItem(key)
      sessionStorage.clear()
      localStorage.setItem('sotsugyo-admin-mock', JSON.stringify({ years: [{ year: config.fiscalYear, status: '公開中', config, updatedAt: new Date().toISOString(), updatedBy: 'admin@example.ac.jp' }], history: [] }))
    }, config)
  }
  await page.goto(`${APP}/admin.html?${query}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button, .profile-modal', { timeout: 30000 })
  await wait(400)
  return { context, page }
}
const nav = (page, title) => page.evaluate((t) => [...document.querySelectorAll('.side-nav button')].find((b) => b.querySelector('b')?.firstChild?.textContent === t).click(), title)
const navState = (page) =>
  page.evaluate(() => ({
    first: document.querySelector('.side-nav button b')?.firstChild?.textContent ?? '',
    current: document.querySelector('.side-nav button[aria-current="page"] b')?.firstChild?.textContent ?? '',
    me: document.querySelector('.side-nav .me')?.textContent ?? '',
  }))
const click = (page, selector, text) =>
  page.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find((b) => !text || b.textContent.trim().includes(text))
      if (!el) throw new Error(`見つからない：${selector} ${text ?? ''}`)
      el.click()
    },
    selector,
    text,
  )
/** 表の行（学生ごと：氏名・回の札） */
const tableRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.ck-ta:not(.assign) tbody tr')].map((tr) =>
      tr.classList.contains('gh') ? `#${tr.textContent}` : `${tr.querySelector('.nm')?.textContent}:${[...tr.querySelectorAll('td')].slice(3, 8).map((td) => td.textContent.trim()).join(',')}`,
    ),
  )
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })

await withEdge(async (browser) => {
  // ---- 先生（まだ登録していない） ----
  {
    const { context, page } = await open(browser, 'as=teacher&profile=none')
    await page.waitForSelector('.profile-modal', { timeout: 10000 })
    const dlg = await page.evaluate(() => {
      const m = document.querySelector('.profile-modal')
      return {
        close: !!m.querySelector('.close'),
        lead: m.querySelector('.lead').textContent,
        options: [...m.querySelectorAll('.pf-list button')].map((b) => `${b.querySelector('b').textContent}/${b.querySelector('small').textContent}`),
        save: m.querySelector('.btn.primary').disabled,
        cancel: [...m.querySelectorAll('.btn')].some((b) => b.textContent.trim() === 'やめる'),
      }
    })
    check('まだ登録していない先生は、開いたときに「氏名と担当コース」の窓（×・やめるがない）', !dlg.close && !dlg.cancel && dlg.lead.includes('はじめに'), JSON.stringify(dlg.lead))
    check('指導教員の名前が、コースと一緒に並ぶ（3コース×3人）', dlg.options.length === 9 && dlg.options[0] === '梶田　貴子/映画・舞台衣装デザイナー コース', dlg.options.slice(0, 4).join(' | '))
    check('名前を押すまで「登録する」は押せない', dlg.save)
    await page.keyboard.press('Escape')
    await wait(300)
    check('Esc でも閉じない', !!(await page.$('.profile-modal')))
    await click(page, '.pf-list button', '梶田')
    await wait(200)
    await shot(page, '01-profile-dialog')
    // 一覧にないとき：氏名を入れてコースを1つ（選べるのは1つだけ）
    await click(page, '.pf-other', '一覧に名前がない')
    await wait(200)
    const typed = await page.evaluate(() => {
      const sel = document.querySelector('.profile-modal select')
      return { multiple: sel.multiple, options: sel.options.length }
    })
    check('一覧にないときは、氏名とコース1つ（複数は選べない）', !typed.multiple && typed.options === 4, JSON.stringify(typed))
    await click(page, '.pf-other', '一覧から選ぶ')
    await wait(200)
    await click(page, '.pf-list button', '梶田')
    await click(page, '.profile-modal .btn.primary')
    await page.waitForFunction(() => !document.querySelector('.profile-modal'), { timeout: 10000 })
    await wait(300)
    let n = await navState(page)
    check('登録すると窓が閉じ、左下に氏名と担当コース', n.me.includes('梶田　貴子') && n.me.includes('担当：映画・舞台衣装デザイナー コース'), n.me)
    const msg = await page.evaluate(() => document.querySelector('.message.ok')?.textContent ?? '')
    check('「氏名と担当コースを登録しました」と知らせる', msg.includes('氏名と担当コースを登録しました') && msg.includes('梶田　貴子'), msg)
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sotsugyo-admin-mock')).members.find((m) => m.role === '先生'))
    check('サーバーに氏名と担当コースが入る', saved.name === '梶田　貴子' && saved.courseId === 'film-stage-costume', JSON.stringify(saved))
    check('左の見出しのいちばん上は「点検表」', n.first === '点検表', n.first)

    // コースごとの設定：担当のコースだけ
    await nav(page, 'コースごとの設定')
    await wait(400)
    const cs = await page.evaluate(() => ({
      courses: [...document.querySelectorAll('.course')].map((c) => c.dataset.courseId),
      open: !!document.querySelector('.course.open'),
      back: !!document.querySelector('.course-back'),
      list: !!document.querySelector('.course-list'),
    }))
    check('先生のコースごとの設定は、担当のコースを開いたまま（一覧・「‹ コースの一覧」はない）', cs.courses.join() === FILM && cs.open && !cs.back && !cs.list, JSON.stringify(cs))
    const denied = await page.evaluate((id) => window.__adminServer.getCheckView(2026, id).then(() => 'ok', (e) => e.message), SPLIT)
    check('ほかのコースの点検表は、サーバーでも断る', denied.includes('担当のコースだけ'), denied)

    // 点検表：まだ作っていない → 作る
    await nav(page, '点検表')
    await page.waitForSelector('.ck', { timeout: 10000 })
    await wait(500)
    const before = await page.evaluate(() => ({ text: document.querySelector('.ck').textContent, course: document.querySelector('.ck-course')?.tagName }))
    check('まだ点検表がなければ「点検表を作る」。コースは選べない（担当のコースだけ）', before.text.includes('点検表を作る') && before.course === 'SPAN', before.course)
    await click(page, '.ck .btn.primary', '点検表を作る')
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    await wait(300)
    let rows = await tableRows(page)
    check('作ると表が出る（所属ごとの見出し・学生の行）', rows.filter((r) => r.startsWith('#')).length >= 3 && rows.filter((r) => !r.startsWith('#')).length >= 8, `${rows.length}行`)
    const filt = await page.evaluate(() => [...document.querySelectorAll('.ck-filter .ck-chips button')].map((b) => `${b.textContent}${b.classList.contains('on') ? '*' : ''}`))
    check('まだ割り振っていなければ、範囲は「コース全体」から', filt.includes('コース全体*') && filt.includes('自分の担当（梶田）'), filt.join('|'))

    // 担当の割り振り
    await click(page, '.ck-btn', '担当の割り振り')
    await page.waitForSelector('.ck-ta.assign', { timeout: 5000 })
    const teachers = ['梶田', '佐藤', '加藤']
    for (let g = 0; g < 3; g++) await page.select(`.ck-ta.assign tbody tr:nth-child(${g + 1}) td:nth-child(2) select`, teachers[g])
    await click(page, '.ck-asfoot .btn, .ck-ta + * .btn, .btn', '1回ずつずらして埋める')
    await wait(200)
    const grid = await page.evaluate(() => [...document.querySelectorAll('.ck-ta.assign tbody tr')].map((tr) => [...tr.querySelectorAll('select')].map((s) => s.value).join(',')))
    check('「1回ずつずらして埋める」で、2回目から1つずつずれる', grid[0].startsWith('梶田,加藤,佐藤') && grid[1].startsWith('佐藤,梶田,加藤') && grid[2].startsWith('加藤,佐藤,梶田'), grid.join(' / '))
    await shot(page, '02-assign')
    await click(page, '.btn', '点検表に入れる')
    await page.waitForFunction(() => document.querySelector('.ck-asmsg')?.textContent.includes('点検表に入れました'), { timeout: 10000 })
    await click(page, '.ck-btn', '点検にもどる')
    await page.waitForSelector('.ck-ta:not(.assign)', { timeout: 5000 })
    await wait(300)
    rows = await tableRows(page)
    const firstStudent = rows.find((r) => !r.startsWith('#'))
    check('点検表に「名字 予定」が入る（①グループの1回目は梶田）', firstStudent.includes('梶田 予定'), firstStudent)

    // 札を押すと「済み」
    await click(page, '.ck-ta:not(.assign) tbody button.ck-chip', '梶田 予定')
    await page.waitForFunction(() => [...document.querySelectorAll('.ck-ta tbody button.ck-chip')].some((b) => b.textContent === '梶田 済み'), { timeout: 10000 })
    const cells = await page.evaluate(() => JSON.parse(localStorage.getItem('sotsugyo-admin-mock-checkcells')))
    check('札を押すと「済み」になり、点検表にも入る', JSON.stringify(cells).includes('梶田 済み'))
    // 範囲：自分の担当に絞る
    await click(page, '.ck-filter .ck-chips button', '自分の担当')
    await wait(200)
    const mineRows = (await tableRows(page)).filter((r) => !r.startsWith('#'))
    check('「自分の担当」で、梶田が入っている学生だけ', mineRows.length > 0 && mineRows.every((r) => r.includes('梶田')), `${mineRows.length}人`)
    await click(page, '.ck-filter .ck-chips button', 'コース全体')
    await wait(200)
    await shot(page, '03-table')

    // カード：押すと右に記録
    await click(page, '.ck-vseg button', 'カード')
    await page.waitForSelector('.ck-card', { timeout: 5000 })
    await click(page, '.ck-card')
    await page.waitForSelector('.ck-panel', { timeout: 5000 })
    await page.evaluate(() => document.querySelector('.ck-panel .ck-tog').click())
    await page.waitForFunction(() => document.querySelector('.ck-panel .ck-tog')?.classList.contains('on'), { timeout: 10000 })
    check('カードを押すと右に記録。許可の切り替えも入る', true)
    // 札の形の選ぶ欄（mockups/v127 案A）：2回目の先生を佐藤に替える（予定のまま）。名前は1回だけ
    await page.select('.ck-panel select[aria-label="2回目の先生"]', '佐藤')
    await page.waitForFunction(() => document.querySelector('.ck-panel select[aria-label="2回目の先生"]')?.closest('.ck-pchip').querySelector('.t')?.textContent === '佐藤 予定', { timeout: 10000 })
    const prow = await page.evaluate(() => ({ chips: document.querySelectorAll('.ck-panel .ck-prow .ck-chip').length, text: document.querySelector('.ck-panel select[aria-label="2回目の先生"]').closest('.ck-prow').textContent }))
    check('右の欄の回は、札の形の選ぶ欄とボタンだけ（名前は1回）。札から先生を替えられる', prow.chips === 0 && prow.text.includes('佐藤 予定') && prow.text.includes('済みにする'), JSON.stringify(prow))
    await shot(page, '04-card')

    // 担当の目線：前の回の残りは「まだの分」
    await click(page, '.ck-vseg button', '担当の目線')
    await page.waitForSelector('.ck-tabs', { timeout: 5000 })
    await click(page, '.ck-filter .ck-chips button', '自分の担当')
    await wait(300)
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.ck-tabs button')].map((b) => b.textContent))
    const tabsOverflow = await page.evaluate(() => { const t = document.querySelector('.ck-tabs'); return t.scrollHeight - t.clientHeight })
    check('担当の目線のタブに、縦のスクロールの線が出ない', tabsOverflow <= 0 || (await page.evaluate(() => getComputedStyle(document.querySelector('.ck-tabs')).overflowY)) === 'hidden', String(tabsOverflow))
    check('担当の目線（自分の担当）：「まだの分」（始まった回の残り）と回ごとのタブ', tabs[0].startsWith('まだの分') && tabs.length === 1 + 5, tabs.join('|'))
    await shot(page, '05-mine')

    // この画面のリンク
    await click(page, '.ck-btn', 'この画面のリンク')
    await wait(200)
    const link = await page.evaluate(() => document.querySelector('.ck-pop code')?.textContent ?? '')
    check('「この画面のリンク」に、点検表に直接入るアドレス', link.includes('admin.html?view=check'), link)

    // 左下から直す（このときは閉じられる）
    await click(page, '.side-nav .profile-link')
    await page.waitForSelector('.profile-modal', { timeout: 5000 })
    const again = await page.evaluate(() => ({ close: !!document.querySelector('.profile-modal .close'), on: document.querySelector('.pf-list button.on b')?.textContent ?? '' }))
    check('左下の「氏名と担当コース」から開き直せる（いまの登録が選ばれ、閉じられる）', again.close && again.on === '梶田　貴子', JSON.stringify(again))
    // 半角の空白の名前（深沢 祥代）を選んで登録しても、開き直すと一覧で選ばれている（2026-11-09 の点検）
    await click(page, '.pf-list button', '深沢')
    await click(page, '.profile-modal .btn.primary')
    await page.waitForFunction(() => !document.querySelector('.profile-modal'), { timeout: 10000 })
    await click(page, '.side-nav .profile-link')
    await page.waitForSelector('.profile-modal', { timeout: 5000 })
    const reopened = await page.evaluate(() => ({ on: document.querySelector('.pf-list button.on b')?.textContent ?? '', typing: !!document.querySelector('.profile-modal input') }))
    check('半角の空白の名前で登録しても、開き直すと一覧で選ばれている', reopened.on === '深沢　祥代' && !reopened.typing, JSON.stringify(reopened))
    // 元の担当に戻す
    await click(page, '.pf-list button', '梶田')
    await click(page, '.profile-modal .btn.primary')
    await page.waitForFunction(() => !document.querySelector('.profile-modal'), { timeout: 10000 })
    await wait(300)

    // ?view=check で開く
    await page.goto(`${APP}/admin.html?as=teacher&view=check`, { waitUntil: 'networkidle0' })
    await page.evaluate(() => sessionStorage.clear())
    await page.goto(`${APP}/admin.html?as=teacher&view=check`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.ck', { timeout: 10000 })
    n = await navState(page)
    check('?view=check のリンクで開くと、点検表から', n.current === '点検表', n.current)
    await context.close()
  }

  // ---- 先生（スマホで ?view=check） ----
  {
    const { context, page } = await open(browser, 'as=teacher&view=check', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await page.waitForSelector('.ck', { timeout: 10000 })
    await wait(400)
    const ph = await page.evaluate(() => ({ list: document.querySelector('.admin').classList.contains('phone-list'), wide: document.documentElement.scrollWidth }))
    check('スマホで ?view=check から開くと、一覧でなく点検表の中身から（横にはみ出さない）', !ph.list && ph.wide <= 390, JSON.stringify(ph))
    await click(page, '.ck .btn.primary', '点検表を作る')
    await page.waitForSelector('.ck-tabs, .ck-ta', { timeout: 10000 })
    await wait(300)
    const mode = await page.evaluate(() => document.querySelector('.ck-vseg button.on')?.getAttribute('aria-pressed') && [...document.querySelectorAll('.ck-vseg button')].findIndex((b) => b.classList.contains('on')))
    check('スマホのはじめの見せ方は「担当の目線」', mode === 2, String(mode))
    // 割り振って1人済みにしてから、スマホの担当の目線（写真）
    await page.evaluate(async (film) => {
      const sv = window.__adminServer
      const v = await sv.getCheckView(2026, film)
      const t = ['梶田', '佐藤', '加藤']
      const rows = Object.fromEntries(v.groups.map((g, i) => [g, v.rounds.map((_, r) => t[(((i - r) % 3) + 3) % 3])]))
      const next = await sv.saveAssignment(2026, film, { labels: v.rounds, rows })
      await sv.setCheckCell(2026, film, next.students[0].key, { round: v.rounds[0], teacher: '梶田', state: 'done' })
    }, FILM)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.ck-tabs', { timeout: 10000 })
    await wait(500)
    const phoneTabs = await page.evaluate(() => [...document.querySelectorAll('.ck-tabs button')].map((b) => b.textContent))
    check('スマホ：割り振ったあとは、自分の担当の「まだの分」から', phoneTabs[0]?.startsWith('まだの分'), phoneTabs.join('|'))
    await shot(page, '06-phone-mine')
    await page.evaluate(() => window.scrollBy(0, 700))
    await wait(300)
    await shot(page, '07-phone-mine-2')
    // カードを押すと、記録の欄（カードの一覧の下）まで画面が動く（2026-11-09 の点検：前は動かず、出たことが分からなかった）
    await page.evaluate(() => window.scrollTo(0, 0))
    await click(page, '.ck-vseg button', 'カード')
    await page.waitForSelector('.ck-card', { timeout: 5000 })
    await click(page, '.ck-card')
    await page.waitForSelector('.ck-panel', { timeout: 5000 })
    await wait(900)
    const panelTop = await page.evaluate(() => Math.round(document.querySelector('.ck-panel').getBoundingClientRect().top))
    check('スマホ：カードを押すと、記録の欄が見える所まで動く', panelTop >= -5 && panelTop < 400, String(panelTop))
    await shot(page, '08-phone-card-panel')
    await context.close()
  }

  // ---- 管理者：全部のコース。並び順で等分（3班） ----
  {
    const { context, page } = await open(browser, '')
    check('管理者には登録の窓を出さない', !(await page.$('.profile-modal')))
    let n = await navState(page)
    check('管理者の左の見出しも、いちばん上は「点検表」', n.first === '点検表', n.first)
    await nav(page, '点検表')
    await page.waitForSelector('.ck select.ck-course', { timeout: 10000 })
    const opts = await page.evaluate(() => [...document.querySelectorAll('.ck select.ck-course option')].map((o) => o.value))
    check('管理者は、コースを選べる（3コース）', opts.length === 3, opts.join())
    // 映画・舞台衣装で点検表を作り、②グループで絞ってから、ほかのコースに替える
    await page.waitForFunction(() => document.querySelector('.ck')?.textContent.includes('点検表を作る'), { timeout: 10000 })
    await click(page, '.ck .btn.primary', '点検表を作る')
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    await click(page, '.ck-filter .ck-chips button', '②グループ')
    await click(page, '.ck-btn', 'この画面のリンク')
    await wait(200)
    await page.keyboard.press('Escape')
    await wait(200)
    check('「この画面のリンク」の窓は、Esc で閉じる', !(await page.$('.ck-pop')))
    await page.select('.ck select.ck-course', SPLIT)
    await page.waitForFunction(() => document.querySelector('.ck')?.textContent.includes('点検表を作る'), { timeout: 10000 })
    await page.select('.ck select.ck-course', FILM)
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    await wait(300)
    const back = await page.evaluate(() => ({ on: document.querySelector('.ck-filter .ck-chips button.on')?.textContent ?? '', rows: document.querySelectorAll('.ck-ta tbody tr:not(.gh)').length }))
    check('コースを替えると、所属の絞り込みははじめ（すべて）に戻る', back.on === 'すべて' && back.rows >= 10, JSON.stringify(back))
    await page.select('.ck select.ck-course', SPLIT)
    await page.waitForFunction(() => document.querySelector('.ck')?.textContent.includes('点検表を作る'), { timeout: 10000 })
    await click(page, '.ck .btn.primary', '点検表を作る')
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    await wait(300)
    const heads = (await tableRows(page)).filter((r) => r.startsWith('#')).map((r) => r.replace(/\d+人$/, ''))
    check('並び順で等分するコースは、1班・2班・3班', heads.join() === '#1班,#2班,#3班', heads.join())
    await click(page, '.ck-btn', '担当の割り振り')
    await page.waitForSelector('.ck-ta.assign', { timeout: 5000 })
    const note = await page.evaluate(() => document.querySelector('.ck-asnote')?.textContent ?? '')
    check('割り振りは「並び順で3等分」と出す', note.includes('並び順で3等分'), note)
    await context.close()
  }
  {
    const { context, page } = await open(browser, '')
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await nav(page, '点検表')
    await page.waitForFunction(() => document.querySelector('.ck')?.textContent.includes('点検表を作る'), { timeout: 10000 })
    await click(page, '.ck .btn.primary', '点検表を作る')
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    // コースごとの設定で、映画・舞台衣装の所属を「並び順で等分」（3）にして、保存しないまま点検表へ
    await nav(page, 'コースごとの設定')
    await page.waitForSelector(`.course[data-course-id="${FILM}"]`, { timeout: 10000 })
    await page.evaluate((id) => {
      const c = document.querySelector(`.course[data-course-id="${id}"]`)
      if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
    }, FILM)
    await page.waitForSelector('.course.open .group-mode', { timeout: 5000 })
    await page.evaluate(() => [...document.querySelectorAll('.course.open .group-mode label')].find((l) => l.textContent === '並び順で等分').click())
    await wait(200)
    await nav(page, '点検表')
    await page.waitForSelector('.ck-ta', { timeout: 10000 })
    // ②グループで絞ったまま、点検表の画面の見出しの「保存して学生に反映」で保存する
    await click(page, '.ck-filter .ck-chips button', '②グループ')
    await wait(200)
    await page.evaluate(() => [...document.querySelectorAll('.save-group button, .dirty-bar button')].find((b) => b.offsetParent !== null && !b.disabled && b.textContent.includes('保存')).click())
    const modal = await page.waitForSelector('.confirm-modal', { timeout: 3000 }).catch(() => null)
    if (modal) await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="ok"]').click())
    await page.waitForFunction(() => [...document.querySelectorAll('.ck-ta tr.gh')].some((tr) => tr.textContent.startsWith('1班')), { timeout: 10000 })
    const heads = (await tableRows(page)).filter((r) => r.startsWith('#')).map((r) => r.replace(/\d+人$/, ''))
    check('点検表の画面から等分の設定を保存すると、点検表を読み直して 1班・2班・3班', heads.join() === '#1班,#2班,#3班', heads.join())
    const after = await page.evaluate(() => ({ on: document.querySelector('.ck-filter .ck-chips button.on:not(:first-child)') ? 'x' : document.querySelector('.ck-filter .ck-chips button.on')?.textContent ?? '', rows: document.querySelectorAll('.ck-ta tbody tr:not(.gh)').length, label: [...document.querySelectorAll('.ck-filter .ck-grp .k')].map((k) => k.textContent).join('|') }))
    check('所属で絞ったまま保存しても、絞り込みは「すべて」に戻り、表は空にならない。等分のコースは見出しも「班」', after.on === 'すべて' && after.rows >= 10 && after.label.includes('班'), JSON.stringify(after))
    await click(page, '.ck-btn', '担当の割り振り')
    await page.waitForSelector('.ck-ta.assign', { timeout: 5000 })
    for (let g = 0; g < 3; g++) await page.select(`.ck-ta.assign tbody tr:nth-child(${g + 1}) td:nth-child(2) select`, ['梶田', '佐藤', '加藤'][g])
    await click(page, '.btn', '点検表に入れる')
    await page.waitForFunction(() => document.querySelector('.ck-asmsg')?.textContent.includes('点検表に入れました'), { timeout: 10000 })
    check('そのまま割り振っても、画面は落ちない（班の名前で入る）', errors.length === 0 && !!(await page.$('.ck')), errors.join(' / '))
    await context.close()
  }
  {
    const { context, page } = await open(browser, `view=check&course=${SPLIT}`)
    await page.waitForSelector('.ck select.ck-course', { timeout: 10000 })
    const v = await page.evaluate(() => document.querySelector('.ck select.ck-course').value)
    check('管理者の ?view=check&course=… は、そのコースの点検表から', v === SPLIT, v)
    await context.close()
  }

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
