// 学生向けスライドの「スマホ編」④見る・直す・出す（依頼者 2026-11-03）。スライドでは、スマホの画面の所だけを切り出して使う。
// 紙面を上下にはらってページを送る → 2本の指で広げる（拡大中も下に「◀ ▶ ｜ 全体」。mockups/v98 ② 案A）→「▶」で次のページ（拡大のまま）→「全体」→
// 下の赤い帯「直すところが n か所」をタップ → チェックの一覧 → 閉じる → 下の「PDF」
// 録る前に、赤い帯が出るよう「ii．サルエルパンツ」の段落（p7）に、です・ます調の1文を書き足しておく
// 録る：APP_URL=<まとめた版> node scripts/video/record.mjs ../scenes-slides/p4-view-check-pdf
export const meta = {
  number: 'S4',
  label: 'スマホで見る・直す・出す',
  device: 'phone',
  captions: {
    swipe: '紙面を指で上下にはらうと、ページをめくれます',
    zoom: '2本の指で広げると、紙面を拡大できます',
    turn: '拡大したままでも、下の「◀」「▶」でページを送れます',
    whole: '「全体」を押すと、ページ全体の表示に戻ります',
    strip: '直すところがあると、下に赤い帯が出ます。押すと一覧が開きます',
    pdf: 'PDF は、画面の下の「PDF」から書き出します',
  },
}

export async function prepare({ page, h }) {
  await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await page.evaluate(() =>
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === 'p7' ? { ...b, content: [...b.content, { type: 'text', text: '裾の刺繍は、手で縫いました。' }] } : b)) })),
    })),
  )
  await h.sleep(800)
  await h.ready(page)
  await h.goToBlock(page, 'p7')
  await page.waitForSelector('.err-strip', { timeout: 30000 })
}

const tapEl = async (h, page, selector, text) => {
  const c = await h.centerOf(page, selector, text)
  await h.tapAt(page, c.x, c.y)
  return c
}

export async function run({ page, rec, h }) {
  // ページを上下にはらってめくる（上へで次、下へで前）
  rec.mark('swipe')
  await h.sleep(1300)
  await h.swipe(page, { x: 200, y: 600 }, { x: 205, y: 260 }, 320)
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1300)
  await h.swipe(page, { x: 200, y: 260 }, { x: 205, y: 600 }, 320)
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1000)

  // 2本の指で広げる
  rec.mark('zoom')
  await h.sleep(800)
  await h.pinch(page, { x: 195, y: 360 }, 70, 230, 800)
  await h.sleep(500)
  await page.waitForSelector('.pager .unzoom', { timeout: 10000 })
  await h.sleep(1800)

  // 拡大のまま「▶」
  rec.mark('turn')
  await h.sleep(600)
  await tapEl(h, page, '.pager button[aria-label="次のページ"]')
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1800)

  rec.mark('whole')
  await h.sleep(500)
  await tapEl(h, page, '.pager .unzoom')
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1500)

  // 赤い帯 → チェックの一覧
  rec.mark('strip')
  await h.sleep(1200)
  await tapEl(h, page, '.err-strip')
  await page.waitForSelector('.sheet')
  await h.sleep(3200)
  await tapEl(h, page, '.sheet .sheet-close')
  await h.sleep(700)

  rec.mark('pdf')
  await h.sleep(900)
  await tapEl(h, page, '.p-nav .nav-pdf')
  await h.sleep(3000)
}
