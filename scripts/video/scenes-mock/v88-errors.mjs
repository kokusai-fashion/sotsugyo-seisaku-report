// 見本 mockups/v88：スマホで、直すところ（× エラー）に気づけるようにする案の動き（依頼者に見せる見本。使い方の動画ではないので、scripts/video/scenes には置かない）。
// 画面に同時に出す知らせは1つだけ：書いている間は、キーボードの上の道具にその段落の直すところを1行。書いていない間は、下に1か所
// （ERR_VARIANT=strip：タブの上の帯「直すところが n か所　チェックで見る ›」／ERR_VARIANT=tab：下の「チェック」の字を赤い「直す n」に。
//  依頼者は案1（帯）を選んだので、ツールには帯だけを残した。tab の録画を撮り直すときは、見本を作ったときの Phone.tsx に戻す）。
// 見本「シンドバッド」の本文1ページ目の段落（p2）に、です・ます調の1文を書き足す → 1行が出る → 直さずに「完了」→ 下の知らせ →
// 一覧 → 直すと1行が消える →「完了」で下の知らせも消える。
// 録る：dist-e2e を VITE_ERR_VARIANT=<案> でまとめ、PORT=4244 node scripts/e2e/serveBuilt.mjs で出して、
//   ERR_VARIANT=<案> APP_URL=http://localhost:4244 node scripts/video/record.mjs ../scenes-mock/v88-errors
// 動画：ERR_VARIANT=<案> node scripts/video/compose.mjs ../scenes-mock/v88-errors（poc-output/video/out/<番号>_….mp4）
const tab = process.env.ERR_VARIANT === 'tab'

export const meta = {
  number: tab ? '2' : '1',
  label: tab ? '案2 チェックの字を変える（見本）' : '案1 下に帯を出す（見本）',
  device: 'phone',
  captions: {
    start: 'スマホで、本文を書いているところです',
    tap: '段落の終わりをタップして、文を書き足します',
    type: '「〜しました」と、です・ます調で書いてしまいました',
    line: '手を止めると、キーボードの上に、直すところが出ます',
    done: tab ? '直さずに「完了」を押すと、下の「チェック」が「直す 1」に変わります' : '直さずに「完了」を押すと、下に帯が出たままになります',
    open: tab ? '「直す 1」を押すと、直すところの一覧が開きます' : '帯を押すと、チェックの一覧が開きます',
    pick: '一覧の項目を押すと、その場所へ移ります',
    fix: '「しました」を「した」に直すと、キーボードの上の知らせは消えます',
    gone: tab ? '「完了」を押すと、下の「チェック」も元に戻ります' : '「完了」を押すと、下の帯も消えます',
  },
}

export async function prepare({ page, h }) {
  await h.goToBlock(page, 'p2')
}

const tapEl = async (h, page, selector, text) => {
  const c = await h.centerOf(page, selector, text)
  await h.tapAt(page, c.x, c.y)
  return c
}

/** 段落の最後の字のすぐ右をタップして、紙面の上で書き始める（キーボードを仮に出す） */
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

async function done(page, h) {
  await tapEl(h, page, '.direct-bar .db-done')
  await h.phoneKeyboard(page, false)
  await h.sleep(300)
  await h.ready(page)
}

export async function run({ page, rec, h }) {
  rec.mark('start')
  await h.sleep(3000)

  rec.mark('tap')
  await h.sleep(1000)
  await tapToWrite(page, h, 'p2')
  await h.sleep(1200)

  rec.mark('type')
  await h.sleep(400)
  await h.typeSlow(page, '帯の金色は、砂漠の夕日をイメージしました。')
  await page.waitForSelector('.direct-bar .db-issue', { timeout: 10000 })

  rec.mark('line')
  await h.sleep(4500)

  rec.mark('done')
  await h.sleep(1000)
  await done(page, h)
  await page.waitForSelector(tab ? '.nav-check.err' : '.err-strip', { timeout: 10000 })
  await h.sleep(4200)

  rec.mark('open')
  await h.sleep(600)
  await tapEl(h, page, tab ? '.p-nav .nav-check' : '.err-strip')
  await page.waitForSelector('.sheet .issue.error')
  await h.sleep(3000)

  rec.mark('pick')
  await tapEl(h, page, '.sheet .issue.error')
  await h.sleep(800)
  await h.ready(page)
  await h.sleep(2000)

  rec.mark('fix')
  await tapToWrite(page, h, 'p2')
  await h.sleep(1600)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Backspace')
    await h.sleep(260)
  }
  await h.typeSlow(page, 'た。')
  await page.waitForFunction(() => !document.querySelector('.direct-bar .db-issue'), { timeout: 10000 })
  await h.sleep(2600)

  rec.mark('gone')
  await h.sleep(800)
  await done(page, h)
  await h.sleep(3600)
}
