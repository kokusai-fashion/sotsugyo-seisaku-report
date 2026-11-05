// 管理ページの「詳細設定」の「PDF の控えのフォルダ」（依頼者の選択 2026-11-05 mockups/v112 案A）
// - 詳細設定のいちばん上に、今のフォルダの名前・「ドライブで開く」・中のつくり（年度 → コース）・フォルダを変える欄
// - リンクでない・編集できないフォルダは、その言葉で断る。リンクを貼って「このフォルダにする」で、すぐ変わる（年度の保存は要らない）
// これだけを流すときは node scripts/e2e/run.mjs pdfFolder1105
import { withEdge } from '../poc/edge.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`)
}

await withEdge(async (browser) => {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror:', e.message))
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${APP}/admin.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    for (const k of ['sotsugyo-admin-mock', 'sotsugyo-admin-mock-pdffolder']) localStorage.removeItem(k)
    sessionStorage.removeItem('sotsugyo-admin-section')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button')
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
  await page.waitForFunction(() => document.querySelector('.pdf-folder .pf-now b'), { timeout: 15000 })
  const first = await page.evaluate(() => {
    const card = document.querySelector('.pdf-folder')
    const cards = [...document.querySelectorAll('.content .card')]
    return {
      top: cards[0] === card,
      title: card.querySelector('.card-h').textContent,
      name: card.querySelector('.pf-now b').textContent,
      link: card.querySelector('.pf-now a')?.getAttribute('href') ?? '',
      tree: card.querySelector('.pf-tree').textContent,
      disabled: card.querySelector('.pf-change button').disabled,
    }
  })
  check(
    '詳細設定のいちばん上に「PDF の控えのフォルダ」：今のフォルダの名前と「ドライブで開く」、中のつくり（年度 → コース）。リンクを貼るまで「このフォルダにする」は押せない',
    first.top && first.title.startsWith('PDF の控えのフォルダ') && first.name === '卒業制作報告書　提出された PDF' && first.link.startsWith('https://drive.google.com/drive/folders/') && /\d{4}年度/.test(first.tree) && first.tree.includes('コースごと') && first.disabled,
    JSON.stringify(first),
  )
  const tryLink = async (text) => {
    await page.click('#d-pdfFolder', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.type('#d-pdfFolder', text)
    await page.click('.pdf-folder .pf-change button')
    await page.waitForFunction(() => document.querySelector('.pdf-folder .pf-ok, .pdf-folder .pf-change + .pf-error'), { timeout: 10000 })
    await wait(200)
    return page.evaluate(() => ({
      ok: document.querySelector('.pdf-folder .pf-ok')?.textContent ?? '',
      error: document.querySelector('.pdf-folder .pf-change + .pf-error')?.textContent ?? '',
      name: document.querySelector('.pdf-folder .pf-now b').textContent,
    }))
  }
  const bad = await tryLink('メモ')
  check('リンクでないものは「フォルダのリンクを貼ってください」と断り、フォルダは変わらない', bad.error.startsWith('フォルダのリンクを貼ってください') && bad.name === first.name, JSON.stringify(bad))
  const noaccess = await tryLink('https://drive.google.com/drive/folders/noaccess-0123456789')
  check('編集できないフォルダは「そのフォルダを編集できません」と断る', noaccess.error.startsWith('そのフォルダを編集できません') && noaccess.name === first.name, JSON.stringify(noaccess))
  const good = await tryLink('https://drive.google.com/drive/folders/abcdef-0123456789?usp=sharing')
  const dirty = await page.evaluate(() => !!document.querySelector('.dirty-bar'))
  check('リンクを貼って「このフォルダにする」で、すぐ変わる（「保存して学生に反映」は要らない）', good.ok.includes('にしました') && good.name.startsWith('新しいフォルダ（abcdef') && !dirty, JSON.stringify({ ...good, dirty }))
  // 開き直しても、変えたフォルダ
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.admin .side-nav button')
  await page.evaluate(() => [...document.querySelectorAll('.side-nav button')].find((b) => b.textContent.includes('詳細設定')).click())
  await page.waitForFunction(() => document.querySelector('.pdf-folder .pf-now b'), { timeout: 15000 })
  const again = await page.evaluate(() => document.querySelector('.pdf-folder .pf-now b').textContent)
  check('開き直しても、変えたフォルダのまま', again === good.name, again)
  await page.screenshot({ path: 'poc-output/pdf-folder-1105.png', captureBeyondViewport: false })
  await context.close()

  const passed = results.filter(Boolean).length
  console.log(`\n${passed}/${results.length} 件 合格`)
  if (passed !== results.length) process.exitCode = 1
})
