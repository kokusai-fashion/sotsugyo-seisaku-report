import { listItemLine, typedHeading } from '../model/headingText'

/**
 * ほかのアプリ（Word・Google ドキュメント・ウェブ・PDF・メモ）からコピーした文を、書く欄に入れる前にそろえる（学生の試し 5回目 2026-10-30）。
 * - 見えない字：Word の行の区切り（Shift+Enter の U+000B）・行の区切り（U+2028・U+2029）は改行に、ノーブレークスペースは空白に、
 *   ゼロ幅の字・BOM・ソフトハイフンは除く。Mac の分かれた濁点（か＋゛）は1字にする（紙面に「☒」の箱が出ていた）
 * - ウェブのふりがな（ルビ）：コピーの HTML の <ruby> から、本文の「刺繍ししゅう」「刺繍（ししゅう）」のふりがなを除く
 */
export function tidyPasted(text: string, html = ''): string {
  let t = text
    .normalize('NFC')
    .replace(/[\u000B\u2028\u2029]/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
  for (const { base, reading } of rubyPairs(html)) {
    for (const form of [`${base}（${reading}）`, `${base}(${reading})`, `${base}${reading}`]) t = t.split(form).join(base)
  }
  return t
}

/** コピーの HTML の、ふりがなの組（本文の字・ふりがな） */
function rubyPairs(html: string): { base: string; reading: string }[] {
  if (!/<rt[\s>]/i.test(html)) return []
  const pairs: { base: string; reading: string }[] = []
  const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  for (const m of html.matchAll(/<ruby[^>]*>([\s\S]*?)<\/ruby>/gi)) {
    const inner = m[1]
    const reading = strip([...inner.matchAll(/<rt[^>]*>([\s\S]*?)<\/rt>/gi)].map((r) => r[1]).join(''))
    const base = strip(inner.replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '').replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, ''))
    if (base && reading) pairs.push({ base, reading })
  }
  return pairs
}

/** 文の終わりの印（ここで終わる行は、PDF の行の折り返しではない） */
const SENTENCE_END = /[。．.！!？?」』）)：:…]$/
/** 折り返したと見る行の短さの下限（短い行は、見出し・箇条・題目のことが多い） */
const WRAP_MIN = 15

/**
 * PDF などからコピーした、行の終わりごとの改行（文の途中の改行）をつなぐ。行ごとに段落が切れ、言葉の途中でも1字下げが付いていた（学生の試し 5回目）。
 * 3行以上で、半分以上の行が「文の終わりの印がなく、長い行」のときだけ（ふつうの下書きの段落の分かれ目は、つながない）。
 * 次の行が見出し・箇条・全角空白の字下げで始まるときは、つながない
 */
export function joinWrappedLines(lines: string[]): { lines: string[]; joined: boolean } {
  if (lines.length < 3) return { lines, joined: false }
  const wrapped = (line: string) => line.length >= WRAP_MIN && !SENTENCE_END.test(line.trim())
  const starts = (line: string) => /^[　・●○■◆\-－]/.test(line) || !!typedHeading(line.trim()) || listItemLine(line.trim())
  if (lines.filter(wrapped).length * 2 < lines.length) return { lines, joined: false }
  const out: string[] = []
  let joined = false
  for (const line of lines) {
    const prev = out.at(-1)
    if (prev !== undefined && wrapped(prev) && !starts(line)) {
      out[out.length - 1] = prev + line.trim()
      joined = true
    } else out.push(line)
  }
  return { lines: out, joined }
}

/** 箇条書きの番号の行（「1.⇥ミシン」「①シーチング」「（1）素材」など。見出しの形でも、続けて並べば箇条書き） */
export function listishLine(line: string): boolean {
  const t = line.trim()
  return listItemLine(t) || /^[①-⑳]/.test(t)
}

/** コピーの HTML の、最初の表のマスの字（行ごと）。表がなければ空（貼った表を表にする：mockups/v78 ③ 案A） */
export function tableRows(html: string): string[][] {
  if (typeof DOMParser === 'undefined') return []
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table')
  if (!table) return []
  return [...table.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim()))
}
