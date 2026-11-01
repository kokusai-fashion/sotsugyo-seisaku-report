// 動画 2：本文を書く・図を入れる（パソコン）
// 見本「シンドバッド」の「ii．サルエルパンツ」の段落（p7）の終わりに1文を書き足し、「図を入れる」でサルエルパンツの写真（public/trial/w-pants.jpg）を入れる。
// そのため、録る前に見本からサルエルパンツの図（r4）と、本文のその「（図5）」を外しておく（入れ直すと、本文に「（図5）」が入り、
// すぐ下のサッシュベルトの段落の「（図5）」が「（図6）」に変わる）。
// 後半で、制作過程の最後の図（図8．靴）の下の「＋ 文章の続きを書く」を押し、「Ⅲ．まとめ」と打って Enter を押すと大見出しになる
// （手で打った見出しを見分ける）ことを見せる。そのため、録る前に見本から「Ⅲ．まとめ」の章（c3）を外しておく
import { resolve } from 'node:path'

export const meta = {
  number: '2',
  label: '本文を書く・図を入れる',
  device: 'pc',
  captions: {
    click: '本文を書くときは、紙面の書きたい所をクリックします',
    type: 'キーボードで、そのまま文を入力します',
    figure: '続けて「図を入れる」を押し、入れたい写真を選びます',
    caption: '図のタイトルを入力します。「図5.」という番号は自動で付きます',
    done: '本文にも「（図5）」が自動で入り、後ろの図の番号は「図6」に変わります',
    next: '次のページへ進むときは、紙面の右の「＞」を押します',
    more: '図の後ろに続きを書くときは、「＋ 文章の続きを書く」を押します',
    heading: '新しい章は、行の頭に「Ⅲ．まとめ」のように入力して、Enter を押します',
    headingDone: '大見出しになりました。新しい章は、次のページから始まります',
    undo: '見出しにしたくないときは、画面の上に出る「戻す」を押します',
    write: '続けて、その章の本文を書いていきます',
    end: '書いた内容は、自動でドライブに保存されます。右上に保存した時刻が出ます',
  },
}

const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'

export async function prepare({ page, h }) {
  // 「Ⅲ．まとめ」の章（c3）と、サルエルパンツの図（r4）を外す
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, body: r.body.filter((c) => c.id !== 'c3') })))
  await h.dropFigure(page, 'r4')
  await h.sleep(500)
  await h.ready(page)
  // まとめを外したので出る、抄録の「本文にない内容かもしれない文がある」は、確認済みにしておく
  await h.acknowledgeAbstract(page)
  const left = await page.evaluate(() => window.__editor.getSnapshot().findings.map((f) => f.title))
  if (left.length) console.log('  指摘：', left.join('、'))
  await h.goToBlock(page, 'p7')
}

export async function run({ page, rec, h }) {
  // 1. 紙面の書きたい所（段落の終わり）をクリック
  const p7 = await h.blockRect(page, 'p7')
  const end = await h.endOfBlock(page, 'p7')
  rec.mark('click', { focus: { ...p7, h: p7.h + 230 } })
  await h.moveTo(page, end.x, end.y)
  await h.sleep(2400)
  h.logClick(page, end.x, end.y)
  await page.mouse.click(end.x, end.y)
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p7', { timeout: 30000 })
  await h.sleep(1200)

  // 2. 文を打つ
  rec.mark('type')
  await h.sleep(1000)
  await h.typeSlow(page, '裾の刺繍は、足首の正面に来るように位置を合わせた。')
  await h.sleep(1500)

  // 3. 「図を入れる」→ 写真を選ぶ
  const btn = await h.centerOf(page, '.palette .tb', '図を入れる')
  rec.mark('figure', { focus: h.union({ x: btn.x - btn.w / 2, y: btn.y - btn.h / 2, w: btn.w, h: btn.h }, await h.blockRect(page, 'p7')) })
  await h.moveTo(page, btn.x, btn.y)
  await h.sleep(2200)
  await h.chooseFile(page, btn.x, btn.y, [resolve('public/trial/w-pants.jpg')])
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
  await h.ready(page).catch(() => {})
  const cap = await h.rectOf(page, `${CUR} figure[data-figure-id] figcaption`, '図5')
  const fig = await h.rectOf(page, `${CUR} figure[data-figure-id]`, '図5')
  if (cap) await h.moveTo(page, cap.x + cap.w + 30, cap.y + cap.h + 16)
  await h.sleep(800)

  // 4. 図のタイトルを打つ（番号は自動）
  rec.mark('caption', { focus: h.union(fig, await h.blockRect(page, 'p7')) })
  await h.sleep(1300)
  await h.typeSlow(page, 'サルエルパンツ')
  await h.sleep(2200)

  // 5. 書き終える：本文の（図5）と、後ろの図の番号（サッシュベルトの段落の（図6））
  await page.keyboard.press('Escape')
  await h.ready(page)
  const after = h.union(await h.blockRect(page, 'p7'), await h.blockRect(page, 'p8'))
  rec.mark('done', { focus: after })
  await h.sleep(500)
  const ref = await h.textRect(page, 'p7', '（図5）')
  if (ref) await h.moveTo(page, ref.x + ref.w + 8, ref.y + ref.h)
  await h.sleep(2300)
  const ref6 = await h.textRect(page, 'p8', '（図6）')
  if (ref6) await h.moveTo(page, ref6.x + ref6.w + 8, ref6.y + ref6.h)
  await h.sleep(2200)

  // 6. 次のページへ（制作過程の最後の図「図8．靴」のページまで）
  rec.mark('next', { full: true })
  for (let i = 0; i < 4 && !(await h.blockRect(page, 'p10')); i++) {
    await h.clickEl(page, '.stage .arrow.next', null, { pause: 400 })
    await h.sleep(300)
    await h.ready(page)
    await h.sleep(300)
  }

  // 7. 図の下の「＋ 文章の続きを書く」→「Ⅲ．まとめ」と打って Enter（大見出しになる）
  await page.waitForFunction(() => [...document.querySelectorAll('.continue-row')].some((b) => !b.hidden && b.getBoundingClientRect().width > 0), { timeout: 10000 })
  const row = await h.rectOf(page, '.continue-row')
  const shoes = await h.rectOf(page, `${CUR} figure[data-figure-id]`, '図8')
  rec.mark('more', { focus: h.union(shoes, { ...row, h: row.h + 120 }) })
  await h.moveTo(page, row.x + 110, row.y + row.h / 2)
  await h.sleep(2600)
  await h.clickAt(page, row.x + 110, row.y + row.h / 2, { pause: 300 })
  await page.waitForFunction(() => {
    const s = window.__editor.getSnapshot()
    const b = s.report.body.flatMap((c) => c.blocks).find((x) => x.id === s.editingId)
    return s.editingKind === 'paragraph' && b && !b.content.map((n) => n.text ?? 'ref').join('')
  }, { timeout: 30000 })
  await h.sleep(300)
  await h.ready(page).catch(() => {})
  // 図8 のタイトルと、そのすぐ下の新しい段落（見出しを打つ所）に寄る。段落が増えると、図はページに収まるよう小さくなるので、押したあとの位置で測る
  await h.sleep(400)
  const column = await h.blockRect(page, 'p10')
  const cap8 = (await h.rectOf(page, `${CUR} figure[data-figure-id] figcaption`, '図8')) ?? { y: row.y - 30, h: 20 }
  rec.mark('heading', { focus: { x: column.x, y: cap8.y - 50, w: column.w, h: 170 } })
  await h.sleep(1500)
  await h.typeSlow(page, 'Ⅲ．まとめ', 180)
  await h.sleep(1000)
  await page.keyboard.press('Enter')
  await page.waitForSelector('.undo-area .undo-toast', { timeout: 30000 })
  await h.sleep(300)
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  // 大見出しは新しいページの上に来る（見出しと、続けて書く段落のあたりに寄る）
  const chapter = await page.evaluate(() => window.__editor.getSnapshot().report.body.at(-1).id)
  const head = await h.blockRect(page, chapter)
  const first = await page.evaluate(() => window.__editor.getSnapshot().report.body.at(-1).blocks[0]?.id)
  const body = first ? await h.blockRect(page, first) : null
  const top = { x: body?.x ?? head.x - 40, y: head.y - 40, w: body?.w ?? 470, h: 160 }
  rec.mark('headingDone', { focus: top })
  await h.moveTo(page, head.x + head.w + 60, head.y + 40)
  await h.sleep(3000)
  // 画面の下の知らせ「大見出し「Ⅲ．まとめ」にしました［戻す］」（押さない。打ち始めると消える）
  const toast = await h.rectOf(page, '.undo-area .undo-toast')
  if (toast) {
    rec.mark('undo', { focus: { x: toast.x - 30, y: toast.y - 50, w: toast.w + 60, h: toast.h + 70 } })
    const back = (await h.rectOf(page, '.undo-area .undo-toast button')) ?? toast
    await h.moveTo(page, back.x + back.w / 2, back.y + back.h / 2)
    await h.sleep(3300)
  }
  // 新しい章の最初の段落を書き始める
  rec.mark('write', { focus: top })
  await h.moveTo(page, head.x + head.w + 60, head.y + 70)
  await h.sleep(500)
  await h.typeSlow(page, '本制作では、主人公の成長を一着の衣装で表すことを目標とした。')
  await h.sleep(1200)
  await page.keyboard.press('Escape')
  await h.ready(page)
  await h.sleep(400)

  // 8. 自動で保存（右上）
  const chip = await h.rectOf(page, '.side .chip')
  rec.mark('end', { focus: chip ? { x: chip.x - 60, y: chip.y - 40, w: 420, h: 160 } : undefined, full: !chip })
  await h.sleep(3000)
}
