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
/**
 * 重なりがこれより少なく、本文にない数字・カタカナの語がある文も知らせる（本文の文に「頭には金のターバンを巻いた」を足した文・
 * 「20時間」を「40時間」にした文は、ほかの字が本文と重なって見逃していた：学生の試し 3回目 2026-10-29）
 */
const NEW_WORD_LIMIT = 0.85
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

/**
 * 語のかたまり：漢字2字以上（すぐ後ろが「染め」「仕上げ」の「め」「げ」などの送り仮名なら、その1字も）・カタカナ2字以上。
 * 前は助詞の前まで送り仮名を付けていたので、「観客から」「依頼し」と切れていた（学生の試し 3回目 2026-10-29）
 */
const words = (text: string) => [...new Set(text.match(/[一-鿿々]{2,}[めげけれえきみりびち]?|[ァ-ヴー]{2,}/g) ?? [])]
/**
 * 漢数字と数え方で始まる語（「三種類」「二着」「五日間」「三着作」）：本文にない語に数えない（素材表の行の数を言っただけの文に印が付いた：学生の試し 4回目 2026-10-30）
 */
const COUNT_WORD = /^[一二三四五六七八九十百千両数]+(種類|種|点|枚|着|色|回|個|本|人|名|件|段階|工程|週間|日間|時間|か月|ヶ月|年間|割)/
/** 数字（半角にそろえる） */
const numbers = (text: string) => [...new Set((text.match(/[0-9０-９]+/g) ?? []).map((n) => n.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))))]

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

/**
 * 書き出しの形の文（「本研究報告書は、」「本報告書は、」「本制作報告書では、」「本稿は、」「この報告書は、」「本研究は、」など。「本制作では、」は本文にもある書き方なので比べる）。
 * 今年の学科の Word のひな形の書き出しは「本研究報告書は」なので、印が付いていた（学生の試し 3回目 2026-10-29）
 */
const OPENING = /^(本|この)(制作|研究)?(報告書|報告|稿)(で)?(は|では|において|について)|^本研究(は|では)/

/** 本文から抜き出していないらしい抄録の文（重なりが ABSTRACT_SOURCE_LIMIT より少ない文）。本文をまだ書いていなければ、ない */
export function abstractAwayFromBody(report: Report, config: YearConfig): AbstractSentence[] {
  if (report.abstract.started === false) return []
  const num = numbering(report)
  const blocks = report.body.flatMap((c) => c.blocks)
  const bodySentences = blocks.flatMap((b) => (b.type === 'paragraph' ? sentencesOf(contentToText(b.content, num)).map((s) => s.text) : [])).filter((s) => comparable(s).length >= MIN_CHARS)
  if (bodySentences.length < MIN_BODY_SENTENCES) return []
  // 比べる相手には、表（行ごと・タイトル）と図のタイトルも入れる（素材表をまとめた文に印が付いていた：学生の試し 3回目 2026-10-29）
  // 表まるごと（タイトルとすべての行）も1つの相手にする（いくつもの行をまとめた文「素材は、コットンサテンとシルクシフォンの二種類」：学生の試し 4回目 2026-10-30）
  const tableLines = blocks.flatMap((b) => {
    if (b.type === 'figureRow') return b.figures.map((f) => f.caption)
    if (b.type !== 'table') return []
    const rows = b.rows.map((r) => r.cells.map((c) => c.text).join('、'))
    return [b.caption, ...rows, [b.caption, ...rows].join('、')]
  })
  const sets = [...bodySentences, ...tableLines.filter((t) => comparable(t).length >= 4)].map((x) => new Set(bigrams(x)))
  // 本文のどこかにある語か（見出し・図表のタイトル・表の中身・サブタイトルも）
  // 表紙の題目・サブタイトルも（「卒業イベント」が本文にない語に出ていた）
  const bodyText = comparable(
    [
      config.commonTitle,
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
  const bodyNumbers = new Set(numbers(bodyText))
  return report.abstract.paragraphs.flatMap((p, pi) => {
    const text = contentToText(p.content, num)
    return sentencesOf(text).flatMap((s, si): AbstractSentence[] => {
      const plain = comparable(s.text)
      // 抄録のいちばん初めの文と、書き出しの形の文は比べない
      if (plain.length < MIN_CHARS || (pi === 0 && si === 0) || OPENING.test(plain) || (head.length >= 3 && plain.startsWith(head))) return []
      const grams = bigrams(s.text)
      const overlap = coverage(grams, sets)
      // 本文にない数字は、ほかが本文と同じでも知らせる（「20時間」を「40時間」にした文）
      const newNumbers = numbers(s.text).filter((n) => !bodyNumbers.has(n))
      if (overlap >= NEW_WORD_LIMIT && newNumbers.length === 0) return []
      const newWords = words(s.text).filter((w) => !COUNT_WORD.test(w) && !bodyText.includes(comparable(w.replace(/[ぁ-ん]+$/, ''))))
      // 重なりが少ない、または、本文にない数字・カタカナの語がある
      const strong = newNumbers.length > 0 || newWords.some((w) => /^[ァ-ヴー]+$/.test(w))
      if (overlap >= ABSTRACT_SOURCE_LIMIT && !strong) return []
      return [{ blockId: p.id, start: s.start, end: s.end, text: s.text, overlap, newWords: [...newNumbers, ...newWords] }]
    })
  })
}
