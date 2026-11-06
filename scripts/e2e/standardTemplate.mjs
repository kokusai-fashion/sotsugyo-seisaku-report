// 標準のひな形（ひな形を作っていないコースに出る）を、管理者が「詳細設定」で直す（依頼者 2026-11-06：mockups/v116 案B。admin.mjs から呼ぶ。試験用サーバーで）
// - 詳細設定のいちばん下に「標準のひな形」のカード（今の組み立て・使っているコース・ひな形を作る画面を開く。上の「Google の障害のとき」を押し下げない）
// - コースのひな形と同じ「ひな形を作る画面」が、標準のひな形として開く（帯・右の欄・「はじめの形に戻す」）
// - 直して「管理ページに戻して反映」→ 変更あり・保存の帯 → 保存すると、年度の設定に standardTemplate が入る。書き出し例は、年度の共通の書き出し例になる
// - 「はじめの形に戻す」で反映すると、年度の設定に持たない（はじめの形のまま）
// - 先生の画面には出ない（先生の管理ページには「詳細設定」がない）
// 画面の写真は poc-output/standard-template/ に置く
import { mkdirSync } from 'node:fs'
import { answerConfirms } from './confirmUi.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'poc-output/standard-template'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function standardTemplateAdmin(browser, check) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror(standard-template):', e.message))
  const confirms = []
  page.on('dialog', (d) => d.accept())
  await answerConfirms(page, (message) => {
    confirms.push(message)
    return true
  })
  await page.setViewport({ width: 1366, height: 820 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.removeItem('sotsugyo-admin-mock')
    localStorage.removeItem('sotsugyo-admin-year')
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .content')
  const goDetails = () => page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
  await goDetails()
  await page.waitForSelector('.card.std-template')
  await page.evaluate(() => document.querySelector('.card.std-template').scrollIntoView({ block: 'center' }))
  await sleep(300)

  const card = () =>
    page.evaluate(() => {
      const c = document.querySelector('.card.std-template')
      return {
        last: [...document.querySelectorAll('.content .card')].at(-1) === c,
        pdfFirst: document.querySelector('.content .card')?.classList.contains('pdf-folder') ?? false,
        head: c.querySelector('.card-h').textContent,
        rows: [...c.querySelectorAll('.lb')].map((l) => l.textContent).join('|'),
        parts: c.querySelector('.ctl b')?.textContent ?? '',
        users: c.querySelectorAll('.ctl')[1]?.textContent ?? '',
        hint: c.querySelector('.ctl .hint')?.textContent ?? '',
        changed: !!c.querySelector('.chg, .changed, [class*="changed"]'),
        button: c.querySelector('.std-open')?.textContent ?? '',
      }
    })
  const c0 = await card()
  await page.screenshot({ path: `${OUT}/1-details-card.png` })
  check(
    '詳細設定のいちばん下に「標準のひな形」のカード（今の組み立て・使っているコース・ひな形を作る画面を開く）。いちばん上は PDF の控えのフォルダのまま',
    c0.last &&
      c0.pdfFirst &&
      c0.head === '標準のひな形ひな形を作っていないコースに出ます' &&
      c0.rows.startsWith('今の組み立て') &&
      c0.rows.includes('使っているコース') &&
      c0.rows.includes('直す') &&
      c0.parts === '企画・立案／制作過程／まとめ' &&
      c0.hint === 'はじめの形のままです' &&
      c0.users === '今はありません（どのコースも、ひな形を作っています）' &&
      c0.button === 'ひな形を作る画面を開く',
    JSON.stringify(c0),
  )

  /** 「ひな形を作る画面を開く」を押して、ツールが開くまで待つ。開いた枠を返す */
  const openScreen = async () => {
    await page.evaluate(() => document.querySelector('.card.std-template .std-open').click())
    await page.waitForSelector('.tpl-overlay iframe')
    await page.waitForFunction(() => !document.querySelector('.tpl-opening'), { timeout: 30000 })
    const frame = page.frames().find((f) => f.url().includes('template=1') && f.parentFrame() === page.mainFrame())
    await frame.waitForFunction(() => { const s = window.__editor?.getSnapshot(); return s?.layout && !s.rendering && !s.turning && s.page === window.__editor.pageOfArea('body') }, { timeout: 60000 })
    await sleep(600)
    return frame
  }
  const frame = await openScreen()
  const screen = await frame.evaluate(() => ({
    banner: document.querySelector('.tpl-banner')?.textContent ?? '',
    title: document.querySelector('.tpl-panel h2')?.textContent ?? '',
    sub: document.querySelector('.tpl-course')?.textContent ?? '',
    buttons: [...document.querySelectorAll('.tpl-foot button')].map((b) => b.textContent).join('|'),
    chapters: window.__editor.getSnapshot().report.body.map((c) => c.title).join('／'),
  }))
  const label = await page.evaluate(() => document.querySelector('.tpl-window').getAttribute('aria-label'))
  await page.screenshot({ path: `${OUT}/2-standard-screen.png` })
  check(
    '標準のひな形として開く（帯・右の欄・「はじめの形に戻す」。紙面は今の標準のひな形）',
    screen.banner === 'ひな形を作っています：標準のひな形（学生の画面ではありません）' &&
      screen.title === '標準のひな形' &&
      screen.sub === 'ひな形を作っていないコースに出ます' &&
      screen.buttons === '管理ページに戻して反映|閉じる|はじめの形に戻す' &&
      screen.chapters === '企画・立案／制作過程／まとめ' &&
      label === '標準のひな形を直す画面',
    JSON.stringify({ ...screen, label }),
  )

  // 大見出しの名前と、抄録の書き出し例を直して、管理ページに戻す
  await frame.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c, i) => (i === 0 ? { ...c, title: '制作の概要' } : c)),
      abstract: { ...r.abstract, paragraphs: r.abstract.paragraphs.map((p, i) => (i === 0 ? { ...p, content: [{ type: 'text', text: '本報告書は、' }] } : p)) },
    })),
  )
  await sleep(300)
  await frame.evaluate(() => document.querySelector('.tpl-primary').click())
  await page.waitForFunction(() => !document.querySelector('.tpl-overlay'), { timeout: 10000 })
  await sleep(300)
  await page.evaluate(() => document.querySelector('.card.std-template').scrollIntoView({ block: 'center' }))
  await sleep(200)
  const c1 = await card()
  const after = await page.evaluate(() => ({
    message: document.querySelector('.message')?.textContent ?? '',
    bar: document.querySelector('.dirty-bar')?.textContent ?? '',
    opening: document.querySelector('#d-openingExample')?.value ?? '',
  }))
  await page.screenshot({ path: `${OUT}/3-applied.png` })
  check(
    '反映すると、カードが直した組み立てに変わり（変更あり）、書き出し例は共通の書き出し例に入る。保存の帯が出る',
    c1.parts === '制作の概要／制作過程／まとめ' && c1.hint.startsWith('この年度で直してあります') && after.opening === '本報告書は、' && after.bar.includes('保存') && after.message.includes('反映'),
    JSON.stringify({ ...c1, ...after }),
  )

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('保存して学生に反映')).click())
  await page.waitForFunction(() => document.querySelector('.message.ok')?.textContent.includes('反映') && !document.querySelector('.dirty-bar'), { timeout: 15000 })
  const saved = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('sotsugyo-admin-mock'))
    const row = store.years.find((y) => y.status === '公開中')
    return { standard: row.config.standardTemplate?.filter((b) => b.type === 'chapter').map((b) => b.title).join('／') ?? null, opening: row.config.abstract.openingExample }
  })
  check(
    '保存すると、年度の設定に標準のひな形と共通の書き出し例が入る。保存の確認に「標準のひな形」が出る',
    saved.standard === '制作の概要／制作過程／まとめ' && saved.opening === '本報告書は、' && confirms.some((m) => m.includes('・標準のひな形')),
    JSON.stringify({ saved, confirm: confirms.at(-1)?.replace(/\n/g, '⏎') }),
  )

  // 「はじめの形に戻す」で反映すると、年度の設定に持たない
  const frame2 = await openScreen()
  const reopened = await frame2.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => c.title).join('／'))
  await frame2.evaluate(() => [...document.querySelectorAll('.tpl-foot button')].find((b) => b.textContent === 'はじめの形に戻す').click())
  await sleep(200)
  const ask = await frame2.evaluate(() => document.querySelector('.tpl-reset-ask span')?.textContent ?? '')
  await frame2.evaluate(() => document.querySelector('.tpl-reset-ask .tpl-danger').click())
  await sleep(400)
  const resetChapters = await frame2.evaluate(() => window.__editor.getSnapshot().report.body.map((c) => c.title).join('／'))
  await frame2.evaluate(() => document.querySelector('.tpl-primary').click())
  await page.waitForFunction(() => !document.querySelector('.tpl-overlay'), { timeout: 10000 })
  await sleep(300)
  const c2 = await card()
  const draftStandard = await page.evaluate(() => document.querySelector('.dirty-bar')?.textContent ?? '')
  check(
    '直した標準のひな形で開き直し、「はじめの形に戻す」→ 反映で、はじめの形に戻る（年度の設定には持たない）',
    reopened === '制作の概要／制作過程／まとめ' && ask === '本文を、はじめの形（企画・立案／制作過程／まとめ）に戻しますか？' && resetChapters === '企画・立案／制作過程／まとめ' && c2.parts === '企画・立案／制作過程／まとめ' && c2.hint === 'はじめの形のままです' && draftStandard.includes('保存'),
    JSON.stringify({ reopened, ask, resetChapters, c2 }),
  )
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('保存して学生に反映')).click())
  await page.waitForFunction(() => !document.querySelector('.dirty-bar'), { timeout: 15000 })
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('sotsugyo-admin-mock')).years.find((y) => y.status === '公開中').config.standardTemplate)
  check('はじめの形に戻して保存すると、年度の設定から標準のひな形がなくなる', cleared === undefined, JSON.stringify(cleared))

  // 先生の画面には出ない
  const teacher = await context.newPage()
  await teacher.setViewport({ width: 1366, height: 820 })
  await teacher.goto(`${APP}/admin.html?as=teacher`, { waitUntil: 'networkidle0' })
  await teacher.waitForSelector('.admin .side-nav button')
  const t = await teacher.evaluate(() => ({ nav: [...document.querySelectorAll('.side-nav button')].map((b) => b.textContent).join('|'), card: !!document.querySelector('.std-template') }))
  check('先生の管理ページには、標準のひな形の入り口がない（詳細設定もない）', !t.nav.includes('詳細設定') && !t.card, t.nav)
  await context.close()
}
