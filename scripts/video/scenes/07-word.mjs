// 動画 7：Word からの移し方（今年度だけ。パソコン）（依頼者 2026-11-06：「使い方」に動画を足す。おすすめ順の1つ目）
// はじめての案内で「Word で書き始めていますか？」に「はい」→ 本文・表紙・目次の Word を選ぶ →「中身を確かめる」→「読み込む」
// → ふりがなを聞かれて入れる → 右の欄の「つぎにすること」→ 赤い「直すところ」を押して直す（見頃 → 身頃）。
// Word は、見本「シンドバッド」の不備のある途中の Word（見頃・（図4）の抜け・「〜しました」）と、目次の Word（本文にまだない見出しも書いてある）
import { resolve } from 'node:path'

const SAMPLE = resolve('../見本_シンドバッド（新）')
const FILES = [`${SAMPLE}/不備のある途中のWord/04_本文.docx`, `${SAMPLE}/不備のある途中のWord/01_表紙.docx`, `${SAMPLE}/途中まで書いたWord/03_目次.docx`]

export const meta = {
  number: '7',
  label: 'Word からの移し方',
  device: 'pc',
  open: { guide: true },
  captions: {
    word: 'Word で書き始めていたら、はじめての案内で「はい」を押します',
    files: '本文の Word を選びます。表紙・目次の Word もあれば、一緒に選びます',
    check: '「中身を確かめる」を押すと、写す章・図・表が一覧で出ます',
    import: '確かめたら、「読み込む」を押します',
    kana: '氏名のふりがなを聞かれたら、カタカナで入れます',
    todo: '右の欄の「つぎにすること」を、上から順に確かめます',
    fix: '赤い「直すところ」を押すと、その場所へ移ります。正しく書き直します',
    pages: '図の大きさが Word と変わるので、改ページの位置は、全部のページを見て確かめます',
    end: '読み込んだあとは、ツールで続きを書いていきます',
  },
}

export async function run({ page, rec, h }) {
  // コース（映画・舞台衣装デザイナー）を選び、「Word で書き始めていますか？」へ
  await page.waitForSelector('.guide.step-course .g-opts button')
  await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画・舞台衣装')).click())
  await page.waitForSelector('.guide.step-word .g-word-opt.yes')
  await h.ready(page)
  await h.sleep(500)
  rec.mark('word', { focus: await h.rectOf(page, '.g-tip') })
  await h.sleep(2400)
  await h.clickEl(page, '.g-word-opt.yes', null, { pause: 600 })
  await page.waitForSelector('.modal.word-mid')
  await h.sleep(600)

  // 本文・表紙・目次の Word を選ぶ（行ごとの「選ぶ」から）
  rec.mark('files', { focus: await h.rectOf(page, '.modal.word-mid') })
  await h.sleep(1600)
  for (let i = 0; i < FILES.length; i++) {
    const b = await page.evaluate((i) => {
      const r = document.querySelectorAll('.word-file .acts button:not(.link)')[i].getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, i)
    await h.moveTo(page, b.x, b.y)
    await h.sleep(500)
    await h.chooseFile(page, b.x, b.y, [FILES[i]])
    await h.sleep(700)
  }
  await h.sleep(600)

  // 中身を確かめる
  const checkBtn = await h.centerOf(page, '.modal .row-buttons button', '中身を確かめる')
  rec.mark('check', { focus: await h.rectOf(page, '.modal.word-mid') })
  await h.moveTo(page, checkBtn.x, checkBtn.y)
  await h.sleep(1400)
  await h.clickAt(page, checkBtn.x, checkBtn.y, { pause: 300 })
  await page.waitForSelector('.modal.word-modal', { timeout: 60000 })
  await h.sleep(1200)
  // 一覧を少し下へ（章・図・表の数が見えるように）
  await page.evaluate(() => document.querySelector('.modal.word-modal .body, .modal.word-modal')?.scrollBy?.({ top: 260, behavior: 'smooth' }))
  await h.sleep(2200)

  // 読み込む
  const importBtn = await h.centerOf(page, '.modal .row-buttons button', '読み込む')
  rec.mark('import', { focus: await h.rectOf(page, '.modal.word-modal') })
  await h.moveTo(page, importBtn.x, importBtn.y)
  await h.sleep(1400)
  await h.clickAt(page, importBtn.x, importBtn.y, { pause: 300 })

  // 氏名のふりがな（姓・名は Word から入っている）
  await page.waitForSelector('.guide.step-name .name-fields input', { timeout: 60000 })
  await h.ready(page)
  await h.sleep(500)
  rec.mark('kana', { focus: h.union(await h.rectOf(page, '.g-tip'), await h.rectOf(page, '.guide .name-fields')) })
  await h.sleep(1600)
  for (const [cls, text] of [['nf-familyKana', 'ブンカ'], ['nf-givenKana', 'ハナコ']]) {
    await h.clickEl(page, `.guide .${cls} input`)
    await h.typeSlow(page, text)
    await h.sleep(300)
  }
  await h.sleep(600)
  await h.clickEl(page, '.guide.step-name .g-actions .primary', null, { pause: 500 })
  // ふりがなだけを聞いたときは、そのまま閉じる。ほかもまだなら「表紙ができました」→ 本文へ
  await page.waitForFunction(() => !document.querySelector('.guide') || document.querySelector('.guide.step-done .g-actions .primary'), { timeout: 15000 }).catch(() => {})
  if (await page.$('.guide.step-done .g-actions .primary')) await page.evaluate(() => document.querySelector('.guide.step-done .g-actions .primary').click())
  await h.ready(page)
  await page.waitForSelector('.word-todo', { timeout: 30000 })
  await h.sleep(800)

  // つぎにすること
  rec.mark('todo', { focus: await h.rectOf(page, '.word-todo') })
  await h.sleep(3200)

  // 直すところ：見頃 → 身頃
  const issue = await h.centerOf(page, '.side .issue', '見頃')
  if (!issue) throw new Error('「見頃」の指摘が見つかりません')
  rec.mark('fix', { focus: h.union(await h.rectOf(page, '.side .issue', '見頃'), await h.rectOf(page, '.word-todo')) })
  await h.moveTo(page, issue.x, issue.y)
  await h.sleep(1600)
  await h.clickAt(page, issue.x, issue.y, { pause: 300 })
  await page.waitForFunction(() => !!window.__editor.getSnapshot().editingId, { timeout: 30000 })
  await h.ready(page).catch(() => {})
  await h.sleep(1200)
  // カーソルは「見頃」のすぐ後ろに来る（動画4と同じ）。Backspace で消して打ち直す
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Backspace')
    await h.sleep(250)
  }
  await h.typeSlow(page, '身頃')
  await h.sleep(900)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(800)

  // 改ページの位置（「本文へ」で本文の最初のページへ）
  const go = await h.centerOf(page, '.word-todo li .go', '本文へ')
  rec.mark('pages', { focus: await h.rectOf(page, '.word-todo') })
  if (go) {
    await h.moveTo(page, go.x, go.y)
    await h.sleep(1500)
    await h.clickAt(page, go.x, go.y, { pause: 300 })
    await h.ready(page)
    await h.sleep(1200)
    for (let i = 0; i < 3; i++) {
      await h.clickEl(page, '.stage .arrow.next', null, { pause: 300 })
      await h.ready(page)
      await h.sleep(700)
    }
  } else await h.sleep(3000)

  rec.mark('end', { full: true })
  await h.sleep(2600)
}
