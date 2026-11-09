// 所属（制作グループなど）と、点検表の並び（依頼者の選択 2026-11-09 mockups/v118・v119・v120 案C）。これだけを流すときは node scripts/e2e/run.mjs group1109
// - 学生：所属を登録したコースは、はじめての案内で、氏名のあとに「所属を選んでください」（選ぶまで閉じられない）。表紙のコース欄の一覧の下でも選び直せる。
//   コースを変えると所属は消え、所属のあるコースに戻すと、すぐに所属だけを聞く。所属を選んでいない原稿を開いたときも聞く
// - 管理ページ（先生）：区切りの見出し「点検表」の下に、点検表・所属・点検表の並び。所属は名前の札、順番と並べ方は2つから選ぶ。保存するまで「学生の並びを直す」は押せない。
//   保存すると、学生の並びの窓は所属ごと（その中は学籍番号順）。先生も「所属」の欄で学生の所属を直せる
import { mkdirSync, readFileSync } from 'node:fs'
import { withEdge } from '../poc/edge.mjs'
import { stubConfig } from './configStub.mjs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/group1109'
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

/** 学生のツールを、はじめての人として開く（映画・舞台衣装デザイナー コースに所属を2つ登録してある） */
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
  await stubConfig(page, { courses: fixture.courses.map((c) => (c.id === FILM ? { ...c, groups: GROUPS } : c)) })
  await answerConfirms(page, () => true)
  await page.goto(`${APP}/?nodrive`, { waitUntil: 'networkidle0', timeout: 90000 })
  const ready = () => page.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && !document.querySelector('.loading') }, { timeout: 120000 })
  await ready()
  return { context, page, ready }
}
const basic = (page) => page.evaluate(() => window.__editor.getSnapshot().report.basicInfo)
const guideState = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('.guide')
    return {
      step: g ? [...g.classList].find((c) => c.startsWith('step-')) ?? '' : '',
      title: g?.querySelector('h2')?.textContent ?? '',
      opts: [...(g?.querySelectorAll('.g-opts button') ?? [])].map((b) => b.textContent.trim()),
      steps: g?.querySelector('.g-steps')?.textContent ?? '',
      later: !!g?.querySelector('.g-later'),
      note: g?.querySelector('.g-note')?.textContent ?? '',
    }
  })
/** 表紙のコース欄を押して、「コースを選ぶ」を開く */
async function openCourseMenu(page) {
  await page.evaluate(() => window.__editor.goToPage(0, 'none'))
  await wait(500)
  const at = await page.evaluate(() => {
    const el = document.querySelector('.page-viewport.front [data-block-id="basic:course"]')
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.click(at.x, at.y)
  await page.waitForSelector('.course-menu', { timeout: 10000 })
  await wait(200)
}
const menuState = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.course-menu')
    return {
      title: m?.querySelector('.course-menu-groups .popover-title')?.textContent ?? '',
      groups: [...(m?.querySelectorAll('.course-menu-groups button') ?? [])].map((b) => `${b.textContent.trim()}${b.classList.contains('on') ? '*' : ''}`),
    }
  })

/** 管理ページを開き（試験用サーバーの保存を消してから）、映画・舞台衣装デザイナー コースを開く */
async function openAdmin(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => void d.accept())
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    for (const key of ['sotsugyo-admin-mock', 'sotsugyo-admin-mock-order', 'sotsugyo-admin-mock-order-mode', 'sotsugyo-admin-mock-group-fix', 'sotsugyo-admin-mock-checksheets']) localStorage.removeItem(key)
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
  await page.waitForSelector(`.course.open[data-course-id="${FILM}"] #c-${FILM}-group-mode`)
  await wait(200)
  return { context, page }
}
const adminState = (page) =>
  page.evaluate(() => {
    const course = document.querySelector('.course.open')
    const lists = [...course.querySelectorAll('.grid.set-list')]
    const heads = [...course.querySelectorAll('.set-group')]
    const lb = (name) => [...course.querySelectorAll('.lb')].find((l) => l.firstChild.textContent === name)
    const ctl = (name) => lb(name)?.nextElementSibling
    const order = ctl('点検表の並び')
    return {
      lastHead: heads.at(-1)?.textContent ?? '',
      lastLabels: [...(lists.at(-1)?.querySelectorAll('.lb') ?? [])].map((l) => l.firstChild.textContent).join('|'),
      tags: [...(ctl('所属')?.querySelectorAll('.tag') ?? [])].map((t) => t.firstChild.textContent),
      groupWarn: ctl('所属')?.querySelector('.warn-line')?.textContent ?? '',
      picks: [...(order?.querySelectorAll('.seg-pick input') ?? [])].map((i) => `${i.nextElementSibling.textContent}${i.checked ? '*' : ''}`).join('|'),
      orderBtn: order?.querySelector('.cs-order') ? (order.querySelector('.cs-order').disabled ? '押せない' : '押せる') : 'ない',
      orderWarn: order?.querySelector('.warn-line')?.textContent ?? '',
      sheetBtns: [...(ctl('点検表')?.querySelectorAll('button, a.btn') ?? [])].map((b) => b.textContent.trim()).join('|'),
    }
  })
async function save(page) {
  await page.evaluate(() => [...document.querySelectorAll('.save-group button, .dirty-bar button')].find((b) => b.offsetParent !== null && !b.disabled && b.textContent.includes('保存'))?.click())
  const modal = await page.waitForSelector('.confirm-modal', { timeout: 3000 }).catch(() => null)
  if (modal) await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="ok"]').click())
  await page.waitForFunction(() => !document.querySelector('.dirty-bar') && !document.querySelector('.confirm-modal'), { timeout: 10000 })
  await wait(300)
}
const savedCourse = (page) => page.evaluate((id) => JSON.parse(localStorage.getItem('sotsugyo-admin-mock')).years[0].config.courses.find((c) => c.id === id), FILM)
/** 学生の並びの窓の中身（所属の見出しは「#名前」、学生は学籍番号） */
const dialogState = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.so-modal')
    if (!m) return null
    return {
      lead: m.querySelector('.lead')?.textContent ?? '',
      head: [...m.querySelectorAll('.so-head span')].map((s) => s.textContent).join('|'),
      items: [...m.querySelectorAll('.so-list > .so-group, .so-list > .so-li')].map((el) => (el.classList.contains('so-group') ? `#${el.firstChild.textContent}` : `${el.dataset.id}:${el.querySelector('select.grp')?.value ?? ''}`)),
      upDisabled: [...m.querySelectorAll('.so-li')].filter((r) => r.querySelector('button.up').disabled).map((r) => r.dataset.id),
      kana: m.querySelector('.so-kana')?.textContent ?? '',
    }
  })

await withEdge(async (browser) => {
  // ---- 学生：はじめての案内で、氏名のあとに所属を選ぶ ----
  {
    const { context, page, ready } = await openStudent(browser)
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate((id) => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画')).click(), FILM)
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    const steps = (await guideState(page)).steps
    check('所属を登録したコースを選ぶと、案内の段階の氏名のあとに「所属」', /氏名.*所属.*サブタイトル/.test(steps), steps)
    await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
    await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:studentId', { timeout: 30000 })
    await page.keyboard.type('00ZZ0123')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 30000 })
    for (const t of ['文化', '花子', 'ぶんか', 'ハナコ']) {
      await page.keyboard.type(t)
      await page.keyboard.press('Enter')
    }
    await page.waitForSelector('.guide.step-group', { timeout: 20000 })
    await wait(300)
    let g = await guideState(page)
    check(
      '氏名のあとに「所属を選んでください」：登録した所属のボタン。「あとで」はなく、選ぶまで閉じられない',
      g.title === '所属を選んでください' && g.opts.join('|') === GROUPS.join('|') && !g.later && g.note.includes('表紙のコースの欄'),
      JSON.stringify(g),
    )
    await page.keyboard.press('Escape')
    await wait(300)
    check('Esc でも閉じない', (await guideState(page)).step === 'step-group')
    await page.screenshot({ path: `${OUT}/1-guide-group.png` })
    await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent === '②グループ').click())
    await page.waitForSelector('.guide.step-subtitle', { timeout: 20000 })
    let b = await basic(page)
    check('②グループを選ぶと、原稿に所属と決めた日時が入り、サブタイトルの段へ', b.group === '②グループ' && /^\d{4}-\d\d-\d\dT/.test(b.groupAt ?? ''), JSON.stringify({ group: b.group, groupAt: b.groupAt }))
    await page.evaluate(() => document.querySelector('.guide .g-later').click())
    await ready()

    // ---- 表紙のコース欄の一覧の下で、所属を選び直す ----
    await openCourseMenu(page)
    let m = await menuState(page)
    check('表紙のコース欄を押すと、「コースを選ぶ」の下に「所属」（今の所属に印）', m.title === '所属' && m.groups.join('|') === '①グループ|②グループ*', JSON.stringify(m))
    await page.screenshot({ path: `${OUT}/2-course-menu.png` })
    await page.evaluate(() => [...document.querySelectorAll('.course-menu-groups button')].find((x) => x.textContent === '①グループ').click())
    await wait(400)
    b = await basic(page)
    check('一覧の「①グループ」で、所属が変わる（一覧は閉じる）', b.group === '①グループ' && !(await page.$('.course-menu')), b.group)

    // ---- コースを変えると所属は消え、所属のあるコースに戻すと所属だけを聞く ----
    const other = fixture.courses.find((c) => c.id !== FILM && !c.hidden)
    await openCourseMenu(page)
    await page.evaluate((name) => [...document.querySelectorAll('.course-menu > button')].find((x) => x.textContent.includes(name)).click(), other.name)
    await wait(1200)
    await ready()
    b = await basic(page)
    check('所属のないコースに変えると、所属は消え、所属は聞かない', b.courseId === other.id && b.group === undefined && !(await page.$('.guide')), JSON.stringify({ courseId: b.courseId, group: b.group }))
    await openCourseMenu(page)
    m = await menuState(page)
    check('所属のないコースでは、「コースを選ぶ」の下に所属が出ない', m.groups.length === 0, JSON.stringify(m))
    await page.evaluate(() => [...document.querySelectorAll('.course-menu > button')].find((x) => x.textContent.includes('映画')).click())
    await page.waitForSelector('.guide.step-group', { timeout: 20000 })
    g = await guideState(page)
    check('所属のあるコースに戻すと、すぐに所属だけを聞く（段階の並びは出さない所属だけ）', g.title === '所属を選んでください' && !g.later, JSON.stringify(g))
    await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((x) => x.textContent === '②グループ').click())
    await page.waitForFunction(() => !document.querySelector('.guide'), { timeout: 20000 })
    b = await basic(page)
    check('選ぶと案内を閉じる（サブタイトルなどは聞かない）', b.group === '②グループ', b.group)

    // ---- 所属を選んでいない原稿を開いたとき（先生があとから所属を登録した）も聞く ----
    await page.evaluate(() => window.__editor.update((r) => { const { group, groupAt, ...rest } = r.basicInfo; return { ...r, basicInfo: rest } }))
    await wait(2500)
    await page.reload({ waitUntil: 'networkidle0', timeout: 90000 })
    await ready()
    const reopened = await page.waitForSelector('.guide.step-group', { timeout: 30000 }).then(() => true, () => false)
    check('所属を選んでいない原稿を開くと、所属だけを聞く', reopened)
    await page.screenshot({ path: `${OUT}/3-reopen.png` })
    if (reopened) {
      await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((x) => x.textContent === '①グループ').click())
      await page.waitForFunction(() => !document.querySelector('.guide'), { timeout: 20000 })
      check('選ぶと閉じ、所属が入る', (await basic(page)).group === '①グループ')
    }
    await context.close()
  }

  // ---- スマホ：所属を選んでいない原稿を開くと、画面の下に「所属を選んでください」 ----
  {
    const { context, page, ready } = await openStudent(browser)
    await page.waitForSelector('.guide.step-course .g-opts button', { timeout: 60000 })
    await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画')).click())
    await page.waitForSelector('.guide.step-word .g-word-opt.no')
    await page.evaluate(() => window.__editor.update((r) => ({ ...r, basicInfo: { ...r.basicInfo, studentId: '00ZZ0123', name: '文化　花子', familyName: '文化', givenName: '花子', familyKana: 'ブンカ', givenKana: 'ハナコ' } })))
    await wait(2500)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await page.reload({ waitUntil: 'networkidle0', timeout: 90000 })
    await ready()
    const shown = await page.waitForSelector('.guide.narrow.step-group', { timeout: 30000 }).then(() => true, () => false)
    await wait(500)
    const tip = await page.evaluate(() => {
      const r = document.querySelector('.guide .g-tip')?.getBoundingClientRect()
      const buttons = [...document.querySelectorAll('.guide .g-opts button')].map((b) => b.getBoundingClientRect())
      return r ? { top: r.top, bottom: r.bottom, h: innerHeight, inside: buttons.every((b) => b.top >= 0 && b.bottom <= innerHeight && b.height >= 44) } : null
    })
    check('スマホ：所属を選んでいない原稿を開くと、画面の下に「所属を選んでください」（ボタンは画面の中で、指で押せる大きさ）', shown && !!tip && tip.bottom > tip.h - 40 && tip.top > 0 && tip.inside, JSON.stringify(tip))
    await page.screenshot({ path: `${OUT}/6-phone-group.png` })
    if (shown) {
      await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((x) => x.textContent === '①グループ').click())
      await page.waitForFunction(() => !document.querySelector('.guide.step-group'), { timeout: 20000 })
      check('スマホ：選ぶと所属が入る', (await basic(page)).group === '①グループ')
    }
    await context.close()
  }

  // ---- 管理ページ（先生）：点検表のまとまり・所属・点検表の並び・学生の並びの窓 ----
  {
    const { context, page } = await openAdmin(browser)
    let s = await adminState(page)
    check(
      '区切りの見出し「点検表」の下に、点検表・所属・点検表の並び。「点検表を開く」は点検表の欄、「学生の並びを直す」は点検表の並びの欄。はじめは五十音順・26人からは2列',
      s.lastHead === '点検表' && s.lastLabels === '点検表|所属|点検表の並び' && s.sheetBtns === '点検表を開く' && s.orderBtn === '押せる' && s.picks === '五十音順*|学籍番号順|26人からは2列*|いつも縦1列',
      JSON.stringify(s),
    )
    // まとまりの作り方は「学生が選ぶ」（依頼者の選択 2026-11-09：使わない・学生が選ぶ・並び順で等分）
    await page.evaluate(() => [...document.querySelectorAll('.course.open .group-mode label')].find((l) => l.textContent === '学生が選ぶ').click())
    await page.waitForSelector(`#c-${FILM}-group`)
    for (const name of [...GROUPS, '①グループ']) {
      await page.click(`#c-${FILM}-group`)
      await page.keyboard.type(name)
      await page.keyboard.press('Enter')
      await wait(150)
    }
    await page.evaluate(() => {
      const order = [...document.querySelectorAll('.course.open .seg-pick label')]
      order.find((l) => l.textContent === '学籍番号順').click()
      order.find((l) => l.textContent === 'いつも縦1列').click()
    })
    await wait(200)
    s = await adminState(page)
    check(
      '所属は Enter で札になる（同じ名前は足さずに知らせる）。順番と並べ方を選ぶと、保存するまで「学生の並びを直す」は押せない',
      s.tags.join('|') === GROUPS.join('|') && s.groupWarn.includes('「①グループ」は、もうあります') && s.picks === '五十音順|学籍番号順*|26人からは2列|いつも縦1列*' && s.orderBtn === '押せない' && s.orderWarn.includes('保存してから使えます'),
      JSON.stringify(s),
    )
    await page.screenshot({ path: `${OUT}/4-admin-rows.png` })
    await save(page)
    const course = await savedCourse(page)
    check('保存すると、所属・学籍番号順・いつも縦1列が残る', JSON.stringify(course.groups) === JSON.stringify(GROUPS) && course.checkById === true && course.checkOneColumn === true, JSON.stringify({ groups: course.groups, checkById: course.checkById, checkOneColumn: course.checkOneColumn }))
    s = await adminState(page)
    check('保存したら「学生の並びを直す」が押せる', s.orderBtn === '押せる' && !s.orderWarn, JSON.stringify(s))

    // 学生の並びの窓：所属ごと（その中は学籍番号順）・所属の欄
    await page.evaluate(() => document.querySelector('.course.open .cs-order').click())
    await page.waitForFunction(() => document.querySelectorAll('.so-modal .so-li').length > 0, { timeout: 10000 })
    await wait(200)
    let d = await dialogState(page)
    const heads = d.items.filter((x) => x.startsWith('#'))
    const firstGroup = d.items.slice(1, d.items.indexOf('#②グループ'))
    const sortedIds = [...firstGroup].map((x) => x.split(':')[0]).sort()
    check(
      '窓は所属ごとに見出しを付けて並び、その中は学籍番号順。学生ごとに「所属」の欄。所属の始めの学生は ▲ を押せない',
      d.lead.startsWith('所属ごとに、その中は学籍番号順に自動で並んでいます。') &&
        d.lead.includes('「所属」の欄で直せます') &&
        d.head === '|番号|ふりがな|氏名|学籍番号|所属|動かす' &&
        heads.join('|') === '#①グループ|#②グループ|#所属をまだ選んでいない学生' &&
        firstGroup.every((x) => x.endsWith(':①グループ')) &&
        firstGroup.map((x) => x.split(':')[0]).join() === sortedIds.join() &&
        d.upDisabled.includes(firstGroup[0].split(':')[0]) &&
        d.kana === '学籍番号順に戻す',
      JSON.stringify(d),
    )
    await page.screenshot({ path: `${OUT}/5-order-dialog.png` })
    // 先生が所属を直す：①グループの最初の学生を②グループに
    const moved = firstGroup[0].split(':')[0]
    await page.select(`.so-li[data-id="${moved}"] select.grp`, '②グループ')
    await wait(200)
    d = await dialogState(page)
    const inSecond = d.items.slice(d.items.indexOf('#②グループ'), d.items.indexOf('#所属をまだ選んでいない学生'))
    check('「所属」の欄で②グループにすると、②グループの中（学籍番号順の所）へ移る', inSecond.includes(`${moved}:②グループ`) && !d.items.slice(0, d.items.indexOf('#②グループ')).some((x) => x.startsWith(moved)), JSON.stringify(inSecond))
    await page.evaluate(() => [...document.querySelectorAll('.so-modal .so-foot .btn')].find((x) => x.textContent.trim() === 'この並びにする').click())
    await page.waitForFunction(() => !document.querySelector('.so-modal'), { timeout: 10000 })
    const fixes = await page.evaluate((id) => JSON.parse(localStorage.getItem('sotsugyo-admin-mock-group-fix') ?? '{}')[`2026:${id}`] ?? null, FILM)
    check('「この並びにする」で、直した学生の所属だけをサーバーに送る', JSON.stringify(fixes) === JSON.stringify({ [moved]: '②グループ' }), JSON.stringify(fixes))
    await page.evaluate(() => document.querySelector('.course.open .cs-order').click())
    await page.waitForFunction(() => document.querySelectorAll('.so-modal .so-li').length > 0, { timeout: 10000 })
    await wait(200)
    d = await dialogState(page)
    check('開き直しても、直した所属のまま', d.items.includes(`${moved}:②グループ`), JSON.stringify(d.items))
    await page.keyboard.press('Escape')
    await wait(300)

    // 所属を全部消して保存すると、項目ごと消える
    for (let k = 0; k < GROUPS.length; k++) await page.evaluate(() => document.querySelector('.course.open .tags .tag button').click())
    await wait(200)
    await save(page)
    check('所属を全部消して保存すると、所属の項目ごと消える', (await savedCourse(page)).groups === undefined)
    await context.close()
  }

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
