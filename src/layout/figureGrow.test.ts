// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Chapter } from '../model/types'
import type { Placed } from './figureFloat'
import { decideFigureGrowth, readFigureGrow, sameGrow, type FigureGrow, type GrowLayout } from './figureGrow'

/**
 * 改ページ・章の終わりの直前の図を大きくするか（figureGrow.ts）を、組んだ紙面の代わりの位置（ページの番号と mm）で確かめる。
 * 本文：段落 p1（図1を指す）→ 図のまとまり g1 → 改ページ → 小見出し。本文の下端は 272mm、1行は約 6.5mm
 */
const chapter = (after: 'pageBreak' | 'paragraph' | 'none'): Chapter => ({
  id: 'c1',
  title: '企画・立案',
  blocks: [
    { type: 'paragraph', id: 'p1', content: [{ type: 'text', text: 'デザインを考えた' }] },
    { type: 'figureRow', id: 'g1', figures: [{ id: 'f1', imageId: 'i1', caption: 'デザイン画' }] },
    ...(after === 'pageBreak' ? [{ type: 'pageBreak' as const, id: 'pb1' }, { type: 'subheading' as const, id: 's1', title: '使用素材' }] : []),
    ...(after === 'paragraph' ? [{ type: 'paragraph' as const, id: 'p2', content: [{ type: 'text' as const, text: '続き' }] }] : []),
  ],
})

const at = (page: number, top: number, bottom: number): Placed => ({ page, top, bottom })
const size = (widthMm: number, heightMm: number) => ({ widthMm, heightMm })

/** 作り物の紙面：図のまとまり g1 の位置と、段ごとの図の大きさ */
function layout(places: Placed[], rows: { widthMm: number; heightMm: number }[][]): GrowLayout {
  return { group: (id) => (id === 'g1' ? places : []), rows: (id) => (id === 'g1' ? rows : []) }
}

const decide = (l: GrowLayout, after: 'pageBreak' | 'paragraph' | 'none' = 'pageBreak', grow: FigureGrow = {}, deferred = new Set<string>(), reset = new Set<string>(), blocked = new Set<string>()) =>
  decideFigureGrowth(l, [chapter(after)], deferred, grow, reset, blocked)

describe('改ページ・章の終わりの直前の図を、下の空きに合わせて大きくする', () => {
  it('縦長の図1枚（6×8cm）：下が大きく空いていれば、縦12cm（1.5倍）まで大きくする', () => {
    // 図と図のタイトルが 120〜212mm。下に約 54mm の空き
    expect(decide(layout([at(0, 120, 212)], [[size(60, 80)]]))).toEqual({ g1: { scale: 1.5, page: 0 } })
  })

  it('空きが少なければ、空いた分だけ（1行分は残す）', () => {
    // 図の下端 250mm：空きは 272 − 6.5 − 250 ≒ 15.5mm → (80 + 15.5) / 80 ≒ 1.19
    expect(decide(layout([at(0, 158, 250)], [[size(60, 80)]]))).toEqual({ g1: { scale: 1.19, page: 0 } })
  })

  it('横長の図1枚（8×6cm）は、横が本文の幅（15cm）いっぱいになるまで（1.5倍で止めない）', () => {
    // 下に十分な空き：横 150 / 80 = 1.875、縦 120 / 60 = 2 → 1.87
    expect(decide(layout([at(0, 100, 172)], [[size(80, 60)]]))).toEqual({ g1: { scale: 1.87, page: 0 } })
  })

  it('縦長の図が2枚：2枚で本文の幅いっぱいになるまで（同じ倍率で）', () => {
    // 5.4×7.2cm が2枚（間 8mm）：(150 − 8) / 108 ≒ 1.31
    expect(decide(layout([at(0, 100, 184)], [[size(54, 72), size(54, 72)]]))).toEqual({ g1: { scale: 1.31, page: 0 } })
  })

  it('横長の図が2枚：もう本文の幅いっぱいなので、大きくしない', () => {
    expect(decide(layout([at(0, 100, 165)], [[size(71, 53.3), size(71, 53.3)]]))).toEqual({})
  })

  it('図のすぐ後ろが段落なら大きくしない（文章が流れ込んで埋まる）。章の終わりなら大きくする', () => {
    const l = layout([at(0, 120, 212)], [[size(60, 80)]])
    expect(decide(l, 'paragraph')).toEqual({})
    expect(decide(l, 'none')).toEqual({ g1: { scale: 1.5, page: 0 } })
  })

  it('次のページの上へ送った図・ページをまたぐまとまりは大きくしない', () => {
    expect(decide(layout([at(0, 120, 212)], [[size(60, 80)]]), 'pageBreak', {}, new Set(['g1']))).toEqual({})
    expect(decide(layout([at(0, 200, 272), at(1, 25, 40)], [[size(60, 80)]]))).toEqual({})
  })

  it('大きくして組んだ紙面で測り直しても、同じ倍率のまま（落ち着く）', () => {
    // 1.5倍（9×12cm）で組んだ：図の下端 252mm
    const grow = { g1: { scale: 1.5, page: 0 } }
    const next = decide(layout([at(0, 120, 252)], [[size(90, 120)]]), 'pageBreak', grow)
    expect(sameGrow(next, grow)).toBe(true)
  })

  it('上に文を書き足して空きが減ったら、空いた分まで小さくする（元の大きさより小さくはしない）', () => {
    // 1.5倍のまま、図の下端が 270mm に下がった：空きは −4.5mm → 1.5 × (120 − 4.5) / 120 ≒ 1.44
    expect(decide(layout([at(0, 150, 270)], [[size(90, 120)]]), 'pageBreak', { g1: { scale: 1.5, page: 0 } })).toEqual({ g1: { scale: 1.44, page: 0 } })
    // 空きがほとんどない：大きくしない
    expect(decide(layout([at(0, 170, 264)], [[size(60, 80)]]))).toEqual({})
  })

  it('大きくしたまま次のページへ移った：いったん元の大きさに戻して決め直す。また移れば、もう大きくしない', () => {
    const reset = new Set<string>()
    const blocked = new Set<string>()
    const moved = layout([at(1, 25, 157)], [[size(90, 120)]])
    expect(decide(moved, 'pageBreak', { g1: { scale: 1.5, page: 0 } }, new Set(), reset, blocked)).toEqual({})
    expect(reset.has('g1')).toBe(true)
    expect(decide(moved, 'pageBreak', { g1: { scale: 1.3, page: 0 } }, new Set(), reset, blocked)).toEqual({})
    expect(blocked.has('g1')).toBe(true)
    // もう大きくしない（元の大きさで、下が空いていても）
    expect(decide(layout([at(0, 120, 212)], [[size(60, 80)]]), 'pageBreak', {}, new Set(), reset, blocked)).toEqual({})
  })
})

describe('覚えた組み方の倍率を読む', () => {
  it('形が合うものだけ読む', () => {
    expect(readFigureGrow({ g1: { scale: 1.5, page: 2 }, g2: { scale: 'x', page: 1 }, g3: { scale: 0.8, page: 1 } })).toEqual({ g1: { scale: 1.5, page: 2 } })
    expect(readFigureGrow(undefined)).toEqual({})
  })
})
