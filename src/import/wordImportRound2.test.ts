import { DOMParser } from '@xmldom/xmldom'
import { describe, expect, it } from 'vitest'
import { makeDocx, p, run, table } from '../../scripts/e2e/fixtures/docx.mjs'
import { currentConfig } from '../config'
import { createReport } from '../model/newReport'
import type { ParagraphBlock, TableBlock } from '../model/types'
import type { WordImportResult } from './types'
import { applyWordImport, documentNotes, keepWrittenChapters, lostByImport, readWordFiles, wordPrints } from './wordImport'

// 学生の試し 2回目（2026-10-29。Word で途中まで書いた学生）で見つかったことの直し
;(globalThis as { DOMParser?: unknown }).DOMParser = DOMParser

const COURSE = 'film-stage-costume'
const context = { config: currentConfig, courseId: COURSE }
const file = (bytes: Uint8Array, name = '04_本文.docx') => new File([bytes.slice()], name)
const read = (body: Uint8Array, cover?: Uint8Array): Promise<WordImportResult> =>
  readWordFiles({ body: file(body), ...(cover ? { cover: file(cover, '01_表紙.docx') } : {}) }, context)
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const xml = (body: string) => new DOMParser().parseFromString(`<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`, 'text/xml') as unknown as Document
const messages = (r: WordImportResult) => r.problems.map((x) => x.message)

describe('写さない・形を変えて写すものを知らせる（documentNotes）', () => {
  it('変更履歴・コメント・ふりがな・上付き・表の中の表', () => {
    const body = [
      p(`<w:ins w:id="1" w:author="a" w:date="2026-01-01T00:00:00Z">${run('足した文。')}</w:ins>`),
      p('本文。', '<w:r><w:commentReference w:id="0"/></w:r>'),
      p('<w:r><w:ruby><w:rubyPr/><w:rt><w:r><w:t>ぬの</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>布</w:t></w:r></w:rubyBase></w:ruby></w:r>'),
      p('10m', '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>'),
      `<w:tbl><w:tr><w:tc><w:tbl><w:tr><w:tc>${p('中')}</w:tc></w:tr></w:tbl>${p('')}</w:tc></w:tr></w:tbl>`,
    ].join('')
    expect(documentNotes(xml(body)).map((n) => n.message)).toEqual([
      '変更履歴が残っていました',
      'コメント（1件）は写していません',
      'ふりがな（ルビ）は写していません',
      '上付き・下付きの字（m² など）は、ふつうの字で写しました',
      '表の中の表は、表の形のままでは写せません',
    ])
  })

  it('ないときは何も言わない', () => {
    expect(documentNotes(xml(p('ふつうの段落。')))).toEqual([])
  })

  it('読み込んだときの知らせ（確かめる窓・「つぎにすること」）に入る', async () => {
    const r = await read(makeDocx({ body: [p('Ⅰ．企画・立案'), p('　本文の段落である。', '<w:r><w:commentReference w:id="0"/></w:r>')].join('') }))
    expect(messages(r)).toContain('コメント（1件）は写していません')
  })
})

describe('表のタイトルと表の間に段落がある', () => {
  it('前のタイトルを表のタイトルにする（「表が見つかりませんでした」と言わない）', async () => {
    const r = await read(
      makeDocx({
        body: [p('Ⅰ．企画・立案'), p('表1　使用素材表'), p('　素材は次のとおりである。'), table([['素材', '用途'], ['綿', '身頃']])].join(''),
      }),
    )
    const t = r.body.flatMap((c) => c.blocks).find((b): b is TableBlock => b.type === 'table')
    expect(t?.caption).toBe('使用素材表')
    expect(messages(r).some((m) => m.includes('表が見つかりませんでした'))).toBe(false)
  })
})

describe('氏名の読み仮名', () => {
  it('表紙に入れず、知らせる', async () => {
    const cover = makeDocx({ body: [p('学籍番号　24BF0123'), p('氏名　文化　花子（ぶんか　はなこ）')].join('') })
    const r = await read(makeDocx({ body: [p('Ⅰ．企画・立案'), p('　本文の段落である。')].join('') }), cover)
    expect(r.cover.name).toBe('文化　花子')
    expect(messages(r)).toContain('氏名の読み仮名は、表紙に入れません')
  })
})

describe('読み込み直したとき、ツールで書いた章を残す（keepWrittenChapters）・消える数（lostByImport）', () => {
  const firstWord = () => makeDocx({ body: [p('Ⅰ．企画・立案'), p('　Word で書いた最初の段落である。')].join('') })

  it('Word でまだ書いていない章に、ツールで書いた同じ名前の章があれば、そのまま残す', async () => {
    const r1 = await read(firstWord())
    const tplIndex = r1.outline.filter((o) => o.level === 1).findIndex((o) => o.fromTemplate)
    expect(tplIndex).toBeGreaterThan(0)
    // 1回目を読み込み、2つ目の章をツールで書いた
    const imported = applyWordImport(createReport(currentConfig, COURSE), r1)
    const chapter = imported.body[tplIndex]
    const written: ParagraphBlock = { type: 'paragraph', id: 'tool-p', content: [{ type: 'text', text: 'ツールで書いた段落である。' }] }
    const report = { ...imported, body: imported.body.map((c, i) => (i === tplIndex ? { ...c, blocks: [written, ...c.blocks] } : c)) }
    // 同じ Word をもう一度読み込む
    const r2 = keepWrittenChapters(report, await read(firstWord()))
    expect(r2.outline.filter((o) => o.level === 1)[tplIndex]).toMatchObject({ fromTemplate: true, keptFromTool: true })
    expect(r2.body[tplIndex].id).toBe(chapter.id)
    expect(lostByImport(report, r2.body)).toEqual([])
    // 残した章は、次に読み込むときの「Word から読み込んだもの」に入れない
    expect(wordPrints(r2).some((x) => x.includes('ツールで書いた段落'))).toBe(false)
  })

  it('前に Word から読み込んだ段落（Word で書き直したもの）は、ツールで書いた分に数えない', async () => {
    const r1 = await read(firstWord())
    const report = applyWordImport(createReport(currentConfig, COURSE), r1)
    const r2 = await read(makeDocx({ body: [p('Ⅰ．企画・立案'), p('　Word で書き直した段落である。')].join('') }))
    expect(lostByImport(report, r2.body).map((l) => l.paragraphs)).toEqual([1])
    expect(lostByImport(report, r2.body, new Set(wordPrints(r1)))).toEqual([])
  })
})

describe('3回目の試しの直し（2026-10-29）', () => {
  it('表のタイトルと表のあいだに小見出しがあっても、前のタイトルを表のタイトルにする', async () => {
    const r = await read(
      makeDocx({
        body: [p('Ⅰ．企画・立案'), p('ⅰ．使用素材'), p('表1　使用素材表'), p('ⅱ．配色'), p('　配色は次のとおりである。'), table([['素材', '用途'], ['綿', '身頃']])].join(''),
      }),
    )
    const t = r.body.flatMap((c) => c.blocks).find((b): b is TableBlock => b.type === 'table')
    expect(t?.caption).toBe('使用素材表')
    expect(messages(r).some((m) => m.includes('表が見つかりませんでした'))).toBe(false)
  })
  it('表の中の表の知らせに、場所（外の表の前の「表n」の行・なければ外の表の初めの字）を付ける', () => {
    const inner = `<w:tbl><w:tr><w:tc>${p('中')}</w:tc></w:tr></w:tbl>${p('')}`
    const outer = `<w:tbl><w:tr><w:tc>${p('工程')}</w:tc><w:tc>${inner}</w:tc></w:tr></w:tbl>`
    expect(documentNotes(xml([p('表2　制作工程表'), outer].join('')))[0]).toMatchObject({ message: '表の中の表は、表の形のままでは写せません', where: '表2　制作工程表' })
    expect(documentNotes(xml([p('本文。'), outer].join('')))[0].where).toBe('「工程中」で始まる表')
  })
  it('参考文献の知らせは、使い方の「引用・参考文献」から入れるように書く', async () => {
    const r = await read(makeDocx({ body: [p('Ⅰ．企画・立案'), p('　本文の段落である。'), p('参考文献'), p('1) 文化花子『衣装の本』2020年')].join('') }))
    expect(r.problems.find((x) => x.message.startsWith('参考文献'))?.detail).toContain('「使い方」の「引用・参考文献」')
  })
})
