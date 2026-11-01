// 動画 3：表・作品写真（パソコン）
// 2026-10-21 の画面：表の大きさはマス目で選ぶ・マスの中は Enter で改行・「表の形を整える」の窓で列の幅（そろえる・字の多い列を広く・自分で決める）、
// 作品写真は、つかんでずらしてトリミング・「写真のページを足す」（1ページに4枚まで）
// 見本「シンドバッド」の「i．ブラウス」の袖の段落（p5）の終わりに1文を書き足し、そこで「表を入れる」を押して「袖の寸法」の表を作る。
// 作品写真は、見本の1枚（正面）のページを「4枚」の並べ方にして、空いた枠に、後ろ・横・ターバンの写真（public/trial/ の w-back・w-side・w-turban）を
// まとめて入れる。見本の写真は縦長（3：4）なので、「2枚（左右）」にすると左右が大きく切れ、「作品写真が大きく切れている」と出るため（2026-10-29 からのチェック）。
// トリミングは、正方形のターバンの写真で見せる（4枚の枠は縦長なので、左右をずらせる）
import { resolve } from 'node:path'

export const meta = {
  number: '3',
  label: '表・作品写真',
  device: 'pc',
  captions: {
    table: '表を入れたい段落をクリックして、表の内容を紹介する文を書きます',
    tableBtn: '続けて、左の「表を入れる」を押します',
    kind: 'マス目の上で、表の大きさを選びます。1行目は見出しの行になります',
    tcaption: '表のタイトルを入力します。表の番号と、本文の「（表2）」は自動で入ります',
    cell: 'マスをクリックして、中身を入力します',
    newline: 'マスの中で改行したいときは、Enter を押します',
    widths: '列の幅を変えるときは、左の「表の形を整える」を押します',
    shapePanel: '絵を見て選ぶと、すぐに表の形が変わります',
    photos: '作品写真のページでは、左の「並べ方」で写真の枚数を選びます',
    photoAdd: '空いている枠をクリックして、入れる写真を選びます。何枚かまとめて選ぶこともできます',
    trim: '写真をつかんでずらすと、写る範囲を変えられます',
    pageAdd: '写真は1ページに4枚までです。もっと入れるときは「写真のページを足す」を押します',
    end: '作品写真のページが1ページ増えました。枠をクリックして写真を入れます',
  },
}

const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'

export async function prepare({ page, h }) {
  await h.goToBlock(page, 'p5')
}

/** 書いている表（いちばん新しい表）と、そのマスの位置 */
const tableNow = (page) =>
  page.evaluate(() => {
    const blocks = window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks)
    return blocks.filter((b) => b.type === 'table').at(-1)
  })
const cellCenter = (page, id) =>
  page.evaluate((id) => {
    const el = [...document.querySelectorAll(`.page-viewport.front [data-cell-id="${id}"]`)].find((e) => e.getBoundingClientRect().width > 0)
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
  }, id)
const box = (c) => ({ x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h })

export async function run({ page, rec, h }) {
  // 1. 段落の終わりをクリックして、表について書く1文を足し、「表を入れる」
  const p5 = await h.blockRect(page, 'p5')
  const btn = await h.centerOf(page, '.palette .tb', '表を入れる')
  rec.mark('table', { focus: { ...p5, y: p5.y - 20, h: p5.h + 60 } })
  const end = await h.endOfBlock(page, 'p5')
  await h.clickAt(page, end.x, end.y, { pause: 800 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p5', { timeout: 30000 })
  await h.sleep(400)
  await h.typeSlow(page, '袖の各部の寸法は、次のとおりである。')
  await h.sleep(700)
  rec.mark('tableBtn', { focus: h.union(await h.blockRect(page, 'p5'), box(btn)) })
  await h.moveTo(page, btn.x, btn.y)
  await h.sleep(1600)
  await h.clickAt(page, btn.x, btn.y, { pause: 300 })
  await page.waitForSelector('.palette .tgrid')
  await h.sleep(300)

  // 2. 表の大きさ：マス目の上で矢印を動かし、2列×3行を選ぶ（マス目は 6列×10行。左上から行ごとに並ぶ）
  rec.mark('kind', { focus: await h.rectOf(page, '.palette .table-menu') })
  await h.sleep(1100)
  const cellAt = (index) =>
    page.evaluate((index) => {
      const r = document.querySelectorAll('.palette .tgrid button')[index].getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, index)
  for (const index of [0, 7, 13]) {
    const c = await cellAt(index)
    await h.moveTo(page, c.x, c.y)
    await h.sleep(500)
  }
  await h.sleep(600)
  const pick = await cellAt(13)
  await h.clickAt(page, pick.x, pick.y, { pause: 250 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'tableCaption', { timeout: 30000 })
  // 表が入って紙面を組み直し終えてから、位置を測る
  await h.sleep(500)
  await h.ready(page)
  await h.sleep(400)

  // 3. 表のタイトル
  let table = await tableNow(page)
  const tableRect = async () => h.union(await h.blockRect(page, 'p5'), await h.blockRect(page, table.id))
  rec.mark('tcaption', { focus: await tableRect() })
  await h.sleep(1900)
  await h.typeSlow(page, '袖の寸法')
  await h.sleep(1000)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(400)

  // 4. マスに書く（見出しの行と、2行）。最後のマスは Enter で改行して2行に
  table = await tableNow(page)
  const tableOnly = async () => {
    const r = await h.blockRect(page, table.id)
    return { ...r, y: r.y - 20, h: r.h + 70 }
  }
  rec.mark('cell', { focus: await tableOnly() })
  await h.sleep(900)
  const write = async (cell, text) => {
    const c = await cellCenter(page, cell.id)
    await h.clickAt(page, c.x, c.y, { pause: 250 })
    await h.sleep(200)
    await h.typeSlow(page, text, 80)
    await h.sleep(150)
  }
  await write(table.rows[0].cells[0], '箇所')
  await write(table.rows[0].cells[1], '寸法')
  await write(table.rows[1].cells[0], '袖丈')
  await write(table.rows[1].cells[1], '68cm')
  await write(table.rows[2].cells[0], '袖幅')
  await write(table.rows[2].cells[1], '52cm')
  await h.sleep(300)
  rec.mark('newline', { focus: await tableOnly() })
  await h.sleep(1200)
  await page.keyboard.press('Enter')
  await h.sleep(500)
  await h.typeSlow(page, '（いちばん広い所）', 85)
  await h.sleep(1200)

  // 5. 列の幅：左の道具の「表の形を整える」を押すと、絵の付いた窓が出る（mockups/v45 案A）。「字の多い列を広く」を押し、表に寄って結果を見せる
  const shapeBtn = await h.centerOf(page, '.palette .shape-btn', '表の形')
  rec.mark('widths', { focus: await h.rectOf(page, '.palette .shape-btn') })
  await h.moveTo(page, shapeBtn.x, shapeBtn.y)
  await h.sleep(1700)
  await h.clickAt(page, shapeBtn.x, shapeBtn.y, { pause: 300 })
  await page.waitForSelector('.shape-panel .so-choice[data-value="auto"]')
  await h.sleep(500)
  rec.mark('shapePanel', { focus: h.union(await h.rectOf(page, '.shape-panel'), await h.rectOf(page, '.palette .shape-btn')) })
  const fit = await h.centerOf(page, '.shape-panel .so-choice[data-value="auto"]')
  await h.moveTo(page, fit.x, fit.y)
  await h.sleep(1500)
  await h.clickAt(page, fit.x, fit.y, { pause: 300 })
  await h.sleep(400)
  await h.ready(page).catch(() => {})
  rec.mark('widthsDone', { focus: await tableOnly() })
  await h.sleep(1600)
  // 窓を閉じる（Esc は窓だけを閉じる）・書いているマスも閉じる
  await page.keyboard.press('Escape')
  await h.sleep(300)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(500)

  // 6. 作品写真のページ（左のページの一覧の、いちばん下）：並べ方を選ぶ。字幕は、ページを移る前から出す（表に寄ったまま写真のページに変わらないよう、全体に戻す）
  rec.mark('photos', { full: true })
  const thumb = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.thumbs-col .t')].at(-1)
    b.scrollIntoView({ block: 'nearest' })
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await h.sleep(300)
  await h.clickAt(page, thumb.x, thumb.y, { pause: 500 })
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(300)
  rec.mark('photosArrange', { focus: h.union(await h.rectOf(page, '.palette .photo-arrange'), await h.rectOf(page, CUR)) })
  await h.sleep(1100)
  const lay = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.palette .lay')].find((x) => x.title.startsWith('4枚'))
    const r = b.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await h.clickAt(page, lay.x, lay.y, { pause: 600 })
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(600)

  // 7. 空いている枠（右上）を押して、写真を3枚まとめて選ぶ（右上・左下・右下に入る）
  const slot = await h.rectOf(page, `${CUR} [data-photo-slot="1"]`)
  rec.mark('photoAdd', { focus: await h.rectOf(page, CUR) })
  const sc = { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2 }
  await h.moveTo(page, sc.x, sc.y)
  await h.sleep(1800)
  await h.chooseFile(page, sc.x, sc.y, ['w-back', 'w-side', 'w-turban'].map((n) => resolve(`public/trial/${n}.jpg`)))
  await page.waitForFunction(() => window.__editor.getSnapshot().report.workPhotos[0].imageIds.filter(Boolean).length === 4, { timeout: 30000 })
  await h.ready(page)
  await h.sleep(2200)

  // 8. トリミング：右下のターバンの写真をつかんで、左へずらす（ターバンが枠の真ん中に来るように）
  const s3 = await h.rectOf(page, `${CUR} [data-photo-slot="3"]`)
  rec.mark('trim', { focus: await h.rectOf(page, CUR) })
  const from = { x: s3.x + s3.w * 0.55, y: s3.y + s3.h * 0.45 }
  await h.moveTo(page, from.x, from.y)
  await h.sleep(900)
  await h.dragTo(page, from, { x: from.x - 70, y: from.y }, 1100)
  await h.sleep(500)
  await h.ready(page).catch(() => {})
  await h.sleep(1300)

  // 9. 写真のページを足す
  const add = await h.centerOf(page, '.palette .photo-pages .tb', 'ページを足す')
  rec.mark('pageAdd', { focus: h.union(await h.rectOf(page, '.palette .photo-pages'), await h.rectOf(page, CUR)) })
  await h.moveTo(page, add.x, add.y)
  await h.sleep(2500)
  await h.clickAt(page, add.x, add.y, { pause: 300 })
  await page.waitForFunction(() => window.__editor.getSnapshot().report.workPhotos.length === 2, { timeout: 30000 })
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(400)
  rec.mark('end', { focus: h.union(await h.rectOf(page, '.palette'), await h.rectOf(page, CUR)) })
  await h.sleep(2700)
}
