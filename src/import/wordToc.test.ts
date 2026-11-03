import { describe, expect, it } from 'vitest'
import { chapterNotStarted } from '../editor/reportOps'
import type { BodyBlock, Chapter } from '../model/types'
import { mergeTocHeadings, outlineWithToc, stripTocLeader, TOC_HINT, tocOutline } from './wordToc'

let seq = 0
const newId = (prefix: string) => `${prefix}-${++seq}`
const para = (id: string, text: string, hint?: string): BodyBlock => ({ type: 'paragraph', id, content: [{ type: 'text', text }], ...(hint ? { hint } : {}) })
const sub = (id: string, title: string): BodyBlock => ({ type: 'subheading', id, title })
const subs = (...names: string[]) => names.map((title) => ({ title }))
const titles = (c: Chapter) => c.blocks.flatMap((b) => (b.type === 'subheading' ? [b.title] : []))

describe('目次の行を読む（03_目次.docx。依頼者 2026-11-03 の会議のあと）', () => {
  it('点線とページ番号を除く', () => {
    expect(stripTocLeader('Ⅰ．企画・立案・・・・・・・・1')).toBe('Ⅰ．企画・立案')
    expect(stripTocLeader('Ⅱ．制作過程……〇')).toBe('Ⅱ．制作過程')
    expect(stripTocLeader('Ⅲ．まとめ\t12')).toBe('Ⅲ．まとめ')
    expect(stripTocLeader('ⅰ．ブラウス')).toBe('ⅰ．ブラウス')
  })
  it('学科のひな形の形：章と中見出し。仮の名前（〇〇〇〇）は入れない', () => {
    const lines = ['目次', '', 'Ⅰ．企画・立案・・・・・1', 'ⅰ．担当衣装のキャラクター', 'ⅱ．デザイン説明', 'Ⅱ．制作過程・・・・〇', 'ⅰ．ブラウス', 'ⅱ．〇〇〇〇', 'Ⅲ．まとめ・・・・〇']
    expect(tocOutline(lines)).toEqual([
      { title: '企画・立案', subs: subs('担当衣装のキャラクター', 'デザイン説明') },
      { title: '制作過程', subs: subs('ブラウス') },
      { title: 'まとめ', subs: [] },
    ])
  })
})

describe('目次にだけある見出しを本文に入れる', () => {
  const body = (): Chapter[] => [
    { id: 'c1', title: '企画・立案', blocks: [sub('s1', '担当衣装のキャラクター'), para('p1', '主人公の衣装である。')] },
    // ひな形から続けた章（まだ書いていない）：仮の名前の中見出しが2つ
    { id: 'c2', title: '制作過程', blocks: [sub('s2', '〇〇〇〇'), para('p2', '', '作業について書く'), sub('s3', '〇〇〇〇'), para('p3', '', '作業について書く')] },
    { id: 'c3', title: 'まとめ', blocks: [para('p4', '', 'まとめを書く')] },
  ]

  it('本文にない中見出しは、目次で前にある中見出しのまとまりの後ろに、空の段落（薄い字つき）と入れる', () => {
    const { body: out, added } = mergeTocHeadings(body(), [{ title: '企画・立案', subs: subs('担当衣装のキャラクター', 'デザイン説明') }], newId, chapterNotStarted)
    expect(titles(out[0])).toEqual(['担当衣装のキャラクター', 'デザイン説明'])
    const blocks = out[0].blocks
    expect(blocks.map((b) => b.type)).toEqual(['subheading', 'paragraph', 'subheading', 'paragraph'])
    expect(blocks[3].type === 'paragraph' && blocks[3].hint).toBe(TOC_HINT)
    expect(added).toEqual(['デザイン説明'])
  })

  it('仮の名前（〇〇〇〇）の中見出しがあれば、その名前にする。足りなければ足す', () => {
    const { body: out, added } = mergeTocHeadings(body(), [{ title: '制作過程', subs: subs('ブラウス', 'サルエルパンツ', 'ターバン') }], newId, chapterNotStarted)
    expect(titles(out[1])).toEqual(['ブラウス', 'サルエルパンツ', 'ターバン'])
    // ひな形の段落（説明つき）は残る
    expect(out[1].blocks.filter((b) => b.type === 'paragraph').length).toBe(3)
    expect(added).toEqual(['ブラウス', 'サルエルパンツ', 'ターバン'])
  })

  it('同じ名前の見出しがすでにあれば、何もしない（同じ原稿を返す形）', () => {
    const { body: out, added } = mergeTocHeadings(body(), [{ title: '企画・立案', subs: subs('担当衣装のキャラクター') }, { title: 'まとめ', subs: [] }], newId, chapterNotStarted)
    expect(added).toEqual([])
    expect(out.map((c) => c.blocks.length)).toEqual(body().map((c) => c.blocks.length))
  })

  it('名前の違う章は、同じ番目がまだ書いていない章なら、その名前にする。なければ、前の章の後ろに新しい章として入れる', () => {
    const renamed = mergeTocHeadings(body(), [{ title: '企画・立案', subs: [] }, { title: '衣装の制作', subs: subs('ブラウス') }], newId, chapterNotStarted)
    expect(renamed.body.map((c) => c.title)).toEqual(['企画・立案', '衣装の制作', 'まとめ'])
    expect(titles(renamed.body[1])).toEqual(['ブラウス', '〇〇〇〇'])
    // 2番目の章が書いてあるときは、新しい章（中は中見出しと空の段落）
    const written = body()
    written[1] = { id: 'c2', title: '制作過程', blocks: [para('p2', 'パターンを引いた。')] }
    const inserted = mergeTocHeadings(written, [{ title: '企画・立案', subs: [] }, { title: '試作', subs: subs('シーチング') }, { title: '制作過程', subs: [] }], newId, chapterNotStarted)
    expect(inserted.body.map((c) => c.title)).toEqual(['企画・立案', '試作', '制作過程', 'まとめ'])
    expect(inserted.body[1].blocks.map((b) => b.type)).toEqual(['subheading', 'paragraph'])
    expect(inserted.added).toEqual(['試作', 'シーチング'])
  })

  it('確認の窓の一覧：もとの行はそのまま、目次から入れた見出しに印', () => {
    const old = [
      { level: 1 as const, title: '企画・立案', paragraphs: 1, figures: [], tables: [] },
      { level: 2 as const, title: '担当衣装のキャラクター', paragraphs: 1, figures: ['図1'], tables: [] },
      { level: 1 as const, title: '制作過程', paragraphs: 0, figures: [], tables: [], fromTemplate: true },
      { level: 1 as const, title: 'まとめ', paragraphs: 0, figures: [], tables: [], fromTemplate: true },
    ]
    const { body: out, added } = mergeTocHeadings(body(), [{ title: '企画・立案', subs: subs('担当衣装のキャラクター', 'デザイン説明') }, { title: '制作過程', subs: subs('ブラウス') }], newId, chapterNotStarted)
    const items = outlineWithToc(old, out, added)
    expect(items.map((i) => `${i.level}:${i.title}${i.fromToc ? '*' : ''}`)).toEqual(['1:企画・立案', '2:担当衣装のキャラクター', '2:デザイン説明*', '1:制作過程', '2:ブラウス*', '1:まとめ'])
    expect(items[1].figures).toEqual(['図1'])
  })
})

describe('目次の小見出し（（1）。見出しを大・中・小の3つにした 2026-11-03）', () => {
  it('「（1）」の行は、その前の中見出しの下の小見出しとして読む', () => {
    const lines = ['Ⅱ．制作過程・・・・3', 'ⅰ．ブラウス', '（1）パターン', '(2) 縫製', 'ⅱ．ターバン']
    expect(tocOutline(lines)).toEqual([{ title: '制作過程', subs: [{ title: 'ブラウス' }, { title: 'パターン', minor: true }, { title: '縫製', minor: true }, { title: 'ターバン' }] }])
  })

  it('本文にない小見出しは、前の見出しのすぐ後ろに入れる。中見出しは、前の中見出しの下の小見出しの後ろに入れる', () => {
    const start: Chapter[] = [{ id: 'c1', title: '制作過程', blocks: [sub('s1', 'ブラウス'), para('p1', 'ブラウスを作った。'), { type: 'subheading', id: 's2', title: '縫製', level: 3 }, para('p2', '縫った。')] }]
    const toc = [{ title: '制作過程', subs: [{ title: 'ブラウス' }, { title: 'パターン', minor: true }, { title: '縫製', minor: true }, { title: 'ターバン' }] }]
    const { body: out, added } = mergeTocHeadings(start, toc, newId, chapterNotStarted)
    const heads = out[0].blocks.flatMap((b) => (b.type === 'subheading' ? [`${b.level === 3 ? '小' : '中'}:${b.title}`] : []))
    expect(heads).toEqual(['中:ブラウス', '小:パターン', '小:縫製', '中:ターバン'])
    // ターバンは、縫製の段落の後ろ（章の終わり）
    expect(out[0].blocks.map((b) => b.id).slice(0, 6)).toEqual(['s1', 'p1', out[0].blocks[2].id, out[0].blocks[3].id, 's2', 'p2'])
    expect(added).toEqual(['パターン', 'ターバン'])
    const items = outlineWithToc([], out, added)
    expect(items.map((i) => `${i.level}:${i.title}`)).toEqual(['1:制作過程', '2:ブラウス', '3:パターン', '3:縫製', '2:ターバン'])
  })
})
