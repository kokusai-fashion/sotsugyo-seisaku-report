import { headingFromText, minorFromText } from '../model/headingText'
import type { BodyBlock, Chapter, ParagraphBlock, SubheadingBlock } from '../model/types'
import type { OutlineItem } from './types'

/**
 * 目次にだけ書いた見出し（依頼者 2026-11-03 の会議のあと）：Word の目次（03_目次.docx、または本文の前の目次の行）に、本文ではまだ書いていない
 * 大見出し・中見出しを書いている学生がいる。読み込むときに、その見出しも本文に入れる（本文の見出しから目次を作る、の逆）。
 * 小見出し（「（1）素材」の形の行。見出しを大・中・小の3つにした 2026-11-03）も入れる
 */

/** 目次の中見出し・小見出し（minor：小見出し） */
export interface TocSub {
  title: string
  minor?: boolean
}

/** 目次の1章（番号を除いた名前と、その下の中見出し・小見出し） */
export interface TocChapter {
  title: string
  subs: TocSub[]
}

/** 「〇〇〇〇」「～～～」だけの名前（ひな形の仮の名前） */
const placeholder = (title: string) => /^[〇○◯～~〜\s　・.．]*$/.test(title)
/** 比べるための形（空白・全角半角の違いを除く） */
const comparable = (title: string) => title.normalize('NFKC').replace(/\s/g, '')

/** 目次の行の、後ろの点線とページ番号（「・・・・1」「……〇」「<タブ>3」）を除く */
export function stripTocLeader(line: string): string {
  return line
    .replace(/[\n]/g, '')
    .replace(/[・･…‥.．_＿]{2,}[\s　]*[0-9０-９〇○]{0,3}[\s　]*$/, '')
    .replace(/\t+[0-9０-９〇○]{0,3}[\s　]*$/, '')
    .trim()
}

/**
 * 目次の行から、章と中見出し・小見出しの並びを読む（「目次」の題・空の行・番号のない行は飛ばす。仮の名前の章・中見出しは入れない。
 * 仮の名前の章の下の中見出しも入れない）
 */
export function tocOutline(lines: string[]): TocChapter[] {
  const chapters: TocChapter[] = []
  let current: TocChapter | null = null
  for (const raw of lines) {
    const line = stripTocLeader(raw)
    const minor = minorFromText(line)
    if (minor) {
      if (current && !placeholder(minor)) current.subs.push({ title: minor, minor: true })
      continue
    }
    const h = headingFromText(line)
    if (!h || !h.title.trim()) continue
    if (h.level === 1) {
      current = placeholder(h.title) ? null : { title: h.title.trim(), subs: [] }
      if (current) chapters.push(current)
    } else if (current && !placeholder(h.title)) {
      current.subs.push({ title: h.title.trim() })
    }
  }
  return chapters
}

/** 目次から入れた見出しの下に置く、空の段落の薄い字 */
export const TOC_HINT = '目次に書いた見出しです。ここに内容を書きます。'

const emptyParagraph = (newId: (p: string) => string): ParagraphBlock => ({ type: 'paragraph', id: newId('p'), content: [{ type: 'text', text: '' }], hint: TOC_HINT })
const subheading = (sub: TocSub, newId: (p: string) => string): SubheadingBlock => ({ type: 'subheading', id: newId('s'), title: sub.title, ...(sub.minor ? { level: 3 as const } : {}) })

/**
 * 本文の章（Word から写した章と、ひな形から続けた章）に、目次にだけある見出しを入れる。
 * - 章：名前が同じ章に入れる。なければ、同じ番目の章がまだ何も書いていない章（ひな形のまま）なら、その章の名前を目次の名前にする。
 *   それもなければ、目次で前にある章のすぐ後ろに、新しい章として入れる（中は、中見出しと空の段落）
 * - 中見出し・小見出し：同じ名前があればそのまま。なければ、まだ使っていない仮の名前（〇〇〇〇）の中見出しの名前にする（中見出しだけ）。
 *   それもなければ、目次で前にある見出しの、まとまりの後ろ（前になければ、章の終わり）に、空の段落を付けて入れる
 * 入れた・名前を変えた見出しの名前を added に返す（確認の窓で知らせる）
 */
export function mergeTocHeadings(body: Chapter[], toc: TocChapter[], newId: (prefix: string) => string, notStarted: (c: Chapter) => boolean): { body: Chapter[]; added: string[] } {
  const out = body.map((c) => ({ ...c, blocks: [...c.blocks] }))
  const added: string[] = []
  const tocNames = new Set(toc.map((t) => comparable(t.title)))
  let previous = -1
  toc.forEach((t, ti) => {
    let at = out.findIndex((c) => comparable(c.title) === comparable(t.title))
    if (at < 0 && ti < out.length && notStarted(out[ti]) && !tocNames.has(comparable(out[ti].title)) && ti > previous) {
      at = ti
      added.push(t.title)
      out[at] = { ...out[at], title: t.title }
    }
    if (at < 0) {
      const blocks: BodyBlock[] = t.subs.length ? t.subs.flatMap((s): BodyBlock[] => [subheading(s, newId), emptyParagraph(newId)]) : [emptyParagraph(newId)]
      at = previous + 1
      out.splice(at, 0, { id: newId('c'), title: t.title, blocks })
      added.push(t.title, ...t.subs.map((s) => s.title))
      previous = at
      return
    }
    previous = at
    out[at] = { ...out[at], blocks: mergeSubs(out[at].blocks, t.subs, newId, added) }
  })
  return { body: out, added }
}

/**
 * 確認の窓の一覧（outline）に、目次から入れた見出しを足す（読み込んだあとの本文の並びで作り直す）。
 * もとの一覧にある行は、そのまま（数・印も）。ひな形から続ける章の中は、目次から入れた中見出しだけを出す（ひな形の中見出しは、もとから出していない）
 */
export function outlineWithToc(old: OutlineItem[], body: Chapter[], added: string[]): OutlineItem[] {
  const key = (level: 1 | 2 | 3, title: string) => `${level}|${comparable(title)}`
  const before = new Map(old.map((o) => [key(o.level, o.title), o]))
  const fromToc = new Set(added.map(comparable))
  const items: OutlineItem[] = []
  for (const chapter of body) {
    const head = before.get(key(1, chapter.title))
    const tocChapter = !head && fromToc.has(comparable(chapter.title))
    items.push(head && !fromToc.has(comparable(chapter.title)) ? head : { level: 1, title: chapter.title, paragraphs: 0, figures: [], tables: [], ...(head?.fromTemplate ? { fromTemplate: true } : {}), fromToc: true })
    const templateChapter = !!head?.fromTemplate
    for (const b of chapter.blocks) {
      if (b.type !== 'subheading') continue
      const level = b.level === 3 ? 3 : 2
      const sub = before.get(key(level, b.title))
      if (sub) items.push(sub)
      else if (fromToc.has(comparable(b.title))) items.push({ level, title: b.title, paragraphs: 0, figures: [], tables: [], fromToc: true })
      else if (!templateChapter && !tocChapter) items.push({ level, title: b.title, paragraphs: 0, figures: [], tables: [] })
    }
  }
  return items
}

function mergeSubs(blocks: BodyBlock[], subs: TocSub[], newId: (prefix: string) => string, added: string[]): BodyBlock[] {
  const out = [...blocks]
  /**
   * 見出し i のまとまりの終わり（次の見出しの前。なければ章の終わり）。中見出しを入れるときは、
   * 前の中見出しの下の小見出しも、そのまとまりに入れる（次の中見出しの前まで）
   */
  const sectionEnd = (i: number, minor: boolean) => {
    const next = out.findIndex((b, j) => j > i && b.type === 'subheading' && (minor || b.level !== 3))
    return next >= 0 ? next : out.length
  }
  let anchor = -1
  for (const sub of subs) {
    const name = sub.title
    const same = out.findIndex((b) => b.type === 'subheading' && comparable(b.title) === comparable(name))
    if (same >= 0) {
      anchor = same
      continue
    }
    // 後ろにある、仮の名前の中見出しを使う
    const spare = sub.minor ? -1 : out.findIndex((b, i) => i > anchor && b.type === 'subheading' && b.level !== 3 && placeholder(b.title))
    if (spare >= 0) {
      out[spare] = { ...(out[spare] as SubheadingBlock), title: name }
      added.push(name)
      anchor = spare
      continue
    }
    const at = anchor >= 0 ? sectionEnd(anchor, !!sub.minor) : out.length
    out.splice(at, 0, subheading(sub, newId), emptyParagraph(newId))
    added.push(name)
    anchor = at
  }
  return out
}
