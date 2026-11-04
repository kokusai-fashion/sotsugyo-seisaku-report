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

/** 姓・名と、そのふりがな（依頼者の選択 2026-11-04 mockups/v101） */
export interface NameParts {
  familyName: string
  givenName: string
  familyKana: string
  givenKana: string
}

/** 姓と名から、表紙の氏名を作る（間は全角の空白1つ。英字の名前は半角の空白。名が空なら姓だけ） */
export function joinName(familyName: string, givenName: string): string {
  const family = familyName.trim()
  const given = givenName.trim()
  if (!given) return tidyName(family)
  if (!family) return tidyName(given)
  return tidyName(`${family}${LATIN.test(family.slice(-1)) || LATIN.test(given[0]) ? ' ' : '　'}${given}`)
}

/**
 * 原稿の姓・名・ふりがな。前の原稿（氏名の欄が1つだったころ）は、氏名を最初の空白で姓と名に分ける
 * （空白がなければ、全部を姓に入れる。ふりがなは空）
 */
export function nameParts(info: { name: string; familyName?: string; givenName?: string; familyKana?: string; givenKana?: string }): NameParts {
  if (info.familyName !== undefined || info.givenName !== undefined) {
    return { familyName: info.familyName ?? '', givenName: info.givenName ?? '', familyKana: info.familyKana ?? '', givenKana: info.givenKana ?? '' }
  }
  const name = tidyName(info.name)
  const gap = /\s/.exec(name)
  return {
    familyName: gap ? name.slice(0, gap.index) : name,
    givenName: gap ? name.slice(gap.index + 1).trim() : '',
    familyKana: info.familyKana ?? '',
    givenKana: info.givenKana ?? '',
  }
}

/** ふりがなをカタカナにそろえる（ひらがなで打っても、カタカナにする。前後の空白を除き、間の空白は1つ） */
export function toKatakana(text: string): string {
  return text
    // 濁点が別の字になっている形（Mac のファイル名・PDF から写した「カ゛」）は、1字にまとめる
    .normalize('NFC')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\r\n]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** ふりがなとして使えない字があるか（カタカナ・長音・中黒・空白のほかの字。英字の名前の人は英字のままでもよい） */
export function kanaProblem(kana: string): boolean {
  return !!kana && !/^[゠-ヿ･-ﾟ A-Za-zＡ-Ｚａ-ｚ'’.-]+$/.test(kana)
}

/**
 * 氏名の4つの欄が、入れ終わっているか（姓とセイは必ず。名を入れたら、メイも）。
 * はじめての案内の「氏名」の段は、そろうまで閉じられない（依頼者の選択 2026-11-04）
 */
export function namePartsDone(p: NameParts): boolean {
  if (!p.familyName.trim() || !p.familyKana.trim() || kanaProblem(p.familyKana)) return false
  if (p.givenName.trim() && (!p.givenKana.trim() || kanaProblem(p.givenKana))) return false
  return true
}

/** 姓と名の間に空白がない（「文化花子」）。英字の名前・「・」でつないだ名前・1字だけは見ない */
export function nameWithoutSpace(name: string): boolean {
  const t = name.trim()
  return t.length >= 2 && !/\s/.test(t) && !LATIN.test(t) && !/[・･=＝]/.test(t)
}
