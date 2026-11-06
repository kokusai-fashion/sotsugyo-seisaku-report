// 動画 8：抄録の書き方（パソコン）（依頼者 2026-11-06：「使い方」に動画を足す。おすすめ順の2つ目）
// 抄録のページの「先生の許可が出た」を押す → 書き出しの文が入る → 本文の文をなぞって選び「コピー」→ 抄録の段落の終わりで「貼り付け」
// → 字数は右の欄の「抄録」に出る。見本「シンドバッド」の抄録を、まだ書き始めていない形にしてから録る
// （スマホの長押しの「コピー」は、録画の道具では出ないので、パソコンの回だけにする）

export const meta = {
  number: '8',
  label: '抄録を書く',
  device: 'pc',
  captions: {
    start: '本文を書き終えて、先生の許可が出たら、抄録のページの「先生の許可が出た」を押します',
    opening: '書き出しの文が入ります。続きは、本文の文を写してまとめます',
    select: '本文の使いたい文を、マウスでなぞって選びます',
    copy: 'すぐ上に出る「コピー」を押します',
    paste: '抄録の段落の終わりをクリックし、Enter で新しい段落にして、「貼り付け」を押します',
    count: '字数と行数は、右の欄の「抄録」に出ます。つなぐ言葉を足して、字数に合わせてまとめます',
  },
}

export async function prepare({ page, h }) {
  // 抄録を、まだ書き始めていない形（「先生の許可が出た」のボタンが出る）にする
  await page.evaluate(() =>
    window.__editor.update((r) => ({ ...r, abstract: { started: false, paragraphs: [{ type: 'paragraph', id: r.abstract.paragraphs[0]?.id ?? 'a1', content: [] }] } })),
  )
  await h.sleep(500)
  await h.ready(page)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageElements().findIndex((p) => p.querySelector('[data-abstract-start]')), 'none'))
  await h.ready(page)
}

export async function run({ page, rec, h }) {
  // 1. 「先生の許可が出た」を押す
  const start = await h.centerOf(page, '.page-viewport.front [data-abstract-start]')
  if (!start) throw new Error('「先生の許可が出た」が見つかりません')
  rec.mark('start', { focus: await h.rectOf(page, '.page-viewport.front [data-vivliostyle-page-container].is-current') })
  await h.moveTo(page, start.x, start.y)
  await h.sleep(2600)
  await h.clickAt(page, start.x, start.y, { pause: 300 })
  await h.ready(page)
  await h.sleep(600)
  const first = await page.evaluate(() => window.__editor.getSnapshot().report.abstract.paragraphs[0].id)
  rec.mark('opening', { focus: await h.blockRect(page, first) })
  await h.sleep(2600)
  await page.keyboard.press('Escape').catch(() => {})
  await h.ready(page)

  // 2. 本文（1章の「担当衣装のキャラクター」の段落）の1文目をなぞって選ぶ（字幕は、本文のページへ移る前に替える）
  rec.mark('select', { full: true })
  await h.goToBlock(page, 'p1')
  const sentence = '筆者が担当したのは、物語の主人公である船乗りシンドバッドである。'
  // 紙面の文は、言葉の切れ目ごとの小さな字の並びに分かれているので、はじめの「筆」と、最初の「。」（1文目の終わり）で探す
  const head = await h.textRect(page, 'p1', '筆')
  const tail = await h.textRect(page, 'p1', '。')
  if (!head || !tail) throw new Error('本文の文が見つかりません：' + sentence)
  await h.moveTo(page, head.x + 1, head.y + head.h / 2)
  await h.sleep(1400)
  await page.mouse.down()
  await h.moveTo(page, tail.x + tail.w - 1, tail.y + tail.h / 2)
  await page.mouse.up()
  await h.sleep(900)

  // 3. 帯の「コピー」
  await page.waitForFunction(() => { const b = document.querySelector('.range-bar'); return b && !b.hidden }, { timeout: 10000 })
  const copy = await h.centerOf(page, '.range-bar .copy')
  rec.mark('copy', { focus: h.union(await h.rectOf(page, '.range-bar'), await h.blockRect(page, 'p1')) })
  await h.moveTo(page, copy.x, copy.y)
  await h.sleep(1400)
  await h.clickAt(page, copy.x, copy.y, { pause: 600 })
  await h.sleep(600)

  // 4. 抄録のページへ戻り、段落の終わりをクリックして「貼り付け」
  await h.goToBlock(page, first)
  const end = await h.endOfBlock(page, first)
  rec.mark('paste', { focus: await h.blockRect(page, first) })
  await h.moveTo(page, end.x, end.y)
  await h.sleep(1500)
  await h.clickAt(page, end.x, end.y, { pause: 300 })
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 20000 }, first)
  await h.sleep(800)
  await page.keyboard.press('Enter')
  await h.sleep(900)
  // 新しい段落では、書く欄の近くの「貼り付け」が出ないことがあるので、左の道具の「貼り付け」を押す（どちらも同じ働き）
  const chipShown = await page.evaluate(() => { const c = document.querySelector('.range-chip:not(.figure-chip)'); return !!c && !c.hidden && c.getBoundingClientRect().width > 0 })
  const paste = chipShown ? await h.centerOf(page, '.range-chip:not(.figure-chip)') : await h.centerOf(page, '.palette .tb', '貼り付け')
  if (!paste) throw new Error('「貼り付け」が見つかりません')
  await h.moveTo(page, paste.x, paste.y)
  await h.sleep(1200)
  await h.clickAt(page, paste.x, paste.y, { pause: 600 })
  await h.sleep(1500)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(600)

  // 5. 右の欄の「抄録」の字数
  const row = await h.rectOf(page, '.side li', '抄録')
  rec.mark('count', { focus: h.union(row, await h.blockRect(page, first)) })
  await h.sleep(3600)
}
