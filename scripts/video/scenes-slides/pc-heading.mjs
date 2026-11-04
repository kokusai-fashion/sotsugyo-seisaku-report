// 学生向けスライドの「見出しを入れる」の動画（パソコン。依頼者 2026-11-04：見出しの入れ方は動きで見せる。小見出しまでは見せなくてよい）。
// 書いている途中のように見せる：見本「シンドバッド」の制作過程の最後の節「靴」の段落（p10）を書き終えたところで、
// 段落の終わりをクリック →「中見出し」→「アクセサリー」と打つ（番号「vi．」は自動）→ Enter → その下に本文を書き始める。
// 録る前に、靴の図（r7）を外す。外さないと、見出しが段落と図の間に入り、靴の図が新しい見出しの下へ移って不自然だった（依頼者 2026-11-04）。
// 図を外したので、靴の段落は章の最後になり、見出しと段落を足しても、ほかのページや図は動かない。
// 字幕は出さない（スライドの声で伝える：依頼者の選択 2026-11-04）。押すボタンだけ赤い枠で囲む（recorder.mjs の box）
// 録る：APP_URL=<まとめた版> node scripts/video/record.mjs ../scenes-slides/pc-heading
// 動画：node scripts/video/compose.mjs ../scenes-slides/pc-heading（poc-output/video/out/H1_見出しを入れる.mp4。はじめの題名の 2.6 秒は切って使う）
export const meta = { number: 'H1', label: '見出しを入れる', device: 'pc', captions: {} }

const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'

export async function prepare({ page, h }) {
  await h.dropFigure(page, 'r7')
  await h.sleep(500)
  await h.ready(page)
  await h.goToBlock(page, 'p10')
}

export async function run({ page, rec, h }) {
  // 1. 靴の段落の終わりをクリック
  const p10 = await h.blockRect(page, 'p10')
  const end = await h.endOfBlock(page, 'p10')
  rec.mark('click', { focus: { ...p10, y: p10.y - 40, h: p10.h + 260 } })
  await h.sleep(400)
  await h.moveTo(page, end.x, end.y)
  await h.sleep(900)
  await h.clickAt(page, end.x, end.y, { pause: 200 })
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'p10', { timeout: 30000 })
  await h.sleep(600)

  // 2. 左の「中見出し」を押す（「中見出しにする」と見分ける：文字が「中見出し」で終わるボタン）
  const b = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.palette .tb')].find((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim().endsWith('中見出し'))
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: { x: r.left, y: r.top, w: r.width, h: r.height } }
  })
  rec.mark('press', { focus: h.union(b.rect, await h.blockRect(page, 'p10')) })
  await h.sleep(700)
  await h.box(page, b.rect)
  await h.sleep(500)
  await h.moveTo(page, b.x, b.y)
  await h.sleep(900)
  await h.clickAt(page, b.x, b.y, { pause: 100 })
  await h.sleep(300)
  await h.unbox(page)
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'subheading', { timeout: 30000 })
  // 紙面を組み直して、入れた見出しに番号（vi．）が付くまで待つ
  await page.waitForFunction(() => { const s = window.__editor.getSnapshot(); return !s.rendering && !!document.querySelector(`.page-viewport.front [data-block-id="${s.editingId}"]`)?.closest('h2')?.querySelector('.num') }, { timeout: 30000 })
  await h.sleep(600)

  // 3. 見出しを打つ
  const editor = await h.rectOf(page, '.overlay-clip:not([hidden]) .overlay-editor')
  rec.mark('type', { focus: { ...editor, x: editor.x - 60, w: editor.w + 120, y: editor.y - 80, h: editor.h + 200 } })
  await h.sleep(500)
  await h.typeSlow(page, 'アクセサリー', 150)
  await h.sleep(700)

  // 4. Enter で、その下に本文を書き始める
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'paragraph', { timeout: 30000 })
  await h.sleep(300)
  await h.ready(page).catch(() => {})
  await h.sleep(500)
  await h.typeSlow(page, '腕輪と首飾りは、金色のビーズで作った。', 120)
  await h.sleep(1200)
  rec.mark('end', { focus: { ...editor, x: editor.x - 60, w: editor.w + 120, y: editor.y - 80, h: editor.h + 260 } })
  await h.sleep(600)
}
