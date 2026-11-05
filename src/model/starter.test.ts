import { describe, expect, it } from 'vitest'
import { currentConfig, type TemplateBlock } from '../config'
import { checkReportDetailed } from '../checker/reportChecks'
import { cleanTemplate } from '../admin/serverRules'
import { setContinuation, setPrefilled, setText } from '../editor/reportOps'
import { bodyContentHtml } from '../layout/bodyHtml'
import { templateFromReport, templateReport } from '../template/convert'
import { createReport } from './newReport'
import { contentKey, untouchedStarter } from './starter'
import { bodyFromTemplate } from './template'
import type { ParagraphBlock, Report } from './types'

// ひな形の「書き出しの文」と、その続きの説明（mockups/v111 案B。依頼者 2026-11-05）
const config = currentConfig
const course = config.courses[0]
const TEMPLATE: TemplateBlock[] = [
  { type: 'chapter', title: '企画・立案' },
  { type: 'subheading', title: 'デザイン説明' },
  { type: 'paragraph', hint: 'デザインのもとにした作品や時代を書く', text: 'この衣装のデザインは、' },
  { type: 'paragraph', hint: '工夫した点を書く' },
  { type: 'paragraph', hint: '', text: '使用した素材を表1にまとめる。' },
]
const paragraphs = (r: Pick<Report, 'body'>) => r.body.flatMap((c) => c.blocks).filter((b): b is ParagraphBlock => b.type === 'paragraph')
const studentReport = (): Report => ({ ...createReport(config, course.id), body: bodyFromTemplate(TEMPLATE) })
const html = (r: Pick<Report, 'body'>) => bodyContentHtml(r.body, { imageSrc: () => '', figureSize: () => ({ widthMm: 60, heightMm: 45 }) })

describe('書き出しの文と続きの説明', () => {
  it('学生の段落：書き出しの字と、続きの説明と、はじめの字の印が入る（説明だけ・書き出しだけの段落は今までどおり）', () => {
    const [starter, hintOnly, fixed] = paragraphs({ body: bodyFromTemplate(TEMPLATE) })
    expect(starter.content).toEqual([{ type: 'text', text: 'この衣装のデザインは、' }])
    expect(starter.hint).toBe('デザインのもとにした作品や時代を書く')
    expect(starter.starter).toBe(contentKey(starter.content))
    expect(untouchedStarter(starter)).toBe(true)
    expect(hintOnly).toMatchObject({ content: [{ type: 'text', text: '' }], hint: '工夫した点を書く' })
    expect(hintOnly.starter).toBeUndefined()
    expect(fixed.hint).toBeUndefined()
    expect(fixed.starter).toBeUndefined()
  })

  it('紙面：書き出しのままのあいだは、書き出しのあとに説明を（ ）で薄く出す。続きを書いたら出さない', () => {
    const r = studentReport()
    expect(html(r)).toContain('data-continue="（デザインのもとにした作品や時代を書く）">この衣装のデザインは、</p>')
    const id = paragraphs(r)[0].id
    const written = setText(r, id, 'この衣装のデザインは、中世の船乗りの服をもとにした。')
    const p = paragraphs(written)[0]
    expect(p.starter).toBe(paragraphs(r)[0].starter)
    expect(untouchedStarter(p)).toBe(false)
    expect(html(written)).not.toContain('data-continue')
    // 書き足した字を消して、書き出しだけに戻すと、また説明を出す
    expect(untouchedStarter(paragraphs(setText(written, id, 'この衣装のデザインは、'))[0])).toBe(true)
  })

  it('セルフチェック：書き出しのままの段落は「まだ書いていない段落」。書きかけの字への指摘（文末の「。」など）は出さない', () => {
    const r = studentReport()
    const id = paragraphs(r)[0].id
    const before = checkReportDetailed(r, config).findings.filter((f) => f.blockId === id)
    expect(before.map((f) => f.ruleId)).toEqual(['paragraph-empty'])
    expect(before[0]).toMatchObject({ title: 'まだ書いていない段落がある', detail: 'デザインのもとにした作品や時代を書く' })
    const written = setText(r, id, 'この衣装のデザインは、中世の船乗りの服をもとにした。')
    expect(checkReportDetailed(written, config).findings.filter((f) => f.blockId === id && f.ruleId === 'paragraph-empty')).toEqual([])
  })

  it('ひな形を作る画面：書き出しの文の段落は、続きの説明を持ったまま開き、戻すとひな形に戻る。「ここに書くこと」にすると説明は外れる', () => {
    const report = templateReport(config, course.id, TEMPLATE, '')
    const [starter] = paragraphs(report)
    expect(starter).toMatchObject({ prefilled: true, hint: 'デザインのもとにした作品や時代を書く' })
    expect(html(report)).toContain('data-prefilled="" data-continue="デザインのもとにした作品や時代を書く"')
    expect(templateFromReport(report).template.filter((b) => b.type === 'paragraph')).toEqual(TEMPLATE.filter((b) => b.type === 'paragraph'))
    // 続きの説明を変える・消す
    const changed = setContinuation(report, starter.id, '  時代の背景も書く ')
    expect(paragraphs(changed)[0].hint).toBe('時代の背景も書く')
    expect(paragraphs(setContinuation(changed, starter.id, ''))[0].hint).toBeUndefined()
    // 「ここに書くこと」の段落には付けない
    const hintOnly = paragraphs(report)[1]
    expect(setContinuation(report, hintOnly.id, '説明')).toBe(report)
    expect(paragraphs(setPrefilled(report, starter.id, false))[0].hint).toBeUndefined()
  })

  it('管理ページのサーバー：書き出しの文があっても、続きの説明を残す', () => {
    expect(cleanTemplate(TEMPLATE, '衣装')).toEqual(TEMPLATE)
  })
})
