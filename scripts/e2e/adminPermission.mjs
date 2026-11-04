// 管理ページの「先生の許可」と「点検表」（依頼者の選択 2026-11-04。docs/設計_許可の仕組み.md・mockups/v103）。これだけを流すときは node scripts/e2e/run.mjs adminPermission
// - コースの欄の「表の空の行」のあとに「先生の許可」（2つの切り替え）と「点検表」（点検表を開く・学生の並びを直す）。管理者の画面にも先生の画面にも
// - 先生の許可は、管理者も先生も保存できる（読み込み直しても残る。先生が保存したものは管理者の画面にも出る）
// - 「点検表を開く」で、新しいタブに点検表（試験用サーバーは空のページ）
// - 「学生の並びを直す」の窓（案1）：⋮⋮ のドラッグと ▲▼ で動かすと「手で動かした」。「この並びにする」で保存（開き直しても残る）。「ふりがなの順に戻す」・「やめる」
// - スマホの幅でも、窓と欄が横にはみ出さない
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const FILM = 'film-stage-costume'
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/** 画面の写真（SHOTS_DIR を決めたときだけ。目で確かめるため） */
const shot = (page, name) => (process.env.SHOTS_DIR ? page.screenshot({ path: `${process.env.SHOTS_DIR}/adminPermission-${name}.png` }) : null)

/** 管理ページを開く（試験用サーバーの保存・並びを消してから）。teacher：先生として */
async function open(context, { teacher = false, phone = false, fresh = true } = {}) {
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  page.on('dialog', (d) => void d.accept())
  if (phone) await page.setUserAgent(IPHONE)
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html${teacher ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  if (fresh) {
    await page.evaluate(() => {
      for (const key of ['sotsugyo-admin-mock', 'sotsugyo-admin-mock-order', 'sotsugyo-admin-mock-checksheets']) localStorage.removeItem(key)
      sessionStorage.removeItem('sotsugyo-admin-section')
    })
    await page.reload({ waitUntil: 'networkidle0' })
  }
  await page.waitForSelector('.admin .side-nav button', { timeout: 30000 })
  await wait(400)
  return page
}
/** 「コースごとの設定」を開き、映画・舞台衣装デザイナー コースを開く */
async function openCourse(page) {
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定')).click())
  await wait(400)
  await page.evaluate((id) => {
    const c = document.querySelector(`.course[data-course-id="${id}"]`)
    if (!c.classList.contains('open')) c.querySelector('.open-btn').click()
  }, FILM)
  await page.waitForSelector(`.course.open[data-course-id="${FILM}"] .perm-checks`)
  await wait(200)
}
/** 開いたコースの欄の様子 */
const courseState = (page) =>
  page.evaluate(() => {
    const course = document.querySelector('.course.open')
    const labels = [...course.querySelectorAll('.lb')].map((l) => l.firstChild.textContent)
    const lb = (name) => [...course.querySelectorAll('.lb')].find((l) => l.firstChild.textContent === name)
    const ctl = (name) => lb(name)?.nextElementSibling
    const perm = ctl('先生の許可')
    return {
      labels: labels.join('|'),
      checks: [...(perm?.querySelectorAll('.toggle-label') ?? [])].map((l) => `${l.querySelector('input').checked ? '☑' : '☐'}${l.textContent.trim()}`),
      permHint: perm?.querySelector('.hint')?.textContent ?? '',
      permChanged: !!lb('先生の許可')?.querySelector('.chg'),
      sheetButtons: [...(ctl('点検表')?.querySelectorAll('button') ?? [])].map((b) => `${b.textContent.trim()}${b.disabled ? '（押せない）' : ''}`),
      sheetHint: ctl('点検表')?.querySelector('.hint')?.textContent ?? '',
      bar: document.querySelector('.dirty-bar .tx span')?.textContent ?? '',
    }
  })
/** 保存のボタン（見出しか、画面の下の帯）を押し、確認の窓が出たら「OK」 */
async function save(page) {
  await page.evaluate(() => [...document.querySelectorAll('.save-group button, .dirty-bar button')].find((b) => b.offsetParent !== null && !b.disabled && b.textContent.includes('保存'))?.click())
  const modal = await page.waitForSelector('.confirm-modal', { timeout: 3000 }).catch(() => null)
  if (modal) await page.evaluate(() => document.querySelector('.confirm-modal [data-confirm="ok"]').click())
  await page.waitForFunction(() => !document.querySelector('.dirty-bar') && !document.querySelector('.confirm-modal'), { timeout: 10000 })
  await wait(300)
}
/** 試験用サーバーに保存してある、コースの先生の許可 */
const savedPermission = (page) => page.evaluate((id) => JSON.parse(localStorage.getItem('sotsugyo-admin-mock')).years[0].config.courses.find((c) => c.id === id).permission ?? null, FILM)
const clickCheck = (page, text) =>
  page.evaluate((text) => [...document.querySelectorAll('.course.open .perm-checks .toggle-label')].find((l) => l.textContent.includes(text)).querySelector('input').click(), text)
const clickSheetButton = (page, text) => page.evaluate((text) => [...document.querySelectorAll('.course.open button')].find((b) => b.textContent.trim() === text).click(), text)
/** 並びの窓の様子 */
const dialogState = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.so-modal')
    if (!m) return null
    return {
      title: m.querySelector('h2')?.textContent ?? '',
      lead: m.querySelector('.lead')?.textContent ?? '',
      head: [...m.querySelectorAll('.so-head span')].map((s) => s.textContent).join('|'),
      rows: [...m.querySelectorAll('.so-li')].map((r) => `${r.querySelector('.no').textContent}:${r.querySelector('.kana').textContent}${r.classList.contains('moved') ? '*' : ''}`),
      tags: [...m.querySelectorAll('.so-tag')].map((t) => `${t.closest('.so-li').dataset.id}:${t.textContent}`),
      kanaDisabled: m.querySelector('.so-kana')?.disabled ?? null,
      buttons: [...m.querySelectorAll('.so-foot .btn')].map((b) => b.textContent.trim()).join('|'),
    }
  })
const openDialog = async (page) => {
  await clickSheetButton(page, '学生の並びを直す')
  await page.waitForFunction(() => document.querySelectorAll('.so-modal .so-li').length > 0, { timeout: 10000 })
  await wait(200)
}
const moveButton = (page, id, dir) =>
  page.evaluate(
    (id, dir) => {
      const row = document.querySelector(`.so-li[data-id="${id}"]`)
      row.scrollIntoView({ block: 'center' })
      row.querySelector(dir === 'up' ? 'button.up' : 'button.down').click()
    },
    id,
    dir,
  )
const footButton = (page, text) => page.evaluate((text) => [...document.querySelectorAll('.so-modal .so-foot .btn')].find((b) => b.textContent.trim() === text).click(), text)
const kanaOrder = ['アオキ ミサキ', 'イシダ ハルカ', 'ウエノ ソラ', 'エンドウ リコ', 'オオタ ユイ', 'カネコ ナナ', 'キムラ アオイ', 'クボ メイ', 'コバヤシ ヒナ', 'サイトウ ミオ', 'シミズ カエデ', 'ブンカ ハナコ']
const rowsOf = (list) => list.map((k, i) => `${i + 1}:${k}`)

await withEdge(async (browser) => {
  // ---- 管理者・先生：欄が出る。先生の許可を切り替えて保存できる ----
  for (const teacher of [false, true]) {
    const who = teacher ? '先生' : '管理者'
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher })
    await openCourse(page)
    let s = await courseState(page)
    check(
      `${who}：コースの欄の「表の空の行」のあとに「先生の許可」と「点検表」。はじめは両方とも切ってある`,
      /表の空の行\|先生の許可\|点検表/.test(s.labels) &&
        s.checks.join('|') === '☐抄録は、先生の許可が出てから書ける|☐提出用の PDF は、先生の許可が出てから作れる' &&
        s.permHint === '許可は、点検表の「抄録許可」「最終提出可」に ✓ を入れて出します。使わないときは今のまま（抄録は学生が自分で「先生の許可が出た」を押す。PDF に「点検用」の印は入らない）。' &&
        s.sheetButtons.join('|') === '点検表を開く|学生の並びを直す' &&
        s.sheetHint === '学生がコースを選ぶと、ふりがなの順に自動で載ります。見られるのは、PDF の控えのフォルダを見られる先生方です。',
      JSON.stringify(s),
    )
    await clickCheck(page, '抄録は')
    await wait(200)
    s = await courseState(page)
    check(`${who}：切り替えると「変更あり」と、画面の下の帯に「〜コースの先生の許可」`, s.permChanged && s.checks[0].startsWith('☑') && s.bar.includes('映画・舞台衣装デザイナー コースの先生の許可'), JSON.stringify(s))
    await save(page)
    const saved = await savedPermission(page)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.admin .side-nav button')
    await openCourse(page)
    s = await courseState(page)
    check(`${who}：保存すると、サーバーに { abstract: true }。読み込み直しても切り替えたまま`, JSON.stringify(saved) === '{"abstract":true}' && s.checks[0].startsWith('☑') && s.checks[1].startsWith('☐') && !s.permChanged, JSON.stringify({ saved, checks: s.checks }))
    // 両方を入れ替える（抄録を切り、PDF を入れる）
    await clickCheck(page, '抄録は')
    await clickCheck(page, '提出用の PDF')
    await save(page)
    const saved2 = await savedPermission(page)
    check(`${who}：抄録を切って PDF を入れて保存すると { final: true }`, JSON.stringify(saved2) === '{"final":true}', JSON.stringify(saved2))
    if (teacher) {
      // 先生が保存した許可は、管理者の画面にも出る（同じ試験用サーバー）
      const adminPage = await open(context, { fresh: false })
      await openCourse(adminPage)
      const a = await courseState(adminPage)
      check('先生が保存した先生の許可は、管理者の画面にも出る', a.checks.join('|') === '☐抄録は、先生の許可が出てから書ける|☑提出用の PDF は、先生の許可が出てから作れる', JSON.stringify(a.checks))
      await adminPage.close()
    }
    // 切ると、項目ごとなくなる（今までと同じ「使わない」）
    await clickCheck(page, '提出用の PDF')
    await save(page)
    check(`${who}：両方とも切って保存すると、先生の許可の項目はなくなる`, (await savedPermission(page)) === null)

    // ---- 点検表を開く：まだないときは作って、新しいタブ ----
    let before = new Set(browser.targets())
    await clickSheetButton(page, '点検表を開く')
    let target = await browser.waitForTarget((t) => !before.has(t) && t.url().includes(`check-sheet-2026-${FILM}`), { timeout: 10000 }).catch(() => null)
    check(`${who}：まだ点検表がないとき、「点検表を開く」で作って、新しいタブに開く`, !!target, target?.url() ?? 'なし')
    if (target) await (await target.page())?.close()
    // 作ってある点検表は、「点検表を開く」がそのままリンク（サーバーに聞かずに、押すとすぐ開く。読み込み直しても）
    const linkOf = () => page.evaluate(() => { const a = document.querySelector('.course.open a.cs-open'); return a ? { href: a.getAttribute('href'), target: a.target, text: a.textContent.trim() } : null })
    const afterCreate = await linkOf()
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.admin .side-nav button')
    await openCourse(page)
    const afterReload = await linkOf()
    let calls = 0
    await page.evaluate(() => {
      const s = window.__adminServer
      const ensure = s.ensureCheckSheet
      window.__ensureCalls = 0
      s.ensureCheckSheet = (...a) => ((window.__ensureCalls += 1), ensure(...a))
    })
    before = new Set(browser.targets())
    await page.evaluate(() => document.querySelector('.course.open a.cs-open').click())
    target = await browser.waitForTarget((t) => !before.has(t) && t.url().includes(`check-sheet-2026-${FILM}`), { timeout: 10000 }).catch(() => null)
    calls = await page.evaluate(() => window.__ensureCalls)
    check(
      `${who}：作ってある点検表は「点検表を開く」がリンクになり（読み込み直しても）、押すとサーバーに聞かずに新しいタブで開く`,
      afterCreate?.href === `about:blank#check-sheet-2026-${FILM}` && afterReload?.href === afterCreate.href && afterReload.target === '_blank' && afterReload.text === '点検表を開く' && !!target && calls === 0,
      JSON.stringify({ afterCreate, afterReload, opened: target?.url() ?? null, calls }),
    )
    if (target) await (await target.page())?.close()
    await context.close()
  }

  // ---- 学生の並びを直す（先生。窓：案1） ----
  {
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher: true })
    await openCourse(page)
    await openDialog(page)
    let d = await dialogState(page)
    check(
      '「学生の並びを直す」で窓：題・説明・見出し。はじめはふりがなの順で、手で動かした印はない。「ふりがなの順に戻す」は押せない',
      d.title === '学生の並び（映画・舞台衣装デザイナー コース）' &&
        d.lead === 'ふりがなの順に自動で並んでいます。⋮⋮ をドラッグするか、▲▼ で動かします。この並びが点検表の順になります。' &&
        d.head === '|番号|ふりがな|氏名|学籍番号|動かす' &&
        d.rows.join(',') === rowsOf(kanaOrder).join(',') &&
        d.tags.length === 0 &&
        d.kanaDisabled === true &&
        d.buttons === 'ふりがなの順に戻す|やめる|この並びにする',
      JSON.stringify(d),
    )
    // ▲ で文化 花子を6つ上げる（12番目 → 6番目）
    for (let i = 0; i < 6; i++) await moveButton(page, '00ZZ0123', 'up')
    await wait(200)
    d = await dialogState(page)
    check('▲ で動かすと、その学生に「手で動かした」（ほかの学生には付かない）', d.rows[5] === '6:ブンカ ハナコ*' && d.tags.join() === '00ZZ0123:手で動かした' && d.kanaDisabled === false, JSON.stringify(d.rows))
    // ⋮⋮ をドラッグして、3番目へ（見本 v103 と同じ並び）
    await page.evaluate(() => (document.querySelector('.so-box').scrollTop = 0))
    await wait(100)
    const pts = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.so-li')]
      const grip = rows[5].querySelector('.grip').getBoundingClientRect()
      const to = rows[2].getBoundingClientRect()
      return { x: grip.left + grip.width / 2, y: grip.top + grip.height / 2, ty: to.top + 6 }
    })
    await page.mouse.move(pts.x, pts.y)
    await page.mouse.down()
    for (let k = 1; k <= 8; k++) {
      await page.mouse.move(pts.x, pts.y + ((pts.ty - pts.y) * k) / 8)
      await wait(30)
    }
    await wait(100)
    const line = await page.evaluate(() => !!document.querySelector('.so-modal .drop-line'))
    await page.mouse.up()
    await wait(200)
    d = await dialogState(page)
    check('⋮⋮ をドラッグすると、落とす所に線が出て、3番目に移る（見本 v103 と同じ並び）', line && d.rows.slice(0, 4).join(',') === '1:アオキ ミサキ,2:イシダ ハルカ,3:ブンカ ハナコ*,4:ウエノ ソラ' && d.tags.length === 1, JSON.stringify({ line, rows: d.rows.slice(0, 5) }))
    await shot(page, 'order')
    // ▼ で1つ下げる → 4番目
    await moveButton(page, '00ZZ0123', 'down')
    await wait(150)
    await footButton(page, 'この並びにする')
    await page.waitForFunction(() => !document.querySelector('.so-modal'), { timeout: 10000 })
    const note = await page.evaluate(() => document.querySelector('.course.open .cs-note')?.textContent ?? '')
    const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem('sotsugyo-admin-mock-order') ?? '{}')[`2026:${id}`] ?? null, FILM)
    check('「この並びにする」で保存して窓を閉じ、「学生の並びを保存しました」。サーバーに並び（文化 花子は4番目）', note.startsWith('学生の並びを保存しました') && stored?.[3] === '00ZZ0123' && stored.length === 12, JSON.stringify({ note, stored }))
    // 開き直しても残る
    await openDialog(page)
    d = await dialogState(page)
    check('開き直しても、直した並びと「手で動かした」が残る', d.rows[3] === '4:ブンカ ハナコ*' && d.tags.length === 1, JSON.stringify(d.rows.slice(0, 5)))
    // やめる：動かしても保存しない
    await moveButton(page, '00ZZ0107', 'down')
    await footButton(page, 'やめる')
    await page.waitForFunction(() => !document.querySelector('.so-modal'))
    await openDialog(page)
    d = await dialogState(page)
    check('「やめる」で閉じると、動かした並びは保存しない', d.rows[0] === '1:アオキ ミサキ' && d.rows[3] === '4:ブンカ ハナコ*', JSON.stringify(d.rows.slice(0, 5)))
    // ふりがなの順に戻す
    await footButton(page, 'ふりがなの順に戻す')
    await wait(150)
    d = await dialogState(page)
    const back = d.rows.join(',') === rowsOf(kanaOrder).join(',') && d.tags.length === 0 && d.kanaDisabled === true
    await footButton(page, 'この並びにする')
    await page.waitForFunction(() => !document.querySelector('.so-modal'), { timeout: 10000 })
    const cleared = await page.evaluate((id) => !(`2026:${id}` in JSON.parse(localStorage.getItem('sotsugyo-admin-mock-order') ?? '{}')), FILM)
    check('「ふりがなの順に戻す」でふりがなの順になり、保存すると並びを空にする（あとから来た学生も、ふりがなの所に入る）', back && cleared, JSON.stringify({ rows: d.rows, cleared }))
    // Esc でも閉じる
    await openDialog(page)
    await page.keyboard.press('Escape')
    await wait(200)
    check('Esc で窓を閉じる', !(await page.$('.so-modal')))
    await context.close()
  }

  // ---- スマホの幅：欄と窓が横にはみ出さない ----
  {
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher: true, phone: true })
    await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('コースごとの設定')).click())
    await wait(500)
    await openCourse(page)
    await page.evaluate(() => [...document.querySelectorAll('.course.open .lb')].find((l) => l.firstChild.textContent === '点検表').scrollIntoView({ block: 'center' }))
    await wait(200)
    const rowFit = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
      const perm = [...document.querySelectorAll('.course.open .perm-checks .toggle-label')].map((l) => Math.round(l.getBoundingClientRect().right))
      const btns = [...document.querySelectorAll('.course.open .row-btns button')].map((b) => Math.round(b.getBoundingClientRect().right))
      return { over, right: Math.max(...perm, ...btns), width: innerWidth }
    })
    check('スマホ：「先生の許可」「点検表」の欄が横にはみ出さない', rowFit.over <= 0 && rowFit.right <= rowFit.width, JSON.stringify(rowFit))
    await shot(page, 'phone-row')
    await openDialog(page)
    // 1つだけ上げると、隣の学生と入れ替わっただけで、どちらに印が付くか決まらない。3つ上げる
    for (let i = 0; i < 3; i++) await moveButton(page, '00ZZ0123', 'up')
    await wait(200)
    const fit = await page.evaluate(() => {
      const m = document.querySelector('.so-modal').getBoundingClientRect()
      const rows = [...document.querySelectorAll('.so-li')]
      return {
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        modal: [Math.round(m.left), Math.round(m.right)],
        width: innerWidth,
        rowOver: rows.filter((r) => r.scrollWidth > r.clientWidth + 1).length,
        buttons: [...document.querySelectorAll('.so-li .mv button')].slice(0, 2).map((b) => Math.round(b.getBoundingClientRect().height)),
        foot: [...document.querySelectorAll('.so-foot .btn')].every((b) => b.getBoundingClientRect().right <= innerWidth),
        tag: document.querySelector('.so-tag')?.closest('.so-li')?.dataset.id ?? null,
      }
    })
    check('スマホ：並びの窓は画面の中に収まり、行も横にはみ出さない。▲▼ は指で押しやすい大きさ', fit.over <= 0 && fit.modal[0] >= 0 && fit.modal[1] <= fit.width && fit.rowOver === 0 && fit.buttons.every((h) => h >= 36) && fit.foot && fit.tag === '00ZZ0123', JSON.stringify(fit))
    await shot(page, 'phone-dialog')
    await context.close()
  }
})

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} 件 合格`)
process.exit(failed ? 1 : 0)
