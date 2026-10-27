import type { Chapter } from '../model/types'
import { measureFloatLayout, type Placed } from './figureFloat'
import { contentBottomMm, textWidthMm } from './pageGeometry'
import { linePitchPt } from './reportCss'

/**
 * 改ページ・章の終わりの直前の図を、下の空きに合わせて自動で大きくする（mockups/v61・v62 案B。依頼者の選択 2026-10-26）。
 *
 * ふつうのページの下の空きは、後ろの文章が流れ込んで埋まる。図のすぐ後ろが改ページか章の終わりだと、文章が流れ込めず、図の下に空きが残る
 * （昨年度までの Word では、図を大きくしてページの見え方のバランスをとっていた）。そこで、その図のまとまりだけ、空いた分だけ大きくする。
 * - まとまりの図は、すべて同じ倍率で大きくする（並んだ図の大きさのつり合いは変えない）
 * - 大きくできるのは、下の空き（1行分は残す）・横は本文の幅（15cm）まで・縦は12cmまでの、いちばん小さい所まで。小さくはしない
 * - 大きくするのは、そのページの空きの中だけ（後ろは改ページか章の終わりなので、ほかのページは変わらない）。
 *   文を書き足して空きが減れば、組み直すたびに計算し直して、元の大きさに近づく
 * 大きくしないもの：次のページの上へ送った図（figureFloat.ts）・ページをまたぐまとまり。
 * 前に大きくした図の上に文を書き足すと、前の倍率では入りきらず、図が次のページへ移ることがある（移った先は空いているので、そのままでは落ち着いてしまう）。
 * そこで、決めたときのページと違うページにあれば、いったん元の大きさに戻して決め直す（それでもまた移れば、この組み直しの間は大きくしない）
 */

/** 1行の高さ（mm。本文の領域の下端・本文の幅とともに、いまの余白から：pageGeometry.ts） */
const lineMm = () => (linePitchPt() * 25.4) / 72
/** 横に並べる図の間のすき間（bodyHtml.ts と同じ） */
const FIGURE_GAP_MM = 8
/** 大きくしても、図の縦はここまで */
const MAX_HEIGHT_MM = 120
/** これより小さい倍率なら大きくしない（ほとんど変わらない）・前の倍率とこれより違わなければ前のままにする（組み直しを繰り返さない） */
const MIN_GROW = 1.02
const SAME_GROW = 0.02

/** 図のまとまり（figureRow の ID）→ 大きくする倍率（1 より大きいものだけ）と、大きくすると決めたときに、まとまりがあったページ */
export type FigureGrow = Record<string, { scale: number; page: number }>

/** 図のまとまりを大きくするかを決めるのに使う、組んだ紙面の位置と大きさ（measureGrowLayout。単体テストでは作り物を渡す） */
export interface GrowLayout {
  /** 図のまとまりの位置（ページをまたげば、ページごとに複数） */
  group(id: string): Placed[]
  /** 図のまとまりの段ごとの、図の大きさ（mm。いまの倍率で組んだもの） */
  rows(id: string): { widthMm: number; heightMm: number }[][]
}

/** 組んだ紙面から、図のまとまりの位置と大きさを読み取る */
export function measureGrowLayout(pages: HTMLElement[]): GrowLayout {
  const float = measureFloatLayout(pages)
  return {
    group: float.group,
    rows: (id) =>
      pages.flatMap((page) =>
        [...page.querySelectorAll(`.figure-group[data-group-id="${CSS.escape(id)}"] .figure-row`)].map((row) =>
          [...row.querySelectorAll<HTMLElement>(':scope > figure > img, :scope > figure > .figure-slot')].map((el) => ({ widthMm: parseFloat(el.style.width) || 0, heightMm: parseFloat(el.style.height) || 0 })),
        ),
      ),
  }
}

/**
 * 今の紙面（grow の倍率で組んだもの）から、次に組むときの倍率を決める。
 * reset：この組み直しの間に、別のページへ移ったので元の大きさに戻したまとまり。blocked：もう大きくしないまとまり（2回目に移った・ページをまたいだ）
 */
export function decideFigureGrowth(layout: GrowLayout, chapters: Chapter[], deferred: ReadonlySet<string>, grow: FigureGrow, reset: Set<string>, blocked: Set<string>): FigureGrow {
  const next: FigureGrow = {}
  for (const chapter of chapters) {
    chapter.blocks.forEach((block, index) => {
      if (block.type !== 'figureRow' || blocked.has(block.id) || deferred.has(block.id)) return
      const after = chapter.blocks[index + 1]
      if (after && after.type !== 'pageBreak') return
      const was = grow[block.id]
      const current = was?.scale ?? 1
      const places = layout.group(block.id)
      const place = places[0]
      if (!place) return
      // ページをまたいだ：大きくしない
      if (places.length > 1) {
        if (was) blocked.add(block.id)
        return
      }
      // 大きくしたまま、決めたときと別のページへ移った・はみ出した：元の大きさに戻して決め直す（2回目は、もう大きくしない）
      if (was && (was.page !== place.page || place.bottom > contentBottomMm())) {
        if (reset.has(block.id)) blocked.add(block.id)
        else reset.add(block.id)
        return
      }
      const rows = layout.rows(block.id).filter((r) => r.length > 0)
      if (!rows.length) return
      // いまの図の高さ（段ごとのいちばん高い図の合計）と、倍率 1 のときの大きさ
      const heights = rows.map((r) => Math.max(...r.map((s) => s.heightMm)))
      const imagesHeight = heights.reduce((a, b) => a + b, 0)
      const room = contentBottomMm() - lineMm() - place.bottom
      const bySpace = (current * (imagesHeight + room)) / imagesHeight
      const byWidth = Math.min(...rows.map((r) => (current * (textWidthMm() - FIGURE_GAP_MM * (r.length - 1))) / r.reduce((a, s) => a + s.widthMm, 0)))
      const byHeight = (current * MAX_HEIGHT_MM) / Math.max(...heights)
      const scale = Math.floor(Math.min(bySpace, byWidth, byHeight) * 100) / 100
      if (scale < MIN_GROW) return
      next[block.id] = { scale: Math.abs(scale - current) < SAME_GROW ? current : scale, page: place.page }
    })
  }
  return next
}

/** 今の紙面から、次に組むときの倍率を決める（decideFigureGrowth に、紙面から読み取った位置を渡す） */
export function reviseFigureGrowth(pages: HTMLElement[], chapters: Chapter[], deferred: ReadonlySet<string>, grow: FigureGrow, reset: Set<string>, blocked: Set<string>): FigureGrow {
  return decideFigureGrowth(measureGrowLayout(pages), chapters, deferred, grow, reset, blocked)
}

export function sameGrow(a: FigureGrow, b: FigureGrow): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => b[k]?.scale === a[k].scale && b[k].page === a[k].page)
}

/** この端末に覚えた組み方（layout/memory.ts）の倍率を読む（前の版で覚えたものにはない。形が違えば、大きくしない） */
export function readFigureGrow(value: unknown): FigureGrow {
  if (!value || typeof value !== 'object') return {}
  const out: FigureGrow = {}
  for (const [id, g] of Object.entries(value as Record<string, unknown>)) {
    const { scale, page } = (g ?? {}) as { scale?: unknown; page?: unknown }
    if (typeof scale === 'number' && typeof page === 'number' && scale > 1 && scale < 3) out[id] = { scale, page }
  }
  return out
}
