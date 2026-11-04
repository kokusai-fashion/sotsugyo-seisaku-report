// 学生向けの動画の場面で共通に使うもの（依頼者の希望 2026-11-04：ナレーションと同じ字幕・話している所を枠で囲む）
/** 台本の文から、字幕（印 s1, s2 … ごと）を作る。字幕は声と同じ文（依頼者の選択） */
export const captionsOf = (sentences) => Object.fromEntries(sentences.map((s, i) => [`s${i + 1}`, s]))

/** 文字が text で終わるボタン（左の道具は、絵の字（ⅰ・(1)）の後ろに名前。「中見出し」と「中見出しにする」を見分ける）の中央 */
export const exactButton = (page, selector, text) =>
  page.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim().endsWith(text))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: { x: r.left, y: r.top, w: r.width, h: r.height } }
    },
    selector,
    text,
  )

/** 表示している紙面のページの範囲 */
export const CUR = '.page-viewport.front [data-vivliostyle-page-container].is-current'

/**
 * 左のページの一覧で、index ページ目（0 から）の絵を押す。一覧の見えない所にあれば、先に見える所まで送る
 * （送らずに押すと、画面の外を押して何も起きなかった）
 */
export async function clickThumb(page, h, index) {
  await page.evaluate((i) => document.querySelectorAll('.thumb-list button.t')[i]?.scrollIntoView({ block: 'center' }), index)
  await h.sleep(400)
  const c = await page.evaluate((i) => {
    const r = document.querySelectorAll('.thumb-list button.t')[i]?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }, index)
  if (!c) throw new Error(`ページの一覧に ${index + 1} ページ目がありません`)
  await h.clickAt(page, c.x, c.y, { pause: 500 })
  await h.sleep(600)
  await h.ready(page)
}

/**
 * 文 name を話し始める：前の文の枠を消してから、印を付ける（依頼者 2026-11-04：枠が残ったまま次へ移っていた）。
 * extra：拡大して見せる範囲（focus）など（compose.mjs）
 */
export async function say(page, rec, h, name, extra = {}) {
  await h.unbox(page)
  rec.mark(name, extra)
}

/** selector の要素（text を含むもの・ends で終わるもの）の中央と範囲。なければ例外 */
export async function find(page, selector, { text, ends } = {}) {
  const r = await page.evaluate(
    (selector, text, ends) => {
      const el = [...document.querySelectorAll(selector)].find(
        (e) => e.getBoundingClientRect().width > 0 && (!text || e.textContent.includes(text)) && (!ends || e.textContent.trim().endsWith(ends)),
      )
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, rect: { x: b.left, y: b.top, w: b.width, h: b.height } }
    },
    selector,
    text,
    ends,
  )
  if (!r) throw new Error(`見つかりません：${selector}${text ? `（${text}）` : ''}${ends ? `（…${ends}）` : ''}`)
  return r
}

/**
 * 押す所を枠で囲んでから、マウスをゆっくり動かして押す。押したら枠を消す（押したあとに画面が変わっても、枠を残さない）。
 * target：selector（text・ends で選ぶ。枠はその要素にくっつく）か、{ x, y, rect }（exactButton・find の戻り値）
 */
export async function press(page, h, target, { text, ends, before = 500, after = 350 } = {}) {
  const c = typeof target === 'string' ? await find(page, target, { text, ends }) : target
  if (typeof target === 'string') await h.box(page, target, { text, ends })
  else await h.box(page, c.rect)
  await h.sleep(before)
  await h.clickAt(page, c.x, c.y)
  await h.sleep(after)
  await h.unbox(page)
  return c
}
