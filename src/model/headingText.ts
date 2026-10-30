/**
 * 見出しの形の行（手順書の番号の形：「Ⅲ．まとめ」「ⅱ．袖の刺繍」「II. 制作過程」など。番号はローマ数字）を見分ける。
 * - Word から読み込むとき・Word のファイルのチェック（import/wordImport.ts・check/）：headingFromText
 * - 段落に見出しの形で打ったとき（Enter・書き終えたとき）と、何行かの文を貼り付けたときに、見出しにする（editor/reportEditor.ts）：typedHeading
 * 算用数字などの形（「3．スカート」「2-1 仮縫い」「第4章 考察」）は、段落に打ったときだけ見出しにする（typedHeading の arabicHeading。
 * 番号はツールの形（ⅲ．など）に替わる。依頼者の選択 2026-10-24 mockups/v53 ② 案B）。Word から読み込むときは、今までどおり見出しにしない。
 * 「（1）素材」「①素材」「■まとめ」は見出しにしない（箇条書きの印として扱うだけ。依頼者の選択 2026-10-31）
 */

/** 空白（全角も） */
const SP = '[\\s\\u3000]'
const UPPER_ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ'
const LOWER_ROMAN = 'ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅺⅻ'
const HEADING_SEP = `${SP}*[．.、，,:：)）]${SP}*`
const ROMAN_WORD = /^(X{0,3})(IX|IV|V?I{0,3})$/

export interface HeadingText {
  level: 1 | 2
  title: string
}

/** 行の頭のローマ数字（Ⅰ．ⅰ．I. i. など）で見出しを見分ける。番号は除き、名前だけにする */
export function headingFromText(raw: string): HeadingText | null {
  const t = raw.replace(/[\n\t]/g, '').trim()
  const tryLevel = (level: 1 | 2, unicode: string, ascii: string): HeadingText | null => {
    // 機種依存のローマ数字（Ⅰ・ⅰ）は、区切り（．）がなくてもよい（短い行だけ）
    const u = new RegExp(`^([${unicode}]{1,3})(${HEADING_SEP}|${SP}*)(\\S.*)$`).exec(t)
    if (u) {
      const title = u[3].trim()
      if (u[2].length > 0 || (title.length <= 30 && !/[。！？]$/.test(title))) return { level, title }
    }
    // 英字・全角英字のローマ数字（I. Ⅱ を II と打ったなど）は、区切りがあり、短い行だけ
    const a = new RegExp(`^([${ascii}]{1,4})${HEADING_SEP}(\\S.*)$`).exec(t)
    if (a && ROMAN_WORD.test(a[1].normalize('NFKC').toUpperCase()) && a[2].length <= 40 && !/[。！？]$/.test(a[2])) return { level, title: a[2].trim() }
    return null
  }
  return tryLevel(1, UPPER_ROMAN, 'IVXＩＶＸ') ?? tryLevel(2, LOWER_ROMAN, 'ivxｉｖｘ')
}

/**
 * 英字のローマ数字に区切り（．）がなく、すぐ後ろが日本語の行（「iiiスカート」「IIIまとめ」）。スマホで「ⅲ」を出せずに英字で打つ学生がいた
 * （学生の試し：依頼者 2026-10-23）。英字の言葉（iPhone など）と分けるため、すぐ後ろが英数字のものは見出しにしない。短い行だけ。
 * 大文字1字（「Vネック」「Iライン」「Xライン」）は服の言葉なので、見出しにしない（大文字は「IIまとめ」のように2字から）
 */
function romanBeforeJapanese(raw: string): HeadingText | null {
  const t = raw.replace(/[\n\t]/g, '').trim()
  const m = /^([ivxIVXｉｖｘＩＶＸ]{1,4})(?![\x00-\x7f！-～])(\S.*)$/u.exec(t)
  if (!m) return null
  const numeral = m[1].normalize('NFKC')
  // 大文字・小文字がまざったもの（「Iv」など）は、ローマ数字とみなさない
  if (numeral !== numeral.toUpperCase() && numeral !== numeral.toLowerCase()) return null
  if (numeral === numeral.toUpperCase() && numeral.length < 2) return null
  if (!ROMAN_WORD.test(numeral.toUpperCase()) || m[2].length > 30 || /[。！？]$/.test(m[2])) return null
  return { level: numeral === numeral.toUpperCase() ? 1 : 2, title: m[2].trim() }
}

const DIGITS = '[0-9０-９]{1,2}'
/**
 * 算用数字・丸数字・記号で始まる行の形。heading：段落に打ったときに見出しにする形か。
 * 「（1）素材」「①素材」「■まとめ」は見出しにしない（箇条書きの印として、文末の「。」を付けない・続けて並べば箇条書き、にだけ使う。依頼者の選択 2026-10-31）
 */
const ARABIC_FORMS: { re: RegExp; level: 1 | 2; heading: boolean }[] = [
  { re: new RegExp(`^第${SP}*[0-9０-９一二三四五六七八九十]{1,3}${SP}*章(?:${HEADING_SEP}|${SP}*)(\\S.*)$`), level: 1, heading: true },
  // 「2-1 パターンと仮縫い」「2.1 仮縫い」（章-節の番号）。後ろは空白か日本語（「2.5cm」「2-3cm幅」は文）。Word から読み込んだ段落を、
  // 行の終わりで Enter を押して小見出しにできるように（学生の試し 2026-10-29：小見出しへの直し方が分からなかった）
  { re: new RegExp(`^${DIGITS}${SP}*[-－‐−.．]${SP}*${DIGITS}(?:${SP}+|(?=[^\\x00-\\x7f０-９]))(\\S.*)$`), level: 2, heading: true },
  { re: new RegExp(`^${DIGITS}${SP}*[．.、，,:：)）]${SP}*(\\S.*)$`), level: 2, heading: true },
  { re: new RegExp(`^[（(]${SP}*${DIGITS}${SP}*[)）]${SP}*(\\S.*)$`), level: 2, heading: false },
  { re: new RegExp(`^[①-⑳]${SP}*(\\S.*)$`), level: 2, heading: false },
  { re: new RegExp(`^[■□●◆◇▼▽★☆▶►]${SP}*(\\S.*)$`), level: 2, heading: false },
]

/**
 * 算用数字・丸数字・記号で始まる、見出しのつもりの行か箇条書きの行（学生の試し 2026-10-24：「3．スカート」と打つと段落のまま「。」が付き、体言止めの指摘が出ていた）。
 * 「第4章 考察」は大見出し、ほか（「3．スカート」「3.スカート」「2-1 仮縫い」「（1）素材」「①素材」「■まとめ」）は小見出しの大きさ。
 * 文を見出しにしないよう、名前は 20字まで・数字で始まらない（「2.5cm短くした」）・「、」がない・文の終わりの形（〜た・〜る・〜つ・〜です・〜ます など。ひらがなで終わるもの）でないものだけ
 */
function arabicForm(raw: string): (HeadingText & { heading: boolean }) | null {
  const t = raw.replace(/[\n\t]/g, '').trim()
  for (const { re, level, heading } of ARABIC_FORMS) {
    const m = re.exec(t)
    if (!m) continue
    const title = m[1].trim()
    if (title.length > 20 || /^[0-9０-９]/.test(title) || /[、，,]/.test(title) || /(う|く|ぐ|す|つ|ぬ|ぶ|む|る|た|だ|です|ます|ない|ません)$/.test(title)) return null
    return { level, title, heading }
  }
  return null
}

/** 段落に打ったときに見出しにする、算用数字などの形（「（1）」「①」「■」は除く） */
function arabicHeading(raw: string): HeadingText | null {
  const found = arabicForm(raw)
  return found?.heading ? { level: found.level, title: found.title } : null
}

/** 段落に打った見出しの名前の長さの上限（これより長い行は、文として段落のままにする） */
const TYPED_TITLE_MAX = 40

/**
 * 段落に打った1行（貼り付けた1行も）が、見出しにしてよい形か。見出しにするなら、大見出し（1）か小見出し（2）かと、番号を除いた名前。
 * headingFromText の形のうち、次のものだけ（段落の文を、知らないうちに見出しにしないように）：
 * - 番号のあとに名前がある（「Ⅲ．」だけは見出しにしない。名前に文字か数字が1つ以上ある）
 * - 文ではない（「。」「！」「？」で終わらない）。名前は 40字まで
 */
/**
 * 箇条書きにも使う形の行（「1．ミシン」「（1）素材」「①素材」「■まとめ」。小見出しにする算用数字・丸数字・記号の形）。
 * 本文をはさまずに、この形の行が続いたら、見出しにせずに箇条書き（段落）とみなす（PC の試し 2026-10-25：「1．ミシン」「2．アイロン」と
 * 1行ずつ打つと、全部が小見出しになり、目次と章立てが崩れた。依頼者の選択）。ローマ数字・「第4章」は見出しの形なので含めない
 */
export function listItemLine(line: string): boolean {
  if (headingFromText(line) || romanBeforeJapanese(line)) return false
  return arabicForm(line)?.level === 2
}

/** 小見出しにできる段落の長さの上限（左の道具の「小見出しにする」を出す） */
const SUBHEADING_MAX = 30

/**
 * 段落を小見出しにしたときの名前（左の道具の「この段落」の「小見出しにする」。mockups/v74 ⑦ 案A）。
 * 短く（30字まで）、文ではない（「。」「！」「？」がない）段落だけ。番号の形（「2-1」「ⅰ．」など）は除く（番号は自動で付く）。できなければ null
 */
export function subheadingTitle(text: string): string | null {
  const t = text.replace(/[\n\t]/g, '').trim()
  if (!t || t.length > SUBHEADING_MAX || /[。！？!?]/.test(t)) return null
  const found = numberedLine(t)
  return found?.level === 2 ? found.title : t
}

/** 名前として使えるか（文字か数字が1つ以上・40字まで・文の終わりの形でない） */
function usableTitle(found: HeadingText | null): HeadingText | null {
  if (!found) return null
  const title = found.title
  if (!/[\p{L}\p{Nd}]/u.test(title) || title.length > TYPED_TITLE_MAX || /[。！？!?]$/.test(title)) return null
  return found
}

export function typedHeading(line: string): HeadingText | null {
  return usableTitle(headingFromText(line) ?? romanBeforeJapanese(line) ?? arabicHeading(line))
}

/**
 * 番号・印で始まる行（見出しにしない「（1）」「①」「■」も）の、番号を除いた名前。見出しの欄に番号ごと貼ったときと、
 * 段落を自分で「小見出しにする」ときに、番号を外すのに使う（番号は自動で付くので、二重にしない）
 */
export function numberedLine(line: string): HeadingText | null {
  return usableTitle(headingFromText(line) ?? romanBeforeJapanese(line) ?? arabicForm(line))
}
