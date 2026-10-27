// 管理ページの試し（2026-10-27。先生・管理者・スマホ・うっかりの4役のサブエージェント）で見つかったことの直し（見た目を変えないもの）。
// これだけを流すときは node scripts/e2e/run.mjs adminFixes1027
// - 別のタブで公開したあと、前から開いていたタブの保存は、学生に届けずに断る（公開すると更新日時も変わる）。消した年度・外した先生も、古いタブから戻さない
// - 書き方のチェックで直している語を「反映する」前に保存すると、確かめる（前は語が入らないまま「保存しました」）
// - ボタンをダブルクリックしても、確認の窓がすぐ閉じない
// - 新年度は 2000〜2100（2207 などの打ち間違いで作らない）。Enter でも作成する
// - 先生を外すときに「管理者が1人だけ」と出さない。まとめて登録したあと、役割は「先生」に戻る
// - スマホ：見本の本文が全部のページ出る。「戻る」で一覧へ戻る（管理ページの外へ出ない）
// - 「学生の画面を試す」は、保存した今の設定で開く（前は、前に開いたときの設定のまま）
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const KEY = 'sotsugyo-admin-mock'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

async function open(context, { teacher = false, phone = false, reset = false } = {}) {
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  // ブラウザの確認（タブを離れるときなど）が出たら、記録して進める
  page.on('dialog', (d) => {
    console.log(`（ブラウザの確認：${d.message() || d.type()}）`)
    void d.accept()
  })
  if (phone) await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: IPHONE })
  else await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html${teacher ? '?as=teacher' : ''}`, { waitUntil: 'networkidle0' })
  if (reset) {
    await page.evaluate((key) => localStorage.removeItem(key), KEY)
    await page.reload({ waitUntil: 'networkidle0' })
  }
  await page.waitForSelector('.side-nav')
  return page
}
const store = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY)
/** 試験用サーバーに、準備中の年度を足す（公開中の年度の写し。更新日時は少し前） */
const addDraftYear = (page, year) =>
  page.evaluate(
    (key, year) => {
      const s = JSON.parse(localStorage.getItem(key))
      const from = s.years.find((y) => y.status === '公開中')
      s.years.push({ year, status: '準備中', config: { ...from.config, fiscalYear: year }, updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'admin@example.ac.jp' })
      localStorage.setItem(key, JSON.stringify(s))
    },
    KEY,
    year,
  )
// 2つのタブを行き来するので、操作の前に、そのタブを前に出す（後ろのタブは、画面の描き直しが止まる）
const nav = async (page, title) => {
  await page.bringToFront()
  await page.evaluate((title) => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes(title))?.click(), title)
}
const button = async (page, text, scope = 'body') => {
  await page.bringToFront()
  return page.evaluate(
    (text, scope) => {
      const b = [...document.querySelector(scope).querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(text) && x.offsetParent !== null && !x.disabled)
      b?.click()
      return !!b
    },
    text,
    scope,
  )
}
const headSave = async (page) => {
  await page.bringToFront()
  await page.evaluate(() => [...document.querySelectorAll('.save-group button, .dirty-bar button')].find((b) => b.offsetParent !== null && !b.disabled && b.textContent.includes('保存'))?.click())
}
/** 確認の窓を待って、その言葉を返す（出なければ null） */
const confirmText = async (page, timeout = 5000) => {
  const modal = await page.waitForSelector('.confirm-modal', { timeout }).catch(() => null)
  return modal ? modal.evaluate((m) => m.dataset.text ?? '') : null
}
const answer = async (page, ok) => {
  await page.evaluate((ok) => {
    const m = document.querySelector('.confirm-modal')
    const b = ok ? m.querySelector('[data-confirm="ok"]') : [...m.querySelectorAll('.row-buttons .btn')].find((x) => x.textContent.trim() === 'やめる')
    b.click()
  }, ok)
  await page.waitForFunction(() => !document.querySelector('.confirm-modal'), { timeout: 5000 })
}
const typeInto = async (page, selector, text) => {
  await page.bringToFront()
  // 欄の字を全部選んでから打つ（3回押しでは、「」の中だけが選ばれることがある）
  await page.click(selector)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text)
}
const messageText = (page) => page.evaluate(() => [...document.querySelectorAll('.message')].map((m) => m.innerText).join(' / '))
const idle = (page) => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15000 })

await withEdge(async (browser) => {
  // ---- 別のタブ（同じ人の2つのタブ）
  {
    const context = await browser.createBrowserContext()
    const a = await open(context, { reset: true })
    await addDraftYear(a, 2027)
    await a.reload({ waitUntil: 'networkidle0' })
    const b = await open(context)
    for (const p of [a, b]) {
      await p.bringToFront()
      await p.select('select[aria-label="年度"]', '2027')
      await wait(500)
    }
    await nav(b, '年度の設定')
    await b.waitForSelector('#y-commonTitle')
    await typeInto(b, '#y-commonTitle', '下書きの題目（まだ学生に見せない）')
    // タブA で 2027年度を公開する
    await a.bringToFront()
    await a.click('#publish-btn')
    await confirmText(a)
    await answer(a, true)
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).years.find((y) => y.year === 2027).status === '公開中', { timeout: 10000 }, KEY)
    // 前から開いていたタブB で保存
    await headSave(b)
    const asked = await confirmText(b, 1500)
    if (asked !== null) await answer(b, true)
    await wait(800)
    await idle(b)
    const after = (await store(b)).years.find((y) => y.year === 2027)
    const msg = await messageText(b)
    const kept = await b.$eval('#y-commonTitle', (i) => i.value)
    check(
      '別のタブで公開したあと、前から開いていたタブの保存は、学生に届けずに断る（公開になったと伝え、自分の変更は画面に残す）',
      after.config.commonTitle !== '下書きの題目（まだ学生に見せない）' && msg.includes('「公開中」になっていた') && kept === '下書きの題目（まだ学生に見せない）',
      `${after.config.commonTitle} / 画面の題目：${kept} / ${msg.slice(0, 60)}`,
    )

    // 消した年度：タブA で削除、タブB で保存しても作り直さない
    await addDraftYear(a, 2028)
    for (const p of [a, b]) {
      await p.bringToFront()
      await p.reload({ waitUntil: 'networkidle0' })
      await p.waitForSelector('.side-nav')
      await p.select('select[aria-label="年度"]', '2028')
      await wait(500)
      await nav(p, '年度の設定')
    }
    await b.waitForSelector('#y-commonTitle')
    await typeInto(b, '#y-commonTitle', '消した年度の題目')
    await a.waitForSelector('#y-commonTitle')
    await button(a, 'この年度を削除')
    await confirmText(a)
    await answer(a, true)
    await a.waitForFunction((key) => !JSON.parse(localStorage.getItem(key)).years.some((y) => y.year === 2028), { timeout: 10000 }, KEY)
    await headSave(b)
    const asked2 = await confirmText(b, 1500)
    if (asked2 !== null) await answer(b, true)
    await wait(800)
    await idle(b)
    check(
      '別のタブで消した年度は、古いタブで保存しても作り直さない（削除されていると伝える）',
      !(await store(b)).years.some((y) => y.year === 2028) && (await messageText(b)).includes('削除されています'),
      (await messageText(b)).slice(0, 90),
    )

    // 外した先生：タブA で外し、タブB（古い一覧）で役割を変えても登録し直さない
    for (const p of [a, b]) {
      await p.bringToFront()
      await p.reload({ waitUntil: 'networkidle0' })
      await p.waitForSelector('.side-nav')
      await nav(p, '先生の登録')
      await p.waitForSelector('.member-list')
    }
    await a.bringToFront()
    await a.evaluate(() => [...document.querySelectorAll('.member-list li')].find((li) => li.textContent.includes('sensei@example.ac.jp')).querySelector('button').click())
    const removeAsked = await confirmText(a)
    await answer(a, true)
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).members?.every((m) => m.email !== 'sensei@example.ac.jp'), { timeout: 10000 }, KEY)
    check('先生を外すときは、「管理者が1人だけになります」と出さない（先生を外しても、管理者の数は変わらない）', removeAsked !== null && !removeAsked.includes('管理者が1人だけ'), (removeAsked ?? '').replace(/\n/g, '⏎').slice(0, 80))
    await b.bringToFront()
    await b.select('select[aria-label="sensei@example.ac.jp の役割"]', '管理者')
    await confirmText(b)
    await answer(b, true)
    await idle(b)
    await wait(500)
    const errorLine = await b.evaluate(() => document.querySelector('.member-err, .members .err, [role="alert"]')?.textContent ?? document.body.innerText.match(/[^\n]*外されています[^\n]*/)?.[0] ?? '')
    check(
      '別のタブで外した先生の役割を、古い一覧から変えても、登録し直さない（外されていると伝える）',
      !(await store(b)).members.some((m) => m.email === 'sensei@example.ac.jp') && errorLine.includes('外されています'),
      errorLine.slice(0, 90),
    )

    // まとめて登録：「管理者」で登録したら、役割は「先生」に戻る
    await b.bringToFront()
    await b.reload({ waitUntil: 'networkidle0' })
    await b.waitForSelector('.side-nav')
    await nav(b, '先生の登録')
    await b.waitForSelector('textarea[aria-label="登録するメールアドレス"]')
    await b.type('textarea[aria-label="登録するメールアドレス"]', '新しい 管理者 <new-admin@example.ac.jp>')
    await b.select('select[aria-label="登録する人の役割"]', '管理者')
    await button(b, '登録する', '.member-add')
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).members.some((m) => m.email === 'new-admin@example.ac.jp'), { timeout: 10000 }, KEY)
    await idle(b)
    const role = await b.$eval('select[aria-label="登録する人の役割"]', (s) => s.value)
    const added = (await store(b)).members.find((m) => m.email === 'new-admin@example.ac.jp')
    check('まとめて登録したあと、役割の欄は「先生」に戻る（次に貼り付けた人が、知らないうちに管理者にならない）', added?.role === '管理者' && role === '先生', `${added?.role} / ${role}`)
    await context.close()
  }

  // ---- うっかり（管理者）：ダブルクリック・新年度
  {
    const context = await browser.createBrowserContext()
    const page = await open(context, { reset: true })
    await nav(page, '年度の設定')
    await page.waitForSelector('#y-commonTitle')
    await typeInto(page, '#y-commonTitle', 'ダブルクリックの題目')
    const box = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.save-group button')].find((b) => b.offsetParent !== null).getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.click(box.x, box.y, { clickCount: 2 })
    await wait(900)
    check('保存のボタンをダブルクリックしても、確認の窓がすぐ閉じない', !!(await page.$('.confirm-modal')))
    if (await page.$('.confirm-modal')) await answer(page, false)
    // 変更をやめて、新年度を作る
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.side-nav')
    await nav(page, '年度の設定')
    await page.waitForSelector('#y-commonTitle')
    await button(page, '新年度を作成')
    await page.waitForSelector('.modal input.in')
    await typeInto(page, '.modal input.in', '2207')
    const off = await page.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((b) => b.textContent.includes('作成する'))?.disabled)
    await typeInto(page, '.modal input.in', '2027')
    const on = await page.evaluate(() => [...document.querySelectorAll('.modal .btn.primary')].find((b) => b.textContent.includes('作成する'))?.disabled === false)
    await page.keyboard.press('Enter')
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).years.some((y) => y.year === 2027), { timeout: 10000 }, KEY).catch(() => {})
    const created = (await store(page)).years.some((y) => y.year === 2027)
    check('新年度：2207（2000〜2100 の外）は作成できない。2027 なら Enter でも作成する', off === true && on && created, `${off} ${on} ${created}`)

    // 手順書のリンク：https:// で始まらなければ、欄の下にエラー
    await page.waitForSelector('#y-handbook')
    await typeInto(page, '#y-handbook', 'drive.google.com/file/d/abc')
    await wait(300)
    const linkError = await page.evaluate(() => document.querySelector('#y-handbook').closest('.ctl')?.parentElement?.innerText ?? '')
    check('手順書のリンクが https:// で始まらないと、欄の近くにエラーが出る', linkError.includes('https:// で始まるアドレス'), linkError.replace(/\s+/g, ' ').slice(0, 80))
    await typeInto(page, '#y-handbook', 'https://drive.google.com/file/d/abc')
    await wait(300)
    const linkOk = await page.evaluate(() => !(document.querySelector('#y-handbook').closest('.ctl')?.parentElement?.innerText ?? '').includes('https:// で始まるアドレス'))
    // 保存した直後に書き足したら、「✓ 保存しました」は消えて「保存していない変更」になる
    await headSave(page)
    if ((await confirmText(page, 1500)) !== null) await answer(page, true)
    await page.waitForFunction(() => !!document.querySelector('.save-group .done, .save-group [class*="done"]') || document.querySelector('.save-group')?.innerText.includes('保存しました'), { timeout: 10000 }).catch(() => {})
    await typeInto(page, '#y-commonTitle', '保存の直後に書き足した題目')
    await wait(300)
    const state = await page.$eval('.save-group', (g) => g.innerText.replace(/\s+/g, ' '))
    check('https:// で始まるリンクなら、エラーは消える。保存の直後に書き足すと、「保存しました」の代わりに「保存していない変更」と出る', linkOk && !state.includes('保存しました') && state.includes('保存していない変更'), state.slice(0, 60))

    // 詳細設定の誤りは、欄のすぐ下に出す。ほかの区切りの上の一覧には、直す区切りを書き添える
    await nav(page, '詳細設定')
    await page.waitForSelector('#d-university')
    await typeInto(page, '#d-university', ' ')
    await page.keyboard.press('Backspace')
    await wait(300)
    const atField = await page.evaluate(() => document.querySelector('#d-university').closest('.ctl')?.querySelector('.field-problems')?.innerText ?? '')
    const atTop = await page.evaluate(() => document.querySelector('.problems')?.innerText ?? '')
    await nav(page, 'コース')
    await wait(400)
    const elsewhere = await page.evaluate(() => document.querySelector('.problems')?.innerText ?? '')
    check(
      '詳細設定の誤り（大学名が空）は欄のすぐ下に出る。コースの区切りの上には「（「詳細設定」で直します）」と書き添える',
      atField.includes('大学名を入力してください') && !atTop.includes('大学名') && elsewhere.includes('大学名を入力してください（「詳細設定」で直します）'),
      `${atField.slice(0, 30)} / ${elsewhere.replace(/\s+/g, ' ').slice(0, 60)}`,
    )
    await context.close()
  }

  // ---- 先生：書き方のチェックで直している語を反映せずに保存
  {
    const context = await browser.createBrowserContext()
    const page = await open(context, { teacher: true, reset: true })
    await nav(page, 'コース')
    await page.waitForSelector('textarea.notice')
    await typeInto(page, 'textarea.notice', '先生のお知らせ')
    await nav(page, '書き方のチェック')
    await wait(400)
    await button(page, '語を足す')
    await page.waitForSelector('.wedit input')
    const inputs = await page.$$('.wedit input')
    await inputs[0].type('接着心')
    await inputs[1].type('接着芯')
    await headSave(page)
    const asked = await confirmText(page)
    check('書き方のチェックで直している語を「反映する」前に保存すると、「反映していない語があります」と確かめる', (asked ?? '').includes('まだ「反映する」を押していません'), (asked ?? '(窓なし)').slice(0, 60))
    await answer(page, false)
    const kept = await store(page)
    check('「やめる」なら保存しない（お知らせも保存しない）', kept.years[0].config.courses[0].notice !== '先生のお知らせ')
    // 語を反映して保存すると、語も入る
    await button(page, '反映する', '.wedit')
    await headSave(page)
    const second = await confirmText(page)
    if (second !== null) await answer(page, true)
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).years[0].config.courses[0].notice === '先生のお知らせ', { timeout: 10000 }, KEY)
    const saved = (await store(page)).years[0].config
    check('「反映する」を押してから保存すると、語もお知らせも入る', saved.wordChecks.some((w) => w.wrong === '接着心') && !(second ?? '').includes('反映していない'), (second ?? '').slice(0, 50))

    // 学生の画面を試す：保存した今の設定で開く（前に開いたタブを閉じてから、お知らせを変えて開き直す）。
    // 見本の原稿のコースは見本しだいなので、お知らせは、どのコースにも入れる（サーバーに保存したことにして、管理ページを読み込み直す）
    const setAllNotices = async (text) => {
      await page.evaluate(
        (key, text) => {
          const s = JSON.parse(localStorage.getItem(key))
          s.years[0].config.courses.forEach((c) => (c.notice = text))
          s.years[0].updatedAt = new Date().toISOString()
          localStorage.setItem(key, JSON.stringify(s))
        },
        KEY,
        text,
      )
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('.side-nav')
    }
    const openTrial = async () => {
      const opened = new Promise((resolve) => browser.once('targetcreated', (t) => resolve(t.page())))
      await nav(page, '学生の画面を試す')
      await wait(500)
      await button(page, '見本の原稿で開く')
      const trial = await opened
      // 新しいタブは小さい画面（スマホの作り）で開くので、パソコンの大きさにする（お知らせは右の欄に出る）
      await trial.setViewport({ width: 1440, height: 900 })
      await trial.waitForSelector('.notice p', { timeout: 60000 }).catch(() => {})
      return trial
    }
    const shownNotice = (trial) => trial.evaluate(() => document.querySelector('.notice p')?.textContent ?? '')
    await setAllNotices('お試しのお知らせA')
    let trial = await openTrial()
    const first = await shownNotice(trial)
    await trial.close()
    await page.bringToFront()
    await setAllNotices('お試しのお知らせB')
    trial = await openTrial()
    await trial.waitForFunction(() => document.querySelector('.notice p')?.textContent === 'お試しのお知らせB', { timeout: 15000 }).catch(() => {})
    const reopened = await shownNotice(trial)
    check('「学生の画面を試す」は、前に開いたあとに保存したお知らせで開く（前は、前に開いたときの設定のまま）', first === 'お試しのお知らせA' && reopened === 'お試しのお知らせB', `${first} → ${reopened}`)
    await trial.close()
    await context.close()
  }

  // ---- スマホ：見本の本文・「戻る」
  {
    const context = await browser.createBrowserContext()
    const page = await open(context, { phone: true, reset: true })
    await nav(page, '年度の設定')
    await page.waitForSelector('.pv-show')
    await page.evaluate(() => document.querySelector('.pv-show').click())
    await wait(2500)
    const label = await page.$eval('.stage .pv-label', (e) => e.textContent.replace(/\s+/g, ''))
    check('スマホ：見本を開くと、本文の全部のページ（表紙・抄録と本文3ページ）を送れる', /\/5$/.test(label), label)
    await page.evaluate(() => document.querySelector('.pv-close')?.click())
    await wait(300)
    await page.goBack()
    await wait(600)
    const back = await page.evaluate(() => ({ url: location.pathname, list: !!document.querySelector('.admin.phone-list') }))
    check('スマホ：区切りを開いてから「戻る」を押すと、一覧へ戻る（管理ページの外へ出ない）', back.url.endsWith('/admin.html') && back.list, JSON.stringify(back))
    await nav(page, 'コース')
    await wait(400)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('管理ページの一覧') && b.offsetParent !== null)?.click())
    await wait(400)
    const listAgain = await page.evaluate(() => !!document.querySelector('.admin.phone-list'))
    await page.goBack()
    await wait(600)
    const sectionAgain = await page.evaluate(() => ({ url: location.pathname, list: !!document.querySelector('.admin.phone-list') }))
    check('スマホ：「‹ 管理ページの一覧」で戻ったあとに「戻る」を押すと、前に見ていた区切りが出る', listAgain && sectionAgain.url.endsWith('/admin.html') && !sectionAgain.list, JSON.stringify(sectionAgain))

    // 見本を閉じると、開く前に見ていた位置に戻る（下の方の余白の欄から、いちばん上へ戻されない）
    await nav(page, '詳細設定')
    await wait(500)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await wait(300)
    const before = await page.evaluate(() => window.scrollY)
    await page.evaluate(() => document.querySelector('.pv-show').click())
    await wait(1500)
    await page.evaluate(() => document.querySelector('.pv-close').click())
    await wait(500)
    const after = await page.evaluate(() => window.scrollY)
    check('スマホ：見本を閉じると、開く前に見ていた位置に戻る', before > 300 && Math.abs(after - before) < 5, `${before} → ${after}`)

    // 下の方で保存を押して断られたら、その知らせが見出しの裏に隠れずに見える
    await nav(page, '年度の設定')
    await page.waitForSelector('#y-commonTitle')
    await typeInto(page, '#y-commonTitle', ' ')
    await page.keyboard.press('Backspace')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await wait(300)
    await headSave(page)
    await page.waitForSelector('.message.ng', { timeout: 5000 }).catch(() => {})
    await wait(600)
    const seen = await page.evaluate(() => {
      const m = document.querySelector('.message.ng')?.getBoundingClientRect()
      const head = document.querySelector('.admin-header').getBoundingClientRect()
      return m ? { top: Math.round(m.top), headBottom: Math.round(head.bottom), bottom: Math.round(m.bottom), h: innerHeight } : null
    })
    check('スマホ：下の方で保存を押して断られたら、その知らせが見出しの裏に隠れずに見える', !!seen && seen.top >= seen.headBottom && seen.bottom <= seen.h, JSON.stringify(seen))
    await context.close()
  }
})

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} 件 合格`)
process.exit(passed === results.length ? 0 : 1)
