// 動画 6：スマホで書く（スマホ：390×844。動画では縦長の画面を左に置き、右に字幕を出す）
// 2026-11-03 の画面：段落をタップすると、文字の幅まで大きくなり、紙面の上でそのまま書く。キーボードのすぐ上に
// 「削除」「戻す」「図」「表」「見出し」「改ページ」「完了」（mockups/v96 案2）。「完了」でページ全体に戻る。ページは上下にはらってめくる。
// 2本の指で拡大。拡大中は下に「◀ ▶ ｜ 全体」（mockups/v98 ② 案A）
// ヘッドレスの Edge では本物のキーボードが出ないので、書いている間は、画面の下に iPhone のキーボードの絵を仮に出す（session.phoneKeyboard）。
// 見本「シンドバッド」の「ii．サルエルパンツ」の段落（p7）に1文を書き足し、サルエルパンツの写真（public/trial/w-pants.jpg）を図として入れる。
// そのため、録る前に見本からサルエルパンツの図（r4）と、本文のその「（図5）」を外しておく（動画 2 と同じ）
import { resolve } from 'node:path'

export const meta = {
  number: '6',
  label: 'スマホで書く',
  device: 'phone',
  captions: {
    tap: '書きたい段落をタップすると、文字が大きくなり、そのまま書けます',
    bar: '「図」「表」「見出し」などのボタンは、キーボードのすぐ上にあります',
    type: 'キーボードで、そのまま文を入力します',
    done: '書き終えたら「完了」を押します。ページ全体の表示に戻ります',
    figure: '図を入れるときは、段落をタップしてから「図」を押し、写真を選びます',
    caption: '図のタイトルを入力します。図の番号は自動で付きます',
    swipe: '紙面を指で上下にはらうと、ページをめくれます',
    pinch: '2本の指で広げると、紙面を拡大できます',
    unzoom: '下の「全体」を押すと、元の大きさに戻ります',
    check: '直すところは、画面の下の「チェック」で確かめられます',
    end: 'PDF も、画面の下の「PDF」から書き出せます',
  },
}

export async function prepare({ page, h }) {
  // はじめて書くときの「字を大きくするには」の知らせは出さない（紙面が隠れるため。広げ方は動画の後半で見せる）
  await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await h.dropFigure(page, 'r4')
  await h.sleep(500)
  await h.ready(page)
  await h.goToBlock(page, 'p7')
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

export async function run({ page, rec, h }) {
  // 1. 段落をタップ → 大きくなって、紙面の上で書く
  rec.mark('tap')
  await h.sleep(2600)
  await tapToWrite(page, h, 'p7')
  await h.sleep(1600)

  // 2. キーボードの上の道具
  rec.mark('bar')
  await h.sleep(4300)

  // 3. 打つ
  rec.mark('type')
  await h.sleep(600)
  await h.typeSlow(page, '裾の刺繍は、足首の正面に合わせた。')
  await h.sleep(1200)

  // 4. 「完了」→ ページ全体に戻る
  rec.mark('done')
  await h.sleep(1500)
  await tapEl(h, page, '.direct-bar .db-done')
  await h.phoneKeyboard(page, false)
  await h.sleep(300)
  await h.ready(page)
  await h.sleep(2200)

  // 5. 図を入れる（段落をタップ →「図を入れる」→ 写真を選ぶ）
  rec.mark('figure')
  await h.sleep(1500)
  await tapToWrite(page, h, 'p7')
  await h.sleep(1300)
  const fig = await h.centerOf(page, '.direct-bar button[aria-label="図を入れる"]')
  const [chooser] = await Promise.all([page.waitForFileChooser(), h.tapAt(page, fig.x, fig.y)])
  await h.phoneKeyboard(page, false)
  await h.sleep(900)
  await chooser.accept([resolve('public/trial/w-pants.jpg')])
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  await h.phoneKeyboard(page, true)
  await h.sleep(600)

  // 6. 図のタイトル
  rec.mark('caption')
  await h.sleep(1300)
  await h.typeSlow(page, 'サルエルパンツ')
  await h.sleep(1500)
  await tapEl(h, page, '.direct-bar .db-done')
  await h.phoneKeyboard(page, false)
  await h.sleep(300)
  await h.ready(page)
  await h.sleep(1800)

  // 7. ページを上下にはらってめくる（上へで次、下へで前）
  rec.mark('swipe')
  await h.sleep(1300)
  await h.swipe(page, { x: 200, y: 600 }, { x: 205, y: 260 }, 320)
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1500)
  await h.swipe(page, { x: 200, y: 260 }, { x: 205, y: 600 }, 320)
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1200)

  // 8. 2本の指で広げる → 「ページ全体に戻す」
  rec.mark('pinch')
  await h.sleep(1000)
  await h.pinch(page, { x: 195, y: 360 }, 70, 230, 800)
  await h.sleep(500)
  await page.waitForSelector('.unzoom', { timeout: 10000 })
  await h.sleep(2000)
  rec.mark('unzoom')
  await h.sleep(1400)
  await tapEl(h, page, '.unzoom')
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1300)

  // 9. チェック
  rec.mark('check')
  await h.sleep(1100)
  await tapEl(h, page, '.p-nav .nav-check')
  await page.waitForSelector('.sheet')
  await h.sleep(3300)
  await tapEl(h, page, '.sheet .sheet-close')
  await h.sleep(700)

  // 10. PDF
  rec.mark('end')
  await h.sleep(1100)
  await tapEl(h, page, '.p-nav .nav-pdf')
  await h.sleep(3000)
}
