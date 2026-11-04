// 場面9：見出しを入れる（左の「中見出し」「小見出し」。番号と目次は自動。大見出しはコースの下書きに入っている）
import { captionsOf, clickThumb, CUR, exactButton, press, say } from './_common.mjs'

const sentences = [
  '見出しは、入れたい所をクリックして、左の「中見出し」を押して入れます。',
  'その下の見出しも、入れたい所をクリックして、「小見出し」で入れます。',
  '番号は自動で付き、目次にも自動で入ります。',
  '大見出しは、コースの下書きに入っています。',
]
export const meta = { number: '09', label: '見出しを入れる', device: 'pc', sentences, captions: captionsOf(sentences) }

export async function prepare({ page, h }) {
  // ターバンの段落（p9）のあるページから
  await h.goToBlock(page, 'p9')
  await h.sleep(500)
}

/** 左の道具の、文字がちょうど text のボタン（「中見出し」と「中見出しにする」を見分ける） */
async function tool(page, text) {
  await page.waitForFunction((t) => [...document.querySelectorAll('.palette .tb')].some((b) => b.textContent.trim().endsWith(t) && b.getBoundingClientRect().width > 0), { timeout: 15000 }, text)
  return exactButton(page, '.palette .tb', text)
}

/** 段落 id の終わりをクリックして、その段落を書いている状態にする */
async function clickEndOf(page, h, id) {
  const end = await h.endOfBlock(page, id)
  await h.clickAt(page, end.x, end.y)
  await page.waitForFunction((id) => window.__editor.getSnapshot().editingId === id, { timeout: 15000 }, id)
  await h.sleep(500)
}

/** 表示しているページの、文字が re に合う要素の範囲 */
const rectsWith = (page, selector, re) =>
  page.evaluate(
    (selector, re) =>
      [...document.querySelectorAll(selector)]
        .filter((e) => e.getBoundingClientRect().width > 0 && new RegExp(re).test(e.textContent))
        .map((e) => {
          const r = e.getBoundingClientRect()
          return { x: r.left, y: r.top, w: r.width, h: r.height }
        }),
    selector,
    re,
  )

// 操作はゆっくり見せ、話している所だけを枠で囲む（依頼者 2026-11-04）。録画は速めない（声のほうを操作に合わせて置く：timeWarp.mjs）
/** 書いている所（紙面の上に重ねた入力の欄） */
const EDITING = '.overlay-clip:not([hidden]) .overlay-editor'

/**
 * 段落 id の終わりをクリックし、左の道具の text を押して見出しを入れ、title を打って閉じる。
 * 寄る所を、クリックする段落 → 押すボタン → 打っている見出し、と順に移す（前は全体のままで、字が小さくて見えなかった）
 */
async function addHeading(page, rec, h, id, text, title, tag) {
  await clickEndOf(page, h, id)
  const b = await tool(page, text)
  rec.mark(`${tag}b`, { focus: h.union(b.rect, await h.rectOf(page, EDITING)) })
  await h.sleep(300)
  await press(page, h, b)
  await h.sleep(300)
  rec.mark(`${tag}c`, { focus: await h.rectOf(page, EDITING) })
  await h.sleep(500)
  await h.typeSlow(page, title)
  await h.sleep(700)
  // Esc で閉じると、キーボードで選んだ印（ツールの黄色い枠）が見出しに残り、話の枠とまぎらわしいので外す
  await page.keyboard.press('Escape')
  await h.ready(page)
  await page.evaluate(() => document.activeElement?.blur())
  await h.sleep(400)
}

export async function run({ page, rec, h }) {
  // 1 見出しは、入れたい所をクリックして、左の「中見出し」を押して入れます（ターバンの段落の終わり →「中見出し」→ アクセサリー）
  await say(page, rec, h, 's1', { focus: await h.blockRect(page, 'p9') })
  await addHeading(page, rec, h, 'p9', '中見出し', 'アクセサリー', 's1')
  // 2 その下の見出しも、入れたい所をクリックして、「小見出し」で入れます（同じページで、ターバンの段落の終わり →「小見出し」→ ターバンの飾り。ページを移る間の無音をなくす）
  await say(page, rec, h, 's2', { focus: await h.blockRect(page, 'p9') })
  await addHeading(page, rec, h, 'p9', '小見出し', 'ターバンの飾り', 's2')
  // 3 番号は自動で付き、目次にも自動で入ります（入れた2つの見出しの番号 → 目次のページの、入った2つの行）
  const sub = await rectsWith(page, `${CUR} h2.subheading`, 'アクセサリー|ターバンの飾り')
  if (sub.length !== 2) throw new Error(`入れた見出しが ${sub.length} つしか見つかりません`)
  await say(page, rec, h, 's3', { focus: h.union(...sub) })
  // 寄り終わってから枠を出す（寄っている間に出すと、見えている時間が短すぎた）
  await h.sleep(800)
  await h.box(page, sub)
  await h.sleep(1800)
  await h.unbox(page)
  await clickThumb(page, h, await page.evaluate(() => window.__editor.getSnapshot().layout.kinds.indexOf('toc')))
  const rows = await rectsWith(page, `${CUR} .toc .toc-sub`, 'アクセサリー|ターバンの飾り')
  if (!rows.length) throw new Error('目次に、入れた見出しが見つかりません')
  rec.mark('s3b', { focus: await h.rectOf(page, `${CUR} .toc`) })
  // 入った2つの行を、1つの枠で囲む（1行ずつだと、枠どうしが重なって字を隠した）
  await h.box(page, h.union(...rows))
  await h.sleep(1800)
  // 4 大見出しは、コースの下書きに入っています（目次の、Ⅰ・Ⅱ・Ⅲ の行。前は章のページへ移って見せたが、移る間に声が終わった）
  await say(page, rec, h, 's4', { focus: await h.rectOf(page, `${CUR} .toc`) })
  await h.sleep(500)
  await h.box(page, `${CUR} .toc .toc-ch`, { all: true })
  await h.sleep(2200)
}
