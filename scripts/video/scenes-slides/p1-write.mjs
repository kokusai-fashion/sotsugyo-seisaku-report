// 学生向けスライドの「スマホ編」①本文を書く（依頼者 2026-11-03：スマホの動きを4枚で見せる）。スライドでは、スマホの画面の所だけを切り出して使う。
// 見本「シンドバッド」の「ii．サルエルパンツ」の段落（p7）をタップして1文書き足し、キーボードの上の「見出し」→「小見出し」で
// 「（1）」の見出しを足して名前を打ち、「完了」で戻る。録る前に、サルエルパンツの図（r4）を外す（足した小見出しの下に図が入らないように）。
// 見出しを足したあと、紙面を組み直して「（1）」が出るまで待ってから打つ（組み直す前は、書く欄を仮の位置に出していて、番号はまだない）
// 録る：APP_URL=<まとめた版> node scripts/video/record.mjs ../scenes-slides/p1-write
// 動画：node scripts/video/compose.mjs ../scenes-slides/p1-write（poc-output/video/out/<番号>_<題名>.mp4）
export const meta = {
  number: 'S1',
  label: 'スマホで本文を書く',
  device: 'phone',
  captions: {
    tap: '書きたい段落をタップすると、文字が大きくなり、そのまま書けます',
    type: 'キーボードで、そのまま文を入力します',
    heading: '「見出し」を押すと、大見出し・中見出し・小見出しを選べます',
    minor: '小見出しを選んで名前を入力します。「（1）」は自動で付きます',
    done: '書き終えたら「完了」を押します',
  },
}

export async function prepare({ page, h }) {
  await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await h.dropFigure(page, 'r4')
  await h.sleep(500)
  await h.ready(page)
  await h.goToBlock(page, 'p7')
}

async function tapToWrite(page, h, id) {
  const end = await h.endOfBlock(page, id)
  await h.tapAt(page, end.x + 2, end.y)
  await page.waitForFunction((id) => {
    const s = window.__editor.getSnapshot()
    return s.editingId === id && s.onPaper
  }, { timeout: 30000 }, id)
  await h.sleep(450)
  await h.phoneKeyboard(page, true)
}

const tapEl = async (h, page, selector, text) => {
  const c = await h.centerOf(page, selector, text)
  await h.tapAt(page, c.x, c.y)
  return c
}

export async function run({ page, rec, h }) {
  rec.mark('tap')
  await h.sleep(2200)
  await tapToWrite(page, h, 'p7')
  await h.sleep(1400)

  rec.mark('type')
  await h.sleep(500)
  await h.typeSlow(page, '裾の刺繍は、足首の正面に合わせた。')
  await h.sleep(1200)

  // 「見出し」→ 上に 大見出し・中見出し・小見出し
  rec.mark('heading')
  await h.sleep(900)
  await tapEl(h, page, '.direct-bar button[aria-expanded]')
  await h.sleep(2600)

  // 小見出しを足して、名前を打つ
  rec.mark('minor')
  await tapEl(h, page, '.direct-bar .db-add button', '小見出し')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingKind === 'subheading', { timeout: 30000 })
  // 紙面を組み直して、足した小見出しに「（1）」が付くまで待つ
  await page.waitForFunction(() => { const id = window.__editor.getSnapshot().editingId; return !window.__editor.getSnapshot().rendering && !!document.querySelector(`.page-viewport.front [data-block-id="${id}"]`)?.closest('h2')?.querySelector('.num') }, { timeout: 30000 })
  await h.sleep(700)
  await h.typeSlow(page, '裾の刺繍')
  await h.sleep(1600)

  rec.mark('done')
  await h.sleep(900)
  await tapEl(h, page, '.direct-bar .db-done')
  await h.phoneKeyboard(page, false)
  await h.sleep(300)
  await h.ready(page)
  await h.sleep(2400)
}
