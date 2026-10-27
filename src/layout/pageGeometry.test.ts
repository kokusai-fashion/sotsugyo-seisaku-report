import { describe, expect, it } from 'vitest'
import { currentConfig, type YearConfig } from '../config'
import { marginsProblem, repairConfig, validateConfig } from '../config/validate'
import { listChanges, sameConfig } from '../admin/changes'
import { abstractLineCapacity, documentCss } from './documentCss'
import { DEFAULT_MARGINS, marginsOf, textHeightMm, textLeftPx, textWidthMm } from './pageGeometry'
import { letterSpacingPt, linePitchPt, reportCss } from './reportCss'

// ページの余白を管理ページで決める（依頼者の判断 2026-10-27：mockups/v69 案1・案A。左右は同じ・38字×38行のまま）
describe('ページの余白', () => {
  it('はじめは 上下25mm・左右30mm。1行の長さ 150mm・字間・行送りは、前（左35mm・右25mm）と同じ', () => {
    expect(marginsOf(currentConfig)).toEqual({ top: 25, bottom: 25, side: 30 })
    expect(textWidthMm(DEFAULT_MARGINS)).toBe(150)
    expect(textHeightMm(DEFAULT_MARGINS)).toBe(247)
    expect(letterSpacingPt(DEFAULT_MARGINS)).toBe(0.189)
    expect(linePitchPt(DEFAULT_MARGINS)).toBe(18.4)
    expect(textLeftPx(DEFAULT_MARGINS)).toBeCloseTo(113.4, 1)
    expect(reportCss(DEFAULT_MARGINS)).toContain('margin: 25mm 30mm 25mm;')
  })

  it('余白を変えても38字×38行のまま（左右を狭くすると字の間が、上下を狭くすると行の間が広がる）', () => {
    const m = { top: 20, bottom: 20, side: 25 }
    expect(textWidthMm(m)).toBe(160)
    expect(letterSpacingPt(m) * 38 + 11 * 38).toBeLessThanOrEqual((160 * 72) / 25.4)
    expect(letterSpacingPt(m)).toBeGreaterThan(0.9)
    expect(linePitchPt(m) * 38).toBeCloseTo((18.4 * 257) / 247 * 38, 1)
    const css = documentCss(m)
    expect(css).toContain('margin: 20mm 25mm 20mm;')
    expect(css).toContain('.abstract .head .row { left: 0; width: 160mm;')
  })

  it('ない・範囲の外の値は、はじめの値で組む', () => {
    expect(marginsOf({ margins: { top: 20, bottom: 99, side: 40 } })).toEqual({ top: 20, bottom: 25, side: 30 })
    expect(marginsOf(null)).toEqual(DEFAULT_MARGINS)
  })

  it('管理ページの確かめ：左右は30mmまで（38字が1行に入る幅）。上下が大きく抄録の最多の行数が入らなければ、エラー', () => {
    expect(marginsProblem(undefined)).toBeNull()
    expect(marginsProblem({ top: 25, bottom: 25, side: 30 }, 23)).toBeNull()
    expect(marginsProblem({ top: 25, bottom: 25, side: 35 }, 23)).toBe('ページの余白（左右）は20〜30mmにしてください（30mmまでなら、1行に38字が入ります）')
    expect(marginsProblem({ top: 25, bottom: 25, side: '30' }, 23)).toContain('左右')
    expect(abstractLineCapacity({ top: 30, bottom: 30, side: 30 })).toBeLessThan(23)
    expect(marginsProblem({ top: 30, bottom: 30, side: 30 }, 23)).toBe('上下の余白が大きく、抄録の23行が1ページに入りません。上下の余白を小さくしてください')
    const bad = { ...currentConfig, margins: { top: 25, bottom: 25, side: 35 } } as YearConfig
    expect(validateConfig(bad).filter((p) => p.field === 'margins').map((p) => p.severity)).toEqual(['error'])
    // 学生のツールは、崩れた余白を外して（はじめの値で）組む。設定全体は捨てない
    expect(repairConfig(bad).margins).toBeUndefined()
    expect(validateConfig(repairConfig(bad)).filter((p) => p.severity === 'error')).toEqual([])
  })

  it('変更の一覧：はじめの値と同じなら変更ではない。変えたら「ページの余白」と前後の値', () => {
    const same = { ...currentConfig, margins: { ...DEFAULT_MARGINS } }
    expect(sameConfig(currentConfig, same)).toBe(true)
    const changed = listChanges(currentConfig, { ...currentConfig, margins: { top: 20, bottom: 25, side: 30 } })
    expect(changed).toEqual([expect.objectContaining({ label: 'ページの余白', section: 'details', before: '上25・下25・左右30mm', after: '上20・下25・左右30mm', target: 'd-marginTop' })])
  })
})
