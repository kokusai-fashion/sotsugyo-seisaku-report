import { describe, expect, it } from 'vitest'
import { currentConfig } from '../config'
import { demoReport } from '../model/demoReport'
import type { Report } from '../model/types'
import { abstractAwayFromBody, sentencesOf } from './abstractSource'
import { checkReportDetailed } from './reportChecks'

/** 抄録を、この文たちにする（1段落） */
const withAbstract = (r: Report, ...sentences: string[]): Report => ({ ...r, abstract: { ...r.abstract, started: true, paragraphs: [{ type: 'paragraph', id: 'a1', content: [{ type: 'text', text: sentences.join('') }] }] } })
const MADE_UP = '本制作では、ミラノで買い付けたシルクを使い、全体を手染めで仕上げた。'

describe('抄録の文が本文から抜き出したものか（mockups/v75 案A）', () => {
  it('文に分ける（終わりの印のない最後の文も）', () => {
    expect(sentencesOf('袖を広げた。帯を巻いた！ 最後の文')).toEqual([
      { start: 0, end: 6, text: '袖を広げた。' },
      { start: 6, end: 12, text: '帯を巻いた！' },
      { start: 13, end: 17, text: '最後の文' },
    ])
  })

  it('本文から抜き出した文・少し言い換えた文は知らせず、本文にない内容の文は、本文にない語を添えて知らせる。書き出しの「本制作報告書は」の文は比べない', () => {
    const r = withAbstract(
      demoReport(),
      '本制作報告書は、卒業イベント「シンドバッド」において、筆者が制作した衣装について報告するものである。',
      '袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。',
      '中東の伝統的な装いをもとに、さらに航海の力強さと冒険心を表すデザインを考えている。',
      MADE_UP,
    )
    const found = abstractAwayFromBody(r, currentConfig)
    expect(found.map((a) => a.text)).toEqual([MADE_UP])
    expect(found[0].newWords).toEqual(expect.arrayContaining(['ミラノ', '手染め']))
    expect(found[0].overlap).toBeLessThan(0.3)
    // 段落の中の位置（紙面の下線・押したときに移る所）
    const text = r.abstract.paragraphs[0].content.map((n) => (n.type === 'text' ? n.text : '')).join('')
    expect(text.slice(found[0].start, found[0].end)).toBe(MADE_UP)
  })

  it('右の欄の要確認になり、「このままにする」で確認済みにできる', () => {
    const r = withAbstract(demoReport(), '袖は風をはらむように大きく膨らませ、腰には幅の広い帯を巻いた。', MADE_UP)
    const f = checkReportDetailed(r, currentConfig).findings.find((x) => x.ruleId === 'abstract-source')
    expect(f).toMatchObject({ severity: 'warning', area: 'abstract', blockId: 'a1', title: '本文にない内容かもしれない文がある' })
    expect(f?.detail).toContain('本文にない語：')
    expect(f?.detail).toContain('抄録は、本文から抜き出して、言い方を少し整えて書きます')
    const acked = { ...r, acknowledged: [f!.key!] }
    expect(checkReportDetailed(acked, currentConfig).findings.some((x) => x.ruleId === 'abstract-source')).toBe(false)
  })

  it('本文をまだ書いていない・抄録を書き始める前は、比べない', () => {
    const empty = withAbstract({ ...demoReport(), body: demoReport().body.map((c) => ({ ...c, blocks: [] })) }, MADE_UP)
    expect(abstractAwayFromBody(empty, currentConfig)).toEqual([])
    const before = { ...withAbstract(demoReport(), MADE_UP), abstract: { ...withAbstract(demoReport(), MADE_UP).abstract, started: false } }
    expect(abstractAwayFromBody(before, currentConfig)).toEqual([])
  })
})

describe('3回目の試しの直し（2026-10-29）', () => {
  const body = demoReport()
  it('書き出しの形の文（本研究報告書は・本報告書は・本稿は）と、抄録のいちばん初めの文は比べない。「本制作では」は比べる', () => {
    const r = withAbstract(body, 'まったく本文にない書き出しの文である。', '本研究報告書は、卒業イベントの衣装制作について報告するものである。', '本報告書は、衣装の制作についてまとめたものである。', '本稿は、筆者の制作をまとめたものである。', MADE_UP)
    expect(abstractAwayFromBody(r, currentConfig).map((a) => a.text)).toEqual([MADE_UP])
  })
  it('ほかが本文と同じでも、本文にない数字・カタカナの語があれば知らせる', () => {
    const p4 = body.body.flatMap((c) => c.blocks).find((b) => b.id === 'p4')
    const base = p4?.type === 'paragraph' ? p4.content.map((n) => (n.type === 'text' ? n.text : '')).join('').split('。')[0] : ''
    const r = withAbstract(body, '書き出しの文である。', `${base}、頭には金のターバンを巻いた。`, '刺繍には片袖でおよそ999時間かかった。')
    const found = abstractAwayFromBody(r, currentConfig)
    expect(found.map((a) => a.newWords)).toEqual([expect.arrayContaining(['ターバン']), expect.arrayContaining(['999'])])
  })
  it('語の切れ方：「観客から」「依頼し」は「観客」「依頼」、「手染め」はそのまま', () => {
    const r = withAbstract(body, '書き出しの文である。', '観客から依頼し、手染めで仕上げたミラノの布を使った。')
    expect(abstractAwayFromBody(r, currentConfig)[0].newWords).toEqual(expect.arrayContaining(['観客', '依頼', '手染め', 'ミラノ']))
  })
})

describe('4回目の試しの直し（2026-10-30）', () => {
  it('素材表の行の数を言っただけの「三種類」は、本文にない語にしない', () => {
    const r = withAbstract(demoReport(), '書き出しの文である。', '使用した素材は、コットンサテンとシルクシフォンの二種類である。')
    expect(abstractAwayFromBody(r, currentConfig)).toEqual([])
  })
})
