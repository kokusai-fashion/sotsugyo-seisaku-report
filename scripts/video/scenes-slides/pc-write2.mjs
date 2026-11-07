// 学生向けスライド8枚め「本文は紙面にそのまま書く」の動画（録り直し。依頼者 2026-11-07：「Enter を押すと、次の段落に進みます」のときに、
// 実際に Enter を押して次の段落を書くところを見せると、1字下げが自動で付くことが伝わる）。
// - 見本「シンドバッド」の1ページめ（Ⅰ．企画・立案 → i．担当衣装のキャラクター → 段落）。その段落の終わりをクリックして1文書き足し、
//   Enter で次の段落に進んで書き始める。矢印で、次の段落の書き出しの1字下げを指す
// - 書いた段落の下が見えるよう、録る前に、1章の段落 p1 より後ろ（ii．デザイン説明・図・iii．使用素材・表）を外す（9枚めの pc-heading2 と同じ）
// - 押す所を赤い枠で囲まない（矢印と押したときのオレンジの輪で見せる）
//   （声との合わせ方は、スライド/scripts/write-sync.mjs が、ここで付ける印を使って決める）
// 録る（app から）：SCENES_DIR=scenes-slides APP_URL=<まとめた版> node scripts/video/record.mjs pc-write2
export const meta = { number: 'W2', label: '本文を書く（録り直し）', device: 'pc', captions: {} }

const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'
const ADD = 'そのため、動きやすさと華やかさの両立を目指した。'
const NEXT = 'デザインは、中世アラビアの船乗りの装いをもとに考えた。'
/** 次の段落で、矢印で1字下げを指す前に打つ所 */
const NEXT_HEAD = 'デザインは、'

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

export async function run({ page, rec, h }) {
  // 矢印は、人が動かすくらいの速さで（声に合わせて見せるので、速すぎると目で追えない）
  h.setPace({ moveMs: 650, clickPause: 300, typeDelay: 0 })
  const chapter = await rectIn(page, `${CUR} h1.chapter`)
  const p1 = await h.blockRect(page, 'p1')
  // 見せる範囲：1ページめの上から、書き足す段落と、次の段落が来る所まで（ずっと同じ範囲。動かすと酔う）
  const view = { focus: h.union(chapter, { ...p1, h: p1.h + 170 }) }

  // 1. 段落の終わりをクリック（書きたい所）
  const end = await h.endOfBlock(page, 'p1')
  rec.mark('w_click', view)
  await h.moveTo(page, end.x, end.y)
  await h.sleep(500)
  rec.mark('w_clicked', view)
  await h.clickAt(page, end.x, end.y, { pause: 200 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p1', { timeout: 30000 })
  await h.sleep(1000)

  // 2. その場で1文書き足す
  rec.mark('w_type', view)
  await h.typeSlow(page, ADD, 110)
  await h.sleep(1200)

  // 3. Enter で次の段落へ。続けて書き始める
  rec.mark('w_enter', view)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return s.editingKind === 'paragraph' && s.editingId !== 'p1' }, { timeout: 30000 })
  await h.sleep(300)
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  const nid = await page.evaluate(() => window.__editor.getSnapshot().editingId)
  rec.mark('w_next', view)
  await h.typeSlow(page, NEXT_HEAD, 110)

  // 4. 打ち始めたら、矢印で次の段落の書き出しの1字下げ（行の頭の空き）を指し、そのまま続きを打つ
  //   （打ち終わってから指すと、声が打ち終わるまで待って間が空いた：2026-11-07）
  const np = await h.blockRect(page, nid)
  rec.mark('w_indent', view)
  await h.moveTo(page, np.x + 8, np.y + 14)
  await h.typeSlow(page, NEXT.slice(NEXT_HEAD.length), 110)
  await h.sleep(1500)
}
