// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Chapter } from '../model/types'
import type { Placed } from './figureFloat'
import { decideFigureGrowth, readFigureGrow, sameGrow, type FigureGrow, type GrowLayout } from './figureGrow'

/**
 * 改ページ・章の終わりの直前の図を大きくするか（figureGrow.ts）を、組んだ紙面の代わりの位置（ページの番号と mm）で確かめる。
 * 本文：段落 p1（図1を指す）→ 図のまとまり g1 → 改ページ → 中見出し。本文の下端は 272mm、1行は約 6.5mm
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

  it('まだ写真を入れていない枠（ひな形の図の枠）は、下が空いていても大きくしない（依頼者の判断 2026-11-05）', () => {
    const empty: Chapter = { ...chapter('pageBreak'), blocks: chapter('pageBreak').blocks.map((b) => (b.type === 'figureRow' ? { ...b, figures: [{ id: 'f1', imageId: '', caption: 'デザイン画' }] } : b)) }
    expect(decideFigureGrowth(layout([at(0, 120, 177)], [[size(60, 45)]]), [empty], new Set(), {}, new Set(), new Set())).toEqual({})
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

describe('ページの下に少しだけ入りきらない図のまとまりは、85% まで小さくしてそのページに収める（依頼者の選択 2026-11-03）', () => {
  // 縦長の図4枚（2段。1枚 54×72mm、タイトル 5mm）
  const four = [[size(54, 72), size(54, 72)], [size(54, 72), size(54, 72)]]
  /** 段落 p1 の位置も持つ作り物の紙面 */
  const withAnchor = (places: Placed[], rows: { widthMm: number; heightMm: number }[][], anchor: Placed): GrowLayout => ({ ...layout(places, rows), block: (id) => (id === 'p1' ? [anchor] : []) })

  it('2段目が次のページへ分かれた：最初のページに収まる倍率にする（後ろが段落でも）', () => {
    // 1段目が 130〜207mm（3ページ）、2段目が 25〜102mm（4ページ）。収まる高さ 272 − 130 − 3.2 ≒ 138.8 → (138.8 − 10) / 144 ≒ 0.89
    expect(decide(layout([at(3, 130, 207), at(4, 25, 102)], four), 'paragraph')).toEqual({ g1: { scale: 0.89, page: 3 } })
  })

  it('85% より小さくしないと収まらないときは、小さくしない（今までどおり）', () => {
    expect(decide(layout([at(3, 170, 247), at(4, 25, 102)], four), 'paragraph')).toEqual({})
  })

  it('まとまりごと次のページへ回った：段落のページの下に収まる倍率にする', () => {
    // 段落の下端 190mm（3ページ）。図1枚（72mm＋タイトル 5mm）は 4ページの上。収まる高さ 272 − 190 − 6.5 − 0.5 = 75 → (75 − 5) / 72 ≒ 0.97
    expect(decide(withAnchor([at(4, 25, 102)], [[size(54, 72)]], at(3, 150, 190)), 'paragraph')).toEqual({ g1: { scale: 0.97, page: 3 } })
    // 段落の下端 200mm：(65 − 5) / 72 ≒ 0.83 で 85% より小さい → 小さくしない
    expect(decide(withAnchor([at(4, 25, 102)], [[size(54, 72)]], at(3, 160, 200)), 'paragraph')).toEqual({})
  })

  it('小さくしたまとまりが、決めたページに収まっていれば、そのまま', () => {
    const shrunk = [[size(48.1, 64.1), size(48.1, 64.1)], [size(48.1, 64.1), size(48.1, 64.1)]]
    expect(decide(layout([at(3, 130, 271)], shrunk), 'paragraph', { g1: { scale: 0.89, page: 3 } })).toEqual({ g1: { scale: 0.89, page: 3 } })
  })

  it('小さくしても、別のページへ移った・はみ出したら、いったん元の大きさに戻す（2回目は、もう小さくしない）', () => {
    const reset = new Set<string>()
    const blocked = new Set<string>()
    const moved = layout([at(4, 25, 166)], four)
    expect(decide(moved, 'paragraph', { g1: { scale: 0.89, page: 3 } }, new Set(), reset, blocked)).toEqual({})
    expect(reset.has('g1') && !blocked.has('g1')).toBe(true)
    decide(moved, 'paragraph', { g1: { scale: 0.89, page: 3 } }, new Set(), reset, blocked)
    expect(blocked.has('g1')).toBe(true)
  })

  it('この端末に覚えた組み方の、小さくした倍率も読む（85% より小さいものは読まない）', () => {
    expect(readFigureGrow({ g1: { scale: 0.9, page: 2 }, g2: { scale: 0.5, page: 1 } })).toEqual({ g1: { scale: 0.9, page: 2 } })
  })
})
