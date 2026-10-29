import { findCourse, type YearConfig } from '../config'
import { contentToText, numbering } from '../editor/reportOps'
import type { Report } from '../model/types'

/**
 * 抄録の文が、本文から抜き出したものか（抄録は本文の抜粋を1ページにまとめるもので、本文にないことを抄録で急に書かない：
 * 依頼者の指導 2026-10-29。依頼者の選択 mockups/v75 案A）。
 * 抄録の1文ずつを、本文の文と比べ、2字ずつの組のうち本文の文にあるものの割合（重なり）を出す。本文の2文を1文にまとめることもあるので、
 * いちばん重なる本文の文と、残りの組がいちばん重なる本文の文の、2文で数える（離れた2文でもよい）。
 * 言い方を少し変えただけなら高く、本文にない内容なら低くなる（見本で、抜き出した文・2文をまとめた文は 53〜100%、本文にない内容の文は 10〜41%）。
 * 字が重なるかを見るだけで、意味までは分からない（本文の語を組み替えた文は見逃すことがある。言い方を変えたまとめの文に出ることがある）。
 * 比べるのは学生の端末の中だけ（外に送らない）
 */

/** 重なりがこれより少ない文を知らせる */
export const ABSTRACT_SOURCE_LIMIT = 0.5
/** 比べる文の短さの下限（字。「以上である。」などの短い文は比べない） */
const MIN_CHARS = 8
/** 本文がこれより少ない文しかなければ（まだ書いていない）、比べない */
const MIN_BODY_SENTENCES = 3

export interface AbstractSentence {
  /** 抄録の段落 */
  blockId: string
  /** 段落の中の位置 */
  start: number
  end: number
  text: string
  /** 本文の文との重なり（0〜1） */
  overlap: number
  /** 本文のどこにも出てこない語（漢字2字以上・カタカナ2字以上） */
  newWords: string[]
}

/** 比べるための字（図表の参照・空白・句読点・かっこは見ない） */
const comparable = (text: string) => text.replace(/[（(][\s　]*[図表][\s　]*[0-9０-９]+[^（()）]*[）)]/g, '').replace(/[\s　、。，．,.！？!?（）()「」『』・：:…‥―-]/g, '')

function bigrams(text: string): string[] {
  const s = comparable(text)
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
  return out
}

/** 文に分ける（「。」「！」「？」まで。最後の、終わりの印のない文も） */
export function sentencesOf(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = []
  const re = /[^。！？!?]+[。！？!?]*/g
  for (const m of text.matchAll(re)) {
    const lead = m[0].length - m[0].trimStart().length
    const body = m[0].trim()
    if (body) out.push({ start: m.index + lead, end: m.index + lead + body.length, text: body })
  }
  return out
}

/** 語のかたまり：漢字2字以上（後ろの送り仮名も、助詞の前まで）・カタカナ2字以上 */
const words = (text: string) =>
  [...new Set((text.match(/[一-鿿々]{2,}[ぁ-ん]{0,3}|[ァ-ヴー]{2,}/g) ?? []).map((w) => w.replace(/[をにがはでとのへもやなだ][ぁ-ん]*$/, '')))]

/** 組 grams のうち、本文の2文（いちばん重なる文と、残りがいちばん重なる文）にあるものの割合 */
function coverage(grams: string[], sets: Set<string>[]): number {
  let first = -1
  let best = -1
  sets.forEach((set, i) => {
    const n = grams.filter((g) => set.has(g)).length
    if (n > best) {
      best = n
      first = i
    }
  })
  const rest = grams.filter((g) => !sets[first].has(g))
  let second = 0
  sets.forEach((set, i) => {
    if (i !== first) second = Math.max(second, rest.filter((g) => set.has(g)).length)
  })
  return (best + second) / grams.length
}

/** 抄録の書き出しの決まった文（「本制作報告書は、」）の頭。この頭で始まる文は比べない */
function openingHead(report: Report, config: YearConfig): string {
  const course = findCourse(config, report.basicInfo.courseId)?.abstractExample
  const example = (typeof course === 'string' && course.trim()) || config.abstract.openingExample || ''
  return comparable(example).slice(0, 7)
}

/** 本文から抜き出していないらしい抄録の文（重なりが ABSTRACT_SOURCE_LIMIT より少ない文）。本文をまだ書いていなければ、ない */
export function abstractAwayFromBody(report: Report, config: YearConfig): AbstractSentence[] {
  if (report.abstract.started === false) return []
  const num = numbering(report)
  const blocks = report.body.flatMap((c) => c.blocks)
  const bodySentences = blocks.flatMap((b) => (b.type === 'paragraph' ? sentencesOf(contentToText(b.content, num)).map((s) => s.text) : [])).filter((s) => comparable(s).length >= MIN_CHARS)
  if (bodySentences.length < MIN_BODY_SENTENCES) return []
  const sets = bodySentences.map((s) => new Set(bigrams(s)))
  // 本文のどこかにある語か（見出し・図表のタイトル・表の中身・サブタイトルも）
  const bodyText = comparable(
    [
      report.basicInfo.subtitleInput,
      ...report.body.flatMap((c) => [
        c.title,
        ...c.blocks.flatMap((b) =>
          b.type === 'paragraph'
            ? [contentToText(b.content, num)]
            : b.type === 'subheading'
              ? [b.title]
              : b.type === 'figureRow'
                ? b.figures.map((f) => f.caption)
                : b.type === 'table'
                  ? [b.caption, ...b.rows.flatMap((r) => r.cells.map((x) => x.text))]
                  : [],
        ),
      ]),
    ].join(''),
  )
  const head = openingHead(report, config)
  return report.abstract.paragraphs.flatMap((p) => {
    const text = contentToText(p.content, num)
    return sentencesOf(text).flatMap((s): AbstractSentence[] => {
      const plain = comparable(s.text)
      if (plain.length < MIN_CHARS || (head.length >= 3 && plain.startsWith(head))) return []
      const grams = bigrams(s.text)
      const overlap = coverage(grams, sets)
      if (overlap >= ABSTRACT_SOURCE_LIMIT) return []
      const newWords = words(s.text).filter((w) => !bodyText.includes(comparable(w.replace(/[ぁ-ん]+$/, ''))))
      return [{ blockId: p.id, start: s.start, end: s.end, text: s.text, overlap, newWords }]
    })
  })
}
