// 場面7：表紙に氏名とサブタイトルを入れる（はじめての案内の「氏名」の段：姓・名・セイ・メイ → サブタイトル → 表紙ができました）
import { captionsOf, CUR, press, say } from './_common.mjs'

const sentences = [
  '続けて、表紙を入れます。',
  '氏名は、姓と名、ふりがなをカタカナで入れます。',
  'ふりがなは表紙には出ず、先生が名前の順に並べるのに使います。',
  '次に、サブタイトルを入れます。',
  '言葉を打って Enter を押すと、表紙ができあがります。',
  '年度や学籍番号などは、自動で入ります。',
]
export const meta = { number: '07', label: '表紙に氏名とサブタイトルを入れる', device: 'pc', open: { guide: true }, sentences, captions: captionsOf(sentences) }

export async function prepare({ page, h }) {
  // コースを選び、「Word で書き始めていますか？」に「いいえ」（ここまでは場面6で見せる）
  await page.waitForSelector('.guide.step-course .g-opts button')
  await page.evaluate(() => [...document.querySelectorAll('.guide .g-opts button')].find((b) => b.textContent.includes('映画・舞台衣装')).click())
  await page.waitForSelector('.guide.step-word .g-word-opt.no')
  await page.evaluate(() => document.querySelector('.g-word-opt.no').click())
  await page.waitForSelector('.guide.step-name .name-fields input')
  await h.ready(page)
  await h.sleep(800)
}

// 操作はゆっくり見せ、話している所だけを枠で囲む（依頼者 2026-11-04）。録画は速めない（声のほうを操作に合わせて置く：timeWarp.mjs）
export async function run({ page, rec, h }) {
  const tip = () => h.rectOf(page, '.g-tip')
  const name = await h.blockRect(page, 'basic:name')
  // 1 続けて、表紙を入れます（表紙の氏名の欄）
  await say(page, rec, h, 's1', { focus: h.union(await tip(), name) })
  await h.box(page, name)
  await h.sleep(900)
  // 2 氏名は、姓と名、ふりがなをカタカナで入れます（姓・名を打つ）
  await say(page, rec, h, 's2', { focus: await tip() })
  await h.box(page, '.guide .name-fields')
  await h.sleep(600)
  for (const [cls, text] of [['nf-familyName', '文化'], ['nf-givenName', '花子']]) {
    await h.clickEl(page, `.guide .${cls} input`)
    await h.typeSlow(page, text)
    await h.sleep(300)
  }
  await h.sleep(400)
  // 3 ふりがなは表紙には出ず、先生が名前の順に並べるのに使います（セイ・メイを打つ）
  await say(page, rec, h, 's3', { focus: h.union(await h.rectOf(page, '.guide .name-fields'), await h.rectOf(page, '.guide .nf-note')) })
  // ふりがなの2つの欄を、1つの枠で囲む（1つずつだと、間で枠が重なった）
  await h.box(page, h.union(await h.rectOf(page, '.guide .nf-familyKana'), await h.rectOf(page, '.guide .nf-givenKana')))
  await h.sleep(500)
  for (const [cls, text] of [['nf-familyKana', 'ブンカ'], ['nf-givenKana', 'ハナコ']]) {
    await h.clickEl(page, `.guide .${cls} input`)
    await h.typeSlow(page, text)
    await h.sleep(300)
  }
  await h.sleep(600)
  // 4 次に、サブタイトルを入れます（「次へ」→ サブタイトルを打つ → Enter）
  await say(page, rec, h, 's4', { focus: await tip() })
  await press(page, h, '.guide.step-name .g-actions .primary')
  await page.waitForFunction(() => window.__editor.getSnapshot().editingId === 'basic:subtitleInput', { timeout: 30000 })
  await h.ready(page)
  await h.sleep(300)
  // 5 言葉を打って Enter を押すと、表紙ができあがります（声のない時間を短くするため、2026-11-04 に足した文）
  await say(page, rec, h, 's5', { focus: h.union(await h.rectOf(page, '.g-spot'), await tip()) })
  // 打っている欄（紙面の上に重ねた入力の欄）に枠を付ける。紙面の欄に付けると、打つと欄が伸びて枠からはみ出した
  await h.box(page, '.overlay-clip:not([hidden]) .overlay-editor')
  await h.sleep(600)
  await h.typeSlow(page, 'シンドバッド')
  await h.sleep(600)
  await page.keyboard.press('Enter')
  await page.waitForSelector('.guide.step-done')
  await h.ready(page)
  await h.unbox(page)
  await h.sleep(500)
  // 「表紙ができました」の吹き出しを閉じる（年度と学籍番号が見えるように。話の中身ではないので、マウスで押して見せない）
  await page.evaluate(() => [...document.querySelectorAll('.guide.step-done .g-actions button')].find((b) => b.textContent.includes('閉じる')).click())
  await h.sleep(400)
  // 6 年度や学籍番号などは、自動で入ります
  // 年度は全角の数字（例：２０２６年度）
  const year = await h.rectOf(page, `${CUR} .el.year`)
  if (!year) throw new Error('表紙の年度が見つかりません')
  const id = await h.blockRect(page, 'basic:studentId')
  await say(page, rec, h, 's6', { focus: h.union(year, id) })
  await h.box(page, [year, id])
  await h.sleep(1800)
}
