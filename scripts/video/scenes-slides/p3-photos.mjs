// 学生向けスライドの「スマホ編」③作品写真（依頼者 2026-11-03）。スライドでは、スマホの画面の所だけを切り出して使う。
// 録る前に、作品写真のページを空にしておく（1枚の並べ方・写真なし）。
// 枠をタップ → 正面の写真（public/trial/g-photo1.jpg）→ 並べ方を「2枚 左右」→ 右の枠に後ろ姿（public/trial/w-back.jpg）→
// 左の写真をタップ →「トリミング」→ 枠を少し小さくして（写真を大きく見せて）「これで決める」
// 録る：APP_URL=<まとめた版> node scripts/video/record.mjs ../scenes-slides/p3-photos
import { resolve } from 'node:path'

export const meta = {
  number: 'S3',
  label: 'スマホで作品写真を入れる',
  device: 'phone',
  captions: {
    photo: '作品写真のページの枠をタップして、写真を選びます',
    layout: '並べ方は、下のボタンで選びます',
    second: '空いた枠をタップして、2枚目を選びます',
    trim: '写真をタップして「トリミング」を押すと、写る範囲を決められます',
    apply: '「これで決める」で、紙面の写真に入ります',
  },
}

const PHOTOS = '.page-viewport.front [data-vivliostyle-page-container].is-current'

export async function prepare({ page, h }) {
  await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await page.evaluate(() => window.__editor.update((r) => ({ ...r, workPhotos: [{ layout: 1, imageIds: [''] }] })))
  await h.sleep(500)
  await h.ready(page)
  await page.evaluate(() => window.__editor.goToPage(window.__editor.getSnapshot().layout.kinds.lastIndexOf('photos'), 'none'))
  await h.sleep(600)
  await h.ready(page)
}

const tapEl = async (h, page, selector, text) => {
  const c = await h.centerOf(page, selector, text)
  await h.tapAt(page, c.x, c.y)
  return c
}

/** 枠（slot 番目）をタップして、写真を選ぶ */
async function choosePhoto(page, h, slot, file) {
  const c = await h.centerOf(page, `${PHOTOS} [data-photo-slot="${slot}"]`)
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 20000 }), h.tapAt(page, c.x, c.y)])
  await h.sleep(700)
  await chooser.accept([resolve(`public/trial/${file}`)])
  await page.waitForFunction((slot) => !!window.__editor.getSnapshot().report.workPhotos[0].imageIds[slot], { timeout: 30000 }, slot)
  await h.ready(page).catch(() => {})
}

export async function run({ page, rec, h }) {
  rec.mark('photo')
  await h.sleep(1800)
  await choosePhoto(page, h, 0, 'g-photo1.jpg')
  await h.sleep(1800)

  // 並べ方：2枚 左右（下の道具）
  rec.mark('layout')
  await h.sleep(900)
  await tapEl(h, page, '.sel-bar .lay', '左右')
  await h.sleep(400)
  await h.ready(page)
  await h.sleep(1500)

  rec.mark('second')
  await h.sleep(600)
  await choosePhoto(page, h, 1, 'w-back.jpg')
  await h.sleep(1800)

  // 左の写真をタップ →「トリミング」
  rec.mark('trim')
  await h.sleep(600)
  await tapEl(h, page, `${PHOTOS} [data-photo-slot="0"] img`)
  await h.sleep(1300)
  await tapEl(h, page, '.sel-bar .tb', 'トリミング')
  await page.waitForSelector('.trim-modal .trim-handle.se', { timeout: 20000 })
  await h.sleep(1500)
  const se = await h.centerOf(page, '.trim-modal .trim-handle.se')
  await h.swipe(page, { x: se.x, y: se.y }, { x: se.x - 70, y: se.y - 70 }, 900)
  await h.sleep(1400)

  rec.mark('apply')
  await h.sleep(500)
  await tapEl(h, page, '.trim-modal .trim-apply')
  await h.sleep(400)
  await h.ready(page).catch(() => {})
  await h.sleep(2400)
}
