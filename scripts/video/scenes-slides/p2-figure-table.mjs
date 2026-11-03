// 学生向けスライドの「スマホ編」②図と表を入れる（依頼者 2026-11-03）。スライドでは、スマホの画面の所だけを切り出して使う。
// 前半：「ii．サルエルパンツ」の段落（p7）をタップ →「図」→ サルエルパンツの写真（public/trial/w-pants.jpg）→ タイトル →「完了」
//   （録る前に、見本からサルエルパンツの図 r4 と、本文のその「（図5）」を外しておく。使い方の動画6と同じ）
// 後半：「iii．使用素材」の段落（p3）をタップ →「表」→「素材表を入れる」→「完了」
//   （録る前に、見本から使用材料表 t1 と、本文のその「（表1）」を外しておく）
// 録る：APP_URL=<まとめた版> node scripts/video/record.mjs ../scenes-slides/p2-figure-table
import { resolve } from 'node:path'

export const meta = {
  number: 'S2',
  label: 'スマホで図と表を入れる',
  device: 'phone',
  captions: {
    figure: '図は、段落をタップしてから「図」を押し、写真を選びます',
    caption: '図のタイトルを入力します。番号は自動で付きます',
    table: '表は、段落をタップしてから「表」を押します',
    material: '「素材表を入れる」で、使用材料表が入ります',
    done: '書き終えたら「完了」を押します',
  },
}

export async function prepare({ page, h }) {
  await page.evaluate(() => localStorage.setItem('sotsugyo-seisaku-report-pinch-tip', 'done'))
  await h.dropFigure(page, 'r4')
  // 使用材料表（t1）と、本文のその参照を外す
  await page.evaluate(() => {
    window.__editor.update((r) => ({
      ...r,
      body: r.body.map((c) => ({
        ...c,
        blocks: c.blocks
          .filter((b) => b.id !== 't1')
          .map((b) => {
            if (b.type !== 'paragraph') return b
            const content = b.content.filter((n) => !(n.type === 'ref' && n.targetId === 't1'))
            return { ...b, content: content.length ? content : [{ type: 'text', text: '' }] }
          }),
      })),
    }))
  })
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

const finish = async (page, h) => {
  await tapEl(h, page, '.direct-bar .db-done')
  await h.phoneKeyboard(page, false)
  await h.sleep(300)
  await h.ready(page)
}

export async function run({ page, rec, h }) {
  // 図
  rec.mark('figure')
  await h.sleep(1600)
  await tapToWrite(page, h, 'p7')
  await h.sleep(1200)
  const fig = await h.centerOf(page, '.direct-bar button[aria-label="図を入れる"]')
  const [chooser] = await Promise.all([page.waitForFileChooser(), h.tapAt(page, fig.x, fig.y)])
  await h.phoneKeyboard(page, false)
  await h.sleep(900)
  await chooser.accept([resolve('public/trial/w-pants.jpg')])
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId?.startsWith('f-'), { timeout: 30000 })
  await h.ready(page).catch(() => {})
  await h.sleep(300)
  await h.phoneKeyboard(page, true)
  await h.sleep(500)

  rec.mark('caption')
  await h.sleep(1000)
  await h.typeSlow(page, 'サルエルパンツ')
  await h.sleep(1300)
  await finish(page, h)
  await h.sleep(1600)

  // 表（使用素材の段落）
  await h.goToBlock(page, 'p3')
  await h.sleep(800)
  rec.mark('table')
  await h.sleep(1200)
  await tapToWrite(page, h, 'p3')
  await h.sleep(1000)
  await tapEl(h, page, '.direct-bar button[aria-label="表を入れる"]')
  await page.waitForSelector('.table-size .ts-material', { timeout: 20000 })
  // 表の大きさの欄が見えるよう、キーボードの絵は消す
  await h.phoneKeyboard(page, false)
  await h.sleep(1800)

  rec.mark('material')
  await tapEl(h, page, '.table-size .ts-material')
  await page.waitForFunction(() => window.__editor.getSnapshot().report.body.flatMap((c) => c.blocks).some((b) => b.type === 'table'), { timeout: 30000 })
  await h.ready(page).catch(() => {})
  await h.phoneKeyboard(page, true)
  await h.sleep(2600)

  rec.mark('done')
  await h.sleep(600)
  if (await page.$('.direct-bar .db-done')) await finish(page, h)
  else await h.phoneKeyboard(page, false)
  await h.sleep(2200)
}
