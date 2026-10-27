/**
 * 表紙・抄録の氏名の書き方をそろえる（依頼者の選択 2026-10-28 案1）。
 * 姓と名の間は全角の空白1つ（例：文化　花子。表紙のひな形の仮の字「●●　●●●」と同じ）。
 * 英字の名前（留学生など）は、全角の空白にすると間が広く見えるので、英字のとなりの空白は打ったままにする
 */

/** 英字（半角・全角のローマ字と、アクセントの付いた字） */
const LATIN = /[A-Za-zＡ-Ｚａ-ｚÀ-ɏ]/

/** 前後の空白を除き、姓と名の間の空白（半角・続いた空白）を全角の空白1つにする。英字のとなりの空白は、そのまま */
export function tidyName(text: string): string {
  const name = text.replace(/[\r\n]/g, '').replace(/^\s+|\s+$/g, '')
  return name.replace(/\s+/g, (gap, at: number) => (LATIN.test(name[at - 1]) || LATIN.test(name[at + gap.length]) ? gap : '　'))
}

/** そろっていない空白（半角の空白・続いた空白）の、最初の1つの位置（end は含まない）。英字のとなりは見ない。なければ null */
export function untidyNameGap(name: string): { start: number; end: number; half: boolean } | null {
  for (const m of name.matchAll(/(?<=\S)\s+(?=\S)/g)) {
    const end = m.index + m[0].length
    if (m[0] === '　' || LATIN.test(name[m.index - 1]) || LATIN.test(name[end])) continue
    return { start: m.index, end, half: /[^　]/.test(m[0]) }
  }
  return null
}

/** 姓と名の間に空白がない（「文化花子」）。英字の名前・「・」でつないだ名前・1字だけは見ない */
export function nameWithoutSpace(name: string): boolean {
  const t = name.trim()
  return t.length >= 2 && !/\s/.test(t) && !LATIN.test(t) && !/[・･=＝]/.test(t)
}
