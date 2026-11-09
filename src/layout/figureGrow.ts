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
 * - 大きくできるのは、下の空き（1行分は残す）・横は本文の幅（15cm）まで・縦は12cmまでの、いちばん小さい所まで
 * - 反対に、ページの下に少しだけ入りきらないまとまりは、85% まで小さくして、そのページに収める（decideShrink。依頼者の選択 2026-11-03）
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
/**
 * ページの下に少しだけ入りきらない図のまとまりは、ここまで小さくして、そのページに収める（それより小さくなるなら、今までどおり次のページへ。
 * 4枚（2段）のまとまりの後ろの段が次のページに回っていた：依頼者の選択 2026-11-03、85% まで）
 */
export const MIN_SHRINK = 0.85

/** 図のまとまり（figureRow の ID）→ 大きくする倍率（1 より大きいものだけ）と、大きくすると決めたときに、まとまりがあったページ */
export type FigureGrow = Record<string, { scale: number; page: number }>

/** 図のまとまりを大きくするかを決めるのに使う、組んだ紙面の位置と大きさ（measureGrowLayout。単体テストでは作り物を渡す） */
export interface GrowLayout {
  /** 図のまとまりの位置（ページをまたげば、ページごとに複数） */
  group(id: string): Placed[]
  /** 図のまとまりの段ごとの、図の大きさ（mm。いまの倍率で組んだもの） */
  rows(id: string): { widthMm: number; heightMm: number }[][]
  /** 段落の位置（ページをまたげば複数。小さくして段落のページに収めるかを決めるのに使う。なければ、その見方はしない） */
  block?(id: string): Placed[]
}

/** 組んだ紙面から、図のまとまりの位置と大きさを読み取る */
export function measureGrowLayout(pages: HTMLElement[]): GrowLayout {
  const float = measureFloatLayout(pages)
  return {
    group: float.group,
    block: float.block,
    rows: (id) =>
      pages.flatMap((page) =>
        [...page.querySelectorAll(`.figure-group[data-group-id="${CSS.escape(id)}"] .figure-row`)].map((row) =>
          [...row.querySelectorAll<HTMLElement>(':scope > figure > img, :scope > figure > .figure-slot, :scope > figure > .fig-crop')].map((el) => ({ widthMm: parseFloat(el.style.width) || 0, heightMm: parseFloat(el.style.height) || 0 })),
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
      if (block.type !== 'figureRow' || blocked.has(block.id)) return
      // 少しだけ入りきらないまとまりは、小さくしてそのページに収める（小さくするときは、大きくすることは考えない）
      const shrink = decideShrink(layout, chapter, index, grow, reset, blocked)
      if (shrink !== undefined) {
        if (shrink) next[block.id] = shrink
        return
      }
      if (deferred.has(block.id)) return
      // まだ写真を入れていない枠（ひな形の図の枠）のあるまとまりは、大きくしない（空の枠が大きく出ると、その大きさ・形の図を入れるものと
      // 思われる：依頼者の判断 2026-11-05。写真を入れたら、今までどおり大きくする）
      if (block.figures.some((f) => !f.imageId)) return
      const after = chapter.blocks[index + 1]
      if (after && after.type !== 'pageBreak' && !blankTail(chapter.blocks, index + 1)) return
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

/**
 * 図のまとまりを小さくして（MIN_SHRINK まで）、今のページに収めるか。
 * - 段の途中で次のページへ分かれた（4枚の2段目が次のページへ回った）：最初のページに収まる倍率
 * - 段落のすぐ下に入りきらず、まとまりごと次のページへ回った（送った）：段落のページに収まる倍率
 * - 前に小さくしたまとまり：決めたページに収まっていれば、下の空きに合わせて決め直す（1 になれば、小さくするのをやめる）。
 *   別のページへ移った・はみ出したら、いったん元の大きさに戻して決め直す（2回目は、もう小さくしない）
 * 戻り値：小さくする倍率と、収めるページ／null：小さくしない（この組み直しでは大きくもしない）／undefined：小さくする場面ではない
 */
function decideShrink(layout: GrowLayout, chapter: Chapter, index: number, grow: FigureGrow, reset: Set<string>, blocked: Set<string>): { scale: number; page: number } | null | undefined {
  const id = chapter.blocks[index].id
  const was = grow[id]
  if (was && was.scale > 1) return undefined
  const current = was?.scale ?? 1
  const places = layout.group(id)
  const rows = layout.rows(id).filter((r) => r.length > 0)
  if (!places.length || !rows.length) return undefined
  // 図の高さ（段ごとのいちばん高い図の合計）と、そのほか（図のタイトル・段の間）の高さ
  const imagesHeight = rows.map((r) => Math.max(...r.map((s) => s.heightMm))).reduce((a, b) => a + b, 0)
  if (imagesHeight <= 0) return undefined
  const others = Math.max(0, places.reduce((n, p) => n + (p.bottom - p.top), 0) - imagesHeight)
  /** 高さ room（mm）に収まる倍率 */
  const fitIn = (room: number) => Math.floor(((current * (room - others)) / imagesHeight) * 100) / 100
  const bottom = contentBottomMm()

  if (was) {
    const place = places[0]
    if (places.length > 1 || place.page !== was.page || place.bottom > bottom + 0.5) {
      if (reset.has(id)) blocked.add(id)
      else reset.add(id)
      return null
    }
    const scale = Math.min(1, fitIn(bottom - place.top))
    if (scale >= 1) return null
    return { scale: Math.abs(scale - current) < SAME_GROW ? current : Math.max(MIN_SHRINK, scale), page: place.page }
  }
  if (places.length > 1) {
    // 次のページの上では段の間の空きがなくなるので、その分（半行）を見込む
    const scale = fitIn(bottom - places[0].top - lineMm() / 2)
    return scale >= MIN_SHRINK && scale < 1 ? { scale, page: places[0].page } : undefined
  }
  const prev = chapter.blocks[index - 1]
  const anchor = prev?.type === 'paragraph' ? layout.block?.(prev.id).at(-1) : undefined
  if (anchor && places[0].page === anchor.page + 1) {
    // 段落の下に、まとまりの上の空き（1行）を空けて置く
    const scale = fitIn(bottom - anchor.bottom - lineMm() - 0.5)
    if (scale >= MIN_SHRINK && scale < 1) return { scale, page: anchor.page }
  }
  return undefined
}

/** 今の紙面から、次に組むときの倍率を決める（decideFigureGrowth に、紙面から読み取った位置を渡す） */
export function reviseFigureGrowth(pages: HTMLElement[], chapters: Chapter[], deferred: ReadonlySet<string>, grow: FigureGrow, reset: Set<string>, blocked: Set<string>): FigureGrow {
  return decideFigureGrowth(measureGrowLayout(pages), chapters, deferred, grow, reset, blocked)
}

/**
 * blocks[at] が、中身のない段落（ひな形の説明もない）で、章の終わりか改ページの前にあるか。
 * 「＋ 文章の続きを書く」を押したばかりの段落など。大きくした図の下には1行分の空きを残してあるので、そこに入る。
 * そのあいだは図の大きさを変えない（押した・何も書かずに離れたときに、図が小さくなったり大きくなったりして、学生が戸惑うため。
 * 文字を打ち始めたら、元の大きさに戻す：依頼者の選択 2026-11-09）
 */
function blankTail(blocks: Chapter['blocks'], at: number): boolean {
  const block = blocks[at]
  const next = blocks[at + 1]
  if (block?.type !== 'paragraph' || block.hint || (next && next.type !== 'pageBreak')) return false
  return block.content.every((node) => node.type === 'text' && !node.text.trim())
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
    if (typeof scale === 'number' && typeof page === 'number' && scale >= MIN_SHRINK && scale < 3 && scale !== 1) out[id] = { scale, page }
  }
  return out
}
