// 学生向けスライド9枚め「見出しを入れる」の動画（録り直し。依頼者 2026-11-07）：
// - 大見出しも見えるページで見せる：見本「シンドバッド」の1ページめ（Ⅰ．企画・立案 → i．担当衣装のキャラクター → 段落）。
//   その段落の終わりに中見出し「デザイン説明」を入れる（番号「ii．」は自動）→ Enter → 本文を書き始める。
//   書いている途中に見えるよう、録る前に、1章の段落 p1 より後ろ（ii．デザイン説明・図・iii．使用素材・表）を外す
// - 押すボタンを赤い枠で囲まない（ほかの動画と同じく、矢印と押したときのオレンジの輪で見せる）
// - ナレーションの言葉に合わせて、矢印が「大見出し」「中見出し」「小見出し」のボタン・番号・目次の行・大見出し・中見出しを指す
//   （声との合わせ方は、スライド/scripts/heading-sync.mjs が、ここで付ける印を使って決める）
// 録る（app から）：SCENES_DIR=scenes-slides APP_URL=<まとめた版> node scripts/video/record.mjs pc-heading2
export const meta = { number: 'H2', label: '見出しを入れる（録り直し）', device: 'pc', captions: {} }

const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
const HEADING = 'デザイン説明'
const BODY = '中世アラビアの船乗りのイメージでデザインを考えた。'

export async function prepare({ page, h }) {
  // 1章は、i．担当衣装のキャラクター（s1）とその段落（p1）だけにする
  await page.evaluate(() =>
    window.__editor.update((r) => ({ ...r, body: r.body.map((c, i) => (i === 0 ? { ...c, blocks: c.blocks.slice(0, c.blocks.findIndex((b) => b.id === 'p1') + 1) } : c)) })),
  )
  await h.sleep(600)
  await h.ready(page)
  // 1章の後ろを外したので、抄録に「本文にない内容かもしれない文がある」が出る。動画の話と関係がないので、確認済みにしておく
  await h.acknowledgeAbstract(page)
  await h.goToBlock(page, 'p1')
}

/** いま見えているページの、要素の範囲（CSS px） */
const rectIn = (page, sel) =>
  page.evaluate((sel) => {
    const rs = [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
    if (!rs.length) return null
    const x = Math.min(...rs.map((r) => r.left))
    const y = Math.min(...rs.map((r) => r.top))
    return { x, y, w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y }
  }, sel)
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
/** いま見えているページの、sel に合う要素のうち、text を含むいちばん小さいもの（行の中の字の所を指すため） */
const smallest = (page, sel, text) =>
  page.evaluate((sel, text) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0 && e.textContent.includes(text))
    const r = els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.width * a.height - b.width * b.height)[0]
    return r && { x: r.left, y: r.top, w: r.width, h: r.height }
  }, sel, text)
/** 左の道具のボタン（文字が name で終わるもの。「中見出しにする」と見分ける） */
const button = (page, name) =>
  page.evaluate((name) => {
    const el = [...document.querySelectorAll('.palette .tb')].find((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim().endsWith(name))
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }, name)

export async function run({ page, rec, h }) {
  // 矢印は、人が動かすくらいの速さで（声に合わせて見せるので、速すぎると目で追えない）
  h.setPace({ moveMs: 650, clickPause: 300, typeDelay: 0 })
  const chapter = await rectIn(page, `${CUR} h1.chapter`)
  const p1 = await h.blockRect(page, 'p1')
  const big = await button(page, '大見出し')
  const mid = await button(page, '中見出し')
  const small = await button(page, '小見出し')
  // 見せる範囲：左の道具の「大見出し」〜「小見出し」と、1ページめの上から、入れる見出しと本文が来る所まで（ずっと同じ範囲。動かすと酔う）。
  // 左の道具の全体を入れると縦に長くなり、寄れなかった（2026-11-07）
  const view = { focus: h.union(big, small, chapter, { ...p1, h: p1.h + 120 }) }

  // 1. 段落の終わりをクリック（見出しを入れたい所）
  const end = await h.endOfBlock(page, 'p1')
  rec.mark('a_click', view)
  await h.moveTo(page, end.x, end.y)
  await h.sleep(500)
  rec.mark('a_clicked', view)
  await h.clickAt(page, end.x, end.y, { pause: 200 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 30000 })
  await h.sleep(1000)

  // 2. 左の道具：「大見出し」「中見出し」「小見出し」を順に指して、「中見出し」を押す
  rec.mark('a_big', view)
  await h.moveTo(page, center(big).x, center(big).y)
  await h.sleep(1000)
  rec.mark('a_mid', view)
  await h.moveTo(page, center(mid).x, center(mid).y)
  await h.sleep(1000)
  rec.mark('a_small', view)
  await h.moveTo(page, center(small).x, center(small).y)
  await h.sleep(1000)
  rec.mark('a_back', view)
  await h.moveTo(page, center(mid).x, center(mid).y)
  await h.sleep(800)
  rec.mark('a_press', view)
  await h.clickAt(page, center(mid).x, center(mid).y, { pause: 100 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'subheading', { timeout: 30000 })
  // 紙面を組み直して、入れた見出しに番号（ii．）が付くまで待つ
  await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return !s.rendering && !!document.querySelector(`.page-viewport.front [data-block-id="${s.editingId}"]`)?.closest('h2')?.querySelector('.num') }, { timeout: 30000 })
  const sid = await page.evaluate(() => window.__editor.getSnapshot().editingId)
  await h.sleep(1000)

  // 3. 見出しの名前を打つ → 矢印で番号「ii．」を指す
  rec.mark('a_type', view)
  await h.typeSlow(page, HEADING, 150)
  await h.sleep(600)
  await h.ready(page).catch(() => {})
  const num = await page.evaluate((sel) => { const r = document.querySelector(sel)?.closest('h2')?.querySelector('.num')?.getBoundingClientRect(); return r && { x: r.left, y: r.top, w: r.width, h: r.height } }, `${CUR} [data-block-id="${sid}"]`)
  rec.mark('a_num', view)
  await h.moveTo(page, num.x + num.w / 2 + 2, num.y + num.h / 2 + 4)
  await h.sleep(1200)

  // 4. Enter で、その下に本文を書き始める
  rec.mark('a_enter', view)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'paragraph', { timeout: 30000 })
  await h.sleep(300)
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  rec.mark('a_body', view)
  await h.typeSlow(page, BODY, 110)
  await h.sleep(1200)

  // 5. 目次のページ：入れた見出しの行を指す
  await page.keyboard.press('Escape')
  await h.sleep(400)
  rec.mark('a_toc', view)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfArea('toc'), 'fade'))
  await h.sleep(700)
  await h.ready(page)
  // ページを移ると、目次の1行めに黄色い枠（キーボードで選んだ印）が出る。押していないので消す
  await page.evaluate(() => document.activeElement?.blur())
  const tocAll = await rectIn(page, `${CUR} [data-toc-target]`)
  await h.sleep(500)
  // 入れた見出しの行（行の字の所。行の全体の範囲だと、1つ下の行を指してしまった：2026-11-07）
  const row = await smallest(page, `${CUR} [data-toc-target] *, ${CUR} [data-toc-target]`, HEADING)
  console.log('  目次の行', JSON.stringify(row))
  const tocView = { focus: h.union({ ...view.focus, w: 1 }, { ...tocAll, h: Math.min(tocAll.h, view.focus.h) }) }
  rec.mark('a_tocrow', tocView)
  await h.sleep(500)
  await h.moveTo(page, row.x + Math.min(row.w, 120) * 0.5, row.y + row.h / 2 + 3)
  await h.sleep(1600)

  // 6. 1ページめに戻り、大見出し「Ⅰ．企画・立案」を指す
  rec.mark('a_return', tocView)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.pageOfBlock('p1'), 'fade'))
  await h.sleep(700)
  await h.ready(page)
  await page.evaluate(() => document.activeElement?.blur())
  rec.mark('a_chapter', view)
  await h.sleep(300)
  // 大見出しの字の所（h1 の全体は下に余白があり、下の行を指してしまった）
  const ch = await smallest(page, `${CUR} h1.chapter [data-block-id], ${CUR} h1.chapter`, '企画')
  console.log('  大見出し', JSON.stringify(ch))
  await h.moveTo(page, ch.x + Math.min(ch.w, 80) * 0.5, ch.y + ch.h / 2 + 3)
  await h.sleep(1600)

  // 7. 中見出し「i．」「ii．」を指し、最後に「小見出し」のボタンを指す
  const s1 = await rectIn(page, `${CUR} [data-block-id="s1"]`)
  const s2 = await rectIn(page, `${CUR} [data-block-id="${sid}"]`)
  rec.mark('a_i', view)
  await h.moveTo(page, s1.x + 30, s1.y + s1.h / 2 + 4)
  await h.sleep(1100)
  rec.mark('a_ii', view)
  await h.moveTo(page, s2.x + 30, s2.y + s2.h / 2 + 4)
  await h.sleep(1300)
  rec.mark('a_smallbtn', view)
  await h.moveTo(page, center(small).x, center(small).y)
  await h.sleep(1500)
}
