// 動画 9：先に「（図n）」と打ってから図を入れる（パソコン）（依頼者 2026-11-06：「使い方」に動画を足す。おすすめ順の3つ目）
// 見本「シンドバッド」の靴の図（r7：図8。いちばん後ろの図）を外しておき、靴の段落（p10）に、本当は図8の所を「（図9）」と打つ
// （途中の図を外すと、後ろの図の番号が繰り上がり、打った番号の図があることになるので、いちばん後ろの図を使う）
// → 右の欄に「「（図9）」の図がない」→ 番号にカーソルを置くと「図8を入れる」→ 押して写真を選ぶ → タイトル
// → 書いた「（図9）」が「（図8）」に直り、画面の下に知らせが出る（mockups/v115 案A）
import { resolve } from 'node:path'

export const meta = {
  number: '9',
  label: '先に「（図1）」と書いてから図を入れる',
  device: 'pc',
  captions: {
    type: '本文に、先に「（図○）」と番号を打っておくこともできます（ここでは、本当は図8の所に「（図9）」と打ちました）',
    error: 'まだその図がないので、右の欄に「『（図9）』の図がない」と出ます',
    chip: '番号にカーソルを置くと、すぐ上に「図8を入れる」が出ます。押して写真を選びます',
    caption: '図のタイトルを入力します',
    notice: '図の番号は図の順に付くので、書いた「（図9）」は「（図8）」に直り、画面の下に知らせが出ます',
  },
}

export async function prepare({ page, h }) {
  // 靴の図（r7）と、本文のその「（図8）」を外す
  await h.dropFigure(page, 'r7')
  await h.sleep(500)
  await h.ready(page)
  await h.acknowledgeAbstract(page)
  await h.goToBlock(page, 'p10')
}

export async function run({ page, rec, h }) {
  // 1. 「靴である」のすぐ後ろをクリックして「（図9）」と打つ
  const at = await h.textRect(page, 'p10', '靴である')
  if (!at) throw new Error('靴の段落が見つかりません')
  const x = at.x + at.w - 1
  const y = at.y + at.h / 2
  rec.mark('type', { focus: { ...(await h.blockRect(page, 'p10')), h: (await h.blockRect(page, 'p10')).h + 40 } })
  await h.moveTo(page, x, y)
  await h.sleep(1800)
  await h.clickAt(page, x, y, { pause: 300 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p10', { timeout: 20000 })
  await h.sleep(700)
  await h.typeSlow(page, '（図9）')
  await h.sleep(900)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(600)

  // 2. 右の欄のエラー
  const issue = await h.rectOf(page, '.side .issue', '（図9）')
  rec.mark('error', { focus: h.union(issue, await h.blockRect(page, 'p10')) })
  await h.sleep(3000)

  // 3. 「（図9）」にカーソルを置く →「図8を入れる」→ 写真を選ぶ
  const ref = (await h.textRect(page, 'p10', '（図9）')) ?? (await h.textRect(page, 'p10', '図9')) ?? (await h.textRect(page, 'p10', '9'))
  await h.moveTo(page, ref.x + ref.w / 2, ref.y + ref.h / 2)
  await h.sleep(500)
  await h.clickAt(page, ref.x + ref.w / 2, ref.y + ref.h / 2, { pause: 300 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p10', { timeout: 20000 })
  await page.waitForFunction(() => { const c = document.querySelector('.figure-chip'); return c && !c.hidden }, { timeout: 10000 })
  await h.sleep(400)
  const chip = await h.centerOf(page, '.figure-chip')
  rec.mark('chip', { focus: h.union(await h.rectOf(page, '.figure-chip'), await h.blockRect(page, 'p10')) })
  await h.moveTo(page, chip.x, chip.y)
  await h.sleep(2600)
  await h.chooseFile(page, chip.x, chip.y, [resolve('public/trial/w-shoes.jpg')])
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
  await h.ready(page).catch(() => {})
  await h.sleep(500)

  // 4. 図のタイトル
  rec.mark('caption', { full: true })
  await h.sleep(800)
  await h.typeSlow(page, '靴')
  await h.sleep(900)

  // 5. 書いた番号が直り、画面の下に知らせ
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(500)
  const toast = await h.rectOf(page, '.undo-toast')
  rec.mark('notice', { focus: toast ? h.union(toast, await h.blockRect(page, 'p10')) : await h.blockRect(page, 'p10') })
  await h.sleep(4200)
}
